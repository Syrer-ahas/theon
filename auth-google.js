// Shared strict Google sign-in client for Tactical Web.
// Uses Google Identity Services (GIS) "ID token" flow (google.accounts.id),
// which reliably returns an id_token (signed JWT). The token is verified
// structurally on the client, stored in the strict session store, and every
// page reacts to the resulting `tactical-auth-changed` event.
//
// Flow priority:
//   1. google.accounts.id.prompt()  (One Tap / auto select — if available)
//   2. A hidden GIS "Sign in with Google" button rendered off-screen and
//      clicked programmatically (works in every browser, no pop-up blockers).
//
// The older OAuth2 token flow (initTokenClient) is NOT used because it does
// not reliably return an id_token, which the strict session store requires.

(() => {
  let initialised = false;
  let initAttempts = 0;
  const MAX_ATTEMPTS = 40; // 40 * 250ms = 10s
  let pendingResolve = null;
  let pendingReject = null;
  let hiddenButtonHost = null;

  function getClientId() {
    return window.TACTICAL_AUTH_CONFIG?.googleClientId || '';
  }

  function getLocalOrigin() {
    return (window.TACTICAL_AUTH_CONFIG?.localOrigin || 'http://localhost:3000').replace(/\/$/, '');
  }

  function isSecureAuthOrigin() {
    if (window.location.protocol === 'https:') return true;
    if (window.location.protocol !== 'http:') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  function continueFromFileOrigin(resolve, reject) {
    const localOrigin = getLocalOrigin();
    fetch(localOrigin + '/health', { cache: 'no-store', mode: 'cors' })
      .then((response) => {
        if (!response.ok) throw new Error('Local server unavailable.');
        const fileName = decodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
        window.location.replace(localOrigin + '/' + encodeURIComponent(fileName) + window.location.search + window.location.hash);
        resolve(null);
      })
      .catch(() => {
        reject(new Error('Google sign-in cannot run from file://. Start the site with "npm run dev", then open ' + localOrigin + '.'));
      });
  }

  function isConfigured() {
    const id = getClientId();
    return Boolean(id && !id.startsWith('YOUR_GOOGLE') && id.includes('.apps.googleusercontent.com'));
  }

  function decodeGoogleCredential(credential) {
    try {
      const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map(c => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * STRICT client-side shape check of a Google ID token before we store it.
   * The server still performs the authoritative RSA-256 signature verification.
   */
  function validateCredentialShape(credential, profile) {
    if (!credential || typeof credential !== 'string' || credential.split('.').length !== 3) return 'Invalid credential.';
    if (!profile || typeof profile !== 'object') return 'Invalid profile.';
    if (!profile.email || typeof profile.email !== 'string' || profile.email.length === 0) return 'Missing email.';
    if (profile.email_verified !== true && profile.email_verified !== 'true') return 'Email is not Google-verified.';
    const exp = Number(profile.exp || 0) * 1000;
    if (!exp || Number.isNaN(exp)) return 'Missing token expiry.';
    if (exp <= Date.now() + 30 * 1000) return 'Token is expired or expiring too soon.';
    if (profile.iss !== 'https://accounts.google.com' && profile.iss !== 'accounts.google.com') return 'Token was not issued by Google.';
    if (profile.aud && getClientId() && profile.aud !== getClientId()) return 'Token audience does not match this app.';
    return null;
  }

  function ensureHiddenButtonHost() {
    if (hiddenButtonHost && document.body.contains(hiddenButtonHost)) return hiddenButtonHost;
    hiddenButtonHost = document.createElement('div');
    hiddenButtonHost.id = 'tactical-gis-button-host';
    hiddenButtonHost.setAttribute('aria-hidden', 'true');
    hiddenButtonHost.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(hiddenButtonHost);
    return hiddenButtonHost;
  }

  /**
   * Ensure Google Identity Services is initialised. Returns true once ready.
   */
  function ensureGoogleInit() {
    if (!isConfigured()) return false;
    if (!window.google?.accounts?.id) return false;
    if (initialised) return true;

    window.google.accounts.id.initialize({
      client_id: getClientId(),
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (!response || !response.credential) return;
        handleCredential(response.credential);
      }
    });

    // Render a fallback button, off-screen, so we can trigger sign-in
    // programmatically even when One Tap prompt() is unavailable.
    const host = ensureHiddenButtonHost();
    try {
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill'
      });
    } catch (_) { /* renderButton may not be ready yet */ }

    initialised = true;
    return true;
  }

  /** Handle a returned credential: validate, save, resolve the pending promise. */
  function handleCredential(credential) {
    const profile = decodeGoogleCredential(credential);
    const shapeError = validateCredentialShape(credential, profile);
    if (shapeError) {
      finish(null, shapeError);
      return;
    }
    const session = window.TacticalAuth.saveSession(profile, credential);
    if (!session) {
      finish(null, 'Your Google session could not be stored securely. Please try again.');
      return;
    }
    finish(session, null);
  }

  function finish(session, error) {
    const resolve = pendingResolve;
    const reject = pendingReject;
    pendingResolve = null;
    pendingReject = null;
    if (error) {
      if (reject) reject(new Error(error));
      else console.warn('Tactical sign-in:', error);
      return;
    }
    if (resolve) resolve(session);
  }

  /**
   * Request a fresh, strict Google sign-in.
   * Returns a Promise that resolves with the session or rejects with an Error.
   */
  function signInWithGoogle() {
    return new Promise((resolve, reject) => {
      if (window.location.protocol === 'file:') {
        continueFromFileOrigin(resolve, reject);
        return;
      }
      if (!isSecureAuthOrigin()) {
        reject(new Error('Google sign-in requires HTTPS or localhost. Open the secure website address and try again.'));
        return;
      }
      if (!isConfigured()) {
        reject(new Error('Google sign-in is not configured yet. Add your Google OAuth Web client ID to auth-config.js.'));
        return;
      }

      pendingResolve = resolve;
      pendingReject = reject;
      initAttempts = 0;

      const begin = () => {
        try {
          // Primary attempt: One Tap prompt.
          window.google.accounts.id.prompt((notification) => {
            const notDisplayed = notification?.isNotDisplayed?.();
            const skipped = notification?.isSkippedMoment?.();
            const dismissed = notification?.isDismissedMoment?.();
            if (notDisplayed || skipped) {
              // One Tap unavailable — fall back to the rendered button.
              triggerRenderedButton();
            } else if (dismissed) {
              finish(null, 'Sign-in was dismissed. Please try again.');
            }
            // Otherwise the callback() will fire with the credential.
          });
        } catch (_) {
          triggerRenderedButton();
        }
      };

      if (ensureGoogleInit()) {
        begin();
        return;
      }

      // Poll until GIS is available (script is loaded async).
      const wait = window.setInterval(() => {
        initAttempts += 1;
        if (ensureGoogleInit()) {
          window.clearInterval(wait);
          begin();
        } else if (initAttempts >= MAX_ATTEMPTS) {
          window.clearInterval(wait);
          finish(null, 'Google sign-in could not load. Check your connection, browser privacy extensions, and Google Cloud authorized JavaScript origins.');
        }
      }, 250);
    });
  }

  /** Programmatically click the off-screen GIS button as a fallback. */
  function triggerRenderedButton() {
    const host = ensureHiddenButtonHost();
    const btn = host.querySelector('div[role="button"], button, iframe');
    if (btn && typeof btn.click === 'function') {
      try { btn.click(); return; } catch (_) {}
    }
    const iframe = host.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const inner = iframe.contentDocument.querySelector('div[role="button"], button');
      if (inner) { inner.click(); return; }
    }
    finish(null, 'Please use the "Sign in with Google" button to continue.');
  }

  function getSessionToken() {
    return window.TacticalAuth?.getCredential?.() || null;
  }

  function getSession() {
    return window.TacticalAuth?.getSession?.() || null;
  }

  function signOut() {
    window.TacticalAuth?.clearSession?.();
    if (window.google?.accounts?.id) {
      try { window.google.accounts.id.disableAutoSelect(); } catch (_) {}
    }
  }

  window.TacticalSignIn = { signInWithGoogle, getSessionToken, getSession, signOut, isConfigured, ensureGoogleInit };
})();
