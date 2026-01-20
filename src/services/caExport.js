import JSZip from 'jszip'
import Papa from 'papaparse'
import { ElNotification } from 'element-plus'

/**
 * Classifies a variable based on a list of parameters.
 * Assumes 'parameters' is an array of objects, where each object has a 'name' property
 * representing the parameter name (e.g., [{ name: 'param_a' }, { name: 'param_b' }]).
 *
 * @param {string} moduleName - The name the variable comes from.
 * @param {object} variable - The variable object (e.g., { name: 'q_V' })
 * @param {Array<object>} parameters - List of parameter objects.
 * @returns {string} - 'global_constant', 'constant', or 'variable'
 */
function classifyVariable(moduleName, variable, parameters) {
  if (!variable?.name || !Array.isArray(parameters)) {
    console.error('Invalid input to classifyVariable')
    return 'undefined' // Default or error state
  }

  const varName = variable.name
  const qualifiedName = `${varName}_${moduleName}`

  let isGlobalConstant = false

  for (const param of parameters) {
    const paramName = param.variable_name

    if (qualifiedName === paramName) {
      return 'constant'
    }

    if (varName === paramName) {
      isGlobalConstant = true
    }
  }

  if (isGlobalConstant) return 'global_constant'
  return 'variable'
}

function checkSharedPorts(nodes, edges) {
  // Map nodeId → { entrance: [...labels], exit: [...labels] }
  const nodePortsMap = new Map()
  for (const node of nodes) {
    nodePortsMap.set(node.id, {
      name: node.data.name,
      entrance: (node.data.portLabels || [])
        .filter((p) => p.portType === 'entrance_ports')
        .map((p) => p.label.trim().toLowerCase()),
      exit: (node.data.portLabels || [])
        .filter((p) => p.portType === 'exit_ports')
        .map((p) => p.label.trim().toLowerCase()),
      general: (node.data.portLabels || [])
        .filter((p) => p.portType === 'general_ports')
        .map((p) => p.label.trim().toLowerCase()),
    })
  }

  const mismatches = []

  for (const edge of edges) {
    const sourcePorts = nodePortsMap.get(edge.source)
    const targetPorts = nodePortsMap.get(edge.target)
    if (!sourcePorts || !targetPorts) continue

    // --- Exit - Exit ---
    const sharedExits = sourcePorts.exit.filter((label) =>
      targetPorts.exit.includes(label)
    )
    for (const label of sharedExits) {
      mismatches.push({
        portLabel: label,
        type: 'shared_exit_ports',
        nodes: [sourcePorts.name, targetPorts.name],
      })
    }

    // --- Entrance - Entrance ---
    const sharedEntrances = sourcePorts.entrance.filter((label) =>
      targetPorts.entrance.includes(label)
    )
    for (const label of sharedEntrances) {
      mismatches.push({
        portLabel: label,
        type: 'shared_entrance_ports',
        nodes: [sourcePorts.name, targetPorts.name],
      })
    }

    // --- Exit - General ---
    const exitToGeneral = sourcePorts.exit.filter((label) =>
      targetPorts.general.includes(label)
    )
    for (const label of exitToGeneral) {
      mismatches.push({
        portLabel: label,
        type: 'exit_connected_to_general',
        nodes: [sourcePorts.name, targetPorts.name],
      })
    }

    // --- Entrance - General ---
    const entranceToGeneral = sourcePorts.entrance.filter((label) =>
      targetPorts.general.includes(label)
    )
    for (const label of entranceToGeneral) {
      mismatches.push({
        portLabel: label,
        type: 'entrance_connected_to_general',
        nodes: [sourcePorts.name, targetPorts.name],
      })
    }
  }

  return mismatches
}

/**
 * Generates a zip blob for the Circulatory Autogen export.
 * @param {Array} nodes - The array of nodes from Vue Flow.
 * @param {Array} edges - The array of edges from Vue Flow.
 * @param {Array} parameters - The parameter data from the store.
 * @returns {Promise<Blob>} A promise that resolves with the zip file blob.
 */
export async function generateExportZip(fileName, nodes, edges, parameters) {
  try {
    const portMismatches = checkSharedPorts(nodes, edges)

    if (portMismatches.length) {
      const labels = portMismatches.map(
        (m) => `${m.portLabel} (${m.nodes.join(' - ')})`
      )
      throw new Error(`Mismatched port definitions: ${labels.join(', ')}`)
    }

    const zip = new JSZip()

    const nodeNameMap = new Map()
    const nodeNameObjMap = new Map()
    for (const node of nodes) {
      nodeNameMap.set(node.id, node.data.name)
      nodeNameObjMap.set(node.data.name, node)
    }

    let module_config = []
    let vessel_array = []
    const BC_type = 'nn' // Placeholder, figure out actual logic if needed.
    for (const node of nodes) {
      const inp_vessels = []
      const out_vessels = []
      for (const edge of edges) {
        // --- Check for INCOMING edges ---
        // If an edge's target is this node, it's an input.
        if (edge.target === node.id) {
          // Get the name of the source node.
          const sourceNodeName = nodeNameMap.get(edge.source)
          if (sourceNodeName) {
            inp_vessels.push(sourceNodeName)
          }
        }

        // --- Check for OUTGOING edges ---
        // If an edge's source is this node, it's an output.
        if (edge.source === node.id) {
          // Get the name of the target node.
          const targetNodeName = nodeNameMap.get(edge.target)
          if (targetNodeName) {
            out_vessels.push(targetNodeName)
          }
        }
      }

      const allConnectedVesselNames = new Set([...inp_vessels, ...out_vessels])
      const connectedNodeObjects = Array.from(allConnectedVesselNames)
        .map((name) => nodeNameObjMap.get(name))
        .filter(Boolean) // Filter out any undefined/missing nodes

      const portTypes = ['general_ports', 'entrance_ports', 'exit_ports']
      const portsByType = {}

      for (const type of portTypes) {
        portsByType[type] = (node.data.portLabels || [])
          .filter((pl) => pl.portType === type)
          .map((info) => {
            const currentPortLabel = info.label

            // Count connected nodes with same port label
            const connectedCount = connectedNodeObjects.reduce(
              (count, connectedNode) => {
                return (
                  count +
                  ((connectedNode.data.portLabels || []).some(
                    (pl) => pl.label === currentPortLabel
                  )
                    ? 1
                    : 0)
                )
              },
              0
            )

            const portEntry = {
              port_type: currentPortLabel,
              variables: [info.option] || [],
            }

            if (info.isMultiPortSum) portEntry.multi_port = 'Sum'
            else if (connectedCount > 1) portEntry.multi_port = 'True'

            return portEntry
          })
      }

      let variablesAndUnits = []
      for (const variable of node.data.portOptions || []) {
        variablesAndUnits.push([
          variable.name,
          variable.units || 'missing',
          'access',
          classifyVariable(node.data.name, variable, parameters),
        ])
      }

      module_config.push({
        vessel_type: node.data.name,
        BC_type: BC_type,
        module_format: 'cellml',
        module_file: node.data.sourceFile,
        module_type: node.data.componentName,
        entrance_ports: portsByType.entrance_ports || [],
        exit_ports: portsByType.exit_ports || [],
        general_ports: portsByType.general_ports || [],
        variables_and_units: variablesAndUnits,
      })
      vessel_array.push({
        name: node.data.name,
        BC_type: BC_type,
        vessel_type: node.data.name,
        inp_vessels: inp_vessels.join(' '),
        out_vessels: out_vessels.join(' '),
      })
    }

    zip.file(
      `${fileName}_module_config.json`,
      JSON.stringify(module_config, null, 2)
    )

    const csvData = Papa.unparse(vessel_array)
    zip.file(`${fileName}_vessel_array.csv`, csvData)

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    })

    return zipBlob
  } catch (error) {
    ElNotification.error(`Failed to export config files: ${error.message}`)
    throw error
  }
}
