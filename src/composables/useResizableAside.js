import { ref, onUnmounted, unref } from 'vue'

/**
 * @param {number} initialWidth
 * @param {number} min
 * @param {number} max
 * @param {'left' | 'right'} anchor
 * @param {import('vue').Ref<HTMLElement|null>} [containerRef]
 */
export function useResizableAside(
  initialWidth = 250,
  min = 200,
  max = 500,
  anchor = 'left',
  containerRef = null
) {
  const width = ref(initialWidth)

  const getContainerRect = () => {
    const el = unref(containerRef)
    if (el) return el.getBoundingClientRect()
    return { left: 0, right: window.innerWidth }
  }

  const onResizing = (event) => {
    event.preventDefault()

    const rect = getContainerRect()

    const rawWidth =
      anchor === 'right'
        ? rect.right - event.clientX
        : event.clientX - rect.left

    width.value = Math.max(min, Math.min(rawWidth, max))
  }

  const stopResize = () => {
    window.removeEventListener('mousemove', onResizing)
    window.removeEventListener('mouseup', stopResize)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  const startResize = (event) => {
    event.preventDefault()

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('mousemove', onResizing)
    window.addEventListener('mouseup', stopResize)
  }

  onUnmounted(() => {
    stopResize()
  })

  return {
    width,
    startResize
  }
}
