import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLoadFromCellML } from '../../../src/composables/useLoadFromCellml.js'
import { useLibraryStore } from '../../../src/stores/libraryStore.js'
import { ensureLibCellmlReady } from '../helpers/libcellml-bootstrap.js'

vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal()),
  useVueFlow: () => ({
    nodes: ref([]),
    edges: ref([]),
    addNodes: vi.fn(),
    onNodesInitialized: vi.fn(),
    fitView: vi.fn(),
    updateNode: vi.fn(),
    findNode: vi.fn(),
    setViewport: vi.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODEL = path.resolve(__dirname, '../../resources/model.cellml')

// The shape `parseCellMLConnections` returns, written out rather than produced:
// that parser leans on `querySelectorAll('map_variables')`, which the happy-dom
// this suite runs under does not match (an underscore in a tag name), so calling
// it here would yield an empty graph and prove nothing.
const payloadFor = (component) => ({
  components: [component],
  modules: [{ moduleRef: `${component}:sub`, mathRef: `model.cellml:${component}`, name: component }],
  edges: [],
  cellmlModuleSubtype: 'sub',
})

describe('useLoadFromCellML', () => {
  beforeAll(async () => {
    await ensureLibCellmlReady()
  }, 120000)

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('registers the math the graph it builds refers to', async () => {
    // A workspace built from connections alone -- an archive that brings no flow
    // snapshot -- used to reach the canvas with its math library empty. Every
    // node names a mathRef, so exporting failed on the first one with "Missing
    // math definition for '<file>:<component>'" and each module opened on an
    // empty string.
    const text = await readFile(MODEL, 'utf8')
    const { loadFromCellML } = useLoadFromCellML()

    await loadFromCellML(payloadFor('soma_SN'), 'model.cellml', null, text)

    expect(useLibraryStore().availableMath.get('model.cellml:soma_SN')).toBeTruthy()
  })

  it('leaves the library alone when the caller registered it already', async () => {
    // `loadCellMLFiles` calls loadCellMLData first and passes no text, so this
    // must not re-parse the model behind its back.
    const { loadFromCellML } = useLoadFromCellML()

    await loadFromCellML(payloadFor('soma_SN'), 'model.cellml')

    expect(useLibraryStore().availableMath.size).toBe(0)
  })
})
