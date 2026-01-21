import { buildPorts, buildPortLabels } from './buildPorts'
import { getHandleId } from '../../utils/ports'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../../utils/constants'

function buildNodes(builderStore, vessels, progressCallback = null) {
  return vessels.map((vessel, index) => {
    if (progressCallback) {
      progressCallback(index, vessels.length, vessel.name)
    }
    
    // Use builderStore method to find the config
    const configData = builderStore.getConfigForVessel(
      vessel.vessel_type,
      vessel.BC_type
    )

    if (!configData) {
      console.warn(
        `No config found for vessel "${vessel.name}" ` +
        `(vessel_type: ${vessel.vessel_type}, BC_type: ${vessel.BC_type})`
      )
      // Return a placeholder node
      return {
        id: vessel.name,
        type: 'moduleNode',
        position: { x: 100, y: 100 },
        data: {
          ...vessel,
          name: vessel.name,
          ports: [],
          label: `${vessel.name} (missing config)`,
          portLabels: {},
          error: true,
        },
      }
    }

    const { config, module, filename } = configData

    // Check if vessel has explicit position
    const hasPosition = vessel.x !== undefined && vessel.y !== undefined

    if (progressCallback && index === vessels.length){
      progressCallback(vessels.length, vessels.length, 'Building connections...')
    }

    return {
      id: vessel.name,
      type: 'moduleNode',
      // Use vessel position if provided, otherwise use dummy position
      ...(hasPosition
        ? {
            position: { x: vessel.x, y: -vessel.y },
          }
        : {
            position: { x: 100, y: 100 },
            style: { opacity: 0 }, // Hidden until layout runs
          }),
      data: {
        ...vessel,
        ...module,
        name: vessel.name,
        vesselType: vessel.vessel_type,
        bcType: vessel.BC_type,
        config: config,
        ports: buildPorts(vessel, config),
        label: `${module.componentName || module.name} — ${filename}`,
        portLabels: buildPortLabels(config),
      },
    }
  })
}

function buildEdges(vessels, nodes) {
  const edges = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Track how many INPUT connections each target has received
  const targetUsageCount = new Map()

  vessels.forEach((vessel) => {
    if (!vessel.out_vessels) return

    const sourceNode = nodeMap.get(vessel.name)
    if (!sourceNode) return

    // Skip nodes with errors
    if (sourceNode.data.error) return

    // Get ALL valid source ports
    const sourcePorts = sourceNode.data.ports.filter(
      (p) => p.type === SOURCE_PORT_TYPE
    )
    if (sourcePorts.length === 0) return

    // Parse output vessels (space-separated)
    const targets = vessel.out_vessels.split(' ').filter(t => t.trim())

    targets.forEach((targetName, index) => {
      const targetNode = nodeMap.get(targetName)
      if (!targetNode) return

      // Skip nodes with errors
      if (targetNode.data.error) return

      // Use the index to pick a unique source port
      const sourcePortIndex = Math.min(index, sourcePorts.length - 1)
      const sourcePort = sourcePorts[sourcePortIndex]

      // Get all valid target ports
      const targetPorts = targetNode.data.ports.filter(
        (p) => p.type === TARGET_PORT_TYPE
      )
      if (targetPorts.length === 0) return

      // Determine which input slot on the target we should use
      const currentCount = targetUsageCount.get(targetName) || 0
      const targetPortIndex = Math.min(currentCount, targetPorts.length - 1)
      const targetPort = targetPorts[targetPortIndex]

      // Increment usage for next connection to this target
      targetUsageCount.set(targetName, currentCount + 1)

      edges.push({
        id: `e_${vessel.name}_${targetName}_${crypto.randomUUID()}`,
        source: vessel.name,
        target: targetName,
        sourceHandle: getHandleId(sourcePort),
        targetHandle: getHandleId(targetPort),
      })
    })
  })

  return edges
}

export function buildWorkflowGraph(builderStore, vessels, progressCallback = null) {
  const nodes = buildNodes(builderStore, vessels, progressCallback)
  const edges = buildEdges(vessels, nodes)
  return { nodes, edges }
}