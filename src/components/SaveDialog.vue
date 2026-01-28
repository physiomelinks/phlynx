<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="400px"
    teleported
    @closed="resetForm"
    @update:model-value="closeDialog"
    @mousedown.stop
    @wheel.stop
  >
    <el-form
      label-position="top"
      @submit.prevent="handleConfirm"
    >
      <el-form-item label="Filename">
        <el-input v-model="fileName">
          <template #append>{{ suffix }}</template>
        </el-input>
      </el-form-item>
    </el-form>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm">
          Save
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElButton } from 'element-plus'
import { notify} from '../utils/notify'
import { useGtm } from '../composables/useGtm'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Save Workflow',
  },
  suffix: {
    type: String,
    default: '.json',
  },
  defaultName: {
    type: String,
    default: 'PhLynx',
  }
})

const emit = defineEmits([
  'update:modelValue',
  'confirm' 
])

const { trackEvent } = useGtm()
const fileName = ref(props.defaultName)

function resetForm() {
  fileName.value = props.defaultName
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (!fileName.value || !fileName.value.trim()) {
    notify.error({message: "Filename cannot be empty."})
    return
  }
  
  trackEvent('save_dialog_action', {
    category: 'SaveDialog',
    action: 'confirm',
    label: `Filename: ${fileName.value}${props.suffix}`, // useful context
    file_type: 'json'
  })
  emit('confirm', fileName.value)
  closeDialog()
}

// Reset the form to the default name every time it's opened
watch(() => props.modelValue, (isVisible) => {
  if (isVisible) {
    resetForm()
  }
})
</script>
