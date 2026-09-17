// ==========================================================================
// Tactical Web — Shared Layout
// Injects the app sidebar + topbar, keeps the signed-in user card
// in sync, handles the mobile nav, and gates Account links behind sign-in
// with an animated "NOT SIGNED IN!" popup.
//
// Each page marks its active nav item via <body data-page="generator">.
// ==========================================================================
(function () {
  const TRANSITION_STYLE_ID = 'tactical-page-transition-style';
  const PAGE_LOAD_DELAY = 300;
  let navigationPending = false;

  function ensurePageLoader() {
    let loader = document.getElementById('tacticalPageLoader');
    if (loader) return loader;
    loader = document.createElement('div');
    loader.className = 'tw-page-loader';
    loader.id = 'tacticalPageLoader';
    loader.setAttribute('aria-hidden', 'true');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
      <div class="tw-loader-card">
        <span class="tw-loader-spinner" aria-hidden="true"></span>
        <span class="tw-loader-label">Loading page…</span>
      </div>`;
    document.body.appendChild(loader);
    return loader;
  }

  function navigateWithLoader(href) {
    if (navigationPending) return;
    navigationPending = true;
    const loader = ensurePageLoader();
    loader.classList.add('show');
    loader.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tactical-page-exit');
    window.setTimeout(() => { window.location.href = href; }, PAGE_LOAD_DELAY);
  }

  function installPageTransitions() {
    if (!document.getElementById(TRANSITION_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = TRANSITION_STYLE_ID;
      style.textContent = `
        @keyframes tactical-page-exit { from { opacity: 1; } to { opacity: 0; } }
        @keyframes tactical-loader-spin { to { transform: rotate(360deg); } }
        body.tactical-page-exit > *:not(.tw-page-loader) { animation: tactical-page-exit .2s ease-in both; }
        .tw-page-loader {
          position: fixed; inset: 0; z-index: 30000; display: grid; place-items: center;
          pointer-events: none; opacity: 0; visibility: hidden;
          background: rgba(16, 7, 30, .56);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          transition: opacity .16s ease, visibility .16s ease;
        }
        .tw-page-loader.show { opacity: 1; visibility: visible; pointer-events: auto; }
        .tw-loader-card {
          display: inline-flex; align-items: center; gap: 12px;
          padding: 14px 18px; border-radius: 16px;
          color: #f5edff; background: rgba(35, 18, 56, .94);
          border: 1px solid rgba(192, 132, 252, .3);
          box-shadow: 0 16px 42px rgba(0, 0, 0, .34);
        }
        .tw-loader-spinner {
          width: 20px; height: 20px; flex: 0 0 auto; border-radius: 50%;
          border: 2px solid rgba(216, 180, 254, .25); border-top-color: #d8b4fe;
          animation: tactical-loader-spin .7s linear infinite;
        }
        .tw-loader-label { font: 600 .88rem/1.2 'Inter', sans-serif; }
        @media (prefers-reduced-motion: reduce) {
          body.tactical-page-exit > *:not(.tw-page-loader), .tw-loader-spinner { animation: none; }
        }
      `;
      document.head.appendChild(style);
    }

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (!/^https?:$/.test(destination.protocol) && destination.protocol !== 'file:') return;
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.hash) return;
      if (destination.pathname.endsWith('/account.html') && !getSession()) return;
      event.preventDefault();
      navigateWithLoader(destination.href);
    }, true);

    window.addEventListener('pageshow', () => {
      navigationPending = false;
      document.body.classList.remove('tactical-page-exit');
      const loader = document.getElementById('tacticalPageLoader');
      if (loader) {
        loader.classList.remove('show');
        loader.setAttribute('aria-hidden', 'true');
      }
    });
  }

  installPageTransitions();

  const NAV_ITEMS = [
    { key: 'home', label: 'Home', href: 'index.html' },
    { key: 'generator', label: 'Generator', href: 'generator.html' },
    { key: 'blog', label: 'Blog', href: 'blog.html' },
    { key: 'pro', label: 'Get Pro', href: 'pro.html' },
    { key: 'affiliate', label: 'Affiliate', href: 'affiliate.html' },
    { key: 'account', label: 'Account', href: 'account.html' }
  ];

  const LOCK_SVG = '<img src="images/lock.svg" alt="" />';

  const activePage = (document.body.dataset.page || '').trim();

  window.TacticalAuth = window.TacticalAuth || {};
  window.TacticalPageLoader = { navigate: navigateWithLoader };

  // ---- Build sidebar -----------------------------------------------------
  function navLinksHtml() {
    return NAV_ITEMS.map((item) => {
      const cls = item.key === activePage ? ' class="active"' : '';
      return `<a href="${item.href}"${cls}>${item.label}</a>`;
    }).join('');
  }

  function injectSidebar() {
    if (document.querySelector('.tw-sidebar')) return;
    const aside = document.createElement('aside');
    aside.className = 'tw-sidebar';
    aside.id = 'twSidebar';
    aside.innerHTML = `
      <a class="brand" href="index.html">
        <img src="images/logo.png" alt="Tactical Web logo" />
        <span>Tactical Web</span>
      </a>
      <div class="side-label">Navigate</div>
      <nav class="side-nav">${navLinksHtml()}</nav>
      <div class="side-foot">
        <a class="user-card signed-out" id="userCard" href="account.html">
          <div class="user-avatar" id="userAvatar">?</div>
          <div class="user-meta">
            <span class="user-name" id="userName">Not signed in</span>
            <span class="user-sub"><span class="dot-badge"></span><span id="userStatus">Sign in</span></span>
            <span class="credit-chip" id="userCredits" hidden><span id="userCreditValue">0</span> credits</span>
          </div>
        </a>
      </div>`;
    const page = document.querySelector('.tw-page') || document.body;
    page.insertBefore(aside, page.firstChild);

    if (!document.getElementById('menuToggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'menu-toggle';
      toggle.id = 'menuToggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Open menu');
      toggle.textContent = 'Menu';
      const scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.id = 'scrim';
      document.body.appendChild(toggle);
      document.body.appendChild(scrim);
      toggle.addEventListener('click', () => document.body.classList.toggle('nav-open'));
      scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));
      aside.querySelectorAll('.side-nav a').forEach((a) =>
        a.addEventListener('click', () => document.body.classList.remove('nav-open'))
      );
    }
  }

  // ---- Build topbar actions ---------------------------------------------
  function injectTopbar() {
    if (document.querySelector('[data-site-nav]')) return;
    const topbar = document.querySelector('.tw-topbar');
    if (!topbar) return;

    const nav = document.createElement('div');
    nav.className = 'nav-actions';
    nav.dataset.siteNav = '';
    nav.innerHTML = `
      <div>
        <a class="btn btn-primary" href="generator.html">Start building</a>
        <button class="btn btn-ghost" data-nav-toggle aria-expanded="false" aria-haspopup="true" type="button" style="padding:8px 10px;" aria-label="Menu"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></button>
        <div class="nav-menu" data-nav-menu hidden style="position:absolute; right:0; top:calc(100% + 10px); background:#150826; border:1px solid rgba(168,85,247,.3); border-radius:20px; padding:10px; min-width:200px; box-shadow:0 14px 44px rgba(0,0,0,.55); z-index:12000;">
          <a class="btn btn-ghost" href="blog.html">Blog</a>
          <a class="btn btn-ghost" href="pro.html">Get Pro</a>
          <a class="btn btn-ghost" href="affiliate.html">Become Affiliate</a>
          <a class="btn btn-ghost" href="account.html">Account settings</a>
          <a class="btn btn-ghost" href="https://discord.gg/c2aJ4dBZ4h" target="_blank" rel="noopener">Join Discord</a>
        </div>
      </div>`;
    topbar.appendChild(nav);
    if (!topbar.querySelector('.upgrade-btn')) {
      const up = document.createElement('button');
      up.className = 'upgrade-btn';
      up.type = 'button';
      up.innerHTML = '<span>UPGRADE</span>';
      up.addEventListener('click', () => { navigateWithLoader('pro.html'); });
      topbar.appendChild(up);
    }
  }

  // ---- User card ---------------------------------------------------------
  function getSession() {
    try {
      return window.TacticalAuth && window.TacticalAuth.getSession ? window.TacticalAuth.getSession() : null;
    } catch (_) { return null; }
  }

  function renderUser() {
    const card = document.getElementById('userCard');
    if (!card) return;
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const statusEl = document.getElementById('userStatus');
    const creditsChip = document.getElementById('userCredits');
    const creditValue = document.getElementById('userCreditValue');

    const session = getSession();
    if (session) {
      card.classList.remove('signed-out');
      const displayName = session.name || session.email || 'User';
      nameEl.textContent = displayName;
      statusEl.textContent = session.email || 'Signed in';
      if (session.picture) {
        avatarEl.textContent = '';
        avatarEl.style.backgroundImage = 'url("' + session.picture + '")';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = displayName.trim().charAt(0).toUpperCase() || '?';
      }
      let credits = null;
      try {
        const stored = localStorage.getItem('tactical-web-credits');
        if (stored !== null && stored !== '') {
          const n = Number(stored);
          if (!Number.isNaN(n) && n >= 0) credits = n;
        }
      } catch (_) {}
      if (credits == null && session.credits != null) credits = Number(session.credits);
      if (credits != null) {
        creditValue.textContent = Number(credits).toLocaleString(undefined, { maximumFractionDigits: 2 });
        creditsChip.hidden = false;
      } else {
        creditsChip.hidden = true;
      }
    } else {
      card.classList.add('signed-out');
      nameEl.textContent = 'Not signed in';
      statusEl.textContent = 'Sign in';
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = '?';
      creditsChip.hidden = true;
    }
  }

  // ---- "NOT SIGNED IN!" popup -------------------------------------------
  let modal = null;
  let sparks = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'ns-overlay';
    modal.id = 'notSignedInModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'nsTitle');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="ns-card">
        <div class="ns-sparks" id="nsSparks"></div>
        <div class="ns-icon" aria-hidden="true">${LOCK_SVG}</div>
        <h2 class="ns-title" id="nsTitle">NOT SIGNED IN!</h2>
        <p class="ns-text">You need an account to view this page. Sign in with Google to continue.</p>
        <p class="ns-auth-error" id="nsAuthError" role="alert" hidden></p>
        <div class="ns-actions">
          <button class="ns-btn ns-btn-primary" id="nsSignInBtn" type="button">Sign in with Google</button>
          <button class="ns-btn ns-btn-ghost" id="nsDismissBtn" type="button">Maybe later</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    sparks = modal.querySelector('#nsSparks');
    buildSparks();

    const dismiss = modal.querySelector('#nsDismissBtn');
    const signInBtn = modal.querySelector('#nsSignInBtn');
    const authError = modal.querySelector('#nsAuthError');
    dismiss.addEventListener('click', closeModal);
    signInBtn.addEventListener('click', async () => {
      if (!window.TacticalSignIn || !window.TacticalSignIn.signInWithGoogle) {
        navigateWithLoader('account.html');
        return;
      }
      signInBtn.disabled = true;
      authError.hidden = true;
      authError.textContent = '';
      const original = signInBtn.textContent;
      signInBtn.textContent = 'Signing in...';
      try {
        await window.TacticalSignIn.signInWithGoogle();
        closeModal();
        navigateWithLoader('account.html');
      } catch (err) {
        signInBtn.disabled = false;
        signInBtn.textContent = original;
        authError.textContent = err && err.message ? err.message : 'Google sign-in could not be completed. Please try again.';
        authError.hidden = false;
        console.warn('Sign-in failed:', err && err.message ? err.message : err);
      }
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });
    return modal;
  }

  function buildSparks() {
    if (!sparks || sparks.dataset.built) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'ns-spark';
      s.style.left = Math.random() * 100 + '%';
      s.style.bottom = (Math.random() * 30) + '%';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      s.style.animationDuration = (3 + Math.random() * 2.5).toFixed(2) + 's';
      s.style.transform = 'scale(' + (0.6 + Math.random()).toFixed(2) + ')';
      sparks.appendChild(s);
    }
    sparks.dataset.built = '1';
  }

  function openModal() {
    const m = ensureModal();
    m.classList.add('show');
    m.setAttribute('aria-hidden', 'false');
    const card = m.querySelector('.ns-card');
    const title = m.querySelector('.ns-title');
    if (card) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
    if (title) { title.style.animation = 'none'; void title.offsetWidth; title.style.animation = ''; }
    const signInBtn = m.querySelector('#nsSignInBtn');
    if (signInBtn) signInBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function guardAccountLinks() {
    document.addEventListener('click', (e) => {
      if (getSession()) return;
      const target = e.target.closest && e.target.closest('a[href="account.html"], #userCard, .side-nav a[href$="account.html"], .nav-menu a[href$="account.html"]');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('nav-open');
        openModal();
      }
    }, true);
  }

  // ---- Boot --------------------------------------------------------------
  function boot() {
    document.body.classList.add('tw-body');
    if (!document.querySelector('.tw-page')) {
      const page = document.createElement('div');
      page.className = 'tw-page';
      while (document.body.firstChild) page.appendChild(document.body.firstChild);
      document.body.appendChild(page);
    }
    injectSidebar();
    injectTopbar();
    renderUser();
    guardAccountLinks();

    document.addEventListener('tactical-auth-changed', renderUser);
    window.addEventListener('storage', (e) => {
      if (e.key === 'tactical-web-google-session' || e.key === 'tactical-web-credits') renderUser();
    });
    const topbar = document.querySelector('.tw-topbar');
    if (topbar && window.MutationObserver) {
      new MutationObserver(renderUser).observe(topbar, { childList: true, subtree: true });
    }
    window.addEventListener('tw-credits-changed', renderUser);
    window.dispatchEvent(new CustomEvent('tw-nav-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
