<template>
  <div class="changelog-content">
    <div class="markdown-body" v-html="html"></div>
  </div>
</template>

<script setup>
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({html: true, typographer: true})

const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

// Override link_open renderer to add target="_blank" to all links.
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  // Add target="_blank"
  tokens[idx].attrSet('target', '_blank');
  
  // Add rel="noopener noreferrer" for security
  tokens[idx].attrSet('rel', 'noopener noreferrer');

  // Pass token to default renderer.
  return defaultRender(tokens, idx, options, env, self);
};

const changelog = import.meta.glob('../../docs/reference/change-log.md', { 
  query: '?raw', 
  eager: true,
  import: 'default' 
})

const html = md.render(changelog['../../docs/reference/change-log.md'])
</script>

<style scoped>
.changelog-container {
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
  background-color: var(--p-content-background, var(--surface-card, #ffffff));
  border: none; 
  border-radius: 4px;
}

.changelog-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  background-color: var(--p-content-background, var(--surface-card, #ffffff));
  border: none;
  border-radius: 4px;
  color: var(--p-text-color, var(--text-color, #1f2937));
}

.changelog-entry {
  margin-bottom: 30px;
}

.divider {
  margin-top: 30px;
  border-bottom: 1px solid var(--p-content-border-color, var(--surface-border, #e5e7eb));
}

.version-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.8rem;
  margin-bottom: 10px;
}

.version-badge.latest {
  background-color: color-mix(in srgb, var(--p-warn-color, var(--warning-color, #f59e0b)) 15%, transparent);
  color: var(--p-warn-color, var(--warning-color, #f59e0b));
  border: 1px solid color-mix(in srgb, var(--p-warn-color, var(--warning-color, #f59e0b)) 35%, transparent);
}

/* Scoped styling for Markdown content */
:deep(.markdown-body) {
  color: var(--p-text-color, var(--text-color, #1f2937));
}

:deep(.markdown-body h1) { font-size: 1.4rem; margin-bottom: 0.5rem; border-bottom: none; }
:deep(.markdown-body h2) { font-size: 1.2rem; margin-top: 1rem; }
:deep(.markdown-body ul) { padding-left: 20px; margin: 10px 0; }
:deep(.markdown-body li) { margin-bottom: 4px; }

:deep(.markdown-body a) {
  color: var(--p-primary-color, var(--primary-color, #3b82f6));
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

/* Key tiles (kbd) styled with adaptive surfaces */
:deep(kbd) {
  display: inline-block;
  vertical-align: top;
  margin: 0 4px 4px 0;
  padding: 8px;
  border: 1px solid var(--p-content-border-color, var(--surface-border, #e5e7eb));
  border-radius: 6px;
  background-color: var(--p-surface-100, var(--surface-100, #f3f4f6));
  box-shadow: inset 0 -1px 0 var(--p-content-border-color, var(--surface-border, #e5e7eb));
  text-align: center;
  line-height: 0;
}

:deep(kbd a) {
  text-decoration: none;
  color: var(--p-text-color, var(--text-color, #1f2937));
  font-weight: bold;
}

:deep(kbd sub) {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color, var(--text-color-secondary, #6b7280));
}

:deep(kbd img) {
  border-radius: 50%;
  display: block;
  margin: 0 auto;
  background-color: var(--p-content-background, var(--surface-card, #ffffff));
}
</style>
