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

          <el-divider direction="vertical" style="margin: 10 15px" />

          <el-button
            type="warning"
            plain
            @click="handleAutoLayout"
            style="margin-left: 0px"
            :disabled="!somethingAvailable"
          >
            Auto Layout
          </el-button>

          <el-button
            type="danger"
            plain
            @click="handleClearWorkspace"
            style="margin-left: 10px"
            :disabled="!somethingAvailable"
          >
            Clear
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button type="info" @click="handleUndo" :disabled="!historyStore.canUndo"> Undo </el-button>

          <el-button type="info" @click="handleRedo" style="margin-left: 10px" :disabled="!historyStore.canRedo">
            Redo
          </el-button>

          <el-divider direction="vertical" style="margin: 0 15px" />

          <el-button type="primary" @click="onOpenMacroBuilderDialog"> Macro Build </el-button>

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
                <el-tooltip placement="bottom" :auto-close="1200">
                  <span class="import-button-content">
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
            <el-tooltip :disabled="!currentExportMode.disabled" placement="bottom" :auto-close="2400">
              <div>
                <el-tooltip placement="bottom" :disabled="currentExportMode.disabled" :auto-close="1200">
                  <span class="export-button-content">
                    Export
                    <el-icon class="el-icon--right">
                      <component :is="currentExportMode.icon" />
                    </el-icon>
                  </span>
                  <template #content> Export {{ currentExportMode.label }} </template>
                </el-tooltip>
              </div>
              <template #content>
                {{ cellMlExportTooltip }}
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
      <div>
        <el-link type="primary" href="https://github.com/physiomelinks/phlynx/issues/new" target="_blank">
          Report Issue
        </el-link>
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
        <div class="workspace-search-container" :class="{ 'search-inactive': !searchBarFocused && !searchQuery }">
          <el-input
            v-model="searchQuery"
            placeholder="Search modules..."
            :prefix-icon="Search"
            clearable
            class="workspace-search-input"
            @input="handleSearchInput"
            @focus="searchBarFocused = true"
            @blur="searchBarFocused = false"
          >
            <template #suffix>
              <div class="search-suffix-content">
                <span v-if="searchQuery && matchCount !== null" class="search-match-count">
                  {{ matchCount }} match{{ matchCount !== 1 ? 'es' : '' }}
                </span>
                <div v-if="searchQuery && matchCount >= 1" class="search-nav-buttons">
                  <el-button
                    v-if="matchCount > 1"
                    :icon="ArrowUp"
                    size="small"
                    text
                    @click="cycleToPreviousMatch"
                    title="Previous match (Shift+Enter)"
                  />
                  <el-button
                    :icon="ArrowDown"
                    size="small"
                    text
                    @click="cycleToNextMatch"
                    :title="matchCount === 1 ? 'Zoom to match (Enter)' : 'Next match (Enter)'"
                  />
                </div>
              </div>
            </template>
          </el-input>
        </div>

        <div class="dnd-flow" @drop="onDrop">
          <VueFlow
            :id="FLOW_IDS.MAIN"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @nodes-change="onNodeChange"
            @edges-change="onEdgeChange"
            @pane-context-menu="onPaneContextMenu"
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
                :class="getNodeClass(props)"
                @open-edit-dialog="onOpenEditDialog"
                @open-cellml-editor-dialog="onOpenCellMLEditorDialog"
                @open-parameter-editor-dialog="onOpenParameterEditorDialog"
                @open-replacement-dialog="onOpenReplacementDialog"
                @open-context-menu="onNodeContextMenu"
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

  <CellMLEditorDialog v-model="cellMLEditorDialogVisible" :nodeData="currentEditingNode" @save="handleCellMLSave" />

  <EditParameterDialog v-model="editParameterDialogVisible" :nodeData="currentEditingNode" />

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

  <ImportDialog
    ref="importDialogRef"
    v-model="importDialogVisible"
    :config="currentImportConfig"
    @confirm="onImportConfirm"
  />

  <PaneContextMenu ref="contextMenuRef" :items="contextMenuItems" />
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
import { computed, h, inject, markRaw, nextTick, onMounted, onUnmounted, ref, watch, watchPostEffect } from 'vue'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import {
  DCaret,
  CameraFilled,
  Search,
  ArrowUp,
  ArrowDown,
  Menu as IconVessel,
  Operation as IconParameters,
  Setting as IconModuleConfig,
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import CellMLIcon from '../components/icons/CellMLIcon.vue'
import UnitsIcon from '../components/icons/UnitsIcon.vue'

import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import useDragAndDrop from '../composables/useDnD'
import { useLoadFromVesselArray } from '../composables/useLoadFromVesselArray'
import { useLoadFromCellML } from '../composables/useLoadFromCellml'
import { parseCellMLConnections } from '../services/import/parseCellmlConnections'
import { useResizableAside } from '../composables/useResizableAside'
import { useGtm } from '../composables/useGtm'
import ModuleList from '../components/ModuleList.vue'
import Workbench from '../components/WorkbenchArea.vue'
import ModuleNode from '../components/ModuleNode.vue'
import EditModuleDialog from '../components/EditModuleDialog.vue'
import ImportDialog from '../components/ImportDialog.vue'
import ModuleReplacementDialog from '../components/ModuleReplacementDialog.vue'
import SaveDialog from '../components/SaveDialog.vue'
import MacroBuilderDialog from '../components/MacroBuilderDialog.vue'
import HelperLines from '../components/HelperLines.vue'
import PaneContextMenu from '../components/PaneContextMenu.vue'
import { useScreenshot } from '../services/useScreenshot'
import { generateExportZip } from '../services/caExport'
import { createCellMLDataFragment } from '../services/cellml'
import { useMacroGenerator } from '../services/generate/generateWorkflow'
import { notify } from '../utils/notify'
import { getHelperLines } from '../utils/helperLines'
import { getPurgedUrlForResource, getUrlForResource, loadManifest } from '../utils/resources'
import { useClearWorkspace } from '../utils/workspace'
import { relayoutNodes } from '../services/layouts/physics'
import { generateFlattenedModel, initLibCellML, processCellMLData } from '../utils/cellml'
import {
  edgeLineOptions,
  CELLML_FILE_TYPES,
  FLOW_IDS,
  IMPORT_KEYS,
  EXPORT_KEYS,
  JSON_FILE_TYPES,
  ZIP_FILE_TYPES,
  DEFAULT_FILE_NAME,
} from '../utils/constants'
import { getId as getNextNodeId, generateUniqueModuleName } from '../utils/nodes'
import { getId as getNextEdgeId } from '../utils/edges'
import { getImportConfig, parseParametersFile } from '../utils/import'
import {
  saveFileHandle, 
  saveWithDialog,
  getFileHandle,
  writeFileHandle,
  ensureExtension,
  legacyDownload
} from '../utils/save'
import CellMLEditorDialog from '../components/CellMLEditorDialog.vue'
import EditParameterDialog from '../components/EditParameterDialog.vue'

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
  fitView,
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

const { onDragOver: onDragOverModule, onDrop: onDropModule, onDragLeave, isDragOver, createModuleNode } = useDragAndDrop(pendingHistoryNodes)

/**
 * Shared multi-file notification helper.
 * `results` must be an array of `{ ok, summary }` objects where `summary` is a
 * human-readable description of what was loaded (e.g. "3 modules and 2 units").
 * Titles are customisable so each import type can use its own wording.
 */
const notifyMultiFileResults = (results, { successTitle, partialTitle = 'Partial Import', failTitle = 'Import Failed' }) => {
  const succeeded = results.filter((r) => r.ok)
  const failed = results.length - succeeded.length
  const fileWord = (n) => `${n} file${n !== 1 ? 's' : ''}`

  if (succeeded.length > 0 && failed === 0) {
    notify.success({ title: successTitle, message: `Loaded from ${fileWord(succeeded.length)}.` })
  } else if (succeeded.length > 0) {
    notify.warning({ title: partialTitle, message: `Loaded from ${fileWord(succeeded.length)}. ${fileWord(failed)} failed.` })
  } else {
    notify.error({ title: failTitle, message: `Failed to load all ${fileWord(failed)}.` })
  }
}

/**
 * Read a File object as text.
 */
const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })

/**
 * Load an array of CellML entries, each being either a browser File object or a
 * plain `{ name, content }` object (used when content is already in memory).
 *
 * If a single file contains inter-component connections it is treated as a
 * connection graph and loaded into the workspace via loadFromCellML.
 * Otherwise (or for multiple files) the files are registered as module/unit
 * libraries via loadCellMLData as usual.
 *
 * Shows per-file notifications for a single file; a combined summary for multiple.
 */
const loadCellMLFiles = async (entries) => {
  // Single-file fast path: check for connections and load as a graph if present
  if (entries.length === 1) {
    const entry = entries[0]
    const content = entry instanceof File ? await readFileAsText(entry) : entry.content
    const { components } = parseCellMLConnections(content, entry.name)
    if (components.length > 0) {
      if (nodes.value.length > 0) {
        try {
          await ElMessageBox.confirm(
            'The workspace already contains nodes. What would you like to do?',
            'Workspace Not Empty',
            {
              distinguishCancelAndClose: true,
              confirmButtonText: 'Overwrite',
              cancelButtonText: 'Add to Workspace',
              type: 'warning',
            }
          )
          // confirmed — overwrite, fall through to normal loadFromCellML below
        } catch (action) {
          if (action === 'cancel') {
            // Snapshot current workspace before wiping it
            const snapshot = toObject()

            // Load new graph into clean workspace using the normal path
            const result = await loadCellMLData(content, entry.name, { notify: false })
            await loadFromCellML(content, entry.name)

            // Remap snapshotted node IDs to avoid clashes with newly loaded nodes
            const existingIds = new Set(nodes.value.map((n) => n.id))
            const idRemap = new Map()

            const restoredNodes = snapshot.nodes.map((n) => {
              let newId = n.id
              let counter = 1
              while (existingIds.has(newId)) {
                newId = `${n.id}_${counter++}`
              }
              existingIds.add(newId)
              idRemap.set(n.id, newId)

              return {
                ...n,
                id: newId,
                position: { x: n.position.x + 1500, y: n.position.y },
                data: { ...n.data, name: newId },
              }
            })

            // Remap edge source/target to use new IDs
            const restoredEdges = snapshot.edges.map((e) => ({
              ...e,
              id: `${e.id}_restored_${crypto.randomUUID()}`,
              source: idRemap.get(e.source) ?? e.source,
              target: idRemap.get(e.target) ?? e.target,
            }))

            addNodes(restoredNodes)
            addEdges(restoredEdges)

            return [result]
          }
          // 'close' — user dismissed with X, do nothing
          return []
        }
      }
      // Register modules/units in the store first, then build the graph.
      // loadCellMLData is kept silent here since loadFromCellML provides its own feedback.
      const result = await loadCellMLData(content, entry.name, { notify: false })
      await loadFromCellML(content, entry.name)
      return [result]
    }
    // No connections — fall through to the standard module-registration path
    try {
      const result = await loadCellMLData(content, entry.name)
      return [result]
    } catch {
      return [{ ok: false, moduleCount: 0, unitCount: 0 }]
    }
  }

  // Multi-file path: always register as module/unit libraries
  const multiFile = entries.length > 1
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const content = entry instanceof File ? await readFileAsText(entry) : entry.content
        return loadCellMLData(content, entry.name, { notify: !multiFile })
      } catch {
        return { ok: false, moduleCount: 0, unitCount: 0 }
      }
    })
  )

  if (multiFile) {
    const succeeded = results.filter((r) => r.ok)
    const failed = results.length - succeeded.length
    const totalModules = succeeded.reduce((sum, r) => sum + r.moduleCount, 0)
    const totalUnits = succeeded.reduce((sum, r) => sum + r.unitCount, 0)
    const fileWord = (n) => `${n} file${n !== 1 ? 's' : ''}`
    const summary = [
      totalModules > 0 ? `${totalModules} module${totalModules !== 1 ? 's' : ''}` : '',
      totalUnits > 0 ? `${totalUnits} unit${totalUnits !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' and ')
    if (succeeded.length > 0 && failed === 0) {
      notify.success({ title: 'CellML Files Loaded', message: `Loaded ${summary} from ${fileWord(succeeded.length)}.` })
    } else if (succeeded.length > 0) {
      notify.warning({ title: 'Partial Import', message: `Loaded ${summary} from ${fileWord(succeeded.length)}. ${fileWord(failed)} failed.` })
    } else {
      notify.error({ title: 'Import Failed', message: `Failed to load all ${fileWord(failed)}.` })
    }
  }

  return results
}

/**
 * Unified dragover handler — accepts both module drags (internal) and file drops (.cellml from OS).
 */
const onDragOver = (event) => {
  const hasFiles = event.dataTransfer?.types?.includes('Files')
  if (hasFiles) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  } else {
    onDragOverModule(event)
  }
}

/**
 * Unified drop handler — routes OS file drops to CellML import, internal drags to the module DnD handler.
 */
const onDrop = async (event) => {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    event.preventDefault()

    const cellmlFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.cellml'))

    if (cellmlFiles.length === 0) {
      notify.warning({ title: 'Unsupported File Type', message: 'Only .cellml files can be dropped onto the workspace.' })
      return
    }

    if (libcellml.status !== 'ready') {
      notify.warning({ title: 'CellML Library Not Ready', message: 'Please wait for the CellML library to finish loading and try again.' })
      return
    }

    await loadCellMLFiles(cellmlFiles)
  } else {
    onDropModule(event)
  }
}

const historyStore = useFlowHistoryStore()
const { loadFromVesselArray } = useLoadFromVesselArray()
const { loadFromCellML } = useLoadFromCellML()
const { capture } = useScreenshot()
const { trackEvent } = useGtm()
const { width: asideWidth, startResize } = useResizableAside(300, 150, 400)

const helperLineHorizontal = ref(null)
const helperLineVertical = ref(null)
const alignment = ref('edge')
const importDropdownRef = ref(null)

const builderStore = useBuilderStore()

const libcellmlReadyPromise = inject('$libcellml_ready')
const libcellml = inject('$libcellml')
const editParameterDialogVisible = ref(false)
const editDialogVisible = ref(false)
const cellMLEditorDialogVisible = ref(false)
const saveDialogVisible = ref(false)
const importDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const replacementDialogVisible = ref(false)
const macroBuilderDialogVisible = ref(false)
const currentEditingNode = ref({
  nodeId: '',
  instanceId: '',
  ports: [],
  name: '',
})
const importDialogRef = ref(null)

const currentImportMode = ref(null)
const currentImportConfig = ref({})

const currentExportKey = ref(EXPORT_KEYS.CELLML)
const activeExportNotification = ref(null)

const activeInteractionBuffer = new Map()
const undoRedoSelection = false

const clipboard = ref({ nodes: [], edges: [] })
const mousePosition = ref({ x: 0, y: 0 })

// Search functionality
const searchQuery = ref('')
const matchCount = ref(null)
const matchingNodeIds = ref(new Set())
const searchBarFocused = ref(false)
const currentMatchIndex = ref(0)

const allNodeNames = computed(() => nodes.value.map((n) => n.data.name))

const somethingAvailable = computed(() => nodes.value.length > 0)

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
    label: 'Module Config',
    icon: markRaw(IconModuleConfig),
    disabled: libcellml.status !== 'ready',
  },
  {
    key: IMPORT_KEYS.PARAMETER,
    label: 'Parameters',
    icon: markRaw(IconParameters),
    disabled: false,
  }
])
currentImportMode.value = importOptions.value[0]

const exportOptions = computed(() => [
  {
    key: EXPORT_KEYS.CELLML,
    label: 'CellML',
    icon: markRaw(CellMLIcon),
    suffix: '.cellml',
    disabled: libcellml.status !== 'ready' || !somethingAvailable.value,
  },
  {
    key: EXPORT_KEYS.CA,
    label: 'Circulatory Autogen',
    icon: markRaw(IconVessel),
    disabled: !somethingAvailable.value,
    suffix: '.zip',
  },
])
const cellMlExportTooltip = computed(() => {
  const prefix = 'The CellML export option is disabled because '
  if (libcellml.status !== 'ready') {
    return prefix + 'the CellML library is not ready yet. Please wait a moment and try again.'
  }
  if (!somethingAvailable.value) {
    return prefix + 'there is nothing to export. Please add some modules to the workspace first.'
  }
  return 'This should not be shown when CellML export is enabled.'
})

const currentExportMode = computed(() => {
  // Find the selected option in the current list
  const found = exportOptions.value.find((opt) => opt.key === currentExportKey.value)
  // Fallback to the first option if nothing is found
  return found || exportOptions.value[0]
})

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

function selectAllNodes() {
  nodes.value.forEach((node) => {
    node.selected = true
  })
}

// Search filter logic
const handleSearchInput = () => {
  if (!searchQuery.value.trim()) {
    matchingNodeIds.value.clear()
    matchCount.value = null
    currentMatchIndex.value = 0
    return
  }

  const query = searchQuery.value.toLowerCase()
  const matches = new Set()

  nodes.value.forEach((node) => {
    // Search in all relevant name fields
    const componentName = node.data?.componentName?.toLowerCase() || ''
    const name = node.data?.name?.toLowerCase() || ''
    const label = node.data?.label?.toLowerCase() || ''
    const sourceFile = node.data?.sourceFile?.toLowerCase() || ''

    if (componentName.includes(query) || name.includes(query) || label.includes(query) || sourceFile.includes(query)) {
      matches.add(node.id)
    }
  })

  matchingNodeIds.value = matches
  matchCount.value = matches.size
  currentMatchIndex.value = 0
}

// Cycle to next matching node
const cycleToNextMatch = () => {
  if (matchCount.value === 0) return

  const matchArray = Array.from(matchingNodeIds.value)

  if (matchCount.value === 1) {
    // If only one match, just zoom to it
    zoomToNode(matchArray[0])
  } else {
    // Multiple matches, cycle through them
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matchArray.length
    zoomToNode(matchArray[currentMatchIndex.value])
  }
}

// Cycle to previous matching node
const cycleToPreviousMatch = () => {
  if (matchCount.value <= 1) return

  const matchArray = Array.from(matchingNodeIds.value)
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchArray.length) % matchArray.length
  zoomToNode(matchArray[currentMatchIndex.value])
}

// Zoom and center on a specific node
const zoomToNode = (nodeId) => {
  const node = findNode(nodeId)
  if (!node) return

  const x = node.position.x + (node.dimensions?.width || 0) / 2
  const y = node.position.y + (node.dimensions?.height || 0) / 2
  const zoom = 1.2

  setViewport(
    {
      x: dimensions.value.width / 2 - x * zoom,
      y: dimensions.value.height / 2 - y * zoom,
      zoom: zoom,
    },
    { duration: 300 }
  )
}

// Helper function to determine node class based on search
const getNodeClass = (props) => {
  if (!searchQuery.value.trim()) {
    return ''
  }
  return matchingNodeIds.value.has(props.id) ? 'node-search-match' : 'node-search-dimmed'
}

function handleClearWorkspace() {
  const { clearWorkspace } = useClearWorkspace()
  clearWorkspace()
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

function updateNodesWithNewParameters() {
  nodes.value.forEach((node) => {
    if (node.type === 'moduleNode') {
      builderStore.setVariableParameterValuesForInstance(
        node.data.name,
        node.data.variables,
        node.data.sourceFile,
        node.data.componentName,
        node.data.configIndex
      )
      updateNodeData(node.id, { variables: node.data.variables })
    }
  })
}

const loadCellMLData = (content, filename, { notify: shouldNotify = true, trackEvents = true } = {}) => {
  return new Promise((resolve) => {
    const result = processCellMLData(content)

    if (result.type === 'success') {
      const moduleCount = result.components.data.length
      const unitCount = result.units.count

      // Register components (modules) with the store
      if (moduleCount > 0) {
        const modules = result.components.data.map((item) => ({
          ...item,
          sourceFile: filename,
        }))
      
        builderStore.addModuleFile({
          filename,
          modules: modules,
          model: result.components.model,
        })
      }

      // Register units with the store
      if (unitCount > 0) {
        builderStore.addUnitsFile({
          filename,
          model: result.units.model,
        })
      }

      if (trackEvents) {
        trackEvent('cellml_load_action', {
          category: 'CellML',
          action: 'load_cellml_file',
          label: `Modules: ${result.components.data.length}, Units: ${result.units.count}`,
          file_type: 'cellml',
        })
      }

      if (shouldNotify) {
        if (moduleCount > 0 && unitCount > 0) {
          notify.success({
            title: 'CellML File Loaded',
            message: `Loaded ${moduleCount} module${moduleCount !== 1 ? 's' : ''} and ${unitCount} unit${unitCount !== 1 ? 's' : ''} from ${filename}.`,
          })
        } else if (moduleCount > 0) {
          notify.success({
            title: 'CellML Modules Loaded',
            message: `Loaded ${moduleCount} module${moduleCount !== 1 ? 's' : ''} from ${filename}.`,
          })
        } else if (unitCount > 0) {
          notify.success({
            title: 'CellML Units Loaded',
            message: `Loaded ${unitCount} unit${unitCount !== 1 ? 's' : ''} from ${filename}.`,
          })
        } else {
          notify.info({
            title: 'CellML File Loaded',
            message: `${filename} contained no modules or unit definitions.`,
          })
        }
      }

      resolve({ ok: true, moduleCount: result.components.data.length, unitCount: result.units.count })
    } else {
      if (trackEvents) {
        trackEvent('cellml_load_action', {
          category: 'CellML',
          action: 'load_cellml_file',
          label: `Error: encountered ${result.issues.length} error(s)`,
          file_type: 'cellml',
        })
      }
      if (shouldNotify) {
        notify.error({
          title: 'CellML Load Error',
          message: `${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} found in ${filename}.`,
        })
      }
      console.error('CellML import issues:', result.issues)
      resolve({ ok: false, moduleCount: 0, unitCount: 0 })
    }
  })
}

const loadParametersData = async (content, filename, { notify: shouldNotify = true, trackEvents = true } = {}) => {
  try {
    const added = builderStore.addParameterFile(filename, content)

    if (shouldNotify && added) {
      if (trackEvents) {
        trackEvent('parameters_load_action', {
          category: 'Parameters',
          action: 'load_parameters',
          label: `Parameters: ${content.length}`,
          file_type: 'csv',
        })
      }
      notify.success({
        title: 'Parameters Loaded',
        message: `Loaded ${content.length} parameters from ${filename}.`,
      })
    } else if (shouldNotify && !added) {
      notify.info({
        title: 'Parameters Not Loaded',
        message: `No new parameters were added from ${filename}.`,
      })
    }
    return { ok: added, count: added ? content.length : 0 }
  } catch (err) {
    if (shouldNotify) {
      if (trackEvents) {
        trackEvent('parameters_load_action', {
          category: 'Parameters',
          action: 'load_parameters',
          label: `Error: ${err.message}`,
          file_type: 'csv',
        })
      }
      notify.error({
        title: 'Loading Parameters Error',
        message: `Failed to load parameters from ${filename}.`,
      })
    }
    return { ok: false, count: 0 }
  }
}

const loadConfigData = async (content, filename, { notify: shouldNotify = true } = {}) => {
  try {
    const added = builderStore.addConfigFile(content, filename)
    if (shouldNotify && added > 0) {
      notify.success({
        title: 'Configurations Loaded',
        message: `Loaded ${content.length} configurations from ${filename}.`,
      })
    } else if (shouldNotify && added === 0) {
      notify.info({
        title: 'Configurations Not Loaded',
        message: `No new configurations were added from ${filename}.`,
      })
    }
    return { ok: added > 0, count: added }
  } catch (err) {
    if (shouldNotify) {
      notify.error({
        title: 'Loading Configuration Error',
        message: `Failed to load configurations from ${filename}.`,
      })
    }
    return { ok: false, count: 0 }
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
    const [[, data]] = importPayload
    const vessels = data.payload

    if (!vessels || vessels.length === 0) {
      notify.warning({
        title: 'Import Aborted',
        message: 'No vessel data provided',
      })
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
    const entries = [...importPayload].map(([name, data]) => ({ name, content: data?.payload }))
    await loadCellMLFiles(entries)
  } else if (currentImportMode.value.key === IMPORT_KEYS.MODULE_CONFIG) {
    const multiFile = importPayload.size > 1
    const results = await Promise.all(
      [...importPayload].map(([filename, data]) =>
        loadConfigData(data?.payload, filename, { notify: !multiFile })
      )
    )
    if (multiFile) {
      notifyMultiFileResults(results, { successTitle: 'Configurations Loaded' })
    }
  } else if (currentImportMode.value.key === IMPORT_KEYS.PARAMETER) {
    const multiFile = importPayload.size > 1
    const results = await Promise.all(
      [...importPayload].map(([filename, data]) =>
        loadParametersData(data?.payload, filename, { notify: !multiFile })
      )
    )
    if (multiFile) {
      notifyMultiFileResults(results, { successTitle: 'Parameters Loaded' })
    }
    updateNodesWithNewParameters()
  } else {
    console.log("Cannot get here this shouldn't be an import:", currentImportMode.value.key)
  }
  if (importDialogRef.value) {
    importDialogRef.value.finishLoading()
  }
}

const performExport = async () => {
  currentExportKey.value = currentExportMode.value.key
  
  const baseName = builderStore.lastExportName || DEFAULT_FILE_NAME
  const fileTypes = currentExportKey.value === EXPORT_KEYS.CELLML 
    ? CELLML_FILE_TYPES 
    : ZIP_FILE_TYPES
  
  // Get handle first
  const result = await getFileHandle(baseName, fileTypes, currentExportMode.value.suffix)
  if (result.success && result.handle) {
    onExportConfirm(result.cleanName, result.handle)
  } else if (result.needsLegacyDialog) {
    // Show custom dialog for legacy browsers
    exportDialogVisible.value = true
  }
}

const triggerCurrentExport = () => {
  performExport()
}

const handleExportCommand = (option) => {
  currentExportKey.value = option.key
  performExport(option)
}

function onOpenEditDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  editDialogVisible.value = true
}

function onOpenCellMLEditorDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  cellMLEditorDialogVisible.value = true
}

function onOpenParameterEditorDialog(eventPayload) {
  currentEditingNode.value = {
    ...eventPayload,
  }
  editParameterDialogVisible.value = true
}

function filterConfig(config, validNamesSet) {
  // Clean the Ports (Nested arrays).
  const portFields = ['entrance_ports', 'exit_ports', 'general_ports']

  portFields.forEach((field) => {
    if (config[field]) {
      config[field] = config[field].map((port) => ({
        ...port,
        // Filter the variables list inside this specific port.
        variables: (port.variables || []).filter((name) => validNamesSet.has(name)),
      }))
    }
  })

  // Clean the Definitions (Array of arrays).
  if (config.variables_and_units) {
    config.variables_and_units = config.variables_and_units.filter((entry) => validNamesSet.has(entry[0]))
  }
}
/**
 * Handler for both Saving (Updating) and Forking CellML modules.
 * Handles:
 * 1. Loading the new/updated CellML data.
 * 2. Migrating configs if the name changed.
 * 3. updating graph nodes to match new ports.
 */
async function handleCellMLSave(saveData) {
  const { sourceFile, componentName, originalSourceFile, originalComponentName, originalConfigIndex, code } = saveData

  const isRename = originalComponentName !== componentName
  const isNewFile = originalSourceFile !== sourceFile
  const isForkOrRename = isRename || isNewFile

  // Get the original configuration to migrate (if it exists).
  const originalModule = builderStore.getModulesModule(originalSourceFile, originalComponentName)

  // Safety check: If we can't find the original, create a blank config
  let configToMigrate = {}
  if (originalModule && originalModule.configs && originalModule.configs[originalConfigIndex]) {
    // Deep copy to break reactivity
    configToMigrate = JSON.parse(JSON.stringify(originalModule.configs[originalConfigIndex]))
  }

  // Load the New Data into the Store
  // This registers the module under the name found in 'code'.
  await loadCellMLData(code, sourceFile, { notify: false })

  // Retrieve the "Target" Module (The one we just loaded)
  let targetModule = builderStore.getModulesModule(sourceFile, componentName)

  if (!targetModule) {
    console.warn(`Mismatch: Requested ${componentName}, but store didn't register it. Check component name extraction.`)
    return
  }

  // Update the configuration.
  if (!targetModule.configs) {
    targetModule.configs = []
  }

  if (isForkOrRename) {
    // CASE A: Fork or Rename -> We add a NEW config entry.

    // Update metadata to match new home.
    configToMigrate.module_file = sourceFile
    configToMigrate.module_type = componentName

    // Push as a new config.
    targetModule.configs.push(configToMigrate)
    targetModule.configIndex = targetModule.configs.length - 1
  } else {
    // CASE B: Simple Update -> We update the EXISTING config in place.
    // We don't push a new one, we just ensure the current one is up to date.
    targetModule.configs[originalConfigIndex] = configToMigrate
    targetModule.configIndex = originalConfigIndex
  }

  // Propagate Changes (Update Nodes and Filter Configs).
  const validPortNames = updateGraphNodesAndPorts(saveData, targetModule)

  // Clean the Config (Remove ports that no longer exist).
  // Now that we have the valid ports from the new CellML, clean the config.
  const activeConfig = targetModule.configs[targetModule.configIndex]
  filterConfig(activeConfig, validPortNames)
}

/**
 * Helper: Updates the visual nodes on the graph.
 * Separated from data fetching for clarity.
 */
function updateGraphNodesAndPorts(updatedData, updatedModule) {
  const validPortNames = new Set(
    updatedModule?.portOptions?.map((p) => p.name) || []
  )

  const updatedModuleVariableMap = new Map(
    (updatedModule?.variables || []).map((v) => [v.name, v])
  )

  let updatedCount = 0

  nodes.value.forEach((node) => {
    const isTargetNode = node.id === updatedData.nodeId
    const isMatchingModule =
      updatedData.scope !== 'single' &&
      node.data.sourceFile === updatedData.originalSourceFile &&
      node.data.componentName === updatedData.originalComponentName

    if (!isTargetNode && !isMatchingModule) return

    // Capture original variable names BEFORE filtering
    const originalVariableNames = new Set(
      (node.data.variables || []).map((v) => v.name)
    )

    // Remove invalid variables and update metadata
    const cleanVariables = (node.data.variables || [])
      .filter((v) => validPortNames.has(v.name))
      .map((v) => {
        const updatedMeta = updatedModuleVariableMap.get(v.name)
        return updatedMeta
          ? { ...v, units: updatedMeta.units }
          : v
      })

    // Add only truly new variables (preserve old behavior)
    const newItems = (updatedModule?.variables || [])
      .filter((v) => !originalVariableNames.has(v.name))

    cleanVariables.push(...newItems)

    // Clean port labels
    const cleanLabels = (node.data.portLabels || []).map((labelObj) => ({
      ...labelObj,
      option: (labelObj.option || []).filter((opt) =>
        validPortNames.has(opt)
      ),
    }))

    const newData = {
      ...JSON.parse(JSON.stringify(node.data)),
      componentName: updatedData.componentName,
      sourceFile: updatedData.sourceFile,
      label: `${updatedData.componentName} — ${updatedData.sourceFile}`,
      portLabels: cleanLabels,
      portOptions: updatedModule?.portOptions || [],
      variables: cleanVariables,
    }

    updatedCount++
    updateNodeData(node.id, newData)
  })

  notify.success({
    title: 'Module Updated',
    message: `Updated ${updatedCount} node${
      updatedCount !== 1 ? 's' : ''
    } to ${updatedData.componentName}.`,
  })

  return validPortNames
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

const contextMenuRef = ref(null)

const paneContextMenuItems = [
  {
    label: 'Create Module',
    action: () => createNewModuleAtPosition(mousePosition.value.x, mousePosition.value.y),
  },
  {
    label: 'Select All',
    action: () => selectAllNodes(),
  },
  { 
    label: 'Fit View',
    action: () => fitView(),
  },
  {
    label: 'Clear Workspace',
    action: () => handleClearWorkspace(),
  },
]

const contextMenuItems = ref(paneContextMenuItems)

function onPaneContextMenu(event) {
  event.preventDefault()
  contextMenuItems.value = paneContextMenuItems
  contextMenuRef.value.open(event.clientX, event.clientY)
}

function onNodeContextMenu({ clientX, clientY, nodeId }) {
  contextMenuItems.value = [
    {
      label: 'Replace Module',
      action: () => {
        const node = findNode(nodeId)
        if (!node) return
        onOpenReplacementDialog({
          nodeId,
          nodeData: node.data,
          name: node.data.name,
          portOptions: node.data.portOptions,
          portLabels: node.data.portLabels,
        })
      },
    },
  ]
  contextMenuRef.value.open(clientX, clientY)
}

function createNewModuleAtPosition(clientX, clientY) {
  const allModules = builderStore.availableModules
  const moduleFile = allModules.find((f) => f.modules?.some((m) => m.componentName === 'new_module'))
  const moduleEntry = moduleFile?.modules?.find((m) => m.componentName === 'new_module')

  if (!moduleEntry) {
    notify.warning({ title: 'Module Not Found', message: 'new_module is not available.' })
    return
  }

  const moduleData = {
    name: moduleEntry.name,
    componentName: moduleEntry.componentName,
    sourceFile: moduleFile.filename,
    configs: moduleEntry.configs || null,
    configIndex: 0,
    ports: moduleEntry.ports || [],
    portOptions: moduleEntry.portOptions || [],
  }

  const position = screenToFlowCoordinate({ x: clientX, y: clientY })
  createModuleNode(moduleData, position)
}

function handleAutoLayout() {
  relayoutNodes(nodes.value, edges.value)
}

async function handleSaveWorkspace() {
  const safeName = ensureExtension(builderStore.lastSaveName, '.json')
  const result = await saveFileHandle(safeName, JSON_FILE_TYPES)
  if (result.status) {
    if (result.handle) {
      const blob = createSaveBlob()
      try {
        writeFileHandle(result.handle, blob)
        builderStore.setLastSaveName(result.handle.name)
        trackEvent('save_action', {
          category: 'Save',
          action: 'save_workflow',
          label: `File: ${result.handle.name}`,
          file_type: 'json',
        })
        notify.success({ title: 'Workflow saved!' })
      } catch (err) {
        trackEvent('save_action', {
          category: 'Save',
          action: 'save_workflow',
          label: `Error: ${err.message}`,
          file_type: 'json',
        })
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

/**
 * Collects all state and processes it into the current export format.
 */
async function onExportConfirm(fileName, handle) {
  if (activeExportNotification.value) {
    activeExportNotification.value.close()
    activeExportNotification.value = null
  }

  const caExport = currentExportMode.value.key === EXPORT_KEYS.CA
  const message = caExport ? 'Generating and zipping CA files.' : 'Generating flattened CellML model.'
  const notification = notify.info({
    title: 'Exporting...',
    message: message,
    duration: 0, 
  })

  try {
    const finalName = fileName || builderStore.lastExportName || DEFAULT_FILE_NAME
    
    const blob = caExport
      ? await generateExportZip(finalName, nodes.value, edges.value, builderStore)
      : generateFlattenedModel(nodes.value, edges.value, builderStore)
    
    const result = await saveWithDialog(
      blob, 
      handle, 
      finalName,
      currentExportMode.value.suffix
    )
    
    builderStore.setLastExportName(result.savedName)
    
    notification.close()

    let exportMessage = ''
    if (caExport) {
      exportMessage = 'Circulatory Autogen export zip generated.'
    } else {
      const dataUri = await createCellMLDataFragment(blob, finalName)
      exportMessage = h('div', null, [
        'Model exported to CellML. Open this model directly in ',
        h(
          'a',
          {
            href: `https://opencor.ws/app/?opencor://openFile/#${dataUri}`,
            rel: 'noopener noreferrer',
            style: { color: 'var(--el-color-primary)', fontWeight: 'bold' },
            target: '_blank',
          },
          'OpenCOR'
        ),
      ])
    }

    trackEvent('export_action', {
      category: 'Export',
      action: 'export_model',
      label: `File: ${finalName}`,
      file_type: currentExportMode.value.key,
    })

    activeExportNotification.value = notify.success({
      title: 'Export successful!',
      message: exportMessage,
      duration: 0,
    })
  } catch (error) {
    notification.close()
    trackEvent('export_action', {
      category: 'Export',
      action: 'export_model',
      label: `Error: ${error.message}`,
      file_type: currentExportMode.value.key,
    })

    notify.error({ title: 'Export failed', message: `${error.message}` })
  }
}

/**
 * Collects all state and creates blob from it.
 */
function createSaveBlob() {
  const saveState = {
    flow: toObject(),
    store: builderStore.getState(),
  }

  const jsonString = JSON.stringify(saveState, null, 2)
  return new Blob([jsonString], { type: 'application/json' })
}

/**
 * Collects all state and downloads it as a JSON file.
 */
const onSaveConfirm = async (fileName) => {
  const baseName = fileName || builderStore.lastSaveName || DEFAULT_FILE_NAME
  const finalName = ensureExtension(baseName, '.json')
  const blob = createSaveBlob()

  legacyDownload(finalName, blob)

  builderStore.setLastSaveName(fileName)
  notify.success({ title: 'Workflow saved!' })
}

/**
 * Reads a JSON file and restores the application state.
 */
function handleLoadWorkspace(file) {
  const reader = new FileReader()
  const { clearWorkspace } = useClearWorkspace()

  reader.onload = async (e) => {
    try {
      const loadedState = JSON.parse(e.target.result)

      // Validate the loaded file
      if (!loadedState.flow || !loadedState.store) {
        throw new Error('Invalid workflow file format.')
      }

      // Clear the current Vue Flow state.
      await clearWorkspace()

      // Restore Vue Flow state.
      // We use `setViewport` to apply zoom/pan.
      setViewport(loadedState.flow.viewport)
      // We directly set the reactive refs.
      fromObject(loadedState.flow)
      // nodes.value = loadedState.flow.nodes
      // edges.value = loadedState.flow.edges

      // Restore Pinia store state.
      builderStore.loadState(loadedState.store)

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_workflow',
        label: `Nodes: ${nodes.value.length}, Edges: ${edges.value.length}`,
        file_type: 'json',
      })
      notify.success({
        title: 'Workflow loaded successfully!',
      })
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_workflow',
        label: `Error: ${error.message}`,
        file_type: 'json',
      })
      notify.error({ title: 'Failed to load workflow', message: `${error.message}` })
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
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
    // Allow Enter/Shift+Enter in search input for navigation
    if (event.target.closest('.workspace-search-input')) {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (event.shiftKey) {
          cycleToPreviousMatch()
        } else {
          cycleToNextMatch()
        }
      }
    }
    return
  }

  // Don't intercept shortcuts when the CellML text editor dialog is open.
  // CodeMirror uses contenteditable divs rather than INPUT/TEXTAREA, so the
  // check above doesn't catch it. We guard on both the dialog-open state and
  // on whether focus is inside any CodeMirror editor element.
  if (cellMLEditorDialogVisible.value) return
  if (event.target.closest('.cm-editor')) return

  const isCtrl = event.ctrlKey || event.metaKey // metaKey for Mac Cmd
  const isShift = event.shiftKey

  if (isCtrl && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelection()
  }

  if (isCtrl && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteSelection(true)
  }

  if (isCtrl && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    copySelection()
    pasteSelection()
  }

  if (isCtrl && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selectAllNodes()
  }

  if (isCtrl && event.key.toLowerCase() === 's' && !somethingAvailable) {
    event.preventDefault()
    handleSaveWorkspace()
  }

  if (isCtrl && !isShift && event.key === 'z' && historyStore.canUndo) {
    event.preventDefault()
    handleUndo()
  }
  if (isCtrl && isShift && event.key === 'z' && historyStore.canRedo) {
    event.preventDefault()
    handleRedo()
  }
  if (isCtrl && event.key.toLowerCase() === 'y' && historyStore.canRedo) {
    event.preventDefault()
    handleRedo()
  }

  if (isCtrl && event.key.toLowerCase() === 'e' && !currentExportMode.disabled) {
    event.preventDefault()
    triggerCurrentExport()
  }

  if (isCtrl && event.key.toLowerCase() === 'i' && !currentImportMode.disabled) {
    event.preventDefault()
    triggerCurrentImport()
  }

  // Search shortcuts
  if ((isCtrl && event.key === 'f') || event.key === '/') {
    event.preventDefault()
    document.querySelector('.workspace-search-input input')?.focus()
  }

  if (event.key === 'Escape' && searchQuery.value && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
    searchQuery.value = ''
  }
}

async function fetchAndLoadResource(entry, resourceType) {
  try {
    const url = getUrlForResource(entry.path)

    // Fetch resource content
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch ${entry.name}`)

    // Process the response
    const content = await response.text()

    // Load the content
    if (resourceType === 'cellml module' || resourceType === 'cellml units') {
      await loadCellMLData(content, entry.file ?? entry.name, { notify: false })
    } else if (resourceType === 'module config') {
      await loadConfigData(content, entry.name, false)
      // const jsonContent = JSON.parse(content)
      // builderStore.addConfigFile(jsonContent, entry.name, false)
    } else if (resourceType === 'parameter file') {
      const parsed = await parseParametersFile(content)
      await loadParametersData(parsed, entry.name, { notify: false })
    }

    return true
  } catch (err) {
    return false
  }
}

const cellmlModules = import.meta.glob('../assets/modules/*.cellml', {
  query: 'raw',
  eager: true,
})
const cellmlUnits = import.meta.glob('../assets/units/*.cellml', {
  query: 'raw',
  eager: true,
})
const moduleConfigs = import.meta.glob('../assets/module_configs/*.json', {
  eager: true,
})

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousemove', onMouseMove)

  // Load the manifest and the libCellML WebAssembly module.
  const [manifest, instance] = await Promise.all([loadManifest(), libcellmlReadyPromise])

  initLibCellML(instance)

  // const printPurgeUrl = false
  // if (printPurgeUrl) {
  //   console.log(getPurgedUrlForResource())
  // }

  const promises = []
  for (const [path, content] of Object.entries(cellmlModules)) {
    promises.push(loadCellMLData(content.default, path.split('/').pop(), { notify: false }))
  }

  for (const [path, content] of Object.entries(cellmlUnits)) {
    promises.push(loadCellMLData(content.default, path.split('/').pop(), { notify: false }))
  }

  // if (manifest?.modules) {
  //   for (const entry of manifest.modules) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'cellml module'))
  //   }
  // }

  // if (manifest?.units) {
  //   for (const entry of manifest.units) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'cellml units'))
  //   }
  // }

  // if (manifest?.parameters) {
  //   for (const entry of manifest.parameters) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'parameter file'))
  //   }
  // }

  // if (manifest?.configs) {
  //   for (const entry of manifest.configs) {
  //     if (printPurgeUrl) {
  //       console.log(getPurgedUrlForResource(entry.path))
  //     }
  //     promises.push(fetchAndLoadResource(entry, 'module config'))
  //   }
  // }

  const results = await Promise.all(promises)
  const successCount = results.filter((result) => result?.ok).length
  const failCount = results.length - successCount

  if (successCount > 0) {
    notify.success({
      title: 'Resource Loading',
      message: `Successfully loaded ${successCount} file${successCount > 1 ? 's' : ''}.`,
    })
  }

  if (failCount > 0) {
    if (successCount > 0) await nextTick()
    notify.warning({
      title: 'Resource Loading',
      message: `${failCount} file${failCount > 1 ? 's' : ''} failed to load.`,
    })
  }

  for (const [path, content] of Object.entries(moduleConfigs)) {
    builderStore.addConfigFile(content.default, path.split('/').pop())
  }
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

// Watch for node changes to re-apply search filter
watch(
  nodes,
  () => {
    if (searchQuery.value.trim()) {
      handleSearchInput()
    }
  },
  { deep: true }
)
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

/* Search bar styles */
.workspace-search-container {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 300px;
  transition: opacity 0.3s ease;
}

.workspace-search-container.search-inactive {
  opacity: 0.4;
}

.workspace-search-container:hover {
  opacity: 1;
}

.workspace-search-input {
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.search-match-count {
  font-size: 12px;
  color: #909399;
  padding-right: 8px;
}

.search-suffix-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
}

.search-nav-buttons {
  display: flex;
  gap: 2px;
}

.search-nav-buttons .el-button {
  padding: 4px;
  min-height: unset;
}

/* Node filtering styles */
.node-search-match {
  opacity: 1 !important;
  transition: opacity 0.2s ease;
  outline: 3px solid #409eff;
  outline-offset: 2px;
  border-radius: 4px;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

.node-search-dimmed {
  opacity: 0.25 !important;
  transition: opacity 0.2s ease;
}
</style>