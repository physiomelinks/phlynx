import { MarkerType } from '@vue-flow/core'

export const SOURCE_PORT_TYPE = 'source'
export const TARGET_PORT_TYPE = 'target'
export const USER_MODULES_FILE = 'UserModules.cellml'

export const markerEnd = MarkerType.ArrowClosed
export const edgeLineOptions = {
  type: 'smoothstep',
  markerEnd: markerEnd,
  style: {
    strokeWidth: 5,
    // stroke: '#b1b1b7', // Can customize color if desired.
  },
}
export const FLOW_IDS = {
  MAIN: 'main-flow-editor',
  MACRO: 'macro-builder-editor',
}

export const GHOST_NODE_TYPE = 'ghostNode'
export const GHOST_MODULE_FILENAME = 'ghostModule.cellml'
export const GHOST_MODULE_DEFINITION = {
  filename: GHOST_MODULE_FILENAME,
  modules: [
    {
      name: 'Ghost',
      componentName: 'ghost',
      sourceFile: GHOST_MODULE_FILENAME,
    },
  ],
}

export const IMPORT_KEYS = {
  VESSEL: 'vessel',
  MODULE_CONFIG: 'moduleConfig',
  CELLML_FILE: 'cellMLFile',
  PARAMETER: 'parameter',
  UNITS: 'units',
}

export const EXPORT_KEYS = {
  CA: 'circulatoryAutogen',
  CELLML: 'cellml',
}

export const CELLML_FILE_TYPES = [
  {
    description: 'CellML File',
    accept: { 'application/xml': ['.cellml', '.xml'] },
  },
]

export const JSON_FILE_TYPES = [
  {
    description: 'JSON File',
    accept: { 'application/json': ['.json'] },
  },
]
