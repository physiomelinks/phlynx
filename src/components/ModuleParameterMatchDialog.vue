<template>
  <el-dialog
    :model-value="modelValue"
    title="Module Parameter File Matching"
    width="800px"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <span>
      Assign parameter files to modules to provide variable values during
      simulation.
    </span>
    <el-divider></el-divider>
    <el-table :data="associationTable">
      <el-table-column prop="moduleSource" label="Module" />

      <el-table-column label="Parameter Source">
        <template #default="scope">
          <el-select
            v-model="scope.row.matchedParameterFile"
            filterable
            placeholder="Select a file"
          >
            <el-option
              v-for="file in availableFiles"
              :key="file.name"
              :label="file.name"
              :value="file.name"
            />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="Match Info">
        <template #default="scope">
          <div v-if="scope.row.matchedParameterFile">
            <el-tooltip
              :visible="
                tagTooltip.visible.value &&
                currentHoveredId === scope.row.moduleSource
              "
              trigger="manual"
            >
              <el-tag
                :type="getMatchStatus(scope.row).color"
                class="match-tag"
                :style="getTagStyle(scope.row)"
                @mouseenter="onTagMouseEnter(scope.row.moduleSource)"
                @mouseleave="onTagMouseLeave"
              >
                {{ getMatchStatus(scope.row).text }}
              </el-tag>
              <template #content>
                {{ getMatchStatus(scope.row).tooltip }}
              </template>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm"> Save </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick , ref, watch } from 'vue'
import {
  ElTable,
  ElTableColumn,
  ElSelect,
  ElOption,
  ElButton,
  ElTag,
  ElTooltip,
} from 'element-plus'
import { useBuilderStore } from '../stores/builderStore'
import { notify } from '../utils/notify'
import { generateParameterAssociations } from '../utils/parameters'
import { useAutoClosingTooltip } from '../composables/useAutoClosingTooltip'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const builderStore = useBuilderStore()
const tagTooltip = useAutoClosingTooltip()
const associationTable = ref([])
const currentHoveredId = ref(null)

// --- Data Preparation ---

/**
 * Regenerates the matching table.
 * Called automatically every time the dialog opens.
 */
function prepareData() {
  const rawSuggestions = generateParameterAssociations(
    builderStore.availableModules,
    builderStore.parameterFiles
  )

  associationTable.value = rawSuggestions.map((item) => ({
    ...item,
    // If the store already has a saved link, prefer that over the auto-suggestion
    matchedParameterFile:
      builderStore.moduleParameterMap.get(item.moduleSource) ||
      item.matchedParameterFile,
  }))
}

// --- Logic for the UI ---

function onTagMouseEnter(rowId) {
  currentHoveredId.value = rowId
  tagTooltip.onMouseEnter()
}

function onTagMouseLeave() {
  tagTooltip.onMouseLeave()
}

function getTagStyle(row) {
  const status = getMatchStatus(row)

  // Base style for all tags.
  const baseStyle = {
    width: '100%',
    display: 'block',
    textAlign: 'center',
    transition: 'all 0.3s ease',
    border: '1px solid var(--el-border-color-lighter)',
  }

  // Handle "Manual" or "Missing" (Full solid color or default).
  if (status.text === 'Manual' || status.text === 'Missing') {
    return {
      ...baseStyle,
      backgroundColor: 'var(--el-fill-color-light)', // Light gray
      borderColor: 'var(--el-border-color)',
    }
  }

  // Extract the percentage number from the text (e.g., "85%").
  const percentVal = parseInt(status.text)

  // Determine colour variable based on status type.
  let colorVar = '--el-color-primary-light-5'
  if (status.type === 'success') colorVar = '--el-color-success-light-5'
  if (status.type === 'warning') colorVar = '--el-color-warning-light-5'
  if (status.type === 'danger') colorVar = '--el-color-danger-light-5'

  // Create the "Health Bar" gradient.
  return {
    ...baseStyle,
    background: `linear-gradient(90deg, var(${colorVar}) ${percentVal}%, transparent ${percentVal}%)`,
    borderColor: `var(${colorVar.replace('light-5', 'light-3')})`,
    color: '#303133',
    fontWeight: 'bold',
  }
}

/**
 * Computes the status color/text based on the *currently* selected file.
 * We cannot just use the static analysis from 'generateParameterAssociations'
 * because the user might change the dropdown selection.
 */
function getMatchStatus(row) {
  if (!row.matchedParameterFile) {
    return {
      type: 'danger',
      text: 'Missing',
      tooltip: 'No parameter file selected',
    }
  }

  // If the selection matches the auto-suggestion, we can re-use the pre-calculated stats.
  if (row.matchedParameterFile === row.bestMatchFile) {
    const { matched, total } = row.matchStats
    const percentage = total === 0 ? 100 : Math.round((matched / total) * 100)

    if (percentage === 100)
      return { type: 'success', text: '100%', tooltip: 'Perfect match' }
    if (percentage >= 80)
      return {
        type: 'warning',
        text: `${percentage}%`,
        tooltip: `Matched ${matched}/${total} variables`,
      }
    return {
      type: 'danger',
      text: `${percentage}%`,
      tooltip: `Poor match (${matched}/${total})`,
    }
  }

  // Fallback for manual selection.
  return {
    type: 'info',
    text: 'Manual',
    tooltip: 'User manually selected this file',
  }
}

const availableFiles = computed(() => {
  // Convert the Map keys to an array for the el-select options.
  return Array.from(builderStore.parameterFiles.keys()).map((name) => ({
    name,
  }))
})

// --- Dialog Controls ---

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  // Validation: Warn if any modules are unassigned.
  const missing = associationTable.value.filter(
    (row) => !row.matchedParameterFile
  )
  if (missing.length > 0) {
    notify.warning({
      title: 'Incomplete Configuration',
      message: `${missing.length} modules have no parameter file assigned.`,
    })
  }

  // Construct the Map for the store.
  const linkMap = new Map()
  associationTable.value.forEach((row) => {
    if (row.matchedParameterFile) {
      linkMap.set(row.moduleSource, row.matchedParameterFile)
    }
  })

  // Save to Store.
  builderStore.applyParameterLinks(linkMap)

  if (missing.length > 0) await nextTick()
  notify.success({ title: 'Saved', message: 'Parameter links updated.' })
  closeDialog()
}

// --- Watcher ---

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      prepareData()
    }
  }
)
</script>

<style scoped>
.match-tag {
  /* ensure text sits on top of the gradient */
  position: relative;
  /* Removing default padding if you want the bar to hit the edges exactly */
  padding: 0;
}
</style>
