<template>
  <el-container class="docs-page">
    <el-aside :class="['left-sidebar', { 'collapsed': isCollapse }]">
      <div class="sidebar-header">
        <h2 v-show="!isCollapse" class="sidebar-title">User Guide</h2>
        <el-button class="collapse-btn" :icon="isCollapse ? ArrowRight : ArrowLeft" circle
          @click="isCollapse = !isCollapse" />
      </div>
      <el-menu class="el-menu-vertical" :default-active="currentSlug" router :collapse="isCollapse">
        <el-sub-menu index="1">
          <template #title>
            <el-icon>
              <star />
            </el-icon>
            <span>Getting Started</span>
          </template>
          <el-menu-item index="/docs/phlynx-introduction">Introduction</el-menu-item>
          <el-menu-item index="/docs/phlynx-tutorial">Quick Start</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="2">
          <template #title>
            <el-icon>
              <guide />
            </el-icon>
            <span>How to Guides</span>
          </template>
          <el-menu-item index="/docs/howto-use-with-CA">Edit Circulatory Autogen Files</el-menu-item>
          <el-menu-item index="/docs/howto-develop-phlynx">Developing PhLynx</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="3">
          <template #title>
            <el-icon>
              <reading />
            </el-icon>
            <span>
              Reference
            </span>
          </template>
          <el-menu-item index="/docs/phlynx-glossary">Glossary</el-menu-item>
          <el-menu-item index="/docs/reference-file-type">File Formats</el-menu-item>
          <el-menu-item index="/docs/reference-module-format">CellML Module Requirements</el-menu-item>
          <el-menu-item index="/docs/ui-overview">User Interface Overview</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="4">
          <template #title>
            <el-icon>
              <first-aid-kit />
            </el-icon>
            <span>Support</span>
          </template>
          <el-menu-item index="/docs/faq">FAQs</el-menu-item>
          <el-menu-item index="/docs/support-getting-help">Getting Help</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-main class="markdown-body">
      <component :is="currentPageComponent" v-if="currentPageComponent" />
      <div v-else>
        <h2>Documentation Page Not Found</h2>
        <p>Select a page from the sidebar.</p>
      </div>
    </el-main>

    <el-aside class="toc-sidebar">
      <div class="toc-container">
        <h3 class="toc-title">On This Page</h3>
        <nav class="toc-nav">
          <ul v-if="headings.length > 0">
            <li v-for="heading in headings" :key="heading.id"
              :class="['toc-item', `toc-level-${heading.level}`, { 'active': activeHeading === heading.id }]">
              <a :href="`#${heading.id}`" @click.prevent="scrollToHeading(heading.id)">
                {{ heading.text }}
              </a>
            </li>
          </ul>
          <p v-else class="toc-empty">No headings found</p>
        </nav>
      </div>
    </el-aside>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  FirstAidKit,
  Guide,
  Reading,
  Star
} from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapse = ref(true)
const markdownFiles = import.meta.glob('@docs/*.md', { eager: true })
const docsMap = {}

for (const path in markdownFiles) {
  const fileName = path.split('/').pop().replace('.md', '')
  docsMap[fileName] = markdownFiles[path].default
}

const currentSlug = computed(() => {
  return route.params.slug || 'phlynx-introduction'
})

const currentPageComponent = computed(() => {
  return docsMap[currentSlug.value]
})

const headings = ref([])
const activeHeading = ref('')

const extractHeadings = () => {
  const mainElement = document.querySelector('.markdown-body')
  if (!mainElement) return []

  const headingElements = mainElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const extractedHeadings = []

  headingElements.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = heading.textContent
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
    }

    if (!(index === 0 && heading.tagName === 'H1')) {
      extractedHeadings.push({
        id: heading.id,
        text: heading.textContent,
        level: parseInt(heading.tagName.charAt(1))
      })
    }
  })

  return extractedHeadings
}

const scrollToHeading = (id) => {
  const element = document.getElementById(id)
  const mainElement = document.querySelector('.el-main.markdown-body')

  if (element && mainElement) {
    const elementTop = element.offsetTop
    const maxScroll = mainElement.scrollHeight - mainElement.clientHeight

    const targetScroll = Math.min(elementTop - 100, maxScroll)

    mainElement.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    })

    activeHeading.value = id

    element.classList.add('heading-highlight')
    setTimeout(() => {
      element.classList.remove('heading-highlight')
    }, 3000) 
  }
}

const updateActiveHeading = () => {
  const mainElement = document.querySelector('.el-main.markdown-body')
  if (!mainElement) return

  const headingElements = Array.from(mainElement.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  if (headingElements.length === 0) return

  const scrollTop = mainElement.scrollTop
  const scrollHeight = mainElement.scrollHeight
  const clientHeight = mainElement.clientHeight

  const isAtTop = scrollTop < 50

  if (isAtTop) {
    activeHeading.value = ''
    return
  }

  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10

  if (isAtBottom) {
    activeHeading.value = headingElements[headingElements.length - 1].id
    return
  }

  const scrollPosition = scrollTop + 100

  for (let i = headingElements.length - 1; i >= 0; i--) {
    const heading = headingElements[i]
    if (heading.offsetTop <= scrollPosition) {
      activeHeading.value = heading.id
      return
    }
  }

  activeHeading.value = ''
}

// Setup scroll listener
let scrollElement = null

onMounted(() => {
  nextTick(() => {
    headings.value = extractHeadings()
    scrollElement = document.querySelector('.el-main.markdown-body')
    if (scrollElement) {
      scrollElement.addEventListener('scroll', updateActiveHeading)
      updateActiveHeading()
    }
  })
})

onUnmounted(() => {
  if (scrollElement) {
    scrollElement.removeEventListener('scroll', updateActiveHeading)
  }
})

watch(currentSlug, () => {
  nextTick(() => {
    headings.value = extractHeadings()
    if (scrollElement) {
      updateActiveHeading()
    }
  })
})
</script>

<style>
@import 'github-markdown-css/github-markdown.css';

.docs-page {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.left-sidebar {
  width: 250px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #dcdfe6;
  transition: width 0.3s ease;
}

.left-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #dcdfe6;
  min-height: 60px;
}

.sidebar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.collapse-btn {
  flex-shrink: 0;
}

.left-sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 8px;
}

.el-main.markdown-body {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 20px 40px;
  box-sizing: border-box;
}

.el-menu-item.is-active {
  background-color: #ecf5ff;
  color: #409eff;
  font-weight: 500;
}

.el-menu-item:hover {
  background-color: #ecf5ff;
}

.el-sub-menu.is-active>.el-sub-menu__title {
  color: #409eff;
}

.heading-highlight {
  animation: highlightFade 2s ease-in;
  position: relative;
}

@keyframes highlightFade {
  0% {
    background-color: #c9e2ff;
    box-shadow: 0 0 0 8px #c9e2ff;
    border-radius: 4px;
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 8px transparent;
    border-radius: 4px;
  }
}

.toc-sidebar {
  width: 250px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  border-left: 1px solid #dcdfe6;
  background-color: #fafafa;
  transition: width 0.3s ease;
}

.toc-container {
  transition: opacity 0.2s ease, visibility 0s 0s;
  opacity: 1;
  visibility: visible;
  padding: 20px 16px;
  position: sticky;
  top: 0;
  white-space: nowrap; /* Prevent text wrapping during animation */
}

/* Hide TOC on smaller screens with animation */
@media (max-width: 900px) {
  .toc-sidebar {
    width: 0;
    border-left: none;
    padding: 0;
  }
  
  .toc-container {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0s 0.2s; /* Delay visibility change */
  }
}

.toc-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #dcdfe6;
}

.toc-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 4px 0;
}

.toc-item a {
  display: block;
  padding: 4px 8px;
  color: #666;
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.toc-item a:hover {
  color: #409eff;
  background-color: #ecf5ff;
}

.toc-item.active a {
  color: #409eff;
  font-weight: 500;
  background-color: #ecf5ff;
}

.toc-level-1 {
  padding-left: 0;
}

.toc-level-2 {
  padding-left: 0;
}

.toc-level-3 {
  padding-left: 12px;
  font-size: 12px;
}

.toc-level-4 {
  padding-left: 24px;
  font-size: 12px;
}

.toc-level-5,
.toc-level-6 {
  padding-left: 36px;
  font-size: 11px;
}

.toc-empty {
  color: #999;
  font-size: 12px;
  font-style: italic;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 250px;
  min-height: 400px;
}

.el-menu-vertical.el-menu--collapse {
  width: 64px;
}
</style>