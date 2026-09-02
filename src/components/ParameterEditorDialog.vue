<template>
  <Dialog
    v-model:visible="dialogVisible"
    header="Edit Parameters"
    modal
    :closable="!isLoading"
    :dismissableMask="!isLoading"
    :style="{ width: '850px', maxWidth: '95vw' }"
  >
    <div class="dialog-body">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-content">
          <ProgressSpinner style="width: 44px; height: 44px" strokeWidth="4" />
          <span>{{ loadingText }}</span>
        </div>
      </div>

      <template v-if="hasVariables">
        <!-- Action Toolbar -->
        <div class="toolbar-container">
          <!-- Search Group -->
          <div class="search-group">
            <div class="search-input-wrapper">
              <InputText
                v-model="searchQuery"
                size="small"
                :placeholder="`Search by ${searchColumn}...`"
                class="search-input"
              />
              <Button
                v-if="searchQuery"
                icon="pi pi-times"
                text
                rounded
                severity="secondary"
                size="small"
                class="clear-search-btn"
                @click="searchQuery = ''"
              />
            </div>

            <Select
              v-model="searchColumn"
              :options="searchColumnOptions"
              optionLabel="label"
              optionValue="value"
              size="small"
              class="search-column"
            />
          </div>

          <!-- Bulk Update Group -->
          <div class="bulk-controls">
            <span class="bulk-label">Bulk Type:</span>
            <Select
              v-model="bulkTypeValue"
              size="small"
              :options="PARAMETER_TYPE_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Select type..."
              class="bulk-select"
            />
            <Button
              size="small"
              :disabled="selectedRows.length === 0"
              @click="applyBulkType"
            >
              Apply ({{ selectedRows.length }})
            </Button>
          </div>
        </div>

        <!-- Parameters Table -->
        <DataTable
          ref="parametersTable"
          v-model:selection="selectedRows"
          :value="filteredParameterRows"
          dataKey="name"
          scrollable
          scrollHeight="420px"
          tableStyle="min-width: 100%"
          :sortField="sortField"
          :sortOrder="sortOrder"
          class="p-datatable-sm parameters-table"
          @sort="handleSortChange"
        >
          <Column selectionMode="multiple" headerStyle="width: 2.2rem" />
          
          <Column field="name" bodyClass="small-text-col" header="Variable" sortable style="min-width: 160px" />

          <Column field="value" header="Value" sortable style="min-width: 180px">
            <template #body="slotProps">
              <InputText
                v-if="isEditableVariableType(slotProps.data.type)"
                v-model="slotProps.data.value"
                size="small"
                placeholder="Enter value..."
                class="w-full"
              />
              <span v-else class="text-muted">-</span>
            </template>
          </Column>

          <Column field="units" bodyClass="small-text-col"header="Units" size="small" sortable style="min-width: 120px" />

          <Column field="type" header="Type" sortable style="min-width: 210px">
            <template #body="slotProps">
              <Select
                v-model="slotProps.data.type"
                :options="PARAMETER_TYPE_OPTIONS"
                optionLabel="label"
                optionValue="value"
                size="small"
                class="w-full"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button severity="secondary" size="small" @click="closeDialog">Cancel</Button>
        <Button size="small" @click="handleConfirm">Save Parameters</Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import { PARAMETER_TYPE_OPTIONS } from '../utils/constants'

import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useLibraryStore } from '../stores/libraryStore'
import { isEditableVariableType } from '../utils/variables'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: '',
  },
  variables: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'save'])

const searchColumn = ref('name')
const searchColumnOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Units', value: 'units' },
  { label: 'Type', value: 'type' },
]
const searchQuery = ref('')
const libraryStore = useLibraryStore()
const isLoading = ref(false)
const loadingText = ref('Loading parameters...')
const hasVariables = ref(false)
const parametersTable = ref(null)
const parameterRows = ref([])
const selectedRows = ref([])
const bulkTypeValue = ref('')
const sortField = ref('type')
const sortOrder = ref(1)
const { confirm } = useConfirmDialog()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const filteredParameterRows = computed(() => {
  if (!searchQuery.value.trim()) {
    return parameterRows.value
  }

  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value

  return parameterRows.value.filter((row) => {
    const targetValue = String(row[columnKey] || '').toLowerCase()
    return targetValue.includes(query)
  })
})

function sortParameterRows(field = 'type', order = 1) {
  parameterRows.value.sort((a, b) => {
    let result = 0
    const valA = String(a[field] || '').toLowerCase()
    const valB = String(b[field] || '').toLowerCase()
    result = valA.localeCompare(valB)

    if (result !== 0) {
      return order === 1 ? result : -result
    }

    return a.name.localeCompare(b.name)
  })
}

function loadData() {
  parameterRows.value = props.variables.map((row) => {
    const displayValue = row.type === 'global_constant' ? libraryStore.getGlobalConstant(row.name)?.value : row.value

    return {
      name: row.name,
      value: displayValue,
      units: row.units,
      type: row.type,
      access: row.access,
    }
  })

  sortParameterRows('type', 1)
  sortField.value = 'type'
  sortOrder.value = 1
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    parameterRows.value = []
    if (isOpen) {
      isLoading.value = true
      hasVariables.value = true
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

function applyBulkType() {
  if (!bulkTypeValue.value || selectedRows.value.length === 0) return

  const targetType = bulkTypeValue.value
  const rowsToUpdate = [...selectedRows.value]

  selectedRows.value = []
  bulkTypeValue.value = ''

  rowsToUpdate.forEach((row) => {
    row.type = targetType
  })
}

function handleSortChange(event) {
  const field = event?.sortField || 'type'
  const order = event?.sortOrder === -1 ? -1 : 1

  sortField.value = field
  sortOrder.value = order
  sortParameterRows(field, order)
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  if (selectedRows.value.length > 0 && bulkTypeValue.value) {
    const proceed = await confirm({
      header: 'Unapplied Bulk Changes',
      message: `You have ${selectedRows.value.length} row(s) selected with bulk type "${bulkTypeValue.value}" that hasn't been applied. Do you want to continue without applying these changes?`,
      severity: 'warning',
      acceptLabel: 'Save Without Applying',
      rejectLabel: 'Go Back',
    })

    if (!proceed) {
      return
    }
  }

  parameterRows.value.forEach((row) => {
    if (row.type === 'global_constant') {
      libraryStore.assignGlobalConstant(row.name, row.value, row.units, row.data_reference)
    }
  })

  emit('save', {
    id: props.id,
    variables: parameterRows.value,
  })

  closeDialog()
}
</script>

<style scoped>
.dialog-body {
  position: relative;
  min-height: 250px;
}

.parameters-table :deep(.small-text-col) {
  font-size: 0.85rem; /* Adjust font size as needed */
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--p-content-background, #fff) 80%, transparent);
  backdrop-filter: blur(2px);
  border-radius: 6px;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--p-text-color);
}

/* Toolbar & Action Bar Styling */
.toolbar-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 16px;
  background-color: var(--p-content-hover-background, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--p-content-border-color, #e5e7eb);
  border-radius: 8px;
}

.search-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 260px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.search-input {
  width: 100%;
}

.clear-search-btn {
  position: absolute;
  right: 4px;
  width: 1.5rem !important;
  height: 1.5rem !important;
  padding: 0 !important;
}

.search-column {
  width: 100px;
  flex-shrink: 0;
}

.bulk-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bulk-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.bulk-select {
  width: 180px; /* Expanded width to easily fit dropdown text */
}

/* Helper Utilities */
.w-full {
  width: 100%;
}

.text-muted {
  color: var(--p-text-muted-color);
  padding-left: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
