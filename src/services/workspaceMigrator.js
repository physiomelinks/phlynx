/**
 * Import mapper: legacy Phlynx build files -> new format.
 * Converts old workspace state to the 1.0.0 format.
 */

// Import the helper function (adjust path as needed)
import { extractComponentsFromCellmlString } from '../utils/cellml'
import {
  MAIN_NODE_TYPE,
  HANDLE_VARIANT,
  BASELINE_SIMULATION_SETTINGS,
  PHLYNX_PROJECT_VERSION,
  PHLYNX_PROJECT_IDENTIFIER,
} from '../utils/constants'
import { normalisePorts, normaliseVariables } from '../utils/config'
import { buildGhostHandles, findMostCentralGhostHandle } from '../utils/handles'

function mergeVariables(oldData, nodeName, globalConstantNames, paramLookup) {
  const typeLookup = {}
  ;(oldData.variables || []).forEach((v) => {
    typeLookup[v.name] = v
  })

  return (oldData.portOptions || []).map((opt) => {
    const name = opt.name
    const units = opt.units
    const legacyVar = typeLookup[name]
    const varType = legacyVar ? legacyVar.type : 'variable'
    const legacyValue = legacyVar && legacyVar.value !== undefined ? legacyVar.value : null

    let value = null
    let dataReference = null

    if (varType === 'global_constant') {
      value = null
      dataReference = null
    } else {
      const key = `${name}_${nodeName}`
      const match = paramLookup[key]
      if (match) {
        value = match.value !== undefined ? match.value : null
        dataReference = match.data_reference !== undefined ? match.data_reference : null
      } else {
        value = legacyValue
        dataReference = null
      }
    }

    return {
      name,
      value,
      units,
      access: 'access',
      type: varType,
      data_reference: dataReference,
    }
  })
}

function convertPorts(oldData) {
  return (oldData.portLabels || []).map((p) => ({
    portType: p.portType,
    label: p.label,
    variables: p.option || [],
    multiportType: p.multiport,
  }))
}

function convertHandles(oldData, uidMap) {
  const migratedHandles = buildGhostHandles()
  for (const port of oldData.ports) {
    const oldUid = port.uid
    const centralGhost = findMostCentralGhostHandle(port.side, migratedHandles)
    if (!centralGhost) return
    uidMap[oldUid] = centralGhost.uid
    const handle = migratedHandles.find((h) => h.uid === centralGhost.uid)
    if (handle) {
      handle.variant = HANDLE_VARIANT.DEFAULT
      handle.type = port.type
    }
  }
  return migratedHandles
}

function convertNode(node, newId, globalConstantNames, paramLookup, uidMap) {
  const oldData = node.data || {}
  const nodeName = oldData.name

  const sourceFile = oldData.sourceFile || ''
  const componentName = oldData.componentName || ''
  const moduleType = oldData.module_type || ''
  const bcType = oldData.BC_type || ''

  const newData = {
    name: nodeName,
    mathRef: `${sourceFile}:${componentName}`,
    moduleRef: `${moduleType}:${bcType}`,
    variables: mergeVariables(oldData, nodeName, globalConstantNames, paramLookup),
    ports: convertPorts(oldData),
    handles: convertHandles(oldData, uidMap),
  }

  const newNode = {
    id: newId,
    type: MAIN_NODE_TYPE,
    position: node.position,
    data: newData,
  }

  if ('style' in node) newNode.style = node.style
  return newNode
}

function convertPortRef(portRef) {
  if (!portRef) return null
  return {
    portType: portRef.portType,
    label: portRef.label,
    variables: portRef.option || [],
    multiportType: portRef.multiport,
  }
}

function convertEdge(edge, idMap, uidMap) {
  const oldSource = edge.source
  const oldTarget = edge.target
  let newSource = idMap[oldSource]
  let newTarget = idMap[oldTarget]

  if (!newSource || !newTarget) {
    console.warn(
      `Edge '${edge.id}': source/target (${oldSource}/${oldTarget}) not found in node id map; edge may be broken.`
    )
    newSource = newSource || oldSource
    newTarget = newTarget || oldTarget
  }

  function remapHandle(h, label) {
    if (!h) return null
    let oldUid = h
    if (!h.startsWith('port_')) {
      console.warn(`Edge '${edge.id}': unexpected ${label} format '${h}' (expected 'port_<uid>'); left prefix as-is.`)
    } else {
      oldUid = h.slice(5)
    }

    let newUid = uidMap[oldUid]
    if (!newUid) {
      console.warn(
        `Edge '${edge.id}': ${label} uid '${oldUid}' not found among converted node handles; keeping original uid.`
      )
      newUid = oldUid
    }
    return `handle_${newUid}`
  }

  const oldCouplings = edge.data && edge.data.couplings ? edge.data.couplings : []
  const newCouplings = oldCouplings.map((c) => ({
    sourcePort: convertPortRef(c.sourcePortLabel),
    targetPort: convertPortRef(c.targetPortLabel),
  }))

  return {
    id: `${newSource}--${newTarget}`,
    type: edge.type,
    source: newSource,
    target: newTarget,
    sourceHandle: remapHandle(edge.sourceHandle, 'sourceHandle'),
    targetHandle: remapHandle(edge.targetHandle, 'targetHandle'),
    data: { couplings: newCouplings },
    label: edge.label || '',
    markerEnd: edge.markerEnd,
    style: edge.style,
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
  }
}

function collectGlobalConstantNames(nodes) {
  const names = new Set()
  nodes.forEach((node) => {
    const vars = node.data && node.data.variables ? node.data.variables : []
    vars.forEach((v) => {
      if (v.type === 'global_constant') names.add(v.name)
    })
  })
  return names
}

function buildParamLookup(availableParameters) {
  const lookup = {}
  availableParameters.forEach(([key, entry]) => {
    const vname = entry.variable_name
    if (vname != null && !(vname in lookup)) {
      lookup[vname] = entry
    }
  })
  return lookup
}

function buildGlobalConstants(availableParameters, globalConstantNames) {
  const result = []
  const seen = new Set()
  availableParameters.forEach(([key, entry]) => {
    const vname = entry.variable_name
    if (globalConstantNames.has(vname) && !seen.has(vname)) {
      seen.add(vname)
      result.push([
        vname,
        {
          value: entry.value,
          units: entry.units,
          data_reference: entry.data_reference,
        },
      ])
    }
  })
  return result
}

function extractComponentsToMathRefs(availableModules) {
  const newAvailableMath = {}
  if (!availableModules) return newAvailableMath

  for (const collection of availableModules) {
    if (!collection.model) continue

    const result = extractComponentsFromCellmlString(collection.model)

    if (result.errors && result.errors.length > 0) {
      console.warn(`Errors extracting components from ${collection.filename}:`, result.errors)
    }

    if (result.xml && Array.isArray(result.xml)) {
      for (const component of result.xml) {
        const mathRefKey = `${collection.filename}:${component.name}`
        newAvailableMath[mathRefKey] = component.math
      }
    }
  }

  return newAvailableMath
}

function extractModulesToModuleRefs(availableModules) {
  const newAvailableModules = {}
  if (!availableModules) return newAvailableModules

  for (const collection of availableModules) {
    const modulesList = collection.modules
    for (const modules of modulesList) {
      if (!modules.configs) continue
      modules.configs.forEach((config) => {
        const moduleType = config.vessel_type
        const moduleSubtype = config.BC_type
        const componentFile = config.module_file
        const componentName = config.module_type

        const moduleRef = `${moduleType}:${moduleSubtype}`
        const mathRef = `${componentFile}:${componentName}`

        newAvailableModules[moduleRef] = {
          moduleRef,
          mathRef,
          ports: normalisePorts(config),
          variables: normaliseVariables(config.variables_and_units),
        }
      })
    }
  }
  return newAvailableModules
}

function convertStore(oldStore, globalConstantNames) {
  const availableParameters = oldStore.availableParameters || []

  const newUnits = oldStore.availableUnits.map((u) => ({
    componentFile: u.filename,
    model: u.model,
  }))

  const newAvailableMath = extractComponentsToMathRefs(oldStore.availableModules)
  const newAvailableModules = extractModulesToModuleRefs(oldStore.availableModules)

  const newAvailableCollections = {}
  Object.values(newAvailableModules).forEach((mod) => {
    if (!newAvailableCollections[mod.mathRef]) {
      newAvailableCollections[mod.mathRef] = new Set()
    }
    newAvailableCollections[mod.mathRef].add(mod.moduleRef)
  })

  return {
    availableCollections: Object.entries(newAvailableCollections).map(([mathRef, moduleRefsSet]) => [
      mathRef,
      Array.from(moduleRefsSet),
    ]),
    availableModules: Object.entries(newAvailableModules),
    availableMath: Object.entries(newAvailableMath),
    availableUnits: newUnits,
    globalConstants: buildGlobalConstants(availableParameters, globalConstantNames),
    lastSaveName: oldStore.lastSaveName,
  }
}

export function migrateWorkspace(doc) {
  if (doc && doc.version) {
    return {
      ...doc,
      id: PHLYNX_PROJECT_IDENTIFIER,
      version: PHLYNX_PROJECT_VERSION,
      inspectionModules: doc.inspectionModules || []
    }
  }

  const oldFlow = doc.flow
  const oldStore = doc.store
  const oldNodes = oldFlow.nodes
  const oldEdges = oldFlow.edges

  // Sequential id map
  const idMap = {}
  oldNodes.forEach((n, i) => {
    idMap[n.id] = `dndnode_${i}`
  })

  const globalConstantNames = collectGlobalConstantNames(oldNodes)
  const paramLookup = buildParamLookup(oldStore.availableParameters || [])

  const uidMap = {}

  const newNodes = oldNodes.map((n) => convertNode(n, idMap[n.id], globalConstantNames, paramLookup, uidMap))

  const newEdges = oldEdges.map((e) => convertEdge(e, idMap, uidMap))

  const newFlow = {
    nodes: newNodes,
    edges: newEdges,
    position: oldFlow.position,
    zoom: oldFlow.zoom,
    viewport: oldFlow.viewport,
  }

  return {
    id: PHLYNX_PROJECT_IDENTIFIER,
    version: PHLYNX_PROJECT_VERSION,
    flow: newFlow,
    store: convertStore(oldStore, globalConstantNames),
    simulation: {
      simulationSettings: { ...BASELINE_SIMULATION_SETTINGS },
      plotConfig: {},
      parameterScanConfig: {},
    },
    inspectionModules: [],
  }
}
