import { styleTags, tags as t } from "@lezer/highlight"

export const cellmlHighlight = styleTags({
  "def enddef var ode comp model as": t.keyword,
  
  "units": t.propertyName,

  "ComponentName": t.className,
  "VariableName": t.variableName,
  
  "MathFunction": t.function(t.string),
  "MathConstant": t.string,
  
  "UnitName": t.atom,      // Teal/cyan - visually distinct
  "UnitValue": t.atom,
  
  "AnnotationKey": t.propertyName,    // Muted, not as prominent
  "AnnotationValue": t.string,        // Subdued color for metadata values
  
  "Number": t.number,
  "Operator": t.operator,
  "( ) { }": t.paren,
  "=": t.definitionOperator,
  ": ; ,": t.punctuation
})