import { base64ToUtf8, base64ToBlob } from './compress'

export function createUrlLoaders({ applyWorkspaceState, importOmexFile, processImportedOmexArchive }) {
  return {
    workspace_json: async (base64) => {
      const json = JSON.parse(await base64ToUtf8(base64))
      await applyWorkspaceState(json, { source: 'url' })
    },

    omex: async (base64) => {
      const zipBlob = await base64ToBlob(base64, 'application/zip')
      const result = await importOmexFile(zipBlob)
      await processImportedOmexArchive(zipBlob, result, 'url_imported.omex')
    },
  }
}
