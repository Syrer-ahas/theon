(() => {
  const visitKey = 'tactical-web-visit-count';
  const subscribedKey = 'tactical-web-newsletter-subscribed';
  const verifiedKey = 'tactical-web-turnstile-verified';
  const visits = Number.parseInt(localStorage.getItem(visitKey) || '0', 10) + 1;
  localStorage.setItem(visitKey, String(visits));

  const turnstileConfig = window.TACTICAL_TURNSTILE_CONFIG || {};
  const siteKey = turnstileConfig.siteKey || '';

  // --- One-time Turnstile verification on 1st visit ---
  if (visits === 1 && siteKey && !localStorage.getItem(verifiedKey)) {
    const overlay = document.createElement('div');
    overlay.className = 'tactical-newsletter-overlay';
    overlay.innerHTML = `
      <section class="tactical-newsletter" role="dialog" aria-modal="true" aria-labelledby="verify-title" style="text-align:center;">
        <h2 id="verify-title" style="margin:0 0 8px;">Verify you're human</h2>
        <p style="margin:0 0 16px;color:#aeb9d5;line-height:1.65;">Complete the security check to continue.</p>
        <div id="turnstile-verify-widget" style="display:flex;justify-content:center;margin-bottom:12px;"></div>
        <p id="turnstile-verify-status" style="font-size:.86rem;min-height:22px;color:#aeb9d5;"></p>
      </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay && localStorage.getItem(verifiedKey)) overlay.remove(); });

    const statusEl = overlay.querySelector('#turnstile-verify-status');
    const callback = (token) => {
      if (token) {
        localStorage.setItem(verifiedKey, 'true');
        statusEl.textContent = 'Verified ✓';
        setTimeout(() => overlay.remove(), 600);
      }
    };
    // Render Turnstile
    setTimeout(() => {
      const container = document.getElementById('turnstile-verify-widget');
      if (container && typeof turnstile !== 'undefined') {
        turnstile.render(container, { sitekey: siteKey, theme: 'dark', callback });
      } else {
        statusEl.textContent = 'Security check unavailable — skipping.';
        setTimeout(() => overlay.remove(), 1200);
      }
    }, 200);
    return; // Stop here — newsletter popup won't show on 1st visit
  }

  // --- Newsletter popup (visits 3, 6, 9...) ---
  if (localStorage.getItem(subscribedKey) || visits % 3 !== 0) return;

  const popup = document.createElement('div');
  popup.className = 'tactical-newsletter-overlay';
  popup.innerHTML = `
    <section class="tactical-newsletter" role="dialog" aria-modal="true" aria-labelledby="newsletter-title">
      <button class="tactical-newsletter-close" type="button" aria-label="Close newsletter popup">×</button>
      <span class="tactical-newsletter-kicker">✦ TACTICAL DISPATCH</span>
      <h2 id="newsletter-title">Stay ahead of the next preset drop.</h2>
      <p>Get product news, handcrafted preset releases, and Tactical Lumen Engine updates in your inbox.</p>
      <form class="tactical-newsletter-form">
        <label class="tactical-newsletter-label" for="tactical-newsletter-email">Email address</label>
        <div class="tactical-newsletter-row"><input id="tactical-newsletter-email" type="email" autocomplete="email" placeholder="you@example.com" required><button type="submit">Subscribe</button></div>
        <p class="tactical-newsletter-status" aria-live="polite"></p>
      </form>
      <small>By subscribing, you agree to receive Tactical Web updates. Unsubscribe anytime.</small>
    </section>`;
  document.body.appendChild(popup);
  const dialog = popup.querySelector('.tactical-newsletter');
  const close = () => popup.remove();
  popup.querySelector('.tactical-newsletter-close').addEventListener('click', close);
  popup.addEventListener('click', event => { if (event.target === popup) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.contains(popup)) close(); });

  const form = popup.querySelector('form');
  const input = popup.querySelector('input');
  const button = popup.querySelector('[type="submit"]');
  const status = popup.querySelector('.tactical-newsletter-status');
  setTimeout(() => input.focus(), 100);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Subscribing…';
    try {
      const request = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: input.value }) });
      const result = await request.json();
      if (!request.ok) throw new Error(result.error || 'Unable to subscribe.');
      localStorage.setItem(subscribedKey, 'true');
      status.textContent = 'You\'re on the list. Welcome to Tactical Dispatch.';
      input.disabled = true;
      button.textContent = 'Subscribed';
      setTimeout(close, 1800);
    } catch (error) {
      status.textContent = error.message || 'Unable to subscribe. Please try again.';
      button.disabled = false;
    }
  });
})();