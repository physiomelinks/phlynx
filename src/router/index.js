import { createRouter, createWebHistory } from 'vue-router'
import { useGtm } from '../composables/useGtm'

import BuilderView from '../views/BuilderView.vue'
import AboutView from '../views/AboutView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const { trackPageView } = useGtm()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'builder',
      component: BuilderView,
      meta: { title: 'Workflow Builder' },
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
      meta: { title: 'About' },
    },
    {
      path: '/docs/',
      redirect: '/docs/getting-started/introduction',
      meta: { title: 'Introduction' },
    },
    {
      path: '/docs/:slug(.*)*',
      name: 'docs',
      component: () => import('../views/DocsView.vue'),
      meta: {
        title: (route) => {
          const slug = route.params.slug

          // Fallback if visiting /docs/ root
          if (!slug || slug.length === 0) return 'Documentation'

          // Convert "my-category/setup-guide" to "Setup Guide - My Category".
          return formatSlug(slug)
        },
      },
    },
    {
      path: '/:pathMatch(.*)',
      name: 'not-found',
      component: NotFoundView,
      meta: { title: '404 Not Found' },
    },
  ],
})

function formatSlug(slug) {
  // Make sure slug is an array.
  const slugArray = Array.isArray(slug) ? slug : [slug]

  // Split by '/' and '-', capitalize words, and join back.
  return slugArray
    .map((part) => {
      return (
        part
          // Replace hyphens/underscores with spaces.
          .replace(/[-_]/g, ' ')
          // Capitalize the first letter of EVERY word.
          // \b matches a "word boundary" (start of string or after a space).
          .replace(/\b\w/g, (char) => char.toUpperCase())
      )
    })
    .join(' | ')
}

router.afterEach((to) => {
  let pageTitle = ''

  if (typeof to.meta.title === 'function') {
    pageTitle = to.meta.title(to)
  } else {
    pageTitle = to.meta.title
  }

  document.title = pageTitle ? `${pageTitle} - PhLynx` : 'PhLynx'

  setTimeout(() => {
    trackPageView(to, pageTitle)
  }, 100)
})

export default router
