<template>
  <el-dialog
    :model-value="modelValue"
    title="Parameter File Matching"
    width="850px"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <span>
      Assign parameter files to active CellML files in the workspace.
    </span>
    <el-divider></el-divider>
    
    <el-table
      :data="associationTable" 
      stripe
      border
      empty-text="No active modules requiring parameters found."
      >
      <el-table-column prop="sourceFileName" label="CellML File" min-width="250" />

      <el-table-column label="Parameter Source" min-width="250">
        <template #default="scope">
          <el-select
            v-model="scope.row.matchedParameterFile"
            filterable
            placeholder="Select a file"
            @change="handleSelectionChange(scope.row)"
            style="width: 100%"
          >
            <el-option
              v-for="file in availableFiles"
              :key="file.name"
              :label="file.name"
              :value="file.name"
            />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="Match Info" width="250" align="center">
        <template #default="{ row }">
          
          <div v-if="row.matchStats && row.matchStats.total === 0">
             <el-tag type="info" effect="plain" class="full-width-tag">No Params Needed</el-tag>
          </div>

          <div v-else-if="row.assignmentType === 'manual'">
            <el-tag type="warning" effect="dark" class="full-width-tag">
              Manual Override
            </el-tag>
          </div>

          <div v-else-if="row.assignmentType === 'imported'">
            <el-tag type="success" effect="dark" class="full-width-tag">
              <el-icon style="margin-right: 5px"><Check /></el-icon> 
              Imported Parameters
            </el-tag>
          </div>

          <div v-else-if="row.assignmentType === 'auto'" style="width: 100%; padding: 0 10px;">
            <el-tooltip placement="top" effect="light">
              <template #content>
                <div class="tooltip-content">
                  <div v-if="row.matchStats.missing > 0">
                    <strong>Missing Variables:</strong>
                    <ul class="missing-list">
                      <li v-for="v in row.matchStats.missingVars.slice(0, 5)" :key="v">
                        {{ v }}
                      </li>
                      <li v-if="row.matchStats.missingVars.length > 5">
                        ...and {{ row.matchStats.missingVars.length - 5 }} more
                      </li>
                    </ul>
                  </div>
                  <div v-else>
                    All {{ row.matchStats.total }} required parameters found.
                  </div>
                  <div style="margin-top:5px; font-size: 0.9em; color: #888;">
                    (Auto-detected best match)
                  </div>
                </div>
              </template>
              
              <div class="progress-container">
                <el-progress 
                  :percentage="Math.round(row.matchStats.matchPercentage)" 
                  :status="getProgressStatus(row.matchStats.matchPercentage)"
                  :stroke-width="18"
                  text-inside
                />
              </div>
            </el-tooltip>
          </div>

          <div v-else>
            <el-tag type="info" effect="plain">Unassigned</el-tag>
          </div>

        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm">
          Save Assignments
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { useGtm } from '../composables/useGtm'
import { useBuilderStore } from '../stores/builderStore'
import { notify } from '../utils/notify'

const props = defineProps({
  modelValue: Boolean,
  activeFiles: {
    type: Array,
    required: true,
  }
})

const emit = defineEmits(['update:modelValue'])

const builderStore = useBuilderStore()
const { trackEvent } = useGtm()
const associationTable = ref([])

// --- Helper: Get Required Variables ---
function getRequiredVariablesForFile(fileObj) {
  const allVars = new Set()
  if (fileObj.modules && Array.isArray(fileObj.modules)) {
    fileObj.modules.forEach(module => {
      if (module.portOptions && Array.isArray(module.portOptions)) {
        module.portOptions.forEach(p => {
            if (p.name) allVars.add(p.name)
        })
      }
    })
  }
  return Array.from(allVars)
}

// --- Helper: Check if File is "Active" in Workspace ---
function isFileActive(fileObj, activeFiles) {
  if (!fileObj.modules) return false
  return activeFiles.some((file) => file === fileObj.filename)
}

// --- Data Preparation ---
const availableFiles = computed(() => {
  if (!builderStore.parameterFiles) return []
  return Array.from(builderStore.parameterFiles.keys()).map((name) => ({
    name,
  }))
})

function calculateStats(fileObj, fileName) {
  const requiredVars = getRequiredVariablesForFile(fileObj)
  const fileData = builderStore.parameterFiles.get(fileName) || []
  
  const availableVars = new Set(
    fileData.map((d) => d.variable || d.name || d.Variable || d.variable_name || d.Name)
  )

  const total = requiredVars.length
  if (total === 0) return { total: 0, matched: 0, missing: 0, missingVars: [], matchPercentage: 100 }

  const missingVars = requiredVars.filter((v) => !availableVars.has(v))
  const matched = total - missingVars.length
  const percentage = (matched / total) * 100

  return {
    total,
    matched,
    missing: missingVars.length,
    missingVars,
    matchPercentage: percentage
  }
}

function getProgressStatus(percentage) {
  if (percentage === 100) return 'success'
  if (percentage >= 50) return 'warning'
  return 'exception'
}

function handleSelectionChange(row) {
  row.assignmentType = 'manual'
  
  if (row.matchedParameterFile) {
    row.matchStats = calculateStats(row.fileRef, row.matchedParameterFile)
  } else {
    row.matchStats = null
  }
}

function findBestMatchForFile(fileRef, availableParamFiles) {
  let bestMatchName = null
  let bestMatchCount = -1

  for (const paramFileName of availableParamFiles) {
    const stats = calculateStats(fileRef, paramFileName)
    if (stats.matched > bestMatchCount) {
      bestMatchCount = stats.matched
      bestMatchName = paramFileName
    }
  }
  return bestMatchCount > 0 ? bestMatchName : null
}

async function prepareData() {
  const rows = []
  
  if (!builderStore.availableModules) {
    associationTable.value = []
    return
  }

  const paramFileNames = Array.from(builderStore.parameterFiles.keys())

  builderStore.availableModules.forEach((file) => {
    const assignedInStore = builderStore.fileParameterMap.get(file.filename)
    const storedType = builderStore.fileAssignmentTypeMap?.get(file.filename)
    const isActive = props.activeFiles.includes(file.filename)

    if (!isActive) {
        return
    }

    let currentParamFile = null
    let assignmentType = 'none'

    if (assignedInStore) {
      currentParamFile = assignedInStore
      assignmentType = storedType || 'imported'
    } else if (paramFileNames.length > 0) {
      const bestMatchName = findBestMatchForFile(file, paramFileNames) 
      if (bestMatchName) {
        currentParamFile = bestMatchName
        assignmentType = 'auto'
      }
    }

    const row = {
      sourceFileName: file.filename,
      fileRef: file, 
      matchedParameterFile: currentParamFile || null,
      assignmentType: assignmentType,
      matchStats: currentParamFile ? calculateStats(file, currentParamFile) : null
    }
    
    rows.push(row)
  })
  
  associationTable.value = rows
}

// --- Dialog Controls ---
function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  const missing = associationTable.value.filter(
    (row) => !row.matchedParameterFile && row.matchStats && row.matchStats.total > 0
  )
  if (missing.length > 0) {
    notify.warning({
      title: 'Incomplete Configuration',
      message: `${missing.length} active files have no parameter file assigned.`,
    })
  }

  const linkMap = new Map(builderStore.fileParameterMap)
  const typeMap = new Map(builderStore.fileAssignmentTypeMap)
  
 associationTable.value.forEach((row) => {
    if (row.sourceFileName) {
      if (row.matchedParameterFile) {
        linkMap.set(row.sourceFileName, row.matchedParameterFile)
        if (row.assignmentType) {
           typeMap.set(row.sourceFileName, row.assignmentType)
        }
      } else {
        linkMap.delete(row.sourceFileName)
        typeMap.delete(row.sourceFileName)
      }
    }
  })

  console.log(linkMap, typeMap)
  builderStore.applyFileParameterLinks(linkMap, typeMap)


  trackEvent('parameter_match_action', {
    category: 'ModuleParameterMatch',
    action: 'confirm',
    label: `${missing.length} missing assignments`, // useful context
    file_type: 'json'
  })

  notify.success({ title: 'Saved', message: 'Parameter links updated.' })
  closeDialog()
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      prepareData()
    }
  }
)
</script>

<style scoped>
.tooltip-content {
  max-width: 300px;
  line-height: 1.4;
}
.missing-list {
  padding-left: 16px; 
  margin: 4px 0;
}
.full-width-tag {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.progress-container {
  width: 100%;
  padding-top: 5px;
  cursor: help; 
}
</style>