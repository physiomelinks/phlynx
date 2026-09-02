import { nextTick, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { HANDLE_VARIANT } from '../utils/constants'
import { findMostCentralGhostHandle, getHandleId, getHandleUidFromHandleId } from '../utils/handles'
import { detachReactivity } from '../utils/reactivity'

const pendingGhostRevert = ref(null)

export function useHandleManagement() {
  const { getNodes, updateNodeData, updateNodeInternals, edges } = useVueFlow()
  const historyStore = useFlowHistoryStore()

  async function setHandleVariant(nodeId, handleUid, variant, { trackHistory = true } = {}) {
    const node = getNodes.value.find((n) => n.id === nodeId)
    if (!node) return

    const handle = node.data.handles.find((h) => h.uid === handleUid)
    if (!handle || handle.variant === variant) return

    const oldHandles = detachReactivity(node.data.handles)
    const newHandles = node.data.handles.map((h) =>
      h.uid === handleUid ? { ...h, variant } : h
    )

    const apply = async (handles) => {
      updateNodeData(nodeId, { handles })
      await nextTick()
      updateNodeInternals(nodeId)
    }

    await apply(newHandles)

    // Skip history for: 
    // (a) provisional preview changes the caller has explicitly opted out of 
    // (b) changes happening as a side effect of an undo/redo replay 
    if (trackHistory && !historyStore.isUndoRedoing) {
      historyStore.addCommand({
        type: `set-handle-variant-${variant}`,
        undo: () => apply(oldHandles),
        redo: () => apply(newHandles),
      })
    }
  }

  async function activateHandle(nodeId, handleUid, options) {
    await setHandleVariant(nodeId, handleUid, HANDLE_VARIANT.DEFAULT, options)
  }

  function beginGhostActivation(nodeId, handleUid) {
    pendingGhostRevert.value = { nodeId, handleUid }
    activateHandle(nodeId, handleUid, { trackHistory: false })
  }

  function confirmActivation() {
    pendingGhostRevert.value = null
  }

  /**
   * Reverts a single handle to the ghost variant, but only if no remaining
   * edge still terminates on it. `excludeEdgeIds` lets callers check this
   * before the edge(s) being removed have actually left `edges.value`, so the 
   * check doesn't see its own soon-to-be-removed edge as "still in use".
   */
  async function revertHandleIfUnused(
    nodeId,
    handleUid,
    { excludeEdgeIds = [], trackHistory = true } = {}
  ) {
    const node = getNodes.value.find((n) => n.id === nodeId)
    const handle = node?.data.handles.find((h) => h.uid === handleUid)
    if (!handle) return

    const handleId = getHandleId(handle)
    const hasEdge = edges.value.some(
      (edge) =>
        !excludeEdgeIds.includes(edge.id) &&
        ((edge.source === nodeId && edge.sourceHandle === handleId) ||
          (edge.target === nodeId && edge.targetHandle === handleId))
    )

    if (!hasEdge) {
      await setHandleVariant(nodeId, handleUid, HANDLE_VARIANT.GHOST, { trackHistory })
    }
  }

  async function revertPendingGhostIfUnused() {
    if (!pendingGhostRevert.value) return

    const { nodeId, handleUid } = pendingGhostRevert.value
    pendingGhostRevert.value = null

    await revertHandleIfUnused(nodeId, handleUid, { trackHistory: false })
  }

  /**
   * Reverts both ends of a removed edge to ghost (each only if unused
   * elsewhere). Pass the edge's own id(s) in excludeEdgeIds when calling
   * this ahead of the edge actually being removed from edges.value.
   */
  async function revertHandlesForEdge(edge, excludeEdgeIds = [edge.id], { trackHistory = true } = {}) {
    if (edge.sourceHandle) {
      await revertHandleIfUnused(edge.source, getHandleUidFromHandleId(edge.sourceHandle), {
        excludeEdgeIds,
        trackHistory,
      })
    }
    if (edge.targetHandle) {
      await revertHandleIfUnused(edge.target, getHandleUidFromHandleId(edge.targetHandle), {
        excludeEdgeIds,
        trackHistory,
      })
    }
  }

  /**
   * Re-activates both ends of a restored edge (e.g., on undo of a removal).
   */
  async function reactivateEdgeHandles(edge, { trackHistory = true } = {}) {
    if (edge.sourceHandle) {
      await activateHandle(edge.source, getHandleUidFromHandleId(edge.sourceHandle), { trackHistory })
    }
    if (edge.targetHandle) {
      await activateHandle(edge.target, getHandleUidFromHandleId(edge.targetHandle), { trackHistory })
    }
  }

  async function addHandle(nodeId, side) {
    const node = getNodes.value.find((node) => node.id === nodeId)
    if (!node) return

    const mostCentralGhost = findMostCentralGhostHandle(side, node.data.handles)
    if (!mostCentralGhost) return

    await activateHandle(nodeId, mostCentralGhost.uid)
  }

  return {
    activateHandle,
    addHandle,
    beginGhostActivation,
    confirmActivation,
    revertPendingGhostIfUnused,
    revertHandleIfUnused,
    revertHandlesForEdge,
    reactivateEdgeHandles,
  }
}
