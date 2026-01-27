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
        <textarea
          v-model="cellmlText"
          class="code-view"
          @click="onCursorMove"
          @keyup="onCursorMove"
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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

const generator = new CellMLTextGenerator()
const parser = new CellMLTextParser()
const latexGen = new CellMLLatexGenerator()

const errors = ref([])
const latexContainer = ref(null)

let debouncer = null
let currentDoc = null
const cursorLine = ref(1)
const latexPreview = ref('')

const onCursorMove = (e) => {
  const textarea = e.target
  // Calculate line number from selectionStart.
  const textUpToCursor = textarea.value.substr(0, textarea.selectionStart)
  cursorLine.value = textUpToCursor.split('\n').length

  updatePreview()
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
.container {
  display: flex;
  height: 100%;
  gap: 20px;
  padding: 20px;
  font-family: sans-serif;
  box-sizing: border-box; 
}
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}
textarea,
.code-view {
  flex: 1;
  background: #f4f4f4;
  border: 1px solid #ccc;
  padding: 10px;
  font-family: monospace;
  font-size: 14px;
  white-space: pre;
  overflow: auto;
  outline: none;
  resize: none;
}
.code-view {
  background: #1e1e1e;
  color: #d4d4d4;
}
.preview-pane {
  height: 100px;
  background: white;
  border-bottom: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
}
.placeholder {
  color: #ccc;
  font-style: italic;
  font-size: 0.8em;
}
.error-banner {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px 15px;
  border-bottom: 2px solid #ef9a9a;
  font-family: monospace;
  font-size: 0.9em;
  min-height: 40px; /* Prevent jumpiness */
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
