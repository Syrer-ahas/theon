(function() {
    'use strict';

    /* ─── Check if released — if so, remove blocker ─── */
    try {
        if (localStorage.getItem('cdo_released') === 'true') {
            const existing = document.getElementById('click-blocker-overlay');
            if (existing) existing.remove();
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            return;
        }
    } catch(e) {}

    /* ─── Already blocked? ─── */
    if (document.getElementById('click-blocker-overlay')) return;

    /* ─── Lock page scroll completely ─── */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.bottom = '0';

    /* ─── Create the blocker overlay (transparent — just visual barrier) ─── */
    const overlay = document.createElement('div');
    overlay.id = 'click-blocker-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'z-index: 2147483647',
        'background: transparent',
        'pointer-events: none',
        'cursor: default'
    ].map(s => s + ';').join('');
    document.body.appendChild(overlay);

    /* ─── Block all clicks/touches outside countdown section ─── */
    // Uses capture phase (fires before event reaches target)
    function blockEvent(e) {
        const cs = document.getElementById('countdown-section');
        // Allow clicks inside the countdown section (hype button, etc.)
        if (cs && cs.contains(e.target)) return;
        // Block everything else
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }

    document.addEventListener('click', blockEvent, true);
    document.addEventListener('mousedown', blockEvent, true);
    document.addEventListener('mouseup', blockEvent, true);
    document.addEventListener('touchstart', blockEvent, { capture: true, passive: false });
    document.addEventListener('touchend', blockEvent, { capture: true, passive: false });

    document.addEventListener('keydown', function(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // Prevent wheel/scroll
    document.addEventListener('wheel', function(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) {
            // Allow scroll inside countdown if it overflows
            const rect = cs.getBoundingClientRect();
            if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
                e.preventDefault();
                return;
            }
            return;
        }
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) {
            const rect = cs.getBoundingClientRect();
            if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
                e.preventDefault();
                return;
            }
            return;
        }
        e.preventDefault();
    }, { passive: false });

    console.log('🔒 Page locked — countdown must finish first.');
})();
