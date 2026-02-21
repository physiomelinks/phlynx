<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="80%"
    top="5vh"
    class="editor-dialog"
    :before-close="handleBeforeClose"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <div class="editor-container">
      <div v-if="loading" class="loading">Loading CellML source...</div>

      <div v-else class="editor-wrapper">
        <CellMLTextEditor v-model="currentCode" :regenerate-on-change="modelValue" @save="handleSave('key')" />
      </div>

      <div class="status-bar">
        <span v-if="isInternalModule" class="tag internal">
          <i class="icon-lock"></i> Read-Only Source (Internal)
        </span>
        <span v-else class="tag user">
          <i class="icon-user"></i> Editable Source (User Workspace)
        </span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <!-- "Apply to all" checkbox — only shown when sibling nodes exist -->
        <el-tooltip
          v-if="siblingCount > 0"
          :content="`Also update ${siblingCount} other node${siblingCount !== 1 ? 's' : ''} using ${props.nodeData.componentName} from ${props.nodeData.sourceFile}`"
          placement="top"
          effect="light"
        >
          <el-checkbox v-model="applyToAll" class="apply-all-checkbox">
            Apply to all instances
            <el-tag size="small" type="info" style="margin-left: 6px">
              {{ siblingCount + 1 }}
            </el-tag>
          </el-checkbox>
        </el-tooltip>

        <div class="footer-buttons">
          <el-button @click="handleCancel">Cancel</el-button>
          <el-button type="primary" @click="handleSave('button')" :disabled="!isDirty">
            Save Changes
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElCheckbox, ElDialog, ElMessageBox, ElTag, ElTooltip } from 'element-plus'
import { useVueFlow } from '@vue-flow/core'
import CellMLTextEditor from './CellMLTextEditor.vue'
import { useBuilderStore } from '../stores/builderStore'
import { useGtm } from '../composables/useGtm'
import { USER_MODULES_FILE } from '../utils/constants'
import {
  areModelsEquivalent,
  createEditableModelFromSourceModelAndComponent,
  doesComponentExistInModel,
  getModelComponentNames,
  mergeModelComponents,
} from '../utils/cellml'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  nodeData: {
    type: Object,
    required: true,
    // Expected: { nodeId, name, sourceFile, componentName, configIndex }
  },
})

const emit = defineEmits(['update:modelValue', 'save'])

const store = useBuilderStore()
const { trackEvent } = useGtm()
const { nodes } = useVueFlow()

const loading = ref(false)
const currentCode = ref('')
const originalCode = ref('')
const applyToAll = ref(false)

const isInternalModule = computed(() => {
  const sourceFile = props.nodeData.sourceFile
  return !!sourceFile && sourceFile !== USER_MODULES_FILE
})

const isDirty = computed(() => {
  return !areModelsEquivalent(originalCode.value, currentCode.value)
})

const dialogTitle = computed(() => {
  return `Editing: ${props.nodeData.name} (${props.nodeData.componentName} - ${props.nodeData.sourceFile})`
})

/**
 * Count of other nodes sharing the same sourceFile and componentName.
 */
const siblingCount = computed(() => {
  if (!props.nodeData?.sourceFile || !props.nodeData?.componentName) return 0
  return nodes.value.filter(
    (n) =>
      n.id !== props.nodeData.nodeId &&
      n.data?.sourceFile === props.nodeData.sourceFile &&
      n.data?.componentName === props.nodeData.componentName
  ).length
})

// Reset the checkbox whenever the dialog opens for a new node.
watch(() => props.nodeData, () => { applyToAll.value = false })

// ── Load content when dialog opens ──────────────────────────────────────────

watch(
  () => props.nodeData,
  async (newData) => {
    if (newData && props.modelValue) {
      loading.value = true
      try {
        const modelString = await store.getModuleContent(newData.sourceFile)
        const { xml, errors } = createEditableModelFromSourceModelAndComponent(modelString, newData.componentName)
        if (errors.length > 0) {
          console.error('Errors while extracting component for editing:', errors)
          ElMessageBox.alert(
            `Failed to load the CellML source for editing.\n\nError${errors.length === 1 ? '' : 's'}:\n- ${errors.join('\n- ')}\n\nPlease create an issue if the problem persists.`,
            'Load Error',
            { type: 'error' }
          )
        } else {
          currentCode.value = xml
          originalCode.value = xml
        }
      } catch (e) {
        console.error('Failed to load source', e)
      } finally {
        loading.value = false
      }
    }
  },
  { deep: true }
)

const checkDirtyAndProceed = (confirmAction) => {
  if (isDirty.value) {
    ElMessageBox.confirm('You have unsaved changes. Are you sure you want to close?', 'Warning', { type: 'warning' })
      .then(() => confirmAction())
      .catch(() => {})
  } else {
    confirmAction()
  }
}

const handleBeforeClose = (done) => checkDirtyAndProceed(done)
const handleCancel = () => checkDirtyAndProceed(() => emit('update:modelValue', false))

// ── Save ─────────────────────────────────────────────────────────────────────
//
// Both scope: single and scope: all perform identical merge logic — the
// component is written to USER_MODULES_FILE under whatever name is in the
// editor. The only difference is which nodes get redirected in BuilderView:
//   scope: single → only the editing node
//   scope: all    → all nodes sharing originalSourceFile + originalComponentName

const handleSave = async (source) => {
  if (source === 'key' && !isDirty.value) return

  const componentNames = getModelComponentNames(currentCode.value)
  if (!componentNames || componentNames.length === 0) {
    ElMessageBox.alert('Could not find a valid component name in the code.', 'Parse Error', { type: 'error' })
    return
  }

  const newName = componentNames[0].trim()
  const currentName = props.nodeData.componentName

  try {
    const existingModelString = await store.getModuleContent(USER_MODULES_FILE)

    // Block if the name is already taken by a different component.
    // Updating in place (newName === currentName and we own it) is always allowed.
    const nameExists = doesComponentExistInModel(existingModelString, newName)
    const isUpdatingInPlace = nameExists && newName === currentName

    if (nameExists && !isUpdatingInPlace) {
      ElMessageBox.alert(
        `A component named "${newName}" already exists in User Modules. Please rename the component in the editor before saving.`,
        'Name Conflict',
        { type: 'error' }
      )
      return
    }

    // For internal (read-only) source modules we are always writing to
    // USER_MODULES_FILE for the first time — no old entry to replace.
    const oldNameForMerge = isInternalModule.value ? undefined : currentName

    const mergedModelString = mergeModelComponents(
      existingModelString,
      currentCode.value,
      newName,
      oldNameForMerge
    )
    if (!mergedModelString) throw new Error('Merge operation returned empty string.')

    trackEvent('editor_action', {
      category: 'Editor',
      action: applyToAll.value ? 'save_all' : 'save_single',
      label: newName,
      file_type: 'cellml',
    })

    emit('save', {
      nodeId: props.nodeData.nodeId,
      // scope controls which nodes BuilderView redirects — not the merge logic.
      scope: applyToAll.value ? 'all' : 'single',
      code: mergedModelString,
      componentName: newName,
      sourceFile: USER_MODULES_FILE,
      originalComponentName: currentName,
      originalSourceFile: props.nodeData.sourceFile,
      originalConfigIndex: props.nodeData.configIndex,
    })

    emit('update:modelValue', false)
  } catch (error) {
    console.error(error)
    ElMessageBox.alert(`Failed to save changes: ${error.message}`, 'Save Error', { type: 'error' })
  }
}
</script>

<style scoped>
.editor-container {
  height: 75vh;
  display: flex;
  flex-direction: column;
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tag.internal {
  color: orange;
  font-weight: bold;
}

.tag.user {
  color: green;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  width: 100%;
}

.apply-all-checkbox {
  margin-right: auto;
  font-size: 13px;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}
</style>
