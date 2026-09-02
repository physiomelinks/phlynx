function parseScopedValue(value, prefix) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const segments = value.split('__')
  if (segments.length < 3 || segments[0] !== prefix) {
    return null
  }

  const remainder = segments.slice(1).join('__')
  const splitIndex = remainder.lastIndexOf('__')

  if (splitIndex === -1) {
    return null
  }

  return {
    nodeName: remainder.slice(0, splitIndex),
    valueName: remainder.slice(splitIndex + 2),
  }
}

function parseNameValue(value) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const [nodeName, ...rest] = value.split('/')
  if (!nodeName || rest.length === 0) {
    return null
  }

  return {
    nodeName,
    valueName: rest.join('/'),
  }
}

export function extractInputSelections(input = [], nodeNameToIdMap = new Map()) {
  return (Array.isArray(input) ? input : []).map((entry, index) => {
    const scoped = parseScopedValue(entry?.id, 'id')
    const fallbackName = typeof entry?.name === 'string' ? entry.name : `scan_${index + 1}`
    const nodeName = scoped?.nodeName || fallbackName
    const parameterName = scoped?.valueName || fallbackName

    return {
      key: `${nodeNameToIdMap.get(nodeName) || 'unknown_node'}::${parameterName}`,
      nodeId: nodeNameToIdMap.get(nodeName) || 'unknown_node',
      nodeName,
      parameterName,
      units: '',
      type: 'parameter',
      selected: true,
      min: Number(entry?.minimumValue ?? 0),
      default: Number(entry?.defaultValue ?? 0),
      max: Number(entry?.maximumValue ?? 0),
      step: entry?.stepValue ?? null,
    }
  })
}

function processTrace(trace, groupId, nodeNameToIdMap) {
  const scoped = parseScopedValue(trace?.yValue, 'data')
  const nameMatch = parseNameValue(trace?.name)
  const nodeName = nameMatch?.nodeName || scoped?.nodeName
  const variableName = nameMatch?.valueName || scoped?.valueName

  if (!nodeName || !variableName) {
    return null
  }

  const nodeId = nodeNameToIdMap.get(nodeName) || 'unknown_node'
  return {
    key: `${nodeId}::${variableName}`,
    nodeId,
    nodeName,
    variableName,
    units: '',
    plot: true,
    groupId,
  }
}

function extractPlots(plots = [], nodeNameToIdMap = new Map()) {
  const extractedPlots = []

  for (const [plotIndex, plot] of plots.entries()) {
    const traces = Array.isArray(plot?.additionalTraces) ? plot.additionalTraces : []
    const groupId = `plot-${plotIndex + 1}`
    const result = processTrace(plot, `plot-${plotIndex + 1}`, nodeNameToIdMap)
    if (result) {
      extractedPlots.push(result)
    }
    for (const trace of traces) {
      // Process each trace
      const result = processTrace(trace, groupId, nodeNameToIdMap)
      if (result) {
        extractedPlots.push(result)
      }
    }
  }

  return extractedPlots
}

export function rehydrateSimulationConfig(jsonData, options = {}) {
  const payload = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
  const plotSelections = extractPlots(payload?.output?.plots || [], options?.nodeNameToIdMap)

  return {
    plotConfig: {
      selections: plotSelections,
    },
    parameterScanConfig: {
      selections: extractInputSelections(payload?.input || [], options?.nodeNameToIdMap),
    },
  }
}

export function extractSimData(jsonData, options = {}) {
  if (!jsonData) {
    return null
  }

  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
  return rehydrateSimulationConfig(data, options)
}
