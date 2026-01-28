<template>
  <div class="module-list-container">
    <el-input v-model="filterText" placeholder="Filter modules..." clearable class="filter-input" />
    <el-collapse v-model="activeCollapseNames" class="module-list">
      <el-collapse-item
        v-for="file in filteredModuleFiles"
        :key="file.filename"
        :title="file.filename"
        :name="file.filename"
        type="secondary"
      >
        <el-card
          v-for="module in file.modules"
          :key="module.name"
          class="module-card"
          :class="{ selectable: selectable, 'is-stub': file.isStub }"
          shadow="hover"
          :draggable="!selectable && !file.isStub"
          @dragstart="!selectable && !file.isStub && onDragStart($event, module)"
          @click="selectable && handleSelect(module)"
        >
          <div class="module-name">{{ module.name }}</div>
        </el-card>
      </el-collapse-item>
    </el-collapse>

    <el-empty
      v-if="filteredModuleFiles.length === 0"
      :description="store.availableModules.length === 0 ? 'Load a module file' : 'No modules found'"
      :image-size="80"
    ></el-empty>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useBuilderStore } from '../stores/builderStore'
import useDragAndDrop from '../composables/useDnD'

// Lets you optionally make the list selectable (used by ModuleReplacementDialog)
const props = defineProps({
  selectable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const store = useBuilderStore()
const { onDragStart } = useDragAndDrop()

const filterText = ref('')
const activeCollapseNames = ref([])
const knownFilenames = ref(new Set())

const filteredModuleFiles = computed(() => {
  const lowerCaseFilter = filterText.value.toLowerCase()

  if (!lowerCaseFilter) {
    return store.availableModules // Show all files
  }

  // Filter *inside* each file, and only return files that have matches
  return store.availableModules
    .map((file) => {
      const filteredModules = file.modules.filter((module) => module.name.toLowerCase().includes(lowerCaseFilter))
      return { ...file, modules: filteredModules }
    })
    .filter((file) => file.modules.length > 0)
})

watch(filteredModuleFiles, (newFiles) => {
  // If we are filtering, open all panels that have matches.
  if (filterText.value) {
    activeCollapseNames.value = newFiles.map((f) => f.filename)
  } else {
    // If filter is cleared, close them all.
    activeCollapseNames.value = []
  }
})

watch(
  () => store.availableModules,
  (currentModuleFiles) => {
    const newFileNames = []
    for (const file of currentModuleFiles) {
      if (!knownFilenames.value.has(file.filename)) {
        newFileNames.push(file.filename)
        knownFilenames.value.add(file.filename)
      }
    }
    // if (newFileNames.length > 0) {
    //   activeCollapseNames.value.push(...newFileNames)
    // }
  },
  {
    deep: true,
    // immediate: true,
  }
)

function handleSelect(module) {
  if (props.selectable) {
    emit('select', module)
  }
}
</script>

<style scoped>
.module-list {
  flex-grow: 1;
  overflow-y: auto;
  border: none;
}

:deep(.el-collapse-item__header) {
  font-weight: bold;
  font-size: 1.05em;
  background-color: #f9f9f9;
  border-radius: 4px;
  padding: 0 5px;
  margin-top: 5px;
}

:deep(.el-collapse-item__arrow) {
  /* This creates a small, 8px buffer between the
     arrow and the title, giving it room to rotate. */
  margin-right: 8px;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

:deep(.el-collapse-item__content) {
  padding: 10px 10px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-list-container {
  display: flex;
  flex-direction: column;
  flex-grow: 1; /* Makes the whole container fill the aside */
  min-height: 0; /* Fix for overflow in flex columns */
}

.filter-input {
  margin-bottom: 15px;
}

.module-card {
  cursor: grab;
  user-select: none; /* Prevent text selection while dragging */
  flex-shrink: 0;
}

.module-card.selectable {
  cursor: pointer;
}

.module-card.is-stub {
  opacity: 0.5;
  cursor: not-allowed;
}

.module-name {
  font-weight: bold;
}
</style>
