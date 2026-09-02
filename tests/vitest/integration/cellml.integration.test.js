import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { extractVoiAndParametersFromModel } from '../../../src/utils/cellml.js'
import { readFileAsText } from '../../../src/utils/misc.js'
import { cellmlParameterInfoFixture } from '../fixtures/cellml-parameter-info.js'
import { ensureLibCellmlReady } from '../helpers/libcellml-bootstrap.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const modelFixturePath = path.resolve(__dirname, '../../resources/model.cellml')

async function loadModelFixtureAsText() {
  const fixtureText = await readFile(modelFixturePath, 'utf8')
  const fixtureFile = new File([fixtureText], 'model.cellml', { type: 'application/xml' })
  return readFileAsText(fixtureFile)
}

describe('CellML integration', () => {
  beforeAll(async () => {
    await ensureLibCellmlReady()
  }, 120000)

  beforeEach(() => {
    vi.restoreAllMocks()
    // vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('extracts VOI using real libCellML initialized from plugin bootstrap', async () => {
    const modelString = await loadModelFixtureAsText()

    const result = extractVoiAndParametersFromModel(modelString, cellmlParameterInfoFixture)

    expect(result).toBeDefined()
    expect(result.voi).toEqual({
      name: 'time',
      componentName: 'environment',
      units: 'second',
    })
  })

  it('extracts selected parameters using real libCellML', async () => {
    const modelString = await loadModelFixtureAsText()

    const result = extractVoiAndParametersFromModel(modelString, cellmlParameterInfoFixture)

    expect(result.voi).toEqual({
      name: 'time',
      componentName: 'environment',
      units: 'second',
    })

    expect(result.mappedParameters).toBeDefined()
    expect(Object.keys(result.mappedParameters)).toHaveLength(3)
    expect(result.mappedParameters).toEqual({
      'axon_SN/C': { name: 'C', componentName: 'instance_parameters' },
      'soma_SN/Vol': { name: 'soma_SN_Vol', componentName: 'instance_parameters' },
      'var_SN/Vol': { name: 'var_SN_Vol', componentName: 'instance_parameters' },
    })
  })
})
