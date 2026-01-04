<template>
  <div class="ghost-node" :style="nodeStyle">
    <el-card class="ghost-card" shadow="hover" style="height: 100%; box-sizing: border-box;">
      <div class="module-name">
        <span class="ghost-icon">👻</span>
        <span class="label truncate"
          >Next: {{ targetNode?.data?.name || 'Unknown' }}</span
        >
      </div>
      <!-- non-editable label showing CellML component and source file (no white box) -->
      <div v-if="data.label" class="module-label">{{ data.label }}</div>
    </el-card>

    <template v-for="port in targetPorts" :key="port.uid" class="port">
      <Handle
        :id="getHandleId(port)"
        :position="portPosition(port.side)"
        :style="getHandleStyle(port, targetPorts)"
        class="port-handle"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useVueFlow, Handle } from '@vue-flow/core'
import { getHandleId, getHandleStyle, portPosition } from '../utils/ports'

const props = defineProps(['id', 'data'])
const { findNode } = useVueFlow()

const targetNode = computed(() => {
  if (!props.data.targetNodeId) return null
  return findNode(props.data.targetNodeId)
})

const targetPorts = computed(() => {
  return targetNode.value?.data?.ports || []
})

const nodeStyle = computed(() => {
  const node = targetNode.value
  
  // If we can't find dimensions yet, fallback or let content dictate size
  if (!node || !node.dimensions) {
    return {} 
  }

  return {
    width: `${node.dimensions.width}px`,
    height: `${node.dimensions.height}px`,
  }
})
</script>

<style scoped>
/* Visual styling to make it look "Ghostly" */
.ghost-card {
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
