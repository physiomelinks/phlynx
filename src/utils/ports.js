import { Position } from '@vue-flow/core'

export const PORT_SIDES = ["left", "right", "top", "bottom"]
export const SOURCE_PORT_PRIORITY = ["right", "bottom", "top", "left"]
export const TARGET_PORT_PRIORITY = ["left", "top", "bottom", "right"]

export function randomPortSide() {
    return PORT_SIDES[Math.floor(Math.random() * PORT_SIDES.length)]
}

export function getHandleId(port) {
    return `port_${port.uid}`
}

export function portPosition(side) {
  switch (side) {
    case 'left':
      return Position.Left
    case 'right':
      return Position.Right
    case 'top':
      return Position.Top
    case 'bottom':
      return Position.Bottom
    default:
      return Position.Left
  }
}

export function getHandleStyle(port, allPorts) {
  const portsOfSameType = allPorts.filter((p) => p.side === port.side)
  const n = portsOfSameType.length

  // Space between each port.
  const portSpacing = 16
  const positionIndex = portsOfSameType.findIndex((p) => p.uid === port.uid)

  // guard: if not found, fall back to 0
  const safeIndex = positionIndex === -1 ? 0 : positionIndex

  // This calculates the offset from the center
  const offset = portSpacing * (positionIndex - (n - 1) / 2)

  if (['top', 'bottom'].includes(port.side)) {
    // Let CSS calculate the 50% mark and apply the offset
    return {
      left: `calc(50% + ${offset}px)`,
    }
  }

  // Let CSS calculate the 50% mark and apply the offset
  return {
    top: `calc(50% + ${offset}px)`,
  }
}
