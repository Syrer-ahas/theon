/**
 * Vercel Speed Insights initialization
 * This script loads and initializes Vercel Speed Insights for performance monitoring
 */

// Initialize the queue before the script loads
window.si = window.si || function () { 
  (window.siq = window.siq || []).push(arguments); 
};

// Load the Speed Insights module from CDN
(function() {
  // For static sites, we use the ESM CDN version
  // The script will automatically track Web Vitals when loaded
  import('https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2.0.0/dist/index.mjs')
    .then(({ injectSpeedInsights }) => {
      // Inject Speed Insights into the page
      injectSpeedInsights({
        // Debug mode - automatically enabled in development
        // debug: false,
        
        // Sample rate - 1.0 means 100% of events are tracked
        // sampleRate: 1.0,
        
        // Framework can be specified if needed
        // framework: 'vanilla'
      });
    })
    .catch((error) => {
      console.error('[Vercel Speed Insights] Failed to load:', error);
    });
})();
