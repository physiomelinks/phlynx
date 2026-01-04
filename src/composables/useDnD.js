import { useVueFlow } from '@vue-flow/core'
import { ref, shallowRef, watch } from 'vue'

import { GHOST_MODULE_FILENAME, GHOST_NODE_TYPE } from '../utils/constants'
import { generateUniqueModuleName } from '../utils/nodes'

/**
 * In a real world scenario you'd want to avoid creating refs in a global scope like this as they might not be cleaned up properly.
 * @type {{draggedType: Ref<string|null>, isDragOver: Ref<boolean>, isDragging: Ref<boolean>}}
 */
const state = {
  /**
   * The type of the node being dragged.
   */
  draggedType: shallowRef(null),
  isDragOver: ref(false),
  isDragging: ref(false),
}

export default function useDragAndDrop(pendingHistoryNodes) {
  const { draggedType, isDragOver, isDragging } = state

  const {
    addNodes,
    getNodes,
    onNodesInitialized,
    screenToFlowCoordinate,
    updateNode,
  } = useVueFlow()

  function getId() {

    // Find the highest existing ID
    let maxId = -1
    getNodes.value.forEach((node) => {
      if (node.id.startsWith('dndnode_')) {
        const numPart = parseInt(node.id.split('_')[1], 10)
        if (!isNaN(numPart) && numPart > maxId) {
          maxId = numPart
        }
      }
    })

    // Return the next ID in the sequence
    return `dndnode_${maxId + 1}`
  }

  const isGhostSetupOpen = ref(false)
  const pendingGhostNodeId = ref(null)

  watch(isDragging, (dragging) => {
    document.body.style.userSelect = dragging ? 'none' : ''
  })

  function onDragStart(event, module) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/vueflow', module.name)
      event.dataTransfer.effectAllowed = 'move'
    }

    draggedType.value = module
    isDragging.value = true

    document.addEventListener('drop', onDragEnd)
  }

  /**
   * Handles the drag over event.
   *
   * @param {DragEvent} event
   */
  function onDragOver(event) {
    event.preventDefault()

    if (draggedType.value) {
      isDragOver.value = true

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
    }
  }

  function onDragLeave() {
    isDragOver.value = false
  }

  function onDragEnd() {
    isDragging.value = false
    isDragOver.value = false
    draggedType.value = null
    document.removeEventListener('drop', onDragEnd)
  }

  /**
   * Handles the drop event.
   *
   * @param {DragEvent} event
   */
  function onDrop(event) {
    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    })

    const nodeId = getId()

    const moduleData = draggedType.value

    if (!moduleData) {
      return
    }

    const existingNames = new Set(getNodes.value.map((node) => node.data.name))
    const finalName = generateUniqueModuleName(moduleData, existingNames)

    // Build a non-editable label that reflects the component and CellML source file.
    const compLabel = moduleData.componentName
    const nodeType =
      moduleData.sourceFile === GHOST_MODULE_FILENAME
        ? GHOST_NODE_TYPE
        : 'moduleNode'
    const filePart = moduleData.sourceFile
    const label = filePart ? `${compLabel} — ${filePart}` : compLabel
    pendingHistoryNodes.add(nodeId)

    const newNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        ...JSON.parse(JSON.stringify(moduleData)), // Keep deep copy
        name: finalName, // Use the new unique name
        label,
      },
    }

    /**
     * Align node position after drop, so it's centered to the mouse
     *
     * We can hook into events even in a callback, and we can remove the event listener after it's been called.
     */
    const { off } = onNodesInitialized(() => {
      updateNode(nodeId, (node) => ({
        position: {
          x: node.position.x - node.dimensions.width / 2,
          y: node.position.y - node.dimensions.height / 2,
        },
      }))

      off()
    })

    addNodes(newNode)

    if (nodeType === GHOST_NODE_TYPE) {
      pendingGhostNodeId.value = newNode.id
      isGhostSetupOpen.value = true
    }
  }

  return {
    draggedType,
    isDragOver,
    isDragging,
    isGhostSetupOpen,
    pendingGhostNodeId,
    onDragStart,
    onDragLeave,
    onDragOver,
    onDrop,
  }
}
