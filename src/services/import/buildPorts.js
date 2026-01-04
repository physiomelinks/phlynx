import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from "../../utils/constants"

function parseVesselNames(vesselField) {
  return Array.from(
    new Set(vesselField?.trim().split(/\s+/).filter(Boolean) ?? [])
  )
}

function buildPorts(vessel) {
  const ports = []

  if (vessel.inp_vessels) {
    const inputs = parseVesselNames(vessel.inp_vessels)
    inputs.forEach((name) => {
      ports.push({
        uid: crypto.randomUUID(),
        type: TARGET_PORT_TYPE,
        side: 'left',
        name,
      })
    })
  }

  if (vessel.out_vessels) {
    const outputs = parseVesselNames(vessel.out_vessels)
    outputs.forEach((name) => {
      ports.push({
        uid: crypto.randomUUID(),
        type: SOURCE_PORT_TYPE,
        side: 'right',
        name,
      })
    })
  }

  return ports
}

function buildPortLabels(moduleData) {
  return Object.entries(moduleData)
    .filter(
      ([key, value]) =>
        ['general_ports', 'entrance_ports', 'exit_ports'].includes(key) &&
        Array.isArray(value)
    )
    .flatMap(([type, ports]) =>
      ports
        .filter((p) => p.port_type && p.variables?.length)
        .map((p) => ({
          portType: type,
          label: p.port_type,
          option: p.variables[0],
          isMultiPortSum: p.multi_port === 'Sum',
        }))
    )
}

export { buildPortLabels, buildPorts }
