import { ElNotification } from 'element-plus'

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

export const loadCellMLModuleData = (content, filename, builderStore) => {
  const result = processModuleData(content)
  if (result.type === 'success') {
    const augmentedData = result.data.map((item) => ({
      ...item,
      sourceFile: filename,
    }))
    builderStore.addModuleFile({
      filename: filename,
      modules: augmentedData,
      model: result.model,
    })
    ElNotification.success({
      title: 'CellML Modules Loaded',
      message: `Loaded ${result.data.length} parameters from ${filename}.`,
    })
  } else if (result.issues) {
    ElNotification.error({
      title: 'Loading Module Error',
      message: `${result.issues.length} issues found in model file.`,
    })
    console.error('Model import issues:', result.issues)
  }
}

export const loadCellMLUnitsData = (content, filename, builderStore) => {
  const result = processUnitsData(content)
  if (result.type === 'success') {
    builderStore.addUnitsFile({
      filename: filename,
      model: result.model,
    })
    ElNotification.success({
      title: 'CellML Units Loaded',
      message: `Loaded ${result.units.count} units from ${filename}.`,
    })
  } else if (result.issues) {
    ElNotification.error({
      title: 'Loading Units Error',
      message: `${result.issues[0].description}`,
    })
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
