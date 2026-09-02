<template>
  <div class="ghost-node" :style="nodeStyle">
    <Card class="ghost-card" shadow="hover" style="height: 100%; box-sizing: border-box">
      <template #title>
        <div class="module-name">
          <span class="ghost-icon">👻</span>
          <span class="label truncate">Next: {{ targetNode?.data?.name || 'Unknown' }}</span>
        </div>
      </template>
      <!-- non-editable label showing CellML component and source file (no white box) -->
      <template #subtitle>
        <div class="module-label">
          <span class="label truncate">{{ ghostLabel }}</span>
        </div>
      </template>
    </Card>

    <template v-for="handle in targetHandles" :key="handle.uid">
      <Handle
        :id="getHandleId(handle)"
        :position="handlePosition(handle.side)"
        :class="['handle', `handle--${handle.variant || 'default'}`]"
        :style="getHandleStyle(handle, targetHandles)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, watch, nextTick } from 'vue'

import Card from 'primevue/card'

import { useVueFlow, Handle } from '@vue-flow/core'
import { getHandleId, getHandleStyle, handlePosition } from '../utils/handles'
import { FLOW_IDS } from '../utils/constants'

const props = defineProps(['id', 'data'])
const { findNode, updateNodeInternals } = useVueFlow(FLOW_IDS.MACRO)

const ghostLabel = computed(() => {
  return `${props.data.mathRef.split(':')[1]} [${props.data.mathRef.split(':')[0]}]`
})

const targetNode = computed(() => {
  if (!props.data.targetNodeId) return null
  return findNode(props.data.targetNodeId)
})

const targetHandles = computed(() => {
  return targetNode.value?.data?.handles || []
})

const nodeStyle = computed(() => {
  const node = targetNode.value

  if (!node || !node.dimensions) {
    return {}
  }

  return {
    width: `${node.dimensions.width}px`,
    height: `${node.dimensions.height}px`,
  }
})

watch(
  targetHandles,
  async () => {
    await nextTick() 
    updateNodeInternals([props.id])
  }
)
</script>

<style scoped>
.vue-flow__handle.handle--default {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--p-text-color);
  opacity: 1;
}

.vue-flow__handle.handle--ghost {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: transparent;
  border: none;
  opacity: 0;
  pointer-events: none;
}

.vue-flow__handle.handle--ghost.valid {
  background-color: rgba(34, 197, 94, 0.15);
  border-color: #22c55e;  
  border-style: solid;
  opacity: 1;
}

/* Visual styling to make it look "Ghostly" */
.ghost-card {
  --p-card-color: #1f2937;
  outline: 2px dashed #ccc;
  outline-offset: -1px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0.8;
  border-radius: 8px;
  overflow: hidden;
}
.ghost-icon {
  font-size: 1.5em;
  margin-right: 5px;
}
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 90%; /* Prevent text from breaking the layout */
  vertical-align: middle;
}
</style>

<style lang="scss" scoped>
@import '../assets/vueflownode.css';
@import '../assets/vueflowhandle.css';
</style>
