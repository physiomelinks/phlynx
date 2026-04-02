import { useVueFlow } from '@vue-flow/core'
import { ref, shallowRef, watch } from 'vue'

import { GHOST_MODULE_FILENAME, GHOST_NODE_TYPE } from '../utils/constants'
import { getId, generateUniqueModuleName, attachNewNodeToFrame, findAnyNode } from '../utils/nodes'
import { useBuilderStore } from '../stores/builderStore'
import { buildPortLabels } from '../services/import/buildPorts'
import { extractVariablesFromModule } from '../utils/cellml'

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

  const { addNodes, getNodes, onNodesInitialized, screenToFlowCoordinate, updateNode } = useVueFlow()
  const builderStore = useBuilderStore()

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
   * Creates a new module node at the given position and adds it to the flow.
   * Returns the new node's id and type so the caller can handle any
   * post-creation logic (e.g. opening the ghost setup dialog).
   *
   * @param {object} moduleData - The module descriptor (componentName, sourceFile, configs, etc.)
   * @param {{x: number, y: number}} position - Flow coordinates to place the node.
   * @returns {{ nodeId: string, nodeType: string }}
   */
  function createModuleNode(moduleData, position) {
    const nodeId = getId(getNodes.value.map((n) => n.id))
    const existingNames = new Set(getNodes.value.map((n) => n.data.name))
    const finalName = generateUniqueModuleName(moduleData, existingNames)

    const componentName = moduleData.componentName
    const nodeType = moduleData.sourceFile === GHOST_MODULE_FILENAME ? GHOST_NODE_TYPE : 'moduleNode'
    const sourceFile = moduleData.sourceFile
    const label = sourceFile ? `${componentName} — ${sourceFile}` : componentName

    pendingHistoryNodes.add(nodeId)

    const modelString = builderStore.getModuleContent(sourceFile)
    const variables = extractVariablesFromModule(modelString, componentName)

    const configIndex = moduleData.configIndex || 0
    let config = moduleData.configs?.[configIndex] ?? null

    if (!config) {
      config = {
        vessel_type: finalName,
        BC_type: 'phlynx',
        module_file: sourceFile,
        module_type: componentName,
        entrance_ports: [],
        exit_ports:[],       
        general_ports:[],
        variables_and_units: variables.map((v) => [v.name, v.units ?? 'dimensionless', 'access', 'variable']),
      }
      builderStore.addConfigFile([config], sourceFile)
    }

    const portLabels = buildPortLabels(config)

    builderStore.setVariableParameterValuesForInstance(
      finalName,
      variables,
      sourceFile,
      componentName,
      configIndex
    )

    const newNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        componentName: moduleData.componentName,
        configIndex: moduleData.configIndex,
        label,
        name: finalName,
        portLabels,
        portOptions: moduleData.portOptions || [],
        ports: moduleData.ports || [],
        sourceFile: moduleData.sourceFile,
        variables,
      },
    }

    /**
     * Align node position after drop, so it's centered to the mouse.
     * We can hook into events even in a callback, and we can remove the event listener after it's been called.
     */
    const { off } = onNodesInitialized(() => {
      updateNode(nodeId, (node) => {
        const centredPosition = {
          x: node.position.x - node.dimensions.width / 2,
          y: node.position.y - node.dimensions.height / 2,
        }

        const existingNode = findAnyNode()
        const frameData = existingNode
          ? attachNewNodeToFrame(centredPosition, existingNode.data)
          : null

        return {
          position: centredPosition,
          data: frameData ? { ...node.data, ...frameData } : node.data,
        }
      })

      off()
    })

    addNodes(newNode)

    return { nodeId, nodeType }
  }

  /**
   * Handles the drop event.
   *
   * @param {DragEvent} event
   */
  function onDrop(event) {
    const moduleData = draggedType.value
    if (!moduleData) return

    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    })

    const { nodeId, nodeType } = createModuleNode(moduleData, position)

    if (nodeType === GHOST_NODE_TYPE) {
      pendingGhostNodeId.value = nodeId
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
    createModuleNode,
  }
}