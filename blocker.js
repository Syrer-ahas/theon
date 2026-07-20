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

    /* ─── Mark as blocked ─── */
    const marker = document.createElement('div');
    marker.id = 'click-blocker-overlay';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    console.log('🔒 Page locked.');
})();