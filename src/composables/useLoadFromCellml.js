import { useVueFlow } from '@vue-flow/core'
import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { useClearWorkspace } from '../composables/useClearWorkspace'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { extractComponentsFromCellmlString } from '../utils/cellml'
import { useWorkflowLayout } from './useWorkflowLayout'

export function useLoadFromCellML() {
  const { nodes: currentNodes, addNodes } = useVueFlow()
  const store = useLibraryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()
  const { prepareLayout } = useWorkflowLayout()

  const loadFromCellML = async (parsedCellmlPayload, componentFile, progressCallback = null, cellmlText = null) => {
    try {
      await clearWorkspace({ recordHistory: false })

      if (progressCallback) progressCallback(0, 100, 'Building CellML graph...')

      
      const { components = [], modules = [], edges = [], cellmlModuleSubtype } = parsedCellmlPayload

      // Register the file's math first when the caller has not. Every node this
      // builds carries a mathRef into that library, so without it the workspace
      // looks right and cannot be used: export fails on the first node with
      // "Missing math definition", and the module editor opens on an empty
      // string. `loadCellMLFiles` registers via loadCellMLData and passes no
      // text; an archive import has only the text, and passes it.
      if (cellmlText) {
        const { xml: mathComponents } = extractComponentsFromCellmlString(cellmlText)
        store.addMathFile(componentFile, mathComponents ?? [])
      }

      if (edges.length === 0) {
        notify.info({
          title: 'No Connections Found',
          message: `${componentFile} contains no inter-component connections.`,
        })
        return
      }

      modules.forEach((mod) => {
        store.addModule(mod)
      })

      const instanceRefs = components.map((compName) => {
        const outInstances = edges
          .filter((e) => e.source === compName)
          .map((e) => e.target)
          .join(' ')

        const inInstances = edges
          .filter((e) => e.target === compName)
          .map((e) => e.source)
          .join(' ')

        return {
          name: compName,
          module_type: `${compName}`,
          module_subtype: cellmlModuleSubtype,
          out_instances: outInstances,
          inp_instances: inInstances,
        }
      })

      const result = buildWorkflowGraph(instanceRefs, store.availableModules, currentNodes.value, progressCallback)

      const layoutPromise = prepareLayout(result.pendingEdges, progressCallback)
      const history = useFlowHistoryStore()
      history.startBatch()
      try {
        addNodes(result.pendingInstances)
      } finally {
        history.endBatch()
      }

      await layoutPromise

      trackEvent('cellml_connection_load', {
        category: 'CellML',
        action: 'load_from_cellml_connections',
        label: `Components: ${components.length}, Edges: ${edges.length}`,
        file_type: 'cellml',
      })
    } catch (error) {
      notify.error({ message: `Failed to load CellML connections: ${error.message}` })
      throw error
    }
  }

  return { loadFromCellML }
}
