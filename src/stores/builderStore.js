import { defineStore } from 'pinia'
import { ref } from 'vue'

import { isEditableVariableType } from '../utils/variables'

function mergeIntoStore(newModules, target) {
  const moduleMap = new Map(target.map((mod) => [mod.filename, mod]))

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.filename) {
        // Safety check
        moduleMap.set(newModule.filename, newModule)
      }
    }
  }

  target.length = 0
  target.push(...moduleMap.values())
}

function mergeIn(sourceMap, targetMap) {
  for (const [key, value] of sourceMap) {
    targetMap.set(key, value)
  }
}

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---
  const availableModules = ref([])
  const availableUnits = ref([])
  const lastSaveName = ref('phlynx-project')
  const lastExportName = ref('phlynx-export')

  const availableParameters = ref(new Map())
  const availableVariableNameIdMap = ref(new Map())
  const globalConstants = ref(new Map())

  // --- DEBUG ---

  function listModules() {
    availableModules.value.forEach((e) => console.log(e.filename))
  }

  function listUnits() {
    availableUnits.value.forEach((e) => {
      console.log(e.filename)
      console.log(e.model.substring(0, 200))
    })
  }

  // --- ACTIONS ---
  function normalizeValue(val) {
    if (!val || val === '-') return val // Ignore placeholders

    const num = parseFloat(val)

    // If it's not a number, return original string (e.g. text values)
    if (isNaN(num)) return val

    return String(num)
  }

  function createParameterKey(parameter) {
    return `${parameter.variable_name.trim()}||${parameter.units.trim()}||${normalizeValue(
      parameter.value.trim()
    )}||${parameter.data_reference.trim()}`
  }

  function addParameterFile(filename, data) {
    if (!data || !Array.isArray(data)) return false

    for (const param of data) {
      const key = createParameterKey(param)
      if (availableParameters.value.has(key)) {
        availableParameters.value.get(key).count += 1
        availableParameters.value.get(key).source.push(filename)
        // console.log(`Parameter already exists, skipping: ${key}, count: ${availableParameters.value.get(key).count}`)
        continue
      }

      const trimmedVariableName = param.variable_name.trim()
      if (trimmedVariableName === '' || trimmedVariableName === '#') {
        continue
      }
      const newParameterSet = {
        data_reference: param.data_reference.trim(),
        variable_name: trimmedVariableName,
        units: param.units.trim(),
        value: normalizeValue(param.value.trim()),
        source: [filename],
        count: 1,
        id: 'id_' + availableParameters.value.size,
      }
      availableParameters.value.set(key, newParameterSet)
      if (!availableVariableNameIdMap.value.has(trimmedVariableName)) {
        availableVariableNameIdMap.value.set(trimmedVariableName, [])
      }
      availableVariableNameIdMap.value.get(trimmedVariableName).push(key)
    }
    return true
  }

  function clearGlobalConstants() {
    globalConstants.value.clear()
  }

  function assignGlobalConstant(variableName, value, units) {
    globalConstants.value.set(variableName, { value, units })
  }

  function getGlobalConstant(variableName) {
    return globalConstants.value.get(variableName)
  }

  function getParameterValuesForInstanceVariable(instanceVariable) {
    let results = []
    const paramKeys = availableVariableNameIdMap.value.get(instanceVariable)
    if (paramKeys) {
      results = paramKeys.map((key) => availableParameters.value.get(key))
    }

    return results
  }

  function setVariableParameterValuesForInstance(instanceName, variables, sourceFile, componentName, configIndex) {
    const module = getModulesModule(sourceFile, componentName)
    let variablesAndUnits = []
    if (module?.configs && configIndex !== undefined && module.configs[configIndex]) {
      variablesAndUnits = module.configs[configIndex]?.variables_and_units ?? []
    }
    const configMap = new Map(variablesAndUnits.map((arr) => [arr[0], arr]))
    for (const variable of variables) {
      const configEntry = configMap.get(variable.name)
      // Default to 'variable' if not found in config
      const variableType = configEntry ? configEntry[3] : 'variable'
      variable.type = variableType
      if (isEditableVariableType(variableType)) {
        const lookupName = variable.name + (variableType === 'global_constant' ? '' : '_' + instanceName)
        const parameterValues = getParameterValuesForInstanceVariable(lookupName)
        if (parameterValues.length === 1 && parameterValues[0].units === variable.units) {
          if (variableType === 'global_constant') {
            assignGlobalConstant(variable.name, parameterValues[0].value, parameterValues[0].units)
          } else {
            variable.value = parameterValues[0].value
          }
        }
      }
    }
  }

  // --- SETTERS ---

  function setLastSaveName(name) {
    lastSaveName.value = name
  }

  function setLastExportName(name) {
    lastExportName.value = name
  }

  function addOrUpdateFile(collection, payload) {
    const existingFile = collection.value.find((f) => f.filename === payload.filename)

    if (existingFile) {
      // Replace existing file's data
      Object.assign(existingFile, payload)
    } else {
      // Add new file to the list
      collection.value.push(payload)
    }
  }

  /**
   * Adds configuration(s) to the appropriate module(s)
   */
  function addConfigFile(payload, filename) {
    const configs = payload
    const configFilename = filename
    if (!configs || !Array.isArray(configs)) {
      console.warn('[builderStore] Invalid config file payload:', payload)
      return
    }

    configs.forEach((config) => {
      if (!config.module_file || typeof config.module_file !== 'string') {
        console.warn('[builderStore] Skipping config: missing module_file', config)
        return
      }

      let moduleFile = availableModules.value.find((f) => f.filename === config.module_file)

      if (!moduleFile) {
        moduleFile = {
          filename: config.module_file,
          modules: [],
          isStub: true,
        }
        availableModules.value.push(moduleFile)
      }

      let module = moduleFile.modules.find((m) => m.name === config.module_type || m.type === config.module_type)

      if (!module) {
        module = {
          name: config.module_type,
          componentName: config.module_type,
          configs: [],
        }
        moduleFile.modules.push(module)
      }

      if (!module.configs) {
        module.configs = []
      }

      const existingConfigIndex = module.configs.findIndex(
        (c) => c.BC_type === config.BC_type && c.vessel_type === config.vessel_type
      )

      const configWithMetadata = {
        ...config,
        _sourceFile: configFilename,
        _loadedAt: new Date().toISOString(),
      }

      if (existingConfigIndex !== -1) {
        module.configs[existingConfigIndex] = configWithMetadata
      } else {
        module.configs.push(configWithMetadata)
      }
    })
  }

  function addModuleFile(payload) {
    const existingFile = availableModules.value.find((f) => f.filename === payload.filename)

    if (existingFile) {
      if (existingFile.isStub) {
        delete existingFile.isStub
      }

      if (existingFile.modules) {
        payload.modules.forEach((newMod) => {
          const oldMod = existingFile.modules.find((m) => m.name === newMod.name)
          if (oldMod && oldMod.configs && oldMod.configs.length > 0) {
            newMod.configs = oldMod.configs
          }
        })
      }
    }

    addOrUpdateFile(availableModules, payload)
  }

  function addUnitsFile(payload) {
    addOrUpdateFile(availableUnits, payload)
  }

  function loadState(state) {
    mergeIntoStore(state.availableModules, availableModules.value)
    mergeIntoStore(state.availableUnits, availableUnits.value)
    if (state.availableParameters) {
      mergeIn(new Map(state.availableParameters), availableParameters.value)
    }
    if (state.availableVariableNameIdMap) {
      mergeIn(new Map(state.availableVariableNameIdMap), availableVariableNameIdMap.value)
    }
    if (state.globalConstants) {
      mergeIn(new Map(state.globalConstants), globalConstants.value)
    }
    lastSaveName.value = state.lastSaveName || 'phlynx-project'
    lastExportName.value = state.lastExportName || 'phlynx-export'
  }

  function removeFile(collection, filename) {
    const index = collection.value.findIndex((f) => f.filename === filename)
    if (index !== -1) {
      collection.value.splice(index, 1)
    }
  }

  /**
   * Removes a module file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeModuleFile(filename) {
    removeFile(availableModules, filename)
  }

  function getModuleContent(filename) {
    const index = availableModules.value.findIndex((f) => f.filename === filename)
    if (index !== -1) {
      return availableModules.value[index].model
    }
    return ''
  }

  function getModulesModule(filename, moduleName) {
    const file = availableModules.value.find((f) => f.filename === filename)
    if (!file) return null

    const module = file.modules.find((m) => m.name === moduleName)
    return module || null
  }

  /**
   * Adds a new units file and its model.
   * If the units file already exists it will be replaced.
   * @param {*} payload
   */
  function addUnitsFile(payload) {
    const existingFile = availableUnits.value.find((f) => f.filename === payload.filename)
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  /**
   * Checks if a module file is already loaded.
   * @param {string} filename - The name of the file to check.
   * @returns {boolean} - True if the file is loaded, false otherwise.
   */
  function hasModuleFile(filename) {
    return availableModules.value.some((f) => f.filename === filename)
  }

  function getConfigForVessel(vesselType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.configs) {
          const configIndex = module.configs.findIndex((c) => c.vessel_type === vesselType && c.BC_type === bcType)
          if (configIndex !== -1) {
            return {
              config: module.configs[configIndex],
              configIndex: configIndex,
              module: module,
              filename: file.filename,
            }
          }
        }
      }
    }
    return null
  }

  function getState() {
    return {
      availableModules: availableModules.value,
      availableParameters: Array.from(availableParameters.value.entries()),
      availableUnits: availableUnits.value,
      availableVariableNameIdMap: Array.from(availableVariableNameIdMap.value.entries()),
      globalConstants: Array.from(globalConstants.value.entries()),
      lastExportName: lastExportName.value,
      lastSaveName: lastSaveName.value,
    }
  }

  function getGlobalVariables() {
    return globalConstants.value
  }

  return {
    // State
    availableModules,
    availableUnits,
    lastExportName,
    lastSaveName,

    // Actions
    addConfigFile,
    addModuleFile,
    addParameterFile,
    addUnitsFile,
    assignGlobalConstant,
    clearGlobalConstants,
    loadState,
    removeModuleFile,
    setLastExportName,
    setLastSaveName,
    setVariableParameterValuesForInstance,

    // Getters
    getConfigForVessel,
    getGlobalConstant,
    getGlobalVariables,
    getModuleContent,
    getModulesModule,
    getParameterValuesForInstanceVariable,
    getState,
    hasModuleFile,

    // Debug
    listModules,
    listUnits,
  }
})
