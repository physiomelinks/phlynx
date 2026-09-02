function buildPorts(moduleData) {
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
          variables: p.variables.flat(),
          multiportType: p.multi_port ?? 'None',
        }))
    )
}

export { buildPorts }
