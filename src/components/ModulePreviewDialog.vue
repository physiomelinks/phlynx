<template>
  <el-dialog v-model="visible" :title="`Preview: ${moduleData?.moduleName}`" width="800px" append-to-body>
    <el-tabs v-if="moduleData" v-model="activeTab" type="border-card">
      <el-tab-pane label="Variables & Units" name="variables">
        <el-table :data="variablesList" height="400" stripe>
          <el-table-column prop="name" label="Name" width="180" />
          <el-table-column prop="units" label="Units" width="150" />
          <el-table-column prop="accessability" label="Accessability" />
          <el-table-column prop="type" label="Type">
            <template #default="{ row }">
              <el-tag size="small">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="Ports" name="ports">
        <el-table
          ref="portTable"
          :data="allPorts"
          height="400"
          stripe
          style="width: 100%"
          :default-sort="{ prop: 'access', order: 'ascending' }"
        >
          <el-table-column prop="access" label="Access" width="120" sortable>
            <template #default="{ row }">
              <el-tag :type="getTypeTag(row.access)" effect="plain">
                {{ row.access }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="type" label="Type" width="200" sortable>
            <template #default="{ row }">
              <strong>{{ row.type }}</strong>
            </template>
          </el-table-column>

          <el-table-column prop="variables" label="Port Variable(s)">
            <template #default="{ row }">
              <div v-if="row.variables && row.variables.length">
                <el-tag v-for="v in row.variables" :key="v" size="small" style="margin-right: 4px">
                  {{ v }}
                </el-tag>
              </div>
              <span v-else class="text-gray">-</span>
            </template>
          </el-table-column>

          <el-table-column prop="isSum" label="Sum?" width="100" align="center">
            <template #default="{ row }">
              <el-icon v-if="row.isSum" color="var(--el-color-success)"><Check /></el-icon>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="visible = false">Close</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  moduleData: Object, // { moduleName, filename, configData }
})

const emit = defineEmits(['update:modelValue'])

const portTable = ref(null)
const activeTab = ref('variables')

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

watch(visible, (newVal) => {
  if (newVal) {
    // Reset to first tab and top of table when opened
    activeTab.value = 'variables'
    if (portTable.value) {
      portTable.value.clearSort()
      portTable.value.setCurrentRow(null)
      // Note: I think .el-table__body-wrapper is the correct class for the scrollable div in Element Plus tables
      portTable.value.$el.querySelector('.el-table__body-wrapper').scrollTop = 0
      // Alternative if the above doesn't work:
      // nextTick(() => {
      // const wrapper = portTable.value?.$el.querySelector('.el-scrollbar__wrap')
      // if (wrapper) wrapper.scrollTop = 0
      // })
    }
  }
})

// Transform the raw config array into table-friendly objects
// Assuming structure: [name, units, accessability, type]
const variablesList = computed(() => {
  if (!props.moduleData?.configData?.variables_and_units) return []

  return props.moduleData.configData.variables_and_units
    .map((item) => ({
      name: item[0],
      units: item[1],
      accessability: item[2],
      type: item[3],
    }))
    .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically by variable name
})

/**
 * Flattens the 3 config arrays into one table-ready list.
 */
const allPorts = computed(() => {
  if (!props.moduleData?.configData) return []

  const { entrance_ports, exit_ports, general_ports } = props.moduleData.configData
  const list = []

  // Helper to map raw data to object
  const mapPort = (rawPort, access) => {
    const type = rawPort.port_type
    const variables = rawPort.variables ?? []
    const isSum = rawPort.isSum ?? false

    return { access, type, variables, isSum }
  }

  if (entrance_ports) {
    entrance_ports.forEach((p) => list.push(mapPort(p, 'Input')))
  }

  if (exit_ports) {
    exit_ports.forEach((p) => list.push(mapPort(p, 'Output')))
  }

  if (general_ports) {
    general_ports.forEach((p) => list.push(mapPort(p, 'General')))
  }

  return list
})

function getTypeTag(type) {
  switch (type) {
    case 'Input':
      return 'warning' // Orange for Entrance
    case 'Output':
      return 'success' // Green for Exit
    case 'General':
      return '' // Blue (default) for General
    default:
      return 'info'
  }
}
</script>
