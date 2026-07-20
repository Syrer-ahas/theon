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

    /* ─── Mark as blocked (marker div, no physical blocking) ─── */
    const marker = document.createElement('div');
    marker.id = 'click-blocker-overlay';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    /* ─── Capture events outside countdown ─── */
    function onlyCountdown(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
    }

    document.addEventListener('click', onlyCountdown, true);
    document.addEventListener('mousedown', onlyCountdown, true);
    document.addEventListener('touchstart', onlyCountdown, { capture: true, passive: false });

    console.log('🔒 Page locked.');
})();