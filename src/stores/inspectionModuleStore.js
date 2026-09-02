import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInspectionModuleStore = defineStore('inspectionModules', () => {
  const modules = ref([])

  function normaliseVariables(variables) {
    return (variables || []).map((v) => ({ ...v, sign: v.sign === -1 ? -1 : 1 }))
  }

  /**
   * @param {{
   *   id?: string,
   *   name: string,
   *   units: string,
   *   variables: Array<{ key: string, nodeId: string, nodeName: string, variableName: string, units: string, sign?: 1 | -1 }>,
   *   advanced?: boolean,
   *   formula?: string | null,
   * }} payload
   */
  function addModule({ id, name, units, variables, advanced = false, formula = null }) {
    const module = {
      id: id || `inspection-${crypto.randomUUID()}`,
      name,
      units: units || '',
      variables: normaliseVariables(variables),
      advanced: Boolean(advanced),
      formula: advanced ? formula || '' : null,
    }
    modules.value.push(module)
    return module
  }

  /**
   * Same payload shape as addModule, applied in place to an existing module.
   */
  function updateModule(id, { name, units, variables, advanced = false, formula = null }) {
    const module = modules.value.find((module) => module.id === id)
    if (!module) return null

    module.name = name
    module.units = units || ''
    module.variables = normaliseVariables(variables)
    module.advanced = Boolean(advanced)
    module.formula = advanced ? formula || '' : null
    return module
  }

  function removeModule(id) {
    modules.value = modules.value.filter((module) => module.id !== id)
  }

  function renameModule(id, name) {
    const module = modules.value.find((module) => module.id === id)
    if (module) module.name = name
  }

  function resetState() {
    modules.value = []
  }

  function getState() {
    return modules.value
  }

  function loadState(availableModules) {
    resetState()
    for (const module of availableModules || []) {
      addModule(module)
    }
  }

  return {
    modules,
    addModule,
    updateModule,
    removeModule,
    renameModule,
    resetState,
    getState,
    loadState,
  }
})
