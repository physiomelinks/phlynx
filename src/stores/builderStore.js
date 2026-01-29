import { defineStore } from 'pinia'
import { ref } from 'vue'

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

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---
  const availableModules = ref([])
  const availableUnits = ref([])
  const lastSaveName = ref('phlynx-project')
  const lastExportName = ref('phlynx-export')

  const parameterFiles = ref(new Map())
  const moduleParameterMap = ref(new Map())
  const moduleAssignmentTypeMap = ref(new Map())
  const fileParameterMap = ref(new Map())
  const fileAssignmentTypeMap = ref(new Map())

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

  function addParameterFile(filename, data) {
    if (!data || !Array.isArray(data)) return false
    parameterFiles.value.set(filename, data)
    return true
  }

  function applyFileParameterLinks(linkMap, typeMap = null) {
    fileParameterMap.value = linkMap
    moduleParameterMap.value = linkMap

    if (typeMap) {
      fileAssignmentTypeMap.value = typeMap
      moduleAssignmentTypeMap.value = typeMap
    }
  }

  function applyParameterLinks(linkMap, typeMap = null) {
    moduleParameterMap.value = linkMap
    fileParameterMap.value = linkMap
    if (typeMap) {
      moduleAssignmentTypeMap.value = typeMap
      fileAssignmentTypeMap.value = typeMap
    }
  }

  function getParameterFileNameForModule(moduleName) {
    return moduleParameterMap.value.get(moduleName) || null
  }

  function getParametersForModule(moduleName) {
    const paramFileName = moduleParameterMap.value.get(moduleName)
    if (!paramFileName) return []
    return parameterFiles.value.get(paramFileName) || []
  }

  function getAssignmentTypeForModule(moduleName) {
    return moduleAssignmentTypeMap.value.get(moduleName) || null
  }

  function getParametersForFile(filename) {
    const paramFileName = fileParameterMap.value.get(filename)
    if (!paramFileName) return []
    return parameterFiles.value.get(paramFileName) || []
  }

  function getParameterFileNameForFile(filename) {
    return fileParameterMap.value.get(filename) || null
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
    fileAssignmentTypeMap.value = new Map(state.fileAssignmentTypeMap || [])
    fileParameterMap.value = new Map(state.fileParameterMap || [])
    lastSaveName.value = state.lastSaveName || 'phlynx-project'
    lastExportName.value = state.lastExportName || 'phlynx-export'
    moduleAssignmentTypeMap.value = new Map(state.moduleAssignmentTypeMap || [])
    moduleParameterMap.value = new Map(state.moduleParameterMap || [])
    parameterFiles.value = new Map(state.parameterFiles || [])
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
    const index = this.availableModules.findIndex((f) => f.filename === filename)
    if (index !== -1) {
      return this.availableModules[index].model
    }
    return ''
  }

  function getModulesModule(filename, moduleName) {
    const file = this.availableModules.find((f) => f.filename === filename)
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
    return this.availableModules.some((f) => f.filename === filename)
  }

  function getConfigForVessel(vesselType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.configs) {
          const config = module.configs.find((c) => c.vessel_type === vesselType && c.BC_type === bcType)
          if (config) {
            return {
              config: config,
              module: module,
              filename: file.filename,
            }
          }
        }
      }
    }
    return null
  }

  function getConfig(moduleType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.name === moduleType || module.type === moduleType) {
          const config = module.configs?.find((c) => c.BC_type === bcType)
          if (config) return config
        }
      }
    }
    return null
  }

  function getSaveState() {
    return {
      availableModules: availableModules.value,
      availableUnits: availableUnits.value,
      lastExportName: lastExportName.value,
      lastSaveName: lastSaveName.value,
      moduleParameterMap: Array.from(moduleParameterMap.value.entries()),
      moduleAssignmentTypeMap: Array.from(moduleAssignmentTypeMap.value.entries()),
      fileParameterMap: Array.from(fileParameterMap.value.entries()),
      fileAssignmentTypeMap: Array.from(fileAssignmentTypeMap.value.entries()),
      parameterFiles: Array.from(parameterFiles.value.entries()),
    }
  }

  // --- GETTERS (computed) ---

  return {
    // State
    availableModules,
    availableUnits,
    lastExportName,
    lastSaveName,
    moduleParameterMap,
    moduleAssignmentTypeMap,
    fileParameterMap,
    fileAssignmentTypeMap,
    parameterFiles,

    // Actions
    addConfigFile,
    addModuleFile,
    addParameterFile,
    addUnitsFile,
    applyParameterLinks, // Re-enabled
    applyFileParameterLinks, // Updated with syncing
    loadState,
    removeModuleFile,
    setLastExportName,
    setLastSaveName,

    // Getters
    getAssignmentTypeForModule,
    getConfig,
    getConfigForVessel,
    getModuleContent,
    getModulesModule,
    getParameterFileNameForFile,
    getParameterFileNameForModule,
    getParametersForFile,
    getParametersForModule,
    getSaveState,
    hasModuleFile,

    // Debug
    listModules,
    listUnits,
  }
})
