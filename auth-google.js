// Google Identity Services sign-in for Tactical Web.
// Uses one visible, Google-rendered button and keeps the existing session API.
(() => {
  let initialised = false;
  let pendingResolve = null;
  let pendingReject = null;
  let dialog = null;

  function getClientId() {
    return window.TACTICAL_AUTH_CONFIG?.googleClientId || '';
  }

  function isConfigured() {
    const clientId = getClientId();
    return Boolean(
      clientId &&
      !clientId.startsWith('YOUR_GOOGLE') &&
      clientId.endsWith('.apps.googleusercontent.com')
    );
  }

  function decodeCredential(credential) {
    try {
      const encoded = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
      const bytes = atob(padded);
      const escaped = Array.from(bytes, (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`
      ).join('');
      return JSON.parse(decodeURIComponent(escaped));
    } catch (_) {
      return null;
    }
  }

  function validateCredential(credential, profile) {
    if (!credential || credential.split('.').length !== 3 || !profile) return false;
    if (!profile.email || profile.email_verified !== true) return false;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(profile.iss)) return false;
    if (profile.aud !== getClientId()) return false;
    return Number(profile.exp || 0) * 1000 > Date.now();
  }

  function closeDialog() {
    if (dialog) dialog.remove();
    dialog = null;
  }

  function settle(session, error) {
    const resolve = pendingResolve;
    const reject = pendingReject;
    pendingResolve = null;
    pendingReject = null;
    closeDialog();

    if (error) {
      if (reject) reject(new Error(error));
      return;
    }
    if (resolve) resolve(session);
  }

  function handleCredential(response) {
    const credential = response?.credential || '';
    const profile = decodeCredential(credential);
    if (!validateCredential(credential, profile)) {
      settle(null, 'Google could not verify this account.');
      return;
    }

    const session = window.TacticalAuth?.saveSession(profile, credential);
    if (!session) {
      settle(null, 'Google sign-in could not be saved.');
      return;
    }
    establishAdminSession(credential);
    settle(session);
  }

  function establishAdminSession(credential) {
    fetch('/api/admin-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}` },
      credentials: 'same-origin'
    }).catch(() => {});
  }

  const existingSession = window.TacticalAuth?.getSession?.();
  if (existingSession?.credential) establishAdminSession(existingSession.credential);

  function ensureGoogleInit() {
    if (initialised) return true;
    if (!isConfigured() || !window.google?.accounts?.id || !window.TacticalAuth) return false;

    window.google.accounts.id.initialize({
      client_id: getClientId(),
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    initialised = true;
    return true;
  }

  function cancelSignIn() {
    if (!pendingReject) {
      closeDialog();
      return;
    }
    settle(null, 'Google sign-in was cancelled.');
  }

  function openGoogleDialog() {
    closeDialog();
    dialog = document.createElement('div');
    dialog.id = 'tactical-google-login';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:50000;display:grid;place-items:center;padding:20px;background:rgba(10,5,18,.78);backdrop-filter:blur(8px)';
    dialog.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="tactical-google-title" style="position:relative;width:min(360px,100%);padding:30px;border:1px solid rgba(216,180,254,.3);border-radius:20px;background:#1c102a;color:#fff;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.5)">
        <button type="button" data-google-close aria-label="Close" style="position:absolute;top:10px;right:12px;border:0;background:transparent;color:#ddd;font-size:26px;cursor:pointer">&times;</button>
        <h2 id="tactical-google-title" style="margin:0 0 8px">Sign in</h2>
        <p style="margin:0 0 22px;color:#c9bfd4">Continue with your Google account.</p>
        <div data-google-button style="display:flex;justify-content:center;min-height:44px"></div>
      </section>`;

    dialog.querySelector('[data-google-close]').addEventListener('click', cancelSignIn);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) cancelSignIn();
    });
    document.body.appendChild(dialog);

    window.google.accounts.id.renderButton(dialog.querySelector('[data-google-button]'), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 280
    });
  }

  function signInWithGoogle() {
    if (pendingReject) return Promise.reject(new Error('Google sign-in is already open.'));
    if (!isConfigured()) return Promise.reject(new Error('Google sign-in is not configured.'));
    if (!ensureGoogleInit()) return Promise.reject(new Error('Google sign-in is still loading. Please try again.'));

    return new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
      openGoogleDialog();
    });
  }

  function getSessionToken() {
    return window.TacticalAuth?.getCredential?.() || null;
  }

  function getSession() {
    return window.TacticalAuth?.getSession?.() || null;
  }

  function signOut() {
    closeDialog();
    pendingResolve = null;
    pendingReject = null;
    window.TacticalAuth?.clearSession?.();
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  window.TacticalSignIn = {
    signInWithGoogle,
    getSessionToken,
    getSession,
    signOut,
    isConfigured,
    ensureGoogleInit
  };
})();
