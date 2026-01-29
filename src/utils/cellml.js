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

function nextAvailableVarName(component, baseName) {
  let candidateName = baseName
  let index = 1
  let currentCandidate = component.variableByName(candidateName)
  while (currentCandidate !== null) {
    candidateName = `${baseName}_${index}`
    index++
    currentCandidate.delete()
    currentCandidate = component.variableByName(candidateName)
  }
  return candidateName
}

function createSummationComponent(model, sourceComp, sourceVarName, targetComponentVarNameMap) {
  // Create the Component
  let sumComp = model.componentByName('generated_summations', true)
  if (sumComp === null) {
    sumComp = new _libcellml.Component()
    sumComp.setName('generated_summations')
    model.addComponent(sumComp)
  }

  // Setup Variables
  // We need to determine the units. We'll grab the units from the first source var.
  // (Assuming all summed variables have matching units)
  const referenceVar = sourceComp.variableByName(sourceVarName)
  const referneceUnits = referenceVar.units()
  const unitsName = referneceUnits.name() || 'dimensionless'
  referneceUnits.delete()

  const sumVarName = nextAvailableVarName(sumComp, `sum_of_${sourceVarName}`)
  const sumVar = new _libcellml.Variable()
  sumVar.setName(sumVarName)
  sumVar.setUnitsByName(unitsName)
  sumVar.setInterfaceTypeByString('public') // Allows connection to target
  sumComp.addVariable(sumVar)

  _libcellml.Variable.addEquivalence(referenceVar, sumVar)
  // Create Input Variables in the Sum Component
  const sumVarNames = []
  targetComponentVarNameMap.forEach((targetVarName, component) => {
    const localVarName = nextAvailableVarName(sumComp, `op_${targetVarName}`)
    sumVarNames.push(localVarName)

    const opVar = new _libcellml.Variable()
    opVar.setName(localVarName)
    opVar.setUnitsByName(unitsName)
    opVar.setInterfaceTypeByString('public') // Allows connection to source

    sumComp.addVariable(opVar)
    const tmpVar = component.variableByName(targetVarName)
    _libcellml.Variable.addEquivalence(opVar, tmpVar)
    opVar.delete()
    tmpVar.delete()
  })

  referenceVar.delete()
  sumVar.delete()
  // Generate MathML
  // Format: total_sum = in_0 + in_1 + in_2 ...
  const mathML = `<math xmlns="http://www.w3.org/1998/Math/MathML">
    <apply>
      <eq/>
      <ci>${sumVarName}</ci>
      <apply>
        <plus/>
        ${sumVarNames.map((name) => `<ci>${name}</ci>`).join('\n        ')}
      </apply>
    </apply>
  </math>`

  sumComp.appendMath(mathML)
  sumComp.delete()
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

/**
 * Checks if two port types are compatible for making connections over.
 *
 * @param {string} portType1 - Source port type one of 'general_ports', 'exit_ports', or 'entrance_ports'.
 * @param {string} portType2 - Target port type one of 'general_ports', 'exit_ports', or 'entrance_ports'.
 * @returns {boolean} True if the port types are compatible, false otherwise.
 */
function arePortTypesCompatible(portType1, portType2) {
  if (portType1 === 'general_ports' || portType2 === 'general_ports') {
    return true
  }
  // A source exit port can connect to a target entrance port.
  if (portType1 === 'exit_ports' && portType2 === 'entrance_ports') {
    return true
  }

  if (portType1 === 'entrance_ports' && portType2 === 'exit_ports') {
    return true
  }

  return false
}

function handleLoggerErrors(logger, headerMessage, dontThrow = false) {
  const errMessages = [headerMessage]
  console.log(headerMessage)
  for (let i = 0; i < logger.errorCount(); i++) {
    const error = logger.error(i)
    console.log(`[${i + 1}]: ${error.description()}`)
    if (!dontThrow) {
      errMessages.push(`[${i + 1}]: ${error.description()}`)
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
 * Applies parameter data to the model variables with strict unit and value validation.
 */
function applyParameterMappings(model, parameterData) {
  const paramMap = new Map()
  for (const params of parameterData.values()) {
    // Only iterate if params is actually an array of parameter objects
    if (Array.isArray(params)) {
      params.forEach((param) => {
        if (param.variable_name && !paramMap.has(param.variable_name)) {
          paramMap.set(param.variable_name, param)
        }
      })
    }
  }

  let paramComponent = model.componentByName('Model_Parameters', true)
  if (!paramComponent) {
    paramComponent = new _libcellml.Component()
    paramComponent.setName('Model_Parameters')
    model.addComponent(paramComponent)
  }

  for (let i = 0; i < model.componentCount(); i++) {
    const component = model.componentByIndex(i)
    const compName = component.name()

    if (compName === 'Model_Parameters' || compName === 'environment') {
      component.delete()
      continue
    }

    for (let v = 0; v < component.variableCount(); v++) {
      const variable = component.variableByIndex(v)
      const varName = variable.name()

      // Priority: 1. Specific Match (var_comp) 2. Global Match (var)
      const specificName = `${varName}_${compName}`
      const match = paramMap.get(specificName) || paramMap.get(varName)

      // Skip if no parameter data found or if the variable is already computed (has math)
      if (!match || !match.value || match.value.trim() === '') {
        variable.delete()
        continue
      }

      const matchUnitsTrimmed = match.units ? match.units.trim() : 'dimensionless'

      let sourceVar = paramComponent.variableByName(match.variable_name)

      if (!sourceVar) {
        sourceVar = new _libcellml.Variable()
        sourceVar.setName(match.variable_name)

        // Ensure the initial value is explicitly set to define variable type as 'constant'.
        sourceVar.setInitialValueByString(match.value.trim())

        const matchUnits = model.unitsByName(matchUnitsTrimmed)
        if (matchUnits) {
          sourceVar.setUnitsByUnits(matchUnits)
          matchUnits.delete()
        } else {
          sourceVar.setUnitsByName(matchUnitsTrimmed)
        }

        sourceVar.setInterfaceTypeByString('public')
        paramComponent.addVariable(sourceVar)
      }

      // Connect the constant parameter to the module variable.
      _libcellml.Variable.addEquivalence(sourceVar, variable)

      sourceVar.delete()
      variable.delete()
    }
    component.delete()
  }
  paramComponent.delete()
}

export function generateFlattenedModel(nodes, edges, builderStore) {
  const appVersion = __APP_VERSION__ || '1.0.0'

  // Initialize core objects
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

    const componentTrashCan = new Set()
    const multiPortSums = new Map()
    for (const edge of edges) {
      // Get Node Data
      const sourceNode = edge.sourceNode
      const targetNode = edge.targetNode

      if (!sourceNode || !targetNode) continue

      // Get the specific Cloned Components
      const sourceComp = nodeComponentMap.get(edge.source)
      const targetComp = nodeComponentMap.get(edge.target)

      // Iterate Source Labels to find Matches in Target
      // Assuming node.portLabels exists based on your description
      if (sourceNode.data?.portLabels && targetNode.data?.portLabels) {
        for (const srcLabel of sourceNode.data.portLabels) {
          // Find the matching label in the target
          const tgtLabel = targetNode.data.portLabels.find((l) => l.label === srcLabel.label)

          if (tgtLabel) {
            if (arePortTypesCompatible(srcLabel.portType, tgtLabel.portType)) {
              if (srcLabel.isMultiPortSum && tgtLabel.isMultiPortSum) {
                throw new Error('Multi-port-sum to Multi-port-sum connections are not supported.')
              } else if (srcLabel.isMultiPortSum || tgtLabel.isMultiPortSum) {
                const multiSumLabel = srcLabel.isMultiPortSum ? srcLabel : tgtLabel
                const multiSumComponent = srcLabel.isMultiPortSum ? sourceComp : targetComp
                const operandLabel = srcLabel.isMultiPortSum ? tgtLabel : srcLabel
                const operandComponent = srcLabel.isMultiPortSum ? targetComp : sourceComp
                const multiKey = multiSumComponent.name() + '::' + multiSumLabel.label
                if (!multiPortSums.has(multiKey)) {
                  multiPortSums.set(multiKey, {
                    sourceComp: multiSumComponent,
                    srcLabel: multiSumLabel,
                    targets: [],
                  })
                }
                multiPortSums.get(multiKey).targets.push({
                  component: operandComponent,
                  label: operandLabel,
                })
              } else {
                // Direct Connection (One-to-One)
                const minLength = Math.min(srcLabel.option.length, tgtLabel.option.length)

                for (let i = 0; i < minLength; i++) {
                  const srcOption = srcLabel.option[i]
                  const tgtOption = tgtLabel.option[i]

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
    }

    // throw new Error('Debugging multi-port-sum connections.')
    // Handle Multi-Port-Sum Connections
    for (const sumData of multiPortSums.values()) {
      const { sourceComp, srcLabel, targets } = sumData

      // Create the Summation Component
      const sourceVarNames = srcLabel.option
      if (sourceVarNames.length !== 1) {
        throw new Error('Multi-port-sum source must have exactly one variable representing the summed input.')
      }
      const sourceVarName = sourceVarNames[0] // Assuming single variable for source in multi-port-sum
      const targetComponents = new Map()
      for (const targetInfo of targets) {
        const { component, label } = targetInfo
        const targetVarNames = label.option
        if (targetVarNames.length !== 1) {
          throw new Error('Multi-port-sum target must have exactly one variable to be summed.')
        }
        const targetVarName = targetVarNames[0]
        targetComponents.set(component, targetVarName)
      }

      createSummationComponent(model, sourceComp, sourceVarName, targetComponents)

      // sourceComp.delete()
      // for (const targetComp of targetComponents.keys()) {
      // targetComp.delete()
      // }
    }

    for (const comp of componentTrashCan) {

      comp && comp.delete()
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

function hasParserError(parsedDocument) {
  var parser = new DOMParser(),
    errorneousParse = parser.parseFromString('<', 'application/xml'),
    parsererrorNS = errorneousParse.getElementsByTagName('parsererror')[0].namespaceURI

  if (parsererrorNS === 'http://www.w3.org/1999/xhtml') {
    return parsedDocument.getElementsByTagName('parsererror').length > 0
  }

  return parsedDocument.getElementsByTagNameNS(parsererrorNS, 'parsererror').length > 0
}

export function createEditableModelFromSourceModelAndComponent(modelString, componentName) {
  if (!modelString || !componentName) {
    return { xml: null, errors: ['Model or component name not provided'] }
  }
  const parser = new _libcellml.Parser(false)
  const model = parser.parseModel(modelString)

  if (!model || parser.errorCount() > 0) {
    const errors = []
    for (let i = 0; i < parser.errorCount(); i++) {
      const error = parser.error(i)
      errors.push(error.description())
      error.delete()
    }
    model && model.delete()
    parser.delete()
    return { xml: null, errors }
  }

  const modelName = model.name() || 'UnnamedModel'
  const component = model.componentByName(componentName, true)

  if (!component) {
    model.delete()
    parser.delete()
    return { xml: null, errors: [`Component '${componentName}' not found in model '${modelName}'`] }
  }

  const newModel = new _libcellml.Model()
  newModel.setName('EditModel')
  const compClone = component.clone()
  newModel.addComponent(compClone)

  const xmlParser = new DOMParser()
  // Remove comments from MathML, maybe libCellML can't handle them?
  const wrappedMathML = `<root>${compClone.math()}</root>`
  const doc = xmlParser.parseFromString(wrappedMathML, 'application/xml')
  if (!doc || hasParserError(doc)) {
    component.delete()
    compClone.delete()
    model.delete()
    parser.delete()
    newModel.delete()

    return { xml: null, errors: [`Error parsing MathML in '${modelName}' component '${componentName}'`] }
  }

  removeComments(doc)

  const mathNodes = doc.querySelectorAll('math')
  let cleanMathML = ''
  if (mathNodes.length > 0) {
    const serializer = new XMLSerializer()
    const primaryMath = mathNodes[0]
    for (let i = 1; i < mathNodes.length; i++) {
      const siblingMath = mathNodes[i]
      while (siblingMath.firstChild) {
        primaryMath.appendChild(siblingMath.firstChild)
      }
    }
    cleanMathML = serializer.serializeToString(primaryMath)
    compClone.setMath(cleanMathML)
  }

  const printer = new _libcellml.Printer()
  const newModelString = printer.printModel(newModel, false)

  component.delete()
  compClone.delete()
  model.delete()
  parser.delete()
  printer.delete()
  newModel.delete()

  return { xml: newModelString, errors: [] }
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
