<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="context-menu"
      :style="{ top: y + 'px', left: x + 'px' }"
      role="menu"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <ul class="context-menu__list">
        <li
          v-for="item in items"
          :key="item.label"
          class="context-menu__item"
          role="menuitem"
          @click="select(item)"
        >
          <el-icon v-if="item.icon" class="context-menu__icon">
            <component :is="item.icon" />
          </el-icon>
          {{ item.label }}
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElIcon } from 'element-plus'

const props = defineProps({
  items: {
    type: Array,
    required: true,
    // Each item: { label: string, action: () => void, icon?: Component }
  },
  closeDelay: {
    type: Number,
    default: 800,
  },
})

const isOpen = ref(false)
const x = ref(0)
const y = ref(0)
let closeTimer = null

function open(clientX, clientY) {
  x.value = clientX
  y.value = clientY
  isOpen.value = true
  closeTimer = setTimeout(close, props.closeDelay)
}

function close() {
  clearTimeout(closeTimer)
  isOpen.value = false
}

function select(item) {
  item.action()
  close()
}

function onMouseEnter() {
  clearTimeout(closeTimer)
}

function onMouseLeave() {
  closeTimer = setTimeout(close, props.closeDelay)
}

function onClickOutside() {
  if (isOpen.value) {
    close()
  }
}

function onKeyDown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('contextmenu', onClickOutside)
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  clearTimeout(closeTimer)
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('contextmenu', onClickOutside)
  document.removeEventListener('keydown', onKeyDown)
})

defineExpose({ open, close })
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
  padding: 4px 0;
  user-select: none;
}

.context-menu__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.context-menu__item:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.context-menu__icon {
  font-size: 14px;
  flex-shrink: 0;
}
</style>