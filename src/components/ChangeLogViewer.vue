<template>
  <div class="changelog-content">
    <div class="markdown-body" v-html="html"></div>
  </div>
</template>

<script setup>
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({html: true, typographer: true})

const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
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
  background: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 4px;
}

.changelog-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  background: #fff;
  border-radius: 4px;
}

.changelog-entry {
  margin-bottom: 30px;
}

.divider {
  margin-top: 30px;
  border-bottom: 1px solid var(--el-border-color-lighter);
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
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-5);
}

/* Scoped styling for Markdown content to look nice */
:deep(.markdown-body h1) { font-size: 1.4rem; margin-bottom: 0.5rem; border-bottom: none; }
:deep(.markdown-body h2) { font-size: 1.2rem; margin-top: 1rem; }
:deep(.markdown-body ul) { padding-left: 20px; margin: 10px 0; }
:deep(.markdown-body li) { margin-bottom: 4px; }

:deep(kbd) {
  display: inline-block;       /* Allows them to sit side-by-side */
  vertical-align: top;         /* Aligns them nicely if names vary in length */
  margin: 0 4px 4px 0;         /* Spacing between tiles */
  padding: 8px;
  border: 1px solid #d1d5da;   /* Light grey border */
  border-radius: 6px;
  background-color: #f6f8fa;   /* Very light grey background */
  box-shadow: inset 0 -1px 0 #d1d5da; /* That subtle 3D "key" effect */
  text-align: center;          /* Centers the image and text */
  line-height: 0;              /* Removes extra space around image */
}

/* 2. Reset the link styles inside the kbd so they don't look like text links */
:deep(kbd a) {
  text-decoration: none;
  color: var(--el-text-color-primary); /* Uses your Element Plus text color */
  font-weight: bold;
}

/* 3. Style the username text */
:deep(kbd sub) {
  display: block;              /* Forces it to its own line (safer than relying on <br>) */
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* 4. Ensure images are circular (optional, but looks polished) */
:deep(kbd img) {
  border-radius: 50%;
  display: block;
  margin: 0 auto;              /* Centers image horizontally */
  background-color: #fff;      /* clean background behind transparent pngs */
}
</style>
