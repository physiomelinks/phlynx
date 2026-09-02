import path from 'node:path'

import createLibCellML from 'libcellml.js'
import { createApp, reactive } from 'vue'

import { initLibCellML } from '../../../src/utils/cellml.js'

let bootstrapPromise = null
const wasmPath = path.resolve(process.cwd(), 'node_modules/libcellml.js/libcellml.wasm')

/**
 * Bootstraps libCellML in tests using the same plugin mechanism as main.js.
 * The resolved instance is cached so suites can share one initialization.
 */
export function ensureLibCellmlReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const app = createApp({
        template: '<div />',
      })

      // Mirror the app bootstrap contract by providing these two injected keys.
      const libcellmlState = reactive({
        status: 'loading',
        library: null,
      })
      const readyPromise = createLibCellML({
        locateFile(file, prefix) {
          if (file.endsWith('.wasm')) {
            return wasmPath
          }
          return `${prefix}${file}`
        },
      })

      app.provide('$libcellml', libcellmlState)
      app.provide('$libcellml_ready', readyPromise)

      const instance = await readyPromise
      libcellmlState.status = 'ready'
      libcellmlState.library = instance
      initLibCellML(instance)

      return {
        app,
        instance,
        libcellmlState,
      }
    })()
  }

  return bootstrapPromise
}
