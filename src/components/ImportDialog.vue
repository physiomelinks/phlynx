<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title || 'Import File'"
    width="500px"
    @closed="resetForm"
    @update:model-value="closeDialog"
  >
    <el-form label-position="top">
      <div
        v-for="field in displayFields"
        :key="field.key"
        class="field-container"
      >
        <el-form-item :label="field.label" :required="field.required || true">
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
        </el-form-item>
      </div>

      <div v-if="validationStatus && formState[IMPORT_KEYS.VESSEL]?.isValid" class="validation-status">
        <el-alert
          v-if="validationStatus.isComplete"
          title="All Required Resources Available"
          type="success"
          :closable="false"
          show-icon
        >
          <template #default>
            All necessary modules and configurations are available.
          </template>
        </el-alert>

        <el-alert
          v-else
          title="Additional Files Required"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #default>
            <div>Please provide the following files to complete the import:</div>
            <ul class="missing-resources">
              <li v-if="validationStatus.needsModuleFile">
                <strong>CellML Module File</strong> containing:
                {{ validationStatus.missingResources?.moduleTypes?.join(', ') }}
              </li>
              <li v-if="validationStatus.needsConfigFile">
                <strong>Module Configurations</strong> for vessel_types:bc_types: 
                {{ validationStatus.missingResources?.configs?.join(', ') }} and possibly CellML modules.
              </li>
            </ul>
            <br>
            <div v-if="validationStatus.needsConfigFile">
                <strong>NOTE:</strong> CellML Module File(s) may be required after providing the configurations.
            </div>
          </template>
        </el-alert>
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
import { reactive, computed, watch, ref, nextTick } from 'vue'
import { ElNotification } from 'element-plus'
import { Check, Warning } from '@element-plus/icons-vue'
import { IMPORT_KEYS } from '../utils/constants'

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
   * parser: Function   // (File, builderStore?) => Promise<Data>
   * requiresStore: Boolean // whether parser needs builderStore
   * }
   * ]
   * }
   */
  config: {
    type: Object,
    required: true,
    default: () => ({ title: '', fields: [] }),
  },
  builderStore: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// --- State Management ---
// We store the state of each field keyed by its 'key'
// Structure: { [key]: { fileName: string, isValid: boolean, data: any, warnings: array } }
const formState = reactive({})
const dynamicFields = ref([])
const validationStatus = ref(null)

function resetFormState() {
  Object.keys(formState).forEach((key) => {
    formState[key] = createEmptyFieldState()
  })
  dynamicFields.value = []
  validationStatus.value = null
}

function initFormFromConfig(fields = []) {
  fields.forEach((field) => {
    if (!formState[field.key]) {
      formState[field.key] = createEmptyFieldState()
    }
  })
}

const resetForm = () => {
  resetFormState()
}

// Initialize formState when config changes
watch(
  () => props.config?.fields,
  (fields) => {
    resetFormState()
    initFormFromConfig(fields)
  },
  { immediate: true }
)

// --- Dynamic Fields Handling ---
const displayFields = computed(() => {
  const baseFields = props.config.fields || []
  return [...baseFields, ...dynamicFields.value]
})

const addDynamicFields = async (validation) => {
  try {
    const { createDynamicFields } = await import('../utils/import')
    const newFields = createDynamicFields(validation)
    
    if (JSON.stringify(newFields) !== JSON.stringify(dynamicFields.value)) {
      dynamicFields.value = newFields
      dynamicFields.value.forEach((field) => {
        if (!formState[field.key]) {
          formState[field.key] = createEmptyFieldState()
        }
      })
    }
  } catch (error) {
    console.error("Failed to create dynamic fields:", error)
  }
}

function createEmptyFieldState() {
  return {
    fileName: null,
    isValid: false,
    payload: null,
    warnings: [],
    validation: null,
  }
}

// --- Computed Validation ---
// Form is valid only if ALL fields in the config are valid
const isFormValid = computed(() => {
  if (!displayFields.value || displayFields.value.length === 0) return false

  if (props.config?.fields?.[0]?.key === IMPORT_KEYS.VESSEL) {
    const vesselState = formState[IMPORT_KEYS.VESSEL]
    if (!vesselState?.isValid) return false
  }

  return displayFields.value.every((field) => {
    if (field.required === false) return true
    return formState[field.key]?.isValid
  })
})

// --- Handlers ---
async function parseFile(field, rawFile) {
  if (field.requiresStore && props.builderStore) {
    return field.parser(rawFile, props.builderStore)
  }
  return field.parser(rawFile)
}

const handleFileChange = async (uploadFile, field) => {
  const rawFile = uploadFile.raw
  const state = formState[field.key]

  state.fileName = rawFile.name
  state.isValid = false
  state.payload = null

  try {
    const parsed = await parseFile(field, rawFile)

    // Normalize parser output
    const data = parsed?.data ?? parsed
    const warnings = parsed?.warnings ?? []
    const validation = parsed?.validation ?? null

    state.payload = { data, fileName: rawFile.name }
    state.validation = validation
    state.warnings = warnings

    // Specific logic for Dynamic Files (Configs/Modules)
    if (field.processUpload) {
      await processPostUpload(field, parsed, rawFile.name)
      
      // Re-validate vessel if needed
      if (formState[IMPORT_KEYS.VESSEL]?.payload) {
         const { validateVesselData } = await import('../utils/import')
         const newValidation = validateVesselData(
           formState[IMPORT_KEYS.VESSEL].payload.data,
           props.builderStore
         )
         // Only update status to reflect checks
         validation = newValidation
      }
    }

    // Vessel-specific validation
    if (field.key === IMPORT_KEYS.VESSEL && validation){
      await updateVesselValidation(validation)
    }

    // Surface warnings (notifications only once)
    state.warnings.forEach((w) => {
      ElNotification.warning({
        title: 'Import Warning',
        message: w,
        duration: 5000,
      })
    })

    state.isValid = true
  } catch (error) {
    state.isValid = false
    state.payload = null
    state.warnings = []

    // TO-DO: remove the selected file from the builderStore if it's been added

    ElNotification.error({
      title: 'Import Error',
      message: error.message || 'Failed to parse file.',
      duration: 6000,
    })
  }
}

async function updateVesselValidation(validation) {
  validationStatus.value = validation

  if (validation.isComplete) {
    dynamicFields.value = []
    ElNotification.success({
      title: 'All Resources Available',
      message: 'All required modules and configurations are now loaded!',
      duration: 3000,
    })
    return
  }

  await addDynamicFields(validation)
}

async function processPostUpload(field, parsedData, fileName) {
  if (!field.processUpload || !props.builderStore) return

  const { processUploadedFile, validateVesselData } = await import('../utils/import')

  // Add the new file to the store
  const result = await processUploadedFile(
    field.processUpload,
    parsedData,
    fileName,
    props.builderStore
  )

  formState[field.key].isValid = true

  // Re-validate the Vessel CSV now that the store has new data (Config/CellML)
  const vesselField = formState[IMPORT_KEYS.VESSEL]
  
  if (vesselField?.payload?.data) {
    const newValidation = validateVesselData(
      vesselField.payload.data, 
      props.builderStore
    )

    // Update the UI state with the fresh result
    formState[IMPORT_KEYS.VESSEL].validation = newValidation
    await nextTick()
    updateVesselValidation(newValidation)

    // If valid now, we can clear the error styling/messages
    if (newValidation.isComplete) {
      console.log('Vessel data is now fully valid.')
    }
  }

  ElNotification.success({
    title: field.processUpload === 'cellml'
      ? 'CellML File Added'
      : 'Config Added',
    message: result.message,
    duration: 3000,
  })
}

const handleConfirm = () => {
  // Construct the result object
  const result = {}
  displayFields.value.forEach((field) => {
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
  width: 320px;
}
.warning-text {
  font-size: 12px;
  color: #E6A23C;
  margin-top: 4px;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.warning-text div {
  flex: 1;
}
.field-container {
  margin-bottom: 20px;
}
.validation-status {
  margin-top: 20px;
  margin-bottom: 10px;
}
.missing-resources {
  margin: 8px 0 0 0;
  padding-left: 20px;
}
.missing-resources li {
  margin: 4px 0;
}
</style>