<template>
  <div class="container">
    <div class="panel">
      <div v-if="errors.length > 0" class="error-banner">
        <div v-for="(err, index) in errors" :key="index">
          <strong>Line {{ err.line }}:</strong> {{ err.message }}
        </div>
      </div>
      <div v-else class="preview-pane" ref="latexContainer"></div>

      <div class="panel">
        <h3>CellML Text</h3>
        <codemirror
          v-model="cellmlText"
          :style="{ height: '400px' }"
          :autofocus="true"
          :indent-with-tab="true"
          :tab-size="4"
          :extensions="extensions"
          @update="handleStateUpdate">
        </codemirror>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import { Codemirror } from 'vue-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { 
  LanguageSupport,
  LRLanguage,
  indentNodeProp,
  foldNodeProp,
  foldInside,
} from '@codemirror/language'
import { parser as syntaxParser } from '../syntax/parser.js'
import { cellmlHighlight } from "../syntax/highlight.js"
import { CellMLTextGenerator } from 'cellml-text-editor'
import { CellMLTextParser } from 'cellml-text-editor'
import { CellMLLatexGenerator } from 'cellml-text-editor'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  regenerateOnChange: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const cellmlText = ref('')

const cellmlLanguage = LRLanguage.define({
  parser: syntaxParser.configure({
    props: [
      cellmlHighlight,
      indentNodeProp.add({
        "Definition Model": context => {
          const lineText = context.textAfter.trim();

          if (lineText.startsWith("enddef")) {
             return context.baseIndent; 
          }

          return context.baseIndent + context.unit;
        }
      }),
      foldNodeProp.add({
        "Definition": foldInside
      })
    ]
  }),
  languageData: {
    commentTokens: { line: "//" },
    indentOnInput: /^\s*enddef$/ // Helps with auto-indenting when typing 'enddef'
  }
})

function cellml() {
  return new LanguageSupport(cellmlLanguage)
}

const extensions = [oneDark, cellml()]

const generator = new CellMLTextGenerator()
const parser = new CellMLTextParser()
const latexGen = new CellMLLatexGenerator()

const errors = ref([])
const latexContainer = ref(null)

let debouncer = null
let currentDoc = null
const cursorLine = ref(1)
const latexPreview = ref('')

const handleStateUpdate = (viewUpdate) => {
  if (viewUpdate.selectionSet || viewUpdate.docChanged) {
    const state = viewUpdate.state
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)

    // Update cursorLine for your LaTeX preview logic
    cursorLine.value = line.number
    updatePreview()
  }
}

const updatePreview = () => {
  if (!currentDoc) return

  // Find the equation that matches this line
  // We look for elements with 'data-source-location' close to our cursor
  // (Simple implementation: Exact match or nearest previous match)
  const equations = Array.from(currentDoc.getElementsByTagNameNS('*', 'apply')) // get all apply nodes

  // Find the node with the highest line number that is <= cursorLine
  let bestMatch = null

  for (let i = 0; i < equations.length; i++) {
    const eq = equations[i]
    if (!eq) continue

    const loc = eq.getAttribute('data-source-location')
    if (!loc) continue

    // Parse the range.
    const [startStr, endStr] = loc.split('-')
    const start = parseInt(startStr || '0', 10)
    const end = endStr ? parseInt(endStr, 10) : start

    // If we've passed the cursor line, we can stop.
    if (start > cursorLine.value) {
      break
    }

    // Check if the cursor is inside the range.
    if (cursorLine.value >= start && cursorLine.value <= end) {
      bestMatch = eq
      break
    }
  }

  // Convert to LaTeX.
  if (bestMatch) {
    const latex = latexGen.convert(bestMatch)
    latexPreview.value = latex
    if (latexContainer.value) {
      katex.render(latex, latexContainer.value, { throwOnError: false, displayMode: true })
    }
  } else {
    latexPreview.value = ''
    if (latexContainer.value) latexContainer.value.innerHTML = "<span class='placeholder'>No equation selected</span>"
  }
}

watch(cellmlText, (newText) => {
  if (debouncer) clearTimeout(debouncer)
  debouncer = setTimeout(async () => {
    try {
      const parsed = parser.parse(newText)
      errors.value = parsed.errors
      if (errors.value.length === 0 && parsed.xml) {
        currentDoc = parser['doc']
        emit('update:modelValue', parsed.xml)
        await nextTick()
        updatePreview()
      }
    } catch (e) {
      // Do nothing for invalid syntax while typing.
    }
  }, 500)
})

watch(
  () => props.regenerateOnChange,
  (newValue) => {
    if (newValue) {
      const newText = generator.generate(props.modelValue)
      if (newText !== cellmlText.value) {
        cellmlText.value = newText
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* Main layout container */
.container {
  display: flex;
  height: 100%;
  gap: 20px;
  padding: 20px;
  font-family: sans-serif;
  box-sizing: border-box;
}

/* Panel structure for Preview and Editor */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Prevents panels from expanding beyond container */
}

:deep(.cm-editor) {
  flex: 1;
  border: 1px solid #333;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
  background-color: #282c34 !important; /* One Dark Background */
}

/* CodeMirror Specific Styles */
/* Use :deep to target the internal editor structure */
:deep(.cm-editor) {
  flex: 1;
  border: 1px solid #ccc;
  font-family: 'Fira Code', monospace; /* Or your preferred mono font */
  font-size: 14px;
  outline: none !important;
}

/* Ensure the content area fills the editor space */
:deep(.cm-scroller) {
  overflow: auto;
}

/* Formatting for the LaTeX Preview area */
.preview-pane {
  height: 100px;
  background: white;
  border-bottom: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  margin-bottom: 10px;
}

.placeholder {
  color: #ccc;
  font-style: italic;
  font-size: 0.8em;
}

/* Error banner styling */
.error-banner {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px 15px;
  border-bottom: 2px solid #ef9a9a;
  font-family: monospace;
  font-size: 0.9em;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-bottom: 10px;
}

/* Optional: Syntax highlighting color overrides if needed */
:deep(.cm-keyword) {
  font-weight: bold;
}
</style>
