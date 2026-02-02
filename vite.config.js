import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import Markdown from 'unplugin-vue-markdown/vite'
import LinkAttributes from 'markdown-it-link-attributes'
import MarkdownItAttrs from 'markdown-it-attrs'
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts'
import packageJson from './package.json'
import { execSync } from 'child_process'

const getVersionSuffix = () => {
  let isTagged = false

  try {
    // Check if the current HEAD is exactly at a tag that matches the version in package.json.
    // If this throws an error, we are NOT at a tag. If the tag does not match, we are also NOT tagged.
    const ans = execSync('git describe --exact-match --tags HEAD')
    if (ans.toString().trim() === `v${packageJson.version}`) {
      isTagged = true
    }
  } catch (e) {
    // If any git describe fails, we are not tagged.
    isTagged = false
  }

  // Add the asterisk if not tagged.
  const suffix = isTagged ? '' : '*'

  return suffix
}

const versionSuffix = getVersionSuffix()

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Create a global constant. Strings must be JSON stringified.
    __APP_VERSION__: JSON.stringify(packageJson.version + versionSuffix),
    __COMMIT_HASH__: JSON.stringify(execSync('git rev-parse --short HEAD').toString().trim()),
    __BRANCH__: JSON.stringify(execSync('git rev-parse --abbrev-ref HEAD').toString().trim()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
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
})
