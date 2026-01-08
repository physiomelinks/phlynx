import { ref } from 'vue'

export const useAutoClosingTooltip = (duration = 1000) => {
  const visible = ref(false)
  let timer = null

  const onMouseEnter = () => {
    visible.value = true
    
    // Clear existing timer to prevent early closing
    if (timer) clearTimeout(timer)
    
    // Set the auto-close timer
    timer = setTimeout(() => {
      visible.value = false
    }, duration)
  }

  const onMouseLeave = () => {
    visible.value = false
    if (timer) clearTimeout(timer)
  }

  // Return the state and handlers for this specific instance
  return {
    visible,
    onMouseEnter,
    onMouseLeave
  }
}
