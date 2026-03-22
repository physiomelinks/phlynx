import { MarkerType } from '@vue-flow/core'

export const SOURCE_PORT_TYPE = 'source'
export const TARGET_PORT_TYPE = 'target'
export const USER_MODULES_FILE = 'User_Modules.cellml'

export const TOOLTIP_AUTO_CLOSE = 1200
export const RESCALE_ASPECT_RATIO = 3
export const RESCALE_TARGET_SPACING = 1000

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
  EDGE: 'edge-conn-flow',
}

export const AFFINE_UNIT_CONVERSIONS = {
  celsius:    { baseUnit: 'kelvin',  scale: 1,        offset: 273.15  },
  fahrenheit: { baseUnit: 'kelvin',  scale: 5 / 9,    offset: 255.372 },
}

// Edge connection dialog parameters
export const ROW_H    = 52          // px per port row
export const NODE_W   = 540         // px per column
export const MID_GAP  = 75           // px between columns
export const PAD      = 10          // top/bottom canvas padding
export const AUTOSCROLL_ZONE = 60   // px from canvas edge that triggers autoscroll
export const AUTOSCROLL_SPEED = 10  // max px per frame


export const TARGET_COMPATIBLE = {
  entrance_ports: new Set(['general_ports']),
  exit_ports:    new Set(['entrance_ports', 'general_ports']),
  general_ports: new Set(['entrance_ports', 'exit_ports', 'general_ports']),
}

export const STANDARD_UNITS = [
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

export const EXCLUDED_COMPONENTS = new Set(['environment'])
export const TIME_UNITS = new Set(['second', 'millisecond', 'microsecond', 'minute', 'hour', 'ms', 's'])
export const TIME_NAMES = new Set(['time', 't'])

export const MAX_VISIBLE_TAGS = 1

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

export const portTypeOptions = [
  { value: 'general_ports',  label: 'G' },
  { value: 'entrance_ports', label: 'I' },
  { value: 'exit_ports',     label: 'O' },  
]

export const multiportOptions = [
  { value: 'True',  label: 'True'  },
  { value: 'Sum',   label: 'Sum'   },
  { value: 'None',  label: 'None'  },
]

export const DEFAULT_FILE_NAME = 'phlynx-export'

export const IMPORT_KEYS = {
  VESSEL: 'vessel',
  MODULE_CONFIG: 'moduleConfig',
  CELLML_FILE: 'cellMLFile',
  PARAMETER: 'parameter',
}

export const IMPORT_LABELS = {
  VESSEL: 'Vessel Array (.csv)',
  MODULE_CONFIG: 'Module Configurations (.json)',
  CELLML_FILE: 'CellML File (.cellml or .xml)',
  PARAMETER: 'Parameters (.csv)',
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

export const ZIP_FILE_TYPES = [
  {
    description: 'ZIP File',
    accept: { 'application/zip': ['.zip'] },
  },
]
