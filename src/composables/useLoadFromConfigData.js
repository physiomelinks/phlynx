import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'
import { ElNotification } from 'element-plus'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { validateWorkflowModules } from '../services/import/validateWorkflow'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { runElkLayout } from '../services/layouts/elk'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { runPortGranularLayout } from '../services/layouts/dagre'
import { runRescaleLayout } from '../services/layouts/rescale'

export function useLoadFromConfigData() {
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

  const layoutPending = ref(false)
  let pendingEdges = []
  let pendingNodeDataMap = new Map()

  async function loadFromConfigData(configData) {
    try {
      const { valid, missing } = validateWorkflowModules(
        configData.module,
        store.availableModules
      )
      if (!valid) throw new Error(`Missing modules: ${missing.join(', ')}`)

      historyStore.clear()
      nodes.value = []
      edges.value = []
      setViewport({ x: 0, y: 0, zoom: 1 })

      await nextTick()

      const result = buildWorkflowGraph(store.availableModules, configData)

      pendingEdges = result.edges
      pendingNodeDataMap.clear()
      result.nodes.forEach((n) => pendingNodeDataMap.set(n.id, n.data))

      layoutPending.value = true
      addNodes(result.nodes) // Adds invisible nodes
    } catch (error) {
      ElNotification.error(`Failed to load workflow: ${error.message}`)
      layoutPending.value = false
    }
  }

  onNodesInitialized(async (initializedNodes) => {
    if (!layoutPending.value || initializedNodes.length === 0) return

    try {
      // If position is not declared in vessel array file, 
      // Run Layout (Calculates positions & sorts port arrays).
      // Could make this choice configurable later.
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

      // Add the Finalized Edges.
      addEdges(pendingEdges)

      historyStore.clear()
      await nextTick()

      fitView({ padding: 0.2, duration: 800 })
    } catch (err) {
      historyStore.clear()
      ElNotification.error('Error organizing graph layout')
    } finally {
      layoutPending.value = false
      pendingEdges = []
    }
  })

  return { loadFromConfigData }
}
