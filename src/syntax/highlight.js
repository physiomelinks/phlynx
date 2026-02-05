import { styleTags, tags as t } from "@lezer/highlight"

export const cellmlHighlight = styleTags({
  "def enddef model var units as": t.keyword,
  "comp": t.keyword,
  "ode": t.keyword,
  
  "ComponentName": t.className,
  "VariableName": t.variableName,
  
  "MathFunction": t.function(t.keyword),
  "MathConstant": t.atom,
  
  "UnitName": t.typeName,
  "UnitValue": t.typeName,
  
  "AnnotationKey": t.attributeName,
  "AnnotationValue": t.atom,
  
  "Number": t.number,
  "Operator": t.operator,
  "( ) { }": t.paren,
  "=": t.definitionOperator,
  ": ; ,": t.punctuation
})