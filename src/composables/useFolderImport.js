import { ref } from 'vue'
import { hasRelevantExtension } from '../utils/import'
import { STORE_NAME, DB_NAME, HANDLE_KEY } from '../utils/constants'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function useFolderImport() {
  const supportsFolderAccess = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  // 'disconnected' | 'connected' | 'needs-permission'
  const folderStatus = ref('disconnected')
  const folderName = ref('')
  const directoryHandle = ref(null)

  async function restoreFolder() {
    if (!supportsFolderAccess) return
    try {
      const handle = await idbGet(HANDLE_KEY)
      if (!handle) return

      directoryHandle.value = handle
      folderName.value = handle.name

      const permission = await handle.queryPermission({ mode: 'read' })
      folderStatus.value = permission === 'granted' ? 'connected' : 'needs-permission'
    } catch {
      // Stored handle is stale/unreadable (e.g. IndexedDB entry from another
      // origin state) — treat as disconnected rather than throwing on load.
      folderStatus.value = 'disconnected'
    }
  }

  // Must be called from a direct user gesture (click handler).
  async function pickFolder() {
    if (!supportsFolderAccess) return false
    try {
      const handle = await window.showDirectoryPicker({ id: 'phlynx-import', mode: 'read' })
      directoryHandle.value = handle
      folderName.value = handle.name
      folderStatus.value = 'connected'
      await idbSet(HANDLE_KEY, handle)
      return true
    } catch (err) {
      // AbortError = user cancelled the picker; not an error worth surfacing.
      if (err?.name !== 'AbortError') throw err
      return false
    }
  }

  // Must be called from a direct user gesture (click handler) — re-confirms
  // permission on a previously-granted handle without opening a new picker.
  async function reconnectFolder() {
    if (!directoryHandle.value) return false
    const permission = await directoryHandle.value.requestPermission({ mode: 'read' })
    folderStatus.value = permission === 'granted' ? 'connected' : 'needs-permission'
    return permission === 'granted'
  }

  async function forgetFolder() {
    directoryHandle.value = null
    folderName.value = ''
    folderStatus.value = 'disconnected'
    await idbDelete(HANDLE_KEY)
  }

  // Recursively walks the granted directory and returns plain File objects
  // (plus their relative path, useful for messaging) for every file with a
  // relevant extension. Depth-limited so a folder full of unrelated project
  // files doesn't turn into an unbounded walk.
  async function scanFolder({ maxDepth = 4 } = {}) {
    if (!directoryHandle.value || folderStatus.value !== 'connected') return []

    const results = []

    async function walk(dirHandle, path, depth) {
      if (depth > maxDepth) return
      for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith('.') || name === 'node_modules') continue

        if (handle.kind === 'file') {
          if (!hasRelevantExtension(name)) continue
          try {
            const file = await handle.getFile()
            results.push({ file, path: path ? `${path}/${name}` : name })
          } catch {
            // Unreadable file (permissions changed mid-scan, etc.) — skip it.
          }
        } else if (handle.kind === 'directory') {
          await walk(handle, path ? `${path}/${name}` : name, depth + 1)
        }
      }
    }

    await walk(directoryHandle.value, '', 0)
    return results
  }

  return {
    supportsFolderAccess,
    folderStatus,
    folderName,
    restoreFolder,
    pickFolder,
    reconnectFolder,
    forgetFolder,
    scanFolder,
  }
}
