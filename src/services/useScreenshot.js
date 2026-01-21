import { toJpeg as ElToJpg, toPng as ElToPng } from 'html-to-image'
import { ref } from 'vue'

export function useScreenshot() {
  const dataUrl = ref('')
  const imgType = ref('png')
  const error = ref(null)

  function fixEdges(el) {
    const paths = el.querySelectorAll(
      '.vue-flow__connection-path, .vue-flow__edge-path'
    )
    paths.forEach((path) => {
      path.setAttribute('stroke-width', '3')
      const computedStyle = getComputedStyle(path)
      const strokeColor = computedStyle.stroke || '#222'
      path.setAttribute('stroke', strokeColor)
      path.setAttribute('fill', 'none')
    })
  }

  async function capture(el, options = {}) {
    fixEdges(el)
    let data

    const readableDate = new Date().toISOString().slice(0, 19).replace('T', '-T').replace(/:/g, '-')
    const fileName = options.fileName ?? `phylnx-screenshot-D${readableDate}`

    switch (options.type) {
      case 'jpeg':
        data = await toJpeg(el, options)
        break
      case 'png':
        data = await toPng(el, options)
        break
      default:
        data = await toPng(el, options)
        break
    }

    if (options.shouldDownload && fileName !== '') {
      download(fileName)
    }

    return data
  }

  function toJpeg(el, options = { quality: 0.95 }) {
    error.value = null

    return ElToJpg(el, options)
      .then((data) => {
        dataUrl.value = data
        imgType.value = 'jpeg'
        return data
      })
      .catch((err) => {
        error.value = err
        throw new Error(err)
      })
  }

  function toPng(el, options = { quality: 1 }) {
    error.value = null

    const newOptions = {
      ...options,

      // remove unwanted visual elements from screenshot
      filter: (node) => {
        if (
          node.classList?.contains('vue-flow__minimap') ||
          node.classList?.contains('vue-flow__controls') ||
          node.classList?.contains('dropzone-background')
        ) {
          return false
        }
        return true
      },
    }

    return ElToPng(el, newOptions)
      .then((data) => {
        dataUrl.value = data
        imgType.value = 'png'
        return data
      })
      .catch((err) => {
        error.value = err
        throw new Error(err)
      })
  }

  function download(fileName) {
    const link = document.createElement('a')
    link.download = `${fileName}.${imgType.value}`
    link.href = dataUrl.value
    link.click()
  }

  return {
    capture,
    dataUrl,
    error,
  }
}
