<template>
  <ConfirmDialog group="app-confirm">
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div class="confirm-container">
        <div class="confirm-body">
          <i :class="['confirm-icon', getIcon(message.severity)]" :style="{ color: getIconColor(message.severity) }" />

          <div class="confirm-text">
            <div class="confirm-header">
              {{ message.header }}
            </div>

            <div class="confirm-message">
              {{ message.message }}
            </div>
          </div>
        </div>

        <div class="confirm-actions">
          <Button
            v-if="message.rejectLabel"
            :label="message.rejectLabel"
            severity="secondary"
            outlined
            @click="rejectCallback"
          />

          <Button
            :label="message.acceptLabel || 'OK'"
            :severity="getButtonSeverity(message.severity)"
            @click="acceptCallback"
          />
        </div>
      </div>
    </template>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Button from 'primevue/button'

function getIcon(severity?: string) {
  switch (severity) {
    case 'error':
      return 'pi pi-times-circle'

    case 'warning':
      return 'pi pi-exclamation-triangle'

    case 'success':
      return 'pi pi-check-circle'

    default:
      return 'pi pi-info-circle'
  }
}

// Reads from PrimeVue's own theme tokens (with sensible fallbacks) rather than
// hardcoded Tailwind palette classes, so these track whatever preset/colors
// the app is actually themed with, and update automatically with PrimeVue's
// dark-mode class toggle instead of depending on Tailwind's separate dark:
// variant config staying in sync with it.
function getIconColor(severity?: string) {
  switch (severity) {
    case 'error':
      return 'var(--p-red-500, #ef4444)'

    case 'warning':
      return 'var(--p-orange-500, #f97316)'

    case 'success':
      return 'var(--p-green-500, #22c55e)'

    default:
      return 'var(--p-blue-500, #3b82f6)'
  }
}

function getButtonSeverity(severity?: string) {
  switch (severity) {
    case 'error':
      return 'danger'

    case 'warning':
      return 'warning'

    case 'success':
      return 'success'

    default:
      return 'primary'
  }
}
</script>

<style scoped>
.confirm-container {
  width: min(92vw, 420px);
  border-radius: 8px;
  padding: 24px;
  border: 1px solid var(--p-content-border-color, #e5e7eb);
  background: var(--p-content-background, #ffffff);
  box-shadow: var(--p-overlay-modal-shadow, 0 4px 24px rgba(0, 0, 0, 0.15));
}

.confirm-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.confirm-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.confirm-text {
  min-width: 0;
  flex: 1;
}

.confirm-header {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color, #18181b);
}

.confirm-message {
  margin-top: 8px;
  font-size: 0.875rem;
  white-space: pre-wrap;
  color: var(--p-text-muted-color, #52525b);
}

.confirm-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
