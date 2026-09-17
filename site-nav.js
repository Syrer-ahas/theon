(() => {
  const TRANSITION_STYLE_ID = 'tactical-page-transition-style';

  function installPageTransitions() {
    if (!document.getElementById(TRANSITION_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = TRANSITION_STYLE_ID;
      style.textContent = `
        @keyframes tactical-page-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tactical-page-exit { from { opacity: 1; } to { opacity: 0; } }
        body.tactical-page-enter > * { animation: tactical-page-enter .28s ease-out both; }
        body.tactical-page-exit > * { animation: tactical-page-exit .18s ease-in both; }
        @media (prefers-reduced-motion: reduce) {
          body.tactical-page-enter > *, body.tactical-page-exit > * { animation: none; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.classList.add('tactical-page-enter');
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.hash) return;
      document.body.classList.add('tactical-page-exit');
    }, true);
  }

  installPageTransitions();

  document.querySelectorAll('[data-site-nav]').forEach((nav) => {
    const toggle = nav.querySelector('[data-nav-toggle]');
    const menu = nav.querySelector('[data-nav-menu]');
    if (!toggle || !menu) return;

    const close = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !menu.hidden;
      menu.hidden = isOpen;
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target)) close();
    });
    window.addEventListener('resize', close);
  });
})();
