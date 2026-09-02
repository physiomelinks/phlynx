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
          <component
            v-if="item.icon && typeof item.icon !== 'string'"
            :is="item.icon"
            class="context-menu__icon"
          />
          <i
            v-else-if="item.icon"
            :class="['context-menu__icon', item.icon]"
          />
          
          <span>{{ item.label }}</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
    // Each item: { label: string, action: () => void, icon?: Component | string }
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
  /* Adaptive theme background & borders */
  background: var(--p-overlay-select-background, var(--p-content-background, var(--surface-overlay, #ffffff)));
  border: 1px solid var(--p-content-border-color, var(--surface-border, #e5e7eb));
  border-radius: var(--p-content-border-radius, var(--border-radius, 6px));
  box-shadow: var(--p-overlay-select-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1));
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
  font-size: 0.875rem;
  color: var(--p-text-color, var(--text-color, #1f2937));
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.context-menu__item:hover {
  /* Hover background and primary active text color */
  background-color: var(--p-content-hover-background, var(--surface-hover, #f3f4f6));
  color: var(--p-primary-color, var(--primary-color, #3b82f6));
}

.context-menu__icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>