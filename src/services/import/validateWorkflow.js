export function validateWorkflowModules(moduleConfig, availableModules) {
  const available = new Set()

  availableModules.forEach(file => {
    file.modules.forEach(module => {
      available.add(module.componentType)
    })
  })

  const missing = moduleConfig
    .map(m => m.module_type)
    .filter(type => !available.has(type))

  return {
    valid: missing.length === 0,
    missing,
  }
}
