<template>
  <el-container style="height: 100%; display: flex; flex-direction: column; flex-grow: 1">
    <el-header class="app-header">
      <div class="file-uploads">
        <div class="file-io-buttons">
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
            :disabled="!somethingAvailable"
          >
            Save Workspace
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button type="info" @click="handleUndo" :disabled="!historyStore.canUndo"> Undo </el-button>

          <el-button type="info" @click="handleRedo" style="margin-left: 10px" :disabled="!historyStore.canRedo">
            Redo
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button type="primary" @click="onOpenMacroBuilderDialog"> Macro Build </el-button>

          <el-button
            type="primary"
            style="margin-left: 10px"
            @click="moduleParameterMatchDialogVisible = true"
            :disabled="builderStore.parameterFiles.length === 0"
          >
            Match Parameters
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-dropdown
            ref="importDropdownRef"
            split-button
            type="info"
            @click="triggerCurrentImport"
            @command="handleImportCommand"
          >
            <el-tooltip :disabled="!currentImportMode.disabled" placement="bottom">
              <div>
                <el-tooltip placement="bottom" :visible="importTooltip.visible.value" trigger="manual">
                  <span
                    class="import-button-content"
                    @mouseenter="importTooltip.onMouseEnter"
                    @mouseleave="importTooltip.onMouseLeave"
                  >
                    Import
                    <el-icon class="el-icon--right">
                      <component :is="currentImportMode.icon" />
                    </el-icon>
                  </span>
                  <template #content> Import {{ currentImportMode.label }} </template>
                </el-tooltip>
              </div>
              <template #content>
                <p>
                  The
                  <strong>{{ currentImportMode.label }}</strong>
                  import option is disabled because the CellML library is not ready yet. Please wait a moment and try
                  again.
                </p>
              </template>
            </el-tooltip>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in importOptions"
                  :key="option.key"
                  :command="option"
                  :disabled="option.disabled"
                >
                  <el-icon><component :is="option.icon" /></el-icon>
                  {{ option.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-dropdown
            ref="exportDropdownRef"
            split-button
            type="info"
            style="margin-left: 10px"
            @click="triggerCurrentExport"
            @command="handleExportCommand"
            :disabled="!somethingAvailable"
          >
            <el-tooltip :disabled="!currentExportMode.disabled" placement="bottom">
              <div>
                <el-tooltip placement="bottom" :visible="exportTooltip.visible.value">
                  <span
                    class="export-button-content"
                    @mouseenter="exportTooltip.onMouseEnter"
                    @mouseleave="exportTooltip.onMouseLeave"
                  >
                    Export
                    <el-icon class="el-icon--right">
                      <component :is="currentExportMode.icon" />
                    </el-icon>
                  </span>
                  <template #content> Export {{ currentExportMode.label }} </template>
                </el-tooltip>
              </div>
              <template #content>
                <p>
                  The
                  <strong>{{ currentExportMode.label }}</strong>
                  import option is disabled because the CellML library is not ready yet. Please wait a moment and try
                  again.
                </p>
              </template>
            </el-tooltip>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in exportOptions"
                  :key="option.key"
                  :command="option"
                  :disabled="option.disabled"
                >
                  <el-icon><component :is="option.icon" /></el-icon>
                  {{ option.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
            <HelperLines :horizontal="helperLineHorizontal" :vertical="helperLineVertical" :alignment="alignment" />
            <MiniMap :pannable="true" :zoomable="true" />
            <Controls>
              <ControlButton :disabled="screenshotDisabled" title="PNG Screenshot" @click="doPngScreenshot">
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

  <SaveDialog v-model="saveDialogVisible" @confirm="onSaveConfirm" :default-name="builderStore.lastSaveName" />

  <SaveDialog
    v-model="exportDialogVisible"
    @confirm="onExportConfirm"
    :title="`Export for ${currentExportMode.label}`"
    :default-name="builderStore.lastExportName"
    :suffix="currentExportMode.suffix"
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

  <ModuleParameterMatchDialog v-model="moduleParameterMatchDialogVisible" />

  <ImportDialog
    ref="importDialogRef"
    v-model="importDialogVisible"
    :config="currentImportConfig"
    :builder-store="builderStore"
    @confirm="onImportConfirm"
  />
</template>

<script>
// This is a separate script block just for naming the component.
// This is to help when building a production build with minification
// for the Keep-Alive functionality.
export default {
  name: 'BuilderView',
}
</script>

<script setup>
import { computed, h, inject, markRaw, nextTick, onMounted, onUnmounted, ref, watchPostEffect } from 'vue'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import {
  DCaret,
  CameraFilled,
  Menu as IconVessel,
  Operation as IconParameters,
  Setting as IconModuleConfig,
} from '@element-plus/icons-vue'
import CellMLIcon from '../components/icons/CellMLIcon.vue'
import UnitsIcon from '../components/icons/UnitsIcon.vue'

import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import useDragAndDrop from '../composables/useDnD'
import { useLoadFromVesselArray } from '../composables/useLoadFromVesselArray'
import { useResizableAside } from '../composables/useResizableAside'
import { useAutoClosingTooltip } from '../composables/useAutoClosingTooltip'
import ModuleList from '../components/ModuleList.vue'
import Workbench from '../components/WorkbenchArea.vue'
import ModuleNode from '../components/ModuleNode.vue'
import EditModuleDialog from '../components/EditModuleDialog.vue'
import ImportDialog from '../components/ImportDialog.vue'
import ModuleReplacementDialog from '../components/ModuleReplacementDialog.vue'
import SaveDialog from '../components/SaveDialog.vue'
import MacroBuilderDialog from '../components/MacroBuilderDialog.vue'
import ModuleParameterMatchDialog from '../components/ModuleParameterMatchDialog.vue'
import HelperLines from '../components/HelperLines.vue'
import { useScreenshot } from '../services/useScreenshot'
import { generateExportZip } from '../services/caExport'
import { useMacroGenerator } from '../services/generate/generateWorkflow'
import { notify } from '../utils/notify'
import { getHelperLines } from '../utils/helperLines'
import { generateFlattenedModel, initLibCellML, processModuleData, processUnitsData } from '../utils/cellml'
import { edgeLineOptions, FLOW_IDS, IMPORT_KEYS, EXPORT_KEYS, JSON_FILE_TYPES } from '../utils/constants'
import { getId as getNextNodeId, generateUniqueModuleName } from '../utils/nodes'
import { getId as getNextEdgeId } from '../utils/edges'
import { getImportConfig, parseParametersFile } from '../utils/import'
import { legacyDownload, saveFileHandle, writeFileHandle } from '../utils/save'
import { generateParameterAssociations } from '../utils/parameters'

// import testModuleBGContent from '../assets/bg_modules.cellml?raw'
// import testModuleColonContent from '../assets/colon_FTU_modules.cellml?raw'
// import testModuleNewColonContent from '../assets/colon_FTU_modules_new.cellml?raw'
// import testParamertersCSV from '../assets/colon_FTU_parameters.csv?raw'

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
  getSelectedNodes,
  getSelectedEdges,
  nodes,
  onConnect,
  removeEdges,
  removeNodes,
  screenToFlowCoordinate,
  setViewport,
  toObject,
  updateNodeData,
  viewport,
  vueFlowRef,
} = useVueFlow(FLOW_IDS.MAIN)
const { processMacroGeneration } = useMacroGenerator()

const pendingHistoryNodes = new Set()

const { onDragOver, onDrop, onDragLeave, isDragOver } = useDragAndDrop(pendingHistoryNodes)
const historyStore = useFlowHistoryStore()
const { loadFromVesselArray } = useLoadFromVesselArray()
const { capture } = useScreenshot()
const { width: asideWidth, startResize } = useResizableAside(200, 150, 400)

const cellmlModules = import.meta.glob('../assets/cellml/*.cellml', {
  query: 'raw',
  eager: true,
})
const cellmlUnits = import.meta.glob('../assets/units/*.cellml', {
  query: 'raw',
  eager: true,
})
const parameterFiles = import.meta.glob('../assets/parameters/*.csv', {
  query: 'raw',
  eager: true,
})
const moduleConfigs = import.meta.glob('../assets/moduleconfig/*.json', {
  eager: true,
})

const helperLineHorizontal = ref(null)
const helperLineVertical = ref(null)
const alignment = ref('edge')
const importDropdownRef = ref(null)

// const testData = {
//   filename: 'CB_network_modules.cellml',
//   content: testModuleContent,
// }

const builderStore = useBuilderStore()

const libcellmlReadyPromise = inject('$libcellml_ready')
const libcellml = inject('$libcellml')
const configDialogVisible = ref(false)
const editDialogVisible = ref(false)
const saveDialogVisible = ref(false)
const importDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const replacementDialogVisible = ref(false)
const macroBuilderDialogVisible = ref(false)
const moduleParameterMatchDialogVisible = ref(false)
const currentEditingNode = ref({
  nodeId: '',
  instanceId: '',
  ports: [],
  name: '',
})
const importDialogRef = ref(null)

const currentImportMode = ref(null)
const currentImportConfig = ref({})

const currentExportMode = ref(null)

const activeInteractionBuffer = new Map()
const undoRedoSelection = false

const clipboard = ref({ nodes: [], edges: [] })
const mousePosition = ref({ x: 0, y: 0 })

const importTooltip = useAutoClosingTooltip(1500)
const exportTooltip = useAutoClosingTooltip(1500)

const allNodeNames = computed(() => nodes.value.map((n) => n.data.name))

const somethingAvailable = computed(() => nodes.value.length > 0 && builderStore.parameterFiles.size > 0)

const importOptions = computed(() => [
  {
    key: IMPORT_KEYS.VESSEL,
    label: 'Vessel Array',
    icon: markRaw(IconVessel),
    disabled: false,
  },
  {
    key: IMPORT_KEYS.CELLML_FILE,
    label: 'CellML File',
    icon: markRaw(CellMLIcon),
    disabled: libcellml.status !== 'ready',
  },
  {
    key: IMPORT_KEYS.MODULE_CONFIG,
    label: 'CellML Module Config',
    icon: markRaw(IconModuleConfig),
    disabled: libcellml.status !== 'ready',
  },
  {
    key: IMPORT_KEYS.PARAMETER,
    label: 'Parameters',
    icon: markRaw(IconParameters),
    disabled: false,
  },
  {
    key: IMPORT_KEYS.UNITS,
    label: 'Units',
    icon: markRaw(UnitsIcon),
    disabled: libcellml.status !== 'ready',
  },
])
currentImportMode.value = importOptions.value[0]

const exportOptions = computed(() => [
  {
    key: EXPORT_KEYS.CELLML,
    label: 'CellML',
    icon: markRaw(CellMLIcon),
    disabled: libcellml.status !== 'ready',
    suffix: '.cellml',
  },
  {
    key: EXPORT_KEYS.CA,
    label: 'Circulatory Autogen',
    icon: markRaw(IconVessel),
    disabled: false,
    suffix: '.zip',
  },
])
currentExportMode.value = exportOptions.value[0]

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

  if (changes.length === 1 && changes[0].type === 'position' && changes[0].dragging && changes[0].position) {
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

    if (end && (start.position.x !== end.position.x || start.position.y !== end.position.y)) {
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

const screenshotDisabled = computed(() => nodes.value.length === 0 && vueFlowRef.value !== null)

const loadCellMLModuleData = (content, filename, broadcaseNotifications = true) => {
  return new Promise((resolve) => {
    const result = processModuleData(content)
    if (result.type === 'success') {
      const augmentedData = result.data.map((item) => ({
        ...item,
        sourceFile: filename,
      }))
      builderStore.addModuleFile({
        filename: filename,
        modules: augmentedData,
        model: result.model,
      })
      if (broadcaseNotifications) {
        notify.success({
          title: 'CellML Modules Loaded',
          message: `Loaded ${result.data.length} parameters from ${filename}.`,
        })
      }
    } else if (result.issues) {
      if (broadcaseNotifications) {
        notify.error({
          title: 'Loading Module Error',
          message: `${result.issues.length} issues found in model file.`,
        })
      }
      console.error('Model import issues:', result.issues)
    }

    resolve(result.type === 'success')
  })
}

const loadCellMLUnitsData = (content, filename, broadcaseNotifications = true) => {
  return new Promise((resolve) => {
    const result = processUnitsData(content)
    if (result.type === 'success') {
      builderStore.addUnitsFile({
        filename: filename,
        model: result.model,
      })
      if (broadcaseNotifications) {
        notify.success({
          title: 'CellML Units Loaded',
          message: `Loaded ${result.units.count} units from ${filename}.`,
        })
      }
    } else if (result.issues) {
      if (broadcaseNotifications) {
        notify.error({
          title: 'Loading Units Error',
          message: `${result.issues[0].description}`,
        })
      }
    }

    resolve(result.type === 'success')
  })
}

const loadParametersData = async (content, filename, broadcastNotifications = true) => {
  try {
    const result = await parseParametersFile(content)

    const added = builderStore.addParameterFile(filename, result)

    if (broadcastNotifications && added) {
      notify.success({
        title: 'Parameters Loaded',
        message: `Loaded ${result.length} parameters from ${filename}.`,
      })
    } else if (broadcastNotifications && !added) {
      notify.info({
        title: 'Parameters Not Loaded',
        message: `No new parameters were added from ${filename}.`,
      })
    }

    return added
  } catch (err) {
    if (broadcastNotifications) {
      notify.error({
        title: 'Loading Parameters Error',
        message: `Failed to load parameters from ${filename}.`,
      })
    }

    return false
  }
}

const performImport = (mode) => {
  currentImportConfig.value = getImportConfig(mode.key)

  if (currentImportConfig.value) {
    importDialogVisible.value = true
  }
}

const triggerCurrentImport = () => {
  performImport(currentImportMode.value)
}

const handleImportCommand = (option) => {
  currentImportMode.value = option
  performImport(option)
}

async function onImportConfirm(importPayload, updateProgress) {
  if (currentImportMode.value.key === IMPORT_KEYS.VESSEL) {
    const vessels = importPayload[IMPORT_KEYS.VESSEL]?.data

    if (!vessels || vessels.length === 0) {
      console.warn('no vessel data provided')
      return
    }

    try {
      await loadFromVesselArray({ vessels }, (current, total, statusMessage) => {
        if (updateProgress) {
          updateProgress(`${statusMessage || 'Loading vessel array...'} (${current}/${total})`)
        }
      })

      notify.success({
        title: 'Import Complete',
        message: 'Workflow built successfully!',
      })
    } catch (error) {
      notify.error({
        title: 'Import Failed',
        message: error.message,
      })
    }
  } else if (currentImportMode.value.key === IMPORT_KEYS.CELLML_FILE) {
    const cellmlPayload = importPayload[IMPORT_KEYS.CELLML_FILE]
    loadCellMLModuleData(cellmlPayload?.data, cellmlPayload?.fileName)
  } else if (currentImportMode.value.key === IMPORT_KEYS.MODULE_CONFIG) {
    const configPayload = importPayload[IMPORT_KEYS.MODULE_CONFIG]
    if (configPayload) {
      builderStore.addConfigFile(configPayload.data, configPayload.fileName)
    }
  } else if (currentImportMode.value.key === IMPORT_KEYS.PARAMETER) {
    const paramPayload = importPayload[IMPORT_KEYS.PARAMETER]
    loadParametersData(paramPayload?.data, paramPayload?.fileName)
  } else if (currentImportMode.value.key === IMPORT_KEYS.UNITS) {
    const unitsPayload = importPayload[IMPORT_KEYS.UNITS]
    loadCellMLUnitsData(unitsPayload?.data, unitsPayload?.fileName)
  } else {
    console.log('Handle this import:', currentImportMode.value.key)
  }
  if (importDialogRef.value) {
    importDialogRef.value.finishLoading()
  }
}

const performExport = async () => {
  const result = await saveFileHandle(builderStore.lastSaveName, JSON_FILE_TYPES)
  if (result.status) {
    if (result.handle) {
      onExportConfirm(undefined, result.handle)
    }
  } else {
    exportDialogVisible.value = true
  }
}

const triggerCurrentExport = () => {
  performExport()
}

const handleExportCommand = (option) => {
  currentExportMode.value = option
  performExport(option)
}

function onOpenEditDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
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

async function handleSaveWorkspace() {
  const result = await saveFileHandle(builderStore.lastSaveName, JSON_FILE_TYPES)
  if (result.status) {
    if (result.handle) {
      const blob = createSaveBlob()
      try {
        writeFileHandle(result.handle, blob)
        builderStore.setLastSaveName(result.handle.name)
        notify.success({ message: 'Workflow saved!' })
      } catch (err) {
        notify.error({
          title: 'Error Saving Workflow',
          message: err.message,
        })
      }
    }
  } else {
    saveDialogVisible.value = true
  }
}

async function handleExport() {
  const result = await saveFileHandle(builderStore.lastExportName, JSON_FILE_TYPES)
  if (result.status) {
    if (result.handle) {
      onExportConfirm(undefined, result.handle)
    }
  } else {
    exportDialogVisible.value = true
  }
}

/**
 * Collects all state and processes it into a the current export format.
 */
async function onExportConfirm(fileName, handle) {
  const caExport = currentExportMode.value.key === EXPORT_KEYS.CA
  const message = caExport ? 'Generating and zipping CA files.' : 'Generating flattened CellML model.'
  const notification = notify.info({
    title: 'Exporting ...',
    message: message,
    duration: 0, // Stays open until closed
  })

  try {
    let blob = undefined
    if (caExport) {
      blob = await generateExportZip(fileName, nodes.value, edges.value, builderStore.parameterData)
    } else if (currentExportMode.value.key === EXPORT_KEYS.CELLML) {
      blob = generateFlattenedModel(nodes.value, edges.value, builderStore)
    }

    let finalName = undefined
    if (fileName) {
      finalName = fileName.endsWith(currentExportMode.value.suffix)
        ? fileName
        : `${fileName}${currentExportMode.value.suffix}`
      legacyDownload(finalName, blob)
    } else if (handle) {
      writeFileHandle(handle, blob)
      finalName = handle.name
    }

    if (fileName && finalName.endsWith(currentExportMode.value.suffix)) {
      const suffixLen = currentExportMode.value.suffix.length
      finalName = finalName.slice(0, -suffixLen)
    }

    builderStore.setLastExportName(finalName)
    notification.close()
    notify.success({
      title: 'Export successful!',
      message: h('div', null, [
        'Model downloaded. ',
        h(
          'a',
          {
            href: 'https://opencor.ws/app/',
            target: '_blank',
            style: { color: 'var(--el-color-primary)', fontWeight: 'bold' },
          },
          'Open in OpenCOR'
        ),
      ]),
      duration: 5000,
    })
  } catch (error) {
    notification.close()
    notify.error({ message: `Export failed: ${error.message}` })
  }
}

/**
 * Collects all state and creates blob from it.
 */
function createSaveBlob() {
  const saveState = {
    flow: toObject(),
    store: {
      availableModules: builderStore.availableModules,
      availableUnits: builderStore.availableUnits,
      lastExportName: builderStore.lastExportName,
      lastSaveName: builderStore.lastSaveName,
      parameterData: builderStore.parameterData,
    },
  }

  const jsonString = JSON.stringify(saveState, null, 2)
  return new Blob([jsonString], { type: 'application/json' })
}

/**
 * Collects all state and downloads it as a JSON file.
 */
function onSaveConfirm(fileName) {
  // Ensure the filename ends with .json
  const finalName = fileName.endsWith('.json') ? fileName : `${fileName}.json`

  const blob = createSaveBlob()

  legacyDownload(finalName, blob)

  builderStore.setLastSaveName(fileName)
  notify.success({ message: 'Workflow saved!' })
}

function mergeIntoStore(newModules, target) {
  const moduleMap = new Map(target.map((mod) => [mod.filename, mod]))

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.filename) {
        // Safety check
        moduleMap.set(newModule.filename, newModule)
      }
    }
  }

  target.length = 0
  target.push(...moduleMap.values())
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
      // Merge available units.
      mergeIntoStore(loadedState.store.availableUnits, builderStore.availableUnits)
      // Merge available modules.
      mergeIntoStore(loadedState.store.availableModules, builderStore.availableModules)

      builderStore.lastSaveName = loadedState.store.lastSaveName
      builderStore.lastExportName = loadedState.store.lastExportName

      notify.success({
        message: 'Workflow loaded successfully!',
      })
    } catch (error) {
      notify.error({ message: `Failed to load workflow: ${error.message}` })
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

const getBoundingCenter = (nodes) => {
  if (nodes.length === 0) return { x: 0, y: 0 }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  nodes.forEach((n) => {
    const pos = {
      x: n.position.x + n.dimensions.width / 2,
      y: n.position.y + n.dimensions.height / 2,
    }
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
    if (pos.x > maxX) maxX = pos.x
    if (pos.y > maxY) maxY = pos.y
  })

  return {
    x: minX + (maxX - minX) / 2,
    y: minY + (maxY - minY) / 2,
  }
}

const copySelection = () => {
  const nodes = getSelectedNodes.value
  const edges = getSelectedEdges.value

  if (nodes.length === 0) return

  // Create a deep copy to avoid reference issues
  clipboard.value = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  }
}

const pasteSelection = (atMouse = false) => {
  if (clipboard.value.nodes.length === 0) return

  const newNodes = []
  const newEdges = []

  let dx = 50
  let dy = 50

  if (atMouse) {
    // Convert screen mouse pixels to graph coordinates (handling zoom/pan)
    const mouseFlowPos = screenToFlowCoordinate(mousePosition.value)

    // Find the center of the nodes currently in the clipboard
    const clipboardCenter = getBoundingCenter(clipboard.value.nodes)

    // Calculate difference to move center -> mouse
    dx = mouseFlowPos.x - clipboardCenter.x
    dy = mouseFlowPos.y - clipboardCenter.y
  }

  // Create a mapping of Old ID -> New ID.
  const idMap = {}
  const nodeIdSet = nodes.value.map((n) => n.id)
  const edgeIdSet = edges.value.map((e) => e.id)
  const namesSet = new Set()
  allNodeNames.value.forEach((name) => {
    namesSet.add(name)
  })

  clipboard.value.nodes.forEach((node) => {
    const newId = getNextNodeId(nodeIdSet)
    idMap[node.id] = newId
    nodeIdSet.push(newId)

    const finalName = generateUniqueModuleName({ name: node.data.componentName }, namesSet)
    namesSet.add(finalName)

    // Create the new node with offset position.
    newNodes.push({
      id: newId,
      type: node.type,
      data: {
        ...node.data,
        name: finalName,
      },
      position: {
        x: node.position.x + dx,
        y: node.position.y + dy,
      },
      // Reset selection state so we focus on the new copy.
      selected: true,
    })
  })

  // Only copy edges if BOTH source and target are in the copied set.
  clipboard.value.edges.forEach((edge) => {
    const newSource = idMap[edge.source]
    const newTarget = idMap[edge.target]

    // If both endpoints exist in our new set, recreate the connection.
    if (newSource && newTarget) {
      const newEdgeId = getNextEdgeId(edgeIdSet)
      edgeIdSet.push(newEdgeId)

      newEdges.push({
        ...edge,
        id: newEdgeId,
        source: newSource,
        target: newTarget,
        selected: true,
      })
    }
  })

  getSelectedNodes.value.forEach((n) => (n.selected = false))
  getSelectedEdges.value.forEach((e) => (e.selected = false))

  addNodes(newNodes)
  addEdges(newEdges)
}

const handleKeyDown = (event) => {
  // Check if user is typing in an input field (don't trigger copy/paste then)
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return

  const isCtrl = event.ctrlKey || event.metaKey // metaKey for Mac Cmd
  const isShift = event.shiftKey

  if (isCtrl && event.key === 'c') {
    copySelection()
  }

  if (isCtrl && event.key === 'v') {
    pasteSelection(true)
  }

  if (isCtrl && event.key === 'd') {
    event.preventDefault() // Stop browser bookmark dialog
    copySelection()
    pasteSelection()
  }

  if (isCtrl && !isShift && event.key === 'z' && historyStore.canUndo) {
    handleUndo()
  }
  if (isCtrl && isShift && event.key === 'z' && historyStore.canRedo) {
    handleRedo()
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousemove', onMouseMove)
  libcellmlReadyPromise.then((instance) => {
    initLibCellML(instance)
  })
  await libcellmlReadyPromise

  const promises = []
  for (const [path, content] of Object.entries(cellmlModules)) {
    promises.push(loadCellMLModuleData(content.default, path.split('/').pop(), false))
  }

  for (const [path, content] of Object.entries(cellmlUnits)) {
    promises.push(loadCellMLUnitsData(content.default, path.split('/').pop(), false))
  }

  for (const [path, content] of Object.entries(parameterFiles)) {
    promises.push(loadParametersData(content.default, path.split('/').pop(), false))
  }

  const results = await Promise.all(promises)
  const successCount = results.filter((result) => result === true).length
  const failCount = results.length - successCount

  if (successCount > 0) {
    notify.success({
      title: 'Internal Resource Loading',
      message: `Successfully loaded ${successCount} file${successCount > 1 ? 's' : ''}.`,
    })
  }

  if (failCount > 0) {
    if (successCount > 0) await nextTick()
    notify.warning({
      title: 'Internal Resource Loading',
      message: `${failCount} file${failCount > 1 ? 's' : ''} failed to load.`,
    })
  }

  for (const [path, content] of Object.entries(moduleConfigs)) {
    builderStore.addConfigFile(content.default, path.split('/').pop())
  }

  const rawSuggestions = generateParameterAssociations(builderStore.availableModules, builderStore.parameterFiles)

  const linkMap = new Map()
  rawSuggestions.forEach((suggestion) => {
    if (suggestion.matchedParameterFile) {
      linkMap.set(suggestion.moduleSource, suggestion.matchedParameterFile)
    }
  })

  builderStore.applyParameterLinks(linkMap)
})

const onMouseMove = (event) => {
  mousePosition.value = { x: event.clientX, y: event.clientY }
}

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', onMouseMove)
})

watchPostEffect(() => {
  // Safety check: ensure component is mounted
  if (!importDropdownRef.value || !importDropdownRef.value.$el) return

  // Find the FIRST button inside the split-dropdown (The Action Button)
  // The second button is the trigger arrow, which we want to leave alone.
  const actionBtn = importDropdownRef.value.$el.querySelector('button:first-child')

  if (!actionBtn) return

  // Toggle the Element Plus 'is-disabled' class and native attribute
  if (currentImportMode.value.disabled) {
    actionBtn.classList.add('is-disabled')
    actionBtn.setAttribute('disabled', 'disabled') // Disables clicks & hover styles
  } else {
    actionBtn.classList.remove('is-disabled')
    actionBtn.removeAttribute('disabled')
  }
})
</script>

<style>
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

.import-button-content {
  display: flex;
  align-items: center;
}
</style>
