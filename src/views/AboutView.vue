<script setup>
import { ref, computed } from 'vue'
import ChangelogViewer from '../components/ChangeLogViewer.vue'

const activeTab = ref('overview')

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev'
const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'N/A'
const branch = typeof __BRANCH__ !== 'undefined' ? __BRANCH__ : 'N/A'
const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString()

const formattedDate = computed(() => {
  if (buildDate === 'N/A') return 'Unknown'
  return new Date(buildDate).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
})

const commitUrl = computed(() => `https://github.com/physiomelinks/phlynx/commit/${commitHash}`)
</script>

<template>
  <el-scrollbar native>
    <div class="about-wrapper">
      <transition name="fade-slide" appear>
        <div class="image-container">
          <img src="/phlynxlogo.svg" alt="PhLynx Logo" class="centred-image" />
        </div>
      </transition>

      <transition name="fade-slide-delayed" appear>
        <el-container class="about-page">
          <el-main>
            <el-tabs v-model="activeTab" class="about-tabs" stretch>
              <el-tab-pane label="Overview" name="overview">
                <div class="tab-content">
                  <h1>About Physiome Links</h1>
                  <p class="intro-text">
                    <strong>Physiome Links (or PhLynx)</strong> is a specialised tool to streamline the coupling and
                    editing of models written in CellML.
                  </p>

                  <el-divider />

                  <h3>The Workflow</h3>
                  <p>
                    This application serves as the visual frontend for the
                    <strong>Circulatory Autogen</strong> project. It allows users to:
                  </p>
                  <ul>
                    <li>Visually connect independent CellML modules.</li>
                    <li>Construct cohesive system representations.</li>
                    <li>
                      Generate configuration files ready for parameter identification to calibrate to clinical data.
                    </li>
                  </ul>

                  <p>
                    For more information on the science and methodology behind the broader project, please visit the
                    <el-link type="primary" href="https://physiomelinks.github.io/circulatory_autogen/" target="_blank">
                      Circulatory Autogen website</el-link
                    >.
                  </p>

                  <el-divider />

                  <h3>Credits & Support</h3>
                  <p>
                    <strong>Developed by: </strong>
                    <el-link type="primary" href="https://github.com/jmdowrick" target="_blank">Jarrah Dowrick</el-link
                    >,
                    <el-link type="primary" href="https://github.com/finbarargus" target="_blank">Finbar Argus</el-link
                    >, &
                    <el-link type="primary" href="https://github.com/hsorby" target="_blank">Hugh Sorby</el-link>
                  </p>
                  <p>
                    For reporting bugs or requesting features, please visit our
                    <el-link type="primary" href="https://github.com/physiomelinks/phlynx" target="_blank">
                      GitHub Repository </el-link
                    >.
                  </p>

                  <el-divider />

                  <h3>License</h3>
                  <p>This project is licensed under the Apache License, Version 2.0.</p>
                </div>
              </el-tab-pane>

              <el-tab-pane label="Release Notes" name="changelog">
                <div class="tab-content">
                  <ChangelogViewer />
                </div>
              </el-tab-pane>
            </el-tabs>

            <div class="build-info-footer">
              <div class="version-badge">v{{ appVersion }}</div>

              <div class="info-row">
                <span
                  >Branch: <strong>{{ branch }}</strong></span
                >
                <span class="divider">•</span>
                <span>
                  Commit:
                  <a :href="commitUrl" target="_blank" rel="noopener" class="commit-link">
                    {{ commitHash }}
                  </a>
                </span>
              </div>

              <div class="info-row timestamp">Built: {{ formattedDate }}</div>
            </div>
          </el-main>
        </el-container>
      </transition>
    </div>
  </el-scrollbar>
</template>

<style scoped>
/* --- Transitions --- */
.fade-slide-enter-from {
  transform: translateY(-8px);
}
.fade-slide-delayed-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}
.fade-slide-enter-to,
.fade-slide-delayed-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.fade-slide-enter-active {
  transition: opacity 0.45s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.45s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-slide-delayed-enter-active {
  transition: opacity 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
  transition-delay: 0.15s;
}

/* --- Layout --- */
.image-container {
  margin-top: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.centred-image {
  max-width: 250px;
  height: auto;
}

.about-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px 40px 20px;
  line-height: 1.6;
}

/* --- Content Styling --- */
.intro-text {
  font-size: 1.1rem;
  color: #555;
}
.el-link {
  font-size: 1rem;
}
h1 {
  margin-bottom: 20px;
  text-align: center;
}
h3 {
  margin-top: 30px;
  margin-bottom: 10px;
}
ul {
  margin-bottom: 20px;
  padding-left: 20px;
}
li {
  margin-bottom: 8px;
}

.build-info-footer {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  text-align: center;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
}

.version-badge {
  display: inline-block;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: bold;
  margin-bottom: 10px;
}

.info-row {
  margin-bottom: 4px;
}

.divider {
  margin: 0 8px;
  color: var(--el-border-color);
}

.commit-link {
  color: var(--el-text-color-secondary);
  text-decoration: underline;
  transition: color 0.2s;
}

.commit-link:hover {
  color: var(--el-color-primary);
}

/* --- Tab Adjustments --- */
.about-tabs {
  margin-top: 20px;
}
.tab-content {
  padding: 10px 0;
}
</style>
