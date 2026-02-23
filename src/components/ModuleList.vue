<template>
  <div class="mlc" :class="{ 'is-dragging': isDragging }">

    <!-- Sticky search -->
    <div class="mlc__search">
      <el-input
        v-model="filterText"
        placeholder="Search modules…"
        clearable
        :prefix-icon="Search"
        size="default"
      />
    </div>

    <!-- Module groups -->
    <div ref="scrollEl" class="mlc__scroll">
      <template v-if="filteredModuleFiles.length > 0">
        <div
          v-for="file in filteredModuleFiles"
          :key="file.filename"
          class="mlc__group"
        >
          <!-- Group header -->
          <button
            class="mlc__group-header"
            :class="{ 'is-open': activeCollapseNames.includes(file.filename) }"
            @click="toggleGroup(file.filename)"
          >
            <el-icon class="mlc__group-chevron"><ArrowRight /></el-icon>
            <span class="mlc__group-name"><span class="mlc__group-name-text">{{ displayName(file.filename) }}</span></span>
            <el-tag size="small" type="info" effect="plain" round class="mlc__group-count">
              {{ file.modules.length }}
            </el-tag>
          </button>

          <!-- Module cards -->
          <transition name="slide">
            <div v-show="activeCollapseNames.includes(file.filename)" class="mlc__group-body">
              <el-card
                v-for="module in file.modules"
                :key="module.name"
                class="mlc__card"
                :class="{
                  'mlc__card--selectable': selectable,
                  'mlc__card--stub': file.isStub,
                  'mlc__card--draggable': !selectable && !file.isStub,
                }"
                shadow="never"
                :body-style="{ padding: '0' }"
                :draggable="!selectable && !file.isStub"
                @dragstart="handleDragStart($event, module)"
                @dragend="handleDragEnd"
                @click="selectable && handleSelect(module)"
              >
                <div class="mlc__card-inner">
                  <!-- Drag grip -->
                  <span v-if="!selectable && !file.isStub" class="mlc__grip" aria-hidden="true">
                    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                      <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
                      <circle cx="2.5" cy="7"   r="1.5"/><circle cx="7.5" cy="7"   r="1.5"/>
                      <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
                    </svg>
                  </span>

                  <div class="mlc__card-body">
                    <!-- Name + actions row -->
                    <div class="mlc__card-header">
                      <span class="mlc__card-name">{{ module.name }}</span>
                      <div class="mlc__card-actions">
                        <el-tag
                          v-if="module.configs && module.configs.length > 1"
                          size="small"
                          type="primary"
                          effect="light"
                          round
                          class="mlc__badge"
                        >
                          {{ module.configs.length }} configs
                        </el-tag>
                        <el-tooltip
                          v-if="module.configs && module.configs.length >= 1"
                          content="Preview configuration"
                          placement="top"
                          :auto-close="TOOLTIP_AUTO_CLOSE"
                        >
                          <el-button
                            class="mlc__preview-btn"
                            size="small"
                            circle
                            :icon="View"
                            @click.stop="openPreview(module, file.filename)"
                          />
                        </el-tooltip>
                      </div>
                    </div>

                    <!-- Config selector -->
                    <div
                      v-if="!selectable && module.configs && module.configs.length > 1"
                      class="mlc__config-row"
                      @click.stop
                    >
                      <el-select
                        v-model="selectedConfigs[module.name]"
                        size="small"
                        class="mlc__config-select"
                      >
                        <el-option
                          v-for="(config, index) in module.configs"
                          :key="index"
                          :label="configLabel(config) || `Config ${index + 1}`"
                          :value="index"
                        />
                      </el-select>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </transition>
        </div>
      </template>

      <!-- Empty state -->
      <el-empty
        v-else
        :description="filterText ? `No modules match '${filterText}'` : 'No modules found'"
        :image-size="72"
      />
    </div>

    <ModulePreviewDialog v-model="showPreview" :module-data="previewTarget" />
  </div>
</template>

<script setup>
import { computed, ref, watch, reactive, onMounted, onBeforeUnmount } from 'vue'
import { View, Search, ArrowRight } from '@element-plus/icons-vue'
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
const selectedConfigs = reactive({})
const showPreview = ref(false)
const previewTarget = ref(null)
const isDragging = ref(false)
const scrollEl = ref(null)

function blockScroll(e) {
  if (isDragging.value) e.preventDefault()
}

onMounted(() => {
  scrollEl.value?.addEventListener('wheel', blockScroll, { passive: false })
})
onBeforeUnmount(() => {
  scrollEl.value?.removeEventListener('wheel', blockScroll)
})

// ─── Filtering ────────────────────────────────────────────────────────────────

const filteredModuleFiles = computed(() => {
  const q = filterText.value.toLowerCase()
  if (!q) return store.availableModules

  return store.availableModules
    .map((file) => ({
      ...file,
      modules: file.modules.filter((m) => m.name.toLowerCase().includes(q)),
    }))
    .filter((file) => file.modules.length > 0)
})

// ─── Accordion ───────────────────────────────────────────────────────────────

function toggleGroup(filename) {
  const idx = activeCollapseNames.value.indexOf(filename)
  if (idx === -1) activeCollapseNames.value.push(filename)
  else activeCollapseNames.value.splice(idx, 1)
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function displayName(filename) {
  return filename.replace(/\.cellml$/i, '').replaceAll('_', ' ')
}

function configLabel(config) {
  if (!config) return ''
  return [config.vessel_type, config.BC_type].filter(Boolean).join(' – ')
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(
  filteredModuleFiles,
  (files) => {
    files.forEach((file) => {
      file.modules.forEach((mod) => {
        if (selectedConfigs[mod.name] === undefined) selectedConfigs[mod.name] = 0
      })
    })
    activeCollapseNames.value = filterText.value ? files.map((f) => f.filename) : []
  },
  { immediate: true, deep: true }
)

watch(
  () => store.availableModules,
  (currentModuleFiles) => {
    for (const file of currentModuleFiles) {
      if (!knownFilenames.value.has(file.filename)) {
        knownFilenames.value.add(file.filename)
      }
    }
  },
  { deep: true }
)

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function handleDragStart(event, module) {
  if (props.selectable) return
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'copy'
  const configIndex = selectedConfigs[module.name] ?? 0
  onDragStart(event, { ...module, configIndex })
}

function handleDragEnd() {
  isDragging.value = false
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function openPreview(module, filename) {
  const configIndex = selectedConfigs[module.name] ?? 0
  previewTarget.value = {
    moduleName: module.name,
    filename,
    configIndex,
    configData: module.configs[configIndex],
  }
  showPreview.value = true
}

// ─── Selection ────────────────────────────────────────────────────────────────

function handleSelect(module) {
  if (props.selectable) emit('select', module)
}
</script>

<style scoped>
/* ── Tokens ──────────────────────────────────────────────────────────────────── */
.mlc {
  --mlc-bg:           #f5f7fa;
  --mlc-surface:      #ffffff;
  --mlc-border:       #e4e7ed;
  --mlc-border-hover: #c0c4cc;
  --mlc-accent:       var(--el-color-primary, #409eff);
  --mlc-accent-light: var(--el-color-primary-light-9, #ecf5ff);
  --mlc-text-primary: #303133;
  --mlc-text-regular: #606266;
  --mlc-text-muted:   #c0c4cc;
  --mlc-radius:       6px;
  --mlc-transition:   140ms ease;
}

/* ── Layout ──────────────────────────────────────────────────────────────────── */
.mlc {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--mlc-bg);
}

/* During drag, block pointer interactions on the list but keep overflow-y unchanged
   (toggling overflow-y causes a layout shift as the scrollbar appears/disappears).
   Scroll is blocked via a wheel event listener in script instead. */
.mlc.is-dragging .mlc__scroll {
  pointer-events: none;
}
.mlc.is-dragging .mlc__card--draggable {
  pointer-events: auto;
}

/* ── Search bar ──────────────────────────────────────────────────────────────── */
.mlc__search {
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--mlc-border);
  flex-shrink: 0;
  background: var(--mlc-surface);
}

/* ── Scroll container ────────────────────────────────────────────────────────── */
.mlc__scroll {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--mlc-border) transparent;
}
.mlc__scroll::-webkit-scrollbar { width: 4px; }
.mlc__scroll::-webkit-scrollbar-thumb {
  background: var(--mlc-border);
  border-radius: 2px;
}

/* ── Group ───────────────────────────────────────────────────────────────────── */
.mlc__group { margin-bottom: 2px; }

.mlc__group-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: calc(100% - 12px);
  margin: 0 6px;
  padding: 5px 8px;
  background: none;
  border: none;
  border-radius: var(--mlc-radius);
  cursor: pointer;
  color: var(--mlc-text-regular);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  transition: color var(--mlc-transition), background var(--mlc-transition);
}
.mlc__group-header:hover {
  color: var(--mlc-text-primary);
  background: var(--mlc-border);
}
.mlc__group-header.is-open {
  color: var(--mlc-accent);
  background: var(--mlc-accent-light);
}

.mlc__group-chevron {
  flex-shrink: 0;
  font-size: 12px;
  margin-top: 1px;
  transform: rotate(0deg);
  transition: transform var(--mlc-transition);
}
.mlc__group-header.is-open .mlc__group-chevron {
  transform: rotate(90deg);
}

.mlc__group-name {
  flex: 1;
  min-width: 0;
}

.mlc__group-name-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  overflow-wrap: normal;
  word-break: normal;
  line-height: 1.4;
}

.mlc__group-count {
  flex-shrink: 0;
  margin-top: 2px; /* optical alignment with first text line */
  font-variant-numeric: tabular-nums;
  /* Ensure the badge always has room and is never overlapped by the name */
  align-self: flex-start;
}

/* ── Slide transition ────────────────────────────────────────────────────────── */
.mlc__group-body {
  padding: 4px 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.slide-enter-active,
.slide-leave-active { transition: opacity 130ms ease, transform 130ms ease; }
.slide-enter-from,
.slide-leave-to     { opacity: 0; transform: translateY(-4px); }

/* ── Module card ─────────────────────────────────────────────────────────────── */
.mlc__card {
  border: 1px solid var(--mlc-border) !important;
  border-radius: var(--mlc-radius) !important;
  background: var(--mlc-surface) !important;
  transition: border-color var(--mlc-transition), box-shadow var(--mlc-transition) !important;
  user-select: none;
}

.mlc__card--draggable { cursor: grab; }
.mlc__card--draggable:active { cursor: grabbing; }
.mlc__card--selectable { cursor: pointer; }
.mlc__card--stub { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.mlc__card--draggable:hover,
.mlc__card--selectable:hover {
  border-color: var(--mlc-accent) !important;
  box-shadow: 0 0 0 2px var(--mlc-accent-light), 0 2px 6px rgba(0,0,0,0.06) !important;
}

/* ── Card inner layout ───────────────────────────────────────────────────────── */
.mlc__card-inner {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

/* ── Grip ────────────────────────────────────────────────────────────────────── */
.mlc__grip {
  padding: 9px 0 9px 8px;
  color: var(--mlc-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--mlc-transition);
}
.mlc__card--draggable:hover .mlc__grip { opacity: 1; }

/* ── Card body ───────────────────────────────────────────────────────────────── */
.mlc__card-body {
  flex: 1;
  min-width: 0;
  padding: 8px 8px 8px 0;
}
.mlc__card-inner:not(:has(.mlc__grip)) .mlc__card-body { padding-left: 10px; }

.mlc__card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mlc__card-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--mlc-text-primary);
}

.mlc__card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Preview button always visible */
.mlc__preview-btn {
  opacity: 1;
}

/* ── Config row ──────────────────────────────────────────────────────────────── */
.mlc__config-row { margin-top: 6px; }

.mlc__config-select { width: 100%; }
</style>