import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { getHandleId } from '../../utils/ports'

// Register the fCoSE extension
cytoscape.use(fcose)

export function runFcoseLayout(nodes, edges) {
  // Initialize Cytoscape.
  const cy = cytoscape({
    headless: true,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          width: 'data(width)',
          height: 'data(height)',
        },
      },
    ],
  })

  // Add Elements.
  const cyNodes = nodes.map((node) => ({
    data: {
      id: node.id,
      width: node.dimensions.width || 200,
      height: node.dimensions.height || 100,
    },
  }))

  const cyEdges = edges.map((edge) => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
    },
  }))

  cy.add([...cyNodes, ...cyEdges])

  // Run fCoSE Layout.
  // Physics engine settings.
  cy.layout({
    name: 'fcose',

    // Quality vs Performance ('proof' is highest quality, slower).
    quality: 'proof',

    // Use random node positions at beginning of layout.
    randomize: true,

    // Whether or not to animate the layout.
    animate: false,

    // PHYSICS SETTINGS
    // Separation force between nodes.
    nodeRepulsion: 45000000,
    // Ideal length of edges (the "rest length" of the springs).
    idealEdgeLength: 200,
    // Strength of edge springs.
    edgeElasticity: 0.45,
    // Nesting (compound) gravity.
    nestingFactor: 0.1,
    // Gravity force (constant force that pulls them to center).
    gravity: 0.025,
    // Maximum number of iterations to perform.
    numIter: 2500,
  }).run()

  // Map Positions Back.
  nodes.forEach((node) => {
    const cyNode = cy.getElementById(node.id)
    if (!cyNode) return

    const { x, y } = cyNode.position()
    const w = cyNode.data('width')
    const h = cyNode.data('height')

    // Center -> Top-Left conversion.
    node.position = {
      x: x - w / 2,
      y: y - h / 2,
    }

    // Port Sorting.
    // Physics layouts put nodes anywhere (top, bottom, left, right).
    // We need to dynamically decide which side ports should be on based on their neighbours.
    if (node.data.ports) {
      // A. Determine Side dynamically based on neighbours.
      node.data.ports.forEach((port) => {
        // Find the neighbour node for this port.
        const edge = edges.find(
          (e) =>
            e.sourceHandle === getHandleId(port) ||
            e.targetHandle === getHandleId(port)
        )
        if (!edge) return

        const neighbourId = edge.source === node.id ? edge.target : edge.source
        const neighbour = cy.getElementById(neighbourId)

        if (neighbour) {
          // Check relative position.
          const dx = neighbour.position('x') - x
          const dy = neighbour.position('y') - y

          // If strictly horizontal > vertical distance, put on Left/Right.
          if (Math.abs(dx) > Math.abs(dy)) {
            port.side = dx > 0 ? 'right' : 'left'
          } else {
            port.side = dy > 0 ? 'bottom' : 'top'
          }
        }
      })

      // B. Sort Ports on those sides.
      const sides = { top: [], right: [], bottom: [], left: [] }
      node.data.ports.forEach((p) => {
        if (sides[p.side]) sides[p.side].push(p)
      })

      const sortPortsByCoord = (list, isVertical) => {
        list.sort((a, b) => {
          // Look up neighbour positions again for sorting.
          const getNeighborPos = (port) => {
            const edge = edges.find(
              (e) =>
                e.sourceHandle === getHandleId(port) ||
                e.targetHandle === getHandleId(port)
            )
            if (!edge) return 0
            const nId = edge.source === node.id ? edge.target : edge.source
            const n = cy.getElementById(nId)
            return isVertical ? n.position('y') : n.position('x')
          }
          return getNeighborPos(a) - getNeighborPos(b)
        })
      }

      sortPortsByCoord(sides.top, false) // Top varies by X.
      sortPortsByCoord(sides.bottom, false) // Bottom varies by X.
      sortPortsByCoord(sides.left, true) // Left varies by Y.
      sortPortsByCoord(sides.right, true) // Right varies by Y.

      node.data.ports = [
        ...sides.top,
        ...sides.right,
        ...sides.bottom,
        ...sides.left,
      ]
    }

    node.style = { opacity: 1 }
  })
}
