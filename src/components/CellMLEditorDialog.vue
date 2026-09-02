<template>
  <Dialog
    :visible="modelValue"
    modal
    :header="dialogTitle"
    :dismissableMask="!loading"
    :style="{ width: '80%' }"
    class="editor-dialog"
    @update:visible="onDialogVisibleChange"
  >
    <div class="editor-container">
      <div v-if="loading" class="loading">Loading CellML source...</div>

      <div v-else class="editor-wrapper">
        <CellMLTextEditor
          :key="mathRef"
          :model-value="currentModel"
          @update:code="currentModel = $event"
          @ready="handleEditorReady"
          @save="handleSave('key')"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <!-- "Apply to all" checkbox — only shown when sibling nodes exist -->
        <div
          v-if="siblingCount > 0"
          class="apply-all-checkbox"
          :title="`Also update ${siblingCount} other node${
            siblingCount !== 1 ? 's' : ''
          } using ${componentName} from ${componentFile}`"
        >
          <Checkbox v-model="applyToAll" binary inputId="applyToAll" />
          <label for="applyToAll">Apply to all instances</label>
          <Tag severity="info" :value="String(siblingCount + 1)" />
        </div>

        <div class="footer-buttons">
          <Button label="Cancel" text @click="handleCancel" />
          <Button label="Save Changes" @click="handleSave('button')" :disabled="!isDirty" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

import { useVueFlow } from '@vue-flow/core'
import CellMLTextEditor from './CellMLTextEditor.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { USER_MODULES_FILE } from '../utils/constants'
import {
  areModelsEquivalent,
  extractComponentsFromCellmlString,
  doesComponentExistInModel,
  getModelComponentNames,
  mergeModelComponents,
} from '../utils/cellml'
import { useConfirmDialog } from '../composables/useConfirmDialog'

const { alert, confirm } = useConfirmDialog()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: '',
  },
  mathRef: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'save'])

const store = useLibraryStore()
const { trackEvent } = useGtm()
const { nodes } = useVueFlow()

const loading = ref(false)
const currentModel = ref('')
const originalModel = ref('')
const applyToAll = ref(false)

const componentFile = computed(() => {
  return props.mathRef?.split(':')[0]
})

const componentName = computed(() => {
  return props.mathRef?.split(':')[1]
})

const isDirty = computed(() => {
  return !areModelsEquivalent(originalModel.value, currentModel.value)
})

const dialogTitle = computed(() => {
  return `Editing: ${props.name} (${componentName.value} - ${componentFile.value})`
})

/**
 * Count of other nodes sharing the same componentFile AND componentType.
 * Nodes from a different componentFile are never included, even if the component
 * name happens to match.
 */
const siblingCount = computed(() => {
  return siblings.value.length
})

const siblings = computed(() => {
  if (!componentName.value || !componentFile.value) return []

  return nodes.value.filter((n) => n.id !== props.id && n.data?.mathRef === props.mathRef).map((n) => n.id)
})

// Reset checkbox when dialog opens for a new node.
watch(
  () => props.modelValue,
  () => {
    applyToAll.value = false
  }
)

// ── Load content when dialog opens ──────────────────────────────────────────

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen && props.mathRef) {
      loading.value = true
      try {
        const math = store.availableMath.get(props.mathRef)
        currentModel.value = math
        originalModel.value = math
      } catch (e) {
        console.error('Failed to load source', e)
      } finally {
        loading.value = false
      }
    }
  }
)

const handleEditorReady = (canonicalMath) => {
  currentModel.value = canonicalMath
  originalModel.value = canonicalMath
}

const checkDirtyAndProceed = async (confirmAction) => {
  const confirmed = isDirty.value
    ? await confirm({
        header: 'Warning',
        message: 'You have unsaved changes. Are you sure you want to close?',
        severity: 'warning',
        acceptLabel: 'Close',
        rejectLabel: 'Cancel',
      })
    : true

  if (confirmed) {
    confirmAction()
  }
}

const onDialogVisibleChange = (visible) => {
  if (visible) {
    emit('update:modelValue', true)
    return
  }

  handleCancel()
}

const handleCancel = () => checkDirtyAndProceed(() => emit('update:modelValue', false))

// ── Save ─────────────────────────────────────────────────────────────────────
//
// Both scope: single and scope: all perform identical merge logic — the
// component is written to USER_MODULES_FILE under whatever name is in the
// editor. The only difference is which nodes get redirected in Workspace:
//   scope: single -> only the editing node
//   scope: all    -> all nodes sharing originalComponentFile + originalComponentName

const handleSave = async (source) => {
  if (source === 'key' && !isDirty.value) return

  const componentNames = getModelComponentNames(currentModel.value)
  if (!componentNames || componentNames.length === 0) {
    window.alert('Could not find a valid component name in the model.')
    return
  }
  const newComponentName = componentNames[0].trim()
  const newMathRef = `${componentFile.value}:${newComponentName}`

  try {
    const mathRefExists = store.availableMath.has(newMathRef)
    if (mathRefExists) {
      await alert({
        header: 'Name Conflict',
        message: 'Name clash detected, please rename the component in the editor before saving.',
        severity: 'error',
      })
      return
    } else {
      store.addMath(newMathRef, currentModel.value)
    }

    //   - scope 'single' with siblings: create new mathRef and update current instance
    //   - scope 'all': update math at mathRef and update mathRef (if needed)
    const updateAll = (siblingCount.value > 0 && applyToAll.value) || siblingCount.value === 0

    trackEvent('editor_action', {
      category: 'Editor',
      action: updateAll ? 'save_all' : 'save_single',
      label: newComponentName,
      file_type: 'cellml',
    })

    emit('save', {
      updateAll,
      mathRef: newMathRef,
      math: currentModel.value,
      id: props.id,
      siblings: updateAll ? siblings.value : undefined,
    })

    emit('update:modelValue', false)
  } catch (error) {
    console.error(error)
    await alert({
      header: 'Save Error',
      message: `Failed to save changes: ${error.message}`,
      severity: 'error',
    })
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

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  width: 100%;
}

.apply-all-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
  font-size: 0.875rem;
  color: var(--p-text-color);
}

.apply-all-checkbox label {
  cursor: pointer;
  user-select: none;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}
</style>
