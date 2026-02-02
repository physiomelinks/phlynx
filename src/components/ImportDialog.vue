<template>
  <el-dialog
    :model-value="modelValue"
    :title="config.title || 'Import File'"
    width="500px" @closed="closeDialog"
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
      element-loading-background="var(--el-mask-color-extra-light)"
    >
      <el-form label-position="top" :class="{ 'is-loading-content': isLoading }">
        <div class="form-header" v-if="requiredFieldsCount > 0">
          <span class="required-asterisk">*</span> Indicates required field
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

              <el-icon v-if="isFieldValid(field.key)" color="var(--el-color-success)" size="20">
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
                <li v-if="validationStatus.needsModuleFile" class="config-note">
                  <strong>CellML Module File</strong>
                  <div 
                    v-if="validationStatus.missingResources?.moduleFileIssues?.length > 0" 
                    class="issue-list-container"
                  >
                    <div
                      v-for="moduleFileIssue in validationStatus.missingResources.moduleFileIssues"
                      :key="moduleFileIssue.uniqueKey"
                      class="module-issue-item"
                    >
                      • {{ moduleFileIssue.message }}
                    </div>
                  </div>
                  <div 
                    v-else-if="validationStatus.missingResources?.moduleTypes?.length > 0"
                    class="module-type-list"
                  >
                    containing: {{ validationStatus.missingResources.moduleTypes.join(', ') }}
                  </div>
                </li>
                <li v-if="validationStatus.needsConfigFile" class="config-note">
                  <strong>Module Configurations</strong> for vessel_types:bc_types:
                  {{ validationStatus.missingResources?.configs?.join(', ') }} and possibly CellML modules.
                </li>
              </ul>
              <br />
              <div
                v-if="validationStatus.needsConfigFile"
                class="config-note"
              >
                <strong>NOTE:</strong> CellML Module File(s) may be required after providing the configurations.
              </div>
              <div
                v-if="validationStatus.hasModuleFileMismatch"
                class="mismatch-warning"
              >
                Warning: Some modules are not in the CellML files specified by their configurations.
              </div>
            </template>
          </el-alert>
        </div>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog" :disabled="isLoading">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm"
          :disabled="!isFormValid || isLoading || !validationStatus?.isComplete" :loading="isLoading">
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
const isVesselReset = ref(false)

// Determine if a specific field should show as valid based on validation status
const isFieldValid = (fieldKey) => {
  const fieldState = formState[fieldKey]
  if (!fieldState?.fileName) {
    return false // No file selected
  }

  // For non-dynamic fields (like vessel CSV), use the basic isValid flag
  if (fieldKey === IMPORT_KEYS.VESSEL || fieldKey === IMPORT_KEYS.PARAMETER || fieldKey === IMPORT_KEYS.UNITS) {
    return fieldState.isValid
  }

  // For dynamic fields, check against validation status
  if (!validationStatus.value) {
    return fieldState.isValid // Fallback to basic validation
  }

  // CellML file is valid if needsModuleFile is false
  if (fieldKey === IMPORT_KEYS.CELLML_FILE) {
    return !validationStatus.value.needsModuleFile
  }

  // Config file is valid if needsConfigFile is false
  if (fieldKey === IMPORT_KEYS.MODULE_CONFIG) {
    return !validationStatus.value.needsConfigFile
  }

  // Default to basic validation
  return fieldState.isValid
}

function resetFormState() {
  dynamicFields.value = []
  Object.keys(formState).forEach((key) => {
    if (!(isVesselReset.value && key === IMPORT_KEYS.VESSEL)) {
      formState[key] = createEmptyFieldState()
    }
  })
  validationStatus.value = null
}

function initFormFromConfig(fields = []) {
  fields.forEach((field) => {
    if (!formState[field.key]) {
      formState[field.key] = createEmptyFieldState()
    }
  })
}

const unstageFiles = () => {
  stagedFiles.value = {
    moduleFiles: [],
    configFiles: [],
  }
}

const resetForm = () => {
  resetFormState()
  unstageFiles()
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

  if (field.processUpload === 'cellml') {
    const vesselValidation = formState[IMPORT_KEYS.VESSEL]?.validation
    if (vesselValidation?.missingResources?.moduleFileIssues) {
      
      // Get the list of filenames the Vessel Config is actually looking for
      const expectedFilenames = Array.from(vesselValidation.missingResources.moduleFileIssues
        .filter(issue => issue.file)
        .map(issue => issue.file)
      )

      // If there are requirements and this file name isn't one of them, reject immediately
      if (expectedFilenames.length > 0 && !expectedFilenames.includes(rawFile.name)) {
        notify.error({
          title: 'Incorrect File Provided',
          message: `The configuration expects: "${expectedFilenames.join(', ')}". You provided "${rawFile.name}". This file will not be processed.`,
          duration: 6000
        })
        return 
      }
    }
  }

  if (field.key === IMPORT_KEYS.VESSEL) {
    const currentFileName = formState[IMPORT_KEYS.VESSEL]?.fileName

    if (currentFileName && currentFileName !== rawFile.name) {
      isVesselReset.value = true
      resetForm()
      isVesselReset.value = false
    }
  }
  
  state.fileName = rawFile.name
  state.isValid = false
  state.payload = null

  try {
    const parsed = await parseFile(field, rawFile)

    // Normalize parser output
    const data = parsed?.data ?? parsed
    const warnings = parsed?.warnings ?? []
    let validation = parsed?.validation ?? null

    // Re-validate using local staged files if using vessel array
    if (field.key === IMPORT_KEYS.VESSEL) {
      const validationStore = createValidationStore()
      validation = validateVesselData(data, validationStore)
    }

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
    } else if (field.key !== IMPORT_KEYS.VESSEL) {
      // For other fields:
      // - If a vessel has been uploaded and we have a validation result (e.g. after staging),
      //   propagate that vessel validation instead of overwriting the status.
      // - If no vessel payload exists, preserve existing behavior and mark validation as complete.
      const hasVesselPayload = !!formState[IMPORT_KEYS.VESSEL]?.payload
      if (hasVesselPayload && validation) {
        await updateVesselValidation(validation)
      } else if (!hasVesselPayload) {
        validationStatus.value = {
          isComplete: true,
          errors: [],
          warnings: []
        }
      }
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

  // Perform the staging logic
  if (field.processUpload === 'cellml') {
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

  // Re-validate the Vessel CSV with staged files to see if requirements are met
  const vesselField = formState[IMPORT_KEYS.VESSEL]
  if (vesselField?.payload?.data) {
    const validationStore = createValidationStore()
    const newValidation = validateVesselData(vesselField.payload.data, validationStore)
    
    // Update state
    formState[IMPORT_KEYS.VESSEL].validation = newValidation
    updateVesselValidation(newValidation)

    // Specific check for CellML failures
    if (field.processUpload === 'cellml') {
      const moduleIssues = newValidation.missingResources.moduleFileIssues
      
      // Look for issues related to the file we just uploaded
      const relevantIssue = moduleIssues.find(issue => issue.file === fileName)

      if (relevantIssue) {
        // The file was uploaded, but it failed for a specific reason
        let errorMsg = `File "${fileName}" was staged, but has issues: `
        
        if (relevantIssue.issue === 'module_not_in_file') {
          errorMsg = `The file "${fileName}" does not contain the required modules: ${relevantIssue.moduleTypes.join(', ')}.`
        } else if (relevantIssue.issue === 'filename_mismatch') {
          errorMsg = `The modules were found, but the file name must be exactly "${relevantIssue.expectedFile}" as defined in your config.`
        }

        notify.error({
          title: 'Import Requirement Not Met',
          message: errorMsg,
          duration: 6000
        })
      } else if (newValidation.needsModuleFile) {
        // The file was fine, but we still need MORE files
        notify.warning({
          title: 'Partial Success',
          message: `"${fileName}" is valid, but additional CellML files are still required.`
        })
      } else {
        notify.success({ title: 'CellML Ready', message: `${fileName} staged successfully.` })
      }
    } 
    // Simplified check for Config files
    else if (field.processUpload === 'config') {
      if (newValidation.needsConfigFile) {
        notify.warning({
          title: 'Config Staged',
          message: `"${fileName}" added, but more configurations are still missing.`
        })
      } else {
        notify.success({ title: 'Success', message: 'All configurations provided.' })
      }
    }
  }
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
.field-container {
  margin-bottom: var(--el-spacing-large);
}

.upload-row {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
}

.file-input {
  width: 320px;
}

.form-header {
  margin-bottom: var(--el-spacing-base);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  text-align: right;
}

/* Validation & Alerts */
.validation-status {
  margin-top: var(--el-spacing-large);
  margin-bottom: var(--el-spacing-base);
}

.required-asterisk {
  color: var(--el-color-danger);
}

.missing-resources {
  margin: var(--el-spacing-small) 0 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
}

.missing-resources li {
  margin: 4px 0;
}

.issue-list-container {
  margin-top: var(--el-spacing-mini, 4px);
}

.warning-text {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-warning);
  margin-top: 4px;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.module-issue-item {
  font-size: var(--el-font-size-extra-small);
  margin: 2px 0;
  color: var(--el-color-warning);
}

.module-issue-item::first-letter {
  color: var(--el-color-warning);
}

.module-type-list {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.config-note {
  margin-top: var(--el-spacing-base);
  font-size: var(--el-font-size-small);
  color: var(--el-color-warning);
}

.mismatch-warning {
  margin-top: var(--el-spacing-small);
  color: var(--el-color-warning);
  font-weight: bold;
  font-size: var(--el-font-size-small);
}

:deep(.el-alert__description) {
  margin-top: 5px;
  line-height: 1.6;
}
/* Loading/Spinner Customization */
/* Deep selectors remain necessary to override Element Plus internal classes */
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
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-base);
  margin-top: var(--el-spacing-small);
}

.is-loading-content {
  opacity: 0.2; /* Decreases the visibility of the form fields */
  pointer-events: none; /* Prevents users from clicking anything while loading */
  filter: grayscale(40%); /* Optional: adds a slight "disabled" look */
  transition: opacity var(--el-transition-duration), filter var(--el-transition-duration);
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
</style>