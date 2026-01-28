<template>
  <el-dialog
    :model-value="modelValue"
    title="Replace Module"
    width="600px"
    teleported
    @closed="resetForm"
    @update:model-value="closeDialog"
  >
    <div style="display: flex; gap: 12px">
      <div style="flex: 1 1 0">
        <ModuleList selectable @select="onModuleSelected" />
      </div>
      <div style="width: 250px; display: flex; flex-direction: column; gap: 8px">
        <div style="font-weight: 600">Selected module</div>
        <div v-if="selectedModule">
          <div style="font-weight: 600">{{ selectedModule.name || selectedModule.filename }}</div>
          <div style="font-size: 12px; color: #666">{{ selectedModule.sourceFile || '' }}</div>
        </div>
        <el-checkbox v-model="retainMatches">Keep ports with matching names</el-checkbox>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm"> Confirm </el-button>
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

<style scoped></style>
