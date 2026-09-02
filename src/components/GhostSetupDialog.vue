<template>
  <Dialog
    :visible="true"
    modal
    header="Configure Ghost Node"
    :style="{ width: '400px' }"
    :closable="false"
    :dismissableMask="false"
    :closeOnEscape="false"
    class="compact-dialog"
  >
    <p class="dialog-label">Select the node this ghost should mimic:</p>

    <Select
      v-model="selectedId"
      :options="availableNodes"
      :optionLabel="(node) => node.data?.name || node.id"
      optionValue="id"
      placeholder="Select a node..."
      class="select-info w-full"
    />

    <template #footer>
      <div class="dialog-footer">
        <!-- Built-in PrimeVue secondary button styles automatically handle dark mode -->
        <Button 
          label="Cancel" 
          severity="secondary"
          outlined
          class="compact-btn"
          @click="emit('cancel')" 
        />
        <Button
          label="Create Ghost"
          severity="info"
          class="compact-btn"
          @click="emit('confirm', selectedId)"
          :disabled="!selectedId"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { FLOW_IDS, GHOST_NODE_TYPE } from '../utils/constants'
import { notify } from '../utils/notify'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select' // Use 'primevue/dropdown' if using PrimeVue v3

const { getNodes } = useVueFlow(FLOW_IDS.MACRO)
const selectedId = ref('')

const availableNodes = computed(() => {
  return getNodes.value.filter((n) => n.type !== GHOST_NODE_TYPE)
})

const emit = defineEmits(['confirm', 'cancel'])

watch(
  availableNodes,
  (nodes) => {
    if (nodes.length === 0) {
      notify.warning({ title: 'No Available Nodes', message: 'No available nodes to ghost. Please add nodes first.' })
      emit('cancel')
    } else if (nodes.length === 1) {
      emit('confirm', nodes[0].id)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* --- Dynamic Label Color --- */
.dialog-label {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--p-text-muted-color, var(--text-color-secondary, #6b7280));
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* --- Dialog Spacing & Radius Overrides --- */
:deep(.compact-dialog) {
  border-radius: 4px !important;
}

:deep(.compact-dialog .p-dialog-header) {
  padding: 20px 20px 10px 20px;
}

:deep(.compact-dialog .p-dialog-title) {
  font-size: 18px;
  font-weight: 500;
  color: var(--p-text-color, var(--text-color, #1f2937));
}

:deep(.compact-dialog .p-dialog-content) {
  padding: 10px 20px 20px 20px;
}

:deep(.compact-dialog .p-dialog-footer) {
  padding: 10px 20px 20px 20px;
}

/* --- Select Compact Height & Radius --- */
:deep(.select-info) {
  border-radius: 4px;
  height: 32px;
  align-items: center;
}

/* Styles the active item inside the dropdown popup list to match */
:deep(.p-select-option.p-select-option-selected) {
  background: var(--p-sky-500, var(--p-blue-500, #0ea5e9)) !important;
  color: #ffffff !important;
}

/* --- Button Compact Height & Radius (Colors handled dynamically by PrimeVue) --- */
:deep(.compact-btn) {
  border-radius: 4px !important;
  height: 32px !important;
  padding: 0 15px !important;
  font-size: 14px !important;
}
</style>