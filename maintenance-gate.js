// TEMPORARY SITE-WIDE MAINTENANCE GATE
// Remove this file and its <script> tags when the site is ready to reopen.
(() => {
  const maintenanceUrl = new URL('503.html', window.location.href);
  if (window.location.href === maintenanceUrl.href) return;

  // Hide the underlying page so protected content never flashes before the
  // redirect. location.replace also prevents Back from bypassing the gate.
  document.documentElement.style.background = '#140b22';
  document.documentElement.style.visibility = 'hidden';
  window.location.replace(maintenanceUrl.href);
})();
