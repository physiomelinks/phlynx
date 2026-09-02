import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLibraryStore } from './libraryStore'
import { parseMathRef, parseModuleRef } from '../utils/config'

function formatDisplayLabel(fileName) {
  if (!fileName) return ''
  return fileName.replace(/\.cellml$/i, '').replace(/_/g, ' ')
}

export const useLibraryProxyStore = defineStore('libraryProxy', () => {
  const library = useLibraryStore()

  // Groups are now three levels deep:
  //   componentFile (file of origin)
  //     -> componentName (one card per type)
  //          -> Modules (the moduleSubtype siblings, switched via the card's internal selector)
  const groups = computed(() => {
    const byFile = new Map() // componentFile -> Map(componentName -> Modules[])

    for (const [mathRef, moduleRefs] of library.availableCollections) {
      const { componentFile, componentName } = parseMathRef(mathRef)

      let byComponent = byFile.get(componentFile)
      if (!byComponent) {
        byComponent = new Map()
        byFile.set(componentFile, byComponent)
      }

      for (const moduleRef of moduleRefs) {
        const module = library.availableModules.get(moduleRef)
        if (!module) continue

        const { moduleType, moduleSubtype } = parseModuleRef(moduleRef)

        let modules = byComponent.get(componentName)
        if (!modules) {
          modules = []
          byComponent.set(componentName, modules)
        }
        modules.push({ ...module, moduleSubtype })
      }
    }

    const result = []
    for (const [componentFile, byComponent] of byFile) {
      const cards = []
      for (const [componentName, modules] of byComponent) {
        cards.push({
          cardKey: `${componentFile}::${componentName}`,
          componentName,
          label: componentName,
          modules
        })
      }
      cards.sort((a, b) => a.label.localeCompare(b.label))

      result.push({
        componentFile,
        label: formatDisplayLabel(componentFile),
        cards
      })
    }
    result.sort((a, b) => a.label.localeCompare(b.label))

    return result
  })

  return { groups }
})
