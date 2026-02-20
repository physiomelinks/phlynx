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
                ref="uploadRefs"
                action="#"
                multiple
                :limit="field?.limit"
                :show-file-list="false"
                :auto-upload="false"
                :on-exceed="() => handleExceed(field)"
                :accept="field.accept"
                :on-change="(file) => handleFileChange(file, field)"
                class="upload-trigger"
              >
                <div class="file-drop-zone" :class="{ 'is-valid': isFieldReady(field.key), 'has-files': formState[field.key]?.files?.size > 0 }">
                  <div class="drop-zone-left">
                    <el-icon class="drop-zone-icon">
                      <Check v-if="isFieldReady(field.key)" />
                      <Upload v-else />
                    </el-icon>
                    <span class="drop-zone-label">
                      {{ isFieldReady(field.key) ? 'Ready' : 'Select file(s)' }}
                    </span>
                  </div>

                  <div class="file-tags-area">
                    <span v-if="!formState[field.key]?.files || formState[field.key]?.files.size === 0" class="empty-text">
                      No file(s) selected
                    </span>
                    <transition-group v-else name="list">
                      <el-tag
                        v-for="[filename, fileData] in formState[field.key].files"
                        :key="filename"
                        :type="fileData.isValid ? 'success' : 'warning'"
                        closable
                        @close.stop="removeFile(field.key, filename)"
                        size="small"
                        effect="light"
                        class="file-tag"
                      >
                        <span class="tag-content">
                          <el-icon v-if="fileData.isValid" class="tag-icon"><Check /></el-icon>
                          <el-icon v-else class="tag-icon"><Warning /></el-icon>
                          <span>{{ filename }}</span>
                        </span>
                      </el-tag>
                    </transition-group>
                  </div>
                </div>
              </el-upload>
            </div>
          </el-form-item>
        </div>

        <div v-if="importReadiness && formState[IMPORT_KEYS.VESSEL]?.readiness" class="validation-status">
          <el-alert
            v-if="importReadiness.isComplete"
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
                <li v-if="importReadiness.needsModuleFile" class="config-note">
                  <strong>CellML Module File</strong>
                  <div
                    v-if="importReadiness.missingResources?.moduleFileIssues?.length > 0"
                    class="issue-list-container"
                  >
                    <div
                      v-for="moduleFileIssue in importReadiness.missingResources.moduleFileIssues"
                      :key="moduleFileIssue.uniqueKey"
                      class="module-issue-item"
                    >
                      • {{ moduleFileIssue.message }}
                    </div>
                  </div>
                  <div v-else-if="importReadiness.missingResources?.moduleTypes?.length > 0" class="module-type-list">
                    containing: {{ importReadiness.missingResources.moduleTypes.join(', ') }}
                  </div>
                </li>
                <li v-if="importReadiness.needsConfigFile" class="config-note">
                  <strong>Module Configurations</strong> for vessel_types:bc_types:
                  {{ importReadiness.missingResources?.configs?.join(', ') }} and possibly CellML modules.
                </li>
              </ul>
              <br />
              <div v-if="importReadiness.needsConfigFile" class="config-note">
                <strong>NOTE:</strong> CellML Module File(s) may be required after providing the configurations.
              </div>
              <div v-if="importReadiness.hasModuleFileMismatch" class="mismatch-warning">
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
        <el-button
          type="primary"
          @click="handleConfirm"
          :disabled="!isFormValid || isLoading || !importReadiness?.isComplete"
          :loading="isLoading"
        >
          Import
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElButton, ElUpload, ElAlert, ElIcon, ElTag } from 'element-plus'
import { Check, Warning, Upload } from '@element-plus/icons-vue'

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
const uploadRefs = ref([])
const dynamicFields = ref([])
const importReadiness = ref(null)
const isLoading = ref(false)
const loadingText = ref('Loading...')
const stagedFiles = ref({
  moduleFiles: [], // { filename: string, payload: object }
  configFiles: [], // { filename: string, payload: object }
})
const isVesselReset = ref(false)

// Checks if a field has valid files uploaded and all required information has been provided.
const isFieldReady = (fieldKey) => {
  const fieldState = formState[fieldKey]
  if (!fieldState || fieldState.files.size === 0) {
    return false
  }
  const filesAllValid = Array.from(fieldState.files.values()).every(file => file?.isValid)
  if (!filesAllValid) return false

  // Vessel array field is ready if:
  // - Vessel array is valid
  if (fieldKey === IMPORT_KEYS.VESSEL) {
    return true
  }

  // Module config field is ready if:
  // - Config files are all valid
  // - All required config files have been supplied
  if (fieldKey === IMPORT_KEYS.MODULE_CONFIG) {
    return !importReadiness.value?.needsConfigFile ?? false
  }

  // Module field is ready if:
  // - Module files are all valid
  // - All required module files have been supplied
  if (fieldKey === IMPORT_KEYS.CELLML_FILE) {
    return !importReadiness.value?.needsModuleFile ?? false
  }

  return true
}

function handleExceed(field) {
  nextTick(() => {
    notify.warning({
      title: 'Too Many Files',
      message: `The limit is ${field.limit}.`
    })
  })
}

// Handler for removing a file via the tag's close button
const removeFile = (fieldKey, filename) => {
  const fieldState = formState[fieldKey]
  if (fieldState && fieldState.files.has(filename)) {
    // Remove from local form state
    fieldState.files.delete(filename)

    // Remove from staged files if applicable
    stagedFiles.value.moduleFiles = stagedFiles.value.moduleFiles.filter(f => f.filename !== filename)
    stagedFiles.value.configFiles = stagedFiles.value.configFiles.filter(f => f.filename !== filename)

    // Re-evaluate overall vessel dependencies
    const vesselPayload = getVesselPayload()
    if (vesselPayload) {
      const temporaryStore = createTemporaryStore()
      const newCompletionStatus = validateVesselData(vesselPayload, temporaryStore)
      formState[IMPORT_KEYS.VESSEL].readiness = newCompletionStatus
      updateVesselValidation(newCompletionStatus)
    } else if (fieldKey === IMPORT_KEYS.VESSEL) {
      // If the user deletes the vessel file, wipe completion status
      resetForm()
    }
  }
}

function resetFormState() {
  dynamicFields.value = []
  Object.keys(formState).forEach((key) => {
    if (!(isVesselReset.value && key === IMPORT_KEYS.VESSEL)) {
      formState[key] = createEmptyFieldState()
    }
  })
  importReadiness.value = null
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
  
  // Clear the visual file list in the UI components
  if (uploadRefs.value) {
    uploadRefs.value.forEach((uploadInstance) => {
      uploadInstance?.clearFiles()
    })
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

const addDynamicFields = async (completionStatus) => {
  try {
    const newFields = createDynamicFields(completionStatus)

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
    files: new Map(), //  [key: filename, object: {isValid: boolean, payload: raw file contents} ]
    readiness: null, // Selected files contain enough information to complete the import
    warnings: [],
  }
}

// Helper to extract vessel payload from the new Map structure
const getVesselPayload = () => {
  const vesselFiles = formState[IMPORT_KEYS.VESSEL]?.files
  if (!vesselFiles || vesselFiles.size === 0) return null
  for (const fileData of vesselFiles.values()) {
    if (fileData.payload) return fileData.payload
  }
  return null
}

// Create a temporary store-like object for validation that includes staged files
const createTemporaryStore = () => {
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

  // Strictly check if all required fields have successfully parsed their files
  return displayFields.value.every((field) => {
    if (field.required === false) return true
    
    const fieldState = formState[field.key]
    if (!fieldState || fieldState.files.size === 0) return false
    
    return Array.from(fieldState.files.values()).every(file => file?.isValid)
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
  const moduleFileIssues = importReadiness.value?.missingResources?.moduleFileIssues
  if (moduleFileIssues?.length > 0) {
    const expectedFilenames = moduleFileIssues
      .filter((issue) => issue.file)
      .map((issue) => issue.file)

    if (expectedFilenames.length > 0 && !expectedFilenames.includes(rawFile.name)) {
      notify.error({
        title: 'Incorrect File Provided',
        message: `The configuration expects: "${expectedFilenames.join(', ')}". You provided "${rawFile.name}". This file will not be processed.`,
        duration: 6000,
      })
      return
    }
  }
}

  if (field.key === IMPORT_KEYS.VESSEL) {
    const vesselFileMap = formState[IMPORT_KEYS.VESSEL]?.files

    if (vesselFileMap && vesselFileMap.size > 0 && !vesselFileMap.has(rawFile.name)) {
      isVesselReset.value = true
      resetForm()
      isVesselReset.value = false
    } 
  }

  const filename = rawFile.name
  
  state.files.set(filename, { isValid: false, payload: null })

  try {
    const parsed = await parseFile(field, rawFile)

    // Normalise parser output
    const data = parsed?.data ?? parsed
    const warnings = parsed?.completionStatus?.warnings ?? []
    let completionStatus = parsed?.completionStatus ?? null

    // Re-validate using local staged files if using vessel array
    if (field.key === IMPORT_KEYS.VESSEL) {
      const temporaryStore = createTemporaryStore()
      completionStatus = validateVesselData(data, temporaryStore)
    }

    state.files.get(filename).payload = data
    state.readiness = completionStatus
    state.warnings = warnings

    // Specific logic for Dynamic Files (Configs/Modules)
    if (field.processUpload) {
      await stageFile(field, parsed, filename)
      // Re-validate vessel if needed
      const vesselPayload = getVesselPayload()
      if (vesselPayload) {
        const temporaryStore = createTemporaryStore()
        const newCompletionStatus = validateVesselData(vesselPayload, temporaryStore)
        completionStatus = newCompletionStatus
      }
    }

    // Vessel-specific validation
    if (field.key === IMPORT_KEYS.VESSEL && completionStatus) {
      await updateVesselValidation(completionStatus)
    } else if (field.key !== IMPORT_KEYS.VESSEL) {
      // For other fields:
      const hasVesselPayload = !!getVesselPayload()
      if (hasVesselPayload && completionStatus) {
        await updateVesselValidation(completionStatus)
      } else if (!hasVesselPayload) {
        importReadiness.value = {
          isComplete: true,
          errors: [],
          warnings: [],
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

    state.files.get(filename).isValid = true
  } catch (error) {
    state.files.get(filename).isValid = false
    state.files.get(filename).payload = null
    state.warnings = []

    trackEvent('import_action', {
      category: 'Import',
      action: 'import_error',
      label: field.key || 'unknown_field',
      file_type: 'various',
    })
    notify.error({
      title: 'Import Error',
      message: error.message || 'Failed to parse file.',
    })
  }
}

async function updateVesselValidation(completionStatus) {
  importReadiness.value = completionStatus
  if (completionStatus.isComplete) {
    return
  }
  await addDynamicFields(completionStatus)
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
  const vesselPayload = getVesselPayload()
  if (vesselPayload?.data) {
    const temporaryStore = createTemporaryStore()
    const newCompletionStatus = validateVesselData(vesselPayload.data, temporaryStore)

    // Update state
    formState[IMPORT_KEYS.VESSEL].readiness = newCompletionStatus
    updateVesselValidation(newCompletionStatus)

    // Specific check for CellML failures
    if (field.processUpload === 'cellml') {
      const moduleIssues = newCompletionStatus.missingResources.moduleFileIssues

      // Look for issues related to the file we just uploaded
      const relevantIssue = moduleIssues.find((issue) => issue.file === fileName)

      if (relevantIssue) {
        // The file was uploaded, but it failed for a specific reason
        let errorMsg = `File "${fileName}" was staged, but has issues: `

        if (relevantIssue.issue === 'module_not_in_file') {
          errorMsg = `The file "${fileName}" does not contain the required modules: ${relevantIssue.moduleTypes.join(
            ', '
          )}.`
        } else if (relevantIssue.issue === 'filename_mismatch') {
          errorMsg = `The modules were found, but the file name must be exactly "${relevantIssue.expectedFile}" as defined in your config.`
        }

        notify.error({
          title: 'Import Requirement Not Met',
          message: errorMsg,
          duration: 6000,
        })
      } else if (newCompletionStatus.needsModuleFile) {
        notify.warning({
          title: 'Partial Success',
          message: `"${fileName}" is valid, but additional CellML modules are still required.`,
        })
      } else {
        notify.success({ title: 'CellML Ready', message: `${fileName} staged successfully.` })
      }
    }
    else if (field.processUpload === 'config') {
      if (newCompletionStatus.needsConfigFile) {
        notify.warning({
          title: 'Config Staged',
          message: `"${fileName}" added, but more configurations are still missing.`,
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

  if (formState[IMPORT_KEYS.PARAMETER]) {
    for (const [filename, data] of formState[IMPORT_KEYS.PARAMETER].files) {
      if (data.isValid) {
        builderStore.addParameterFile(filename, data.payload)
      }
    }
  }

  const importPayload = new Map()
  displayFields.value.forEach((field) => {
    for (const [filename, data] of formState[field.key].files) {
      importPayload.set(filename, data)
    }
  })

  trackEvent('import_action', {
    category: 'Import',
    action: 'import_file',
    label: props.config.title || 'Import File',
    file_type: 'various',
  })
  emit('confirm', importPayload, (progressText) => {
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
  width: 100%;
}

.upload-trigger {
  width: 100%;
}

.upload-trigger :deep(.el-upload) {
  width: 100%;
}

.file-drop-zone {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 42px;
  border: 1.5px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background-color: var(--el-fill-color-blank);
  padding: 6px 6px 6px 0;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
}

.file-drop-zone:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.file-drop-zone.is-valid {
  border-color: var(--el-color-success);
  background-color: var(--el-color-success-light-9);
}

.file-drop-zone.is-valid:hover {
  border-color: var(--el-color-success);
  box-shadow: 0 0 0 1px var(--el-color-success-light-5);
}

.drop-zone-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 64px;
  padding: 4px 12px;
  border-right: 1.5px solid var(--el-border-color-light);
  align-self: stretch;
  flex-shrink: 0;
}

.is-valid .drop-zone-left {
  border-right-color: var(--el-color-success-light-5);
  color: var(--el-color-success);
}

.drop-zone-icon {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  transition: color 0.2s ease;
}

.is-valid .drop-zone-icon {
  color: var(--el-color-success);
}

.file-drop-zone:hover .drop-zone-icon {
  color: var(--el-color-primary);
}

.is-valid:hover .drop-zone-icon {
  color: var(--el-color-success);
}

.drop-zone-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  transition: color 0.2s ease;
}

.is-valid .drop-zone-label {
  color: var(--el-color-success);
}

.file-drop-zone:hover .drop-zone-label {
  color: var(--el-color-primary);
}

.file-tags-area {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 2px 8px 2px 0;
}

.empty-text {
  color: var(--el-text-color-placeholder);
  font-size: var(--el-font-size-small);
}

.file-tag {
  margin: 0;
}

.tag-content {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-icon {
  font-size: 14px;
}

/* Optional simple tag animation */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.form-header {
  margin-bottom: var(--el-spacing-base);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  text-align: right;
}

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
  opacity: 0.2;
  pointer-events: none;
  filter: grayscale(40%);
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