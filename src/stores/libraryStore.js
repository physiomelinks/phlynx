import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { normaliseConfig } from '../utils/config'
import { GHOST_MATH_REF } from '../utils/constants'
import { cyrb53 } from '../utils/misc'

function mergeIntoStore(newModules, target) {
  const moduleMap = new Map(target.map((mod) => [mod.componentFile, mod]))

  if (newModules) {
    for (const newModule of newModules) {
      if (newModule && newModule.componentFile) {
        // Safety check
        moduleMap.set(newModule.componentFile, newModule)
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

// 'library' is the store's ID
export const useLibraryStore = defineStore('library', () => {
  // --- STATE ---
  const availableCollections = ref(new Map())
  const availableModules = ref(new Map())
  const availableMath = ref(new Map())
  const mathHashIndex = ref(new Map())
  const mathRefHash = ref(new Map())
  const availableUnits = ref([])
  const globalConstants = ref(new Map())

  // --- ACTIONS ---
  function resetGlobalConstants() {
    globalConstants.value.clear()
  }

  function assignGlobalConstant(variableName, value, units, data_reference, overwrite = false) {
    if (globalConstants.value.has(variableName) && overwrite === false) return
    globalConstants.value.set(variableName, { value, units, data_reference })
  }

  function getGlobalConstant(variableName) {
    return globalConstants.value.get(variableName)
  }

  function removeGlobalConstant(variableName) {
    globalConstants.value.delete(variableName)
  }

  function cleanupUnusedGlobalConstants(activeNodes) {
    if (globalConstants.value.size === 0) return []

    const activeVariableNames = new Set()
    activeNodes.forEach((node) => {
      node.data?.variables?.forEach((variable) => {
        if (variable.name) {
          activeVariableNames.add(variable.name.trim())
        }
      })
    })

    const removedConstants = []
    for (const [key, value] of globalConstants.value.entries()) {
      if (!activeVariableNames.has(key)) {
        removedConstants.push({ name: key, ...value })
        globalConstants.value.delete(key)
      }
    }

    return removedConstants
  }

  function resetState() {
    resetGlobalConstants()
    availableMath.value.clear()
    mathHashIndex.value.clear()
    mathRefHash.value.clear()
    availableCollections.value.clear()
    availableModules.value.clear()
    availableUnits.value = []
  }

  function createMathHash(math) {
    const value = typeof math === 'string' ? math : JSON.stringify(math ?? '')
    return `math_${cyrb53(value).toString(36)}`
  }

  function removeMathHashEntry(mathRef, hash) {
    if (!hash || !mathHashIndex.value.has(hash)) return

    const refs = mathHashIndex.value.get(hash)
    refs.delete(mathRef)
    if (refs.size === 0) {
      mathHashIndex.value.delete(hash)
    }
  }

  function addMathHashEntry(mathRef, math) {
    if (typeof math !== 'string') return

    const previousHash = mathRefHash.value.get(mathRef)
    if (previousHash) {
      removeMathHashEntry(mathRef, previousHash)
    }

    const hash = createMathHash(math)
    if (!mathHashIndex.value.has(hash)) {
      mathHashIndex.value.set(hash, new Set())
    }
    mathHashIndex.value.get(hash).add(mathRef)
    mathRefHash.value.set(mathRef, hash)
  }

  function getMathRefsByHash(hash) {
    const refs = mathHashIndex.value.get(hash)
    return refs ? Array.from(refs) : []
  }

  function findMathRefByMath(math) {
    if (typeof math !== 'string') return null

    const hash = createMathHash(math)
    const candidateRefs = getMathRefsByHash(hash)
    return candidateRefs.find((mathRef) => availableMath.value.get(mathRef) === math) ?? null
  }

  function getMathHashByRef(mathRef) {
    return mathRefHash.value.get(mathRef) ?? null
  }

  // --- SETTERS ---

  function addConfigFile(filename, configs) {
    let totalAdded = 0

    if (!configs || !Array.isArray(configs)) {
      return totalAdded
    }

    configs.forEach((config) => {
      if (!config.component_file || typeof config.component_file !== 'string') {
        return totalAdded
      }

      const module = normaliseConfig(config)
      addModule(module)
      totalAdded++
    })
    return totalAdded
  }

  function addModule(module) {
    if (!availableMath.value.has(module.mathRef) && module.mathRef !== GHOST_MATH_REF) {
      module.isStub = true
    }

    if (!availableModules.value.has(module.moduleRef)) {
      availableModules.value.set(module.moduleRef, module)
    }

    // SMELL - still only really using cellml file origin, but now extensible if we include other metadata
    updateCollections(module.mathRef, module.moduleRef)
  }

  function ensureSet(key) {
    if (!availableCollections.value.has(key)) {
      availableCollections.value.set(key, new Set())
    }
    return availableCollections.value.get(key)
  }

  function updateCollections(tag, moduleRef) {
    ensureSet(tag).add(moduleRef)
  }

  function addMathFile(filename, components) {
    components.forEach((component) => {
      const mathRef = `${filename}:${component.name}`
      addMath(mathRef, component.math)
    })
  }

  function addMath(mathRef, math, isOverwrite = true) {
    if (!availableMath.value.has(mathRef) || isOverwrite) {
      availableMath.value.set(mathRef, math)
      addMathHashEntry(mathRef, math)
      updateStubStatus(mathRef)
    }
  }

  // Move one moduleRef from one mathRef's Set to another
  function moveModule(moduleRef, fromMathRef, toMathRef) {
    const fromSet = availableCollections.value.get(fromMathRef)
    if (!fromSet?.has(moduleRef)) return

    fromSet.delete(moduleRef)
    if (fromSet.size === 0) availableCollections.value.delete(fromMathRef)

    ensureSet(toMathRef).add(moduleRef)
  }

  // Replace a mathRef key, carrying its entire Set over
  function updateMathRef(oldMathRef, newMathRef) {
    if (!availableCollections.value.has(oldMathRef)) return

    const existingSet = availableCollections.value.get(oldMathRef)
    existingSet.forEach((moduleRef) => {
      availableModules.value.get(moduleRef).mathRef = newMathRef
    })
    availableCollections.value.delete(oldMathRef)
    availableCollections.value.set(newMathRef, existingSet)
  }

  function removeModule(moduleRef) {
    if (!availableModules.value.has(moduleRef)) return

    const mathRef = availableModules.value.get(moduleRef).mathRef
    const set = availableCollections.value.get(mathRef)
    if (!set) return

    set.delete(moduleRef)
    if (set.size === 0) availableCollections.value.delete(mathRef)

    availableModules.value.delete(moduleRef)
  }

  function updateStubStatus(mathRef) {
    if (!availableMath.value.has(mathRef)) return

    availableCollections.value.get(mathRef)?.forEach((moduleRef) => {
      const module = availableModules.value.get(moduleRef)
      if (module && module.isStub) {
        delete module.isStub
      }
    })
  }

  function loadState(state) {
    resetState()

    if (state.availableCollections) {
      const collections = Array.isArray(state.availableCollections)
        ? state.availableCollections
        : Object.entries(state.availableCollections)

      collections.forEach(([mathRef, modules]) => {
        const iterableModules = Array.isArray(modules) ? modules : []
        availableCollections.value.set(mathRef, new Set(iterableModules))
      })
    }

    if (state.availableMath) {
      mergeIn(new Map(state.availableMath), availableMath.value)
      for (const [mathRef, math] of availableMath.value.entries()) {
        addMathHashEntry(mathRef, math)
      }
    }

    if (state.availableModules) {
      mergeIn(new Map(state.availableModules), availableModules.value)
    }

    if (state.availableUnits) {
      mergeIntoStore(state.availableUnits, availableUnits.value)
    }

    if (state.globalConstants) {
      mergeIn(new Map(state.globalConstants), globalConstants.value)
    }
  }

  function removeCollection(componentFile) {
    delete availableCollections.value.get(componentFile)
  }

  function addUnitsFile(payload) {
    const existingFile = availableUnits.value.find((f) => f.componentFile === payload.componentFile) // SMELL - units files also called component files
    if (existingFile) {
      existingFile.model = payload.model
    } else {
      availableUnits.value.push(payload)
    }
  }

  // ---- GETTERS ----

  function getState() {
    return {
      availableCollections: Array.from(availableCollections.value.entries()).map(([key, set]) => [
        key,
        Array.from(set),
      ]),
      availableMath: Array.from(availableMath.value.entries()),
      availableModules: Array.from(availableModules.value.entries()),
      availableUnits: availableUnits.value,
      globalConstants: Array.from(globalConstants.value.entries()),
    }
  }

  const globalVariables = computed(() => globalConstants.value)

  return {
    // State
    availableCollections,
    availableMath,
    mathHashIndex,
    availableModules,
    availableUnits,

    // Derived State 
    globalVariables,

    // Actions
    addConfigFile,
    addModule,
    addMathFile,
    addMath,
    addUnitsFile,
    assignGlobalConstant,
    createMathHash,
    resetGlobalConstants,
    loadState,
    removeModule,
    removeCollection,
    removeGlobalConstant,
    cleanupUnusedGlobalConstants,
    findMathRefByMath,
    getMathHashByRef,
    getMathRefsByHash,

    // Query
    getGlobalConstant,
    getState,
  }
})
