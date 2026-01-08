import Papa from 'papaparse'

import { IMPORT_KEYS } from './constants'
import { isCellML } from './cellml'

const parseVesselCsv = (file) => {
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
          reject(new Error('Invalid vessel array file format.'))
        }
        resolve(results.data)
      },
      error: (err) => reject(err),
    })
  })
}

// Parser for JSON (Modules/Configs)
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

const parseParametersFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file.raw, {
      header: true, // Converts row 1 to object keys
      skipEmptyLines: true,

      complete: (results) => {
        // results.data will be an array of objects
        // e.g., [{ param_name: 'a', value: '1' }, { param_name: 'b', value: '2' }]
        // builderStore.setParameterData(results.data)
        if (
          results.data.length === 0 ||
          !(
            'variable_name' in results.data[0] &&
            'units' in results.data[0] &&
            'value' in results.data[0] &&
            'data_reference' in results.data[0]
          )
        ) {
          reject(new Error('Invalid parameter file format.'))
        }

        resolve(results.data)
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

const configs = {
  [IMPORT_KEYS.VESSEL]: {
    title: 'Import Vessel Array and CellML Module Configuration',
    fields: [
      {
        key: IMPORT_KEYS.VESSEL,
        label: 'Select Vessel Array (.csv)',
        accept: '.csv',
        parser: parseVesselCsv,
      },
      {
        key: IMPORT_KEYS.MODULE_CONFIG,
        label: 'Module JSON',
        accept: '.json',
        parser: parseModuleJson,
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
        accept: '.json',
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
