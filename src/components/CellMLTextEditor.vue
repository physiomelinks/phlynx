<template>
  <div class="container" ref="rootRef">
    <div class="panel">
      <div v-if="errors.length > 0" class="error-banner">
        <div v-for="(err, index) in errors" :key="index">
          <strong>Line {{ err.line }}:</strong> {{ err.message }}
        </div>
      </div>
      <div v-else class="preview-pane" ref="latexContainer"></div>

      <div class="panel">
        <div class="panel-header">
          <h3>CellML Text</h3>
          <div class="font-size-control" role="group" aria-label="Editor font size">
            <button
              type="button"
              class="font-size-btn"
              :disabled="fontSize <= MIN_FONT_SIZE"
              title="Decrease font size"
              aria-label="Decrease font size"
              @click="decreaseFontSize"
            >
              <i class="pi pi-minus" style="font-size: 0.7rem"></i>
            </button>
            <span class="font-size-value">{{ fontSize }}px</span>
            <button
              type="button"
              class="font-size-btn"
              :disabled="fontSize >= MAX_FONT_SIZE"
              title="Increase font size"
              aria-label="Increase font size"
              @click="increaseFontSize"
            >
              <i class="pi pi-plus" style="font-size: 0.7rem"></i>
            </button>
          </div>
        </div>
        <codemirror
          v-model="cellmlText"
          :style="{ height: '400px', '--cm-font-size': fontSize + 'px' }"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark' 
import 'katex/dist/katex.min.css'

import { CellMLTextGenerator } from 'cellml-text-editor'
import { CellMLTextParser } from 'cellml-text-editor'
import { CellMLLatexGenerator } from 'cellml-text-editor'
import { cellml } from 'cellml-text-editor'

const katexPromise = import('katex')

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:code', 'save', 'ready', 'undo', 'redo'])

// When true, the next `cellmlText` change came from setText() (an app-level
// undo/redo replay), not a user keystroke
let applyingExternalText = false

const generator = new CellMLTextGenerator()
const parser = new CellMLTextParser()
const latexGen = new CellMLLatexGenerator()

const cellmlText = ref(generator.generate(props.modelValue))
const errors = ref([])
const latexContainer = ref(null)
const rootRef = ref(null)

let debouncer = null
let currentDoc = null
let resizeObserver = null
let resizeRaf = null
const cursorLine = ref(1)
const latexPreview = ref('')

const MIN_FIT_SCALE = 0.50
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 20
const FONT_SIZE_STORAGE_KEY = 'cellml-editor-font-size'
const DEFAULT_FONT_SIZE = 12.5

function loadStoredFontSize() {
  try {
    const stored = Number(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY))
    if (stored && stored >= MIN_FONT_SIZE && stored <= MAX_FONT_SIZE) {
      return stored
    }
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return DEFAULT_FONT_SIZE
}

const fontSize = ref(loadStoredFontSize())

function persistFontSize() {
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize.value))
  } catch (e) {
    // ignore storage errors
  }
}

function increaseFontSize() {
  fontSize.value = Math.min(MAX_FONT_SIZE, fontSize.value + 1)
  persistFontSize()
}

function decreaseFontSize() {
  fontSize.value = Math.max(MIN_FONT_SIZE, fontSize.value - 1)
  persistFontSize()
}

// ── Dynamic Dark Mode Detection ─────────────────────────────────────────────
const isDarkMode = ref(false)
let observer = null

const checkDarkMode = () => {
  isDarkMode.value = document.documentElement.classList.contains('p-dark')
}

let cmView = null

const handleStateUpdate = (viewUpdate) => {
  cmView = viewUpdate.view

  if (viewUpdate.selectionSet || viewUpdate.docChanged) {
    const state = viewUpdate.state
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)

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

// Intercept undo/redo ahead of basicSetup's own historyKeymap (Mod-z / Mod-Shift-z / Mod-y)
const appHistoryKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-z',
      run: () => {
        emit('undo')
        return true
      },
    },
    {
      key: 'Mod-Shift-z',
      run: () => {
        emit('redo')
        return true
      },
    },
    {
      key: 'Mod-y',
      run: () => {
        emit('redo')
        return true
      },
    },
  ])
)

// Dynamically inject theme extensions based on light vs. dark mode
const extensions = computed(() => {
  const base = [basicSetup, cellml(), shiftSpaceKeymap, appHistoryKeymap]
  return isDarkMode.value ? [...base, oneDark] : base
})

const applyFitScale = () => {
  const container = latexContainer.value
  if (!container) return

  const content = container.querySelector('.katex-html')
  if (!content) return

  const containerWidth = container.clientWidth - 30
  const containerHeight = container.clientHeight - 10
  if (containerWidth <= 0 || containerHeight <=0) return

  const contentWidth = content.scrollWidth
  const contentHeight = content.scrollHeight

  if (contentHeight > containerHeight || contentWidth > containerWidth) {
    const rawScale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight)
    const scale = Math.max(rawScale * 0.95, MIN_FIT_SCALE)
    content.style.transform = `scale(${scale})`
    content.style.transformOrigin = 'center center'
  } else {
    content.style.transform = 'none'
  }
}

const scheduleFitScale = () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(applyFitScale)
}

const updatePreview = async () => {
  if (!currentDoc) return

  const katex = (await katexPromise).default
  const equations = Array.from(currentDoc.getElementsByTagNameNS('*', 'apply'))

  let bestMatch = null

  for (let i = 0; i < equations.length; i++) {
    const eq = equations[i]
    if (!eq) continue

    const loc = eq.getAttribute('data-source-location')
    if (!loc) continue

    const [startStr, endStr] = loc.split('-')
    const start = parseInt(startStr || '0', 10)
    const end = endStr ? parseInt(endStr, 10) : start

    if (start > cursorLine.value) break

    if (cursorLine.value >= start && cursorLine.value <= end) {
      bestMatch = eq
      break
    }
  }

  if (bestMatch) {
    const latex = latexGen.convert(bestMatch)
    latexPreview.value = latex
    if (latexContainer.value) {
      katex.render(latex, latexContainer.value, { throwOnError: false, displayMode: true })
      nextTick(applyFitScale)
    }
  } else {
    latexPreview.value = ''
    if (latexContainer.value) latexContainer.value.innerHTML = "<span class='placeholder'>No equation selected</span>"
  }
}

const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSave()
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
  }
}

const handleSave = () => {
  emit('save')
}

watch(cellmlText, (newText) => {
  if (applyingExternalText) return

  if (debouncer) clearTimeout(debouncer)
  debouncer = setTimeout(async () => {
    try {
      const parsed = parser.parse(newText)
      errors.value = parsed.errors
      const valid = errors.value.length === 0 && !!parsed.xml

      if (valid) {
        currentDoc = parser['doc']
      }

      emit('update:code', valid ? parsed.xml : null, newText, valid)

      if (valid) {
        await nextTick()
        updatePreview()
      }
    } catch (e) {
      // Parse threw outright - still emit so undo has a text snapshot.
      emit('update:code', null, newText, false)
    }
  }, 500)
})

async function setText(newText) {
  if (debouncer) {
    clearTimeout(debouncer)
    debouncer = null
  }

  applyingExternalText = true

  const oldText = cellmlText.value

  if (cmView && oldText !== newText) {
    const maxPrefix = Math.min(oldText.length, newText.length)
    let prefixLen = 0
    while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
      prefixLen++
    }

    const maxSuffix = Math.min(oldText.length, newText.length) - prefixLen
    let suffixLen = 0
    while (
      suffixLen < maxSuffix &&
      oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
    ) {
      suffixLen++
    }

    const from = prefixLen
    const to = oldText.length - suffixLen
    const insert = newText.slice(prefixLen, newText.length - suffixLen)

    cmView.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    })
  } else {
    // No view yet (shouldn't normally happen) - fall back to a full replace.
    cellmlText.value = newText
  }

  await nextTick()
  applyingExternalText = false

  try {
    const parsed = parser.parse(newText)
    errors.value = parsed.errors
    if (errors.value.length === 0 && parsed.xml) {
      currentDoc = parser['doc']
      await nextTick()
      updatePreview()
    }
  } catch (e) {
    // Do nothing for invalid syntax.
  }
}

defineExpose({ setText })

onMounted(() => {
  checkDarkMode()
  observer = new MutationObserver(checkDarkMode)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  try {
    const parsed = parser.parse(cellmlText.value)
    errors.value = parsed.errors
    if (errors.value.length === 0 && parsed.xml) {
      currentDoc = parser['doc']
      updatePreview()
      emit('ready', parsed.xml, cellmlText.value)
    }
  } catch (e) {
    // Do nothing for initial syntax load
  }

  window.addEventListener('keydown', handleKeyDown)
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleFitScale)
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* Main layout container */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  font-family: sans-serif;
  box-sizing: border-box;
  position: relative;
  background-color: var(--p-content-background, transparent);
  color: var(--p-text-color);
}

/* Panel structure for Editor */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
  --eq-preview-height: clamp(170px, 24vh, 280px);
}

.panel h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 2px;
}

.font-size-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--p-text-muted-color);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.font-size-btn:hover:not(:disabled) {
  background: var(--p-content-hover-background, rgba(255, 255, 255, 0.06));
  color: var(--p-text-color);
}

.font-size-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.font-size-value {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  min-width: 2.6em;
  text-align: center;
  user-select: none;
}

/* CodeMirror Base Styling */
:deep(.cm-editor) {
  flex: 1;
  border-radius: 6px;
  font-size: var(--cm-font-size, 11.5px);
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background-color: var(--p-content-background);
  color: var(--p-text-color);
  outline:none;
  border: 1px solid var(--p-content-border-color);
}

:deep(.cm-scroller) {
  border-radius: 6px;
}

/* CodeMirror Gutters */
:deep(.cm-gutters) {
  background-color: color-mix(in srgb, var(--p-content-background) 92%, var(--p-text-color));
  color: var(--p-text-muted-color);
  border-right: 1px solid var(--p-content-border-color);
}

:deep(.cm-activeLine) {
  background-color: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
}

:deep(.cm-activeLineGutter) {
  background-color: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  color: var(--p-text-color);
}

:deep(.cm-cursor) {
  border-left-color: var(--p-text-color);
}

:deep(.cm-content) {
  tab-size: 4;
}

.cm-line {
  white-space: pre-wrap !important;
}

/* LaTeX Preview Area - Adapts to Dark Mode */
.preview-pane {
  height: var(--eq-preview-height);
  padding: 15px;
  background-color: color-mix(in srgb, var(--p-content-background) 96%, var(--p-text-color));
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4em;
  overflow: auto;
  color: var(--p-text-color);
  scrollbar-width: thin;
}

.preview-pane::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.preview-pane::-webkit-scrollbar-thumb {
  background-color: var(--p-content-border-color);
  border-radius: 4px;
}

.preview-pane::-webkit-scrollbar-track {
  background: transparent;
}

.preview-pane :deep(.katex) {
  color: var(--p-text-color) !important;
}

.preview-pane :deep(.katex-display) {
  margin: 0;
}

.preview-pane :deep(.katex-html) {
  display: inline-block;
}

.placeholder {
  color: var(--p-text-muted-color);
  font-style: italic;
  font-size: 0.85em;
}

/* Error Banner styling for Light/Dark Mode */
.error-banner {
  background-color: color-mix(in srgb, var(--p-red-500, #ef4444) 15%, var(--p-content-background));
  color: var(--p-red-400, #f87171);
  padding: 10px 15px;
  border: 1px solid color-mix(in srgb, var(--p-red-500, #ef4444) 35%, transparent);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
  height: var(--eq-preview-height);
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
}

/* ==========================================================================
   CodeMirror Dark Mode Overrides (Selection, Gutters, Tokens)
   ========================================================================== */

:root.p-dark :deep(.cm-editor),
:root.dark :deep(.cm-editor) {
  background-color: #1e1e2e !important;
  color: #cdd6f4 !important;
}

:root.p-dark :deep(.cm-focused .cm-selectionBackground),
:root.p-dark :deep(.cm-selectionBackground),
:root.dark :deep(.cm-selectionBackground) {
  background-color: rgba(69, 71, 90, 0.7) !important;
}

:root.p-dark :deep(.cm-gutters),
:root.dark :deep(.cm-gutters) {
  background-color: #181825 !important;
  color: #6c7086 !important;
  border-right: 1px solid #313244 !important;
}

:root.p-dark :deep(.cm-cursor),
:root.dark :deep(.cm-cursor) {
  border-left-color: #f5e0dc !important;
}

/* Syntax Highlighting Token Overrides */
:root.p-dark :deep(.cm-editor),
:root.dark :deep(.cm-editor) {
  .tok-keyword, .cm-keyword { color: #f38ba8 !important; font-weight: 600; }
  .tok-string, .cm-string { color: #a6e3a1 !important; }
  .tok-number, .cm-number, .tok-atom, .cm-atom { color: #fab387 !important; }
  .tok-comment, .cm-comment { color: #6c7086 !important; font-style: italic; }
  .tok-operator, .cm-operator, .tok-punctuation, .cm-punctuation { color: #89dceb !important; }
  .tok-variableName, .cm-variableName { color: #cdd6f4 !important; }
  .tok-typeName, .cm-typeName, .tok-className, .cm-className { color: #94e2d5 !important; }
  .tok-propertyName, .cm-propertyName, .tok-attributeName, .cm-attributeName { color: #89b4fa !important; }
}
</style>
