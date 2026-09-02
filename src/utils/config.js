import { PORT_TYPE_OPTIONS } from "./constants"
import { toRaw } from "vue"

export function parseMathRef(mathRef) {
  const [componentFile, componentName] = mathRef.split(':')
  return { componentFile, componentName }
}

export function parseModuleRef(moduleRef) {
  const [moduleType, moduleSubtype] = moduleRef.split(':')
  return { moduleType, moduleSubtype }
}

export function normaliseConfig(config) {
  return {
    moduleRef: `${config.module_type}:${config.module_subtype}`,
    mathRef: `${config.component_file}:${config.component_type}`,
    ports: normalisePorts(config),
    variables: normaliseVariables(config.variables_and_units),
  }
}

// applied on import
export function normalisePorts(config) {
  const ports = []

  PORT_TYPE_OPTIONS.forEach((portType) => {
    const list = config?.[portType.value] || []
    for (const p of list) {
      ports.push({
        portType: portType.value,
        label: p.port_type, 
        variables: p.variables || [],
        multiportType: parseMultiport(p.multi_port),
      })
    }
  })
  return ports
}

// applied on export
export function restorePorts(ports) {
  const config = {}
  
  PORT_TYPE_OPTIONS.forEach((portType) => {
    config[portType.value] = []
  })

  for (const p of (ports || [])) {
    if (!config[p.portType]) {
      config[p.portType] = []
    }

    const portEntry = {
      port_type: p.label,
      variables: toRaw(p.variables) || [],
    }

    const multiPortValue = unparseMultiport(p.multiportType)
    
    if (multiPortValue !== undefined) {
      portEntry.multi_port = multiPortValue
    }

    config[p.portType].push(portEntry)
  }

  return config
}

export function normaliseVariables(RawVariablesAndUnits = []) {
  return RawVariablesAndUnits.map(([name, units, access, type]) => ({
    name,
    value: null,
    units,
    access,
    type,
    data_reference: null,
  }))
}

export function restoreVariables(variables = []) {
  return variables.map(v => [
    v.name,
    v.units,
    v.access,
    v.type
  ])
}

function parseMultiport(value) {
  if (value === true || value === "True") return "True"
  if (value === "Sum") return "Sum"
  if (value === "Multiply") return "Multiply"
  return "None"
}

function unparseMultiport(value) {
  if (value === "None") return undefined
  return value
}
