import Papa from 'papaparse'

import { IMPORT_KEYS, IMPORT_LABELS, RELEVANT_EXTENSIONS } from './constants'
import { isCellML, doesComponentExistInModel } from './cellml'

export function hasRelevantExtension(filename) {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return false
  return RELEVANT_EXTENSIONS.has(filename.slice(dot).toLowerCase())
}

export function readEntries(dirReader) {
  return new Promise((resolve, reject) => dirReader.readEntries(resolve, reject))
}

export function fileFromEntry(fileEntry) {
  return new Promise((resolve, reject) => fileEntry.file(resolve, reject))
}

export async function collectEntry(entry, path, depth, maxDepth, results) {
  if (!entry || depth > maxDepth) return
  if (entry.name.startsWith('.') || entry.name === 'node_modules') return

  const fullPath = path ? `${path}/${entry.name}` : entry.name

  if (entry.isFile) {
    if (!hasRelevantExtension(entry.name)) return
    try {
      const file = await fileFromEntry(entry)
      results.push({ file, path: fullPath })
    } catch {
      // Unreadable file — skip it rather than aborting the whole drop.
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    // readEntries only returns a batch at a time; must be called
    // repeatedly until it resolves an empty array.
    let batch
    do {
      batch = await readEntries(reader)
      for (const child of batch) {
        await collectEntry(child, fullPath, depth + 1, maxDepth, results)
      }
    } while (batch.length > 0)
  }
}

export const checkResourcesAreLoaded = (requestedModules, store) => {
  const warnings = []
  const missingResources = {
    modules: new Set(),
    math: new Set(),
  }

  if (!requestedModules || requestedModules.length === 0) {
    warnings.push('No modules specified in the module array file.')
  }

  for (const module of requestedModules) {
    const moduleRef = `${module.module_type}:${module.module_subtype}`
    if (!(store.availableModules.has(moduleRef))) {
      missingResources.modules.add(moduleRef)
    } else {
      const mathRef = store.availableModules.get(moduleRef)?.mathRef 
      if (!(store.availableMath.has(mathRef))) {
        missingResources.math.add(mathRef)
      }
    }
  }

  // Generate warnings
  if (missingResources.modules.size > 0) {
    warnings.push(`Missing modules: ${[...missingResources.modules].join(', ')}`)
  }

  if (missingResources.math.size > 0) {
    warnings.push(`Missing math: ${[...missingResources.math].join(', ')}`)
  }

  return {
    warnings,
    resourcesAreLoaded: warnings.length === 0,
    missingResources,
  }
}

/**
 * Validates that a config's component_file field correctly points to a file
 * that contains the specified component_type.
 * 
 * This ensures that components come from the CellML file specified in the config.
 * 
 * @param {Object} config - The configuration object with module_type, module_subtype, component_file, component_type
 * @param {Object} libraryStore - The store containing availableCollections
 * @returns {Object|null} - Issue object if there's a problem, null if validation passes
 */
function validateCollectionFileAssociation(config, libraryStore) {
  const { component_file, component_type, module_type, module_subtype } = config
  
  // Config doesn't specify a component file
  if (!component_file) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: 'unknown',
      componentType: component_type,
      issue: 'no_file_specified',
      message: `Config for ${module_type}:${module_subtype} doesn't specify a component_file`,
    }
  }
  
  // Find the collection in the library
  const collection = libraryStore.availableCollections.find(
    f => f.componentFile === component_file
  )
  
  // Expected file is missing (or provided one is empty)
  if (!collection || !collection.model) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'missing_file',
      message: `Component file "${component_file}" not found (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  // Only config provided and still need component 
  if (collection.isStub) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'stub_file',
      message: `Component file "${component_file}" needs to be uploaded (needed for ${module_type}:${module_subtype})`,
    }
  }
  
  if (!doesComponentExistInModel(collection.model, component_type)) {
    return {
      config: `${module_type}:${module_subtype}`,
      expectedFile: component_file,
      componentType: component_type,
      issue: 'component_not_in_file',
      message: `Component "${component_type}" not found in "${component_file}"`,
    }
  }

  // All checks passed
  return null
}

/**
 * Groups collection file issues by file AND issue type.
 * This ensures different issues (e.g., 'missing_file' vs 'component_not_in_file')
 * for the same file are reported separately.
 * @param {Array} componentFileIssues - Array of issue objects
 * @returns {Array} Grouped issues with consolidated messages
 */
export function groupCollectionFileIssues(componentFileIssues) {
  if (!componentFileIssues || componentFileIssues.length === 0) {
    return []
  }

  // key: "file:issueType"
  const issuesGrouped = new Map()
  
  componentFileIssues.forEach(issue => {
    const file = issue.expectedFile
    // Create a composite key to separate different issues for the same file
    const groupKey = `${file}:${issue.issue}`
    
    if (!issuesGrouped.has(groupKey)) {
      issuesGrouped.set(groupKey, {
        file,
        issue: issue.issue,
        configs: [],
        componentTypes: new Set(),
        // Generate a unique ID for UI loops
        uniqueKey: groupKey
      })
    }
    
    const group = issuesGrouped.get(groupKey)
    group.configs.push(issue.config)
    if (issue.componentType) {
      group.componentTypes.add(issue.componentType)
    }
  })
  
  // Convert to array and format messages
  return Array.from(issuesGrouped.values()).map(group => {
    let message = ''
    
    switch (group.issue) {
      case 'missing_file':
        message = `Component file "${group.file}" not found.`
        break
      case 'stub_file':
        message = `Component file "${group.file}" needs to be uploaded.`
        break
      case 'component_not_in_file':
        message = `Component file "${group.file}" missing components: ${[...group.componentTypes].join(', ')}.`
        break
      case 'no_file_specified':
        message = `Module config doesn't specify a component file.`
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
      componentTypes: [...group.componentTypes],
      uniqueKey: group.uniqueKey
    }
  })
}

const parseInstanceArray = (file, libraryStore = null) => {
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
            'module_subtype' in results.data[0] &&
            'module_type' in results.data[0] &&
            'inp_instances' in results.data[0] &&
            'out_instances' in results.data[0]
          )
        ) {
          reject(new Error(`Invalid module array file format. Required columns: name, module_type, module_subtype, inp_instances, out_instances`))
          return
        }
        if (libraryStore) {
          const requiredModules = results.data
          const completionStatus = checkResourcesAreLoaded(requiredModules, libraryStore)
          resolve({
            data: results.data,
            // warnings: completionStatus.warnings,
            completionStatus: completionStatus,
          })
        } else {
          resolve({
            data: results.data,
            // warnings: [],
            completionStatus: null,
          })
        }
      },
      error: (err) => reject(err),
    })
  })
}

const parseConfigJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('Config file must be a non-empty array of configuration objects.')
        } else if (!('entrance_ports' in parsed[0] &&
            'exit_ports' in parsed[0] &&
            'general_ports' in parsed[0] &&
            'module_subtype' in parsed[0] &&
            'module_type' in parsed[0] &&
            'module_format' in parsed[0] &&
            'component_file' in parsed[0] &&
            'component_type' in parsed[0]
          ))
          {
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
        const cleanData = results.data.filter((row) => {
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
          return
        }
        resolve(content)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

const parseOMEX = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        // Basic validation for OMEX (COMBINE Archive)
        if (!file.name.endsWith('.omex') && !file.name.endsWith('.zip')) {
          reject(new Error('Invalid OMEX file.'))
          return
        }
        resolve(content)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function createDynamicFields(completionStatus) {
  const fields = []

  if (completionStatus.missingResources.math?.size > 0) {

    fields.push({
      key: IMPORT_KEYS.CELLML_FILE,
      label: IMPORT_LABELS.CELLML_FILE,
      required: true,
      accept: '.cellml, .xml',
      parser: parseCellML,
      helpText: `Required components: ${(completionStatus.missingResources.math)}`,
      processUpload: 'cellml',
    })
  }

  if (completionStatus.missingResources.modules?.size > 0) {
    fields.push({
      key: IMPORT_KEYS.MODULE_CONFIG,
      label: IMPORT_LABELS.MODULE_CONFIG,
      required: true,
      accept: '.json',
      parser: parseConfigJson,
      helpText: `Required Configurations: ${(completionStatus.missingResources.modules)}`,
      processUpload: 'config',
    })
  }

  return fields
}

const configs = {
  [IMPORT_KEYS.INSTANCE_ARRAY]: {
    title: 'Import Instance Array File',
    fields: [
      {
        key: IMPORT_KEYS.INSTANCE_ARRAY,
        label: IMPORT_LABELS.INSTANCE_ARRAY,
        accept: '.csv',
        limit: 1,
        required: true,
        parser: parseInstanceArray,
        requiresStore: true,
        isDynamic: true,
      },
      {
        key: IMPORT_KEYS.PARAMETER,
        label: IMPORT_LABELS.PARAMETER,
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
        label: IMPORT_LABELS.MODULE_CONFIG,
        accept: '.json',
        parser: parseConfigJson,
      },
    ],
  },
  [IMPORT_KEYS.CELLML_FILE]: {
    title: 'Import CellML File',
    fields: [
      {
        key: IMPORT_KEYS.CELLML_FILE,
        label: IMPORT_LABELS.CELLML_FILE,
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
        label: IMPORT_LABELS.PARAMETER,
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
        label: IMPORT_LABELS.UNITS,
        accept: '.cellml, .xml',
        parser: parseCellML,
      },
    ],
  },
  [IMPORT_KEYS.OMEX]: {
    title: 'Import COMBINE Archive (OMEX)',
    fields: [
      {
        key: IMPORT_KEYS.OMEX,
        label: IMPORT_LABELS.OMEX,
        accept: '.omex, .zip',
        parser: parseOMEX,
      },
    ],
  },
}

export function getImportConfig(type) {
  return configs[type] || null
}