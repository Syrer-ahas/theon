(function() {
    'use strict';

    /* ─── Check if released ─── */
    try {
        if (localStorage.getItem('cdo_released') === 'true') {
            const el = document.getElementById('click-blocker-overlay');
            if (el) el.remove();
            document.documentElement.style.overflow = '';
            return;
        }
    } catch(e) {}

    /* ─── Already blocked? ─── */
    if (document.getElementById('click-blocker-overlay')) return;

    /* ─── Prevent page scroll ─── */
    document.documentElement.style.overflow = 'hidden';

    /* ─── Create an invisible overlay — blocks clicks via CSS only ─── */
    const overlay = document.createElement('div');
    overlay.id = 'click-blocker-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'z-index: 2147483646',
        'background: transparent',
        'cursor: default'
    ].join(';');
    document.body.appendChild(overlay);

    /* ─── Block all events on the overlay, but let countdown through ─── */
    overlay.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    }, true);
    overlay.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
    }, true);
    overlay.addEventListener('mouseup', function(e) {
        e.preventDefault();
        e.stopPropagation();
    }, true);

    /* ─── Bring countdown section above the overlay ─── */
    const cs = document.getElementById('countdown-section');
    if (cs) {
        cs.style.position = 'relative';
        cs.style.zIndex = '2147483647';
    }

    console.log('🔒 Blocked — countdown only.');
})();