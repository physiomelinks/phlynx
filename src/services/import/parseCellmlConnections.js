/**
 * parseCellMLConnections.js
 *
 * Parses a CellML 1.x/2.x file and extracts:
 *   - The set of component names (excluding 'environment' and other excluded components)
 *   - The connections between components as edges
 *   - Per-component port configs ready for builderStore.addConfigFile
 *
 * One port per unique canonical variable per component (deduplicated by port_type).
 * One edge per unique component pair.
 * Each edge carries its portType for unambiguous handle matching.
 *
 * port_type = canonicalVarName__ownerComponent (display label, unique per variable)
 * variables = [all local var names for this component in this connection]
 */

import { EXCLUDED_COMPONENTS, TIME_NAMES, TIME_UNITS } from '../../utils/constants'

function getOwnedVariables(compElement) {
  const owned = new Set()

  for (const mathEl of compElement.querySelectorAll('math')) {
    // Only consider direct children of <math> — top-level statements
    for (const apply of mathEl.children) {
      if (apply.tagName !== 'apply') continue
      const children = Array.from(apply.children)
      if (children[0]?.tagName !== 'eq') continue

      const lhs = children[1]
      if (lhs?.tagName === 'ci') {
        owned.add(lhs.textContent.trim())
      } else if (lhs?.tagName === 'apply') {
        // ODE: <apply><diff/>...</apply>
        const diffCi = lhs.querySelector('ci')
        if (diffCi) owned.add(diffCi.textContent.trim())
      }
    }
  }

  // Initial values — constants defined in this component
  for (const variable of compElement.querySelectorAll('variable')) {
    if (variable.getAttribute('initial_value') !== null) {
      const varName = variable.getAttribute('name')
      if (varName) owned.add(varName)
    }
  }

  return owned
}

/**
 * Parse the raw CellML XML string and return structured graph data.
 *
 * @param {string} cellmlContent - Raw XML string
 * @param {string} filename - The filename (used as module_file in configs)
 * @returns {{
 *   components: string[],
 *   edges: Array<{ source: string, target: string }>,
 *   configs: Array<object>
 * }}
 */
export function parseCellMLConnections(cellmlContent, filename) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(cellmlContent, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Failed to parse CellML XML: ${parseError.textContent}`)
  }

  // --- 1. Detect time variable names from the environment component ---
  const excludedVarNames = new Set()
  for (const comp of doc.querySelectorAll('component')) {
    if (comp.getAttribute('name') === 'environment' || comp.getAttribute('name') === 'Environment') {
      for (const variable of comp.querySelectorAll('variable')) {
        const varName = variable.getAttribute('name')
        const varUnits = variable.getAttribute('units') ?? ''
        if (varName && (TIME_NAMES.has(varName) || TIME_UNITS.has(varUnits))) {
          excludedVarNames.add(varName)
        }
      }
      break
    }
  }

  // --- 2. Build component info and owned-variable sets ---
  const componentVariableInfo = new Map()
  const componentOwnedVars = new Map()

  for (const comp of doc.querySelectorAll('component')) {
    const compName = comp.getAttribute('name')
    if (!compName) continue

    const varMap = new Map()
    for (const variable of comp.querySelectorAll('variable')) {
      const varName = variable.getAttribute('name')
      if (!varName) continue
      varMap.set(varName, {
        units: variable.getAttribute('units') ?? 'dimensionless',
      })
    }
    componentVariableInfo.set(compName, varMap)
    componentOwnedVars.set(compName, getOwnedVariables(comp))
  }

  // --- 3. Parse all <connection> blocks ---
  //
  // For CellML 1.x: <connection><map_components .../><map_variables .../></connection>
  // For CellML 2.x: <connection component_1="..." component_2="..."><map_variables .../></connection>
  //
  // We accumulate:
  //   edgeSet:    unique component pairs
  //   portLabels: compName -> Set<canonicalLabel>  (deduplicated per variable)

  // portLabels: compName -> Set of canonical port label strings
  const pairInfoMap = new Map()
  const edgeSet = new Map()

  for (const connection of doc.querySelectorAll('connection')) {
    // Support both CellML 1.x (map_components child) and 2.x (attributes on connection)
    let comp1, comp2
    const mapComponents = connection.querySelector('map_components')
    if (mapComponents) {
      comp1 = mapComponents.getAttribute('component_1')
      comp2 = mapComponents.getAttribute('component_2')
    } else {
      comp1 = connection.getAttribute('component_1')
      comp2 = connection.getAttribute('component_2')
    }

    if (!comp1 || !comp2) continue
    if (EXCLUDED_COMPONENTS.has(comp1) || EXCLUDED_COMPONENTS.has(comp2)) continue

    const pairKey = [comp1, comp2].sort().join('|||')

    const validMappings = []
    for (const mapVar of connection.querySelectorAll('map_variables')) {
      const var1 = mapVar.getAttribute('variable_1')
      const var2 = mapVar.getAttribute('variable_2')
      if (!var1 || !var2) continue
      if (excludedVarNames.has(var1) || excludedVarNames.has(var2)) continue
      validMappings.push({ var1, var2 })
    }

    if (validMappings.length === 0) continue

    if (!pairInfoMap.has(pairKey)) {
      let chosen = validMappings.find(({ var1, var2 }) => {
        const o1 = componentOwnedVars.get(comp1)?.has(var1)
        const o2 = componentOwnedVars.get(comp2)?.has(var2)
        return (o1 && !o2) || (o2 && !o1)
      }) ?? validMappings[0]

      const { var1, var2 } = chosen
      const owned1 = componentOwnedVars.get(comp1)?.has(var1)
      const owned2 = componentOwnedVars.get(comp2)?.has(var2)

      let canonicalLabel, ownerComp
      if (owned1 && !owned2) {
        canonicalLabel = var1
        ownerComp = comp1
      } else if (owned2 && !owned1) {
        canonicalLabel = var2
        ownerComp = comp2
      } else {
        // Both defined, neither defined, or ambiguous — alphabetically first
        canonicalLabel = [var1, var2].sort()[0]
        ownerComp = canonicalLabel === var1 ? comp1 : comp2
      }

      pairInfoMap.set(pairKey, { canonicalLabel, ownerComp, comp1, comp2, mappings: validMappings })
      edgeSet.set(pairKey, { source: comp1, target: comp2 })
    }
  }

  // --- 4. Build edges ---
  const edges = [...edgeSet.keys()].map((pairKey) => {
    const { source, target } = edgeSet.get(pairKey)
     return { source, target }
  })

  // --- 5. Build component list ---
  const components = [...componentVariableInfo.keys()].filter(
    (name) =>
      !EXCLUDED_COMPONENTS.has(name) &&
      edges.some(({ source, target }) => source === name || target === name)
  )

  // --- 6. Build configs ---
  // Deduplicated by port_type — one port per unique canonical variable per component
  // variables = all local var names for this component in this connection
  const configs = components.map((compName) => {
    const general_ports = edges
      .filter(({ source, target }) => source === compName || target === compName)
      .reduce((acc, { source, target }) => {
        const pairKey = [source, target].sort().join('|||')
        const info = pairInfoMap.get(pairKey)
        if (!info) return acc

        for (const { var1, var2 } of info.mappings) {
          const owned1 = componentOwnedVars.get(info.comp1)?.has(var1)
          const owned2 = componentOwnedVars.get(info.comp2)?.has(var2)

          let canonicalLabel, ownerComp
          if (owned1 && !owned2) {
            canonicalLabel = var1
            ownerComp = info.comp1
          } else if (owned2 && !owned1) {
            canonicalLabel = var2
            ownerComp = info.comp2
          } else {
            canonicalLabel = [var1, var2].sort()[0]
            ownerComp = canonicalLabel === var1 ? info.comp1 : info.comp2
          }

          const portLabel = `${canonicalLabel}__${ownerComp}`
          const localVar = info.comp1 === compName ? var1 : var2

          if (!acc.some((p) => p.port_type === portLabel)) {
            acc.push({
              port_type: portLabel,
              variables: [localVar],
            })
          }
        }

        return acc
      }, [])

    const variables_and_units = []
    for (const [varName, { units }] of componentVariableInfo.get(compName)) {
      variables_and_units.push([varName, units, 'access', 'variable'])
    }

    return {
      module_file: filename,
      module_type: compName,
      vessel_type: compName,
      BC_type: 'nn',
      entrance_ports: [],
      exit_ports: [],
      general_ports,
      variables_and_units,
    }
  })

  return { components, edges, configs }
}