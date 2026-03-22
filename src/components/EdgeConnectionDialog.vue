<template>
  <el-dialog
    :model-value="modelValue"
    width="1200px"
    top="4vh"
    teleported
    :show-close="false"
    :style="{ maxHeight: '92vh' }"
    @closed="onClosed"
    @update:model-value="$emit('update:modelValue', $event)"
    @wheel.stop
  >
    <!-- Custom header -->
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">
          <span class="title-icon">⇌</span>
          <span>Port Connections</span>
        </div>
        <div class="node-names" v-if="sourceNode && targetNode">
          <span class="node-badge source-badge">{{ sourceNode.data.name }}</span>
          <span class="arrow-sep">→</span>
          <span class="node-badge target-badge">{{ targetNode.data.name }}</span>
        </div>
      </div>
    </template>

    <div v-if="sourceNode && targetNode" class="root">

      <!-- Column headers -->
      <div class="col-headers">
        <div class="col-header-label source-side">
          <span class="side-label">SOURCE</span>
          <div class="col-subheaders">
            <span style="width:64px">Type</span>
            <span style="width:170px">Label</span>
            <span style="flex:1">Variables</span>
            <span style="width:80px">Multiport</span>
            <span style="width:28px"></span>
          </div>
        </div>
        <div class="mid-spacer"></div>
        <div class="col-header-label target-side">
          <span class="side-label">TARGET</span>
          <div class="col-subheaders">
            <span style="width:28px"></span>
            <span style="width:64px">Type</span>
            <span style="width:170px">Label</span>
            <span style="flex:1">Variables</span>
            <span style="width:80px">Multiport</span>
          </div>
        </div>
      </div>

      <!-- VueFlow canvas -->
      <div ref="canvasEl" class="flow-canvas" @wheel.stop.prevent="onCanvasWheel">
        <div :style="{ height: canvasHeight + 'px', position: 'relative' }">
        <VueFlow
          :id="FLOW_ID"
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-draggable="false"
          :nodes-connectable="true"
          :elements-selectable="false"
          :pan-on-drag="false"
          :pan-on-scroll="false"
          :auto-pan-on-node-drag="false"
          :auto-pan-on-connect="false"
          :zoom-on-scroll="false"
          :zoom-on-pinch="false"
          :zoom-on-double-click="false"
          :edges-updatable="true"
          :auto-connect="false"
          :is-valid-connection="isValidConnection"
          @pane-click="onPaneClick"
          @connect="onConnect"
          @edge-update="onEdgeUpdate"
          @connect-start="onConnectStart"
          @connect-end="onConnectEnd"
        >
          <!-- Source port row -->
          <template #node-sourcePort="{ data }">
            <div
              :class="['port-row', 'port-row--source', rowClass(data), { 'row--valid-target': validConnectUids.has(data.port._uid) }]"
              :style="rowStyle(data)"
            >
              <div class="port-controls" @mousedown.stop>
                <el-select v-model="data.port.portType" size="small" style="width:64px" @change="onPortConfigChange">
                  <el-option v-for="o in portTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-model="data.port.label" size="small" style="width:170px" @input="onPortConfigChange" />
                <el-select v-model="data.port.option" multiple collapse-tags size="small" style="flex:1" @change="onPortConfigChange">
                  <el-option v-for="o in sourceNode.data.portOptions" :key="o.name" :label="o.name" :value="o.name" />
                </el-select>
                <el-select v-model="data.port.multiport" size="small" style="width:80px" @change="onPortConfigChange">
                  <el-option v-for="o in multiportOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <span class="drag-handle" @mousedown.stop="startDrag($event, data.port._uid, 'source')">⠿</span>
                <el-button type="danger" :icon="Delete" circle plain size="small" @click="deletePort(data.port._uid, 'source')" />
              </div>
              <Handle
                type="source"
                id="out"
                :position="Position.Right"
                :class="['port-handle', handleClass(data), { 'handle--valid-target': validConnectUids.has(data.port._uid) }]"
              />
            </div>
          </template>

          <!-- Target port row -->
          <template #node-targetPort="{ data }">
            <div
              :class="['port-row', 'port-row--target', rowClass(data), { 'row--valid-target': validConnectUids.has(data.port._uid) }]"
              :style="rowStyle(data)"
            >
              <Handle
                type="target"
                id="in"
                :position="Position.Left"
                :class="['port-handle', handleClass(data), { 'handle--valid-target': validConnectUids.has(data.port._uid) }]"
              />
              <div class="port-controls" @mousedown.stop>
                <span class="drag-handle" @mousedown.stop="startDrag($event, data.port._uid, 'target')">⠿</span>
                <el-button type="danger" :icon="Delete" circle plain size="small" @click="deletePort(data.port._uid, 'target')" />
                <el-select v-model="data.port.portType" size="small" style="width:64px" @change="onPortConfigChange">
                  <el-option v-for="o in portTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input v-model="data.port.label" size="small" style="width:170px" @input="onPortConfigChange" />
                <el-select v-model="data.port.option" multiple collapse-tags size="small" style="flex:1" @change="onPortConfigChange">
                  <el-option v-for="o in targetNode.data.portOptions" :key="o.name" :label="o.name" :value="o.name" />
                </el-select>
                <el-select v-model="data.port.multiport" size="small" style="width:80px" @change="onPortConfigChange">
                  <el-option v-for="o in multiportOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </div>
            </div>
          </template>

          <!-- Ghost port row -->
          <template #node-ghostPort="{ data }">
            <div
              :class="['port-row', data.side === 'source' ? 'port-row--source' : 'port-row--target', 'port-row--ghost']"
              @click="activateGhost(data.side)"
            >
              <template v-if="data.side === 'source'">
                <div class ="port-controls ghost-controls" @mousedown.stop>
                  <span class="ghost-label">
                    <el-icon><Plus /></el-icon>
                    Add Port
                  </span>
                </div>
                <Handle
                  type="source" id="out"
                  :position="Position.Right"
                  :class="['port-handle', draggingFrom?.side === 'target' && draggingFrom?.uid !== 'ghost-tgt' ? 'handle--valid-target' : 'handle--free']"
                />
              </template>
              <template v-else>
                <Handle
                  type="target" id="in"
                  :position="Position.Left"
                  :class="['port-handle', draggingFrom?.side === 'source' && draggingFrom?.uid !== 'ghost-src' ? 'handle--valid-target' : 'handle--free']"
                />
                <div class ="port-controls ghost-controls" @mousedown.stop>
                  <span class="ghost-label">
                    <el-icon><Plus /></el-icon>
                    Add Port
                  </span>
                </div>
              </template>
            </div>
          </template>
        </VueFlow>
        </div>
      </div>

      <!-- Legend -->
      <div class="bottom-bar">
        <div class="legend">
          <span class="legend-item"><span class="legend-dot dot-connected"></span>Connected</span>
          <span class="legend-item"><span class="legend-dot dot-taken"></span>Taken (single)</span>
          <span class="legend-item"><span class="legend-dot dot-taken-multi"></span>Taken (multiport)</span>
          <span class="legend-item"><span class="legend-dot dot-free"></span>Free</span>
        </div>
      </div>
    </div>

    <!-- Swap confirmation dialog -->
    <el-dialog
      v-model="swapDialog.visible"
      title="Port already connected"
      width="380px"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      append-to-body
    >
      <span>This port is already connected. What would you like to do?</span>
      <template #footer>
        <el-button @click="resolveSwap('cancel')">Cancel</el-button>
        <el-button @click="resolveSwap('overwrite')">Replace</el-button>
        <el-button v-if="swapDialog.canSwap" type="primary" @click="resolveSwap('swap')">Swap</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm">Done</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { VueFlow, Position, Handle, useVueFlow } from '@vue-flow/core'
import { FLOW_IDS, ROW_H, NODE_W, MID_GAP, PAD, 
  portTypeOptions, multiportOptions, TARGET_COMPATIBLE,
  AUTOSCROLL_SPEED, AUTOSCROLL_ZONE,
 } from '../utils/constants'
import { detachReactivity } from '../utils/reactivity'

// ─── Props / emits ────────────────────────────────────────────────────────────

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  sourceNode:  Object,
  targetNode:  Object,
  activeEdge:  Object,       
  subgraph: Map,
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const portUsage = new Map() // Map<portUid, {edgeId, couplingIndex}>

// ─── Constants ────────────────────────────────────────────────────────────────

const { updateEdge, getViewport, setViewport } = useVueFlow(FLOW_IDS.EDGE)

// ─── Compatibility ─────────────────────────────────

function isCompatible(srcType, tgtType) {
  return TARGET_COMPATIBLE[srcType]?.has(tgtType) ?? false
}

function isSingleConnection(portLabel) {
  return !portLabel.multiport || portLabel.multiport === 'None'
}

// Finds a port in a list by matching label, portType, and option.
// Used wherever a portLabel object needs to be resolved to a stamped local port.
function findPortByLabel(ports, portLabel) {
  if (!portLabel) return null
  return ports.find(p =>
    p.label    === portLabel.label &&
    p.portType === portLabel.portType &&
    JSON.stringify(p.option) === JSON.stringify(portLabel.option)
  ) ?? null
}

// ─── State ────────────────────────────────────────────────────────────────────

// Deep copies of the node's portLabels, each stamped with a stable _uid.
const localSrcPorts = ref([])
const localTgtPorts = ref([])

// The active couplings for this edge.
// Each entry: { srcUid: string, tgtUid: string }
const localCouplings = ref([])

const flowNodes  = ref([])
const flowEdges  = ref([])

// UIDs consumed by other edges
const takenElsewhereUids = ref(new Set())

// ─── Drag-to-reorder ──────────────────────────────────────────────────────────
// dragState tracks an in-progress port drag: which port, which side, the Y
// coordinate where the drag started, and the port's index at drag start.

const canvasEl = ref(null)

const dragState = ref({
  active: false,
  uid: null,
  fromIndex: -1,
  overIndex: -1,
  mouseY: 0,
})

// ── Drag coordinate helpers ───────────────────────────────────────────────────
// viewportY: clientY relative to canvas top edge (viewport coords — for visual translateY)
// contentY:  viewportY + scrollTop (content coords — for index calculation)
// Keeping these separate means the visual offset never drifts when scrolling.

function viewportY(clientY) {
  const el = canvasEl.value
  if (!el) return 0
  return clientY - el.getBoundingClientRect().top
}

function contentY(clientY) {
  const el = canvasEl.value
  if (!el) return 0
  return viewportY(clientY) + el.scrollTop
}

// dragOffsetY drives the translateY of the dragged row.
// It is a plain ref so updating it does NOT trigger VueFlow node re-renders.
const dragOffsetY = ref(0)

let autoScrollRaf = null

function startAutoScroll() {
  if (autoScrollRaf) return
  function tick() {
    const state = dragState.value
    const el = canvasEl.value
    if (!state?.active || !el) { autoScrollRaf = null; return }

    const vy = viewportY(state.clientY)
    const canvasH = el.clientHeight
    const maxScroll = el.scrollHeight - el.clientHeight

    if (vy < AUTOSCROLL_ZONE && el.scrollTop > 0) {
      const speed = AUTOSCROLL_SPEED * (1 - Math.max(0, vy) / AUTOSCROLL_ZONE)
      el.scrollTop = Math.max(0, el.scrollTop - speed)
    } else if (vy > canvasH - AUTOSCROLL_ZONE && el.scrollTop < maxScroll) {
      const speed = AUTOSCROLL_SPEED * (1 - (canvasH - vy) / AUTOSCROLL_ZONE)
      el.scrollTop = Math.min(maxScroll, el.scrollTop + speed)
    }

    updateDragState(state)
    autoScrollRaf = requestAnimationFrame(tick)
  }
  autoScrollRaf = requestAnimationFrame(tick)
}

function stopAutoScroll() {
  if (autoScrollRaf) { cancelAnimationFrame(autoScrollRaf); autoScrollRaf = null }
}

function updateDragState(state) {
  const ports = state.side === 'source'
    ? localSrcPorts.value
    : localTgtPorts.value

  // Index calculation uses content coords (includes scrollTop).
  const totalDelta = contentY(state.clientY) - state.startContentY
  const nextIndex = Math.max(0, Math.min(ports.length - 1,
    state.originIndex + Math.round(totalDelta / ROW_H)
  ))

  if (nextIndex !== state.overIndex) {
    const moved = ports.splice(state.overIndex, 1)[0]
    ports.splice(nextIndex, 0, moved)
    state.overIndex = nextIndex
    syncPortWorkspace()
  }

  // Visual offset: pure cursor movement in screen pixels, with two corrections:
  // 1. scrollDrift — scrollTop has changed since drag start; contentY includes it
  //    but VueFlow transforms don't, so subtract the drift.
  // 2. slotDisplacement — VueFlow repositions the node to its new slot's Y;
  //    translateY adds on top, so subtract how far the slot has moved.
  const slotDisplacement = (state.overIndex - state.originIndex) * ROW_H
  dragOffsetY.value = totalDelta - slotDisplacement
}

function startDrag(event, uid, side) {
  event.preventDefault()
  const ports = side === 'source' ? localSrcPorts.value : localTgtPorts.value
  const index = ports.findIndex(p => p._uid === uid)

  dragState.value = {
    active: true,
    uid,
    side,
    originIndex: index,
    fromIndex: index,
    overIndex: index,
    startContentY: contentY(event.clientY),
    startScrollTop: canvasEl.value?.scrollTop ?? 0,
    clientY: event.clientY,
  }
  dragOffsetY.value = 0

  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', endDrag)
  startAutoScroll()
}

function onDragMove(event) {
  const state = dragState.value
  if (!state.active) return

  state.clientY = event.clientY
  updateDragState(state)
}

function endDrag() {
  const state = dragState.value
  if (!state.active) return

  dragState.value.active = false
  dragOffsetY.value = 0
  stopAutoScroll()
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', endDrag)
  syncPortWorkspace()
}

onUnmounted(() => {
  stopAutoScroll()
  stopConnectAutoScroll()
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', endDrag)
})

function rowStyle(data) {
  const state = dragState.value
  if (!state?.active) return {}

  const ports = state.side === 'source'
    ? localSrcPorts.value
    : localTgtPorts.value

  const index = ports.findIndex(p => p._uid === data.port._uid)

  const { fromIndex, overIndex } = state

  // dragged row — translateY driven by dragOffsetY (not recalculated through VueFlow)
  if (data.port._uid === state.uid) {
    return {
      transform: `translateY(${dragOffsetY.value}px)`,
      zIndex: 50,
      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
      cursor: 'grabbing',
      transition: 'none',
    }
  }

  return {}
}

// The port a connection drag was started from, cleared on drag end
const draggingFrom = ref(null) // { uid, side }

// UIDs of ports that would be valid connection targets for the current drag.
// If dragging from a ghost port, all ports on the opposite side are valid
// since the ghost will be configured to match whatever it connects to.
const validConnectUids = computed(() => {
  if (!draggingFrom.value) return new Set()
  const { uid, side } = draggingFrom.value
  const isGhost = uid === 'ghost-src' || uid === 'ghost-tgt'
  const candidates = side === 'source' ? localTgtPorts.value : localSrcPorts.value
  if (isGhost) return new Set(candidates.map(p => p._uid))
  const port = side === 'source' ? srcByUid(uid) : tgtByUid(uid)
  if (!port) return new Set()
  return new Set(
    candidates
      .filter(p => {
        if (!p.label || !port.label) return false
        if (p.label !== port.label) return false
        const [srcType, tgtType] = side === 'source'
          ? [port.portType, p.portType]
          : [p.portType, port.portType]
        return isCompatible(srcType, tgtType)
      })
      .map(p => p._uid)
  )
})

function onPaneClick() {
  dragState.value = null
}

// ─── Swap confirmation dialog ─────────────────────────────────────────────────
const swapDialog = ref({ visible: false, resolve: null })

function askSwapIntent(canSwap = false) {
  return new Promise(resolve => {
    swapDialog.value = { visible: true, resolve, canSwap }
  })
}

function resolveSwap(intent) {
  swapDialog.value.visible = false
  swapDialog.value.resolve?.(intent) // 'swap' | 'overwrite' | 'cancel'
}

// Mutable local copy of the subgraph (Map<edgeId, clonedEdge>).
// releaseForeignSlot writes into this; applyChanges diffs it against
// props.subgraph to compute foreignCouplings for the confirm emit.
const localSubgraph = ref(new Map())

// ─── Derived helpers ──────────────────────────────────────────────────────────

const canvasHeight = computed(() =>
  (Math.max(localSrcPorts.value.length, localTgtPorts.value.length, 4) + 1) * ROW_H + PAD * 2
)

function srcByUid(uid) { return localSrcPorts.value.find(p => p._uid === uid) }
function tgtByUid(uid) { return localTgtPorts.value.find(p => p._uid === uid) }

function connectedSrcUids() { return new Set(localCouplings.value.map(c => c.srcUid)) }
function connectedTgtUids() { return new Set(localCouplings.value.map(c => c.tgtUid)) }

function rowClass(data) {
  if (dragState.value?.uid === data.port._uid) return 'row--dragging'
  if (data.isConnected) return 'row--connected'
  if (data.isTakenElsewhere) return data.port.multiport && data.port.multiport !== 'None'
    ? 'row--taken-multi'
    : 'row--taken'
  return 'row--free'
}

function handleClass(data) {
  if (data.isConnected)      return 'handle--connected'
  if (data.isTakenElsewhere) return data.port.multiport && data.port.multiport !== 'None'
    ? 'handle--taken-multi'
    : 'handle--taken'
  return 'handle--free'
}

// ─── Initialisation ───────────────────────────────────────────────────────────

function stampUids(nodeId, labels) {
  return (labels || []).map((p) => ({
    ...p,
    _uid: p._uid || `${nodeId}_${crypto.randomUUID()}`,
  }))
}

function initLocalState() {
  localSrcPorts.value = stampUids(
    props.sourceNode.id,
    detachReactivity(props.sourceNode?.data?.portLabels || [])
  )
  localTgtPorts.value = stampUids(
    props.targetNode.id,
    detachReactivity(props.targetNode?.data?.portLabels || [])
  )

  // Seed a mutable local copy of the subgraph so releaseForeignSlot can mutate
  // sibling edges without touching the prop, and applyChanges can diff later.
  localSubgraph.value = new Map(
    [...(props.subgraph || [])].map(([edgeId, edge]) => [
      edgeId,
      detachReactivity(edge),
    ])
  )

  // Resolve the active edge's couplings (portLabel pairs) into local uid pairs
  // by matching against the just-stamped localSrcPorts / localTgtPorts.
  const activeEdgeSnapshot = localSubgraph.value.get(props.activeEdge?.id)
  const rawCouplings = activeEdgeSnapshot?.data?.couplings || []
  localCouplings.value = rawCouplings.flatMap(({ sourcePortLabel, targetPortLabel }) => {
    const src = findPortByLabel(localSrcPorts.value, sourcePortLabel)
    const tgt = findPortByLabel(localTgtPorts.value, targetPortLabel)
    return src && tgt ? [{ srcUid: src._uid, tgtUid: tgt._uid }] : []
  })

  indexSiblingPorts()           
  pruneInvalidConnections() 
  syncPortWorkspace()
  nextTick(() => setViewport({ x: 0, y: 0, zoom: 1 }))
}

// ─── Port-usage tracking ──────────────────────────────────────────────────────
// portUsage: Map<portUid, { edgeId, portLabel }>
// Covers every port slot claimed by a sibling edge (i.e. any edge in the
// subgraph that touches the source or target node, excluding the active edge).
function indexSiblingPorts() {
  portUsage.clear()

  const activeEdgeId = props.activeEdge?.id

  for (const [edgeId, edge] of localSubgraph.value) {
    if (edgeId === activeEdgeId) continue

    // Check for ports with an existing connection
    for (const { sourcePortLabel, targetPortLabel } of (edge.data?.couplings || [])) {
      if (edge.source === props.sourceNode.id) {
        const sp = findPortByLabel(localSrcPorts.value, sourcePortLabel)
        if (sp) portUsage.set(sp._uid, { edgeId, portLabel: sourcePortLabel })
      }
      if (edge.target === props.sourceNode.id) {
        const sp = findPortByLabel(localSrcPorts.value, targetPortLabel)
        if (sp) portUsage.set(sp._uid, { edgeId, portLabel: targetPortLabel })
      }
      if (edge.target === props.targetNode.id) {
        const tp = findPortByLabel(localTgtPorts.value, targetPortLabel)
        if (tp) portUsage.set(tp._uid, { edgeId, portLabel: targetPortLabel })
      }
      if (edge.source === props.targetNode.id) {
        const tp = findPortByLabel(localTgtPorts.value, sourcePortLabel)
        if (tp) portUsage.set(tp._uid, { edgeId, portLabel: sourcePortLabel })
      }
    }
  }

  syncTakenElsewhere()
}

// Derive the takenElsewhereUids set directly from portUsage.
function syncTakenElsewhere() {
  takenElsewhereUids.value = new Set(portUsage.keys())
}

// Remove the coupling that claims `port` from its sibling edge in localSubgraph,
// freeing the slot for the active edge to take over.
function evictForeignHandle(port, side) {
  const usage = portUsage.get(port._uid)
  if (!usage) return null

  const { edgeId, portLabel } = usage
  const sibling = localSubgraph.value.get(edgeId)
  if (!sibling) return null

  // Find the full coupling so we can identify the partner port on the other side
  const coupling = sibling.data?.couplings?.find(c => {
    const labelToCheck = side === 'source' ? c.sourcePortLabel : c.targetPortLabel
    return labelToCheck?.label === portLabel.label &&
           labelToCheck?.portType === portLabel.portType &&
           JSON.stringify(labelToCheck?.option) === JSON.stringify(portLabel.option)
  })

  const partnerPortLabel = side === 'source' ? coupling?.targetPortLabel : coupling?.sourcePortLabel
  const partnerPort = side === 'source'
    ? findPortByLabel(localTgtPorts.value, partnerPortLabel)
    : findPortByLabel(localSrcPorts.value, partnerPortLabel)

  sibling.data = {
    ...sibling.data,
    couplings: sibling.data.couplings.filter(c => c !== coupling),
  }
  portUsage.delete(port._uid)

  return { partnerUid: partnerPort?._uid ?? null, partnerPortLabel, edgeId }
}

// ─── VueFlow node / edge builders ─────────────────────────────────────────────

function syncPortWorkspace() {
  buildFlowNodes()
  buildFlowEdges()
}

function buildFlowNodes() {
  const srcNodes = buildPortNodes(localSrcPorts.value, connectedSrcUids(), 'source')
  const tgtNodes = buildPortNodes(localTgtPorts.value, connectedTgtUids(), 'target')

  flowNodes.value = [...srcNodes, ...tgtNodes]

  ;['source', 'target'].forEach(side => {
    const prefix = side === 'source' ? 'src' : 'tgt'
    const ports  = side === 'source' ? localSrcPorts.value : localTgtPorts.value
    const x      = side === 'source' ? 0 : NODE_W + MID_GAP
    flowNodes.value.push({
      id:       `ghost-${prefix}`,
      type:     'ghostPort',
      position: { x, y: PAD + ports.length * ROW_H },
      data:     { side },
    })
  })
}

function buildPortNodes(ports, connectedUids, side) {
  const prefix = side === 'source' ? 'src' : 'tgt'
  const type   = side === 'source' ? 'sourcePort' : 'targetPort'
  const x      = side === 'source' ? 0 : NODE_W + MID_GAP
  return ports.map((p, i) => ({
    id:       `${prefix}-${p._uid}`,
    type,
    position: { x, y: PAD + i * ROW_H },
    data: {
      port:             p,
      isConnected:      connectedUids.has(p._uid),
      isTakenElsewhere: takenElsewhereUids.value.has(p._uid),
    },
  }))
}

function buildFlowEdges() {
  const edges = []

  for (const { srcUid, tgtUid } of localCouplings.value) {
    const sp = srcByUid(srcUid)
    const tp = tgtByUid(tgtUid)
    if (!sp || !tp) continue

    const valid  = sp.label === tp.label && isCompatible(sp.portType, tp.portType)
    // If either side is a multiport, style it as a dynamic multiport line
    const isMulti = !isSingleConnection(sp) || !isSingleConnection(tp)

    edges.push({
      id: `ce-${srcUid}-${tgtUid}`,
      source: `src-${srcUid}`,
      target: `tgt-${tgtUid}`,
      sourceHandle: 'out',
      targetHandle: 'in',
      updatable: true,
      style: {
        stroke: '#409eff',
        strokeWidth: 2.5,
      },
    })
  }

  flowEdges.value = edges

  // Sync isConnected flags on nodes
  const srcConn = connectedSrcUids()
  const tgtConn = connectedTgtUids()
  for (const node of flowNodes.value) {
    if (!node.data.port) continue // for ghost ports - could make more robust
    const uid = node.data.port._uid
    node.data.isConnected = srcConn.has(uid) || tgtConn.has(uid)
    node.data.isTakenElsewhere = takenElsewhereUids.value.has(uid)
  }
}

// ─── Connection validation ────────────────────────────────────────────────────

function isValidConnection(connection) {
  if (connection.source === 'ghost-src' && connection.target === 'ghost-tgt') return false
  if (connection.source === 'ghost-src' || connection.target === 'ghost-tgt') return true
  const sUid = (connection.source || '').replace('src-', '')
  const tUid = (connection.target || '').replace('tgt-', '')
  const sp = srcByUid(sUid)
  const tp = tgtByUid(tUid)
  if (!sp || !tp || !sp.label || !tp.label) return false
  return sp.label === tp.label && isCompatible(sp.portType, tp.portType)
}

// ─── Interaction handlers ─────────────────────────────────────────────────────

async function onConnect(connection) {
  const isGhostSrc = connection.source === 'ghost-src'
  const isGhostTgt = connection.target === 'ghost-tgt'

  if (isGhostSrc || isGhostTgt) {
    if (isGhostSrc) {
      // Infer from the real target port
      const tUid = connection.target.replace('tgt-', '')
      const tp = tgtByUid(tUid)
      // Evict any existing connection on the real target port before activating ghost
      if (isSingleConnection(tp)) {
        let next = [...localCouplings.value]
        next = await evictHandle(tp, tUid, 'target', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('source', tp)
      connection = { ...connection, source: `src-${localSrcPorts.value.at(-1)._uid}` }
    }
    if (isGhostTgt) {
      // Infer from the real source port
      const sUid = connection.source.replace('src-', '')
      const sp = srcByUid(sUid)
      // Evict any existing connection on the real source port before activating ghost
      if (isSingleConnection(sp)) {
        let next = [...localCouplings.value]
        next = await evictHandle(sp, sUid, 'source', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('target', sp)
      connection = { ...connection, target: `tgt-${localTgtPorts.value.at(-1)._uid}` }
    }
  }

  if (!isValidConnection(connection)) return

  const srcUid = (connection.source || '').replace('src-', '')
  const tgtUid = (connection.target || '').replace('tgt-', '')

  if (localCouplings.value.some(c => c.srcUid === srcUid && c.tgtUid === tgtUid)) return

  const sp = srcByUid(srcUid)
  const tp = tgtByUid(tgtUid)

  let nextCouplings = [...localCouplings.value]

  nextCouplings = await evictHandle(tp, tgtUid, 'target', nextCouplings)
  nextCouplings = await evictHandle(sp, srcUid, 'source', nextCouplings)
  if (nextCouplings === null) return
  localCouplings.value = connectPorts(srcUid, tgtUid, nextCouplings)

  syncTakenElsewhere()
  syncPortWorkspace()
}

async function evictHandle(port, nodeUid, side, newCouplings) {
  if (isSingleConnection(port)) {
    const localConn = newCouplings.find(c => (side === 'source' ? c.srcUid : c.tgtUid) === nodeUid)
    if (localConn) {
      const intent = await askSwapIntent(false)
      if (intent === 'cancel') return null
      newCouplings = newCouplings.filter(c => c !== localConn)
    } else if (takenElsewhereUids.value.has(nodeUid)) {
      const intent = await askSwapIntent(false)
      if (intent === 'cancel') return null
      evictForeignHandle(port, side)
    }
  }
  return newCouplings
}

async function swapConnections(port, oldUid, newUid, side, couplings) {
  const localConn = couplings.find(c => (side === 'source' ? c.srcUid : c.tgtUid) === newUid)
  if (!localConn) {
    if (isSingleConnection(port) && takenElsewhereUids.value.has(newUid)) {
      const intent = await askSwapIntent(true)
      if (intent === 'cancel') return null
      const result = evictForeignHandle(port, side)
      syncTakenElsewhere()
      if (result && intent === 'swap') {
        const { partnerPortLabel, edgeId } = result
        const oldPort = side === 'target' ? tgtByUid(oldUid) : srcByUid(oldUid)
        if (oldPort) rehomeForeignHandle(oldPort, partnerPortLabel, edgeId, side)
        syncTakenElsewhere()
      }
    }
    return couplings
  }

  const intent = await askSwapIntent(true)
  if (intent === 'cancel') return null

  const next = couplings.filter(c => c !== localConn)
  if (intent === 'overwrite') return next

  // swap: rehome the displaced local coupling into the vacated old slot
  const swapSrcUid = side === 'target' ? oldUid : localConn.srcUid
  const swapTgtUid = side === 'target' ? localConn.tgtUid : oldUid
  return connectPorts(swapSrcUid, swapTgtUid, next)
}

function rehomeForeignHandle(oldPort, partnerPortLabel, edgeId, side) {
  const sibling = localSubgraph.value.get(edgeId)
  if (!sibling) return

  const newPortLabel = {
    label:     oldPort.label,
    portType:  oldPort.portType,
    option:    oldPort.option,
    multiport: oldPort.multiport,
  }

  const newCoupling = side === 'source'
    ? { sourcePortLabel: newPortLabel, targetPortLabel: partnerPortLabel }
    : { sourcePortLabel: partnerPortLabel, targetPortLabel: newPortLabel }

  sibling.data = {
    ...sibling.data,
    couplings: [...(sibling.data?.couplings || []), newCoupling],
  }

  portUsage.set(oldPort._uid, { edgeId, portLabel: newPortLabel })
}

// Attempts to connect srcUid -> tgtUid. Returns the updated couplings array if
// successful, or the original array unchanged if the connection is invalid or
// already exists.
function connectPorts(srcUid, tgtUid, couplings) {
  const sp = srcByUid(srcUid)
  const tp = tgtByUid(tgtUid)
  if (!sp || !tp) return couplings
  if (!sp.label || !tp.label) return couplings
  if (sp.label !== tp.label) return couplings
  if (!isCompatible(sp.portType, tp.portType)) return couplings
  if (couplings.some(c => c.srcUid === srcUid && c.tgtUid === tgtUid)) return couplings
  return [...couplings, { srcUid, tgtUid }]
}

async function onEdgeUpdate({ edge, connection }) {
  if (!connection?.source || !connection?.target) return
  if (!isValidConnection(connection)) return

  // If dragged onto a ghost slot, activate it into a real port first then
  // rewrite connection to point at the new port so the rest of onEdgeUpdate
  // runs normally and installs the connection.
  if (connection.source === 'ghost-src' || connection.target === 'ghost-tgt') {
    if (connection.source === 'ghost-src') {
      const tUid = connection.target.replace('tgt-', '')
      const tp = tgtByUid(tUid)
      if (isSingleConnection(tp)) {
        let next = localCouplings.value.filter(
          c => !(c.srcUid === edge.source.replace('src-', '') && c.tgtUid === edge.target.replace('tgt-', ''))
        )
        next = await evictHandle(tp, tUid, 'target', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('source', tp)
      connection = { ...connection, source: `src-${localSrcPorts.value.at(-1)._uid}` }
    }
    if (connection.target === 'ghost-tgt') {
      const sUid = connection.source.replace('src-', '')
      const sp = srcByUid(sUid)
      if (isSingleConnection(sp)) {
        let next = localCouplings.value.filter(
          c => !(c.srcUid === edge.source.replace('src-', '') && c.tgtUid === edge.target.replace('tgt-', ''))
        )
        next = await evictHandle(sp, sUid, 'source', next)
        if (next === null) return
        localCouplings.value = next
      }
      activateGhost('target', sp)
      connection = { ...connection, target: `tgt-${localTgtPorts.value.at(-1)._uid}` }
    }
  }

  const newSrcUid = connection.source.replace('src-', '')
  const newTgtUid = connection.target.replace('tgt-', '')
  const oldSrcUid = edge.source.replace('src-', '')
  const oldTgtUid = edge.target.replace('tgt-', '')

  // Nothing changed
  if (newSrcUid === oldSrcUid && newTgtUid === oldTgtUid) return

  const sp = srcByUid(newSrcUid)
  const tp = tgtByUid(newTgtUid)
  if (!sp || !tp) return

  // Remove the coupling being dragged — its old slot is now vacant.
  let nextCouplings = localCouplings.value.filter(
    c => !(c.srcUid === oldSrcUid && c.tgtUid === oldTgtUid)
  )

  // Deduplicate: dragged onto the same target it already had.
  if (nextCouplings.some(c => c.srcUid === newSrcUid && c.tgtUid === newTgtUid)) {
    localCouplings.value = nextCouplings
    syncPortWorkspace()
    return
  }

  nextCouplings = await swapConnections(tp, oldTgtUid, newTgtUid, 'target', nextCouplings)
  if (nextCouplings === null) return
  nextCouplings = await swapConnections(sp, oldSrcUid, newSrcUid, 'source', nextCouplings)
  if (nextCouplings === null) return

  nextCouplings = connectPorts(newSrcUid, newTgtUid, nextCouplings)
  localCouplings.value = nextCouplings

  // Tell VueFlow to update the rendered edge path
  updateEdge(edge, connection)

  syncTakenElsewhere()
  syncPortWorkspace()
}

// ─── Port editing ─────────────────────────────────────────────────────────────

function pruneInvalidConnections() {
  // 1. Drop any couplings that are now type/label-incompatible (e.g. portType changed).
  localCouplings.value = localCouplings.value.filter(c => {
    const sp = srcByUid(c.srcUid)
    const tp = tgtByUid(c.tgtUid)
    return sp && tp && sp.label === tp.label && isCompatible(sp.portType, tp.portType)
  })

  // 2. Drop couplings that violate single-connection constraints.
  pruneSingleConnectionSide(localSrcPorts.value, 'source')
  pruneSingleConnectionSide(localTgtPorts.value, 'target')
}

function pruneSingleConnectionSide(ports, side) {
  const uidKey = side === 'source' ? 'srcUid' : 'tgtUid'
  for (const port of ports) {
    if (!isSingleConnection(port)) continue
    if (takenElsewhereUids.value.has(port._uid)) {
      localCouplings.value = localCouplings.value.filter(c => c[uidKey] !== port._uid)
    } else {
      const mine = localCouplings.value.filter(c => c[uidKey] === port._uid)
      if (mine.length > 1) {
        localCouplings.value = localCouplings.value.filter(c => c[uidKey] !== port._uid || c === mine[0])
      }
    }
  }
}

function onPortConfigChange() {
  pruneInvalidConnections()
  autoConnect()
  syncPortWorkspace()
}

function autoConnect() {
  for (const sp of localSrcPorts.value) {
    if (!sp.label || !sp.label.trim()) continue
    
    // Check if source is fully booked
    const srcUsedCount = localCouplings.value.filter(c => c.srcUid === sp._uid).length
    if (isSingleConnection(sp) && (srcUsedCount > 0 || takenElsewhereUids.value.has(sp._uid))) continue

    // Find all matching target labels
    const compatibleTargets = localTgtPorts.value.filter(tp => {
      if (tp.label !== sp.label || !isCompatible(sp.portType, tp.portType)) return false
      
      const tgtUsedCount = localCouplings.value.filter(c => c.tgtUid === tp._uid).length
      if (isSingleConnection(tp) && (tgtUsedCount > 0 || takenElsewhereUids.value.has(tp._uid))) return false
      if (localCouplings.value.some(c => c.srcUid === sp._uid && c.tgtUid === tp._uid)) return false
      return true
    })

    for (const tp of compatibleTargets) {
      localCouplings.value.push({ srcUid: sp._uid, tgtUid: tp._uid })
      if (isSingleConnection(sp)) break // Move to the next source port
    }
  }
}

function deletePort(uid, side) {
  if (side === 'source') {
    localSrcPorts.value = localSrcPorts.value.filter(p => p._uid !== uid)
    localCouplings.value = localCouplings.value.filter(c => c.srcUid !== uid)
  } else {
    localTgtPorts.value = localTgtPorts.value.filter(p => p._uid !== uid)
    localCouplings.value = localCouplings.value.filter(c => c.tgtUid !== uid)
  }
  syncPortWorkspace()
}

function activateGhost(side, inferFrom = null) {
  const uid = `new_${side}_${crypto.randomUUID()}`

  let portType = 'general_ports'

  // side refers to the side that the ghost node is being added
  if (side === 'target') {
    portType = inferFrom?.portType === 'exit_ports' ? 'entrance_ports' : 'general_ports'
  } else if (side === 'source') {
    portType = inferFrom?.portType === 'entrance_ports' ? 'exit_ports' : 'general_ports'
  } else {
    return // should trigger error
  }

  const entry = {
    _uid: uid,
    portType: portType,
    label:    inferFrom?.label    ?? '',
    option:   [],           
    multiport: inferFrom?.multiport ?? 'None',
  }
  if (side === 'source') {
    localSrcPorts.value.push(entry)
  } else {
    localTgtPorts.value.push(entry)
  }
  syncPortWorkspace()
}

// ─── Connection drag tracking ────────────────────────────────────────────────

function onConnectStart({ nodeId, handleId, handleType }) {
  const isGhost = nodeId === 'ghost-src' || nodeId === 'ghost-tgt'
  const uid  = isGhost ? nodeId : nodeId?.replace('src-', '').replace('tgt-', '')
  const side = nodeId === 'ghost-src' ? 'source'
             : nodeId === 'ghost-tgt' ? 'target'
             : handleType === 'source' ? 'source' : 'target'
  draggingFrom.value = { uid, side }
  startConnectAutoScroll()
}

function onConnectEnd() {
  draggingFrom.value = null
  stopConnectAutoScroll()
  // Transfer the VueFlow viewport offset back into DOM scrollTop so that
  // mousewheel scroll continues from the correct position after connection drag.
  const el = canvasEl.value
  if (el) {
    const vp = getViewport()
    if (vp.y < 0) {
      el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, -vp.y)
      setViewport({ ...vp, y: 0 })
    }
  }
}

// ── Wheel scroll guard ────────────────────────────────────────────────────────
// Block mousewheel scroll entirely while a connection drag is in progress.
// During connection drag we use panBy autoscroll instead; mixing the two
// causes the connection line to drift.
function onCanvasWheel(event) {
  if (draggingFrom.value) return  // blocked during connection drag
  canvasEl.value.scrollTop += event.deltaY
}

// ── Connection drag autoscroll ────────────────────────────────────────────────
// During a connection drag, VueFlow owns the connection line and handle positions
// in its own transform space. We pan the VueFlow viewport (not the DOM scroll)
// so the line and handles move together without drift.
// Panning is clamped to y <= 0 so users can't scroll above the content.

let connectScrollRaf = null
let connectClientY = 0
const CONNECT_AUTOSCROLL_ZONE = 60
const CONNECT_AUTOSCROLL_SPEED = 10

function onConnectMouseMove(event) {
  connectClientY = event.clientY
}

function startConnectAutoScroll() {
  if (connectScrollRaf) return
  const el = canvasEl.value
  if (!el) return
  window.addEventListener('mousemove', onConnectMouseMove)

  function tick() {
    if (!draggingFrom.value) { stopConnectAutoScroll(); return }
    const el = canvasEl.value
    if (!el) { connectScrollRaf = null; return }

    const rect = el.getBoundingClientRect()
    const vy = connectClientY - rect.top
    const canvasH = el.clientHeight
    const minY = canvasH - el.scrollHeight   // max downward pan = content height - visible height
    const viewport = getViewport()
    let panDelta = 0

    if (vy < CONNECT_AUTOSCROLL_ZONE && viewport.y < 0) {
      panDelta = CONNECT_AUTOSCROLL_SPEED * (1 - Math.max(0, vy) / CONNECT_AUTOSCROLL_ZONE)
    } else if (vy > canvasH - CONNECT_AUTOSCROLL_ZONE && viewport.y > minY) {
      panDelta = -CONNECT_AUTOSCROLL_SPEED * (1 - (canvasH - vy) / CONNECT_AUTOSCROLL_ZONE)
    }

    if (panDelta !== 0) {
      setViewport({ ...viewport, y: Math.max(minY, Math.min(0, viewport.y + panDelta)) })
    }

    connectScrollRaf = requestAnimationFrame(tick)
  }
  connectScrollRaf = requestAnimationFrame(tick)
}

function stopConnectAutoScroll() {
  if (connectScrollRaf) { cancelAnimationFrame(connectScrollRaf); connectScrollRaf = null }
  window.removeEventListener('mousemove', onConnectMouseMove)
}

// ─── Confirm / save ───────────────────────────────────────────────────────────

function buildPayload() {
  const foreignCouplings = {}
  const activeEdgeId = props.activeEdge?.id

  for (const [edgeId, localEdge] of localSubgraph.value) {
    if (edgeId === activeEdgeId) continue
    const originalCouplings = props.subgraph?.get(edgeId)?.data?.couplings || []
    const localCouplingsArr  = localEdge?.data?.couplings || []
    if (JSON.stringify(originalCouplings) !== JSON.stringify(localCouplingsArr)) {
      foreignCouplings[edgeId] = localCouplingsArr
    }
  }

  return {
    sourceNodeId: props.sourceNode.id,
    targetNodeId: props.targetNode.id,
    sourcePortLabels: detachReactivity(localSrcPorts.value),
    targetPortLabels: detachReactivity(localTgtPorts.value),
    couplings: localCouplings.value.map(c => {
      const sp = srcByUid(c.srcUid)
      const tp = tgtByUid(c.tgtUid)
      return {
        sourcePortLabel: { portType: sp.portType, label: sp.label, option: sp.option, multiport: sp.multiport },
        targetPortLabel: { portType: tp.portType, label: tp.label, option: tp.option, multiport: tp.multiport }
      }
    }),
    foreignCouplings,
  }
}

function handleConfirm() {
  emit('confirm', buildPayload())
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('update:modelValue', false)
}

function onClosed() {
  // nothing — cleanup happens in initLocalState on next open
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(() => props.modelValue, (v) => { if (v) initLocalState() })
</script>

<style scoped>
/* ── Dialog header ── */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}
.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.3px;
}
.title-icon {
  font-size: 20px;
  color: #e6a23c;
}
.node-names {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.node-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.3px;
}
.source-badge {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
}
.target-badge {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}
.arrow-sep {
  color: #c0c4cc;
  font-size: 16px;
}

/* ── Root layout ── */
.root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Column headers ── */
.col-headers {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 0 2px;
}
.col-header-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: v-bind('NODE_W + "px"');
}
.mid-spacer {
  width: v-bind('MID_GAP + "px"');
}
.side-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #909399;
  padding-left: 2px;
}
.col-subheaders {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px 4px 0 0;
  font-size: 11px;
  font-weight: 700;
  color: #909399;
  letter-spacing: 0.3px;
}

/* ── Canvas ── */
.flow-canvas {
  border: 1px solid #dcdfe6;
  border-radius: 0 0 4px 4px;
  background: #fafafa;
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── Port row nodes ── */
.port-row {
  height: 44px;
  display: flex;
  align-items: center;
  transition: transform 0.15s ease;
}
.row--dragging {
  transition: none;
  cursor: grabbing;
}
.drag-handle {
  cursor: grab;
  margin-right: 6px;
}
.drag-handle:active {
  cursor: grabbing;
}
:deep(.port-row) {
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  background: #fff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  position: relative;
}
:deep(.row--dragging) {
  background: #f0f7ff;
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
  opacity: 0.9;
  z-index: 999;
}
:deep(.drag-handle) {
  cursor: grab;
  color: #c0c4cc;
  font-size: 16px;
  padding: 0 4px;
  user-select: none;
  line-height: 1;
  flex-shrink: 0;
}
:deep(.drag-handle:hover) {
  color: #409eff;
}
:deep(.drag-handle:active) {
  cursor: grabbing;
}
:deep(.port-row--source) {
  width: v-bind('NODE_W + "px"');
}
:deep(.port-row--target) {
  width: v-bind('NODE_W + "px"');
}

/* Connected on this edge = blue highlight */
:deep(.row--connected) {
  background: #ecf5ff;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}

/* Taken by another edge, single-connection = amber dashed */
:deep(.row--taken) {
  background: #fdf6ec;
  border: 1px dashed #e6a23c;
  opacity: 0.8;
}

/* Taken by another edge, multiport = white/opaque (still connectable) */
:deep(.row--taken-multi) {
  background: #ffffff;
  border-color: #dcdfe6;
  opacity: 1;
}

/* Free / unconnected = faded */
:deep(.row--free) {
  opacity: 0.55;
}
:deep(.row--free:hover),
:deep(.row--free.row--valid-target) {
  opacity: 1;
  border-color: #c0c4cc;
}

:deep(.port-controls) {
  display: flex;
  gap: 8px;
  width: 100%;
  padding: 0 10px;
  pointer-events: auto;
}

/* -- Ghost ports -- */
:deep(.port-row--ghost) {
  background: transparent;
  border: 1.5px dashed #dcdfe6;
  opacity: 1;
  cursor: pointer;
  gap: 6px;
  transition: border-color 0.15s, background 0.15s;
}
:deep(.port-row--ghost:hover) {
  border-color: #409eff;
  background: #ecf5ff;
}
.ghost-label {
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #c0c4cc;
  letter-spacing: 0.5px;
  pointer-events: none;
  user-select: none;
  transition: color 0.15s;
}
:deep(.ghost-controls) {
  justify-content: center;
  align-items: center;
}
:deep(.port-row--ghost:hover) .ghost-label {
  color: #409eff;
}

/* ── Handles ── */
:deep(.port-handle) {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid white;
  transition: background 0.1s ease;
}
:deep(.handle--connected) {
  background: #409eff;
}
:deep(.handle--taken) {
  background: #e6a23c;
}
:deep(.handle--taken-multi) {
  background: #ffffff;
  border: 2px solid #c0c4cc;
}
:deep(.handle--free) {
  background: #c0c4cc;
}
:deep(.vue-flow__handle-valid) {
  background: #67c23a;
}
:deep(.handle--valid-target) {
  background: #67c23a !important;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.35);
}

/* ── Bottom bar ── */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}
.add-btns {
  display: flex;
  gap: 8px;
}
.legend {
  display: flex;
  gap: 16px;
  align-items: center;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #909399;
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.dot-connected { background: #409eff; }
.dot-taken        { background: #e6a23c; border: 1px dashed #e6a23c; }
.dot-taken-multi  { background: #ffffff; border: 1px solid #c0c4cc; }
.dot-free      { background: #c0c4cc; }

/* ── Footer ── */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>