<template>
  <el-dialog :model-value="modelValue" title="Edit Module" width="500px" teleported @closed="resetForm"
    @update:model-value="closeDialog" @mousedown.stop @wheel.stop>
    <el-form :model="editableData" label-position="left" @submit.prevent="handleConfirm">
      <el-form-item label="Module Name">
        <el-input v-model="editableData.name" placeholder="Enter module name" />
      </el-form-item>

      <el-divider />

      <label class="el-form-label">Port Labels:</label>
      <div v-if="editableData.portLabels.length > 0" class="port-header-row">
        <span class="port-type-header">Type</span>
        <span class="port-label-header">Label</span>
        <span class="port-select-header">Variable(s)</span>
        <span class="port-checkbox-header">Sum?</span>
        <span class="port-action-header"></span>
      </div>
      <div v-for="(port, index) in editableData.portLabels" :key="index" class="port-label-row">
        <el-select v-model="port.portType" class="port-type-select">
          <el-option v-for="options in portTypeOptions" :key="options.value" :label="options.label"
            :value="options.value" />
        </el-select>
        <el-input v-model="port.label" placeholder="Enter Label" class="port-label" />

        <el-select v-model="port.option" multiple collapse-tags collapse-tags-tooltip placeholder="Select Option"
          class="port-select">
          <el-option v-for="optionObj in props.portOptions" :key="optionObj.name" :label="optionObj.name"
            :value="optionObj.name" :disabled="isOptionDisabled(optionObj.name, port.option)" />
        </el-select>
        <div class="port-checkbox">
          <el-checkbox v-model="port.isMultiPortSum"></el-checkbox>
        </div>
        <el-button type="danger" :icon="Delete" circle plain @click="deletePortLabel(index)" />
      </div>

      <el-tooltip content="Add Port Label" placement="bottom" :show-after="1000">
        <el-button type="success" :icon="Plus" plain circle @click="addPortLabel" class="add-button" />
      </el-tooltip>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm"> Confirm </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElButton } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { useGtm } from '../composables/useGtm'
import { notify } from '../utils/notify'

const props = defineProps({
  // v-model for visibility
  modelValue: {
    type: Boolean,
    default: false,
  },
  // Pass the current name to edit
  initialName: {
    type: String,
    default: '',
  },
  portOptions: { type: Array, default: () => [] },
  initialPortLabels: { type: Array, default: () => [] },
  nodeId: {
    type: String,
    required: true,
  },
  existingNames: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'update:modelValue', // Required for v-model
  'confirm', // Emits the new data
])

const editableData = reactive({
  name: '',
  portLabels: [], // Will hold objects like { option: 'var_a', label: 'label_1' }
})

const portTypeOptions = [
  {
    value: 'general_ports',
    label: 'G',
  },
  {
    value: 'entrance_ports',
    label: 'I',
  },
  {
    value: 'exit_ports',
    label: 'O',
  },
]

const { trackEvent } = useGtm()

function resetForm() {
  editableData.name = props.initialName
  editableData.portLabels = JSON.parse(
    JSON.stringify(props.initialPortLabels || [])
  )
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (!editableData.name || !editableData.name.trim()) {
    notify.error({ message: 'Module name cannot be empty.' })
    return
  }

  const nameExists = props.existingNames.some(
    (name) => name === editableData.name && name !== props.initialName
  )
  if (nameExists) {
    notify.error({ message: 'A module with this name already exists.' })
    return
  }

  const finalPortLabels = editableData.portLabels.filter(
    (p) => p.option && p.label && p.label.trim()
  )

  trackEvent('edit_module_action', {
    category: 'EditModule',
    action: 'edit_module',
    label: editableData.name, // useful context
    file_type: 'JSON'
  })
  emit('confirm', {
    name: editableData.name,
    nodeId: props.nodeId,
    portLabels: finalPortLabels,
  })

  closeDialog()
}

watch(
  () => [props.initialName, , props.initialPortLabels, props.modelValue],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
  { deep: true, immediate: true }
)

const usedOptions = computed(() => {
  return new Set(
    editableData.portLabels
      .map((p) => p.option)
      .filter(Boolean)
      .flat()
  )
})

function isOptionDisabled(optionName, currentSelection) {
  // Disable if:
  // 1. It's in the usedOptions Set
  // 2. And it's NOT an option this row already has selected
  return (
    usedOptions.value.has(optionName) &&
    currentSelection.includes(optionName) === false
  )
}

function addPortLabel() {
  editableData.portLabels.push({
    portType: 'general_ports',
    option: '',
    label: '',
    isMultiPortSum: false,
  })
}

function deletePortLabel(index) {
  editableData.portLabels.splice(index, 1)
}
</script>

<style scoped>
.el-form-item {
  margin-bottom: 15px;
  /* More space */
}

.el-form-label {
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 16px;
  display: block;
}

.port-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-weight: normal;
  font-size: 14px;
}

.port-label-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.port-label-header,
.port-label {
  flex: 1;
  min-width: 150px;
}

.port-type-header,
.port-type-select {
  flex: 1;
  min-width: 60px;
}

.port-select-header,
.port-select {
  flex: 1;
  min-width: 150px;
}

.port-checkbox-header,
.port-checkbox {
  width: 50px;
  text-align: center;
  align-items: center;
}

.port-action-header {
  width: 40px;
}

.add-button {
  margin-top: 10px;
}
</style>
