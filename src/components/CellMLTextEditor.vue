<template>
  <div class="container">
    <!-- Fixed LaTeX Preview/Error Banner at top -->
    <div class="fixed-preview">
      <div v-if="errors.length > 0" class="error-banner">
        <div v-for="(err, index) in errors" :key="index">
          <strong>Line {{ err.line }}:</strong> {{ err.message }}
        </div>
      </div>
      <div v-else class="preview-pane" ref="latexContainer"></div>
    </div>

    <!-- Editor Panel with top padding to account for fixed preview -->
    <div class="panel editor-panel">
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
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import { Codemirror } from 'vue-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, ViewPlugin, Decoration, DecorationSet } from '@codemirror/view'
import { indentUnit } from '@codemirror/language'
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

// Plugin to add hanging indent to wrapped lines
const hangingIndent = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view)
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view) {
    const decorations = []
    for (let { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const text = line.text
        
        // Count leading spaces/tabs
        let indent = 0
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ' ') indent++
          else if (text[i] === '\t') indent += 4
          else break
        }
        
        // Add decoration with padding for wrapped lines
        if (indent > 0) {
          const indentPx = indent * 0.6 // Approximate character width in 'ch' units
          decorations.push(
            Decoration.line({
              attributes: { style: `padding-left: ${indentPx}ch; text-indent: -${indentPx}ch;` }
            }).range(line.from)
          )
        }
        
        pos = line.to + 1
      }
    }
    return Decoration.set(decorations)
  }
}, {
  decorations: v => v.decorations
})

const extensions = [
  oneDark, 
  cellml(), 
  EditorView.lineWrapping,
  hangingIndent
]

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
      katex.render(latex, latexContainer.value, { 
        throwOnError: false, 
        displayMode: true,
        maxSize: 10 // Limit font size to prevent overflow (default is 10, can adjust lower)
      })
      
      // Check if content overflows width and scale down if needed
      nextTick(() => {
        const container = latexContainer.value
        const content = container.querySelector('.katex-html')
        
        if (content) {
          const containerWidth = container.clientWidth - 30 // width minus padding
          const contentWidth = content.scrollWidth
          
          // Calculate scale to fit width
          if (contentWidth > containerWidth) {
            const scale = containerWidth / contentWidth
            content.style.transform = `scale(${scale * 0.95})` // 95% for margin
            content.style.transformOrigin = 'center center'
          } else {
            content.style.transform = 'none'
          }
        }
      })
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
  flex-direction: column;
  height: 100%;
  padding: 20px;
  font-family: sans-serif;
  box-sizing: border-box;
  position: relative;
}

/* Fixed preview at the top */
.fixed-preview {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Panel structure for Editor */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Prevents panels from expanding beyond container */
}

.editor-panel {
  flex: 1;
  overflow: hidden;
}

:deep(.cm-editor) {
  flex: 1;
  border-radius: 4px;
  font-size: 14px;
  overflow: hidden; /* Ensure border-radius is applied to scrolling content */
}

:deep(.cm-scroller) {
  border-radius: 4px;
}

/* Preserve indentation spacing */
:deep(.cm-content) {
  tab-size: 4;
}

/* Formatting for the LaTeX Preview area */
.preview-pane {
  height: 120px;
  padding: 15px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  overflow: hidden;
}

.preview-pane :deep(.katex-display) {
  margin: 0;
}

.preview-pane :deep(.katex-html) {
  display: inline-block;
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
  border: 1px solid #ef9a9a;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
}
</style>