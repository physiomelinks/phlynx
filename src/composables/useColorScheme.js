import { ref } from 'vue'

const STORAGE_KEY = 'phlynx-color-scheme'

function getInitialDarkMode() {
  if (typeof window === 'undefined') return false

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored !== null) return stored === 'dark'

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyDarkMode(value) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('p-dark', value)
}

const isDarkMode = ref(getInitialDarkMode())
applyDarkMode(isDarkMode.value)

function setDarkMode(value) {
  isDarkMode.value = value
  applyDarkMode(value)
  window.localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light')
}

function toggleDarkMode() {
  setDarkMode(!isDarkMode.value)
}

export function useColorScheme() {
  return { isDarkMode, toggleDarkMode, setDarkMode }
}