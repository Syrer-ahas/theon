(function() {
    'use strict';

    /* ─── Check if released ─── */
    try {
        if (localStorage.getItem('cdo_released') === 'true') {
            document.documentElement.style.overflow = '';
            return;
        }
    } catch(e) {}

    /* ─── Already blocked? ─── */
    if (document.getElementById('click-blocker-overlay')) return;

    /* ─── Lock scroll ─── */
    document.documentElement.style.overflow = 'hidden';

    /* ─── Create a transparent overlay to eat clicks below countdown ─── */
    const overlay = document.createElement('div');
    overlay.id = 'click-blocker-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;background:transparent';
    document.body.appendChild(overlay);
    // Block all clicks on the overlay itself
    overlay.addEventListener('click', function(e) { e.stopPropagation(); e.preventDefault(); }, true);
    overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); e.preventDefault(); }, true);

    /* ─── Countdown section already has z-index 2147483647 (set by countdown.js), so it sits above the overlay ─── */

    console.log('🔒 Page locked.');
})();