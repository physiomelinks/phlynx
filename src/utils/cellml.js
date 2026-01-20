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
  unitsModel.setName('OnlyUnitsFrom_' + model.name())
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

function extractUnitsFromMath(multiBlockMathString) {
  const wrappedString = `<root>${multiBlockMathString}</root>`

  // Parse the XML String
  const parser = new DOMParser()
  const doc = parser.parseFromString(wrappedString, 'application/xml')

  // Check for parsing errors (optional safety)
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    console.error('XML Parse Error:', parserError.textContent)
    throw new Error('XML Parse Error:', parserError.textContent)
  }

  // Define the Namespaces.
  const CELLML_NS = 'http://www.cellml.org/cellml/2.0#'
  const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

  // Find all <cn> elements
  // We use getElementsByTagNameNS to be strictly safe,
  // ensuring we only get MathML <cn> tags, not other tags named 'cn'.
  const cnElements = doc.getElementsByTagNameNS(MATHML_NS, 'cn')

  // Extract Unique Units
  const foundUnits = new Set()

  for (const cn of cnElements) {
    const unitName = cn.getAttributeNS(CELLML_NS, 'units')

    if (unitName) {
      foundUnits.add(unitName)
    }
  }

  return Array.from(foundUnits)
}

function handleLoggerErrors(logger, headerMessage) {
  const errMessages = [headerMessage]
  for (let i = 0; i < logger.errorCount(); i++) {
    const error = logger.error(i)
    console.log(`[${i}]: ${error.description()}`)
    errMessages.push(`[${i}]: ${error.description()}`)
    error.delete()
  }
  throw new Error(errMessages.join('\n'))
}

export function generateFlattenedModel(nodes, edges, builderStore) {
  const appVersion = __APP_VERSION__ || '1.0.0'

  // 1. Initialize core objects
  const model = new _libcellml.Model()
  model.setName(`PhLynxGeneratedv${appVersion}`.replaceAll('.', '_'))

  const printer = new _libcellml.Printer()
  const validator = new _libcellml.Validator()
  const parser = new _libcellml.Parser(false)
  const importer = new _libcellml.Importer(true)

  // --- Helper State ---
  const modelCache = new Map() // Key: sourceFileName, Value: libcellml.Model
  const nodeComponentMap = new Map() // Key: NodeID, Value: libcellml.Component
  const unitsLibraryCache = new Map() // Key: filename, Value: libcellml.Model
  const unitsImportSourceMap = new Map() // Key: filename, Value: libcellml.ImportSource

  // ------------------------------
  // HELPER: Reusable Unit Importer
  // ------------------------------
  const ensureUnitImported = (unitsName) => {
    // Safety Checks
    if (!unitsName) return
    // If it's already in the model (or is a standard unit like 'volt'), skip.
    if (model.hasUnitsByName(unitsName) || isStandardUnit(unitsName)) return

    // Search available libraries.
    let found = false

    for (const entry of builderStore.availableUnits) {
      // Lazy Load: Parse library only if not already cached
      if (!unitsLibraryCache.has(entry.filename)) {
        const libModel = parser.parseModel(entry.model)
        // Check for parse errors (optional but recommended)
        if (parser.errorCount() === 0) {
          unitsLibraryCache.set(entry.filename, libModel)
        } else {
          libModel.delete()
          handleLoggerErrors(
            parser,
            `Parser found ${parser.errorCount()} errors:`
          )
          continue
        }
      }

      const libModel = unitsLibraryCache.get(entry.filename)

      // Check if this library has the unit we need
      if (libModel.hasUnitsByName(unitsName)) {
        // Ensure we have an ImportSource for this file
        if (!unitsImportSourceMap.has(entry.filename)) {
          const importSource = new _libcellml.ImportSource()
          importSource.setUrl(entry.filename)
          importSource.setModel(libModel)

          // Register model with importer so it doesn't try to load from disk
          importer.addModel(libModel, entry.filename)

          unitsImportSourceMap.set(entry.filename, importSource)
        }

        // Create the Units object in our main model
        const importSource = unitsImportSourceMap.get(entry.filename)
        const importedUnits = new _libcellml.Units()
        importedUnits.setName(unitsName)
        importedUnits.setImportReference(unitsName)
        importedUnits.setImportSource(importSource)

        model.addUnits(importedUnits)

        // Cleanup the JS wrapper (C++ object is now owned by 'model')
        importedUnits.delete()

        found = true
        break // Stop searching other libraries
      }
    }

    if (!found) {
      console.log(`Warning: Could not find definition for unit '${unitsName}'`)
    }
  }

  try {
    // ---------------------------------
    // Process Nodes (Create Components)
    // ---------------------------------
    for (const node of nodes) {
      const fileName = node.data?.sourceFile
      const componentName = node.data?.componentName

      // ... (Load and Cache Source Model Logic - Unchanged) ...
      if (!modelCache.has(fileName)) {
        if (!builderStore.hasModuleFile(fileName))
          throw new Error(`Missing file: ${fileName}`)
        const parsedModel = parser.parseModel(
          builderStore.getModuleContent(fileName)
        )
        if (parser.errorCount() > 0) {
          handleLoggerErrors(
            parser,
            `Error parsing ${fileName} [${parser.errorCount()} errors]:`
          )
        }
        modelCache.set(fileName, parsedModel)
      }

      const sourceModel = modelCache.get(fileName)
      const originalComponent = sourceModel.componentByName(componentName, true)
      if (!originalComponent) {
        throw new Error(
          `Component '${componentName}' not found in '${fileName}'`
        )
      }

      // Clone Component
      const componentClone = originalComponent.clone()
      originalComponent.delete() // Only deleting the lookup wrapper
      // Set this early so any thrown errors will still delete this.
      nodeComponentMap.set(node.id, componentClone)

      componentClone.setName(node.data.name)
      model.addComponent(componentClone)

      // Add Units found in MathML.
      const mathUnits = extractUnitsFromMath(componentClone.math())
      for (const unitsName of mathUnits) {
        ensureUnitImported(unitsName)
      }

      // Add Units found in Variables.
      for (let i = 0; i < componentClone.variableCount(); i++) {
        const variable = componentClone.variableByIndex(i)

        const units = variable.units()
        const unitsName = units.name()

        // Use our helper
        ensureUnitImported(unitsName)

        variable.delete()
        units.delete()
      }
    }

    // ----------------------------------
    // Process Edges (Create Connections)
    // ----------------------------------

    // HELPER: Strips directionality suffixes for matching
    const normaliseName = (name) => {
      if (!name) return ''
      // Replaces "_in" or "_out" at the end of the string ($) with nothing
      return name.replace(/(_in|_out)$/, '')
    }

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
                const srcBase = normaliseName(srcOption)
                const tgtOption = tgtLabel.option.find(
                  (o) => normaliseName(o) === srcBase
                )
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
      handleLoggerErrors(
        validator,
        'Validator error count:',
        validator.errorCount()
      )
    }

    // Resolve and Flatten
    importer.resolveImports(model, '.')
    const flattenedModel = importer.flattenModel(model)

    if (importer.errorCount()) {
      handleLoggerErrors(
        validator,
        'Importer error count:',
        importer.errorCount()
      )
    }

    const flattenedModelString = printer.printModel(flattenedModel, false)
    flattenedModel.delete()

    return new Blob([flattenedModelString], {
      type: 'application/x.vnd.cellml+xml',
    })
  } finally {
    // -------
    // CLEANUP
    // -------

    // Delete Component/Module Caches.
    for (const cachedModel of modelCache.values()) cachedModel.delete()
    for (const component of nodeComponentMap.values()) component.delete()

    // Delete Unit Caches.
    for (const libModel of unitsLibraryCache.values()) libModel.delete()
    for (const importSource of unitsImportSourceMap.values())
      importSource.delete()

    // Delete Main Objects.
    model.delete()
    printer.delete()
    validator.delete()
    parser.delete()
    importer.delete()
  }
}

/**
 * Extracts unique variable names from a CellML model/component
 */
export function extractVariablesFromModule(module) {
  const names = new Set()
  if (module.model) {
    const parser = new _libcellml.Parser(false)
    const model = parser.parseModel(module.model)
    // Iterate all components in the model,
    // assumes flat model hierarchy.
    for (let c = 0; c < model.componentCount(); c++) {
      const comp = model.componentByIndex(c)
      for (let v = 0; v < comp.variableCount(); v++) {
        const variable = comp.variableByIndex(v)
        names.add(variable.name())
        variable.delete()
      }
      comp.delete()
    }
    model.delete()
    parser.delete()
  }

  return names
}
