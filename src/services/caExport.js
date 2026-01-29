import JSZip from 'jszip'
import Papa from 'papaparse'
import { notify } from '../utils/notify'


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
  const nodePortMap = new Map()

  for (const node of nodes) {
    const map = {}
    for (const p of node.data.portLabels || []) {
      const label = p.label.trim().toLowerCase()
      const type =
        p.portType === 'exit_ports'
          ? 'exit'
          : p.portType === 'entrance_ports'
            ? 'entrance'
            : p.portType === 'general_ports'
              ? 'general'
              : null
      if (!type) continue
      if (!map[label]) map[label] = []
      if (!map[label].includes(type)) map[label].push(type)
    }
    nodePortMap.set(node.id, { name: node.data.name, portTypes: map })
  }

  const invalidConnections = []
  for (const edge of edges) {
    const source = nodePortMap.get(edge.source)
    const target = nodePortMap.get(edge.target)

    if (!source || !target) continue

    const allLabels = Array.from(
      new Set([...Object.keys(source.portTypes), ...Object.keys(target.portTypes)])
    )

    for (const label of allLabels) {

      const srcTypes = source.portTypes[label] || []
      const tgtTypes = target.portTypes[label] || []

      if (srcTypes.length === 0 || tgtTypes.length === 0) continue // unknown label

      const isValid = srcTypes.some(srcType =>
        tgtTypes.some(tgtType =>
          (srcType === 'exit' && tgtType === 'entrance') ||
          (srcType === 'entrance' && tgtType === 'exit') ||
          (srcType === 'general' && tgtType === 'general')
        )
      )
      if (!isValid) {
        invalidConnections.push({
          portLabel: label,
          type: `${srcTypes.join('|')}_to_${tgtTypes.join('|')}`,
          nodes: [source.name, target.name],
        })
      }
    }
  }
  return invalidConnections
}


/**
 * Generates a zip blob for the Circulatory Autogen export.
 * @param {string} fileName - The name for the exported files.
 * @param {Array} nodes - The array of nodes from Vue Flow.
 * @param {Array} edges - The array of edges from Vue Flow.
 * @param {Object} builderStore - The Pinia builder store.
 * @returns {Promise<Blob>} A promise that resolves with the zip file blob.
 */
export async function generateExportZip(fileName, nodes, edges, builderStore) {
  try {
    const zip = new JSZip()

    // Create maps for quick lookup of node names and objects
    const nodeNameMap = new Map()
    const nodeNameObjMap = new Map()
    for (const node of nodes) {
      nodeNameMap.set(node.id, node.data.name)
      nodeNameObjMap.set(node.data.name, node)
    }

    let module_config = []
    let vessel_array = []
    const BC_type = 'nn' // Placeholder for boundary condition type

    // --- 1. PROCESS NODES FOR CONFIG AND TOPOLOGY ---
    for (const node of nodes) {
      const inp_vessels = []
      const out_vessels = []

      // Identify incoming and outgoing connections
      for (const edge of edges) {
        if (edge.target === node.id) {
          const sourceNodeName = nodeNameMap.get(edge.source)
          if (sourceNodeName) inp_vessels.push(sourceNodeName)
        }
        if (edge.source === node.id) {
          const targetNodeName = nodeNameMap.get(edge.target)
          if (targetNodeName) out_vessels.push(targetNodeName)
        }
      }

      // Process Ports
      const allConnectedVesselNames = new Set([...inp_vessels, ...out_vessels])
      const connectedNodeObjects = Array.from(allConnectedVesselNames)
        .map((name) => nodeNameObjMap.get(name))
        .filter(Boolean)

      const portTypes = ['general_ports', 'entrance_ports', 'exit_ports']
      const portsByType = {}

      for (const type of portTypes) {
        portsByType[type] = (node.data.portLabels || [])
          .filter((pl) => pl.portType === type)
          .map((info) => {
            const currentPortLabel = info.label
            const connectedCount = connectedNodeObjects.reduce((count, conn) => {
              return count + ((conn.data.portLabels || []).some(pl => pl.label === currentPortLabel) ? 1 : 0)
            }, 0)

            const portEntry = {
              port_type: currentPortLabel,
              variables: info.option || [],
            }
            if (info.isMultiPortSum) portEntry.multi_port = 'Sum'
            else if (connectedCount > 1) portEntry.multi_port = 'True'

            return portEntry
          })
      }

      // --- PARAMETER CLASSIFICATION FOR THIS NODE ---
      const cellmlFileName = node.data?.sourceFile
      // Get parameters specific to this CellML file for the classifyVariable function
      const nodeParameters = builderStore.getParametersForFile(cellmlFileName) || []

      let variablesAndUnits = []
      for (const variable of node.data.portOptions || []) {
        variablesAndUnits.push([
          variable.name,
          variable.units || 'missing',
          'access',
          classifyVariable(node.data.name, variable, nodeParameters),
        ])
      }

      // Build Config and Vessel arrays
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

    // --- 2. CONSOLIDATE PARAMETER FILES INTO ONE CSV ---
    const activeCellMLFiles = new Set(nodes.map(node => node.data?.sourceFile).filter(Boolean))
    let consolidatedParameters = []
    const seenParamFiles = new Set()

    activeCellMLFiles.forEach(cellmlFile => {
      // Find which parameter file is linked to this CellML file
      const paramFileName = builderStore.fileParameterMap.get(cellmlFile)

      if (paramFileName && !seenParamFiles.has(paramFileName)) {
        const params = builderStore.getParametersForFile(cellmlFile)
        consolidatedParameters = [...consolidatedParameters, ...params]
        seenParamFiles.add(paramFileName)
      }
    })

    if (consolidatedParameters.length > 0) {
      zip.file(`${fileName}_parameters.csv`, Papa.unparse(consolidatedParameters))
    }

    // --- 3. FINALIZING AND COMPRESSING ZIP ---
    zip.file(`${fileName}_module_config.json`, JSON.stringify(module_config, null, 2))
    zip.file(`${fileName}_vessel_array.csv`, Papa.unparse(vessel_array))

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    return zipBlob
  } catch (error) {
    console.error('Export Error:', error)
    notify.error({ message: `Failed to export config files: ${error.message}` })
    throw error
  }
}