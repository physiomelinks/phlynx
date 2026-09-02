<template>
  <canvas ref="canvasRef" class="vue-flow__canvas" />
</template>

<script setup>
import { useVueFlow } from '@vue-flow/core'
import { ref, watchEffect } from 'vue'
import { useColorScheme } from '../composables/useColorScheme'

const props = defineProps({
  horizontal: Number, // Position in Graph Coordinates
  vertical: Number, // Position in Graph Coordinates
  alignment: String, // 'centre' or other
})

const { viewport, dimensions } = useVueFlow()
const { isDarkMode } = useColorScheme()
const canvasRef = ref(null)

// Define styles in a config object.
const LINE_STYLES = {
  centre: { color: isDarkMode.value ? '#E5F0FE' : '#394455', width: 2 },
  default: { color: isDarkMode.value ? '#E5F0FE' : '#236AD5', width: 1.5 },
}

function updateCanvasHelperLines() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas) return

  // Handle DPI scaling for crisp lines.
  const dpi = window.devicePixelRatio || 1
  canvas.width = dimensions.value.width * dpi
  canvas.height = dimensions.value.height * dpi
  ctx.scale(dpi, dpi)

  // Clear and set global settings.
  ctx.clearRect(0, 0, dimensions.value.width, dimensions.value.height)
  ctx.globalAlpha = 0.4
  ctx.setLineDash([6, 6])

  // Encapsulate drawing logic.
  const drawGuide = (position, isVertical) => {
    // Determine style based on alignment prop.
    const style = LINE_STYLES[props.alignment] || LINE_STYLES.default
    ctx.strokeStyle = style.color
    ctx.lineWidth = style.width

    // Calculate screen coordinate from graph coordinate.
    // Graph -> Screen formula: (GraphPos * Zoom) + Pan
    const offset = isVertical ? viewport.value.x : viewport.value.y
    const screenPos = position * viewport.value.zoom + offset

    ctx.beginPath()
    if (isVertical) {
      ctx.moveTo(screenPos, 0)
      ctx.lineTo(screenPos, dimensions.value.height)
    } else {
      ctx.moveTo(0, screenPos)
      ctx.lineTo(dimensions.value.width, screenPos)
    }
    ctx.stroke()
  }

  // Draw lines if they are valid numbers.
  if (Number.isFinite(props.vertical)) {
    drawGuide(props.vertical, true)
  }

  if (Number.isFinite(props.horizontal)) {
    drawGuide(props.horizontal, false)
  }
}

watchEffect(updateCanvasHelperLines)
</script>

<style scoped>
.vue-flow__canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}
</style>
