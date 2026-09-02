<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :header="title"
    :style="{ width: '400px' }"
    @after-hide="resetForm"
    @mousedown.stop
    @wheel.stop
  >
    <form class="save-form" @submit.prevent="handleConfirm">
      <label for="save-dialog-filename">Filename</label>
      <InputGroup>
        <InputText id="save-dialog-filename" v-model="fileName" />
        <InputGroupAddon>{{ suffix }}</InputGroupAddon>
      </InputGroup>
    </form>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" text @click="closeDialog" />
        <Button label="Save" @click="handleConfirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'

import { notify } from '../utils/notify'
import { useGtm } from '../composables/useGtm'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Save Workflow',
  },
  suffix: {
    type: String,
    default: '.json',
  },
  defaultName: {
    type: String,
    default: 'PhLynx',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const { trackEvent } = useGtm()
const fileName = ref(props.defaultName)
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function resetForm() {
  fileName.value = props.defaultName
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (!fileName.value || !fileName.value.trim()) {
    notify.error({ message: 'Filename cannot be empty.' })
    return
  }

  trackEvent('save_dialog_action', {
    category: 'SaveDialog',
    action: 'confirm',
    label: `Filename: ${fileName.value}${props.suffix}`,
    file_type: 'json',
  })
  emit('confirm', fileName.value)
  closeDialog()
}

// Reset the form to the default name every time it's opened
watch(
  () => props.modelValue,
  (isVisible) => {
    if (isVisible) {
      resetForm()
    }
  }
)
</script>

<style scoped>
.save-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
