<template>
  <el-dialog
    :model-value="modelValue"
    title="Import Configuration Files"
    width="400px"
    teleported
    @closed="resetForm"
    @update:model-value="closeDialog"
  >
    <el-form label-position="top">
      <el-form-item
        label="Select vessel array file"
        :required="true"
        inline-message
      >
        <div class="upload-row">
          <el-upload
            :auto-upload="false"
            :on-change="handleVesselArray"
            :show-file-list="false"
            :accept="'.csv'"
          >
            <el-input
              :model-value="vesselArrayName"
              placeholder="No file selected"
              readonly
            >
            </el-input>
            <el-button type="success">Browse</el-button>
          </el-upload>
          <el-icon v-if="vesselArrayValid" color="green">
            <Check />
          </el-icon>
        </div>
      </el-form-item>
      <el-form-item
        label="Select module configuration file"
        :required="true"
        inline-message
      >
        <div class="upload-row">
          <el-upload
            :auto-upload="false"
            :on-change="handleModuleConfig"
            :show-file-list="false"
            :accept="'.json'"
          >
            <el-input
              :model-value="moduleConfigName"
              placeholder="No file selected"
              readonly
              class="file-input"
            >
            </el-input>
            <el-button type="success">Browse</el-button>
          </el-upload>
          <el-icon v-if="moduleConfigValid" color="green">
            <Check />
          </el-icon>
        </div>
      </el-form-item>
      <el-form-item
        label="Upload required"
        :required="true">
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :disabled="!vesselArrayValid || !moduleConfigValid"
        >
          Confirm
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElNotification } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import Papa from 'papaparse'

const props = defineProps({
  // v-model for visibility
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue', // Required for v-model
  'confirm', // Emits the new data
])

function resetForm() {
  vesselArrayName.value = null
  moduleConfigName.value = null
  vesselArrayValid.value = false
  moduleConfigValid.value = false
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  emit('confirm', {
    vesselArray: vesselArray.data,
    moduleConfig: moduleConfig.data,
  })

  closeDialog()
}

const vesselArray = reactive({
  data: [],
})

const moduleConfig = reactive({
  data: [],
})

const handleVesselArray = (file) => {
  vesselArrayName.value = file.name
  vesselArrayValid.value = true

  Papa.parse(file.raw, {
    header: true, // Converts row 1 to object keys.
    skipEmptyLines: true,
    trimHeaders: true, // Remove whitespace from headers.
    transform: (value) => {
      // Removes whitespace from cell values.
      return value.trim()
    },
    complete: (results) => {
      try {
        // Error handle - confirm that the file loaded has the required columns (i.e., is a valid vessel array file)
        if (
          !(
            results.data.length > 0 &&
            'name' in results.data[0] &&
            'BC_type' in results.data[0] &&
            'vessel_type' in results.data[0] &&
            'inp_vessels' in results.data[0] &&
            'out_vessels' in results.data[0]
          )
        ) {
          throw new Error('Invalid vessel array file format.')
        }
        // results.data will be an array of objects
        // e.g., [{ name: 'a', BC_type: 'nn', vessel_type: 'a', inp_vessels: space separated list, out_vessels: space separated list }, { object 2 }]
        vesselArray.data = results.data
      } catch (error) {
        ElNotification.error(error.message), (vesselArrayValid.value = false)
        vesselArrayName.value = null
      }
    },

    error: (err) => {
      ElNotification.error({
        title: 'CSV Parse Error',
        message: err.message,
      }),
        (vesselArrayValid.value = false)
    },
  })
}

const handleModuleConfig = (file) => {
  moduleConfigName.value = file.name

  let reader = new FileReader()
  reader.readAsText(file.raw)

  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(reader.result)

      if (
        !(
          parsed.length > 0 &&
          'entrance_ports' in parsed[0] &&
          'exit_ports' in parsed[0] &&
          'general_ports' in parsed[0] &&
          'BC_type' in parsed[0] &&
          'vessel_type' in parsed[0] &&
          'module_format' in parsed[0] &&
          'module_file' in parsed[0] &&
          'module_type' in parsed[0]
        )
      ) {
        throw new Error('Invalid module configuration file format.')
      }

      moduleConfig.data = parsed
      moduleConfigValid.value = true
    } catch (error) {
      ElNotification.error(error.message), (moduleConfigValid.value = false)
      moduleConfigName.value = null
    }
  }
}

const vesselArrayName = ref(null)
const moduleConfigName = ref(null)
const vesselArrayValid = ref(false)
const moduleConfigValid = ref(false)
</script>

<style scoped>
.file-input {
  flex: 1;
}

.file-input input {
  cursor: pointer;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
</style>
