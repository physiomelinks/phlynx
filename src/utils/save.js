/**
 * Remove the file extension from a filename.
 * @param {string} filename - The filename to process (e.g., "document.pdf")
 * @returns {string} The filename without extension (e.g., "document")
 * @example
 * stripExtension("report.docx") // returns "report"
 * stripExtension("archive.tar.gz") // returns "archive.tar"
 */

export const stripExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

/**
 * Ensure a filename has the specified extension.
 * If the filename already has the extension, returns it unchanged.
 * If not, strips any existing extension and adds the specified one.
 * @param {string} filename - The filename to process
 * @param {string} extension - The extension to ensure (with or without leading dot)
 * @returns {string} The filename with the correct extension
 * @example
 * ensureExtension("model", ".cellml") // returns "model.cellml"
 * ensureExtension("model.cellml", ".cellml") // returns "model.cellml"
 * ensureExtension("model.xml", ".cellml") // returns "model.cellml"
 */
export const ensureExtension = (filename, extension) => {
  // should confirm that extension provided is valid
  const ext = extension.startsWith('.') ? extension : `${extension}`
  return filename.endsWith(ext) ? filename : `${stripExtension(filename)}${ext}`
}

/**
 * Trigger a file download in the browser using the legacy method (anchor element).
 * Creates a temporary download link and clicks it, then cleans up.
 * Used for browsers that don't support the File System Access API.
 * @param {string} filename - The filename for the download (including extension)
 * @param {Blob} blob - The file content as a Blob
 * @example
 * const blob = new Blob(['data'], { type: 'text/plain' })
 * legacyDownload("output.txt", blob)
 */
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

/**
 * Open the browser's native "Save As" file picker dialog.
 * Uses the File System Access API (showSaveFilePicker).
 * Only works in browsers that support this API (Chrome, Edge).
 * @param {string} defaultName - Suggested filename to show in the dialog
 * @param {Array} fileTypes - Array of file type specifications for the picker
 * @returns {Promise<{status: boolean, handle: FileSystemFileHandle|null}>}
 *   - status: true if API is supported and dialog was shown
 *   - handle: FileSystemFileHandle if user selected a location, null if cancelled
 * @throws {Error} If an unexpected error occurs (not AbortError)
 * @example
 * const result = await saveFileHandle("report.pdf", PDF_FILE_TYPES)
 * if (result.handle) {
 *   // User selected a location
 * }
 */
export const saveFileHandle = async (defaultName, fileTypes) => {
  if ('showSaveFilePicker' in window) {
    try {
      const safeName =
        defaultName && defaultName.trim().length > 0
          ? defaultName
          : 'phlynx-export'
      const handle = await window.showSaveFilePicker({
        suggestedName: safeName,
        types: fileTypes,
      })
      return { status: true, handle }
    } catch (err) {
      if (err.name === 'AbortError')
        return { status: true, handle: null }
      throw new Error(`Error saving file: ${err.message}`)
    }
  }
  return { status: false, handle: null }
}

/**
 * Write blob data to a file using a FileSystemFileHandle.
 * Creates a writable stream, writes the data, and closes the stream.
 * @param {FileSystemFileHandle} handle - The file handle obtained from showSaveFilePicker
 * @param {Blob} blob - The data to write to the file
 * @returns {Promise<boolean|undefined>} Returns true if user aborted, undefined otherwise
 * @throws {Error} If writing fails (not AbortError)
 * @example
 * const blob = new Blob(['content'], { type: 'text/plain' })
 * await writeFileHandle(handle, blob)
 */
export const writeFileHandle = async (handle, blob) => {
  try {
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch (err) {
    if (err.name === 'AbortError') return true
    throw new Error(`Error writing file to disk: ${err.message}`)
  }
}

/**
 * Get a file handle using the system dialog (optimized workflow for expensive operations).
 * Opens the save dialog BEFORE blob generation, so users can cancel without
 * wasting computation. Returns the handle and a clean filename (without extension).
 * @param {string} baseName - Base filename without extension
 * @param {Array} fileTypes - File type specifications for the picker
 * @param {string} suffix - File extension to append (e.g., ".cellml")
 * @returns {Promise<Object>} Result object with:
 *   - success: boolean - Whether a handle was obtained
 *   - handle: FileSystemFileHandle - The file handle (if success and system dialog)
 *   - cleanName: string - Filename without extension (if success)
 *   - cancelled: boolean - True if user cancelled (if !success)
 *   - needsLegacyDialog: boolean - True if API not supported (if !success)
 *   - method: 'system'|'legacy' - Which method was/should be used
 * @example
 * const result = await getFileHandle("model", CELLML_FILE_TYPES, ".cellml")
 * if (result.success) {
 *   const blob = await generateExpensiveBlob() // Only generate if user confirmed
 *   await writeFileHandle(result.handle, blob)
 * }
 */
export const getFileHandle = async (baseName, fileTypes, suffix) => {
  if ('showSaveFilePicker' in window) {
    const suggestedName = `${baseName}${suffix}`
    const result = await saveFileHandle(suggestedName, fileTypes)

    if (result.status && result.handle) {
      return {
        success: true,
        handle: result.handle,
        cleanName: stripExtension(result.handle.name),
        method: 'system'
      }
    } else if (result.status && !result.handle) {
      return { success: false, cancelled: true }
    }
  }

  return { success: false, needsLegacyDialog: true, method: 'legacy' }
}

/**
 * Save a blob to a file using either a system handle or legacy download.
 * If a handle is provided, writes to it using the File System Access API.
 * Otherwise, falls back to triggering a browser download.
 * @param {Blob} blob - The file content to save
 * @param {FileSystemFileHandle|null} handle - File handle from getFileHandle (or null for legacy)
 * @param {string} baseName - Base filename without extension (used for legacy download)
 * @param {string} suffix - File extension (e.g., ".json")
 * @returns {Promise<Object>} Result object with:
 *   - success: boolean - Always true if no errors thrown
 *   - savedName: string - The clean filename that was saved (without extension)
 *   - method: 'system'|'legacy' - Which save method was used
 * @example
 * // After getting handle via getFileHandle
 * const blob = new Blob(['data'], { type: 'application/json' })
 * const result = await saveWithDialog(blob, handle, "workspace", ".json")
 * 
 * // Or for legacy browsers (handle = null)
 * const result = await saveWithDialog(blob, null, "workspace", ".json")
 * // Triggers download of "workspace.json"
 */
export const saveWithDialog = async (blob, handle, baseName, suffix) => {
  if (handle) {
    await writeFileHandle(handle, blob)
    return {
      success: true,
      savedName: stripExtension(handle.name),
      method: 'system'
    }
  }
  const downloadName = ensureExtension(baseName, suffix)
  legacyDownload(downloadName, blob)
  return { success: true, savedName: baseName, method: 'legacy' }
}