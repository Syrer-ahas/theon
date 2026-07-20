(() => {
  const session = window.TacticalAuth?.getSession();
  if (!session) return;
  const style = document.createElement('style');
  style.textContent = `.user-menu-toggle{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:#173259;color:#fff;font:800 .95rem Inter,system-ui,sans-serif;cursor:pointer;overflow:hidden;padding:0}.user-menu-toggle img{width:100%;height:100%;object-fit:cover}.user-menu-panel{position:absolute;right:0;top:calc(100% + 10px);width:236px;padding:10px;border:1px solid rgba(255,255,255,.16);border-radius:20px;background:rgba(16,23,40,.98);box-shadow:0 14px 44px rgba(0,0,0,.45);z-index:12000}.user-menu-identity{display:grid;gap:3px;padding:7px 8px 10px;font:700 .82rem Inter,system-ui,sans-serif}.user-menu-identity span{color:#93a2c1;font-weight:400;overflow:hidden;text-overflow:ellipsis}.user-menu-action{display:block;width:100%;margin:6px 0;padding:10px 12px;border:1px solid transparent;border-radius:14px;text-align:left;text-decoration:none;font:800 .85rem Manrope,Inter,sans-serif;cursor:pointer}.user-menu-blue{background:linear-gradient(180deg,#204f88,#12345f);border-color:rgba(138,190,255,.25);color:#fff}.user-menu-red{background:linear-gradient(180deg,#d9535e,#9e2635);border-color:rgba(255,180,180,.24);color:#fff}.btn-dashboard{background:linear-gradient(180deg,#fae8ff 0%,#f2d3ff 60%);color:#3a1f2b;border:1px solid rgba(80,40,80,0.08);box-shadow:0 8px 22px rgba(80,40,80,0.10);display:inline-flex;align-items:center;justify-content:center;border-radius:22px;padding:10px 20px;font:800 .9rem Manrope,sans-serif;cursor:pointer;text-decoration:none;transition:transform .18s ease,filter .18s ease;white-space:nowrap}.btn-dashboard:hover{transform:translateY(-2px);filter:brightness(1.04)}`;
  document.head.appendChild(style);

  document.querySelectorAll('.nav-actions, .topbar .nav-actions').forEach((actions) => {
    if (actions.querySelector('[data-user-menu]')) return;
    const menu = document.createElement('div');
    menu.dataset.userMenu = '';
    menu.style.cssText = 'position:relative;display:flex;align-items:center;';
    const initial = (session.name || session.email).trim().charAt(0).toUpperCase();
    menu.innerHTML = `
      <button class="user-menu-toggle" type="button" aria-label="Open account menu" aria-expanded="false" title="${session.email}">${session.picture ? `<img src="${session.picture}" alt="" referrerpolicy="no-referrer">` : initial}</button>
      <div class="user-menu-panel" hidden>
        <div class="user-menu-identity"><strong>${session.name}</strong><span>${session.email}</span></div>
        <a class="user-menu-action user-menu-blue" href="account.html">Get Pro</a>
        <a class="user-menu-action user-menu-blue" href="account.html">Account Settings</a>
        <button class="user-menu-action user-menu-red" type="button" data-user-logout>Log out</button>
      </div>`;
    actions.appendChild(menu);
    const toggle = menu.querySelector('.user-menu-toggle');
    const panel = menu.querySelector('.user-menu-panel');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    menu.querySelector('[data-user-logout]').addEventListener('click', () => {
      window.TacticalAuth.clearSession();
      window.location.href = 'index.html';
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
  });
})();
