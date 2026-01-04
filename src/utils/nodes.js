export function generateUniqueModuleName(moduleData, existingNames) {
    let finalName = moduleData.name
    let counter = 1

    while (existingNames.has(finalName)) {
      finalName = `${moduleData.name}_${counter}`
      counter++
    }

    return finalName
  }
