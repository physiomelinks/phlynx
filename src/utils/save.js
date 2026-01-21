import { JSON_FILE_TYPES } from "./constants"

export const legacyDownload = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click() // Triggers the download

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

export const saveFileHandle = async (defaultName, types) => {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: JSON_FILE_TYPES,
      })
      return { status: true, handle: handle }
    } catch (err) {
      if (err.name === 'AbortError') return { status: true, handle: null }
      new Error(`Error saving file: ${err.message}`)
    }
  }

  return { status: false, handle: null }
}

export const writeFileHandle = async (handle, dataBlob) => {
  try {
    // Create a writable stream to the file
    const writable = await handle.createWritable()
    await writable.write(dataBlob)
    await writable.close()
  } catch (err) {
    if (err.name === 'AbortError') return true
    new Error(`Error writing file to disk: ${err.message}`)
  }
}

export const saveFileWithDialog = async (dataBlob, defaultName, types) => {
  // Check if the API is supported (Chrome/Edge)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'CellML File',
            accept: { 'application/xml': ['.cellml', '.xml'] },
          },
        ],
      })

      // Create a writable stream to the file
      const writable = await handle.createWritable()
      await writable.write(dataBlob)
      await writable.close()
    } catch (err) {
      if (err.name === 'AbortError') return true
      new Error(`Error saving file: ${err.message}`)
    }
    return true
  }

  return false
}

export const save = (dataBlob, defaultName, types) => {
  saveFileWithDialog(dataBlob, defaultName, types)
}
