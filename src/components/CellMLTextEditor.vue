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
          :tab-size="2"
          :extensions="extensions"
          @update="handleStateUpdate"
        >
        </codemirror>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import { CellMLTextGenerator } from 'cellml-text-editor'
import { CellMLTextParser } from 'cellml-text-editor'
import { CellMLLatexGenerator } from 'cellml-text-editor'
import { cellml } from 'cellml-text-editor'

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

const emit = defineEmits(['update:modelValue', 'save'])

const cellmlText = ref('')

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

const shiftSpaceKeymap = keymap.of([
  {
    key: 'Shift-Space',
    run: (view) => {
      view.dispatch(view.state.replaceSelection(' '))
    },
  },
])

const extensions = [basicSetup, cellml(), shiftSpaceKeymap]

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

const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    handleSave()
  }
}

const handleSave = () => {
  emit('save')
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

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Panel structure for Editor */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* Prevents panels from expanding beyond container */
}

.editor-panel {
  flex: 1;
  overflow: hidden;
}

:deep(.cm-editor) {
  flex: 1;
  border-radius: 4px;
  font-size: 14px;
  overflow: hidden;
  /* Ensure border-radius is applied to scrolling content */
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

:deep(.cm-scroller) {
  border-radius: 4px;
}

/* Preserve indentation spacing */
:deep(.cm-content) {
  tab-size: 4;
}

.cm-line {
  white-space: pre-wrap !important;
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
