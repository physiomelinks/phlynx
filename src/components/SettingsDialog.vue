<template>
  <Dialog
    :visible="modelValue"
    modal
    :dismissableMask="true"
    header="Settings"
    :style="{ width: '45rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    :closable="true"
  >
    <Tabs value="general">
      <TabList>
        <Tab value="general">General</Tab>
        <Tab value="notifications">Notifications</Tab>
        <Tab value="advanced">Advanced</Tab>
      </TabList>
      
      <TabPanels>
        <!-- GENERAL SETTINGS -->
        <TabPanel value="general">
          <div class="flex flex-col gap-4 py-4">
            Test
          </div>
        </TabPanel>

        <!-- NOTIFICATION SETTINGS -->
        <TabPanel value="notifications">
          <div class="flex flex-col gap-4 py-4">
            Test
          </div>
        </TabPanel>

        <!-- ADVANCED SETTINGS -->
        <TabPanel value="advanced">
          <div class="py-4">
            Test
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- DIALOG FOOTER -->
    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <Button label="Cancel" text severity="secondary" @click="closeDialog" />
        <Button label="Save Changes" @click="closeDialog" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { Tabs, Tab, TabPanels, TabPanel, TabList, Dialog, Button, Checkbox, InputText,  } from 'primevue';

// Local visibility state for the dialog
const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const closeDialog = () => {
  emit('update:modelValue', false)
}

</script>
