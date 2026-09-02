import { TARGET_COMPATIBLE } from "./constants"

export function isCompatible(srcType, tgtType) {
  return TARGET_COMPATIBLE[srcType]?.has(tgtType) ?? false
}

export function findPort(ports, port) {
  if (!port) return null
  return ports.find((p) =>
    p.label === port.label &&
    p.portType === port.portType &&
    JSON.stringify(p.variables) === JSON.stringify(port.variables)
  ) ?? null
}
