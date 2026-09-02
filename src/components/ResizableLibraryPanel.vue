<template>
  <div
    class="resizable-library-panel"
    :class="{ 'resizable-library-panel--inline': !overlay }"
    ref="panelRef"
  >
    <aside
      :style="{ width: isCollapsed ? '0px' : width + 'px' }"
      class="module-aside"
      :class="{ 'module-aside--collapsed': isCollapsed }"
    >
      <h4 class="module-aside-title">{{ title }}</h4>
      <div class="module-aside-content">
        <slot />
      </div>
    </aside>

    <div
      class="resize-handle"
      :class="{ 'resize-handle--disabled': isCollapsed }"
      @mousedown="!isCollapsed && startResize($event)"
    >
      <button
        type="button"
        class="aside-collapse-toggle"
        @mousedown.stop
        @click="toggleCollapsed"
        v-tooltip.right="isCollapsed ? 'Show module library' : 'Hide module library'"
      >
        <i :class="isCollapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useResizableAside } from '../composables/useResizableAside'

const props = defineProps({
  title: {
    type: String,
    default: 'Available Modules',
  },
  initialWidth: {
    type: Number,
    default: 300,
  },
  minWidth: {
    type: Number,
    default: 150,
  },
  maxWidth: {
    type: Number,
    default: 400,
  },
  overlay: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['resize'])

const panelRef = ref(null)

const { width, startResize } = useResizableAside(
  props.initialWidth,
  props.minWidth,
  props.maxWidth,
  'left',
  panelRef
)
const isCollapsed = ref(false)

const effectiveWidth = computed(() => (isCollapsed.value ? 0 : width.value))

watch(effectiveWidth, (val) => emit('resize', val), { immediate: true })

function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.resizable-library-panel {
  display: flex;
  height: 100%;
}

.resizable-library-panel:not(.resizable-library-panel--inline) {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 20;
}

.resizable-library-panel--inline {
  position: relative;
  flex-shrink: 0;
}

.module-aside {
  background-color: var(--p-content-background);
  border-right: 1px solid var(--p-content-border-color);
  padding: 1rem;
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: 4px 0px color-mix(in srgb, var(--p-text-color) 15%, transparent);
  transition: width 160ms ease, padding 160ms ease;
}

.module-aside--collapsed {
  padding: 0;
  border-right: none;
}

.module-aside-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.module-aside-content {
  height: 100%;
  overflow: hidden;
}

.resize-handle {
  position: relative;
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background-color: var(--p-content-border-color);
  transition: background-color 120ms ease;
}

.resize-handle:hover {
  background-color: var(--p-primary-color);
}

.resize-handle--disabled {
  cursor: default;
}

.aside-collapse-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 50%;
  background: var(--p-content-background);
  color: var(--p-text-muted-color);
  font-size: 10px;
  cursor: pointer;
  z-index: 2;
  transition: color 120ms ease, border-color 120ms ease;
}

.aside-collapse-toggle:hover {
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
}
</style>
