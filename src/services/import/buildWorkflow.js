import { buildPorts, buildPortLabels } from './buildPorts'
import { getHandleId } from '../../utils/ports'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../../utils/constants'
import { extractVariablesFromModule } from '../../utils/cellml'
import { resolvePortCouplings, checkAndClaimCouplings, buildUsedPortKeys } from '../../utils/edges'

function buildNodes(builderStore, vessels, progressCallback = null) {

  return vessels.map((vessel, index) => {
    if (progressCallback) {
      progressCallback(index, vessels.length, vessel.name)
    }

    // Use builderStore method to find the config
    const configData = builderStore.getConfigForVessel(vessel.vessel_type, vessel.BC_type)

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

    const { config, configIndex, module, filename } = configData

    const modelString = builderStore.getModuleContent(filename)
    const variables = extractVariablesFromModule(modelString, module.componentName)
    builderStore.setVariableParameterValuesForInstance(
      vessel.name,
      variables,
      filename,
      module.componentName,
      configIndex
    )
    // Check if vessel has explicit position
    const hasPosition = vessel.x !== undefined && vessel.y !== undefined

    if (progressCallback && index === vessels.length) {
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
        componentName: module.componentName,
        configIndex: configIndex,
        label: `${module.componentName || module.name} — ${filename}`,
        name: vessel.name,
        portLabels: buildPortLabels(config),
        portOptions: module.portOptions || [],
        ports: buildPorts(vessel, config),
        hasPrescribedPosition: hasPosition,
        sourceFile: filename,
        variables,
      },
    }
  })
}

function buildEdges(vessels, nodes) {
  const edges = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Tracks consumed single-connection port label slots across all edges built so far.
  // Populated via checkAndClaimCouplings; see portCouplings.js for key format.
  const usedPortKeys = new Set()

  // For each target node, track how many times it has been connected to as a
  // target so far — this is its inp_vessels ordinal index for the next edge.
  const targetInboundCount = new Map()

  vessels.forEach((vessel) => {
    if (!vessel.out_vessels) return

    const sourceNode = nodeMap.get(vessel.name)
    if (!sourceNode || sourceNode.data.error) return

    const targets = vessel.out_vessels.split(' ').filter((t) => t.trim())

    targets.forEach((targetName, sourceIndex) => {
      // sourceIndex = position of this target in the source's out_vessels list.
      // Used to select the correct ordinal port slot on the source side.

      const targetNode = nodeMap.get(targetName)
      if (!targetNode || targetNode.data.error) return

      // Each port's name field holds the neighbour vessel name (set by buildPorts).
      // Find the source handle whose name matches this specific target, and the
      // target handle whose name matches this specific source vessel.
      const sourcePort = sourceNode.data.ports.find(
        (p) => p.type === SOURCE_PORT_TYPE && p.name === targetName
      )
      const targetPort = targetNode.data.ports.find(
        (p) => p.type === TARGET_PORT_TYPE && p.name === vessel.name
      )

      if (!sourcePort || !targetPort) {
        console.warn(
          `[buildEdges] Could not find matching handles between "${vessel.name}" and "${targetName}" — skipping.`
        )
        return
      }

      // targetIndex = how many times this target node has already been connected
      // to as a target. Used to select the correct ordinal port slot on the target side.
      const targetIndex = targetInboundCount.get(targetName) ?? 0

      // Resolve the specific port-label couplings for this conduit edge, taking
      // ordinal position into account for repeated same-label slots.
      const couplings = resolvePortCouplings(
        sourceNode.data.portLabels ?? [],
        targetNode.data.portLabels ?? [],
        sourceIndex,
        targetIndex
      )

      if (couplings.length === 0) {
        console.warn(
          `[buildEdges] No compatible port label matches between "${vessel.name}" and "${targetName}" — conduit edge skipped.`
        )
        return
      }

      // Enforce the non-multiport single-connection constraint.
      // All-or-nothing: if any coupling violates it, the whole conduit is rejected.
      const { valid, conflicts } = checkAndClaimCouplings(
        vessel.name,
        targetName,
        couplings,
        usedPortKeys
      )

      if (!valid) {
        console.warn(
          `[buildEdges] Conduit "${vessel.name}" → "${targetName}" rejected:\n` +
            conflicts.map((c) => `  • ${c}`).join('\n')
        )
        return
      }

      // Increment the target's inbound count only after a successful edge
      targetInboundCount.set(targetName, targetIndex + 1)

      edges.push({
        id: `${vessel.name}--${targetName}`,
        source: vessel.name,
        target: targetName,
        sourceHandle: getHandleId(sourcePort),
        targetHandle: getHandleId(targetPort),
        data: {
          couplings,
        },
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