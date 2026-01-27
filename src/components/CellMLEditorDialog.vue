<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="80%"
    :before-close="handleBeforeClose"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <div class="editor-container">
      <div v-if="loading" class="loading">Loading CellML source...</div>

      <div v-else class="editor-wrapper">
        <CellMLTextEditor v-model="currentCode" :regenerate-on-change="modelValue"/>
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

        <el-button v-if="isInternalModule" type="primary" @click="showSaveAsPrompt = true" :disabled="!isDirty">
          Save As
        </el-button>

        <el-button v-else type="primary" @click="handleDirectSave" :disabled="!isDirty"> Save Changes </el-button>
      </span>
    </template>

    <el-dialog v-model="showSaveAsPrompt" title="Save Copy As" width="30%" append-to-body>
      <p>This is a standard library module. To save changes, please give your new component a name:</p>
      <el-input v-model="newComponentName" placeholder="MyCustomComponent" />
      <template #footer>
        <el-button @click="showSaveAsPrompt = false">Cancel</el-button>
        <el-button type="primary" :disabled="haveInvalidNewComponentName" @click="handleForkSave"
          >Create Copy</el-button
        >
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElButton, ElDialog, ElMessageBox, ElInput } from 'element-plus'
import CellMLTextEditor from './CellMLTextEditor.vue'
import { useBuilderStore } from '../stores/builderStore'
import { USER_MODULES_FILE } from '../utils/constants'
import {
  areModelsEquivalent,
  createEditableModelFromSourceModelAndComponent,
  doesComponentExistInModel,
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

const emit = defineEmits(['update:modelValue', 'save-fork', 'save-update'])

const store = useBuilderStore()
const loading = ref(false)
const currentCode = ref('')
const originalCode = ref('')
const showSaveAsPrompt = ref(false)
const newComponentName = ref('')

const haveInvalidNewComponentName = computed(() => {
  return !newComponentName.value || newComponentName.value.trim().length === 0
})

const isInternalModule = computed(() => {
  const sourceFile = props.nodeData.sourceFile
  return !!sourceFile && sourceFile !== USER_MODULES_FILE
})

const isDirty = computed(() => {
  return !areModelsEquivalent(originalCode.value, currentCode.value);
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
        const xml = createEditableModelFromSourceModelAndComponent(modelString, newData.componentName)
        currentCode.value = xml
        originalCode.value = xml

        // Pre-fill a name for "Save As" (e.g., "sodium_channel_custom")
        newComponentName.value = `${newData.componentName}_custom`
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
    nodeId: props.nodeData.nodeId,
    code: modelString,
    componentName: componentName,
    sourceFile: USER_MODULES_FILE,
  }
}

const handleDirectSave = async () => {
  // Emit event to save over the EXISTING file
  const componentName = props.nodeData.componentName
  const modelString = await store.getModuleContent(USER_MODULES_FILE)
  const mergedModelString = mergeModelComponents(modelString, currentCode.value, componentName)
  if (!mergedModelString) {
    ElMessageBox.alert(
      `Failed to merge changes into User Modules.`,
      'Save Error',
      { type: 'error' }
    )
    return
  }
  emit('save-update', formSaveData(componentName, mergedModelString))
  emit('update:modelValue', false)
}

const handleForkSave = async () => {
  // Validate name.
  const trimmedComponentName = newComponentName.value.trim()
  const modelString = await store.getModuleContent(USER_MODULES_FILE)
  if (doesComponentExistInModel(modelString, trimmedComponentName)) {
    ElMessageBox.alert(
      `A component named "${trimmedComponentName}" already exists in your User Modules. Please choose a different name.`,
      'Name Conflict',
      { type: 'error' }
    )
    return
  }

  const mergedModelString = mergeModelComponents(modelString, currentCode.value, trimmedComponentName)
  if (!mergedModelString) {
    ElMessageBox.alert(
      `Failed to merge new component into User Modules.`,
      'Save Error',
      { type: 'error' }
    )
    return
  }

  emit('save-fork', formSaveData(trimmedComponentName, mergedModelString))
  showSaveAsPrompt.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped>
.tag.internal {
  color: orange;
  font-weight: bold;
}
.tag.user {
  color: green;
  font-weight: bold;
}
</style>
