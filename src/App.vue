<template>
  <div class="app-layout">
    <header class="global-nav">
      <div class="brand">
        Circulatory Autogen Model Builder v{{ appVersion }}
      </div>
      <nav>
        <router-link to="/">Workbench</router-link>
        <router-link to="/docs">Documentation</router-link>
        <router-link to="/about">About</router-link>
      </nav>
    </header>

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
const appVersion = __APP_VERSION__
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

.global-nav nav a.router-link-active {
  color: #409eff;
  pointer-events: none;
  cursor: default;
}

.view-container {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
}
</style>
