// Topbar account menu — reactive to sign-in / sign-out across the whole site.
// Injects a user avatar button into every [data-site-nav] / .nav-actions
// container and removes it again on sign-out, without a page reload.
(() => {
  const STYLE_ID = 'tactical-auth-ui-style';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .user-menu-toggle{border:1px solid rgba(192,132,252,.4);background:linear-gradient(180deg,#c084fc,#7c3aed);color:#fff;font:800 .95rem Inter,system-ui,sans-serif;cursor:pointer;overflow:hidden;padding:0;width:42px;height:42px;border-radius:50%;box-shadow:0 6px 18px rgba(124,58,237,.4);flex-shrink:0}
      .user-menu-toggle img{width:100%;height:100%;object-fit:cover}
      .user-menu-panel{position:absolute;right:0;top:calc(100% + 10px);width:240px;padding:10px;border:1px solid rgba(168,85,247,.3);border-radius:20px;background:#150826;box-shadow:0 14px 44px rgba(0,0,0,.55);z-index:12000}
      .user-menu-identity{display:grid;gap:3px;padding:8px 10px 10px;font:700 .85rem Inter,system-ui,sans-serif;color:#f3ecff}
      .user-menu-identity span{color:#b39dd8;font-weight:400;overflow:hidden;text-overflow:ellipsis}
      .user-menu-action{display:block;width:100%;margin:6px 0;padding:10px 12px;border:1px solid transparent;border-radius:14px;text-align:left;text-decoration:none;font:700 .85rem Inter,system-ui,sans-serif;cursor:pointer}
      .user-menu-blue{background:rgba(168,85,247,.14);border-color:rgba(192,132,252,.3);color:#e9d5ff}
      .user-menu-blue:hover{background:rgba(168,85,247,.24)}
      .user-menu-red{background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.28);color:#fecaca}
      .user-menu-red:hover{background:rgba(248,113,113,.2)}
      .btn-dashboard{background:linear-gradient(135deg,#c084fc,#7c3aed);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 22px rgba(124,58,237,.4);display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 20px;font:700 .88rem Inter,sans-serif;cursor:pointer;text-decoration:none;transition:transform .18s ease,filter .18s ease;white-space:nowrap}
      .btn-dashboard:hover{transform:translateY(-2px);filter:brightness(1.06)}`;
    document.head.appendChild(style);
  }

  function getSession() {
    try { return window.TacticalAuth?.getSession?.() || null; } catch (_) { return null; }
  }

  function navContainers() {
    return Array.from(document.querySelectorAll('[data-site-nav], .nav-actions, .topbar .nav-actions, .tw-topbar .nav-actions'));
  }

  function removeMenus() {
    document.querySelectorAll('[data-user-menu]').forEach((m) => m.remove());
    document.querySelectorAll('[data-admin-dashboard]').forEach((d) => d.remove());
  }

  function buildMenu(session) {
    const menu = document.createElement('div');
    menu.dataset.userMenu = '';
    menu.style.cssText = 'position:relative;display:flex;align-items:center;';
    const initial = (session.name || session.email || '?').trim().charAt(0).toUpperCase();
    const avatarInner = session.picture
      ? `<img src="${session.picture}" alt="" referrerpolicy="no-referrer">`
      : initial;
    menu.innerHTML = `
      <button class="user-menu-toggle" type="button" aria-label="Open account menu" aria-expanded="false" title="${session.email}">${avatarInner}</button>
      <div class="user-menu-panel" hidden>
        <div class="user-menu-identity"><strong>${session.name || 'User'}</strong><span>${session.email}</span></div>
        <a class="user-menu-action user-menu-blue" href="account.html">Account settings</a>
        <a class="user-menu-action user-menu-blue" href="pro.html">Get Pro</a>
        <button class="user-menu-action user-menu-red" type="button" data-user-logout>Log out</button>
      </div>`;
    const toggle = menu.querySelector('.user-menu-toggle');
    const panel = menu.querySelector('.user-menu-panel');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    menu.querySelector('[data-user-logout]').addEventListener('click', () => {
      window.TacticalAuth.clearSession();
      // clearSession dispatches tactical-auth-changed; render() will teardown.
      window.location.href = 'index.html';
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
    return menu;
  }

  function render() {
    ensureStyles();
    const session = getSession();
    removeMenus();
    if (!session) return;

    const containers = navContainers();
    if (!containers.length) return;

    containers.forEach((actions) => {
      actions.appendChild(buildMenu(session));
      if (session.email === 'alkhidirea@gmail.com' && !actions.querySelector('[data-admin-dashboard]')) {
        const dash = document.createElement('a');
        dash.className = 'btn-dashboard';
        dash.href = 'dashboard.html';
        dash.textContent = 'Dashboard';
        dash.dataset.adminDashboard = '';
        dash.style.marginRight = '4px';
        actions.insertBefore(dash, actions.firstChild);
      }
    });
  }

  function boot() {
    render();
    document.addEventListener('tactical-auth-changed', render);
    window.addEventListener('storage', (e) => {
      if (e.key === 'tactical-web-google-session') render();
    });
    // The layout injects nav containers asynchronously; re-render when it says so.
    window.addEventListener('tw-nav-ready', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
