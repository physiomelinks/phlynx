import { useVueFlow } from '@vue-flow/core'
import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useGtm } from './useGtm'
import { useClearWorkspace } from '../composables/useClearWorkspace'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { notify } from '../utils/notify'
import { useWorkflowLayout } from './useWorkflowLayout'

export function useLoadFromInstanceArray() {
  const { nodes, addNodes } = useVueFlow()
  const store = useLibraryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()
  const { prepareLayout } = useWorkflowLayout()

  const loadFromInstanceArray = async (instanceArray, progressCallback = null) => {
    try {
      await clearWorkspace({ recordHistory: false })

      if (progressCallback) {
        progressCallback(0, instanceArray.instances.length, 'Building graph...')
      }

      const result = buildWorkflowGraph(instanceArray.instances, store.availableModules, nodes.value, progressCallback)

      if (progressCallback) {
        progressCallback(
          instanceArray.instances.length,
          instanceArray.instances.length,
          'Graph built, calculating layout...'
        )
      }

      // 1. Prepare the layout promise chain
      const layoutPromise = prepareLayout(result.pendingEdges, progressCallback)

      // 2. Add nodes as a single undoable batch so this import is not split into
      //    separate node and edge history entries.
      useFlowHistoryStore().startBatch()
      try {
        addNodes(result.pendingInstances)
      } finally {
        useFlowHistoryStore().endBatch()
      }

      // 3. Await the layout completion
      await layoutPromise

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_instance_array',
        label: `Modules: ${instanceArray.instances.length}`,
        file_type: 'instance_array',
      })
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_instance_array',
        label: `Error: ${error.message}`,
        file_type: 'instance_array',
      })
      notify.error({ message: `Failed to load workflow: ${error.message}` })
      throw error
    }
  }

  return { loadFromInstanceArray }
}
