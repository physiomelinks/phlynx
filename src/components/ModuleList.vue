<template>
  <div class="module-list-container">
    <el-input v-model="filterText" placeholder="Filter modules..." clearable class="filter-input" />

    <el-collapse v-model="activeCollapseNames" class="module-list">
      <el-collapse-item
        v-for="file in filteredModuleFiles"
        :key="file.filename"
        :title="file.filename"
        :name="file.filename"
      >
        <el-card
          v-for="module in file.modules"
          :key="module.name"
          class="module-card"
          :class="{ selectable: selectable, 'is-stub': file.isStub }"
          shadow="hover"
          :body-style="{ padding: '10px' }"
          :draggable="!selectable && !file.isStub"
          @dragstart="handleDragStart($event, module)"
          @click="selectable && handleSelect(module)"
        >
          <div class="card-header">
            <span class="module-name">{{ module.name }}</span>

            <el-tag
              v-if="module.configs && module.configs.length > 1"
              size="small"
              type="info"
              effect="plain"
              class="config-badge"
            >
              {{ module.configs.length }} configs
            </el-tag>
            <el-tooltip
              v-if="module.configs && module.configs.length === 1"
              content="Preview Configuration"
              placement="top"
              :auto-close="TOOLTIP_AUTO_CLOSE"
            >
              <el-button size="small" circle @click.stop="openPreview(module, file.filename)">
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
          </div>

          <div v-if="!selectable && module.configs && module.configs.length > 1" class="config-controls">
            <el-select
              v-model="selectedConfigs[module.name]"
              size="small"
              placeholder="Select config"
              class="config-select"
              @click.stop
            >
              <el-option
                v-for="(config, index) in module.configs"
                :key="index"
                :label="configLabel(config) || `Config ${index + 1}`"
                :value="index"
              />
            </el-select>
            <el-tooltip content="Preview Configuration" placement="top" :auto-close="TOOLTIP_AUTO_CLOSE">
              <el-button size="small" circle @click.stop="openPreview(module, file.filename)">
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </el-card>
      </el-collapse-item>
    </el-collapse>

    <el-empty v-if="filteredModuleFiles.length === 0" description="No modules found" :image-size="80" />

    <ModulePreviewDialog v-model="showPreview" :module-data="previewTarget" />
  </div>
</template>

<script setup>
import { computed, ref, watch, reactive } from 'vue'
import { View } from '@element-plus/icons-vue'
import { useBuilderStore } from '../stores/builderStore'
import useDragAndDrop from '../composables/useDnD'
import ModulePreviewDialog from './ModulePreviewDialog.vue'
import { TOOLTIP_AUTO_CLOSE } from '../utils/constants'

const props = defineProps({
  selectable: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const store = useBuilderStore()
const { onDragStart } = useDragAndDrop()

const filterText = ref('')
const activeCollapseNames = ref([])
const knownFilenames = ref(new Set())
const selectedConfigs = reactive({}) // Maps moduleName -> configIndex
const showPreview = ref(false)
const previewTarget = ref(null)

const filteredModuleFiles = computed(() => {
  const lowerCaseFilter = filterText.value.toLowerCase()
  if (!lowerCaseFilter) return store.availableModules

  return store.availableModules
    .map((file) => {
      const filteredModules = file.modules.filter((module) => module.name.toLowerCase().includes(lowerCaseFilter))
      return { ...file, modules: filteredModules }
    })
    .filter((file) => file.modules.length > 0)
})

function configLabel(config) {
  return `${config.vessel_type} - ${config.BC_type}` || `Config ${index + 1}`
}

// Initialize default config selection (index 0) for visible modules
watch(
  filteredModuleFiles,
  (files) => {
    files.forEach((file) => {
      file.modules.forEach((mod) => {
        if (selectedConfigs[mod.name] === undefined) {
          selectedConfigs[mod.name] = 0
        }
      })
    })

    if (filterText.value === '') {
      activeCollapseNames.value = []
    } else {
      activeCollapseNames.value = files.map((f) => f.filename)
    }
  },
  { immediate: true, deep: true }
)

// Wrapper for Drag Start to include the selected Configuration
function handleDragStart(event, module) {
  if (props.selectable) return

  const configIndex = selectedConfigs[module.name] || 0

  // We attach the specific config index to the drag payload
  // so the Builder knows which version to instantiate
  onDragStart(event, {
    ...module,
    configIndex,
  })
}

function openPreview(module, filename) {
  const configIndex = selectedConfigs[module.name] || 0

  previewTarget.value = {
    moduleName: module.name,
    filename: filename,
    configIndex: configIndex,
    // Pass the actual config object so the dialog is "dumb"
    configData: module.configs[configIndex],
  }
  showPreview.value = true
}

watch(
  () => store.availableModules,
  (currentModuleFiles) => {
    const newFileNames = []
    for (const file of currentModuleFiles) {
      if (!knownFilenames.value.has(file.filename)) {
        newFileNames.push(file.filename)
        knownFilenames.value.add(file.filename)
      }
    }
    // if (newFileNames.length > 0) {
    //   activeCollapseNames.value.push(...newFileNames)
    // }
  },
  {
    deep: true,
    // immediate: true,
  }
)

function handleSelect(module) {
  if (props.selectable) {
    emit('select', module)
  }
}
</script>

<style scoped>
.module-list {
  flex-grow: 1;
  overflow-y: auto;
  border: none;
}

:deep(.el-collapse-item__header) {
  font-weight: bold;
  font-size: 1.05em;
  background-color: #f9f9f9;
  border-radius: 4px;
  padding: 0 5px;
  margin-top: 5px;
}

:deep(.el-collapse-item__arrow) {
  /* This creates a small, 8px buffer between the
     arrow and the title, giving it room to rotate. */
  margin-right: 8px;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

:deep(.el-collapse-item__content) {
  padding: 10px 10px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-list-container {
  display: flex;
  flex-direction: column;
  flex-grow: 1; /* Makes the whole container fill the aside */
  min-height: 0; /* Fix for overflow in flex columns */
}

.filter-input {
  margin-bottom: 15px;
}

.module-card {
  cursor: grab;
  user-select: none; /* Prevent text selection while dragging */
  flex-shrink: 0;
}

.module-card.selectable {
  cursor: pointer;
}

.module-card.is-stub {
  opacity: 0.5;
  cursor: not-allowed;
}

.module-name {
  font-weight: bold;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-badge {
  margin-left: 8px;
}

.config-controls {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.config-select {
  flex-grow: 1;
}
</style>
