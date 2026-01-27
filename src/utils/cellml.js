let _libcellml = null

// Define the Namespaces.
const CELLML_NS = 'http://www.cellml.org/cellml/2.0#'
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

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
  const isValid = model !== null && errorCount === 0

  parser.delete()
  model.delete()

  return isValid
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

function createSummationComponent(model, sourceComp, sourceVarNames, targetComp, targetVarName) {
  // Create the Component
  const sumComp = new _libcellml.Component()
  const uniqueName = `Sum_${sourceComp.name()}_to_${targetComp.name()}_${Date.now()}`
  sumComp.setName(uniqueName)

  // Setup Variables
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

  // Generate MathML
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

function handleLoggerErrors(logger, headerMessage, dontThrow = false) {
  const errMessages = [headerMessage]
  console.log(headerMessage)
  for (let i = 0; i < logger.errorCount(); i++) {
    const error = logger.error(i)
    console.log(`[${i}]: ${error.description()}`)
    if (!dontThrow) {
      errMessages.push(`[${i}]: ${error.description()}`)
    }
    error.delete()
  }
  if (!dontThrow) {
    throw new Error(errMessages.join('\n'))
  }
}

function separateGlobalParameters(model) {
  // Get the source component
  const paramComp = model.componentByName('Model_Parameters', true)
  if (!paramComp) {
    paramComp.delete()
    return // Nothing to do if parameters aren't loaded
  }

  // Create the destination component for globals
  const globalComp = new _libcellml.Component()
  globalComp.setName('Global_Parameters')
  model.addComponent(globalComp)

  // Iterate BACKWARDS through the variables
  // We loop backwards because we are removing items from the list we are iterating over.
  for (let i = paramComp.variableCount() - 1; i >= 0; i--) {
    const variable = paramComp.variableByIndex(i)

    // Check how many connections this variable has.
    // > 1 means it is connected to multiple modules (e.g. Temperature T)
    // 1 means it is connected to a specific module (e.g. g_Na_soma)
    if (variable.equivalentVariableCount() > 1) {
      // Detach from the old component (Model_Parameters)
      // Note: This does NOT delete the variable or break its equivalences,
      // it just un-registers it from this component.
      paramComp.removeVariableByVariable(variable)

      // Attach to the new component (Global_Parameters)
      globalComp.addVariable(variable)
    } else if (variable.equivalentVariableCount() === 0) {
      paramComp.removeVariableByVariable(variable)
    }

    variable.delete()
  }

  globalComp.delete()
  paramComp.delete()
}

function addEnvironmentComponent(model) {
  const environmentComp = new _libcellml.Component()
  environmentComp.setName('environment')
  model.addComponent(environmentComp)

  const timeVar = new _libcellml.Variable()
  timeVar.setName('time')
  timeVar.setUnitsByName('second')
  timeVar.setInterfaceTypeByString('public')
  environmentComp.addVariable(timeVar)

  for (let i = 0; i < model.componentCount(); i++) {
    const component = model.componentByIndex(i)

    if (component.name() === 'environment') {
      component.delete()
      continue
    }
    const timeVarInComp = component.variableByName('t') || component.variableByName('time')
    if (timeVarInComp) {
      const timeUnits = timeVar.units()
      const timeVarInCompUnits = timeVarInComp.units()
      if (_libcellml.Units.compatible(timeUnits, timeVarInCompUnits)) {
        _libcellml.Variable.addEquivalence(timeVar, timeVarInComp)
      }
      timeUnits.delete()
      timeVarInCompUnits.delete()
      timeVarInComp.delete()
    }
    component.delete()
  }

  environmentComp.delete()
  timeVar.delete()
}

function prioritizeEnvironmentComponent(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  // Check for parse errors.
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    console.error('XML Parse Error during reordering:', parserError.textContent)
    return xmlString // Return original if parsing fails
  }

  // Get the Model element
  const model = doc.getElementsByTagNameNS(CELLML_NS, 'model')[0]
  if (!model) return xmlString

  // Find the 'environment' component.
  const components = Array.from(doc.getElementsByTagNameNS(CELLML_NS, 'component'))

  const envComp = components.find((c) => c.getAttribute('name') === 'environment')

  // Move it to be the first component child of model.
  if (envComp) {
    const firstOtherComp = components.find((c) => c !== envComp)
    if (firstOtherComp) {
      model.insertBefore(envComp, firstOtherComp)
    }
  }

  // Serialize back to string.
  const serializer = new XMLSerializer()
  return serializer.serializeToString(doc)
}

/**
 * Applies parameter data to the model variables.
 * Logic:
 * 1. Look for specific match: VariableName + "_" + ComponentName (e.g. "R" in "axon_SN" -> "R_axon_SN")
 * 2. Look for global match: VariableName (e.g. "Faraday" -> "Faraday")
 */
function applyParameterMappings(model, parameterData) {
  // Build a Map of parameter data for quick lookup
  const paramMap = new Map()
  for (const params of parameterData.values()) {
    for (const param of params) {
      if (param.variable_name && !paramMap.has(param.variable_name)) {
        paramMap.set(param.variable_name, param)
      } else if (param.variable_name && paramMap.has(param.variable_name)) {
        // Handle duplicate parameter names (e.g., same variable in different components)
        // For now, we'll keep the first one encountered.
        console.warn(`Duplicate parameter name found: ${param.variable_name}`)
      }
    }
  }

  // Create a dedicated component to hold these constant values.
  let paramComponent = model.componentByName('Model_Parameters', true)
  if (!paramComponent) {
    paramComponent = new _libcellml.Component()
    paramComponent.setName('Model_Parameters')
    model.addComponent(paramComponent)
  }

  // Iterate over every component in the generated model
  for (let i = 0; i < model.componentCount(); i++) {
    const component = model.componentByIndex(i)
    const compName = component.name()

    // Skip the parameter component itself to avoid infinite loops
    if (compName === 'Model_Parameters') {
      component.delete()
      continue
    }

    for (let v = 0; v < component.variableCount(); v++) {
      const variable = component.variableByIndex(v)
      const varName = variable.name()

      // Attempt 1: Specific (Postfix) Match
      // e.g. Variable 'g_Na' in component 'soma_SN' looks for 'g_Na_soma_SN'
      const specificName = `${varName}_${compName}`

      // Attempt 2: Exact (Global) Match
      // e.g. Variable 'T' looks for 'T'
      const globalName = varName

      let match = null

      if (paramMap.has(specificName)) {
        match = paramMap.get(specificName)
      } else if (paramMap.has(globalName)) {
        match = paramMap.get(globalName)
      }

      // If no match found in CSV, skip this variable
      if (!match) {
        variable.delete()
        continue
      }

      // --- UNIT VALIDATION ---
      // Check if units match.
      // Warn but proceed, assuming the user knows the units are compatible/converted.
      const variableUnits = variable.units()
      const variableUnitsName = variableUnits.name()
      const matchUnitsTrimmed = match.units ? match.units.trim() : ''
      const matchUnits = model.unitsByName(matchUnitsTrimmed)

      const compatibleUnits =
        _libcellml.Units.compatible(variableUnits, matchUnits) ||
        (isStandardUnit(variableUnitsName) &&
          isStandardUnit(matchUnitsTrimmed) &&
          matchUnitsTrimmed === variableUnitsName)

      if (!compatibleUnits) {
        console.warn(
          `Unit Mismatch in ${compName}.${varName}: Model uses '${variableUnitsName}', Parameter uses '${matchUnitsTrimmed}'`
        )
      }

      // --- CREATION & CONNECTION ---

      // Get or Create the Source Variable in the "Model_Parameters" component
      // We use the parameter name for the parameter variable to ensure uniqueness
      // (e.g. one global "T", but separate "R_axon" and "R_soma")
      let sourceVar = paramComponent.variableByName(match.variable_name)

      if (!sourceVar) {
        sourceVar = new _libcellml.Variable()
        sourceVar.setName(match.variable_name)
        sourceVar.setInitialValueByString(match.value.trim())
        if (matchUnits) {
          sourceVar.setUnitsByUnits(matchUnits)
        } else {
          sourceVar.setUnitsByName(matchUnitsTrimmed)
        }
        sourceVar.setInterfaceTypeByString('public')
        paramComponent.addVariable(sourceVar)
      }

      _libcellml.Variable.addEquivalence(sourceVar, variable)

      variableUnits.delete()
      matchUnits && matchUnits.delete()
      sourceVar.delete()
      variable.delete()
    }
    component.delete()
  }

  paramComponent.delete()
}

export function generateFlattenedModel(nodes, edges, builderStore) {
  const appVersion = __APP_VERSION__ || '1.0.0'

  // 1. Initialize core objects
  const model = new _libcellml.Model()
  model.setName(`PhLynxGenerated_v${appVersion}`.replaceAll('.', '_'))

  const printer = new _libcellml.Printer()
  const validator = new _libcellml.Validator()
  const parser = new _libcellml.Parser(false)
  const importer = new _libcellml.Importer(true)
  const analyser = new _libcellml.Analyser()

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
          handleLoggerErrors(parser, `Parser found ${parser.errorCount()} errors:`)
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
      console.warn(`Could not find definition for unit '${unitsName}'`)
    }
  }

  try {
    // ---------------------------------
    // Process Nodes (Create Components)
    // ---------------------------------
    const parameterData = new Map()
    const seenParameterFiles = new Set()
    for (const node of nodes) {
      const fileName = node.data?.sourceFile
      const componentName = node.data?.componentName
      const parameterFileName = builderStore.getParameterFileNameForModule(fileName)
      if (parameterFileName && !seenParameterFiles.has(parameterFileName)) {
        const parameters = builderStore.getParametersForModule(fileName)
        seenParameterFiles.add(parameterFileName)
        parameterData.set(parameterFileName, parameters)
      }
      parameterData.set(componentName, parameterFileName)

      // ... (Load and Cache Source Model Logic - Unchanged) ...
      if (!modelCache.has(fileName)) {
        if (!builderStore.hasModuleFile(fileName)) throw new Error(`Missing file: ${fileName}`)
        const parsedModel = parser.parseModel(builderStore.getModuleContent(fileName))
        if (parser.errorCount() > 0) {
          handleLoggerErrors(parser, `Error parsing ${fileName} [${parser.errorCount()} errors]:`)
        }
        modelCache.set(fileName, parsedModel)
      }

      const sourceModel = modelCache.get(fileName)
      const originalComponent = sourceModel.componentByName(componentName, true)
      if (!originalComponent) {
        throw new Error(`Component '${componentName}' not found in '${fileName}'`)
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
    const normaliseName = (name, portType) => {
      if (!name) return ''
      // Replaces "_in" or "_out" at the end of the string ($) with nothing
      return name.replace(
        portType === 'exit_ports' ? /_out$/ : portType === 'entrance_ports' ? /_in$/ : /(_in|_out)$/,
        ''
      )
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
          const tgtLabel = targetNode.data.portLabels.find((l) => l.label === srcLabel.label)

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
                const srcBase = normaliseName(srcOption, srcLabel.portType)
                const tgtOption = tgtLabel.option.find((o) => normaliseName(o, tgtLabel.portType) === srcBase)
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

    model.linkUnits()

    applyParameterMappings(model, parameterData)

    separateGlobalParameters(model)

    addEnvironmentComponent(model)

    // ------------------
    // Validate and Print
    // ------------------

    validator.validateModel(model)
    if (validator.errorCount()) {
      handleLoggerErrors(validator, `Validator error count: ${validator.errorCount()}`)
    }

    // Resolve and Flatten
    importer.resolveImports(model, '.')
    const flattenedModel = importer.flattenModel(model)

    if (importer.errorCount()) {
      flattenedModel.delete()
      handleLoggerErrors(importer, `Importer error count: ${importer.errorCount()}`)
    }

    analyser.analyseModel(flattenedModel)
    if (analyser.errorCount()) {
      // FIXME: There is a bug in libCellML where the analyser cannot handle
      // initialisation of a variable that is computed.
      // flattenedModel.delete()
      handleLoggerErrors(analyser, `Analyser error count: ${analyser.errorCount()}`, true)
    }

    let flattenedModelString = printer.printModel(flattenedModel, false)
    flattenedModel.delete()

    flattenedModelString = prioritizeEnvironmentComponent(flattenedModelString)

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
    for (const importSource of unitsImportSourceMap.values()) importSource.delete()

    // Delete Main Objects.
    analyser.delete()
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

function removeComments(node) {
  const children = Array.from(node.childNodes)

  for (const child of children) {
    if (child.nodeType === 8) {
      // 8 = Node.COMMENT_NODE
      node.removeChild(child)
    } else if (child.nodeType === 1) {
      // 1 = Element
      removeComments(child)
    }
  }
}

export function createEditableModelFromSourceModelAndComponent(modelString, componentName) {
  if (modelString) {
    const parser = new _libcellml.Parser(false)
    const model = parser.parseModel(modelString)
    const component = model.componentByName(componentName, true)
    if (component) {
      const newModel = new _libcellml.Model()
      newModel.setName('EditModel')
      const compClone = component.clone()
      newModel.addComponent(compClone)

      const xmlParser = new DOMParser()
      // Remove comments from MathML, maybe libCellML can't handle them?
      const doc = xmlParser.parseFromString(compClone.math(), 'application/xml')
      removeComments(doc)
      const serializer = new XMLSerializer()
      const cleanMathML = serializer.serializeToString(doc)
      compClone.setMath(cleanMathML)

      const printer = new _libcellml.Printer()
      const newModelString = printer.printModel(newModel, false)

      component.delete()
      compClone.delete()
      model.delete()
      parser.delete()
      printer.delete()
      newModel.delete()

      return newModelString
    }
    model.delete()
    parser.delete()
  }

  return null
}

export function doesComponentExistInModel(modelString, componentName) {
  if (modelString) {
    const parser = new _libcellml.Parser(false)
    const model = parser.parseModel(modelString)
    const component = model.componentByName(componentName, true)
    const hasComponent = component !== null
    if (component) component.delete()
    model.delete()
    parser.delete()
    return hasComponent
  }
  return false
}

export function mergeModelComponents(targetModelString, sourceModelString, newComponentName) {
  const parser = new _libcellml.Parser(false)

  let targetModel = null
  if (targetModelString && targetModelString.trim().length > 0) {
    try {
      targetModel = parser.parseModel(targetModelString)
    } catch (error) {
      parser.delete()
      return ''
      // Handle parsing error if needed
    }
  }

  if (!targetModel) {
    targetModel = new _libcellml.Model()
    targetModel.setName('UserModules')
  }

  let sourceModel = null
  try {
    sourceModel = parser.parseModel(sourceModelString)
  } catch (error) {
    targetModel.delete()
    parser.delete()
    return ''
  }

  if (sourceModel.componentCount() > 0) {
    const component = sourceModel.componentByIndex(0)
    const existingComponent = targetModel.componentByName(newComponentName, true)

    if (existingComponent) {
      targetModel.removeComponentByName(newComponentName, true)
      existingComponent.delete()
    }

    const clonedComponent = component.clone()
    clonedComponent.setName(newComponentName)
    targetModel.addComponent(clonedComponent)
    clonedComponent.delete()
    component.delete()
  }

  const printer = new _libcellml.Printer()
  const mergedModelString = printer.printModel(targetModel, false)

  targetModel.delete()
  sourceModel.delete()
  parser.delete()
  printer.delete()

  return mergedModelString
}

export function areModelsEquivalent(modelAString, modelBString) {
  if (!modelAString || !modelBString) {
    return false
  }

  if (modelAString.trim() === '' || modelBString.trim() === '') {
    return false
  }

  const parser = new _libcellml.Parser(true)
  const modelA = parser.parseModel(modelAString)
  const modelB = parser.parseModel(modelBString)

  const equal = modelA.equals(modelB)

  modelA.delete()
  modelB.delete()
  parser.delete()

  return equal
}
