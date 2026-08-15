// Shared strict Google sign-in client for Tactical Web.
// Uses Google Identity Services (GIS) to obtain an ID token (JWT credential),
// verifies the token structurally on the client, stores it in the strict
// session store, and exposes helpers used by every page (including the
// windowed agent) to gate access behind a verified sign-in.

(() => {
  let googleTokenClient = null;
  let initialised = false;
  let initAttempts = 0;
  const MAX_ATTEMPTS = 40;

  function getClientId() {
    return window.TACTICAL_AUTH_CONFIG?.googleClientId || '';
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
    return null;
  }

  /**
   * Ensure the Google Identity Services token client is initialised.
   * Returns true once ready, false if not yet available.
   */
  function ensureGoogleInit() {
    const clientId = getClientId();
    if (!isConfigured()) return false;
    if (!window.google?.accounts?.oauth2) return false;
    if (initialised && googleTokenClient) return true;

    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (tokenResponse) => {
        // Fallback: if no one attached a handler, forward to stored callback
        if (ensureGoogleInit._pendingCallback) {
          const cb = ensureGoogleInit._pendingCallback;
          ensureGoogleInit._pendingCallback = null;
          handleTokenResponse(tokenResponse, cb);
        }
      }
    });
    initialised = true;
    return true;
  }

  function handleTokenResponse(tokenResponse, callback) {
    if (tokenResponse.error || !tokenResponse.access_token) {
      callback(null, 'Google sign-in was cancelled or could not be completed. Please try again.');
      return;
    }

    // GIS TokenResponse includes an ID token (JWT) when openid scope is requested.
    const credential = tokenResponse.id_token || '';
    const profile = credential ? decodeGoogleCredential(credential) : null;

    const shapeError = validateCredentialShape(credential, profile);
    if (shapeError) {
      callback(null, shapeError);
      return;
    }

    // Ensure we keep a full numeric expiry in the profile for the session store.
    if (typeof profile.exp !== 'number' || Number.isNaN(profile.exp)) {
      profile.exp = Math.floor(Date.now() / 1000) + Number(tokenResponse.expires_in || 3600);
    }

    const session = window.TacticalAuth.saveSession(profile, credential);
    if (!session) {
      callback(null, 'Your Google session could not be stored securely. Please try again.');
      return;
    }

    callback(session, null);
  }

  /**
   * Request a fresh, strict Google sign-in.
   * Returns a Promise that resolves with the session or rejects with an Error.
   */
  function signInWithGoogle() {
    return new Promise((resolve, reject) => {
      if (!isConfigured()) {
        reject(new Error('Google sign-in is not configured yet. Add your Google OAuth Web client ID to auth-config.js.'));
        return;
      }

      if (!ensureGoogleInit()) {
        let attempts = 0;
        const wait = window.setInterval(() => {
          attempts += 1;
          if (ensureGoogleInit()) {
            window.clearInterval(wait);
            requestToken(resolve, reject);
          } else if (attempts >= MAX_ATTEMPTS) {
            window.clearInterval(wait);
            reject(new Error('Google sign-in could not load. Check your connection, browser privacy extensions, and Google Cloud authorized JavaScript origins.'));
          }
        }, 250);
        return;
      }

      requestToken(resolve, reject);
    });
  }

  function requestToken(resolve, reject) {
    if (!googleTokenClient) {
      reject(new Error('Google sign-in is still loading. Please try again in a moment.'));
      return;
    }

    ensureGoogleInit._pendingCallback = (session, error) => {
      if (error) reject(new Error(error));
      else resolve(session);
    };

    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  /**
   * Returns the current strict session token (JWT) or null.
   */
  function getSessionToken() {
    return window.TacticalAuth?.getCredential?.() || null;
  }

  /**
   * Returns the current session object or null (strictly validated).
   */
  function getSession() {
    return window.TacticalAuth?.getSession?.() || null;
  }

  function signOut() {
    window.TacticalAuth?.clearSession?.();
  }

  window.TacticalSignIn = { signInWithGoogle, getSessionToken, getSession, signOut, isConfigured, ensureGoogleInit };
})();