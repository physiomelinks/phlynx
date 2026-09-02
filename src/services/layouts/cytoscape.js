import fcose from 'cytoscape-fcose'
import { getHandleId } from '../../utils/handles'
const cytoscapePromise = import('cytoscape')

export async function runFcoseLayout(nodes, edges) {
  const cytoscape = (await cytoscapePromise).default
  // Register the fCoSE extension
  cytoscape.use(fcose)
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

    node.style = { ...node.style, opacity: 1 }
  })
}
