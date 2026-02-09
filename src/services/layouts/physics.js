import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'

// Register the fCoSE extension
cytoscape.use(fcose)

/**
 * Relayouts nodes while preserving existing port configurations
 * 
 * @param {Array} nodes - Array of node objects to reposition
 * @param {Array} edges - Array of edge objects
 */
export function relayoutNodes(nodes, edges) {
  // Create Cytoscape instance
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

  // Add nodes
  const cyNodes = nodes.map((node) => ({
    data: {
      id: node.id,
      width: node.dimensions.width || 200,
      height: node.dimensions.height || 100,
    },
  }))

  // Add edges
  const cyEdges = edges.map((edge) => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
    },
  }))

  cy.add([...cyNodes, ...cyEdges])

  // Set current positions as starting points for smoother transitions
  nodes.forEach((node) => {
    if (node.position) {
      const cyNode = cy.getElementById(node.id)
      const w = cyNode.data('width')
      const h = cyNode.data('height')
      // Convert from top-left to center coordinates
      cyNode.position({
        x: node.position.x + w / 2,
        y: node.position.y + h / 2,
      })
    }
  })

  // Run fCoSE layout starting from current positions
  cy.layout({
    name: 'fcose',
    quality: 'proof',
    randomize: false,
    animate: false,
    nodeRepulsion: 45000000,
    idealEdgeLength: 200,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    gravity: 0.025,
    numIter: 2500,
  }).run()

  // Update node positions
  nodes.forEach((node) => {
    const cyNode = cy.getElementById(node.id)
    if (!cyNode) return

    const { x, y } = cyNode.position()
    const w = cyNode.data('width')
    const h = cyNode.data('height')

    // Convert center to top-left coordinates
    node.position = {
      x: x - w / 2,
      y: y - h / 2,
    }
    node.style = { opacity: 1 }
  })
}