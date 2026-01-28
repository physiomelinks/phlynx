export function useGtm() {
  /**
   * Safe method to push to the dataLayer
   * @param {string} eventName - The name of the event (e.g., 'form_submission')
   * @param {Object} payload - Additional data (e.g., { category: 'CellML', label: 'Save' })
   */
  const trackEvent = (eventName, payload = {}) => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...payload,
        timestamp: new Date().toISOString(),
      })
    } else {
      console.log(`[GTM Dev]: ${eventName}`, payload)
    }
  }

  /**
   * Track a page view event.
   * We pass the page title explicitly because it is dynamically set in the router.
   *
   * @param {object} to - The route object representing the new page.
   * @param {string} pageTitle - The title of the page.
   */
  const trackPageView = (to, pageTitle) => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view', // This is the standard GA4 event name
        page_path: to.path,
        // Use the route meta title if available, otherwise document title
        page_title: pageTitle,
        // Optional: meaningful context for your specific app
        page_category: to.path.startsWith('/docs') ? 'Documentation' : to.path.startsWith('/about') ? 'About' : 'Workflow Builder',
      })
    }
  }

  return {
    trackEvent,
    trackPageView,
  }
}
