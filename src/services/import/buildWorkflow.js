import { buildPorts, buildPortLabels } from './buildPorts'
import { getHandleId } from '../../utils/ports'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../../utils/constants'

function buildNodes(availableModules, vessels, moduleConfig) {
  const moduleLookup = new Map()
  availableModules.forEach((file) => {
    file.modules.forEach((mod) => {
      moduleLookup.set(`${file.filename}::${mod.componentName}`, mod)
    })
  })

  return vessels.map((vessel, index) => {
    const moduleConfigData = moduleConfig.find(
      (m) => m.vessel_type === vessel.vessel_type
    )

    const moduleData = moduleLookup.get(
      `${moduleConfigData.module_file}::${moduleConfigData.module_type}`
    )

    return {
      // Hopefully the vessel names are unique.
      id: vessel.name,
      type: 'moduleNode',

      // Give them a dummy position initially
      position: { x: 100, y: 100 },

      // Start invisible so the user doesn't see them stack at (0,0)
      style: { opacity: 0 },

      data: {
        ...vessel,
        ...moduleData,
        name: vessel.name,
        ports: buildPorts(vessel),
        label: `${moduleData.componentName} — ${moduleData.sourceFile}`,
        portLabels: buildPortLabels(moduleConfigData),
      },
    }
  })
}

function buildEdges(vessels, nodes) {
  const edges = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // We need to track how many INPUT connections a target has received
  // so we don't pile them all onto its first input port.
  const targetUsageCount = new Map() // Key: NodeID, Value: Integer (count)

  vessels.forEach((vessel) => {
    if (!vessel.out_vessels) return

    const sourceNode = nodeMap.get(vessel.name)
    if (!sourceNode) return

    // Get ALL valid source ports
    const sourcePorts = sourceNode.data.ports.filter(
      (p) => p.type === SOURCE_PORT_TYPE
    )
    if (sourcePorts.length === 0) return

    const targets = vessel.out_vessels.split(' ')

    targets.forEach((targetName, index) => {
      const targetNode = nodeMap.get(targetName)
      if (!targetNode) return

      // Use the index to pick a unique port.
      // If we have more edges than ports, wrap around or reuse the last one.
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

      // Increment usage for next time someone connects to this target
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

export function buildWorkflowGraph(store, configData) {
  const nodes = buildNodes(
    store,
    configData.vessels,
    configData.module
  )

  const edges = buildEdges(configData.vessels, nodes)

  return { nodes, edges }
}
