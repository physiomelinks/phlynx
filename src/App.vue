<template>
  <div class="app-layout">
    <el-header class="global-nav">
      <!-- <div class="image-container">
        
      </div> -->
      <div class="brand">
        <img src="/phlynxlogo.svg" alt="PhLynx Logo" class="centred-image" />
        <strong>PhLynx v{{ appVersion }}</strong>
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const appVersion = __APP_VERSION__ + (__RELEASE_BUILD__ ? '' : '*')
const route = useRoute()

const isDocsActive = computed(() => {
  return route.path.startsWith('/docs')
})
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
</style>