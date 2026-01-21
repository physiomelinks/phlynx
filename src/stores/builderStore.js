import { defineStore } from 'pinia'
import { ref } from 'vue'

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---
  const availableModules = ref([])
  const availableUnits = ref([])
  const parameterData = ref([])
  const parameterFiles = ref(new Map())
  const moduleParameterMap = ref(new Map())
  const lastSaveName = ref('phlynx-project')
  const lastExportName = ref('phlynx-export')

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

  function applyParameterLinks(linkMap) {
    moduleParameterMap.value = linkMap
  }

  function getParameterFileNameForModule(moduleName) {
    return moduleParameterMap.value.get(moduleName) || null
  }

  function getParametersForModule(moduleName) {
    const paramFileName = moduleParameterMap.value.get(moduleName)
    if (!paramFileName) return []
    return parameterFiles.value.get(paramFileName) || []
  }

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
   * @param {Array} payload - Array of configs
   * @param {string} filename - Optional filename (when first param is array)
   *
   * Usage:
   *   addConfigFile([{...}], 'config.json')
   *
   * Structure of availableModules after adding configs:
   * [
   *   {
   *     filename: "module.cellml",
   *     modules: [
   *       {
   *         name: "artery",
   *         type: "artery",
   *         configs: [
   *           { BC_type: "nn", vessel_type: "aorta", ... },
   *           { BC_type: "pv", vessel_type: "pulmonary", ... }
   *         ]
   *       }
   *     ],
   *     model: "<?xml..."
   *   }
   * ]
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
          isStub: true, // marker to indicate this needs real content later
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

  /**
   * Gets a specific config for a module type and BC type
   * @param {string} moduleType - The module type
   * @param {string} bcType - The BC type
   * @returns {Object|null} The config object or null
   */
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

  // --- GETTERS (computed) ---

  return {
    // State
    availableModules,
    availableUnits,
    lastExportName,
    lastSaveName,
    moduleParameterMap,
    parameterData,
    parameterFiles,

    // Actions
    addConfigFile,
    addModuleFile,
    addParameterFile,
    addUnitsFile,
    applyParameterLinks,
    getConfig,
    getConfigForVessel,
    getModuleContent,
    getParameterFileNameForModule,
    getParametersForModule,
    hasModuleFile,
    removeModuleFile,
    setLastExportName,
    setLastSaveName,

    // Debug
    listModules,
    listUnits,
  }
})
