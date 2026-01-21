import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import Markdown from 'unplugin-vue-markdown/vite'
import LinkAttributes from 'markdown-it-link-attributes'
import MarkdownItAttrs from 'markdown-it-attrs'
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isGitHub = process.env.GITHUB_ACTIONS === 'true'

  return {
    base: isGitHub ? '/phlynx/' : '/',
    define: {
      // Create a global constant. Strings must be JSON stringified.
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    optimizeDeps: {
      // Exclude the wasm-based library from pre-bundling
      exclude: ['vue3-libcellml.js'],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    plugins: [
      vue({
        include: [/\.vue$/, /\.md$/],
      }),
      Markdown({
        headEnabled: false, // Set true to manage <head> tags
        markdownItSetup(md) {
          // Enable the attribute syntax
          md.use(MarkdownItAttrs)
          md.use(LinkAttributes, {
            pattern: /^https?:\/\//,
            attrs: {
              target: '_blank',
              rel: 'noopener',
            },
          })
          md.use(MarkdownItGitHubAlerts)
        },
        markdownItOptions: {
          html: true,
          linkify: true,
          typographer: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@docs': path.resolve(__dirname, './docs'),
      },
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        // allow: [
        // "..",
        // ],
      },
    },
  }
})
