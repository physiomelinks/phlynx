import { MarkerType } from '@vue-flow/core'

export const SOURCE_PORT_TYPE = 'source'
export const TARGET_PORT_TYPE = 'target'

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
  MACRO: 'macro-builder-editor'
}

export const GHOST_NODE_TYPE = 'ghostNode'
export const GHOST_MODULE_FILENAME = 'ghostModule.cellml'
export const GHOST_MODULE_DEFINITION = { filename: GHOST_MODULE_FILENAME, modules: [{name: 'Ghost', componentName: 'ghost', sourceFile: GHOST_MODULE_FILENAME}] }
