import { ref, onUnmounted } from 'vue'

export function useConnectionAutoscroll(canvasEl) {
  const draggingFrom = ref(null)
  let connectScrollRaf = null
  const mousePos = { x: 0, y: 0 }
  let startScrollTop = 0
  let jitterToggle = false 
  let activePointerId = 0

  const CONNECT_AUTOSCROLL_ZONE = 60
  const CONNECT_AUTOSCROLL_SPEED = 12

  function onConnectMouseMove(event) {
    // Only capture real user mouse movements, ignore our synthetic events
    if (!event.isTrusted) return
    mousePos.x = event.clientX
    mousePos.y = event.clientY

    if (event.pointerId !== undefined) {
      activePointerId = event.pointerId
    }
    
    const el = canvasEl.value
    if (!el) return

    const scrollDelta = el.scrollTop - startScrollTop

    // 2. If the container is scrolled, the real event coordinates are wrong for Vue Flow.
    if (scrollDelta !== 0) {
      // Stop the real event from reaching Vue Flow's document listeners
      event.stopPropagation() 

      const targetY = mousePos.y + scrollDelta

      // 3. Immediately dispatch a corrected event
      const eventOpts = {
        clientX: mousePos.x,
        clientY: targetY,
        screenX: mousePos.x,
        screenY: targetY,
        pointerId: activePointerId || 1,
        pointerType: 'mouse',
        buttons: 1, 
        bubbles: true,
        cancelable: true,
        view: window
      }
      
      document.dispatchEvent(new PointerEvent('pointermove', eventOpts))
      document.dispatchEvent(new MouseEvent('mousemove', eventOpts))
    }
  }

  function startConnectAutoScroll() {
    if (connectScrollRaf) return
    window.addEventListener('mousemove', onConnectMouseMove, { capture: true })
    window.addEventListener('pointermove', onConnectMouseMove, { capture: true })

    function tick() {
      if (!draggingFrom.value) { stopConnectAutoScroll(); return }
      const el = canvasEl.value
      if (!el) { connectScrollRaf = null; return }

      const rect = el.getBoundingClientRect()
      const vy = mousePos.y - rect.top
      const canvasH = el.clientHeight
      const maxScroll = el.scrollHeight - canvasH
      
      let scrolled = false

      // Scroll Up
      if (vy < CONNECT_AUTOSCROLL_ZONE && el.scrollTop > 0) {
        const speed = CONNECT_AUTOSCROLL_SPEED * (1 - Math.max(0, vy) / CONNECT_AUTOSCROLL_ZONE)
        el.scrollTop = Math.max(0, el.scrollTop - speed)
        scrolled = true
      } 

      // Scroll Down
      else if (vy > canvasH - CONNECT_AUTOSCROLL_ZONE && el.scrollTop < maxScroll) {
        const speed = CONNECT_AUTOSCROLL_SPEED * (1 - (canvasH - vy) / CONNECT_AUTOSCROLL_ZONE)
        el.scrollTop = Math.min(maxScroll, el.scrollTop + speed)
        scrolled = true
      }

      if (scrolled) {
        // Toggle jitter between +0.1 and -0.1 to force Vue Flow to recalculate 
        // the coordinate projection against the new scrollTop position.
        jitterToggle = !jitterToggle
        const jitter = jitterToggle ? 0.1 : -0.1
        const scrollDelta = el.scrollTop - startScrollTop 

        const eventOpts = {
          clientX: mousePos.x + jitter,
          clientY: mousePos.y + jitter + scrollDelta,
          screenX: mousePos.x + jitter,
          screenY: mousePos.y + jitter + scrollDelta,
          buttons: 1,
          pointerType: 'mouse',
          pointerId: activePointerId,
          bubbles: true,
          cancelable: true,
          view: window
        }

        document.dispatchEvent(new PointerEvent('pointermove', eventOpts))
        document.dispatchEvent(new MouseEvent('mousemove', eventOpts))
      }

      connectScrollRaf = requestAnimationFrame(tick)
    }

    connectScrollRaf = requestAnimationFrame(tick)
  }

  function stopConnectAutoScroll() {
    if (connectScrollRaf) { 
      cancelAnimationFrame(connectScrollRaf)
      connectScrollRaf = null 
    }

    window.removeEventListener('mousemove', onConnectMouseMove, { capture: true })
    window.removeEventListener('pointermove', onConnectMouseMove, { capture: true })
  }

  function onConnectStart({ nodeId, handleId, handleType }) {
    const isGhost = nodeId === 'ghost-src' || nodeId === 'ghost-tgt'
    const uid  = isGhost ? nodeId : nodeId?.replace('src-', '').replace('tgt-', '')
    const side = nodeId === 'ghost-src' ? 'source'
               : nodeId === 'ghost-tgt' ? 'target'
               : handleType === 'source' ? 'source' : 'target'

    draggingFrom.value = { uid, side }
    startScrollTop = canvasEl.value?.scrollTop ?? 0
    startConnectAutoScroll()
  }

  function onConnectEnd() {
    draggingFrom.value = null
    stopConnectAutoScroll()
  }

  function onEdgeUpdateStart({ edge, type }) {
    // `type` tells us which end of the edge we grabbed ('source' or 'target').
    // We want to calculate the data for the *opposite* (fixed) end.
    const isDraggingTarget = type === 'target'
    const fixedNodeId = isDraggingTarget ? edge.source : edge.target
    const fixedSide = isDraggingTarget ? 'source' : 'target'
    
    // Extract the UID exactly like you do in onConnectStart
    const uid = fixedNodeId?.replace('src-', '')?.replace('tgt-', '')
               
    draggingFrom.value = { uid, side: fixedSide }
    startScrollTop = canvasEl.value?.scrollTop ?? 0
    
    // Start the identical autoscroll loop
    startConnectAutoScroll()
  }

  function onEdgeUpdateEnd() {
    draggingFrom.value = null
    stopConnectAutoScroll()
  }

  onUnmounted(() => {
    stopConnectAutoScroll()
  })

  return {
    draggingFrom,
    onConnectStart,
    onConnectEnd,
    onEdgeUpdateStart,
    onEdgeUpdateEnd,
  }
}
