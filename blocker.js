(function() {
    'use strict';

    /* ─── Check if released — if so, remove blocker ─── */
    try {
        if (localStorage.getItem('cdo_released') === 'true') {
            const existing = document.getElementById('click-blocker-overlay');
            if (existing) existing.remove();
            return;
        }
    } catch(e) {}

    /* ─── Already blocked? ─── */
    if (document.getElementById('click-blocker-overlay')) return;

    /* ─── Create the blocker overlay ─── */
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
        'cursor: default'
    ].map(s => s + ';').join('');
    document.body.appendChild(overlay);

    /* ─── Block all clicks/touches outside countdown section ─── */
    function blockEvent(e) {
        // Allow clicks inside the countdown section
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) return;
        
        // Allow clicks on the blocker itself (so it doesn't interfere with itself)
        if (e.target === overlay) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }

    // Capture phase — highest priority
    document.addEventListener('click', blockEvent, true);
    document.addEventListener('mousedown', blockEvent, true);
    document.addEventListener('mouseup', blockEvent, true);
    document.addEventListener('touchstart', blockEvent, { capture: true, passive: false });
    document.addEventListener('touchend', blockEvent, { capture: true, passive: false });

    // Block keyboard interactions too
    document.addEventListener('keydown', function(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // Block scrolling of the page behind
    document.addEventListener('scroll', function(e) {
        const cs = document.getElementById('countdown-section');
        if (cs && cs.contains(e.target)) return;
        window.scrollTo(0, 0);
    }, true);

    // Keep page from scrolling back to top — allow only countdown scroll
    let lastScrollY = 0;
    window.addEventListener('scroll', function() {
        const cs = document.getElementById('countdown-section');
        if (!cs) return;
        const rect = cs.getBoundingClientRect();
        // If countdown is still fully visible, block page scroll
        if (rect.top >= 0 && rect.bottom >= window.innerHeight) {
            window.scrollTo(0, 0);
        }
    }, { passive: false });

    console.log('🔒 Click blocker active — countdown must finish first.');
})();