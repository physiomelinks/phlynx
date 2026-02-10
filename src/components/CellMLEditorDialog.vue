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
        <span v-else class="tag user"> <i class="icon-user"></i> Editable Source (User Workspace) </span>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">Cancel</el-button>

        <el-button v-if="isInternalModule" type="primary" @click="handleSave('fork')" :disabled="!isDirty">
          Save As
        </el-button>

        <el-button v-else type="primary" @click="handleSave('update')" :disabled="!isDirty"> Save Changes </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog, ElMessageBox } from 'element-plus'
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
    // Expected: { nodeId, name, sourceFile, componentName }
  },
})

const emit = defineEmits(['update:modelValue', 'save'])

const store = useBuilderStore()
const { trackEvent } = useGtm()
const loading = ref(false)
const currentCode = ref('')
const originalCode = ref('')

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

// Load Data when Dialog Opens
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
            `Failed to load the CellML source for editing.\n\nError${errors.length === 1 ? '' : 's'}:\n- ${errors.join(
              '\n- '
            )}\n\nPlease create an issue if the problem persists.`,
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
      .then(() => {
        // User clicked "OK", proceed with the action (closing)
        confirmAction()
      })
      .catch(() => {
        // User clicked "Cancel", do nothing (stay open)
      })
  } else {
    // Not dirty, proceed immediately
    confirmAction()
  }
}

const handleBeforeClose = (done) => {
  checkDirtyAndProceed(done)
}

const handleCancel = () => {
  checkDirtyAndProceed(() => {
    emit('update:modelValue', false)
  })
}

function formSaveData(componentName, modelString = null) {
  return {
    ...props.nodeData,
    code: modelString,
    componentName: componentName,
    sourceFile: USER_MODULES_FILE,
    originalSourceFile: props.nodeData.sourceFile,
    originalComponentName: props.nodeData.componentName,
    originalConfigIndex: props.nodeData.configIndex,
  }
}

/**
 * Handler for saving CellML changes.
 * The 'source' parameter determines the source of the save event it can
 * be 'fork', 'update', or 'key'. We block 'key' save events if the save buttons
 * are disabled.
 */
const handleSave = async (source) => {
  if (source === 'key' && !isDirty.value) {
    return
  }

  const mode = source === 'key' ? (isInternalModule.value ? 'fork' : 'update') : source

  try {
    // Parse the new component name from the editor content.
    const componentNames = getModelComponentNames(currentCode.value)
    if (!componentNames || componentNames.length === 0) {
      ElMessageBox.alert('Could not find a valid component name in the code.', 'Parse Error', { type: 'error' })
      return
    }
    const newName = componentNames[0].trim()
    const currentName = props.nodeData.componentName

    // Fetch existing User Modules to check for collisions.
    const existingModelString = await store.getModuleContent(USER_MODULES_FILE)
    const nameExists = doesComponentExistInModel(existingModelString, newName)

    // Validation Logic.
    if (mode === 'fork') {
      // FORK: Name must be unique. Period.
      if (nameExists) {
        ElMessageBox.alert(
          `A component named "${newName}" already exists. Please rename the component in the code before forking.`,
          'Name Conflict',
          { type: 'error' }
        )
        return
      }
    } else {
      // UPDATE: Name must be unique if renaming.
      // If we are renaming (newName !== currentName), the *target* name must not be taken by someone else.
      // If we are just saving in place (newName === currentName), existence is expected.
      if (newName !== currentName && nameExists) {
        ElMessageBox.alert(
          `Cannot rename to "${newName}" because a component with that name already exists.`,
          'Name Conflict',
          { type: 'error' }
        )
        return
      }
    }

    // Merge Logic
    // If updating, we pass 'currentName' so the merger knows what to replace/remove.
    // If forking, we pass undefined so the merger just appends the new one.
    const oldNameForMerge = mode === 'update' ? currentName : undefined

    const mergedModelString = mergeModelComponents(existingModelString, currentCode.value, newName, oldNameForMerge)

    if (!mergedModelString) {
      throw new Error('Merge operation returned empty string.')
    }

    // Analytics & Events
    trackEvent('editor_action', {
      category: 'Editor',
      action: mode === 'fork' ? 'fork_save' : 'save',
      label: newName,
      file_type: 'cellml',
    })

    emit('save', formSaveData(newName, mergedModelString))

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
</style>
