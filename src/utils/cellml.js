let _libcellml = null

export function initLibCellML(instance) {
  _libcellml = instance
}

export function processModuleData(cellmlString) {
  let parser = new _libcellml.Parser(false)
  let printer = new _libcellml.Printer()
  let model = null
  try {
    model = parser.parseModel(cellmlString)
  } catch (err) {
    parser.delete()
    printer.delete()

    return {
      issues: [
        {
          description: 'Failed to parse model.  Reason:' + err.message,
        },
      ],
      type: 'parser',
    }
  }

  let errors = []
  let i = 0
  if (parser.errorCount()) {
    while (i < parser.errorCount()) {
      let e = parser.error(i)
      errors.push({
        description: e.description(),
      })
      e.delete()
      i++
    }
    parser.delete()
    printer.delete()
    model.delete()

    return { issues: errors, type: 'parser' }
  }

  parser.delete()
  printer.delete()

  let data = []
  for (i = 0; i < model.componentCount(); i++) {
    let comp = model.componentByIndex(i)
    let options = []
    for (let j = 0; j < comp.variableCount(); j++) {
      let varr = comp.variableByIndex(j)
      if (varr.hasInterfaceType(_libcellml.Variable.InterfaceType.PUBLIC)) {
        let units = varr.units()
        options.push({
          name: varr.name(),
          units: units.name(),
        })
        units.delete()
      }
      varr.delete()
    }
    data.push({
      name: comp.name(),
      portOptions: options,
      ports: [],
      componentName: comp.name(),
    })
    comp.delete()
  }

  model.delete()
  return { type: 'success', data, model: cellmlString }
}

export function processUnitsData(content) {
  let parser = new _libcellml.Parser(false)
  let model = null
  try {
    model = parser.parseModel(content)
  } catch (err) {
    parser.delete()

    return {
      issues: [
        {
          description: 'Failed to parse model.  Reason:' + err.message,
        },
      ],
      type: 'parser',
    }
  }

  const errorCount = parser.errorCount()
  parser.delete()
  if (errorCount) {
    model.delete()
    return {
      issues: [
        {
          description: 'Found parsing errors in model.',
        },
      ],
      type: 'parser',
    }
  }

  let unitsModel = new _libcellml.Model()
  const unitsCount = model.unitsCount()

  let i = 0
  for (i = 0; i < unitsCount; i++) {
    let units = model.unitsByIndex(i)
    let clonedUnits = units.clone()
    unitsModel.addUnits(clonedUnits)
    units.delete()
    clonedUnits.delete()
  }

  let printer = new _libcellml.Printer()
  const unitsModelString = printer.printModel(unitsModel, false)

  model.delete()
  unitsModel.delete()
  printer.delete()

  return {
    type: 'success',
    model: unitsModelString,
    units: { count: unitsCount },
  }
}

export function isCellML(content) {
  if (!_libcellml) {
    throw new Error("LibCellML is not ready or hasn't been initialized.")
  }
  let parser = new _libcellml.Parser(false)
  let model = null
  try {
    model = parser.parseModel(content)
  } catch (err) {
    parser.delete()
    return false
  }
  const errorCount = parser.errorCount()

  parser.delete()
  model.delete()

  return model !== null && errorCount === 0
}

function isStandardUnit(name) {
  const standard = [
    'ampere',
    'becquerel',
    'candela',
    'coulomb',
    'dimensionless',
    'farad',
    'gram',
    'gray',
    'henry',
    'hertz',
    'joule',
    'kat',
    'kelvin',
    'kilogram',
    'liter',
    'litre',
    'lumen',
    'lux',
    'meter',
    'metre',
    'mole',
    'newton',
    'ohm',
    'pascal',
    'radian',
    'second',
    'siemens',
    'sievert',
    'steradian',
    'tesla',
    'volt',
    'watt',
    'weber',
  ]
  return standard.includes(name)
}

function createSummationComponent(
  model,
  sourceComp,
  sourceVarNames,
  targetComp,
  targetVarName
) {
  // 1. Create the Component
  const sumComp = new _libcellml.Component()
  const uniqueName = `Sum_${sourceComp.name()}_to_${targetComp.name()}_${Date.now()}`
  sumComp.setName(uniqueName)

  // 2. Setup Variables
  // We need to determine the units. We'll grab the units from the first source var.
  // (Assuming all summed variables have matching units)
  const referenceVar = sourceComp.variableByName(sourceVarNames[0])
  const unitsName = referenceVar.units().name() || 'dimensionless'

  const inputVarNames = []

  // Create Input Variables in the Sum Component
  sourceVarNames.forEach((name, index) => {
    const localName = `in_${index}`
    inputVarNames.push(localName)

    const inputVar = new _libcellml.Variable()
    inputVar.setName(localName)
    inputVar.setUnitsByName(unitsName)
    inputVar.setInterfaceType('public') // Allows connection to source

    sumComp.addVariable(inputVar)

    // CONNECT: Source -> Sum Input
    const sourceVar = sourceComp.variableByName(name)
    _libcellml.Variable.addEquivalence(sourceVar, inputVar)
  })

  // Create Output Variable (The Total)
  const totalVar = new _libcellml.Variable()
  totalVar.setName('total_sum')
  totalVar.setUnitsByName(unitsName)
  totalVar.setInterfaceType('public') // Allows connection to target
  sumComp.addVariable(totalVar)

  // CONNECT: Sum Output -> Target
  const targetVar = targetComp.variableByName(targetVarName)
  if (targetVar.name()) {
    _libcellml.Variable.addEquivalence(totalVar, targetVar)
  }

  // 3. Generate MathML
  // Format: total_sum = in_0 + in_1 + in_2 ...
  const mathML = `<math xmlns="http://www.w3.org/1998/Math/MathML">
    <apply>
      <eq/>
      <ci>total_sum</ci>
      <apply>
        <plus/>
        ${inputVarNames.map((name) => `<ci>${name}</ci>`).join('\n        ')}
      </apply>
    </apply>
  </math>`

  sumComp.setMath(mathML)

  // 4. Register with Model
  model.addComponent(sumComp)
}

export function generateFlattenedModel(nodes, edges, builderStore) {
  const appVersion = __APP_VERSION__ || '1.0.0'

  // 1. Initialize core objects
  const model = new _libcellml.Model()
  model.setName(`PhLynxGeneratedv${appVersion}`.replaceAll('.', '_'))

  const printer = new _libcellml.Printer()
  const validator = new _libcellml.Validator()
  const parser = new _libcellml.Parser(false) // Needed to read strings from store

  // --- Helper State ---
  const modelCache = new Map() // Key: sourceFileName, Value: libcellml.Model
  const nodeComponentMap = new Map() // Key: NodeID, Value: libcellml.Component (The clone in the new model)
  const unitsImportSourceMap = new Map() // Key: filename, Value: libcellml.ImportSource

  const importer = new _libcellml.Importer(true)

  try {
    // ---------------------------------
    // Process Nodes (Create Components)
    // ---------------------------------
    for (const node of nodes) {
      const fileName = node.data?.sourceFile
      const componentName = node.data?.componentName // The name inside the source file

      // Load and Cache the Source Model if not already present
      if (!modelCache.has(fileName)) {
        if (!builderStore.hasModuleFile(fileName)) {
          throw new Error(`Missing file in store: ${fileName}`)
        }

        // Retrieve content string from the store
        const fileContent = builderStore.getModuleContent(fileName)
        const parsedModel = parser.parseModel(fileContent)

        if (parser.errorCount() > 0) {
          const errMessages = [`Error parsing ${fileName}:`]
          for (let i = 0; i < parser.errorCount(); i++) {
            const error = parser.error(i)
            console.log(`[${i}]: ${error.description()}`)
            errMessages.push(`[${i}]: ${error.description()}`)
            error.delete()
          }
          parsedModel.delete()
          throw new Error(errMessages.join('\n'))
        }
        modelCache.set(fileName, parsedModel)
      }

      // Get the Source Model
      const sourceModel = modelCache.get(fileName)

      // Find the specific component
      const originalComponent = sourceModel.componentByName(componentName, true)
      if (!originalComponent) {
        throw new Error(
          `Component '${componentName}' not found in '${fileName}'`
        )
      }

      // CLONE the component
      // We must clone because we are moving it into a new model,
      // and we might use this same component definition multiple times.
      const componentClone = originalComponent.clone()
      originalComponent.delete()

      // Set the name to the value from the current node.
      componentClone.setName(node.data.name)

      // Add to Main Model.
      model.addComponent(componentClone)

      // Iterate through all variables in this component
      for (let i = 0; i < componentClone.variableCount(); i++) {
        const variable = componentClone.variableByIndex(i)

        // Get the name of the units (e.g., "millivolt_per_second", "micromolar")
        const units = variable.units()
        const unitsName = units.name()
        variable.delete()
        units.delete()

        // Safety check: ensure the variable actually has a unit name assigned.
        if (!unitsName) continue

        // Check if this Unit definition already exists in our main Model
        // If it's already there (e.g., imported by a previous node), skip it.
        if (model.hasUnitsByName(unitsName)) {
          continue
        }

        // Search for the definition in the builderStore.availableUnits cache.
        for (const entry of builderStore.availableUnits) {
          const unitsModel = parser.parseModel(entry.model)
          // Try to find the unit in this library model
          const hasUnits = unitsModel.hasUnitsByName(unitsName)

          if (hasUnits) {
            if (!unitsImportSourceMap.has(entry.filename)) {
              const importSource = new _libcellml.ImportSource()
              importSource.setUrl(entry.filename)
              importSource.setModel(unitsModel)
              importer.addModel(unitsModel, entry.filename)
              unitsImportSourceMap.set(entry.filename, importSource)
            }
            const importSource = unitsImportSourceMap.get(entry.filename)

            const importedUnits = new _libcellml.Units()
            importedUnits.setName(unitsName)
            importedUnits.setImportReference(unitsName)
            importedUnits.setImportSource(importSource)

            model.addUnits(importedUnits)

            importedUnits.delete()
            unitsModel.delete()
            break // Found it! Stop searching.
          }
          unitsModel.delete()
        }
      }

      nodeComponentMap.set(node.id, componentClone)
    }

    // ----------------------------------
    // Process Edges (Create Connections)
    // ----------------------------------
    // Inside generateFlattenedModel...

    for (const edge of edges) {
      // Get Node Data
      const sourceNode = edge.sourceNode
      const targetNode = edge.targetNode

      if (!sourceNode || !targetNode) continue

      // Get the specific Cloned Components (created in your previous step)
      const sourceComp = nodeComponentMap.get(edge.source)
      const targetComp = nodeComponentMap.get(edge.target)

      // Iterate Source Labels to find Matches in Target
      // Assuming node.portLabels exists based on your description
      if (sourceNode.data?.portLabels && targetNode.data?.portLabels) {
        for (const srcLabel of sourceNode.data.portLabels) {
          // Find the matching label in the target
          const tgtLabel = targetNode.data.portLabels.find(
            (l) => l.label === srcLabel.label
          )

          if (tgtLabel) {
            // MATCH FOUND: Determine connection type
            if (srcLabel.isMultiPortSum) {
              // CASE A: Summation (Many-to-One)
              // We connect all source options into a new Summer,
              // and connect the Summer result to the target.

              createSummationComponent(
                model,
                sourceComp,
                srcLabel.option, // Inputs
                targetComp,
                tgtLabel.option[0] // Output (Target expects 1 result)
              )
            } else {
              // CASE B: Direct Connection (One-to-One)
              for (const srcOption of srcLabel.option) {
                const tgtOption = tgtLabel.option.find((o) => o === srcOption)
                if (srcOption && tgtOption) {
                  const v1 = sourceComp.variableByName(srcOption)
                  const v2 = targetComp.variableByName(tgtOption)

                  if (v1 && v2) {
                    _libcellml.Variable.addEquivalence(v1, v2)
                  }

                  v1.delete()
                  v2.delete()
                }
              }
            }
          }
        }
      }
    }

    // ------------------
    // Validate and Print
    // ------------------
    model.linkUnits()

    validator.validateModel(model)
    if (validator.errorCount()) {
      const errMessages = ['Validator error count:', validator.errorCount()]
      for (let i = 0; i < validator.errorCount(); i++) {
        const error = validator.error(i)
        console.log(`[${i}]: ${error.description()}`)
        errMessages.push(`[${i}]: ${error.description()}`)
        error.delete()
      }
      throw new Error(errMessages.join('\n'))
    }

    importer.resolveImports(model, '.')
    const flattenedModel = importer.flattenModel(model)

    if (importer.errorCount()) {
      const errMessages = ['Importer error count:', importer.errorCount()]
      console.error('Importer error count:', importer.errorCount())
      for (let i = 0; i < importer.errorCount(); i++) {
        const error = importer.error(i)
        console.error(`[${i}]: ${error.description()}`)
        errMessages.push(`[${i}]: ${error.description()}`)
        error.delete()
      }
      throw new Error(errMessages.join('\n'))
    }

    const flattenedModelString = printer.printModel(flattenedModel, false)
    flattenedModel.delete()

    return new Blob([flattenedModelString], {
      type: 'application/x.vnd.cellml+xml',
    })
  } finally {
    // ---------------------------------------------------------
    // CLEANUP (Very Important for WASM/C++)
    // ---------------------------------------------------------

    // Delete cached objects.
    for (const cachedModel of modelCache.values()) {
      cachedModel.delete()
    }

    for (const component of nodeComponentMap.values()) {
      component.delete()
    }

    for (const importSource of unitsImportSourceMap.values()) {
      importSource.delete()
    }

    // Delete the Main objects
    model.delete()
    printer.delete()
    validator.delete()
    parser.delete()
    importer.delete()
  }
}
