import { computed, h, markRaw, ref } from 'vue'
import { storeToRefs } from 'pinia'

import {
  ZIP_FILE_TYPES,
  CELLML_FILE_TYPES,
  OMEX_FILE_TYPES,
  IMPORT_KEYS,
  EXPORT_KEYS,
  SEND_KEYS,
} from '../utils/constants'

import CellMLIcon from '../components/icons/CellMLIcon.vue'
import CUFLynxIcon from '../components/icons/CUFLynxIcon.vue'
import OpenCORIcon from '../components/icons/OpenCORIcon.vue'
import CombineIcon from '../components/icons/CombineIcon.vue'

import { useSimulationSettingsStore } from '../stores/simulationSettingsStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useInspectionModuleStore } from '../stores/inspectionModuleStore'
import { useSessionMetadataStore } from '../stores/sessionMetadataStore'
import { useOmexStore } from '../stores/omexStore'

import { createCellMLDataFragment, generateOmexArchive, createOmexDataFragment } from '../services/compress'
import { generateExportZip } from '../services/export/ca'
import { generateFlattenedModel, extractVoiAndParametersFromModel } from '../utils/cellml'
import { readFileAsText } from '../utils/misc'
import { getFileHandle } from '../utils/save'
import { getImportConfig } from '../utils/import'

export function useImportExportSend({
  libcellml,
  nodes,
  edges,
  importDialogVisible,
  exportDialogVisible,
  currentImportConfig,
  onExportConfirm,
  hasModelChanged,
  snapshotFlowState,
}) {
  const simulationSettingsStore = useSimulationSettingsStore()
  const libraryStore = useLibraryStore()
  const inspectionModuleStore = useInspectionModuleStore()
  const sessionMetadataStore = useSessionMetadataStore()
  const omexStore = useOmexStore()

  const currentImportKey = ref(IMPORT_KEYS.INSTANCE_ARRAY)
  const currentExportKey = ref(EXPORT_KEYS.CELLML)
  const currentSendKey = ref(SEND_KEYS.OPENCOR)

  const { simulationSettings, plotConfig, parameterScanConfig } = storeToRefs(simulationSettingsStore)

  const importOptions = computed(() => [
    {
      key: IMPORT_KEYS.INSTANCE_ARRAY,
      label: 'Instance Array',
      icon: 'pi pi-th-large',
      disabled: false,
    },
    {
      key: IMPORT_KEYS.CELLML_FILE,
      label: 'CellML File',
      icon: CellMLIcon,
      disabled: libcellml.status !== 'ready',
    },
    {
      key: IMPORT_KEYS.MODULE_CONFIG,
      label: 'Module Config',
      icon: 'pi pi-wrench',
      disabled: libcellml.status !== 'ready',
    },
    {
      key: IMPORT_KEYS.PARAMETER,
      label: 'Parameters',
      icon: 'pi pi-sliders-h',
      disabled: false,
    },
    {
      key: IMPORT_KEYS.OMEX,
      label: 'COMBINE Archive',
      icon: CombineIcon,
      disabled: libcellml.status !== 'ready',
    },
  ])

  const currentImportMode = computed(
    () => importOptions.value.find((option) => option.key === currentImportKey.value) ?? importOptions.value[0] ?? null
  )

  const generateOmexArchiveAction = async (finalName) => {
    const blob = await generateFlattenedModel(nodes.value, edges.value, libraryStore, inspectionModuleStore.modules)
    const rehydratedModel = await readFileAsText(blob)
    const extractedData = extractVoiAndParametersFromModel(rehydratedModel, parameterScanConfig.value)
    const snapshot = snapshotFlowState()
    const cellmlFileName = omexStore.cellmlFileName

    return generateOmexArchive(
      { blob },
      snapshot,
      {
        simulationSettings: simulationSettings.value,
        plotConfig: plotConfig.value,
        parameterScanConfig: parameterScanConfig.value,
      },
      { extractedData, modified: hasModelChanged.value, cellmlFileName }
    )
  }

  const exportOptions = computed(() => [
    {
      key: EXPORT_KEYS.CELLML,
      label: 'CellML',
      icon: CellMLIcon,
      disabled: libcellml.status !== 'ready',
      suffix: '.cellml',
      fileTypes: CELLML_FILE_TYPES,
      message: 'Generating flattened CellML model.',
      action: () => generateFlattenedModel(nodes.value, edges.value, libraryStore, inspectionModuleStore.modules),
      successMessage: async (blob, finalName) => {
        const dataUri = await createCellMLDataFragment(blob, finalName)
        return h('div', null, [
          'Model exported to CellML. Open this model directly in ',
          h(
            'a',
            {
              href: `https://opencor.ws/app/?opencor://openFile/#${dataUri}`,
              rel: 'noopener noreferrer',
              style: { color: 'var(--p-primary-color)', fontWeight: 'bold' },
              target: '_blank',
            },
            'OpenCOR'
          ),
        ])
      },
    },
    {
      key: EXPORT_KEYS.CA,
      label: 'Circulatory Autogen',
      icon: 'pi pi-box',
      disabled: false,
      suffix: '.zip',
      fileTypes: ZIP_FILE_TYPES,
      message: 'Generating and zipping CA files.',
      action: (finalName) => generateExportZip(finalName, nodes.value, edges.value, libraryStore),
      successMessage: () => 'Circulatory Autogen export zip generated.',
    },
    {
      key: EXPORT_KEYS.OMEX,
      label: 'OpenCOR',
      icon: OpenCORIcon,
      disabled: libcellml.status !== 'ready',
      suffix: '.omex',
      fileTypes: OMEX_FILE_TYPES,
      message: 'Generating OMEX archive for Web OpenCOR.',
      action: generateOmexArchiveAction,
      successMessage: async (blob, finalName) => {
        const dataUri = await createOmexDataFragment(blob)
        return h('div', null, [
          'OMEX archive generated for Web OpenCOR. Open this model directly in ',
          h(
            'a',
            {
              href: `https://opencor.ws/app/?opencor://openFile/#${dataUri}`,
              rel: 'noopener noreferrer',
              style: { color: 'var(--p-primary-color)', fontWeight: 'bold' },
              target: '_blank',
            },
            'OpenCOR'
          ),
        ])
      },
    },
    {
      key: EXPORT_KEYS.CUFLYNX,
      label: 'CUFLynx',
      icon: CUFLynxIcon,
      disabled: libcellml.status !== 'ready',
      suffix: '.omex',
      fileTypes: OMEX_FILE_TYPES,
      message: 'Generating OMEX archive for CUFLynx.',
      action: generateOmexArchiveAction,
      successMessage: () => 'CUFLynx export OMEX generated.',
      // Temporarily disabled until CUFLynx can register the protocol handler.
      // successMessage: async (blob, finalName) => {
      //   const dataUri = await createOmexDataFragment(blob)
      //   return h('div', null, [
      //     'OMEX archive generated for CUFLynx. Open this model directly in ',
      //     h(
      //       'a',
      //       {
      //         href: `cuflynx://api?import=omex#${dataUri}`,
      //         rel: 'noopener noreferrer',
      //         style: { color: 'var(--p-primary-color)', fontWeight: 'bold' },
      //         target: '_blank',
      //       },
      //       'CUFLynx'
      //     ),
      //   ])
      // },
    },
  ])

  const currentExportMode = computed(
    () => exportOptions.value.find((option) => option.key === currentExportKey.value) ?? exportOptions.value[0] ?? null
  )

  const sendOptions = computed(() => [
    {
      key: SEND_KEYS.OPENCOR,
      label: 'OpenCOR',
      icon: OpenCORIcon,
      disabled: libcellml.status !== 'ready',
      suffix: '.omex',
      fileTypes: OMEX_FILE_TYPES,
      message: 'Generating OMEX archive for Web OpenCOR.',
      action: generateOmexArchiveAction,
    },
  ])

  const currentSendMode = computed(
    () => sendOptions.value.find((option) => option.key === currentSendKey.value) ?? sendOptions.value[0] ?? null
  )

  const importMenuItems = computed(() =>
    importOptions.value.map((opt) => ({
      label: opt.label,
      icon: opt.icon,
      disabled: opt.disabled,
      command: () => performImport(opt),
    }))
  )

  const exportMenuItems = computed(() =>
    exportOptions.value.map((opt) => ({
      label: opt.label,
      icon: opt.icon,
      disabled: opt.disabled || !opt.action,
      command: () => {
        currentExportKey.value = opt.key
        performExport(opt)
      },
    }))
  )

  const sendMenuItems = computed(() =>
    sendOptions.value.map((opt) => ({
      label: opt.label,
      icon: opt.icon,
      disabled: opt.disabled || !opt.action,
      command: () => {
        currentSendKey.value = opt.key
        performSend(opt)
      },
    }))
  )

  const currentExportDisabled = computed(() => !currentExportMode.value || currentExportMode.value.disabled)

  const currentImportDisabled = computed(() => !currentImportMode.value || currentImportMode.value.disabled)

  const currentSendDisabled = computed(() => !currentSendMode.value || currentSendMode.value.disabled)

  const triggerCurrentImport = () => {
    performImport(currentImportMode.value)
  }

  const triggerCurrentSend = () => {
    performSend(currentSendMode.value)
  }

  const performImport = (mode) => {
    currentImportKey.value = mode.key
    currentImportConfig.value = getImportConfig(mode.key)

    if (currentImportConfig.value) {
      importDialogVisible.value = true
    }
  }

  const performExport = async (mode) => {
    const baseName = sessionMetadataStore.lastSaveName
    const fileTypes = mode.fileTypes || ZIP_FILE_TYPES

    const result = await getFileHandle(baseName, fileTypes, mode.suffix)
    if (result.success && result.handle) {
      onExportConfirm(result.cleanName, result.handle)
    } else if (result.needsLegacyDialog) {
      exportDialogVisible.value = true
    }
  }

  const performSend = async (mode) => {
    const baseName = sessionMetadataStore.lastSaveName

    const blob = await mode.action(baseName)
    const dataUri = await createOmexDataFragment(blob)
    // Open the generated OMEX archive in Web OpenCOR
    // This needs to change to support other send modes in the future, but for now we only have OpenCOR.
    const url = `https://opencor.ws/app/?opencor://openFile/#${dataUri}`
    window.open(url, '_blank', 'noreferrer')
  }

  const triggerCurrentExport = () => {
    if (currentExportMode.value) {
      performExport(currentExportMode.value)
    }
  }

  return {
    currentExportMode,
    currentImportMode,
    currentSendMode,
    exportMenuItems,
    importMenuItems,
    sendMenuItems,
    currentExportDisabled,
    currentImportDisabled,
    currentSendDisabled,
    triggerCurrentExport,
    triggerCurrentImport,
    triggerCurrentSend,
  }
}
