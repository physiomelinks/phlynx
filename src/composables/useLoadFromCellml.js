import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { useClearWorkspace } from '../utils/workspace'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { processCellMLData } from '../utils/cellml'
import { parseCellMLConnections } from '../services/import/parseCellmlConnections'
import { resolvePortCouplings } from '../utils/edges'
import { getHandleId } from '../utils/ports'
import { SOURCE_PORT_TYPE } from '../utils/constants'

function getHandleName(edge) {
  return `${edge.source}-${edge.target}`
}

function createPorts(edges, nodeName) {
  return edges
    .filter(e => e.source === nodeName || e.target === nodeName)
    .map(e => ({
      uid: crypto.randomUUID(),
      port_type: SOURCE_PORT_TYPE,
      side: 'left',
      name: getHandleName(e),
    }))
}

export function useLoadFromCellML() {
  const {
    addNodes,
    addEdges,
    onNodesInitialized,
    fitView,
    updateNodeInternals,
    updateNodeData,
  } = useVueFlow()

  const store = useBuilderStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()

  const layoutPending = ref(false)
  let pendingEdgeData = []
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const loadFromCellML = async (cellmlContent, filename) => {
    try {
      await clearWorkspace()

      const { components, edges, configs } =
        parseCellMLConnections(cellmlContent, filename)

      if (components.length === 0) {
        notify.info({
          title: 'No Connections Found',
          message: `${filename} contains no inter-component connections to visualise.`,
        })
        return
      }

      store.addConfigFile(configs, filename)

      const cellmlResult = processCellMLData(cellmlContent)
      if (cellmlResult.type !== 'success') {
        throw new Error(
          `CellML parse error: ${cellmlResult.issues.map((i) => i.description).join('; ')}`
        )
      }

      const componentDataByName = new Map(
        cellmlResult.components.data.map((c) => [c.componentName, c])
      )

      const nodes = components.map((compName) => {
        const compData = componentDataByName.get(compName) ?? {}
        const variables = compData.variables ?? []
        const portOptions = compData.portOptions ?? []

        store.setVariableParameterValuesForInstance(
          compName,
          variables,
          filename,
          compName,
          0
        )

        const moduleConfig =
          store.getModuleConfigFromConfigIndex(filename, compName, 0) ?? {}

        const rawPorts = moduleConfig.general_ports ?? []

        // If a component has more than one edge, set all ports to be True
        const edgeCount = edges.filter(
          e => e.source === compName || e.target === compName
        ).length

        const portLabels = rawPorts.map((p) => ({
          portType: 'general_ports',
          label: p.port_type,
          option: p.variables ?? [],
          multiport: edgeCount > 1 ? 'True' : 'None',
        }))

        const ports = createPorts(edges, compName)

        return {
          id: compName,
          type: 'moduleNode',
          position: { x: 100, y: 100 },
          style: { opacity: 0 },
          data: {
            componentName: compName,
            configIndex: 0,
            label: `${compName} — ${filename}`,
            name: compName,
            portLabels,
            portOptions,
            ports,
            hasPrescribedPosition: false,
            sourceFile: filename,
            variables,
          },
        }
      })

      pendingEdgeData = edges

      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true
      addNodes(nodes)

      await layoutCompletePromise

      trackEvent('cellml_connection_load', {
        category: 'CellML',
        action: 'load_from_cellml_connections',
        label: `Components: ${components.length}, Edges: ${edges.length}`,
        file_type: 'cellml',
      })
    } catch (error) {
      notify.error({
        message: `Failed to load CellML connections: ${error.message}`,
      })
      layoutPending.value = false
      pendingEdgeData = []
      layoutCompleteResolve = null
      layoutCompleteReject = null
      throw error
    }
  }

  onNodesInitialized(async (initializedNodes) => {
    if (!layoutPending.value || initializedNodes.length === 0) return

    const resolveFunc = layoutCompleteResolve
    const rejectFunc = layoutCompleteReject

    try {
      runFcoseLayout(initializedNodes, pendingEdgeData)
      await nextTick()

      const nodeMap = new Map(
        initializedNodes.map((n) => [n.id, n])
      )

      // Reassign handle sides
      for (const node of initializedNodes) {
        const nx =
          node.position.x +
          (node.dimensions?.width ?? 0) / 2
        const ny =
          node.position.y +
          (node.dimensions?.height ?? 0) / 2

        const newPorts = node.data.ports.map((port) => {
          const connectedPeers = pendingEdgeData
            .filter(
              (e) =>
                (e.source === node.id || e.target === node.id) &&
                port.name === getHandleName(e)
            )
            .map((e) =>
              nodeMap.get(
                e.source === node.id ? e.target : e.source
              )
            )
            .filter(Boolean)

          if (connectedPeers.length === 0) return port

          const avgPx =
            connectedPeers.reduce(
              (sum, p) =>
                sum +
                p.position.x +
                (p.dimensions?.width ?? 0) / 2,
              0
            ) / connectedPeers.length

          const avgPy =
            connectedPeers.reduce(
              (sum, p) =>
                sum +
                p.position.y +
                (p.dimensions?.height ?? 0) / 2,
              0
            ) / connectedPeers.length

          const dx = avgPx - nx
          const dy = avgPy - ny

          const side =
            Math.abs(dx) >= Math.abs(dy)
              ? dx >= 0
                ? 'right'
                : 'left'
              : dy >= 0
              ? 'bottom'
              : 'top'

          return { ...port, side }
        })

        updateNodeData(node.id, { ports: newPorts })
      }

      await nextTick()
      updateNodeInternals(
        initializedNodes.map((n) => n.id)
      )
      await nextTick()

      // Build edges, resolving port couplings using ordinal indices
      // (same logic as onConnect in BuilderView)
      const srcCounts = new Map()
      const tgtCounts = new Map()
      const flowEdges = pendingEdgeData.flatMap((edge) => {
        const { source, target } = edge
        const sourceNode = nodeMap.get(source)
        const targetNode = nodeMap.get(target)
        if (!sourceNode || !targetNode) return []

        const handleName = getHandleName(edge)

        const sourcePort = sourceNode.data.ports.find(
          (p) => p.name === handleName
        )
        const targetPort = targetNode.data.ports.find(
          (p) => p.name === handleName
        )

        if (!sourcePort || !targetPort) return []

        const sourceIndex = srcCounts.get(source) ?? 0
        const targetIndex = tgtCounts.get(target) ?? 0
        srcCounts.set(source, sourceIndex + 1)
        tgtCounts.set(target, targetIndex + 1)

        const couplings = resolvePortCouplings(
          sourceNode.data.portLabels ?? [],
          targetNode.data.portLabels ?? [],
          sourceIndex,
          targetIndex
        )

        return [
          {
            id: `e_cellml_${source}_${target}_${crypto.randomUUID()}`,
            source,
            target,
            sourceHandle: getHandleId(sourcePort),
            targetHandle: getHandleId(targetPort),
            data: { couplings },
          },
        ]
      })

      addEdges(flowEdges)

      historyStore.clear()
      await nextTick()

      fitView({ padding: 0.2, duration: 800 })
      await new Promise((resolve) => setTimeout(resolve, 800))

      if (resolveFunc) resolveFunc()
    } catch (error) {
      historyStore.clear()
      notify.error({
        message: 'Error organising CellML connection layout',
      })
      if (rejectFunc) rejectFunc(error)
    } finally {
      layoutPending.value = false
      pendingEdgeData = []
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromCellML }
}