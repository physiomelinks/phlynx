import { defineStore } from 'pinia'
import { ref } from 'vue'

// 'builder' is the store's ID
export const useBuilderStore = defineStore('builder', () => {
  // --- STATE ---

  // Holds the *definitions* loaded from your file
  const availableModules = ref([])
  const availableUnits = ref([])
  const parameterData = ref([])
  const lastSaveName = ref('ca-model-builder')
  const lastExportName = ref('ca-model-builder')

  // Holds the *instances* of modules placed on the workbench
  // We'll add x/y coordinates and a unique ID
  const workbenchModules = ref([])

  // Holds the connections between module ports
  const connections = ref([])

  // --- DEBUG ---

  function listModules() {
    availableModules.value.forEach((e) => console.log(e.filename))
  }

  function listUnits() {
    availableUnits.value.forEach((e) => console.log(e.filename))
  }

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

  /**
   * Adds a new file and its modules to the list.
   * If the file already exists, it will be replaced.
   */
  function addModuleFile(payload) {
    // payload is { filename: 'moduleFileA.cellml', modules: [...] }
    const existingFile = this.availableModules.find(
      (f) => f.filename === payload.filename
    )

    if (existingFile) {
      // Replace existing file's modules
      existingFile.modules = payload.modules
    } else {
      // Add new file to the list
      this.availableModules.push(payload)
    }
  }

  /**
   * Removes a module file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeModuleFile(filename) {
    const index = this.availableModules.findIndex(
      (f) => f.filename === filename
    )

    if (index !== -1) {
      this.availableModules.splice(index, 1)
    }
  }

  function getModuleContent(filename) {
    const index = this.availableModules.findIndex(
      (f) => f.filename === filename
    )

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
    const existingFile = availableUnits.value.find(
      (f) => f.filename === payload.filename
    )
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  /**
   * Removes a units file and its modules from the list.
   * @param {string} filename - The name of the file to remove.
   */
  function removeUnitsFile(filename) {
    const index = this.availableUnits.findIndex((f) => f.filename === filename)

    if (index !== -1) {
      this.availableUnits.splice(index, 1)
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

  /**
   * Called when a module is dropped onto the workbench.
   * @param {string} moduleName - The name of the module to add.
   * @param {object} position - { x, y } coordinates from the drop event.
   */
  function addModuleToWorkbench(moduleName, position) {
    // Find the base definition
    const moduleDef = availableModules.value.find((m) => m.name === moduleName)

    if (moduleDef) {
      // Create a new *instance* for the workbench
      const newModuleInstance = {
        ...moduleDef, // Copy properties like name, ports
        id: `instance_${Date.now()}`, // Give it a unique ID
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

  return {
    // State
    availableModules,
    availableUnits,
    connections,
    lastExportName,
    lastSaveName,
    parameterData,
    workbenchModules,

    // Actions
    addModuleFile,
    addModuleToWorkbench,
    addUnitsFile,
    getModuleContent,
    hasModuleFile,
    moveModule,
    removeModuleFile,
    removeUnitsFile,
    setAvailableModules,
    setLastExportName,
    setLastSaveName,
    setParameterData,

    // Debug
    listModules,
    listUnits,
  }
})
