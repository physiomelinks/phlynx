<template>
  <div class="app-layout">
    <el-header class="global-nav">
      <!-- <div class="image-container">
        
      </div> -->
      <div class="brand">
        <img src="/phlynxlogo.svg" alt="PhLynx Logo" class="centred-image" />
        <strong>PhLynx v{{ appVersion }}</strong>
      </div>
      <div class="session-name" @dblclick="startEditing">
       <strong v-if="!isEditing">
          {{ sessionName }}
       </strong> 
        <el-input v-else ref="inputRef" v-model="editingValue" @blur="saveEdit" @keyup.enter="saveEdit" @keyup.esc="cancelEdit"/>
      </div>
      <nav>
        <router-link to="/">Workbench</router-link>
        <router-link to="/docs/" :class="{ 'force-active': isDocsActive }">User Guide</router-link>
        <router-link to="/about">About</router-link>
      </nav>
    </el-header>

    <div class="view-container">
      <router-view v-slot="{ Component }">
        <keep-alive include="BuilderView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useBuilderStore } from './stores/builderStore'

const appVersion = __APP_VERSION__ + __BUILD_STATE_MARKER__
const route = useRoute()
const builderStore = useBuilderStore()

const sessionName = computed(() => builderStore.lastSaveName)

const editingValue = ref('')
const isEditing = ref(false)
const inputRef = ref(null)

const isDocsActive = computed(() => {
  return route.path.startsWith('/docs')
})

async function startEditing(e) {
  e.stopPropagation()

  editingValue.value = sessionName.value
  isEditing.value = true

  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function saveEdit() {
  const name = editingValue.value.trim()

  if (!name) {
    cancelEdit()
    return
  }

  if (name !== sessionName.value) {
    builderStore.setLastSaveName(name)
  }

  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}
</script>

<style>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.global-nav {
  background-color: #333;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  padding-bottom: 0.5rem;
  padding-top: 0.5rem;
}

.global-nav nav a {
  color: #ddd;
  text-decoration: none;
  margin-left: 20px;
  font-size: 0.9rem;
  cursor: pointer;
}

.global-nav nav a.router-link-active,
.global-nav nav a.force-active {
  color: #409eff;
  pointer-events: none;
  cursor: default;
}

.view-container {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  width: 200px;
}

.centred-image {
  max-width: 40px;
  height: auto;
  padding-right: 10px;
}

.session-name {
  cursor: text;
}

.session-name:hover {
  color: #409eff;
}

.session-name {
  min-width: 200px;
}
</style>