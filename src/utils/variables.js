export function isEditableVariableType(variableType) {
  // A variable is editable if it has a defined value and is not marked as read-only
  return variableType !== 'variable' && variableType !== 'boundary_condition'
}

/**
 * Helper to check if a value is truly "empty"
 * Returns true for: null, undefined, ""
 * Returns false for: 0, "0", 10, "hello"
 */
export function isEmpty(val) {
  return val === undefined || val === null || val === ''
}
