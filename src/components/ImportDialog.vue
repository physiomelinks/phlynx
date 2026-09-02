<template>
  <Dialog
    :visible="modelValue"
    :header="config.title || 'Import File'"
    :style="{ width: '500px' }"
    modal
    :dismissableMask="!isLoading"
    :closable="!isLoading"
    :draggable="false"
    @update:visible="
      (visible) => {
        if (!visible) closeDialog()
      }
    "
  >
    <div
      class="dialog-content"
      :class="{ 'is-drag-active': isDraggingOverForm }"
      @dragenter.prevent="handleFormDragEnter"
      @dragover.prevent
      @dragleave.prevent="handleFormDragLeave"
      @drop.prevent="handleFormDrop"
    >
      <form class="import-form" :class="{ 'is-loading-content': isLoading }">
        <div class="form-header" v-if="requiredFieldsCount > 0">
          <span class="required-asterisk">*</span> Indicates required field
        </div>

        <TransitionGroup name="field-pop" tag="div" class="fields-list">
        <div v-for="field in displayFields" :key="field.key" class="field-container">
          <div class="form-item" :class="{ 'is-info': field.limit }">
            <label class="field-label">
              <span>{{ field.label }}</span>
              <span v-if="field?.required ?? true" class="required-asterisk">*</span>
            </label>

            <div class="upload-row">
              <div
                class="file-input-box"
                :class="{ 'is-valid': isFieldReady(field.key), 'is-drag-active': fieldsDraggedOver.has(field.key) }"
                @dragenter.stop.prevent="handleFieldDragEnter(field.key)"
                @dragover.stop.prevent
                @dragleave.stop.prevent="handleFieldDragLeave(field.key)"
                @drop.stop.prevent="(event) => handleFieldDrop(event, field)"
              >
                <div class="file-names-area" @click.stop>
                  <span
                    v-if="!formState[field.key]?.files || formState[field.key]?.files.size === 0"
                    class="empty-text"
                  >
                    No file(s) selected
                  </span>
                  <template v-else>
                    <TransitionGroup name="tag-pop" tag="span" class="tags-row">
                    <Tag
                      v-for="[filename, fileData] in [...formState[field.key].files].slice(
                        0,
                        isFieldExpanded(field.key) ? formState[field.key].files.size : MAX_VISIBLE_TAGS
                      )"
                      :key="filename"
                      :severity="fileData.isValid ? 'success' : 'warn'"
                      class="file-tag"
                    >
                      <span class="tag-content">
                        <i v-if="fileData.isValid" class="pi pi-check tag-icon" />
                        <i v-else class="pi pi-exclamation-triangle tag-icon" />
                        <span>{{ filename }}</span>
                        <i
                          class="pi pi-times tag-remove-icon"
                          role="button"
                          tabindex="0"
                          :aria-label="`Remove ${filename}`"
                          @click.stop="removeFile(field.key, filename)"
                          @keydown.enter.stop="removeFile(field.key, filename)"
                        />
                      </span>
                    </Tag>
                    </TransitionGroup>

                    <Button
                      v-if="formState[field.key].files.size > MAX_VISIBLE_TAGS"
                      class="overflow-tag"
                      text
                      size="small"
                      severity="secondary"
                      @click.stop="toggleExpandedField(field.key)"
                    >
                      {{
                        isFieldExpanded(field.key)
                          ? 'Show less'
                          : `+${formState[field.key].files.size - MAX_VISIBLE_TAGS} more`
                      }}
                    </Button>
                  </template>
                </div>

                <div class="upload-trigger">
                  <input
                    :ref="(el) => setFileInputRef(el, field.key)"
                    type="file"
                    :multiple="!(field?.limit === 1)"
                    :accept="field.accept"
                    class="hidden-file-input"
                    @change="(event) => handleFileChange(event, field)"
                  />
                  <Button
                    :severity="isFieldReady(field.key) ? 'success' : 'primary'"
                    outlined
                    class="browse-button"
                    @click="triggerFileInput(field.key)"
                  >
                    <i class="pi" :class="isFieldReady(field.key) ? 'pi-check' : 'pi-upload'" />
                    Select
                  </Button>
                </div>
              </div>
            </div>

            <div v-if="field.limit" class="field-hint">
              <i class="pi pi-info-circle" />
              Up to {{ field.limit }} file{{ field.limit === 1 ? '' : 's' }} allowed
            </div>
          </div>
        </div>

        <div v-if="isInstanceArrayImport && !importReadiness" class="folder-import-row">
          <div class="folder-import-info">
            <i class="pi pi-folder" />
            <span v-if="folderStatus === 'connected'">
              Auto-loading from <strong>{{ folderName }}</strong>
            </span>
            <span v-else-if="folderStatus === 'needs-permission'"> Folder access needs to be re-confirmed. </span>
            <span v-else-if="supportsFolderAccess">
              Connect a folder to auto-load required files, or drag & drop / select several files at once below.
            </span>
            <span v-else> Drag & drop a folder or file(s) and we'll sort them automatically. </span>
          </div>
          <div class="folder-import-actions">
            <Button
              v-if="supportsFolderAccess && folderStatus === 'disconnected'"
              label="Connect Folder"
              size="small"
              text
              icon="pi pi-folder-open"
              @click="handleConnectFolder"
            />
            <Button
              v-if="folderStatus === 'needs-permission'"
              label="Reconnect"
              size="small"
              text
              severity="warn"
              icon="pi pi-refresh"
              @click="handleReconnectFolder"
            />
            <Button
              v-if="folderStatus === 'connected'"
              label="Disconnect"
              size="small"
              text
              severity="secondary"
              icon="pi pi-times"
              @click="handleForgetFolder"
            />
            <ProgressSpinner v-if="isScanningFolder" style="width: 18px; height: 18px" strokeWidth="6" />
          </div>
        </div>
        </TransitionGroup>

        <div v-if="importReadiness && formState[IMPORT_KEYS.INSTANCE_ARRAY]?.readiness" class="validation-status">
          <Message v-if="importReadiness.resourcesAreLoaded" severity="success" :closable="false">
            <div class="message-title">All Required Resources Available</div>
            <div class="message-content">All necessary components and configurations are available.</div>
          </Message>

          <Message v-else severity="warn" :closable="false">
            <div class="message-title">Additional Files Required</div>
            <div class="message-content">
              <div>Please provide the following files to complete the import:</div>
              <ul class="missing-resources">
                <li v-if="importReadiness.missingResources?.math.size > 0" class="config-note">
                  <strong>CellML Component File</strong>
                  <div class="component-type-list">
                    Required components: {{ [...importReadiness.missingResources.math].join(', ') }}
                  </div>
                </li>
                <li v-if="importReadiness.missingResources?.modules.size > 0" class="config-note">
                  <strong>Module Configurations</strong> for module_types:module_subtypes:
                  {{ [...importReadiness.missingResources.modules].join(',') }} and possibly CellML components.
                </li>
              </ul>
              <div v-if="importReadiness.missingResources?.modules.size > 0" class="config-note">
                <strong>NOTE:</strong> CellML Component File(s) may be required after providing the configurations.
              </div>
            </div>
          </Message>
        </div>
      </form>

      <Transition name="overlay-fade">
        <div v-if="isLoading" class="loading-overlay">
          <ProgressSpinner />
          <span class="loading-text">{{ loadingText }}</span>
        </div>
      </Transition>

      <Transition name="overlay-fade">
        <div v-if="isDraggingOverForm" class="drop-overlay">
          <i class="pi pi-cloud-upload drop-overlay-icon" />
          <span>Drop a folder or file(s)</span>
        </div>
      </Transition>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" text :disabled="isLoading" @click="closeDialog" />
        <Button
          label="Import"
          severity="primary"
          :disabled="!isFormValid || isLoading || !importReadiness?.resourcesAreLoaded"
          :loading="isLoading"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, toRaw } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { useFolderImport } from '../composables/useFolderImport'
import { useFileDrop } from '../composables/useFileDrop'
import { notify } from '../utils/notify'
import { IMPORT_KEYS, MAX_VISIBLE_TAGS } from '../utils/constants'
import { createDynamicFields, checkResourcesAreLoaded, getImportConfig } from '../utils/import'
import { normaliseConfig } from '../utils/config'
import { processCellMLData } from '../utils/cellml'

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
const libraryStore = useLibraryStore()

// --- State Management ---
const formState = reactive({})
const fileInputRefs = ref({})
const dynamicFields = ref([])
const importReadiness = ref(null)
const isLoading = ref(false)
const loadingText = ref('Loading...')
const expandedFields = ref(new Set())
const stagedFiles = ref({
  mathFiles: [], // { filename: string, payload: object }
  configFiles: [], // { filename: string, payload: object }
})

// --- Folder-based auto-import ---
const {
  supportsFolderAccess,
  folderStatus, // 'disconnected' | 'connected' | 'needs-permission'
  folderName,
  restoreFolder,
  pickFolder,
  reconnectFolder,
  forgetFolder,
  scanFolder,
} = useFolderImport()

let importQueue = Promise.resolve()
function withImportLock(taskFn) {
  const run = importQueue.then(taskFn, taskFn)
  importQueue = run.catch(() => {})
  return run
}

const isScanningFolder = ref(false)
const foldersAttemptedFilenames = ref(new Set())

// --- Drag-and-drop ---
const { filesFromDataTransfer } = useFileDrop()
const isDraggingOverForm = ref(false)
let formDragCounter = 0
const fieldsDraggedOver = ref(new Set())
const fieldDragCounters = new Map() // fieldKey -> counter

function handleFormDragEnter() {
  if (isLoading.value) return
  formDragCounter += 1
  isDraggingOverForm.value = true
}

function handleFormDragLeave() {
  if (isLoading.value) return
  formDragCounter = Math.max(0, formDragCounter - 1)
  if (formDragCounter === 0) {
    isDraggingOverForm.value = false
  }
}

function handleFieldDragEnter(fieldKey) {
  if (isLoading.value) return
  const count = (fieldDragCounters.get(fieldKey) || 0) + 1
  fieldDragCounters.set(fieldKey, count)
  fieldsDraggedOver.value.add(fieldKey)
}

function handleFieldDragLeave(fieldKey) {
  if (isLoading.value) return
  const count = Math.max(0, (fieldDragCounters.get(fieldKey) || 0) - 1)
  fieldDragCounters.set(fieldKey, count)
  if (count === 0) {
    fieldsDraggedOver.value.delete(fieldKey)
  }
}

function resetAllDragState() {
  formDragCounter = 0
  isDraggingOverForm.value = false
  fieldDragCounters.clear()
  fieldsDraggedOver.value = new Set()
}

const blockOutsideDrop = (e) => {
  const isMask = e.target.classList.contains('p-dialog-mask')
  const insideContent = e.target.closest('.p-dialog')
  if (isMask || !insideContent) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'none'
  }
}

onMounted(() => {
  restoreFolder()
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('dragend', resetAllDragState)
      window.addEventListener('dragover', blockOutsideDrop)
      window.addEventListener('drop', blockOutsideDrop)
    } else {
      window.removeEventListener('dragend', resetAllDragState)
      window.removeEventListener('dragover', blockOutsideDrop)
      window.removeEventListener('drop', blockOutsideDrop)
    }
  },
  { immediate: true }
)

const isInstanceArrayImport = computed(() =>
  (props.config.fields || []).some((f) => f.key === IMPORT_KEYS.INSTANCE_ARRAY)
)

async function handleConnectFolder() {
  try {
    await pickFolder()
  } catch (error) {
    notify.error({ title: 'Folder Access Failed', message: error.message || 'Could not access the folder.' })
  }
}

async function handleReconnectFolder() {
  const granted = await reconnectFolder()
  if (!granted) {
    notify.warning({ title: 'Folder Access', message: 'Permission was not granted for the remembered folder.' })
  }
}

async function handleForgetFolder() {
  await forgetFolder()
  foldersAttemptedFilenames.value = new Set()
}

function handleExceed(field) {
  nextTick(() => {
    notify.warning({
      title: 'Too Many Files',
      message: `The limit is ${field.limit}.`,
    })
  })
}

function setFileInputRef(el, fieldKey) {
  if (el) {
    fileInputRefs.value[fieldKey] = el
  }
}

function triggerFileInput(fieldKey) {
  fileInputRefs.value[fieldKey]?.click()
}

function toggleExpandedField(fieldKey) {
  if (expandedFields.value.has(fieldKey)) {
    expandedFields.value.delete(fieldKey)
  } else {
    expandedFields.value.add(fieldKey)
  }
}

function isFieldExpanded(fieldKey) {
  return expandedFields.value.has(fieldKey)
}

const removeFile = (fieldKey, filename) => {
  const fieldState = formState[fieldKey]
  if (fieldState && fieldState.files.has(filename)) {
    fieldState.files.delete(filename)

    stagedFiles.value.mathFiles = stagedFiles.value.mathFiles.filter((f) => f.filename !== filename)
    stagedFiles.value.configFiles = stagedFiles.value.configFiles.filter((f) => f.filename !== filename)

    const instanceArrayPayload = getInstanceArrayPayload()
    if (instanceArrayPayload) {
      const resourcesLoadStatus = checkReadiness(instanceArrayPayload)
      updateDynamicFields(resourcesLoadStatus)
    } else if (fieldKey === IMPORT_KEYS.INSTANCE_ARRAY) {
      resetForm()
    }
  }
}

function deepToRaw(value) {
  const raw = toRaw(value)
  if (raw instanceof Map) {
    return new Map([...raw].map(([k, v]) => [deepToRaw(k), deepToRaw(v)]))
  }
  if (raw instanceof Set) {
    return new Set([...raw].map(deepToRaw))
  }
  if (Array.isArray(raw)) {
    return raw.map(deepToRaw)
  }
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, deepToRaw(v)]))
  }
  return raw
}

const detachReactivity = (obj) => {
  return deepToRaw(obj)
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
    mathFiles: [],
    configFiles: [],
  }
}

const resetForm = (keepInstanceArray = false) => {
  resetFormState(keepInstanceArray)
  unstageFiles()

  Object.entries(fileInputRefs.value).forEach(([, input]) => {
    if (input) input.value = ''
  })
  expandedFields.value = new Set()
  if (!keepInstanceArray) {
    foldersAttemptedFilenames.value = new Set()
  }
}

watch(
  () => props.config?.fields,
  (fields) => {
    resetFormState()
    initFormFromConfig(fields)
  },
  { immediate: true }
)

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      resetFormState()
      initFormFromConfig(props.config?.fields)
      unstageFiles()
      foldersAttemptedFilenames.value = new Set()
    }
  }
)

const displayFields = computed(() => {
  const baseFields = props.config.fields || []
  return [...baseFields, ...dynamicFields.value]
})

const requiredFieldsCount = computed(() => {
  return displayFields.value.filter((field) => field.required !== false).length
})

const syncDynamicFields = async (completionStatus) => {
  try {
    const newFields = createDynamicFields(completionStatus)
    const existingKeys = new Set(dynamicFields.value.map((f) => f.key))

    for (const newField of newFields) {
      if (!existingKeys.has(newField.key)) {
        dynamicFields.value.push(newField)
        if (!formState[newField.key]) {
          formState[newField.key] = createEmptyFieldState()
        }
      }
    }
  } catch (error) {
    console.error('Failed to create dynamic fields:', error)
  }
}

function createEmptyFieldState() {
  return {
    files: new Map(),
    readiness: null,
    warnings: [],
  }
}

function resetFormState(keepInstanceArray = false) {
  dynamicFields.value = []
  Object.keys(formState).forEach((key) => {
    if (!(keepInstanceArray && key === IMPORT_KEYS.INSTANCE_ARRAY)) {
      formState[key] = createEmptyFieldState()
    }
  })
  importReadiness.value = null
}

const getInstanceArrayPayload = () => {
  const instanceFiles = formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files
  if (!instanceFiles || instanceFiles.size === 0) return null
  for (const fileData of instanceFiles.values()) {
    if (fileData.payload) return fileData.payload
  }
  return null
}

const createTemporaryStore = () => {
  const availableModules = detachReactivity(libraryStore.availableModules)
  const availableMath = detachReactivity(libraryStore.availableMath)
  const availableCollections = detachReactivity(libraryStore.availableCollections)

  for (const { filename, payload: configs } of stagedFiles.value.configFiles) {
    configs.forEach((config) => {
      const module = normaliseConfig(config)
      if (!availableMath.has(module.mathRef)) {
        module.isStub = true
      }
      if (!availableModules.has(module.moduleRef)) {
        availableModules.set(module.moduleRef, module)
        if (!availableCollections.has(module.mathRef)) {
          availableCollections.set(module.mathRef, new Set())
        }
        availableCollections.get(module.mathRef).add(module.moduleRef)
      }
    })
  }

  for (const { filename, payload } of stagedFiles.value.mathFiles) {
    payload.forEach((component) => {
      const mathRef = `${filename}:${component.name}`
      if (!availableMath.has(mathRef)) {
        availableMath.set(mathRef, component.math)
        availableCollections.get(mathRef)?.forEach((moduleRef) => {
          const moduleToUpdate = availableModules.get(moduleRef)
          if (moduleToUpdate && moduleToUpdate.isStub) {
            delete availableModules.get(moduleRef).isStub
          }
        })
      }
    })
  }

  return {
    availableModules,
    availableMath,
    availableCollections,
  }
}

const checkReadiness = (instanceArrayPayload) => {
  if (!instanceArrayPayload) return null

  const temporaryStore = createTemporaryStore()
  const resourcesLoadStatus = checkResourcesAreLoaded(instanceArrayPayload, temporaryStore)

  importReadiness.value = resourcesLoadStatus
  if (formState[IMPORT_KEYS.INSTANCE_ARRAY]) {
    formState[IMPORT_KEYS.INSTANCE_ARRAY].readiness = resourcesLoadStatus
  }

  return resourcesLoadStatus
}

const isFieldReady = (fieldKey) => {
  const fieldState = formState[fieldKey]
  if (!fieldState || fieldState.files.size === 0) return false

  const filesAllValid = Array.from(fieldState.files.values()).every((f) => f?.isValid)
  if (!filesAllValid) return false

  if (fieldKey === IMPORT_KEYS.INSTANCE_ARRAY) {
    return true
  }

  if (fieldKey === IMPORT_KEYS.MODULE_CONFIG) {
    return !(importReadiness.value?.missingResources?.modules.size > 0 ?? true)
  }

  if (fieldKey === IMPORT_KEYS.CELLML_FILE) {
    return !(importReadiness.value?.missingResources?.math.size > 0 ?? true)
  }

  return true
}

const isFormValid = computed(() => {
  if (!displayFields.value || displayFields.value.length === 0) return false

  return displayFields.value.every((field) => {
    if (field.required === false) return true

    const fieldState = formState[field.key]
    if (!fieldState || fieldState.files.size === 0) return false

    return Array.from(fieldState.files.values()).every((file) => file?.isValid)
  })
})

// --- Handlers ---
async function parseFile(field, rawFile) {
  if (field.requiresStore && libraryStore) {
    return field.parser(rawFile, libraryStore)
  }
  return field.parser(rawFile)
}

function extensionOf(filename) {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

function acceptsExtension(fieldConfig, filename) {
  if (!fieldConfig?.accept) return true
  return fieldConfig.accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(extensionOf(filename))
}

function importPriority(filename) {
  const ext = extensionOf(filename)
  if (ext === '.csv') return 0
  if (ext === '.json') return 1
  if (ext === '.cellml' || ext === '.xml') return 2
  return 3
}

function sortConfigsFirst(files, getName = (f) => f.name) {
  return [...files].sort((a, b) => importPriority(getName(a)) - importPriority(getName(b)))
}

async function ingestFileIntoField(field, rawFile, { cleanupOnFailure = false, notifyStaging = true } = {}) {
  const filename = rawFile.name

  if (field.processUpload === 'cellml' && !validateCellMLFilename(rawFile, { silent: cleanupOnFailure || !notifyStaging })) {
    return { ok: false, error: null, skip: !cleanupOnFailure }
  }

  if (field.key === IMPORT_KEYS.INSTANCE_ARRAY) {
    const existingFiles = formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files
    if (existingFiles?.size > 0 && !existingFiles.has(filename)) {
      resetForm(/* keepInstanceArray */ true)
    }
  }

  if (!formState[field.key]) {
    formState[field.key] = createEmptyFieldState()
  }
  const state = formState[field.key]
  state.files.set(filename, { isValid: false, payload: null })

  try {
    const parsed = await parseFile(field, rawFile)

    state.files.get(filename).payload = parsed?.data ?? parsed
    state.readiness = parsed?.completionStatus ?? null
    state.warnings = parsed?.completionStatus?.warnings ?? []

    if (field.processUpload) {
      stageValidatedFile(field, parsed, filename)
    }

    state.files.get(filename).isValid = true

    const instanceArrayPayload = getInstanceArrayPayload()
    if (instanceArrayPayload) {
      const status = checkReadiness(instanceArrayPayload)

      if (status && !status.resourcesAreLoaded) {
        await syncDynamicFields(status)
      }

      if (field.processUpload && notifyStaging) {
        notifyAfterStaging(field, filename, status)
      }
    } else {
      importReadiness.value = {
        resourcesAreLoaded: true,
        errors: [],
        warnings: [],
      }
    }

    if (state.warnings.length && notifyStaging) {
      await nextTick()
      for (const w of state.warnings) {
        notify.warning({
          title: 'Import Warning',
          message: w,
        })
      }
    }

    return { ok: true }
  } catch (error) {
    if (cleanupOnFailure) {
      state.files.delete(filename)
    } else {
      const fileEntry = state.files.get(filename)
      if (fileEntry) {
        fileEntry.isValid = false
        fileEntry.payload = null
      }
    }
    state.warnings = []

    const isUnexpectedError = error instanceof Error && error.constructor !== Error
    if (isUnexpectedError) {
      console.error(`[ImportDialog] Unexpected error while processing "${filename}" for field "${field.key}":`, error)
      if (notifyStaging) {
        notify.error({
          title: 'Import Error',
          message: `Something went wrong while checking readiness after loading "${filename}": ${error.message}`,
        })
      }
    }

    return { ok: false, error }
  }
}

const PROCESS_UPLOAD_BY_KEY = {
  [IMPORT_KEYS.CELLML_FILE]: 'cellml',
  [IMPORT_KEYS.MODULE_CONFIG]: 'config',
}

function candidateKeysExcluding(excludeKey) {
  const keys = [IMPORT_KEYS.MODULE_CONFIG, IMPORT_KEYS.CELLML_FILE, IMPORT_KEYS.PARAMETER]
  if (!formState[IMPORT_KEYS.INSTANCE_ARRAY]?.files?.size) {
    keys.unshift(IMPORT_KEYS.INSTANCE_ARRAY)
  }
  return keys.filter((k) => k !== excludeKey)
}

async function classifyIntoOtherFields(rawFile, excludeKey) {
  for (const key of candidateKeysExcluding(excludeKey)) {
    const baseCandidateConfig = getImportConfig(key)?.fields?.[0]
    if (!baseCandidateConfig) continue
    if (!acceptsExtension(baseCandidateConfig, rawFile.name)) continue

    const candidateConfig =
      PROCESS_UPLOAD_BY_KEY[key] && !baseCandidateConfig.processUpload
        ? { ...baseCandidateConfig, processUpload: PROCESS_UPLOAD_BY_KEY[key] }
        : baseCandidateConfig

    const result = await ingestFileIntoField(candidateConfig, rawFile, { cleanupOnFailure: true, notifyStaging: false })
    if (result.ok) {
      const alreadyVisible =
        (props.config.fields || []).some((f) => f.key === candidateConfig.key) ||
        dynamicFields.value.some((f) => f.key === candidateConfig.key)
      if (!alreadyVisible) {
        dynamicFields.value.push(candidateConfig)
      }
      return candidateConfig
    }
  }
  return null
}

async function processIncomingFiles(field, rawFiles, { strict = false } = {}) {
  return withImportLock(() => runProcessIncomingFiles(field, rawFiles, { strict }))
}

async function runProcessIncomingFiles(field, rawFiles, { strict = false } = {}) {
  const limit = field?.limit
  let files = sortConfigsFirst(rawFiles)
  if (limit && files.length > limit) {
    handleExceed(field)
    files = files.slice(0, limit)
  }

  for (const rawFile of files) {
    const primary = await ingestFileIntoField(field, rawFile, { notifyStaging: true })
    if (primary.ok) continue
    if (primary.skip) continue

    if (!strict) {
      const matchedField = await classifyIntoOtherFields(rawFile, field.key)
      if (matchedField) continue
    }

    trackEvent('import_action', {
      category: 'Import',
      action: 'import_error',
      label: field.key || 'unknown_field',
      file_type: 'various',
    })
    notify.error({
      title: 'Import Error',
      message: primary.error?.message || `"${rawFile.name}" is not a valid ${field.label || 'file'} for this field.`,
    })
  }
}

const handleFileChange = async (event, field) => {
  const selectedFiles = Array.from(event.target.files || [])
  if (!selectedFiles.length) return

  await processIncomingFiles(field, selectedFiles)

  event.target.value = ''
}

async function handleFieldDrop(event, field) {
  fieldDragCounters.set(field.key, 0)
  fieldsDraggedOver.value.delete(field.key)
  if (isLoading.value) return

  const entries = await filesFromDataTransfer(event.dataTransfer)
  if (!entries.length) {
    notify.warning({
      title: 'Nothing to Import',
      message: 'No supported files were found in what you dropped.',
    })
    return
  }

  await processIncomingFiles(
    field,
    entries.map((e) => e.file),
    { strict: true }
  )
}

async function handleFormDrop(event) {
  formDragCounter = 0
  isDraggingOverForm.value = false
  if (isLoading.value) return

  const entries = await filesFromDataTransfer(event.dataTransfer)
  if (!entries.length) {
    notify.warning({
      title: 'Nothing to Import',
      message: 'No supported files were found in what you dropped.',
    })
    return
  }

  await withImportLock(() => runFormDropClassification(entries))
}

async function runFormDropClassification(entries) {
  const sorted = sortConfigsFirst(entries, (e) => e.file.name)
  const unmatched = []
  let stagedCount = 0

  for (const { file } of sorted) {
    const matched = await classifyIntoOtherFields(file, undefined)
    if (matched) {
      stagedCount++
    } else {
      unmatched.push(file.name)
    }
  }

  if (stagedCount > 0) {
    const status = importReadiness.value
    if (status?.resourcesAreLoaded) {
      notify.success({
        title: 'Folder Staged Successfully',
        message: `Processed ${stagedCount} file${stagedCount > 1 ? 's' : ''}. All required resources are ready.`,
      })
    } else {
      notify.info({
        title: 'Files Staged',
        message: `Staged ${stagedCount} file${stagedCount > 1 ? 's' : ''}. Additional required files are still needed.`,
      })
    }
  }

  if (unmatched.length) {
    notify.warning({
      title: 'Some Files Skipped',
      message: `${unmatched.length} file${unmatched.length > 1 ? 's' : ''} didn't match any expected import type: ${unmatched
        .slice(0, 5)
        .join(', ')}${unmatched.length > 5 ? '…' : ''}`,
    })
  }
}

// --- Folder-based auto-import ---
async function attemptAutoFillFromFolder() {
  return withImportLock(() => runAutoFillFromFolder())
}

async function runAutoFillFromFolder() {
  if (isScanningFolder.value || folderStatus.value !== 'connected') return

  isScanningFolder.value = true
  let stagedAny = false

  try {
    const entries = sortConfigsFirst(await scanFolder(), (e) => e.file.name)

    for (const { file } of entries) {
      if (foldersAttemptedFilenames.value.has(file.name)) continue
      foldersAttemptedFilenames.value.add(file.name)

      const alreadyPresent = Object.values(formState).some((s) => s.files?.has(file.name))
      if (alreadyPresent) continue

      const matched = await classifyIntoOtherFields(file, IMPORT_KEYS.INSTANCE_ARRAY)
      if (matched) stagedAny = true
    }
  } catch (error) {
    notify.error({
      title: 'Folder Import',
      message: error.message || 'Failed to read files from the connected folder.',
    })
  } finally {
    isScanningFolder.value = false
  }

  if (stagedAny && importReadiness.value && !importReadiness.value.resourcesAreLoaded) {
    await runAutoFillFromFolder()
  } else if (stagedAny) {
    notify.success({
      title: 'Folder Import',
      message: 'Loaded the required files from the connected folder.',
    })
  }
}

watch(importReadiness, (status) => {
  if (!status || status.resourcesAreLoaded) return
  attemptAutoFillFromFolder()
})

watch(folderStatus, (status) => {
  if (status !== 'connected') return
  if (importReadiness.value && !importReadiness.value.resourcesAreLoaded) {
    attemptAutoFillFromFolder()
  }
})

async function updateDynamicFields(completionStatus) {
  importReadiness.value = completionStatus
  if (completionStatus.resourcesAreLoaded) {
    return
  }
  await syncDynamicFields(completionStatus)
}

function validateCellMLFilename(rawFile, { silent = false } = {}) {
  const componentFileIssues = importReadiness.value?.missingResources?.componentFileIssues
  if (!componentFileIssues?.length) return true

  const expectedFilenames = componentFileIssues.filter((issue) => issue.file).map((issue) => issue.file)

  if (expectedFilenames.length > 0 && !expectedFilenames.includes(rawFile.name)) {
    if (!silent) {
      notify.error({
        title: 'Incorrect File Provided',
        message: `The configuration expects: "${expectedFilenames.join(', ')}". You provided "${
          rawFile.name
        }". This file will not be processed.`,
        duration: 6000,
      })
    }
    return false
  }
  return true
}

async function stageValidatedFile(field, parsedData, filename) {
  if (!field.processUpload) return

  const data = parsedData

  if (field.processUpload === 'cellml') {
    const result = processCellMLData(data)
    if (result.type === 'success') {
      stagedFiles.value.mathFiles.push({
        filename,
        payload: result.components,
      })
    }
  } else if (field.processUpload === 'config') {
    stagedFiles.value.configFiles.push({
      filename,
      payload: data,
    })
  }
}

function notifyAfterStaging(field, filename, status) {
  if (!status) return

  if (field.processUpload === 'cellml') {
    const componentIssues = status.missingResources?.componentFileIssues ?? []
    const relevantIssue = componentIssues.find((issue) => issue.file === filename)

    if (relevantIssue) {
      let errorMsg = `File "${filename}" was staged but has issues.`
      if (relevantIssue.issue === 'component_not_in_file') {
        errorMsg = `"${filename}" does not contain the required components: ${relevantIssue.componentTypes.join(', ')}.`
      } else if (relevantIssue.issue === 'filename_mismatch') {
        errorMsg = `The components were found, but the file name must be exactly "${relevantIssue.expectedFile}" as defined in your config.`
      }
      notify.error({
        title: 'Import Requirement Not Met',
        message: errorMsg,
        duration: 6000,
      })
    } else if (status.needsComponentFile) {
      notify.warning({
        title: 'Partial Success',
        message: `"${filename}" is valid, but additional CellML components are still required.`,
      })
    } else {
      notify.success({
        title: 'CellML Ready',
        message: `${filename} staged successfully.`,
      })
    }
  } else if (field.processUpload === 'config') {
    if (status.needsConfigFile) {
      notify.warning({
        title: 'Config Staged',
        message: `"${filename}" added, but more configurations are still missing.`,
      })
    } else {
      notify.success({
        title: 'Success',
        message: 'All configurations provided.',
      })
    }
  }
}

const commitStagedFiles = () => {
  for (const { filename, payload } of stagedFiles.value.mathFiles) {
    libraryStore.addMathFile(filename, payload)
  }
  for (const { filename, payload } of stagedFiles.value.configFiles) {
    libraryStore.addConfigFile(filename, payload)
  }
}

const handleConfirm = async () => {
  isLoading.value = true
  loadingText.value = 'Importing modules...'

  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))

  commitStagedFiles()

  const importPayload = new Map()
  displayFields.value.forEach((field) => {
    const fieldFiles = toRaw(formState[field.key].files)
    if (fieldFiles.size === 0) return
    importPayload.set(field.key, new Map(fieldFiles))
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
.dialog-content {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  border-radius: 8px;
}

.import-form {
  position: relative;
  z-index: 1;
}

.dialog-content.is-drag-active {
  outline-offset: -4px;
  border-radius: 8px;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: color-mix(in srgb, var(--p-primary-color) 10%, var(--p-content-background) 90%);
  border-radius: 8px;
  pointer-events: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--p-primary-color);
}

.drop-overlay-icon {
  font-size: 2rem;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--p-content-background);
  border-radius: 8px;
}

.loading-text {
  color: var(--p-text-color);
  font-size: 0.95rem;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.18s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.fields-list {
  position: relative;
  display: block;
}

.field-pop-enter-active,
.field-pop-leave-active,
.field-pop-move {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.field-pop-enter-from,
.field-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.field-pop-leave-active {
  position: absolute;
  width: 100%;
}

.tags-row {
  display: contents;
}

.tag-pop-enter-active,
.tag-pop-move {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tag-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  position: absolute;
}

.tag-pop-enter-from,
.tag-pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.field-container {
  margin-bottom: 0.75rem;
}

.upload-row {
  width: 100%;
}

.form-item {
  margin-bottom: 1rem;
}

.form-item.is-info {
  margin-bottom: 0.5rem;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--p-text-color);
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-top: 0.35rem;
}

.file-input-box {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--p-form-field-border-color, var(--p-content-border-color));
  border-radius: 6px;
  background-color: var(--p-form-field-background, var(--p-content-background));
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-input-box:focus-within {
  border-color: var(--p-primary-color);
  box-shadow: inset 0 0 0 1px var(--p-primary-color);
}

.file-input-box.is-valid {
  border-color: var(--p-green-500, #16a34a);
}

.file-input-box.is-drag-active {
  border-color: var(--p-primary-color);
  box-shadow: inset 0 0 0 1px var(--p-primary-color);
  background-color: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
}

.file-input-box.is-valid:focus-within {
  box-shadow: inset 0 0 0 1px var(--p-green-500, rgba(22, 163, 74, 0.25));
}

.file-names-area {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  min-width: 0;
  overflow: hidden;
  cursor: default;
  flex-wrap: wrap;
}

.upload-trigger {
  flex-shrink: 0;
  border-left: 1px solid var(--p-form-field-border-color, var(--p-content-border-color));
  display: flex;
  align-items: center;
}

.hidden-file-input {
  display: none;
}

.browse-button {
  height: 100%;
  border: none;
  border-radius: 0;
  margin: 0;
  padding: 0 14px;
}

.empty-text {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  white-space: nowrap;
}

.file-tag {
  flex-shrink: 0;
}

.overflow-tag {
  flex-shrink: 0;
  cursor: pointer;
}

.tag-content {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.tag-content span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tag-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.tag-remove-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-left: 2px;
  padding: 2px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.tag-remove-icon:hover,
.tag-remove-icon:focus-visible {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
  outline: none;
}

.folder-import-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px dashed var(--p-content-border-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
}

.folder-import-info {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.folder-import-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.form-header {
  margin-top: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: right;
}

.required-asterisk {
  color: var(--p-red-500, #dc2626);
}

.validation-status {
  margin-top: 1rem;
}

.validation-status :deep(.p-message) {
  border-radius: 10px;
}

.validation-status :deep(.p-message-warn) {
  background: color-mix(in srgb, var(--p-amber-500, #d97706) 10%, var(--p-content-background, #fff));
  border: 1px solid color-mix(in srgb, var(--p-amber-500, #d97706) 30%, transparent);
}

.validation-status :deep(.p-message-warn .p-message-icon) {
  color: var(--p-amber-600, #b45309);
}

.validation-status :deep(.p-message-success) {
  background: color-mix(in srgb, var(--p-green-500, #22c55e) 10%, var(--p-content-background, #fff));
  border: 1px solid color-mix(in srgb, var(--p-green-500, #22c55e) 30%, transparent);
}

.validation-status :deep(.p-message-success .p-message-icon) {
  color: var(--p-green-600, #16a34a);
}

.validation-status :deep(.p-message-success) .message-title {
  color: var(--p-green-700, #15803d);
}

.validation-status :deep(.p-message-warn) .message-title {
  color: var(--p-amber-700, #92400e);
}

.message-title {
  font-weight: 600;
}

.message-content {
  margin-top: 0.25rem;
  color: var(--p-text-color);
}

.missing-resources {
  margin: 0.5rem 0 0 0;
  padding-left: 1rem;
  color: var(--p-text-color);
}

.missing-resources li {
  margin: 0.25rem 0;
}

.component-type-list {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.config-note {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.config-note strong {
  color: var(--p-amber-700, #92400e);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.is-loading-content {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(25%);
  transition: opacity 0.2s ease, filter 0.2s ease;
}
</style>
