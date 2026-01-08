<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title || 'Import File'"
    width="450px"
    @closed="resetForm"
    @update:model-value="closeDialog"
  >
    <el-form label-position="top">
      <div
        v-for="field in config.fields"
        :key="field.key"
        class="field-container"
      >
        <el-form-item :label="field.label" :required="true">
          <div class="upload-row">
            <el-upload
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :accept="field.accept"
              :on-change="(file) => handleFileChange(file, field)"
            >
              <el-input
                :model-value="formState[field.key]?.fileName"
                :placeholder="field.placeholder || 'Select file...'"
                class="file-input"
                readonly
              >
              </el-input>
              <el-button type="success">Browse</el-button>
            </el-upload>

            <el-icon
              v-if="formState[field.key]?.isValid"
              color="#67C23A"
              size="20"
            >
              <Check />
            </el-icon>
          </div>

          <div v-if="field.helpText" class="help-text">
            {{ field.helpText }}
          </div>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :disabled="!isFormValid"
        >
          Import
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'
import { ElNotification } from 'element-plus'
import { Check } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  /**
   * config object structure:
   * {
   * title: String,
   * fields: [
   * {
   * key: String,       // unique ID for output
   * label: String,
   * accept: String,    // e.g. '.json'
   * parser: Function   // (File) => Promise<Data>
   * }
   * ]
   * }
   */
  config: {
    type: Object,
    required: true,
    default: () => ({ title: '', fields: [] }),
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// --- State Management ---
// We store the state of each field keyed by its 'key'
// Structure: { [key]: { fileName: string, isValid: boolean, data: any } }
const formState = reactive({})

const resetForm = () => {
  // Clear all keys
  Object.keys(formState).forEach((k) => {
    formState[k] = { fileName: null, isValid: false, payload: null }
  })
}

// Initialize formState when config changes
watch(
  () => props.config,
  (newConfig) => {
    resetForm()
    if (newConfig?.fields) {
      newConfig.fields.forEach((f) => {
        formState[f.key] = { fileName: null, isValid: false, payload: null }
      })
    }
  },
  { immediate: true }
)

// --- Computed Validation ---
// Form is valid only if ALL fields in the config are valid
const isFormValid = computed(() => {
  if (!props.config.fields || props.config.fields.length === 0) return false
  return props.config.fields.every((field) => formState[field.key]?.isValid)
})

// --- Handlers ---

const handleFileChange = async (uploadFile, fieldConfig) => {
  const rawFile = uploadFile.raw
  const state = formState[fieldConfig.key]

  state.fileName = rawFile.name
  state.isValid = false // Reset validity while processing

  try {
    // Run the parser function provided in the config
    // We expect the parser to return a Promise that resolves with data or rejects
    const parsedData = await fieldConfig.parser(rawFile)

    state.payload = { data: parsedData, fileName: state.fileName }
    state.isValid = true
  } catch (error) {
    ElNotification.error({
      title: 'Import Error',
      message: error.message || 'Failed to parse file.',
    })
    state.isValid = false
    state.payload = null
  }
}

const handleConfirm = () => {
  // Construct the result object
  const result = {}
  props.config.fields.forEach((field) => {
    result[field.key] = formState[field.key].payload
  })

  emit('confirm', result)
  closeDialog()
}

const closeDialog = () => emit('update:modelValue', false)
</script>

<style scoped>
.upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-input {
  width: 300px; /* Or flex: 1 */
}
.help-text {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.field-container {
  margin-bottom: 15px;
}
</style>
