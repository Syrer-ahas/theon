(() => {
  const visitKey = 'tactical-web-visit-count';
  const subscribedKey = 'tactical-web-newsletter-subscribed';
  const visits = Number.parseInt(localStorage.getItem(visitKey) || '0', 10) + 1;
  localStorage.setItem(visitKey, String(visits));

  // Show on visits 3, 6, 9, etc. Once subscribed, the popup never returns.
  if (localStorage.getItem(subscribedKey) || visits % 3 !== 0) return;

  const turnstileConfig = window.TACTICAL_TURNSTILE_CONFIG || {};
  const siteKey = turnstileConfig.siteKey || '';

  const popup = document.createElement('div');
  popup.className = 'tactical-newsletter-overlay';
  popup.innerHTML = `
    <section class="tactical-newsletter" role="dialog" aria-modal="true" aria-labelledby="newsletter-title">
      <button class="tactical-newsletter-close" type="button" aria-label="Close newsletter popup">×</button>
      <span class="tactical-newsletter-kicker">✦ TACTICAL DISPATCH</span>
      <h2 id="newsletter-title">Stay ahead of the next preset drop.</h2>
      <p>Get product news, Website Updates, Sales on Subscriptions. </p>
      <form class="tactical-newsletter-form">
        <label class="tactical-newsletter-label" for="tactical-newsletter-email">Email address</label>
        <div class="tactical-newsletter-row"><input id="tactical-newsletter-email" type="email" autocomplete="email" placeholder="you@example.com" required><button type="submit">Subscribe</button></div>
        <div id="turnstile-widget" style="margin-top: 12px;"></div>
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

  // Render Turnstile widget
  let turnstileWidgetId = null;
  if (siteKey && typeof turnstile !== 'undefined') {
    const widgetContainer = document.getElementById('turnstile-widget');
    turnstileWidgetId = turnstile.render(widgetContainer, {
      sitekey: siteKey,
      theme: 'dark'
    });
  }

  const form = popup.querySelector('form');
  const input = popup.querySelector('input');
  const button = popup.querySelector('[type="submit"]');
  const status = popup.querySelector('.tactical-newsletter-status');
  setTimeout(() => input.focus(), 100);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Subscribing…';

    // Get Turnstile token
    let turnstileToken = null;
    if (turnstileWidgetId && typeof turnstile !== 'undefined') {
      turnstileToken = turnstile.getResponse(turnstileWidgetId);
      if (!turnstileToken) {
        status.textContent = 'Please complete the security check.';
        button.disabled = false;
        return;
      }
    }

    try {
      const request = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input.value,
          turnstileToken: turnstileToken
        })
      });
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
      // Reset Turnstile widget so user can try again
      if (turnstileWidgetId && typeof turnstile !== 'undefined') {
        turnstile.reset(turnstileWidgetId);
      }
    }
  });
})();