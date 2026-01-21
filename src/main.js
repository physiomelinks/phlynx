import { createApp } from "vue"
import { createPinia } from "pinia"
import ElementPlus from "element-plus"
import libcellmlPlugin from "vue3-libcellml.js"

import "element-plus/dist/index.css"
import "@vue-flow/core/dist/style.css"
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import 'markdown-it-github-alerts/styles/github-colors-light.css'
import 'markdown-it-github-alerts/styles/github-colors-dark-class.css'
import 'markdown-it-github-alerts/styles/github-base.css'

import "./assets/main.css"

import router from "./router"
import App from "./App.vue"

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.use(libcellmlPlugin)
app.mount("#app")
