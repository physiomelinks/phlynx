import { describe, expect, it, vi } from 'vitest'

import { useLoadFromUrl } from '../../../src/composables/useLoadFromUrl.js'

const state = vi.hoisted(() => ({
  readyPromise: Promise.resolve(),
  route: {
    hash: '#encoded-workspace',
    query: { open: 'workspace_json' },
  },
}))

vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal()),
  inject: () => state.readyPromise,
}))

vi.mock('vue-router', () => ({
  useRoute: () => state.route,
}))

describe('useLoadFromUrl', () => {
  it('waits for libcellml before dispatching the URL handler', async () => {
    let resolveReady
    state.readyPromise = new Promise((resolve) => {
      resolveReady = resolve
    })
    const handler = vi.fn()
    const { load, isLoading } = useLoadFromUrl()

    const loadPromise = load({ workspace_json: handler })

    expect(isLoading.value).toBe(true)
    expect(handler).not.toHaveBeenCalled()

    resolveReady()
    await loadPromise

    expect(handler).toHaveBeenCalledWith('encoded-workspace')
    expect(isLoading.value).toBe(false)
  })
})
