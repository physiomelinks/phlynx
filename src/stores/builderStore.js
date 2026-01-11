import { defineStore } from 'pinia'
import { ref } from 'vue'

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---
  const availableModules = ref([])
  const availableUnits = ref([])
  const parameterData = ref([])
  const lastSaveName = ref('phlynx')
  const lastExportName = ref('phlynx')
  const workbenchModules = ref([])
  const connections = ref([])
  const units = ref(null)

  // --- ACTIONS ---

  /**
   * Called after you parse your module definition file.
   * @param {Array} modules - The array of module objects.
   */
  function setAvailableModules(modules) {
    availableModules.value = modules
  }

  /**
   * Sets the parameter data.
   * @param {*} data - The parameter data to set.
   */
  function setParameterData(data) {
    parameterData.value = data
  }

  function setLastSaveName(name) {
    lastSaveName.value = name
  }

  function setLastExportName(name) {
    lastExportName.value = name
  }

  function addOrUpdateFile(collection, payload) {
    const existingFile = collection.value.find(
      (f) => f.filename === payload.filename
    )

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
   *           { BC_type: "qv", vessel_type: "pulmonary", ... }
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

    //console.log('Adding configs from file:', configFilename)
    configs.forEach((config) => {
      let moduleFile = availableModules.value.find(
        (f) => f.filename === config.module_file 
      )

      //console.log(config)
      if (!moduleFile) {
        moduleFile = {
          filename: config.module_file,
          modules: [],
          isStub: true // marker to indicate this needs real content later
        }
        availableModules.value.push(moduleFile)
      }

      let module = moduleFile.modules.find(
        (m) => m.name === config.module_type || 
               m.type === config.module_type
      )

      if (!module) {
        module = {
          name: config.module_type,
          componentName: config.module_type,
          configs: []
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
        _loadedAt: new Date().toISOString()
      }

      if (existingConfigIndex !== -1) {
        module.configs[existingConfigIndex] = configWithMetadata
      } else {
        module.configs.push(configWithMetadata)
      }
    })
  }

  function addModuleFile(payload) {
    const existingFile = availableModules.value.find(
      (f) => f.filename === payload.filename
    )

    if (existingFile) {
        if (existingFile.isStub) {
            delete existingFile.isStub
        }

        if (existingFile.modules) {
            payload.modules.forEach(newMod => {
                const oldMod = existingFile.modules.find(m => m.name === newMod.name)
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
   * Removes all configs associated with a specific config file.
   */
  function removeConfigFile(configFilename) {
    availableModules.value.forEach((file) => {
      file.modules.forEach((module) => {
        if (module.configs) {
          module.configs = module.configs.filter(
            (config) => config._sourceFile !== configFilename
          )
        }
      })
    })
  }

  /**
   * Removes a module file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeModuleFile(filename) {
    removeFile(availableModules, filename)
  }

  /**
   * Removes a units file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeUnitsFile(filename) {
    removeFile(availableUnits, filename)
  }

  /**
   * Checks if a module file is already loaded.
   * @param {string} filename - The name of the file to check.
   * @returns {boolean} - True if the file is loaded, false otherwise.
   */
  function hasModuleFile(filename) {
    return this.availableModules.some((f) => f.filename === filename)
  }

  /**
   * Checks if a config exists for a specific module and BC type
   * @param {string} moduleType - The module type
   * @param {string} bcType - The BC type
   * @returns {boolean}
   */
  function hasConfig(moduleType, bcType) {
    return availableModules.value.some((file) =>
      file.modules.some((module) =>
        (module.name === moduleType || module.type === moduleType) &&
        module.configs?.some((config) => config.BC_type === bcType)
      )
    )
  }

  /**
   * Gets all configs for a specific module type
   * @param {string} moduleType - The module type
   * @returns {Array} Array of configs
   */
  function getConfigsForModule(moduleType) {
    const configs = []
    availableModules.value.forEach((file) => {
      file.modules.forEach((module) => {
        if ((module.name === moduleType || module.type === moduleType) && module.configs) {
          configs.push(...module.configs)
        }
      })
    })
    return configs
  }

  function getConfigForVessel(vesselType, bcType) {
    for (const file of availableModules.value) {
      for (const module of file.modules) {
        if (module.configs) {
          const config = module.configs.find(
            (c) => c.vessel_type === vesselType && c.BC_type === bcType
          )
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

  function hasConfigForVessel(vesselType, bcType) {
    return getConfigForVessel(vesselType, bcType) !== null
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

  /**
   * Called when a module is dropped onto the workbench.
   * @param {string} moduleName - The name of the module to add.
   * @param {object} position - { x, y } coordinates from the drop event.
   */
  function addModuleToWorkbench(moduleName, position) {
    // Find the base definition

    let foundModule = null
    for(const file of availableModules.value) {
        const match = file.modules?.find(mod => mod.name === moduleName || mod.componentName === moduleName)
        if(match) {
            foundModule = match
            break
        }
    }

    if (foundModule) {
      const newModuleInstance = {
        ...foundModule, 
        id: `instance_${Date.now()}`,
        x: position.x,
        y: position.y,
      }
      workbenchModules.value.push(newModuleInstance)
    }
  }

  /**
   * Called when a module is dragged *on* the workbench.
   * @param {string} moduleId - The unique ID of the module instance.
   * @param {object} position - The new { x, y } coordinates.
   */
  function moveModule(moduleId, position) {
    const module = workbenchModules.value.find((m) => m.id === moduleId)
    if (module) {
      module.x = position.x
      module.y = position.y
    }
  }

  // --- GETTERS (computed) ---
  // (We don't need any yet, but they would go here)

  return {
    // State
    availableModules,
    availableUnits,
    connections,
    lastExportName,
    lastSaveName,
    parameterData,
    units,
    workbenchModules,

    // Actions
    addModuleFile,
    addModuleToWorkbench,
    addUnitsFile,
    addConfigFile,
    hasModuleFile,
    hasConfig,
    hasConfigForVessel,
    getConfigsForModule,
    getConfig,
    getConfigForVessel,
    moveModule,
    removeModuleFile,
    removeUnitsFile,
    removeConfigFile,
    setAvailableModules,
    setLastExportName,
    setLastSaveName,
    setParameterData,
  }
})
