import ELK from 'elkjs/lib/elk.bundled.js'

import { getHandleId } from '../../utils/ports'

const elk = new ELK()

/**
 * ELK Layout Function
 */
export async function runElkLayout(nodes, edges) {
  // 1. Construct the ELK Graph Structure
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // 'elk.direction': 'RIGHT',
      // Spacing settings
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      // This ensures ports are respected
      'elk.layered.spacing.edgeNodeBetweenLayers': '50' 
    },
    children: nodes.map((node) => {
      // Create Port definitions for ELK
      const elkPorts = (node.data.ports || []).map((port) => {
        
        // Determine constraint based on your logic (or default)
        // If it's an input -> WEST, output -> EAST
        let side = 'WEST' 
        if (port.type === 'target') side = 'WEST'
        if (port.type === 'source') side = 'EAST'
        
        // You can also force specific sides if you know them:
        // if (port.side === 'top') side = 'NORTH'
        
        return {
          id: getHandleId(port), // Use your unique Port ID
          width: 10, 
          height: 10,
          properties: {
            // FIX THE PORT TO A SIDE
            // 'org.eclipse.elk.port.side': side,
            // ALIGN PORTS ON THAT SIDE
            // 'org.eclipse.elk.port.ancor': side === 'WEST' ? '(0, 0.5)' : '(1, 0.5)' 
          }
        }
      })

      return {
        id: node.id,
        width: node.dimensions.width || 200,
        height: node.dimensions.height || 100,
        ports: elkPorts,
        properties: {
          // Tell ELK to respect the specific sides we assigned above
          // 'org.eclipse.elk.portConstraints': 'FIXED_SIDE'
        }
      }
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceHandle], // Must match port.uid used above
      targets: [edge.targetHandle]
    }))
  }

  // 2. Run the Layout
  try {
    const layoutedGraph = await elk.layout(elkGraph)

    // 3. Map Coordinates Back to Vue Flow
    layoutedGraph.children.forEach((elkNode) => {
      const originalNode = nodes.find((n) => n.id === elkNode.id)
      if (!originalNode) return

      // Update Node Position
      originalNode.position = {
        x: elkNode.x,
        y: elkNode.y
      }

      // 4. Update Port Sides/Sorting based on ELK's result
      // ELK calculates the exact relative (x,y) for every port.
      if (elkNode.ports && originalNode.data.ports) {
        elkNode.ports.forEach((elkPort) => {
          const originalPort = originalNode.data.ports.find((p) => p.uid === elkPort.id)
          if (!originalPort) return
          
          // You can read the final side from ELK if needed, 
          // or just rely on the fact that you forced it to WEST/EAST.
          // ELK returns `elkPort.x` and `elkPort.y` relative to the node.
          
          // Example: If x is roughly 0, it's Left. If x is roughly width, it's Right.
          if (elkPort.x < 10) originalPort.side = 'left'
          else if (elkPort.x > elkNode.width - 20) originalPort.side = 'right'
          
          // ELK has already optimized the "y" order for you to minimize crossing!
        })

        // Sort your internal array to match ELK's visual output (optional but good for debugging)
        // You can sort originalNode.data.ports based on the ELK port coordinates
      }
      originalNode.style = { opacity: 1 }
    })
    
    return true // Success
  } catch (err) {
    console.error('ELK Layout Failed:', err)
    return false
  }
}
