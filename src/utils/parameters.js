import { extractVariablesFromModule } from './cellml'

/**
 * Analyzes overlaps between module variables and parameter files.
 * Returns an array of objects suitable for a UI Table/Dialog.
 * @param {Array} loadedModules - CellML modules.
 * @param {Map} parameterFiles - Filename to parameter map.
 */
export function generateParameterAssociations(loadedModules, parameterFiles) {
  const associations = []

  // Pre-calculate the sets of variable names for each parameter file.
  const paramFileSignatures = new Map()

  for (const [fileName, params] of parameterFiles.entries()) {
    // Create a Set of names for O(1) lookups.
    const variableSet = new Set(params.map((p) => p.variable_name))
    paramFileSignatures.set(fileName, variableSet)
  }

  // Iterate through every loaded CellML Module.
  for (const module of loadedModules) {
    const moduleSourceFile = module.filename

    // Extract all variable names from this CellML module.
    const moduleVariables = extractVariablesFromModule(module)

    let bestMatchFile = null
    let bestMatchScore = 0
    let bestMatchDetails = { total: 0, matched: 0 }

    // Compare against every parameter file.
    for (const [paramFileName, paramVarSet] of paramFileSignatures.entries()) {
      let matchCount = 0

      // Count intersections.
      moduleVariables.forEach((varName) => {
        if (paramVarSet.has(varName)) {
          matchCount++
        }
      })

      // Calculate a score (simple count, or percentage).
      if (matchCount > bestMatchScore) {
        bestMatchScore = matchCount
        bestMatchFile = paramFileName
        bestMatchDetails = {
          total: moduleVariables.size,
          matched: matchCount,
        }
      }
    }

    // Build the UI Data Object
    associations.push({
      moduleSource: moduleSourceFile,

      // The suggested selection (can be null if 0 matches found)
      matchedParameterFile: bestMatchScore > 0 ? bestMatchFile : null,
      bestMatchFile: bestMatchFile,

      // Metrics to show the user (e.g., "Matched 15/20 variables")
      matchStats: bestMatchDetails,

      // Flag for UI: if match is low, highlight as "Check this!"
      isAmbiguous: bestMatchScore < 5, // Arbitrary threshold
    })
  }

  return associations
}
