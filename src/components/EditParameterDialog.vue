<template>
  <el-dialog
    :model-value="modelValue"
    title="Edit Parameters"
    width="800px"
    @closed="closeDialog"
    teleported
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
      <template v-if="hasVariables">
        <el-input
          v-model="searchQuery"
          :placeholder="`Search by variable ${searchColumn} ...`"
          clearable
          style="margin-bottom: 12px"
          ><template #append>
            <el-select v-model="searchColumn" style="width: 100px">
              <el-option label="Name" value="name" />
              <el-option label="Units" value="units" />
              <el-option label="Type" value="type" /> </el-select></template
        ></el-input>
        <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center">
          <span>Bulk Update Type:</span>
          <el-select v-model="bulkTypeValue" placeholder="Select type..." style="width: 200px">
            <el-option
              v-for="types in parameterTypeOptions"
              :key="types.value"
              :label="types.label"
              :value="types.value"
            />
          </el-select>
          <el-button type="primary" :disabled="selectedRows.length === 0" @click="applyBulkType">
            Apply to {{ selectedRows.length }} selected
          </el-button>
        </div>
        <el-table
          ref="parametersTable"
          :data="filteredParameterRows"
          style="width: 100%"
          max-height="400"
          :default-sort="{ prop: 'value', order: 'ascending' }"
          @sort-change="handleSortChange"
          @change="handleEntryChange"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="Variable" width="180" sortable="custom" />

          <el-table-column prop="value" label="Value" min-width="50" sortable="custom">
            <template #default="scope">
              <el-input
                v-if="!isEditableVariableType(scope.row.type)"
                v-model="scope.row.value"
                disabled
                placeholder="-"
              />

              <div v-else-if="scope.row.isAmbiguous" class="ambiguous-container">
                <el-select
                  v-model="scope.row.value"
                  placeholder="Select value..."
                  class="ambiguous-select"
                  filterable
                  allow-create
                  default-first-option
                  @change="handleAmbiguitySelection(scope.row)"
                >
                  <el-option v-for="opt in scope.row.valueOptions" :key="opt" :label="opt" :value="opt" />
                </el-select>
                <el-tooltip content="Multiple values found for this variable name and unit. Please select one.">
                  <el-icon class="warning-icon"><Warning /></el-icon>
                </el-tooltip>
              </div>

              <el-input v-else v-model="scope.row.value" placeholder="Enter value..." />
            </template>
          </el-table-column>

          <el-table-column prop="units" label="Units" width="150" sortable="custom" />

          <el-table-column prop="type" label="Type" width="200" sortable="custom">
            <template #default="scope">
              <el-select v-model="scope.row.type" @change="handleTypeChange(scope.row)">
                <el-option
                  v-for="types in parameterTypeOptions"
                  :key="types.value"
                  :label="types.label"
                  :value="types.value"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else class="error-state">
        <el-alert title="CellML component not found in available modules." type="error" :closable="false" show-icon />
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!hasVariables || !somethingChanged">
          Save Parameters
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import {
  ElDialog,
  ElInput,
  ElTable,
  ElTableColumn,
  ElSelect,
  ElOption,
  ElButton,
  ElAlert,
  ElTooltip,
  ElMessageBox,
} from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useVueFlow } from '@vue-flow/core'

import { useBuilderStore } from '../stores/builderStore'
import { isEditableVariableType } from '../utils/variables'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  nodeData: { type: Object, required: true },
})

const emit = defineEmits(['update:modelValue'])

const searchColumn = ref('name')
const searchQuery = ref('')
const builderStore = useBuilderStore()
const parameterRows = ref([])
const isLoading = ref(false)
const loadingText = ref('Loading parameters...')
const hasVariables = ref(false)
const parametersTable = ref(null)
const somethingChanged = ref(false)
const selectedRows = ref([])
const bulkTypeValue = ref('')
let variables = []

const { getNodes, updateNodeData } = useVueFlow()

const parameterTypeOptions = [
  { value: 'constant', label: 'constant' },
  { value: 'global_constant', label: 'global_constant' },
  { value: 'variable', label: 'variable' },
  { value: 'boundary_condition', label: 'boundary_condition' },
]

const filteredParameterRows = computed(() => {
  if (!searchQuery.value.trim()) {
    return parameterRows.value
  }

  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value // 'name', 'units', or 'type'

  return parameterRows.value.filter((row) => {
    // Get the value of the selected column safely.
    const targetValue = String(row[columnKey] || '').toLowerCase()

    // Check for match.
    return targetValue.includes(query)
  })
})

// Helper to look up values and detect ambiguity
function resolveValue(name, type, units, value) {
  if (!isEditableVariableType(type)) {
    return { value: '-', isAmbiguous: false, options: [] }
  }

  if (value) {
    return { value, isAmbiguous: false, options: [] }
  }

  // Determine lookup key based on type
  const lookupName = name + (type === 'global_constant' ? '' : '_' + props.instanceName)
  // Get all raw matches from store
  const allMatches = builderStore.getParameterValuesForInstanceVariable(lookupName)

  // We only care about values that were stored with the same units as the current variable
  const relevantMatches = allMatches.filter((match) => match?.units === units)

  // Extract unique values to avoid duplicates in dropdown
  // (e.g. if 3 modules all use T=310 Kelvin, we just show 310 once)
  const uniqueValues = [...new Set(relevantMatches.map((m) => m.value))]

  if (uniqueValues.length > 1) {
    return {
      value: '', // Force user to choose
      isAmbiguous: true,
      options: uniqueValues,
    }
  } else if (uniqueValues.length === 1) {
    return {
      value: uniqueValues[0],
      isAmbiguous: false,
      options: [],
    }
  }

  return { value: '', isAmbiguous: false, options: [] }
}

function loadData() {
  variables = []
  parametersTable.value.clearSort() // Clear any existing sort state
  const node = getNodes.value.find((n) => n.id === props.nodeData.nodeId)
  variables = node.data.variables || []
  parameterRows.value = variables.map((variable) => {
    const displayValue =
      variable.type === 'global_constant' ? builderStore.getGlobalConstant(variable.name)?.value : variable.value
    const result = resolveValue(variable.name, variable.type, variable.units, displayValue)

    return {
      name: variable.name,
      units: variable.units,
      type: variable.type,
      value: result.value,
      isAmbiguous: result.isAmbiguous,
      valueOptions: result.options,
    }
  })

  handleSortChange({ prop: 'type', order: 'ascending' }, true) // Initial sort with ambiguity check
}

// Initialize rows when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    parameterRows.value = []
    if (isOpen) {
      isLoading.value = true
      hasVariables.value = true
      somethingChanged.value = false
      selectedRows.value = []
      bulkTypeValue.value = ''

      await new Promise((resolve) => setTimeout(resolve, 50))

      try {
        loadData()
      } finally {
        isLoading.value = false
      }
    }
  }
)

function handleAmbiguitySelection(row) {
  row.isAmbiguous = false
  handleEntryChange() // Mark as changed when user resolves ambiguity
}

// Handle type change re-triggers lookup
function handleTypeChange(row) {
  const result = resolveValue(row.name, row.type, row.units)

  row.value = result.value
  row.isAmbiguous = result.isAmbiguous
  row.valueOptions = result.options
  handleEntryChange() // Mark as changed when user changes type
}

function handleEntryChange() {
  somethingChanged.value = true
}

function handleSelectionChange(selection) {
  selectedRows.value = selection
}

function applyBulkType() {
  if (!bulkTypeValue.value || selectedRows.value.length === 0) return

  selectedRows.value.forEach((row) => {
    row.type = bulkTypeValue.value
    handleTypeChange(row)
  })

  handleEntryChange()
  
  // Clear selections and bulk type after applying
  parametersTable.value.clearSelection()
  bulkTypeValue.value = ''
}

/**
 * Handle manual sorting.
 */
function handleSortChange({ prop, order }, ambiguityCheck = false) {
  if (!order) {
    prop = 'type' // Default sort by Type when user cancels sorting
    order = 'ascending'
    ambiguityCheck = true // Always check ambiguity for default sort to group them at the top
  }

  ambiguityCheck = ambiguityCheck || prop === 'value'

  parameterRows.value.sort((a, b) => {
    let result = 0

    // Property values comparison.
    if (ambiguityCheck) {
      // Special Logic for ambiguity checking.
      if (a.isAmbiguous && !b.isAmbiguous) result = -1
      else if (!a.isAmbiguous && b.isAmbiguous) result = 1
      else {
        // Compare actual values string.
        if (prop === 'value') {
          // For value column, we want to sort numbers numerically if possible
          const numA = parseFloat(a.value)
          const numB = parseFloat(b.value)

          if (!isNaN(numA) && !isNaN(numB)) {
            result = numA - numB
          } else if (!isNaN(numA) && isNaN(numB)) {
            result = -1 // Numbers come before non-numbers
          } else if (isNaN(numA) && !isNaN(numB)) {
            result = 1 // Non-numbers come after numbers
          } else {
            // Fallback to string comparison if not both are numbers
            const valA = String(a.value || '').toLowerCase()
            const valB = String(b.value || '').toLowerCase()
            result = valA.localeCompare(valB)
          }
        } else {
          const valA = String(a[prop] || '').toLowerCase()
          const valB = String(b[prop] || '').toLowerCase()
          result = valA.localeCompare(valB)
        }
      }
    } else {
      // Standard compare logic.
      const valA = String(a[prop] || '').toLowerCase()
      const valB = String(b[prop] || '').toLowerCase()
      result = valA.localeCompare(valB)
    }

    // If the primary values are DIFFERENT, respect the user's sort direction (Asc/Desc)
    if (result !== 0) {
      return order === 'ascending' ? result : -result
    }

    // If primary values are SAME (e.g. both are 'Constant'), sort by Name.
    // We force this to be Ascending (A-Z) for readability,
    // regardless of the primary column's sort direction.
    return a.name.localeCompare(b.name)
  })
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  // Check if user has selections and a bulk type chosen but hasn't applied
  if (selectedRows.value.length > 0 && bulkTypeValue.value) {
    try {
      await ElMessageBox.confirm(
        `You have ${selectedRows.value.length} row(s) selected with bulk type "${bulkTypeValue.value}" that hasn't been applied. Do you want to continue without applying these changes?`,
        'Unapplied Bulk Changes',
        {
          confirmButtonText: 'Save Without Applying',
          cancelButtonText: 'Go Back',
          type: 'warning',
        }
      )
    } catch {
      // User clicked "Go Back" or closed the dialog
      return
    }
  }

  parameterRows.value.forEach((row) => {
    // Only save if it's a parameter type and has a value
    if (isEditableVariableType(row.type)) {
      const variable = variables.find((v) => v.name === row.name)
      if (row.type === 'global_constant') {
        builderStore.assignGlobalConstant(row.name, row.value, row.units)
        variable.type = row.type // Update the node's variable type
        variable.value = undefined // Clear the value for global constants
      } else {
        variable.type = row.type // Update the node's variable type
        variable.value = row.value // Update the node's variable value
      }
    } else {
      // For non-editable types, we still want to update the type in case the user changed it
      const variable = variables.find((v) => v.name === row.name)
      variable.type = row.type
    }
  })

  updateNodeData(props.nodeData.nodeId, { variables }) // Persist changes to the store
  closeDialog()
}
</script>

<style scoped>
.error-state {
  padding: 20px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ambiguous-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ambiguous-select {
  flex-grow: 1;
}

.warning-icon {
  color: var(--el-color-warning);
  font-size: 18px;
  cursor: help;
}
</style>