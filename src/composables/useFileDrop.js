
import { hasRelevantExtension, collectEntry, } from "../utils/import"

export function useFileDrop() {
  async function filesFromDataTransfer(dataTransfer, { maxDepth = 2 } = {}) {
    const items = dataTransfer?.items
    const results = []

    const supportsEntries = items && items.length > 0 && typeof items[0]?.webkitGetAsEntry === 'function'

    if (supportsEntries) {
      const entries = Array.from(items)
        .map((item) => item.webkitGetAsEntry?.())
        .filter(Boolean)

      for (const entry of entries) {
        await collectEntry(entry, '', 0, maxDepth, results)
      }
      return results
    }

    const files = Array.from(dataTransfer?.files || [])
    for (const file of files) {
      if (hasRelevantExtension(file.name)) {
        results.push({ file, path: file.name })
      }
    }
    return results
  }

  return { filesFromDataTransfer }
}
