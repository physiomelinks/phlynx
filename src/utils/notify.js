import ToastEventBus from 'primevue/toasteventbus'

const notifyDuration = (type) => {
  return type === 'info' || type === 'success' ? 1500 : type === 'warning' || type === 'warn' ? 3000 : 4000
}

export const notify = (options = {}) => {
  const { type, title, message, duration, ...rest } = options

  const severity = type === 'warning' ? 'warn' : type

  const toastMessage = {
    severity: severity || 'info',
    summary: title,
    detail: message, 
    life: duration ?? notifyDuration(type),
    ...rest,
  }

  ToastEventBus.emit('add', toastMessage)

  return {
    close: () => ToastEventBus.emit('remove', toastMessage),
  }
}

notify.error = (options) => notify({ ...options, type: 'error' })
notify.info = (options) => notify({ ...options, type: 'info' })
notify.success = (options) => notify({ ...options, type: 'success' })
notify.warning = (options) => notify({ ...options, type: 'warning' })
