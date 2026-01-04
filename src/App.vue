<template>
  <el-container style="height: 100vh">
    <el-header class="app-header">
      <h3>Circulatory Autogen Model Builder</h3>
      <div class="file-uploads">
        <div class="file-io-buttons">
          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handleModuleFile"
            :show-file-list="false"
          >
            <el-button :disabled="libcellml.status !== 'ready'" type="primary">
              Load Modules
            </el-button>
          </el-upload>
          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handleParametersFile"
            :show-file-list="false"
            style="margin-left: 10px"
          >
            <el-button :disabled="libcellml.status !== 'ready'" type="primary">
              Load Parameters
            </el-button>
          </el-upload>
          <el-button
            type="primary"
            @click="onOpenMacroBuilderDialog"
            style="margin-left: 10px"
          >
            Macro Build
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button
            type="info"
            @click="handleUndo"
            style="margin-left: 10px"
            :disabled="!historyStore.canUndo"
          >
            Undo
          </el-button>
          <el-button
            type="info"
            @click="handleRedo"
            style="margin-left: 10px"
            :disabled="!historyStore.canRedo"
          >
            Redo
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handleLoadWorkspace"
            :show-file-list="false"
            accept=".json"
          >
            <el-button type="success">Load Workspace</el-button>
          </el-upload>

          <el-button
            type="success"
            @click="handleSaveWorkspace"
            style="margin-left: 10px"
          >
            Save Workspace
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button
            type="info"
            @click="onOpenConfigImportDialog"
            :disabled="libcellml.status !== 'ready'"
          >
            Import Config Files
          </el-button>

          <el-button
            type="info"
            @click="handleExport"
            style="margin-left: 10px"
            :disabled="!exportAvailable"
          >
            Export Config Files
          </el-button>
        </div>
      </div>
    </el-header>

    <el-container style="flex-grow: 1; min-height: 0">
      <el-aside :width="asideWidth + 'px'" class="module-aside">
        <h4 style="margin-top: 0">Available Modules</h4>
        <ModuleList />
      </el-aside>

      <div class="resize-handle" @mousedown="startResize">
        <el-icon class="handle-icon"><DCaret /></el-icon>
      </div>

      <el-main class="workbench-main">
        <div class="dnd-flow" @drop="onDrop">
          <VueFlow
            :id="FLOW_IDS.MAIN"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @nodes-change="onNodeChange"
            @edges-change="onEdgeChange"
            :max-zoom="1.5"
            :min-zoom="0.1"
            :default-edge-options="edgeLineOptions"
            :connection-line-options="edgeLineOptions"
            :nodes="nodes"
            :delete-key-code="['Backspace', 'Delete']"
          >
            <HelperLines
              :horizontal="helperLineHorizontal"
              :vertical="helperLineVertical"
              :alignment="alignment"
            />
            <MiniMap :pannable="true" :zoomable="true" />
            <Controls>
              <ControlButton
                :disabled="screenshotDisabled"
                title="PNG Screenshot"
                @click="doPngScreenshot"
              >
                <CameraFilled />
              </ControlButton>
            </Controls>
            <template #node-moduleNode="props">
              <ModuleNode
                :id="props.id"
                :data="props.data"
                :selected="props.selected"
                @open-edit-dialog="onOpenEditDialog"
                @open-replacement-dialog="onOpenReplacementDialog"
                :ref="(el) => (nodeRefs[props.id] = el)"
              />
            </template>
            <Workbench>
              <p v-if="isDragOver">Drop here</p>
            </Workbench>
          </VueFlow>
        </div>
      </el-main>
    </el-container>
  </el-container>

  <EditModuleDialog
    v-model="editDialogVisible"
    :initial-name="currentEditingNode.name"
    :node-id="currentEditingNode.nodeId"
    :existing-names="allNodeNames"
    :port-options="currentEditingNode?.portOptions || []"
    :initial-port-labels="currentEditingNode?.portLabels || []"
    @confirm="onEditConfirm"
  />

  <ImportConfigDialog
    v-model="configDialogVisible"
    :initial-vessel-array="null"
    :initial-module-config="null"
    @confirm="onConfigImportConfirm"
  />

  <SaveDialog
    v-model="saveDialogVisible"
    @confirm="onSaveConfirm"
    :default-name="builderStore.lastSaveName"
  />

  <SaveDialog
    v-model="exportDialogVisible"
    @confirm="onExportConfirm"
    title="Export for Circulatory Autogen"
    :default-name="builderStore.lastExportName"
    suffix=".zip"
  />

  <ModuleReplacementDialog
    v-model="replacementDialogVisible"
    :modules="builderStore.availableModules"
    :node-id="currentEditingNode.nodeId"
    :port-options="currentEditingNode?.portOptions || []"
    :port-labels="currentEditingNode?.portLabels || []"
    @confirm="onReplaceConfirm"
  />

  <MacroBuilderDialog
    v-model="macroBuilderDialogVisible"
    @generate="onMacroBuilderGenerate"
    @edit-node="onOpenEditDialog"
  />
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref } from 'vue'
import { ElNotification } from 'element-plus'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import { DCaret, CameraFilled } from '@element-plus/icons-vue'
import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import Papa from 'papaparse'

import { useBuilderStore } from './stores/builderStore'
import { useFlowHistoryStore } from './stores/historyStore'
import useDragAndDrop from './composables/useDnD'
import { useLoadFromConfigFiles } from './composables/useLoadFromConfigFiles'
import { useResizableAside } from './composables/useResizableAside'
import ModuleList from './components/ModuleList.vue'
import Workbench from './components/WorkbenchArea.vue'
import ModuleNode from './components/ModuleNode.vue'
import EditModuleDialog from './components/EditModuleDialog.vue'
import ModuleReplacementDialog from './components/ModuleReplacementDialog.vue'
import SaveDialog from './components/SaveDialog.vue'
import ImportConfigDialog from './components/ImportConfigDialog.vue'
import MacroBuilderDialog from './components/MacroBuilderDialog.vue'
import HelperLines from './components/HelperLines.vue'
import { useScreenshot } from './services/useScreenshot'
import { generateExportZip } from './services/caExport'
import { useMacroGenerator } from './services/generate/generateWorkflow'
import { getHelperLines } from './utils/helperLines'
import { processModuleData } from './utils/cellml'
import { edgeLineOptions, FLOW_IDS } from './utils/constants'

import testModuleBGContent from './assets/bg_modules.cellml?raw'
import testModuleColonContent from './assets/colon_FTU_modules.cellml?raw'
import testModuleNewColonContent from './assets/colon_FTU_modules_new.cellml?raw'
import testParamertersCSV from './assets/colon_FTU_parameters.csv?raw'

const {
  addEdges,
  addNodes,
  applyNodeChanges,
  applyEdgeChanges,
  dimensions,
  edges,
  findEdge,
  findNode,
  fromObject,
  nodes,
  onConnect,
  removeEdges,
  removeNodes,
  setViewport,
  toObject,
  updateNodeData,
  viewport,
  vueFlowRef,
} = useVueFlow(FLOW_IDS.MAIN)
const { processMacroGeneration } = useMacroGenerator()

const pendingHistoryNodes = new Set()

const { onDragOver, onDrop, onDragLeave, isDragOver } =
  useDragAndDrop(pendingHistoryNodes)
const historyStore = useFlowHistoryStore()
const { loadFromConfigFiles } = useLoadFromConfigFiles()
const { capture } = useScreenshot()
const { width: asideWidth, startResize } = useResizableAside(200, 150, 400)

const helperLineHorizontal = ref(null)
const helperLineVertical = ref(null)
const alignment = ref('edge')

const testData = {
  filename: 'colon_FTU_modules.cellml',
  content: testModuleNewColonContent,
}

const builderStore = useBuilderStore()

const libcellmlReadyPromise = inject('$libcellml_ready')
const libcellml = inject('$libcellml')
const configDialogVisible = ref(false)
const editDialogVisible = ref(false)
const saveDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const replacementDialogVisible = ref(false)
const macroBuilderDialogVisible = ref(false)
const currentEditingNode = ref({
  nodeId: '',
  instanceId: '',
  ports: [],
  name: '',
})

const activeInteractionBuffer = new Map()
const undoRedoSelection = false

const allNodeNames = computed(() => nodes.value.map((n) => n.data.name))

const exportAvailable = computed(
  () => nodes.value.length > 0 && builderStore.parameterData.length > 0
)

onConnect((connection) => {
  // Match what we specify in connectionLineOptions.
  const newEdge = {
    ...connection,
    ...edgeLineOptions,
  }

  addEdges(newEdge)
})

const createSelectCommand = (changes, findFn) => {
  return {
    type: 'select',
    undo: () => {
      changes.forEach((s) => {
        const item = findFn(s.id)
        if (item) item.selected = s.from
      })
    },
    redo: () => {
      changes.forEach((s) => {
        const item = findFn(s.id)
        if (item) item.selected = s.to
      })
    },
  }
}

function updateHelperLines(changes, nodes) {
  helperLineHorizontal.value = undefined
  helperLineVertical.value = undefined

  if (
    changes.length === 1 &&
    changes[0].type === 'position' &&
    changes[0].dragging &&
    changes[0].position
  ) {
    const helperLines = getHelperLines(changes[0], nodes)

    // if we have a helper line, we snap the node to the helper line position
    // this is being done by manipulating the node position inside the change object
    changes[0].position.x = helperLines.snapPosition.x ?? changes[0].position.x
    changes[0].position.y = helperLines.snapPosition.y ?? changes[0].position.y

    // if helper lines are returned, we set them so that they can be displayed
    helperLineHorizontal.value = helperLines.horizontal
    helperLineVertical.value = helperLines.vertical
    alignment.value = helperLines.alignment
  }
}

const detachReactivity = (item) => {
  return JSON.parse(JSON.stringify(item))
}

const snapshotEdge = (change) => {
  if (change.type === 'add') {
    return detachReactivity(change.item)
  }

  const edge = findEdge(change.id)
  if (!edge) return null

  // Create a deep copy to break reactivity references
  return detachReactivity(edge)
}

const snapshotNode = (change) => {
  if (change.type === 'add') {
    // For added nodes, snapshot is the node itself
    return detachReactivity(change.item)
  }

  const node = findNode(change.id)
  if (!node) return null

  // Create a deep copy to break reactivity references
  return detachReactivity(node)
}

const processPositionChange = (c, buffer, moveChanges) => {
  if (c.position === undefined && c.from && buffer.has(c.id)) {
    // Drag End
    const start = buffer.get(c.id)
    const end = snapshotNode({ id: c.id })

    if (
      end &&
      (start.position.x !== end.position.x ||
        start.position.y !== end.position.y)
    ) {
      moveChanges.push({ start, end })
    }
    buffer.delete(c.id)
  } else if (c.position && !buffer.has(c.id)) {
    // Drag Start
    const snap = snapshotNode({ id: c.id })
    if (snap) buffer.set(c.id, snap)
  }
}

const processDimensionChange = (c, buffer) => {
  if (historyStore.lastChangeWasAdd) {
    historyStore.lastChangeWasAddSetter(false)
    if (!historyStore.lastCommandHadOffsetApplied) {
      const node = snapshotNode(c)
      node.position = {
        x: node.position.x - node.dimensions.width / 2,
        y: node.position.y - node.dimensions.height / 2,
      }
      historyStore.replaceLastCommand({
        type: 'add',
        offset: 'applied',
        undo: () => removeNodes(node.id),
        redo: () => addNodes(node),
      })
    }
  } else if (c.dimensions === undefined && buffer.has(c.id)) {
    const startSnapshot = buffer.get(c.id)
    const endSnapshot = snapshotNode({ id: c.id })

    // Only add command if dimensions actually changed
    if (
      endSnapshot &&
      (startSnapshot.dimensions.width !== endSnapshot.dimensions.width ||
        startSnapshot.dimensions.height !== endSnapshot.dimensions.height)
    ) {
      historyStore.addCommand({
        type: 'resize',
        undo: () => {
          const n = findNode(startSnapshot.id)
          if (n) {
            n.dimensions = startSnapshot.dimensions
            n.position = startSnapshot.position
            n.style = { ...startSnapshot.style }
          }
        },
        redo: () => {
          const n = findNode(endSnapshot.id)
          if (n) {
            n.dimensions = endSnapshot.dimensions
            n.position = endSnapshot.position
            n.style = { ...endSnapshot.style }
          }
        },
      })
    }
    buffer.delete(c.id)
  } else if (c.dimensions) {
    if (!buffer.has(c.id)) {
      const snap = snapshotNode({ id: c.id })
      if (snap) {
        buffer.set(c.id, snap)
      }
    }
  }
}

const onNodeChange = (changes) => {
  if (historyStore.isUndoRedoing) {
    // If we are currently undoing/redoing, bypass history tracking
    return applyNodeChanges(changes)
  }

  // Add node and dimension changes are single node events.
  // All other changes can be performed on multiple nodes in a change set.

  const addChanges = []
  const removeChanges = []
  const moveChanges = []
  const selectChanges = []
  changes.forEach((c) => {
    // Deal with the changes that we need to buffer first, which are the posiiton and dimension type changes.
    if (c.type === 'position') {
      processPositionChange(c, activeInteractionBuffer, moveChanges)
    } else if (c.type === 'dimensions') {
      processDimensionChange(c, activeInteractionBuffer)
    } else {
      // Non-active interaction buffer changes.
      activeInteractionBuffer.delete(c.id)
      if (c.type === 'add') {
        addChanges.push({ node: snapshotNode(c) })
      } else if (c.type === 'remove') {
        removeChanges.push({ node: snapshotNode(c) })
      } else if (c.type === 'select' && undoRedoSelection) {
        const node = findNode(c.id)
        if (node) {
          selectChanges.push({ id: c.id, from: node.selected, to: c.selected })
        }
      }
    }
  })

  if (moveChanges.length) {
    historyStore.addCommand({
      type: 'move',
      undo: () => {
        moveChanges.forEach((m) => {
          const n = findNode(m.start.id)
          if (n) n.position = m.start.position
        })
      },
      redo: () => {
        moveChanges.forEach((m) => {
          const n = findNode(m.end.id)
          if (n) n.position = m.end.position
        })
      },
    })
  }
  if (addChanges.length) {
    const nodesToAdd = addChanges.map((c) => c.node)
    const idsToRemove = addChanges.map((c) => c.node.id)

    historyStore.lastChangeWasAddSetter(true)
    historyStore.addCommand({
      type: 'add',
      offset: 'not-applied',
      undo: () => removeNodes(idsToRemove),
      redo: () => addNodes(nodesToAdd),
    })
  }
  if (removeChanges.length) {
    const nodesToRestore = removeChanges.map((change) => change.node)
    const idsToRemove = removeChanges.map((change) => change.node.id)
    historyStore.addCommand({
      type: 'remove',
      undo: () => addNodes(nodesToRestore),
      redo: () => removeNodes(idsToRemove),
    })
  }
  if (selectChanges.length) {
    historyStore.addCommand(createSelectCommand(selectChanges, findNode))
  }

  updateHelperLines(changes, nodes.value)

  // Have Vue Flow update the graph
  applyNodeChanges(changes)
}

const onEdgeChange = (changes) => {
  if (historyStore.isUndoRedoing) {
    // If we are currently undoing/redoing, bypass history tracking
    return applyEdgeChanges(changes)
  }

  const removeChanges = []
  const addChanges = []
  const selectChanges = []
  changes.forEach((c) => {
    if (c.type === 'remove') {
      removeChanges.push({ edge: snapshotEdge(c) })
    } else if (c.type === 'add') {
      addChanges.push({ edge: snapshotEdge(c) })
    } else if (c.type === 'select' && undoRedoSelection) {
      const edge = findEdge(c.id)
      selectChanges.push({ id: c.id, from: edge.selected, to: c.selected })
    }
  })

  if (addChanges.length) {
    const edgesToRestore = addChanges.map((change) => change.edge)
    const idsToRemove = addChanges.map((change) => change.edge.id)
    historyStore.addCommand({
      undo: () => removeEdges(idsToRemove),
      redo: () => addEdges(edgesToRestore),
    })
  }
  if (removeChanges.length) {
    const edgesToRestore = removeChanges.map((change) => change.edge)
    const idsToRemove = removeChanges.map((change) => change.edge.id)
    historyStore.addCommand({
      undo: () => addEdges(edgesToRestore),
      redo: () => removeEdges(idsToRemove),
    })
  }
  if (selectChanges.length) {
    historyStore.addCommand(createSelectCommand(selectChanges, findEdge))
  }

  applyEdgeChanges(changes)
}

const screenshotDisabled = computed(
  () => nodes.value.length === 0 && vueFlowRef.value !== null
)

function onOpenConfigImportDialog() {
  configDialogVisible.value = true
}

async function onConfigImportConfirm(eventPayload) {
  loadFromConfigFiles(eventPayload)
}

function onOpenEditDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  // Open the dialog
  editDialogVisible.value = true
}

function onOpenMacroBuilderDialog() {
  macroBuilderDialogVisible.value = true
}

async function onEditConfirm(updatedData) {
  const { nodeId, instanceId } = currentEditingNode.value
  if (!nodeId) return

  const targetInstance = instanceId || FLOW_IDS.MAIN
  const { updateNodeData } = useVueFlow(targetInstance)

  updateNodeData(nodeId, updatedData)
}

const handleModuleFile = (file) => {
  const filename = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      try {
        const result = processModuleData(libcellml, e.target.result, filename)
        if (result.type !== 'success') {
          if (result.issues) {
            ElNotification({
              title: 'Error',
              message: `${result.issues.length} issues found in model file.`,
              type: 'error',
            })
            console.error('Model import issues:', result.issues)
          }
          return
        }
        builderStore.addModuleFile({
          filename: filename,
          modules: result.data,
        })
        ElNotification.success({
          title: 'Modules Loaded',
          message: `Loaded ${result.data.length} parameters from ${file.name}.`,
          offset: 50,
        })
      } catch (err) {
        console.error('Error parsing file:', err)
        ElNotification({
          title: 'Error',
          message: 'Failed to parse module file as CellML.',
          type: 'error',
        })
        return
      }
    } catch (error) {
      console.error('Error parsing module file:', error)
      ElNotification({
        title: 'Error',
        message: 'An error occurred while processing the module file.',
        type: 'error',
      })
    }
  }
  reader.readAsText(file.raw)
}

const handleParametersFile = (file) => {
  if (!file) {
    ElNotification.error('No file selected.')
    return
  }

  Papa.parse(file.raw, {
    header: true, // Converts row 1 to object keys
    skipEmptyLines: true,

    complete: (results) => {
      // results.data will be an array of objects
      // e.g., [{ param_name: 'a', value: '1' }, { param_name: 'b', value: '2' }]
      builderStore.setParameterData(results.data)

      ElNotification.success({
        title: 'Parameters Loaded',
        message: `Loaded ${results.data.length} parameters from ${file.name}.`,
        offset: 50,
      })
    },

    error: (err) => {
      ElNotification.error({
        title: 'CSV Parse Error',
        message: err.message,
      })
    },
  })
}

const nodeRefs = ref({})

async function onMacroBuilderGenerate(data) {
  handleMacroGeneration(data)
  macroBuilderDialogVisible.value = false
}

function handleMacroGeneration(macroPayload) {
  // Insert at the center of the current view.
  const screenCenterX = dimensions.value.width / 2
  const screenCenterY = dimensions.value.height / 2

  // We approximate the center by negating the viewport x/y.
  const centerX = (screenCenterX - viewport.value.x) / viewport.value.zoom
  const centerY = (screenCenterY - viewport.value.y) / viewport.value.zoom

  processMacroGeneration(macroPayload, { x: centerX, y: centerY })
}

function onOpenReplacementDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  replacementDialogVisible.value = true
}

async function onReplaceConfirm(updatedData) {
  const nodeId = currentEditingNode.value.nodeId
  if (!nodeId) return
  const compLabel = updatedData.componentName
  const filePart = updatedData.sourceFile
  const label = filePart ? `${compLabel} — ${filePart}` : compLabel

  updatedData.label = label
  updateNodeData(nodeId, updatedData)
  replacementDialogVisible.value = false
}

function handleSaveWorkspace() {
  saveDialogVisible.value = true
}

function handleExport() {
  exportDialogVisible.value = true
}

/**
 * Collects all state and processes it into a zip file for CA ingestion.
 */
async function onExportConfirm(fileName) {
  const notification = ElNotification({
    title: 'Exporting...',
    message: 'Generating and zipping files.',
    type: 'info',
    duration: 0, // Stays open until closed
  })

  try {
    const zipBlob = await generateExportZip(
      fileName,
      nodes.value,
      edges.value,
      builderStore.parameterData
    )

    if (!import.meta.env.DEVOFF) {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(zipBlob)
      link.download = `${fileName}.zip`
      link.click()

      URL.revokeObjectURL(link.href)
    }
    builderStore.setLastExportName(fileName)
    notification.close()
    ElNotification.success({ message: 'Export successful!', offset: 50 })
  } catch (error) {
    notification.close()
    ElNotification.error(`Export failed: ${error.message}`)
  }
}

/**
 * Collects all state and downloads it as a JSON file.
 */
function onSaveConfirm(fileName) {
  // Ensure the filename ends with .json
  const finalName = fileName.endsWith('.json') ? fileName : `${fileName}.json`

  const saveState = {
    flow: toObject(),
    // flow: {
    //   nodes: nodes.value,
    //   edges: edges.value,
    //   viewport: viewport.value,
    // },
    store: {
      availableModules: builderStore.availableModules,
      parameterData: builderStore.parameterData,
    },
  }

  const jsonString = JSON.stringify(saveState, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = finalName
  link.click()

  URL.revokeObjectURL(url)

  builderStore.setLastSaveName(fileName)
  ElNotification.success({ message: 'Workflow saved!', offset: 50 })
}

function mergeModules(newModules) {
  const moduleMap = new Map(
    builderStore.availableModules.map((mod) => [mod.filename, mod])
  )

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.filename) {
        // Safety check
        moduleMap.set(newModule.filename, newModule)
      }
    }
  }

  builderStore.availableModules = Array.from(moduleMap.values())
}

/**
 * Reads a JSON file and restores the application state.
 */
function handleLoadWorkspace(file) {
  const reader = new FileReader()

  reader.onload = async (e) => {
    try {
      const loadedState = JSON.parse(e.target.result)

      // Validate the loaded file
      if (!loadedState.flow || !loadedState.store) {
        throw new Error('Invalid workflow file format.')
      }

      // Clear the current Vue Flow state.
      historyStore.clear()
      nodes.value = []
      edges.value = []
      setViewport({ x: 0, y: 0, zoom: 1 }) // Reset viewport.
      // Clear the current parameter data.
      builderStore.parameterData = []

      await nextTick()

      // Restore Vue Flow state.
      // We use `setViewport` to apply zoom/pan.
      setViewport(loadedState.flow.viewport)
      // We directly set the reactive refs.
      fromObject(loadedState.flow)
      // nodes.value = loadedState.flow.nodes
      // edges.value = loadedState.flow.edges

      // Restore Pinia store state.
      builderStore.parameterData = loadedState.store.parameterData
      // Merge available modules.
      mergeModules(loadedState.store.availableModules)

      ElNotification.success({
        message: 'Workflow loaded successfully!',
        offset: 50,
      })
    } catch (error) {
      ElNotification.error(`Failed to load workflow: ${error.message}`)
    }
  }

  reader.readAsText(file.raw)
}

const handleUndo = () => {
  historyStore.undo()
}

const handleRedo = () => {
  historyStore.redo()
}

function doPngScreenshot() {
  capture(vueFlowRef.value, { shouldDownload: true })
}

// --- Development Test Data ---
onMounted(async () => {
  // import.meta.env.DEV is a Vite variable that is true
  // only when running 'yarn dev'
  if (import.meta.env.DEV) {
    await libcellmlReadyPromise
    handleParametersFile({ raw: testParamertersCSV })
    const result = processModuleData(
      libcellml,
      testData.content,
      testData.filename
    )
    if (result.type !== 'success') {
      throw new Error('Failed to process test parameters file.')
    } else {
      builderStore.addModuleFile({
        filename: testData.filename,
        modules: result.data,
      })
    }
  }
})
</script>

<style>
/* Basic Styles */
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #dcdfe6;
}

.file-uploads {
  display: flex;
}

.workbench-main {
  position: relative;
  background-color: #f4f4f5;
  overflow: hidden;
  padding: 0;
}

.vue-flow__connection-path,
.vue-flow__edge-path {
  stroke-width: 5px;
}

/* (Optional) You can also make selected edges stand out 
*/
.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #409eff; /* Element Plus primary color */
  stroke-width: 7px;
}

.file-io-buttons {
  display: flex;
  align-items: center;
}
</style>
