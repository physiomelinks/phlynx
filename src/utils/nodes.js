import { useVueFlow } from "@vue-flow/core"
import { FLOW_IDS } from "./constants"

const { getNodes } = useVueFlow(FLOW_IDS.MAIN)

/**
 * Generates a unique instance name based on the instance data and existing names.
 *
 * @param {*} instanceData - The instance to generate a unqiue name for.
 * @param {*} existingNames - A set of existing names to check against.
 * @returns {string} A unique instance name.
 */
export function generateUniqueInstanceName(currentName, existingNames) {
  let finalName = currentName
  let counter = 1

  while (existingNames.has(finalName)) {
    finalName = `${currentName}_${counter}`
    counter++
  }

  return finalName
}

export function sanitiseName(name) {
  // Sanitise: replace spaces with underscores, remove invalid characters
  // Valid CellML component names: alphanumeric, underscore, and must start with letter or underscore
  let sanitised = name
    .trim()
    .replace(/\s+/g, '_') // Replace spaces (and multiple spaces) with underscore
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove all invalid characters

  // Ensure it starts with a letter or underscore
  if (sanitised && !/^[a-zA-Z_]/.test(sanitised)) {
    sanitised = '_' + sanitised
  }

  return sanitised
}

/**
 * Generates a unique node ID for drag-and-drop nodes.
 *
 * @returns {string} Unique node ID.
 */
export function getId(nodeIds, prefix = 'dndnode_') {
  // Find the highest existing ID
  let maxId = -1
  nodeIds.forEach((nodeId) => {
    if (nodeId.startsWith(prefix)) {
      const numPart = parseInt(nodeId.split('_')[1], 10)
      if (!isNaN(numPart) && numPart > maxId) {
        maxId = numPart
      }
    }
  })

  // Return the next ID in the sequence
  return `${prefix}${maxId + 1}`
}

export function findAnyNode() {
  return getNodes.value.find(n => n.data?.layoutFrame)
}

/**
 * Puts new modules in the same reference frame if user imported using module array
 * containing x and y (z ignored for now).
 */
export function attachNewNodeToFrame(position, existingNodeData) {
  const frame = existingNodeData?.layoutFrame
  if (!frame) return null

  const refX = position.x / frame.xScale + frame.xCentre
  const refY = position.y / frame.yScale + frame.yCentre

  return {
    layoutFrame: frame,
    layoutRef: { refX, refY }
  }
}
