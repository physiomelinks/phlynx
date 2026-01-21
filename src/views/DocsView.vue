<template>
  <el-container class="docs-page">
    <el-aside width="300px">
      <h2>Documentation Pages</h2>
      <el-menu :default-active="currentSlug" router>
        <el-menu-item index="/docs/ca-model-builder-introduction">Introduction</el-menu-item>
        <el-menu-item index="/docs/model-builder-tutorial">Tutorial</el-menu-item>
      </el-menu>
    </el-aside>

    <el-main class="markdown-body">
      <component :is="currentPageComponent" v-if="currentPageComponent" />
      <div v-else>
        <h2>Documentation Page Not Found</h2>
        <p>Select a page from the sidebar.</p>
      </div>
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const markdownFiles = import.meta.glob('@docs/*.md', { eager: true })
const docsMap = {}

for (const path in markdownFiles) {
  // Extract the filename without path and extension
  // e.g., "../docs/intro.md" -> "intro"
  const fileName = path.split('/').pop().replace('.md', '')
  
  // Store the component (Vite puts the component in the 'default' export)
  docsMap[fileName] = markdownFiles[path].default
}

// Determine the current slug from the URL (default to 'ca-model-builder-introduction')
const currentSlug = computed(() => {
  return route.params.slug || 'ca-model-builder-introduction'
})

// Get the matching component
const currentPageComponent = computed(() => {
  return docsMap[currentSlug.value]
})
</script>

<style>
@import 'github-markdown-css/github-markdown.css';

.markdown-body {
  padding: 40px;
  max-width: 900px;
}

.docs-page {
  height: 100%;
  overflow: hidden;
}

.el-aside {
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #dcdfe6;
}

.el-main.markdown-body {
  height: 100%;
  overflow-y: auto;
  padding: 40px;
  box-sizing: border-box;
}

</style>
