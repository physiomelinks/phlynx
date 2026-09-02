import { defineStore } from 'pinia'
import { ref } from 'vue'

import { DEFAULT_PROJECT_NAME } from '../utils/constants'

// 'SessionMetadata' is the store's ID
export const useSessionMetadataStore = defineStore('SessionMetadata', () => {
  // --- STATE ---
  const lastSaveName = ref(DEFAULT_PROJECT_NAME)

  // --- ACTIONS ---

  function resetState() {
    lastSaveName.value = DEFAULT_PROJECT_NAME
  }

  // --- SETTERS ---

  function setLastSaveName(name) {
    lastSaveName.value = name
  }

  function loadState(state) {

    resetState()

    lastSaveName.value = state.lastSaveName || DEFAULT_PROJECT_NAME
  }

  // ---- GETTERS ----

  function getState() {
    return {
      lastSaveName: lastSaveName.value,
    }
  }

  return {
    // State
    lastSaveName,

    // Actions
    resetState,

    // Setters
    loadState,
    setLastSaveName,

    // Getters
    getState,
  }
})
