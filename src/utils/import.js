import Papa from 'papaparse'

import { IMPORT_KEYS } from './constants'
import { isCellML } from './cellml'

export const validateVesselData = (vesselData, builderStore) => {
  const errors = []
  const warnings = []
  const missingResources = {
    configs: new Set(),
    moduleTypes: new Set(),
  }

  const availableCellMLModules = new Set()
  builderStore.availableModules.forEach((file) => {
    if (file.isStub) {
      return
    }

    file.modules?.forEach((module) => {
      const moduleName = module.name || module.componentName
      if (moduleName) {
        availableCellMLModules.add(moduleName)
      }
    })
  })

  // Get all available configs (vessel_type + BC_type combinations)
  // and the module_type they point to
  const availableConfigs = new Map() // key: "vessel_type:BC_type", value: config
  const moduleTypesInConfigs = new Set()

  builderStore.availableModules.forEach((file) => {
    file.modules?.forEach((module) => {
      module.configs?.forEach((config) => {
        if (config.vessel_type && config.BC_type) {
          const key = `${config.vessel_type}:${config.BC_type}`
          availableConfigs.set(key, config)

          if (config.module_type) {
            moduleTypesInConfigs.add(config.module_type)
          }
        }
      })
    })
  })

  // Check each vessel in the CSV
  const missingConfigs = []
  const missingModules = []

  vesselData.forEach((vessel) => {
    const vesselType = vessel.vessel_type?.trim()
    const bcType = vessel.BC_type?.trim()

    if (!vesselType || !bcType) return

    const key = `${vesselType}:${bcType}`
    const config = availableConfigs.get(key)

    if (!config) {
      missingConfigs.push(key)
      missingResources.configs.add(key)
    } else {
      if (config.module_type && !availableCellMLModules.has(config.module_type)) {
        missingModules.push(config.module_type)
        missingResources.moduleTypes.add(config.module_type)
      }
    }
  })

  // Generate warnings
  if (missingConfigs.length > 0) {
    warnings.push(`Missing configurations for: ${[...new Set(missingConfigs)].join(', ')}`)
  }

  if (missingModules.length > 0) {
    warnings.push(`Missing CellML modules: ${[...new Set(missingModules)].join(', ')}`)
  }

  const needsConfigFile = missingConfigs.length > 0
  const needsModuleFile = missingModules.length > 0
  return {
    errors,
    warnings,
    isValid: true,
    isComplete: errors.length === 0 && warnings.length === 0,
    missingResources: {
      configs: [...missingResources.configs],
      moduleTypes: [...missingResources.moduleTypes],
    },
    needsConfigFile,
    needsModuleFile,
  }
}

const parseVesselCsv = (file, builderStore = null) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      transform: (v) => v.trim(),
      complete: (results) => {
        if (
          !(
            results.data?.length > 0 &&
            'name' in results.data[0] &&
            'BC_type' in results.data[0] &&
            'vessel_type' in results.data[0] &&
            'inp_vessels' in results.data[0] &&
            'out_vessels' in results.data[0]
          )
        ) {
          reject(new Error(`Invalid vessel array file format: ${results.data[0]}`))
          return
        }
        if (builderStore) {
          const validation = validateVesselData(results.data, builderStore)
          resolve({
            data: results.data,
            warnings: validation.warnings,
            validation: validation,
          })
        } else {
          resolve({
            data: results.data,
            warnings: [],
            validation: null,
          })
        }
      },
      error: (err) => reject(err),
    })
  })
}

const parseModuleJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (
          !(
            parsed.length > 0 &&
            'entrance_ports' in parsed[0] &&
            'exit_ports' in parsed[0] &&
            'general_ports' in parsed[0] &&
            'BC_type' in parsed[0] &&
            'vessel_type' in parsed[0] &&
            'module_format' in parsed[0] &&
            'module_file' in parsed[0] &&
            'module_type' in parsed[0]
          )
        ) {
          throw new Error('Invalid module configuration file format.')
        }
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

export const parseParametersFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, // Converts row 1 to object keys
      skipEmptyLines: true,

      complete: (results) => {
        // results.data will be an array of objects
        // e.g., [{ param_name: 'a', value: '1' }, { param_name: 'b', value: '2' }]
        const cleanData = results.data.filter((row) => {
          // Check if variable_name exists and does NOT start with '#'
          return row.variable_name && !row.variable_name.trim().startsWith('#')
        })

        if (
          cleanData.length === 0 ||
          !(
            'variable_name' in cleanData[0] &&
            'units' in cleanData[0] &&
            'value' in cleanData[0] &&
            'data_reference' in cleanData[0]
          )
        ) {
          reject(new Error('Invalid parameter file format.'))
          return
        }

        resolve(cleanData)
      },

      error: (err) => reject(err),
    })
  })
}

const parseCellML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        if (!isCellML(content)) {
          reject(new Error('Invalid CellML file.'))
        }
        resolve(content)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

export function createDynamicFields(validation) {
  const fields = []

  if (validation.needsModuleFile) {
    fields.push({
      key: IMPORT_KEYS.CELLML_FILE,
      label: 'CellML Module File (.cellml or .xml)',
      required: true,
      accept: '.cellml, .xml',
      parser: parseCellML,
      helpText: `Required module types: ${(validation.missingResources.moduleTypes || []).join(', ')}`,
      processUpload: 'cellml',
    })
  }

  if (validation.needsConfigFile) {
    fields.push({
      key: IMPORT_KEYS.MODULE_CONFIG,
      label: 'Module Configuration (.json)',
      required: true,
      accept: '.json',
      parser: parseModuleJson,
      helpText: `Required Configurations: ${(validation.missingResources.configs || []).join(', ')}`,
      processUpload: 'config',
    })
  }

  return fields
}

const configs = {
  [IMPORT_KEYS.VESSEL]: {
    title: 'Import Vessel Array File',
    fields: [
      {
        key: IMPORT_KEYS.VESSEL,
        label: 'Select Vessel Array (.csv)',
        accept: '.csv',
        required: true,
        parser: parseVesselCsv,
        requiresStore: true,
        isDynamic: true,
      },
      {
        key: IMPORT_KEYS.PARAMETER,
        label: 'Select Parameter File (.csv)',
        accept: '.csv',
        required: false,
        parser: parseParametersFile,
      },
    ],
  },
  [IMPORT_KEYS.MODULE_CONFIG]: {
    title: 'Import CellML Module Configuration',
    fields: [
      {
        key: IMPORT_KEYS.MODULE_CONFIG,
        label: 'Module JSON',
        accept: '.json',
        parser: parseModuleJson,
      },
    ],
  },
  [IMPORT_KEYS.CELLML_FILE]: {
    title: 'Import CellML File',
    fields: [
      {
        key: IMPORT_KEYS.CELLML_FILE,
        label: 'Select CellML File (.cellml or .xml)',
        required: true,
        accept: '.cellml, .xml',
        parser: parseCellML,
      },
    ],
  },
  [IMPORT_KEYS.PARAMETER]: {
    title: 'Import Parameter Configuration',
    fields: [
      {
        key: IMPORT_KEYS.PARAMETER,
        label: 'Select Parameter File (.csv)',
        accept: '.csv',
        parser: parseParametersFile,
      },
    ],
  },
  [IMPORT_KEYS.UNITS]: {
    title: 'Import Units Configuration',
    fields: [
      {
        key: IMPORT_KEYS.UNITS,
        label: 'Select Units Config (.cellml or .xml)',
        accept: '.cellml, .xml',
        parser: parseCellML,
      },
    ],
  },
}

export function getImportConfig(type) {
  return configs[type] || null
}
