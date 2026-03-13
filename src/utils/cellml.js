import { isEmpty } from './variables.js'
import { STANDARD_UNITS, AFFINE_UNIT_CONVERSIONS } from './constants.js'

let _libcellml = null

// Define the Namespaces.
const CELLML_NS = 'http://www.cellml.org/cellml/2.0#'
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'
const GLOBAL_PARAMETERS = 'parameters_global'
const MODEL_PARAMETERS = 'parameters'

export function initLibCellML(instance) {
  _libcellml = instance
}

/**
 * Parses a CellML file once and extracts both component and units data.
 *
 * @param {string} cellmlString - Raw CellML XML string.
 */
export function processCellMLData(cellmlString) {
  const parser = new _libcellml.Parser(false)
  let model = null

  // --- Parse ---
  try {
    model = parser.parseModel(cellmlString)
  } catch (err) {
    parser.delete()
    return {
      type: 'parser',
      issues: [{ description: 'Failed to parse model. Reason: ' + err.message }],
    }
  }

  if (parser.errorCount()) {
    const issues = []
    for (let i = 0; i < parser.errorCount(); i++) {
      const e = parser.error(i)
      issues.push({ description: e.description() })
      e.delete()
    }
    parser.delete()
    model.delete()
    return { type: 'parser', issues }
  }

  parser.delete()

  // --- Extract components ---
  const componentData = []
  for (let i = 0; i < model.componentCount(); i++) {
    const comp = model.componentByIndex(i)
    const options = []
    const variables = []

    for (let j = 0; j < comp.variableCount(); j++) {
      const varr = comp.variableByIndex(j)
      if (
        varr.hasInterfaceType(_libcellml.Variable.InterfaceType.PUBLIC) ||
        varr.hasInterfaceType(_libcellml.Variable.InterfaceType.PUBLIC_AND_PRIVATE)
      ) {
        const units = varr.units()
        const entry = { name: varr.name(), units: units.name() }
        options.push(entry)
        if (isPossibleParameter(varr)) {
          variables.push(entry)
        }
        units.delete()
      }
      varr.delete()
    }

    componentData.push({
      name: comp.name(),
      portOptions: options,
      ports: [],
      componentName: comp.name(),
      variables,
    })
    comp.delete()
  }

  // --- Extract units into a stripped model ---
  const unitsModel = new _libcellml.Model()
  unitsModel.setName('OnlyUnitsFrom_' + model.name())
  const unitsCount = model.unitsCount()

  for (let i = 0; i < unitsCount; i++) {
    const units = model.unitsByIndex(i)
    const cloned = units.clone()
    unitsModel.addUnits(cloned)
    units.delete()
    cloned.delete()
  }

  const printer = new _libcellml.Printer()
  const unitsModelString = printer.printModel(unitsModel, false)

  model.delete()
  unitsModel.delete()
  printer.delete()

  return {
    type: 'success',
    components: {
      data: componentData,
      model: cellmlString,
    },
    units: {
      model: unitsModelString,
      count: unitsCount,
    },
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
  return STANDARD_UNITS.includes(name)
}

function isAffineUnit(name) {
  return name in AFFINE_UNIT_CONVERSIONS
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

function createAffineConversionComponent(model, v1, v2, v1CompName, v2CompName) {
  const u1 = v1.units().name()
  const u2 = v2.units().name()

  const conv1 = AFFINE_UNIT_CONVERSIONS[u1]
  const conv2 = AFFINE_UNIT_CONVERSIONS[u2]

  if (!conv1 && !conv2) return false

  const v1Name = v1.name()
  const v2Name = v2.name()

  let inVarCompName, inVarName, outVarCompName, outVarName
  let scale, offset, inUnitName, outUnitName

  if (conv1 && conv2) {
    if (conv1.baseUnit !== conv2.baseUnit) {
      throw new Error(`Cannot convert between ${u1} and ${u2}: incompatible base units (${conv1.baseUnit} vs ${conv2.baseUnit})`)
    }
    inVarCompName  = v1CompName; inVarName  = v1Name; inUnitName  = u1
    outVarCompName = v2CompName; outVarName = v2Name; outUnitName = u2
    scale  = conv1.scale / conv2.scale
    offset = (conv1.offset - conv2.offset) / conv2.scale

    // Both sides share the same affine unit 
    if (scale === 1 && offset === 0) {
      _libcellml.Variable.addEquivalence(v1, v2)
      return true
    }
  } else {
    const conv = conv1 ?? conv2
    // Base unit is input (computed), affine unit is output (derived display value)
    inVarCompName  = conv1 ? v2CompName : v1CompName   // base unit side
    inVarName      = conv1 ? v2Name : v1Name
    inUnitName     = conv1 ? u2 : u1
    outVarCompName = conv1 ? v1CompName : v2CompName   // affine unit side
    outVarName     = conv1 ? v1Name : v2Name
    outUnitName    = conv1 ? u1 : u2
    scale  = 1 / conv.scale
    offset = -conv.offset / conv.scale
  }
 
  if (!inVarName || !outVarName || !inVarCompName || !outVarCompName) {
    throw new Error(`Affine conversion: failed to resolve variable or component names (in: ${inVarName}@${inVarCompName}, out: ${outVarName}@${outVarCompName})`)
  }

  // Get or create the single shared affine conversions component
  let convComp = model.componentByName('affine_unit_conversions', true)
  const isNew = convComp === null
  if (isNew) {
    convComp = new _libcellml.Component()
    convComp.setName('affine_unit_conversions')
  }

  // Create uniquely named local variables within the shared component
  const inNewName  = nextAvailableVarName(convComp, inVarName)

  const inLocalVar = new _libcellml.Variable()
  inLocalVar.setName(inNewName)
  inLocalVar.setUnitsByName(inUnitName)
  inLocalVar.setInterfaceTypeByString('public')
  convComp.addVariable(inLocalVar)

  const outNewName = nextAvailableVarName(convComp, outVarName)
  const outLocalVar = new _libcellml.Variable()
  outLocalVar.setName(outNewName)
  outLocalVar.setUnitsByName(outUnitName)
  outLocalVar.setInterfaceTypeByString('public')
  convComp.addVariable(outLocalVar)

  const mathML = `<math xmlns="http://www.w3.org/1998/Math/MathML" xmlns:cellml="http://www.cellml.org/cellml/2.0#">
    <apply>
      <eq/>
      <ci>${outNewName}</ci>
      <apply>
        <plus/>
        <apply>
          <times/>
          <cn cellml:units="dimensionless">${scale}</cn>
          <ci>${inNewName}</ci>
        </apply>
        <cn cellml:units="${outUnitName}">${offset}</cn>
      </apply>
    </apply>
  </math>`

  convComp.appendMath(mathML)

  // Only add to model if newly created
  if (isNew) {
    model.addComponent(convComp)
  }

  // Look up fresh references for equivalence wiring
  const freshConvComp  = model.componentByName('affine_unit_conversions', true)
  const freshInLocal   = freshConvComp.variableByName(inNewName)
  const freshOutLocal  = freshConvComp.variableByName(outNewName)
  const freshInVar     = model.componentByName(inVarCompName,  true).variableByName(inVarName)
  const freshOutVar    = model.componentByName(outVarCompName, true).variableByName(outVarName)

  _libcellml.Variable.addEquivalence(freshInLocal,  freshInVar)
  _libcellml.Variable.addEquivalence(freshOutLocal, freshOutVar)

  freshInLocal.delete()
  freshOutLocal.delete()
  freshInVar.delete()
  freshOutVar.delete()
  freshConvComp.delete()
  inLocalVar.delete()
  outLocalVar.delete()
  convComp.delete()

  return true
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
  const referenceUnits = referenceVar.units()
  const unitsName = referenceUnits.name() || 'dimensionless'
  referenceUnits.delete()

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
  const updatedXmlString = serializer.serializeToString(doc)

  // Pretty print using libCellML to ensure valid formatting.
  const parserCellML = new _libcellml.Parser(true)
  const modelCheck = parserCellML.parseModel(updatedXmlString)
  const printerCellML = new _libcellml.Printer()
  const finalXmlString = printerCellML.printModel(modelCheck, false)

  parserCellML.delete()
  modelCheck.delete()
  printerCellML.delete()

  return finalXmlString
}

function addVariableToParameterComponent(model, variable, parameterComponent, parameterData) {
  let sourceVar = parameterComponent.variableByName(parameterData.name)

  if (!sourceVar) {
    sourceVar = new _libcellml.Variable()
    sourceVar.setName(parameterData.name)
    // Ensure the initial value is explicitly set to define variable type as 'constant'.
    sourceVar.setInitialValueByString(parameterData.value)

    const matchUnits = model.unitsByName(parameterData.units)
    if (matchUnits) {
      sourceVar.setUnitsByUnits(matchUnits)
      matchUnits.delete()
    } else {
      sourceVar.setUnitsByName(parameterData.units)
    }

    sourceVar.setInterfaceTypeByString('public')
    parameterComponent.addVariable(sourceVar)
  }

  // Connect the constant parameter to the module variable.
  _libcellml.Variable.addEquivalence(sourceVar, variable)

  sourceVar.delete()
}

/**
 * Post-processes a printed CellML XML string, replacing all celsius unit references
 * with 'dimensionless' and removing the celsius unit definition.
 *
 * IMPORTANT - KNOWN LIMITATION:
 * This substitution is only numerically correct when celsius variables are used
 * exclusively as differences (e.g. (TmpC - 37) / 10), where the 273.15 K offset
 * cancels between the two operands. It will produce WRONG results if celsius is
 * used in any absolute context — for example, a product like (x_per_oC * T_celsius)
 * where 5°C should be treated as 278.15 K, not 5. 
 * 
 * This is required as the presence of 'celsius' in a cellml model currently causes 
 * web OpenCOR to crash.
 * 
 */
function stripCelsiusToArbitraryUnit(xmlString) {
  const CELSIUS_UNIT_NAME = 'celsius'

  const domParser = new DOMParser()
  const doc = domParser.parseFromString(xmlString, 'application/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    console.warn('stripCelsiusToArbitraryUnit: XML parse error — returning original string unchanged.')
    return xmlString
  }

  // Check celsius is actually declared in this model before doing anything.
  const unitsElements = Array.from(doc.getElementsByTagNameNS(CELLML_NS, 'units'))
  const celsiusUnitsDeclared = unitsElements.some((el) => el.getAttribute('name') === CELSIUS_UNIT_NAME)
  if (!celsiusUnitsDeclared) {
    return xmlString
  }

  // Remove the <units name="celsius"> definition.
  for (const el of unitsElements) {
    if (el.getAttribute('name') === CELSIUS_UNIT_NAME) {
      el.parentNode.removeChild(el)
    }
  }

  // Replace units="celsius" on <variable> elements with "dimensionless".
  const variableElements = Array.from(doc.getElementsByTagNameNS(CELLML_NS, 'variable'))
  for (const el of variableElements) {
    if (el.getAttribute('units') === CELSIUS_UNIT_NAME) {
      el.setAttribute('units', 'dimensionless')
    }
  }

  // Replace cellml:units="celsius" on <cn> MathML literals with "dimensionless".
  const cnElements = Array.from(doc.getElementsByTagNameNS(MATHML_NS, 'cn'))
  for (const el of cnElements) {
    if (el.getAttributeNS(CELLML_NS, 'units') === CELSIUS_UNIT_NAME) {
      el.setAttributeNS(CELLML_NS, 'cellml:units', 'dimensionless')
    }
  }

  const serializer = new XMLSerializer()
  return serializer.serializeToString(doc)
}

export function generateFlattenedModel(nodes, edges, builderStore) {
  const appVersion = __APP_VERSION__ || '0.0.0'

  // Initialize core objects
  const model = new _libcellml.Model()
  model.setName(`PhLynxGenerated_v${appVersion}`.replaceAll('.', '_'))

  const printer = new _libcellml.Printer()
  const validator = new _libcellml.Validator()
  const parser = new _libcellml.Parser(false)
  const importer = new _libcellml.Importer(true)
  const analyser = new _libcellml.Analyser()
  const globalParameterComponent = new _libcellml.Component()
  const parameterComponent = new _libcellml.Component()

  // --- Helper State ---
  const modelCache = new Map() // Key: sourceFileName, Value: libcellml.Model
  const nodeComponentMap = new Map() // Key: NodeID, Value: libcellml.Component
  const unitsLibraryCache = new Map() // Key: filename, Value: libcellml.Model
  const unitsImportSourceMap = new Map() // Key: filename, Value: libcellml.ImportSource

  const globalVariables = builderStore.getGlobalVariables()

  // ------------------------------
  // HELPER: Reusable Unit Importer
  // ------------------------------
  const ensureUnitImported = (unitsName) => {
    // Safety Checks
    if (!unitsName) return
    // If it's already in the model (or is a standard unit like 'volt'), skip.
    if (model.hasUnitsByName(unitsName) || isStandardUnit(unitsName)) return

    // Mask affine units from the validator using the base unit they're offset from
    if (isAffineUnit(unitsName)) {
      const { baseUnit } = AFFINE_UNIT_CONVERSIONS[unitsName]
      const affineUnits = new _libcellml.Units()
      affineUnits.setName(unitsName)
      affineUnits.addUnitByReference(baseUnit) 
      model.addUnits(affineUnits)
      affineUnits.delete()
      return
    }

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
    globalParameterComponent.setName(GLOBAL_PARAMETERS)
    model.addComponent(globalParameterComponent)

    parameterComponent.setName(MODEL_PARAMETERS)
    model.addComponent(parameterComponent)

    // Count how many nodes use each constant variable name
    const constantNameRefCount = new Map()
    for (const node of nodes) {
      for (const v of (node.data.variables ?? [])) {
        if (v.type === 'constant' && !isEmpty(v.value)) {
          constantNameRefCount.set(v.name, (constantNameRefCount.get(v.name) ?? 0) + 1)
        }
      }
    }

    // ---------------------------------
    // Process Nodes (Create Components)
    // ---------------------------------
    for (const node of nodes) {
      const fileName = node.data?.sourceFile
      const componentName = node.data?.componentName

      // Load and cache source model if not already done.
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

        const nodeVariable = node.data.variables.find((v) => v.name === variable.name())
        if (nodeVariable) {
          if (nodeVariable.type === 'global_constant') {
            const v = globalVariables.get(variable.name())
            if (!isEmpty(v?.value)) {
              addVariableToParameterComponent(model, variable, globalParameterComponent, {
                ...v,
                name: variable.name(),
              })
            }
          } else if (nodeVariable.type === 'constant') {
            const v = node.data.variables.find((cv) => cv.name === nodeVariable.name)
            if (!isEmpty(v?.value)) {
              const isShared = (constantNameRefCount.get(v.name) ?? 0) > 1
              addVariableToParameterComponent(model, variable, parameterComponent, {
                ...v,
                name: isShared ? `${node.data.name}_${v.name}` : v.name,
              })
            }
          }
        }

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
              const isSrcMultiportSum = srcLabel.multiport === 'Sum'
              const isTgtMultiportSum = tgtLabel.multiport === 'Sum'
              if (isSrcMultiportSum && isTgtMultiportSum) {
                throw new Error('Multi-port-sum to Multi-port-sum connections are not supported.')
              } else if (isSrcMultiportSum || isTgtMultiportSum) {
                const multiSumLabel = isSrcMultiportSum ? srcLabel : tgtLabel
                const multiSumComponent = isSrcMultiportSum ? sourceComp : targetComp
                const operandLabel = isSrcMultiportSum ? tgtLabel : srcLabel
                const operandComponent = isSrcMultiportSum ? targetComp : sourceComp
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
                      const handled = createAffineConversionComponent(model, v1, v2, sourceComp.name(), targetComp.name())
                      if (!handled) {
                        _libcellml.Variable.addEquivalence(v1, v2)
                      }
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
    }

    for (const comp of componentTrashCan) {
      comp && comp.delete()
    }

    model.linkUnits()

    addEnvironmentComponent(model)

    if (globalParameterComponent.variableCount() === 0) {
      model.removeComponentByName(GLOBAL_PARAMETERS, true)
    }

    if (parameterComponent.variableCount() === 0) {
      model.removeComponentByName(MODEL_PARAMETERS, true)
    }

    // ------------------
    // PREPARE FOR EXPORT
    // ------------------

    // Resolve and Flatten
    importer.resolveImports(model, '.')
    const flattenedModel = importer.flattenModel(model)

    if (importer.errorCount()) {
      flattenedModel.delete()
      handleLoggerErrors(importer, `Importer error count: ${importer.errorCount()}`)
    }

    validator.validateModel(flattenedModel)
    if (validator.errorCount()) {
      handleLoggerErrors(validator, `Validator error count: ${validator.errorCount()}`)
    }

    analyser.analyseModel(flattenedModel)
    if (analyser.errorCount()) {
      // FIXME: There is a bug in libCellML v0.6.3 where the analyser cannot handle
      // initialisation of a variable that is computed. Fixed in v0.6.4, but we need 
      // a workaround for now to at least export something usable in the case where this is the only error.
      handleLoggerErrors(analyser, `Analyser error count: ${analyser.errorCount()}`, true)
    }

    let flattenedModelString = printer.printModel(flattenedModel, false)
    flattenedModel.delete()

    // Strip celsius unit references before re-parsing in prioritizeEnvironmentComponent,
    // so libCellML sees a clean model. See stripCelsiusToArbitraryUnit for known limitations.
    flattenedModelString = stripCelsiusToArbitraryUnit(flattenedModelString)

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
    parameterComponent.delete()
    globalParameterComponent.delete()
    analyser.delete()
    model.delete()
    printer.delete()
    validator.delete()
    parser.delete()
    importer.delete()
  }
}

function isPossibleParameter(variable) {
  // A variable is possibly a parameter if it does not have an initial value (i.e. it's set externally)
  // and it's not the time variable.
  const varName = variable.name()
  return variable.initialValue() === '' && varName !== 't' && varName !== 'time'
}

/**
 * Extracts unique variable names from a CellML model/component
 */
export function extractVariablesFromModule(modelString, componentName, includeInitialisedVariables = false) {
  const garbageCollector = new Set() // To track created objects for cleanup
  try {
    const variables = new Set()
    if (modelString) {
      const parser = new _libcellml.Parser(false)
      garbageCollector.add(parser)
      const model = parser.parseModel(modelString)
      garbageCollector.add(model)
      // Iterate all components in the model,
      // assumes flat model hierarchy.
      const comp = model.componentByName(componentName, true)
      garbageCollector.add(comp)
      for (let v = 0; v < comp.variableCount(); v++) {
        const variable = comp.variableByIndex(v)
        garbageCollector.add(variable)
        const units = variable.units()
        garbageCollector.add(units)
        if (isPossibleParameter(variable)) {
          variables.add({ name: variable.name(), units: units.name() })
        }
      }
    }

    return Array.from(variables)
  } finally {
    for (const obj of garbageCollector) {
      obj && obj.delete()
    }
  }
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

export function mergeModelComponents(targetModelString, sourceModelString, newComponentName, oldComponentName) {
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
    targetModel.setName('User_Modules')
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
    const existingComponent = targetModel.componentByName(oldComponentName || newComponentName, true)

    if (existingComponent) {
      targetModel.removeComponentByName(oldComponentName || newComponentName, true)
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

  const garbageCollector = new Set() // To track created objects for cleanup
  try {
    const parser = new _libcellml.Parser(true)
    garbageCollector.add(parser)
    const modelA = parser.parseModel(modelAString)
    garbageCollector.add(modelA)
    const modelB = parser.parseModel(modelBString)
    garbageCollector.add(modelB)
    const equal = modelA.equals(modelB)

    return equal
  } finally {
    for (const obj of garbageCollector) {
      obj && obj.delete()
    }
  }
}

export function getModelComponentNames(modelString) {
  const componentNames = []
  if (modelString) {
    const parser = new _libcellml.Parser(false)
    const model = parser.parseModel(modelString)
    for (let i = 0; i < model.componentCount(); i++) {
      const component = model.componentByIndex(i)
      componentNames.push(component.name())
      component.delete()
    }
    model.delete()
    parser.delete()
  }
  return componentNames
}