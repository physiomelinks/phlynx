<template>
  <el-dialog
    :model-value="modelValue"
    title="Replace Module"
    width="700px"
    teleported
    @closed="resetForm"
    @update:model-value="closeDialog"
  >
    <div class="container">
      <div class="module-list-wrapper">
        <ModuleList selectable @select="onModuleSelected" />
      </div>

      <div class="sidebar">
        <div class="sidebar-title">
          Selected module
        </div>

        <div v-if="selectedModule" class="selected-module">
          <div class="selected-name">
            {{ selectedModule.name || selectedModule.filename }}
          </div>

          <div class="selected-file">
            {{ selectedModule.sourceFile || '' }}
          </div>
        </div>

        <div v-else class="no-selection">
          Select a module from the list
        </div>

        <el-checkbox v-model="retainMatches" class="retain-checkbox">
          Keep ports with matching names
        </el-checkbox>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" :disabled="!selectedModule" @click="handleConfirm">
          Confirm
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElCheckbox, ElButton } from 'element-plus'

import ModuleList from './ModuleList.vue'
import { useGtm } from '../composables/useGtm'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  modules: {
    type: Array,
    default: () => [],
  },
  portOptions: {
    type: Array,
    default: () => [],
  },
  portLabels: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'update:modelValue', // Required for v-model
  'confirm', // Emits the new data
])

const selectedModule = ref(null)
const retainMatches = ref(false)
const { trackEvent } = useGtm()

function resetForm() {
  selectedModule.value = null
  retainMatches.value = false
}

function closeDialog() {
  emit('update:modelValue', false)
}

function onModuleSelected(module) {
  selectedModule.value = module
}

function handleConfirm() {
  const moduleVariables = selectedModule.value.portOptions || []

  const finalPortLabels = retainMatches.value
    ? moduleVariables
        .map((newPort) => {
          const match = props.portLabels.find((oldPort) => oldPort.option === newPort.name)
          return match ? { option: newPort.name, label: match.label } : null
        })
        .filter(Boolean)
    : []

  trackEvent('module_replacement_action', {
    category: 'ModuleReplacement',
    action: 'confirm',
    label: `Module: ${selectedModule.value.componentName}`, // useful context
    file_type: 'json',
  })

  emit('confirm', {
    componentName: selectedModule.value.componentName,
    sourceFile: selectedModule.value.sourceFile,
    portLabels: finalPortLabels,
    portOptions: moduleVariables,
  })

  closeDialog()
}
</script>

<style scoped>
.container {
  display: flex;
  gap: 12px;
  height: 460px;
  overflow: hidden;
}

.module-list-wrapper {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.sidebar-title {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #909399;
}

.selected-module {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.selected-name {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-file {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-selection {
  font-size: 13px;
  color: #c0c4cc;
  font-style: italic;
}

.retain-checkbox {
  margin-top: auto;
}
</style>
