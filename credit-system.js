// Tactical Web credit controller.
// The server is authoritative; browser storage is never used as a balance.
(function () {
  'use strict';

  const state = { credits: 0, authenticated: false, loading: false, nextDailyAt: 0 };
  let syncPromise = null;

  try { localStorage.removeItem('tactical-web-credits'); } catch (_) {}

  function sessionToken() {
    try {
      return window.TacticalSignIn && window.TacticalSignIn.getSessionToken
        ? window.TacticalSignIn.getSessionToken()
        : null;
    } catch (_) {
      return null;
    }
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('tw-credits-changed', { detail: getSnapshot() }));
  }

  function setAnonymous() {
    state.credits = 0;
    state.authenticated = false;
    state.loading = false;
    state.nextDailyAt = 0;
    emit();
    return getSnapshot();
  }

  function acceptServerBalance(payload) {
    const value = Number(payload && (payload.creditsRemaining ?? payload.credits));
    if (!Number.isInteger(value) || value < 0) return getSnapshot();
    state.credits = value;
    state.authenticated = Boolean(sessionToken());
    state.loading = false;
    if (Number.isFinite(Number(payload.nextDailyAt))) state.nextDailyAt = Number(payload.nextDailyAt);
    emit();
    return getSnapshot();
  }

  async function sync(options) {
    const token = sessionToken();
    if (!token) return setAnonymous();
    if (syncPromise && !(options && options.force)) return syncPromise;

    state.authenticated = true;
    state.loading = true;
    emit();
    syncPromise = fetch('/api/credits', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (window.TacticalAuth && window.TacticalAuth.clearSession) window.TacticalAuth.clearSession();
        return setAnonymous();
      }
      if (!response.ok) throw new Error(payload.error || 'Credit sync failed.');
      return acceptServerBalance(payload);
    }).catch((error) => {
      state.loading = false;
      state.credits = 0;
      emit();
      console.warn('Credit sync unavailable; balance locked at zero.', error);
      return getSnapshot();
    }).finally(() => {
      syncPromise = null;
    });
    return syncPromise;
  }

  function getSnapshot() {
    return Object.freeze({
      credits: state.authenticated ? state.credits : 0,
      authenticated: state.authenticated,
      loading: state.loading,
      nextDailyAt: state.nextDailyAt
    });
  }

  window.TacticalCredits = Object.freeze({
    sync,
    acceptServerBalance,
    getSnapshot,
    reset: setAnonymous
  });

  window.addEventListener('tactical-auth-changed', () => {
    if (sessionToken()) sync({ force: true });
    else setAnonymous();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sessionToken()) sync({ force: true });
  });

  const start = () => { if (sessionToken()) sync(); else setAnonymous(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
