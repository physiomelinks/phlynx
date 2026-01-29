<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title || 'Import File'"
    width="500px"
    @closed="closeDialog"
    @update:model-value="closeDialog"
    :close-on-click-modal="!isLoading"
    :close-on-press-escape="!isLoading"
    :show-close="!isLoading"
  >
    <div
      v-loading="isLoading"
      :element-loading-text="loadingText"
      :element-loading-svg="phlynxspinner"
      element-loading-svg-view-box="0, 0, 100, 100"
      element-loading-background="rgba(255, 255, 255, 0.9)"
    >
      <el-form label-position="top">
        <div class="form-header" v-if="requiredFieldsCount > 0">
    <span style="color: var(--el-color-danger)">*</span> Indicates required field
  </div>
        <div v-for="field in displayFields" :key="field.key" class="field-container">
          <el-form-item :label="field.label" :required="field?.required ?? true">
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

              <el-icon v-if="formState[field.key]?.isValid" color="#67C23A" size="20">
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
            <template #default> All necessary modules and configurations are available. </template>
          </el-alert>

          <el-alert v-else title="Additional Files Required" type="warning" :closable="false" show-icon>
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
              <br />
              <div v-if="validationStatus.needsConfigFile">
                <strong>NOTE:</strong> CellML Module File(s) may be required after providing the configurations.
              </div>
            </template>
          </el-alert>
        </div>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog" :disabled="isLoading">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!isFormValid || isLoading" :loading="isLoading">
          Import
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElButton, ElUpload, ElAlert, ElIcon } from 'element-plus'
import { Check } from '@element-plus/icons-vue'

import { useBuilderStore } from '../stores/builderStore'
import { useGtm } from '../composables/useGtm'
import { notify } from '../utils/notify'
import { IMPORT_KEYS } from '../utils/constants'
import { createDynamicFields, validateVesselData } from '../utils/import'
import { processModuleData } from '../utils/cellml'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

const props = defineProps({
  modelValue: Boolean,
  config: {
    type: Object,
    required: true,
    default: () => ({ title: '', fields: [] }),
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const { trackEvent } = useGtm()
const builderStore = useBuilderStore()

// --- State Management ---
const formState = reactive({})
const dynamicFields = ref([])
const validationStatus = ref(null)
const isLoading = ref(false)
const loadingText = ref('Loading...')
const stagedFiles = ref({
  moduleFiles: [], // { filename: string, payload: object }
  configFiles: [], // { filename: string, payload: object }
})

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
  stagedFiles.value = {
    moduleFiles: [],
    configFiles: [],
  }
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

const requiredFieldsCount = computed(() => {
  return displayFields.value.filter((field) => field.required !== false).length
})

const addDynamicFields = async (validation) => {
  try {
    const newFields = createDynamicFields(validation)

    // Merge new fields with existing ones
    const existingKeys = new Set(dynamicFields.value.map((f) => f.key))

    newFields.forEach((newField) => {
      if (!existingKeys.has(newField.key)) {
        dynamicFields.value.push(newField)

        // Initialize form state for new field
        if (!formState[newField.key]) {
          formState[newField.key] = createEmptyFieldState()
        }
      }
    })
  } catch (error) {
    console.error('Failed to create dynamic fields:', error)
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

// Create a temporary store-like object for validation that includes staged files
const createValidationStore = () => {
  // Create a deep copy of availableModules
  const availableModules = JSON.parse(JSON.stringify(builderStore.availableModules))

  // Apply staged config files
  stagedFiles.value.configFiles.forEach(({ filename, payload }) => {
    const configs = payload
    configs.forEach((config) => {
      let moduleFile = availableModules.find((f) => f.filename === config.module_file)
      if (!moduleFile) {
        moduleFile = {
          filename: config.module_file,
          modules: [],
          isStub: true,
        }
        availableModules.push(moduleFile)
      }
      let module = moduleFile.modules.find((m) => m.name === config.module_type || m.type === config.module_type)
      if (!module) {
        module = {
          name: config.module_type,
          componentName: config.module_type,
          configs: [],
        }
        moduleFile.modules.push(module)
      }
      if (!module.configs) {
        module.configs = []
      }
      const configWithMetadata = {
        ...config,
        _sourceFile: filename,
        _loadedAt: new Date().toISOString(),
      }
      const existingConfigIndex = module.configs.findIndex(
        (c) => c.BC_type === config.BC_type && c.vessel_type === config.vessel_type
      )
      if (existingConfigIndex !== -1) {
        module.configs[existingConfigIndex] = configWithMetadata
      } else {
        module.configs.push(configWithMetadata)
      }
    })
  })

  // Apply staged module files
  stagedFiles.value.moduleFiles.forEach(({ filename, payload }) => {
    const existingFile = availableModules.find((f) => f.filename === filename)

    if (existingFile) {
      if (existingFile.isStub) {
        delete existingFile.isStub
      }
      if (existingFile.modules) {
        payload.modules.forEach((newMod) => {
          const oldMod = existingFile.modules.find((m) => m.name === newMod.name)
          if (oldMod && oldMod.configs && oldMod.configs.length > 0) {
            newMod.configs = oldMod.configs
          }
        })
      }
      Object.assign(existingFile, payload)
    } else {
      availableModules.push(payload)
    }
  })

  return { availableModules }
}

// --- Computed Validation ---
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
  if (field.requiresStore && builderStore) {
    return field.parser(rawFile, builderStore)
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
    let validation = parsed?.validation ?? null

    state.payload = { data, fileName: rawFile.name }
    state.validation = validation
    state.warnings = warnings

    // Specific logic for Dynamic Files (Configs/Modules)
    if (field.processUpload) {
      await stageFile(field, parsed, rawFile.name)

      // Re-validate vessel if needed
      if (formState[IMPORT_KEYS.VESSEL]?.payload) {
        const validationStore = createValidationStore()
        const newValidation = validateVesselData(formState[IMPORT_KEYS.VESSEL].payload.data, validationStore)
        validation = newValidation
      }
    }

    // Vessel-specific validation
    if (field.key === IMPORT_KEYS.VESSEL && validation) {
      await updateVesselValidation(validation)
    }

    // Surface warnings (notifications only once)
    state.warnings.forEach(async (w) => {
      await nextTick()
      notify.warning({
        title: 'Import Warning',
        message: w,
      })
    })

    state.isValid = true
  } catch (error) {
    state.isValid = false
    state.payload = null
    state.warnings = []

    trackEvent('import_action', {
      category: 'Import',
      action: 'import_error',
      label: field.key || 'unknown_field', // useful context
      file_type: 'various',
    })
    notify.error({
      title: 'Import Error',
      message: error.message || 'Failed to parse file.',
    })
  }
}

async function updateVesselValidation(validation) {
  validationStatus.value = validation
  if (validation.isComplete) {
    return
  }
  await addDynamicFields(validation)
}

async function stageFile(field, parsedData, fileName) {
  if (!field.processUpload) return
  const data = parsedData.data || parsedData

  // Stage the file instead of adding directly to store
  if (field.processUpload === 'cellml') {
    // Parse the module data to get the proper structure
    const result = processModuleData(data)
    if (result.type === 'success') {
      const augmentedData = result.data.map((item) => ({
        ...item,
        sourceFile: fileName,
      }))
      stagedFiles.value.moduleFiles.push({
        filename: fileName,
        payload: {
          filename: fileName,
          modules: augmentedData,
          model: result.model,
        },
      })
    }
  } else if (field.processUpload === 'config') {
    stagedFiles.value.configFiles.push({
      filename: fileName,
      payload: data,
    })
  }
  formState[field.key].isValid = true

  // Re-validate the Vessel CSV with staged files
  const vesselField = formState[IMPORT_KEYS.VESSEL]
  if (vesselField?.payload?.data) {
    const validationStore = createValidationStore()
    const newValidation = validateVesselData(vesselField.payload.data, validationStore)
    formState[IMPORT_KEYS.VESSEL].validation = newValidation
    updateVesselValidation(newValidation)
  }
  notify.success({
    title: field.processUpload === 'cellml' ? 'CellML File Staged' : 'Config Staged',
    message: `${fileName} ready to import`,
    duration: 3000,
  })
}

const commitStagedFiles = () => {
  stagedFiles.value.moduleFiles.forEach(({ filename, payload }) => {
    builderStore.addModuleFile(payload)
  })
  stagedFiles.value.configFiles.forEach(({ filename, payload }) => {
    builderStore.addConfigFile(payload, filename)
  })
}

const handleConfirm = async () => {
  isLoading.value = true
  loadingText.value = 'Importing modules...'

  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))

  commitStagedFiles()
  if (formState[IMPORT_KEYS.PARAMETER]?.isValid) {
    const paramState = formState[IMPORT_KEYS.PARAMETER]
    const { fileName, data } = paramState.payload

    const vesselState = formState[IMPORT_KEYS.VESSEL]
    const vesselData = vesselState?.payload?.data

    if (fileName && data && vesselData) {
      builderStore.addParameterFile(fileName, data)

      const fileLinkMap = new Map(builderStore.fileParameterMap)
      const fileTypeMap = new Map(builderStore.fileAssignmentTypeMap || [])

      const involvedCellMLFiles = new Set()
      vesselData.forEach((vessel) => {
        const config = builderStore.getConfigForVessel(vessel.vessel_type, vessel.BC_type)
        if (config?.filename) {
          involvedCellMLFiles.add(config.filename)
        }
      })

      involvedCellMLFiles.forEach((cellmlFile) => {
        fileLinkMap.set(cellmlFile, fileName)
        fileTypeMap.set(cellmlFile, 'imported')
      })

      builderStore.applyFileParameterLinks(fileLinkMap, fileTypeMap)
    }
  }

  const result = {}
  displayFields.value.forEach((field) => {
    result[field.key] = formState[field.key].payload
  })

  trackEvent('import_action', {
    category: 'Import',
    action: 'import_file',
    label: props.config.title || 'Import File', // useful context
    file_type: 'various',
  })
  emit('confirm', result, (progressText) => {
    loadingText.value = progressText
  })
}

const closeDialog = () => {
  if (isLoading.value) return
  resetForm()
  loadingText.value = 'Loading...'
  emit('update:modelValue', false)
}

defineExpose({
  finishLoading: () => {
    isLoading.value = false
    closeDialog()
  },
})
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
  color: #e6a23c;
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

@keyframes breathe {
  0%,
  100% {
    transform: scale(0.95);
  }
  50% {
    transform: scale(1.05);
  }
}

:deep(.el-loading-spinner svg) {
  width: 120px;
  height: 120px;
  animation: breathe 2s ease-in-out infinite !important;
  transform-origin: center;
}

:deep(.el-loading-spinner) {
  transform: translateY(-35%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

:deep(.el-loading-text) {
  color: #000000ce;
  font-size: 16px;
  margin-top: 12px;
}

.form-header {
  margin-bottom: 16px;       /* Add spacing before the first input field */
  font-size: 13px;           /* Slightly smaller than label text */
  color: var(--el-text-color-secondary); /* Use Element Plus muted text color */
  text-align: right;         /* Aligns it to the right side (optional but recommended) */
}
</style>
