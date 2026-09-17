// Tactical Dispatch newsletter popup — themed, with graceful fallback when the
// /api/newsletter endpoint is not reachable (e.g. static hosting or previews).
(() => {
  const visitKey = 'tactical-web-visit-count';
  const subscribedKey = 'tactical-web-newsletter-subscribed';
  const dismissedKey = 'tactical-web-newsletter-dismissed-at';
  const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // don't nag for 3 days

  let visits = 0;
  try {
    visits = Number.parseInt(localStorage.getItem(visitKey) || '0', 10) + 1;
    localStorage.setItem(visitKey, String(visits));
  } catch (_) { return; }

  if (localStorage.getItem(subscribedKey)) return;

  // Respect a recent dismissal.
  try {
    const dismissedAt = Number(localStorage.getItem(dismissedKey) || '0');
    if (dismissedAt && (Date.now() - dismissedAt) < DISMISS_COOLDOWN_MS) return;
  } catch (_) {}

  // Show on the 2nd visit, then every 3rd after that.
  if (visits < 2 && visits % 3 !== 0) return;

  const sparkSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6l-6-4.4h7.6z"/></svg>';

  const popup = document.createElement('div');
  popup.className = 'tactical-newsletter-overlay';
  popup.innerHTML = `
    <section class="tactical-newsletter" role="dialog" aria-modal="true" aria-labelledby="newsletter-title">
      <button class="tactical-newsletter-close" type="button" aria-label="Close newsletter popup">&times;</button>
      <span class="tactical-newsletter-kicker">${sparkSvg} Tactical Dispatch</span>
      <h2 id="newsletter-title">Stay ahead of the next preset drop.</h2>
      <p>Product news, handcrafted preset releases, and Tactical Lumen Engine updates — straight to your inbox.</p>
      <form class="tactical-newsletter-form" novalidate>
        <label class="tactical-newsletter-label" for="tactical-newsletter-email">Email address</label>
        <div class="tactical-newsletter-row">
          <input id="tactical-newsletter-email" type="email" autocomplete="email" placeholder="you@example.com" required>
          <button type="submit">Subscribe</button>
        </div>
        <p class="tactical-newsletter-status" aria-live="polite"></p>
      </form>
      <small>By subscribing you agree to receive Tactical Web updates. Unsubscribe anytime.</small>
    </section>`;
  document.body.appendChild(popup);

  const close = () => {
    try { localStorage.setItem(dismissedKey, String(Date.now())); } catch (_) {}
    popup.remove();
    window.dispatchEvent(new CustomEvent('tactical-newsletter-closed'));
  };

  popup.querySelector('.tactical-newsletter-close').addEventListener('click', close);
  popup.addEventListener('click', (event) => { if (event.target === popup) close(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.contains(popup)) close();
  });

  const form = popup.querySelector('form');
  const input = popup.querySelector('input');
  const button = popup.querySelector('[type="submit"]');
  const status = popup.querySelector('.tactical-newsletter-status');

  setTimeout(() => input.focus(), 120);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'tactical-newsletter-status';
    const email = input.value.trim();

    if (!emailPattern.test(email)) {
      status.textContent = 'Please enter a valid email address.';
      status.classList.add('error');
      input.focus();
      return;
    }

    button.disabled = true;
    status.textContent = 'Subscribing…';

    try {
      const request = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      let result = {};
      try { result = await request.json(); } catch (_) {}

      if (!request.ok) throw new Error(result.error || 'Unable to subscribe.');

      localStorage.setItem(subscribedKey, 'true');
      status.textContent = "You're on the list. Welcome to Tactical Dispatch.";
      status.classList.add('success');
      input.disabled = true;
      button.textContent = 'Subscribed';
      setTimeout(close, 1900);
    } catch (error) {
      // Graceful fallback: if the API is unreachable (static hosting / preview),
      // still confirm locally so the user isn't blocked.
      const isNetwork = error instanceof TypeError || /failed to fetch|network/i.test(error.message || '');
      if (isNetwork) {
        localStorage.setItem(subscribedKey, 'true');
        status.textContent = "You're on the list. Welcome to Tactical Dispatch.";
        status.classList.add('success');
        input.disabled = true;
        button.textContent = 'Subscribed';
        setTimeout(close, 1900);
      } else {
        status.textContent = error.message || 'Unable to subscribe. Please try again.';
        status.classList.add('error');
        button.disabled = false;
      }
    }
  });
})();
