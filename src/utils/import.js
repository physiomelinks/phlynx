import Papa from 'papaparse'

import { IMPORT_KEYS } from './constants'
import { isCellML } from './cellml'

export const validateVesselData = (vesselData, builderStore) => {
  const errors = []
  const warnings = []
  const missingResources = {
    configs: new Set(),
    moduleTypes: new Set(),
    moduleFileIssues: new Map(),
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
  const availableConfigs = new Map() // key: "vessel_type:BC_type", value: config object with metadata
  const moduleTypesInConfigs = new Set()

  builderStore.availableModules.forEach((file) => {
    file.modules?.forEach((module) => {
      module.configs?.forEach((config) => {
        if (config.vessel_type && config.BC_type) {
          const key = `${config.vessel_type}:${config.BC_type}`
          // Store config with its associated file information
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
      const moduleFileIssue = validateModuleFileAssociation(config, builderStore)
      
      if (moduleFileIssue) {
        // Use composite key for automatic deduplication via Map
        const issueKey = `${moduleFileIssue.config}:${moduleFileIssue.issue}`
        missingResources.moduleFileIssues.set(issueKey, moduleFileIssue)
        
        // Add to appropriate missing resource category
        if (moduleFileIssue.issue === 'missing_file' || moduleFileIssue.issue === 'stub_file') {
          missingModules.push(config.module_type)
          missingResources.moduleTypes.add(config.module_type)
        }
      } else {
        // Only check for missing module if file association is valid
        if (config.module_type && !availableCellMLModules.has(config.module_type)) {
          missingModules.push(config.module_type)
          missingResources.moduleTypes.add(config.module_type)
        }
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

  if (missingResources.moduleFileIssues.size > 0) {
    const issueMessages = [...missingResources.moduleFileIssues.values()].map(issue => issue.message)
    warnings.push(`Module file issues: ${[...new Set(issueMessages)].join('; ')}`)
  }

  const needsConfigFile = missingConfigs.length > 0
  const needsModuleFile = missingModules.length > 0 || 
    [...missingResources.moduleFileIssues.values()].some(issue => 
      issue.issue === 'missing_file' || issue.issue === 'stub_file'
    )
  const hasModuleFileMismatch = [...missingResources.moduleFileIssues.values()].some(issue =>
    issue.issue === 'module_not_in_file'
  )

  return {
    errors,
    warnings,
    isValid: true,
    isComplete: errors.length === 0 && warnings.length === 0,
    missingResources: {
      configs: [...missingResources.configs],
      moduleTypes: [...missingResources.moduleTypes],
      moduleFileIssues: groupModuleFileIssues([...missingResources.moduleFileIssues.values()]),
    },
    needsConfigFile,
    needsModuleFile,
    hasModuleFileMismatch,
  }
}

/**
 * Validates that a config's module_file field correctly points to a file
 * that contains the specified module_type.
 * 
 * This ensures that modules come from the CellML file specified in the config.
 * 
 * @param {Object} config - The configuration object with vessel_type, BC_type, module_file, module_type
 * @param {Object} builderStore - The store containing availableModules
 * @returns {Object|null} - Issue object if there's a problem, null if validation passes
 */
function validateModuleFileAssociation(config, builderStore) {
  const { module_file, module_type, vessel_type, BC_type } = config
  
  if (!module_file) {
    // Config doesn't specify a module file
    return {
      config: `${vessel_type}:${BC_type}`,
      expectedFile: 'unknown',
      moduleType: module_type,
      issue: 'no_file_specified',
      message: `Config for ${vessel_type}:${BC_type} doesn't specify a module_file`,
    }
  }
  
  // Find the module file in available modules
  const moduleFile = builderStore.availableModules.find(
    f => f.filename === module_file
  )
  
  if (!moduleFile) {
    // The specified module file doesn't exist in the store
    return {
      config: `${vessel_type}:${BC_type}`,
      expectedFile: module_file,
      moduleType: module_type,
      issue: 'missing_file',
      message: `Module file "${module_file}" not found (needed for ${vessel_type}:${BC_type})`,
    }
  }
  
  // Check if it's just a stub (config was uploaded but module file wasn't)
  if (moduleFile.isStub) {
    return {
      config: `${vessel_type}:${BC_type}`,
      expectedFile: module_file,
      moduleType: module_type,
      issue: 'stub_file',
      message: `Module file "${module_file}" needs to be uploaded (needed for ${vessel_type}:${BC_type})`,
    }
  }
  
  // Verify modules come from the CellML file stated in the config
  const moduleExists = moduleFile.modules?.some(
    m => (m.name === module_type || m.componentName === module_type || m.type === module_type)
  )
  
  if (!moduleExists) {
    // The file exists but doesn't contain the expected module
    const availableModules = moduleFile.modules?.map(m => m.name || m.componentName).join(', ') || 'none'
    return {
      config: `${vessel_type}:${BC_type}`,
      expectedFile: module_file,
      moduleType: module_type,
      issue: 'module_not_in_file',
      message: `Module "${module_type}" not found in "${module_file}" (has: ${availableModules})`,
    }
  }
  
  // All checks passed - the module comes from the correct file as specified in the config
  return null
}

/**
 * Groups module file issues by file AND issue type.
 * This ensures different issues (e.g., 'missing_file' vs 'module_not_in_file')
 * for the same file are reported separately.
 * * @param {Array} moduleFileIssues - Array of issue objects
 * @returns {Array} Grouped issues with consolidated messages
 */
export function groupModuleFileIssues(moduleFileIssues) {
  if (!moduleFileIssues || moduleFileIssues.length === 0) {
    return []
  }

  // key: "filename:issueType"
  const issuesGrouped = new Map()
  
  moduleFileIssues.forEach(issue => {
    const file = issue.expectedFile
    // Create a composite key to separate different issues for the same file
    const groupKey = `${file}:${issue.issue}`
    
    if (!issuesGrouped.has(groupKey)) {
      issuesGrouped.set(groupKey, {
        file,
        issue: issue.issue,
        configs: [],
        moduleTypes: new Set(),
        // Generate a unique ID for UI loops
        uniqueKey: groupKey
      })
    }
    
    const group = issuesGrouped.get(groupKey)
    group.configs.push(issue.config)
    if (issue.moduleType) {
      group.moduleTypes.add(issue.moduleType)
    }
  })
  
  // Convert to array and format messages
  return Array.from(issuesGrouped.values()).map(group => {
    let message = ''
    
    switch (group.issue) {
      case 'missing_file':
        message = `Module file "${group.file}" not found`
        break
      case 'stub_file':
        message = `Module file "${group.file}" needs to be uploaded`
        break
      case 'module_not_in_file':
        message = `Module file "${group.file}" missing modules: ${[...group.moduleTypes].join(', ')}`
        break
      case 'no_file_specified':
        message = `Module config doesn't specify a module file`
        break
      default:
        message = `Issue with "${group.file}"`
    }
    
    message += ` (needed for: ${group.configs.join(', ')})`
    
    return {
      file: group.file,
      issue: group.issue,
      message,
      configs: group.configs,
      moduleTypes: [...group.moduleTypes],
      uniqueKey: group.uniqueKey
    }
  })
}

const parseVesselCsv = (file, builderStore = null) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
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
    const helpTexts = []
    
    // Add module types that are missing
    if (validation.missingResources.moduleTypes && validation.missingResources.moduleTypes.length > 0) {
      helpTexts.push(`Required module types: ${validation.missingResources.moduleTypes.join(', ')}`)
    }
    
    // Add specific file issues 
    if (validation.missingResources.moduleFileIssues && validation.missingResources.moduleFileIssues.length > 0) {
      const fileNames = validation.missingResources.moduleFileIssues
        .filter(group => group.issue === 'missing_file' || group.issue === 'stub_file')
        .map(group => group.file)
      
      if (fileNames.length > 0) {
        helpTexts.push(`Required files: ${[...new Set(fileNames)].join(', ')}`)
      }
    }

    fields.push({
      key: IMPORT_KEYS.CELLML_FILE,
      label: 'CellML Module File (.cellml or .xml)',
      required: true,
      accept: '.cellml, .xml',
      parser: parseCellML,
      helpText: helpTexts.length > 0 ? helpTexts.join(' | ') : 'Upload the CellML module file',
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