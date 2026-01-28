import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { validateWorkflowModules } from '../services/import/validateWorkflow'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { runElkLayout } from '../services/layouts/elk'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { runPortGranularLayout } from '../services/layouts/dagre'
import { runRescaleLayout } from '../services/layouts/rescale'
import { notify} from '../utils/notify'
import { useGtm } from './useGtm'

export function useLoadFromVesselArray() {
  const {
    nodes,
    edges,
    addNodes,
    addEdges,
    setViewport,
    onNodesInitialized,
    fitView,
    updateNodeInternals,
  } = useVueFlow()
  const store = useBuilderStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()

  const layoutPending = ref(false)
  let pendingEdges = []
  let pendingNodeDataMap = new Map()
  let pendingProgressCallback = null
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const loadFromVesselArray = async (configData, progressCallback = null) => {
    try {
      historyStore.clear()
      nodes.value = []
      edges.value = []
      setViewport({ x: 0, y: 0, zoom: 1 })

      await nextTick()

      pendingProgressCallback = progressCallback

      if (progressCallback) {
        progressCallback(0, configData.vessels.length, 'Building graph...')
      }

      const result = buildWorkflowGraph(store, configData.vessels, progressCallback)

      pendingEdges = result.edges
      pendingNodeDataMap.clear()
      result.nodes.forEach((n) => pendingNodeDataMap.set(n.id, n.data))

      if (progressCallback) {
        progressCallback(
          configData.vessels.length, 
          configData.vessels.length, 
          'Graph built, calculating layout...'
        )
      }

      // Create a promise that will resolve when layout is complete
      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true
      addNodes(result.nodes) // Adds invisible nodes

      // Wait for the layout to complete before returning
      await layoutCompletePromise

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_vessel_array',
        label: `Vessels: ${configData.vessels.length}`,
        file_type: 'vessel_array'
      })
      
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_vessel_array',
        label: `Error: ${error.message}`,
        file_type: 'vessel_array'
      })
      notify.error({message: `Failed to load workflow: ${error.message}`})
      layoutPending.value = false
      pendingProgressCallback = null
      layoutCompleteResolve = null
      layoutCompleteReject = null
      throw error
    }
  }

  onNodesInitialized(async (initializedNodes) => {
    if (!layoutPending.value || initializedNodes.length === 0) return

    const callback = pendingProgressCallback
    const resolveFunc = layoutCompleteResolve
    const rejectFunc = layoutCompleteReject

    try {
      // If position is not declared in vessel array file, 
      // Run Layout (Calculates positions & sorts port arrays).
      // Could make this choice configurable later.
      if (callback) {
        callback(
          initializedNodes.length,
          initializedNodes.length,
          'Organizing layout...'
        )
      }

      // Run layout algorithm
      if (initializedNodes[0].data.x === undefined || initializedNodes[0].data.y === undefined) {
        // runPortGranularLayout(initializedNodes, pendingEdges)
        // runElkLayout(initializedNodes, pendingEdges)
        runFcoseLayout(initializedNodes, pendingEdges)
      } else {
        // recalculate declared positions to ensure compatibility with workspace dimensions
        runRescaleLayout(initializedNodes)
      }
      
      await nextTick()

      // Handles may have moved from initial positions. Update node data from pending map.
      updateNodeInternals(initializedNodes.map((n) => n.id))

      if (callback) {
        callback(
          initializedNodes.length,
          initializedNodes.length,
          'Connecting nodes...'
        )
      }

      // Add the finalized edges
      addEdges(pendingEdges)

      historyStore.clear()
      await nextTick()

      // Report finalizing
      if (callback) {
        callback(
          initializedNodes.length,
          initializedNodes.length,
          'Finalizing view...'
        )
      }

      fitView({ padding: 0.2, duration: 800 })

      await new Promise(resolve => setTimeout(resolve, 800))

      if (callback) {
        callback(
          initializedNodes.length,
          initializedNodes.length,
          'Complete.'
        )
      }

      if (resolveFunc) {
        resolveFunc()
      }
    } catch (error) {
      historyStore.clear()
      notify.error({message: 'Error organizing graph layout'})
      if (rejectFunc) {
        rejectFunc(error)
      }
    } finally {
      layoutPending.value = false
      pendingEdges = []
      pendingProgressCallback = null
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromVesselArray }
}