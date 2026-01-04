<template>
  <el-dialog
    :model-value="true"
    title="Configure Ghost Node"
    width="400px"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
  >
    <p>Select the node this ghost should mimic:</p>

    <el-select
      v-model="selectedId"
      placeholder="Select a node..."
      style="width: 100%"
    >
      <el-option
        v-for="node in availableNodes"
        :key="node.id"
        :label="`${node.data.name || node.data.label || node.id}`"
        :value="node.id"
      />
    </el-select>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('cancel')">Cancel</el-button>
        <el-button
          type="primary"
          @click="$emit('confirm', selectedId)"
          :disabled="!selectedId"
        >
          Create Ghost
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { FLOW_IDS, GHOST_NODE_TYPE } from '../utils/constants'

// Make sure we look at the MACRO flow, not the main flow
const { getNodes } = useVueFlow(FLOW_IDS.MACRO)
const selectedId = ref('')

const availableNodes = computed(() => {
  // Filter out other Ghost Nodes to prevent circular chains
  return getNodes.value.filter((n) => n.type !== GHOST_NODE_TYPE)
})

defineEmits(['confirm', 'cancel'])
</script>
