import dagre from '@dagrejs/dagre'
import { getHandleId } from '../../utils/ports'

/**
 * This function runs a dagre layout on the nodes and edges,
 * treating ports as separate sub-nodes to achieve a port-granular layout.
 * This allows for better organization of nodes based on their port connections.
 *
 * @param {*} nodes - The array of nodes in the workflow graph.
 * @param {*} edges - The array of edges in the workflow graph.
 */
export function runPortGranularLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph({ compound: true })
  g.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 80 })
  g.setDefaultEdgeLabel(() => ({}))

  // 2. Create "Port" Nodes & Store Lookup Map
  // We map the port's unique UID to its Dagre Node ID to avoid the "changing ID" bug.
  const portToDagreId = new Map()
  const nodeToSpacerId = new Map()

  // 1. Create "Cluster" Nodes (The actual Module Nodes)
  nodes.forEach((node) => {
    g.setNode(node.id, {
      label: node.id,
      clusterLabelPos: 'top',
      width: node.dimensions.width,
      height: node.dimensions.height,
    })

    const spacerId = `SPACER_${node.id}`
    nodeToSpacerId.set(node.id, spacerId)

    g.setNode(spacerId, {
      width: node.dimensions.width, // Extra space for ports
      height: node.dimensions.height,
      label: `Spacer ${node.id}`,
    })

    g.setParent(spacerId, node.id)
    // g.setNode(node.id, {
    //   label: node.id,
    //   width: node.dimensions.width,
    //   height: node.dimensions.height,
    //   clusterLabelPos: 'top'
    // })
  })

  nodes.forEach((node) => {
    const ports = node.data.ports || []
    ports.forEach((port) => {
      // We use the CURRENT handle ID (before modification) to build the graph
      const handleId = getHandleId(port)
      const portNodeId = `DAGRE_PORT_${node.id}_${handleId}`

      // Map the stable Port UID to this Dagre Node ID
      portToDagreId.set(port.uid, portNodeId)

      g.setNode(portNodeId, { width: 10, height: 10 })
      g.setParent(portNodeId, node.id)
    })
  })

  // 3. Create Edges
  edges.forEach((edge) => {
    // We have to reconstruct the IDs here manually or look them up if we had edge objects mapped
    // But since we know the logic:
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    // Find the ports to get their UIDs, then get their Dagre IDs
    // (This assumes you can match handle IDs back to ports, or just replicate the ID logic)
    const sourceDagreId = `DAGRE_PORT_${edge.source}_${edge.sourceHandle}`
    const targetDagreId = `DAGRE_PORT_${edge.target}_${edge.targetHandle}`

    g.setEdge(sourceDagreId, targetDagreId)
  })

  // 4. Run Layout
  dagre.layout(g)

  // 5. Apply Results
  nodes.forEach((node) => {
    const nodeWithPos = g.node(node.id)
    if (!nodeWithPos) return

    const spacerId = nodeToSpacerId.get(node.id)
    const spacerPos = g.node(spacerId)

    if (!spacerPos) return

    // Update Node Position
    node.position = {
      x: spacerPos.x - spacerPos.width / 2,
      y: spacerPos.y - spacerPos.height / 2,
    }

    if (node.data.ports) {
      // Update Sides based on where Dagre placed the dummy port node
      node.data.ports.forEach((port) => {
        const dagreNodeId = portToDagreId.get(port.uid)
        const portPos = g.node(dagreNodeId)

        if (!portPos) return

        // Calculate position of the port relative to the Node Center
        const dx = portPos.x - spacerPos.x
        const dy = portPos.y - spacerPos.y

        // Determine side based on relative position
        // Since Dagre 'LR' puts inputs Left and outputs Right generally,
        // we can check which boundary it is closest to.

        const halfWidth = spacerPos.width / 2
        const halfHeight = spacerPos.height / 2

        // Normalize distances to edges (0 = center, 1 = edge)
        const relX = dx / halfWidth
        const relY = dy / halfHeight

        if (Math.abs(relX) > Math.abs(relY)) {
          // It is closer to Left or Right
          port.side = relX > 0 ? 'right' : 'left'
        } else {
          // It is closer to Top or Bottom
          port.side = relY > 0 ? 'bottom' : 'top'
        }
      })

      // B. Sort ports using the SAFE lookup map
      // Now that sides are set, we sort them so lines don't cross locally.
      const sides = { top: [], right: [], bottom: [], left: [] }
      node.data.ports.forEach((p) => {
        if (sides[p.side]) sides[p.side].push(p)
      })

      const sortPorts = (portList, isVertical) => {
        portList.sort((a, b) => {
          // Use the MAP, not getHandleId(), because getHandleId() is now "polluted" with the new side
          const nodeA = g.node(portToDagreId.get(a.uid))
          const nodeB = g.node(portToDagreId.get(b.uid))

          if (!nodeA || !nodeB) return 0
          // If vertical side (Left/Right), sort by Y. If horizontal side (Top/Bottom), sort by X.
          return isVertical ? nodeA.x - nodeB.x : nodeA.y - nodeB.y
        })
      }

      sortPorts(sides.top, true) // Sort by X
      sortPorts(sides.bottom, true) // Sort by X
      sortPorts(sides.left, false) // Sort by Y
      sortPorts(sides.right, false) // Sort by Y

      // Flatten back
      node.data.ports = [
        ...sides.top,
        ...sides.right,
        ...sides.bottom,
        ...sides.left,
      ]
    }

    node.style = { opacity: 1 }
  })

  const showDebug = false
  if (!showDebug) return

  // --- DEBUG START: RAW DAGRE VISUALIZER (AUTO-SCALED) ---
  const debugContainer = document.createElement('div')
  Object.assign(debugContainer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '9999',
    backgroundColor: 'rgba(0,0,0,0.85)', // Darker background to see contrast
    backdropFilter: 'blur(2px)',
  })

  // 1. Calculate Bounding Box of the Graph
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity

  g.nodes().forEach((v) => {
    const n = g.node(v)
    if (!n) return
    // Dagre x/y is center, so account for width/height
    minX = Math.min(minX, n.x - n.width / 2)
    maxX = Math.max(maxX, n.x + n.width / 2)
    minY = Math.min(minY, n.y - n.height / 2)
    maxY = Math.max(maxY, n.y + n.height / 2)
  })

  // Handle edges (they might swing outside nodes)
  g.edges().forEach((e) => {
    const edge = g.edge(e)
    if (edge && edge.points) {
      edge.points.forEach((p) => {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      })
    }
  })

  // 2. Calculate Scale Factors to fit screen
  const padding = 50
  const graphW = maxX - minX || 100
  const graphH = maxY - minY || 100
  const screenW = window.innerWidth - padding * 2
  const screenH = window.innerHeight - padding * 2

  const scale = Math.min(screenW / graphW, screenH / graphH)

  // Helper: Convert Graph Coords -> Screen Coords
  const toScreen = (val, minVal) => (val - minVal) * scale + padding
  const scaleSize = (val) => val * scale

  // Helper to draw a box
  const drawBox = (id, x, y, w, h, color, label) => {
    const box = document.createElement('div')

    // Convert center x/y to top/left screen coords
    const screenW = scaleSize(w)
    const screenH = scaleSize(h)
    const screenLeft = toScreen(x - w / 2, minX)
    const screenTop = toScreen(y - h / 2, minY)

    Object.assign(box.style, {
      position: 'absolute',
      border: `1px solid ${color}`,
      left: `${screenLeft}px`,
      top: `${screenTop}px`,
      width: `${screenW}px`,
      height: `${screenH}px`,
      color: color,
      fontSize: `${Math.max(10 * scale, 8)}px`, // Scale font but keep min size
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })
    box.textContent = label || id

    // Add a tooltip on hover because text might be tiny
    box.title = `${label} (x:${Math.round(x)}, y:${Math.round(y)})`

    debugContainer.appendChild(box)
  }

  // 3. Draw Nodes
  g.nodes().forEach((v) => {
    const node = g.node(v)
    if (!node) return

    const isPort = v.includes('DAGRE_PORT')
    const isSpacer = v.includes('SPACER')

    // Color coding: Blue=Node, Red=Port, Yellow=Spacer
    let color = 'cyan'
    if (isPort) color = '#ff4444' // Red
    if (isSpacer) color = '#ffeb3b' // Yellow

    drawBox(v, node.x, node.y, node.width, node.height, color, isPort ? '' : v)
  })

  // 4. Draw Edges
  g.edges().forEach((e) => {
    const edge = g.edge(e)
    if (edge && edge.points) {
      edge.points.forEach((p) => {
        const dot = document.createElement('div')
        const size = Math.max(4 * scale, 2) // Keep dots visible
        Object.assign(dot.style, {
          position: 'absolute',
          left: `${toScreen(p.x, minX) - size / 2}px`,
          top: `${toScreen(p.y, minY) - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
          background: 'lime',
          borderRadius: '50%',
        })
        debugContainer.appendChild(dot)
      })
    }
  })

  // 5. Add Info Label
  const info = document.createElement('div')
  info.textContent = `Graph Scale: ${scale.toFixed(2)}x | Click to Close`
  Object.assign(info.style, {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    color: 'white',
    background: 'black',
    padding: '5px',
  })
  debugContainer.appendChild(info)

  document.body.appendChild(debugContainer)

  debugContainer.style.pointerEvents = 'auto'
  debugContainer.onclick = () => document.body.removeChild(debugContainer)
  // --- DEBUG END ---
}
