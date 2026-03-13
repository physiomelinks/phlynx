<template>
  <el-dialog :model-value="modelValue" title="Edit Module" width="700px" teleported @closed="resetForm"
    @update:model-value="closeDialog" @mousedown.stop @wheel.stop>
    <el-form :model="editableData" label-position="left" @submit.prevent="handleConfirm">
      <el-form-item label="Module Name">
        <el-input v-model="editableData.name" placeholder="Enter module name" />
      </el-form-item>

     <el-divider />

      <label class="el-form-label">Port Labels:</label>
      <el-table
        :data="editableData.portLabels"
        style="width: 100%; margin-top: 10px"
        empty-text="No port labels added"
      >
        <!-- Type -->
        <el-table-column label="Type" width="80">
          <template #default="scope">
            <el-select v-model="scope.row.portType" size="small">
              <el-option
                v-for="option in portTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </template>
        </el-table-column>

        <!-- Label -->
        <el-table-column label="Label" width="250">
          <template #default="scope">
            <el-input
              v-model="scope.row.label"
              size="small"
              placeholder="Enter label"
            />
          </template>
        </el-table-column>

        <!-- Variables -->
        <el-table-column label="Variable(s)" min-width="150">
          <template #default="scope">
            <el-select
              v-model="scope.row.option"
              multiple
              collapse-tags
              collapse-tags-tooltip
              size="small"
              placeholder="Select variables"
              style="width: 100%"
            >
              <el-option
                v-for="option in props.portOptions"
                :key="option.name"
                :label="option.name"
                :value="option.name"
                :disabled="isOptionDisabled(option.name, scope.row.option)"
              />
            </el-select>
          </template>
        </el-table-column>

        <!-- Multiport -->
        <el-table-column label="Multiport" width="100">
          <template #default="scope">
            <el-select
              v-model="scope.row.multiport"
              size="small"
              placeholder="Select"
            >
              <el-option
                v-for="option in multiportOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                :disabled="option.value === 'Sum' && scope.row.option?.length > 1"
              />
            </el-select>
          </template>
        </el-table-column>

        <!-- Delete -->
        <el-table-column label="" width="60" align="center">
          <template #default="scope">
            <el-button
              type="danger"
              :icon="Delete"
              circle
              plain
              size="small"
              @click="deletePortLabel(scope.$index)"
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- Add Button -->
      <div style="margin-top: 12px">
        <el-tooltip content="Add Port Label" placement="bottom" :show-after="1000">
          <el-button
            type="success"
            :icon="Plus"
            plain
            circle
            @click="addPortLabel"
          />
        </el-tooltip>
      </div>
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
import { sanitiseModuleName } from '../utils/nodes'

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

const multiportOptions = [
  {
    value: 'True',
    label: 'True',
  },
  {
    value: 'Sum',
    label: 'Sum',
  },
  {
    value: 'None',
    label: 'None',
  },
]

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

  const sanitisedName = sanitiseModuleName(editableData.name)
  if (!sanitisedName) {
    notify.error({ message: 'Module name is not valid.' })
    return
  }
  editableData.name = sanitisedName

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

watch(
  () => editableData.portLabels.map(p => p.option),
  (newOptions) => {
    newOptions.forEach((opt, i) => {
      if (opt?.length > 1 && editableData.portLabels[i].multiport === 'Sum') {
        editableData.portLabels[i].multiport = 'None'
      }
    })
  },
  { deep: true }
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

  // FIXME: Disabling for now as circ auto configs have multiple ports with same variable options, and this logic would prevent that. We can revisit if we want to enforce unique variable options across ports in the future.
  // return (usedOptions.value.has(optionName) && currentSelection.includes(optionName) === false)
  return false
}

function addPortLabel() {
  editableData.portLabels.push({
    portType: 'general_ports',
    option: '',
    label: '',
    multiport: 'None',
  })
}

function deletePortLabel(index) {
  editableData.portLabels.splice(index, 1)
}
</script>

<style scoped>
.el-form-item {
  margin-bottom: 15px;
}

.el-form-label {
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 16px;
  display: block;
}
</style>
