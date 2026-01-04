import { defineStore } from "pinia"
import { ref, computed } from "vue"

// 'builder' is the store's ID
export const useBuilderStore = defineStore("builder", () => {
  // --- STATE ---

  // Holds the *definitions* loaded from your file
  const availableModules = ref([])
  const parameterData = ref([])
  const lastSaveName = ref('ca-model-builder')
  const lastExportName = ref('ca-model-builder')

  // Holds the *instances* of modules placed on the workbench
  // We'll add x/y coordinates and a unique ID
  const workbenchModules = ref([])

  // Holds the connections between module ports
  const connections = ref([])

  // (You'll also add your 'units' data here)
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
  // (We don't need any yet, but they would go here)

  return {
    // State
    availableModules,
    connections,
    lastExportName,
    lastSaveName,
    parameterData,
    units,
    workbenchModules,

    // Actions
    addModuleFile,
    addModuleToWorkbench,
    moveModule,
    removeModuleFile,
    setAvailableModules,
    setLastExportName,
    setLastSaveName,
    setParameterData,
  }
})
