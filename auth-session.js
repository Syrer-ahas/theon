// STRICT session store for Tactical Web.
// Stores the full Google ID token (credential) so server APIs can
// cryptographically verify it. The session object is frozen and
// expires when the underlying Google token expires.

(() => {
  const storageKey = 'tactical-web-google-session';
  const EXPIRY_MARGIN_MS = 30 * 1000; // require token to still be valid ≥30s longer

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!session) return null;

      // Strict: require the raw Google credential to be present.
      if (!session.credential || typeof session.credential !== 'string' || session.credential.split('.').length !== 3) {
        localStorage.removeItem(storageKey);
        return null;
      }

      // Strict: require the profile fields we use.
      if (!session.email || typeof session.email !== 'string' || session.email.length === 0) {
        localStorage.removeItem(storageKey);
        return null;
      }

      // Strict: require a numeric expiry and reject sessions at/near expiry.
      if (typeof session.expiresAt !== 'number' || Number.isNaN(session.expiresAt)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      if (session.expiresAt <= Date.now() + EXPIRY_MARGIN_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return session;
    } catch (_) {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  /**
   * Save a verified Google profile + raw credential (ID token).
   * Returns null (and refuses to store) if the profile is malformed,
   * the credential is not a 3-part JWT, or the token is expired/expiring soon.
   */
  function saveSession(profile, credential) {
    if (!profile || typeof profile !== 'object') return null;
    if (!profile.email || typeof profile.email !== 'string' || profile.email.length === 0) return null;

    // The credential must be a JWT with 3 dot-separated segments.
    if (!credential || typeof credential !== 'string' || credential.split('.').length !== 3) {
      return null;
    }

    const expiresAt = Number(profile.exp || 0) * 1000;
    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= Date.now() + EXPIRY_MARGIN_MS) {
      return null;
    }

    const session = {
      name: profile.name || profile.email,
      email: profile.email,
      picture: profile.picture || '',
      credential: credential,
      expiresAt
    };

    localStorage.setItem(storageKey, JSON.stringify(session));
    return session;
  }

  /**
   * Returns the raw Google ID token for sending to API endpoints.
   * Returns null when no valid (strictly validated) session exists.
   */
  function getCredential() {
    const session = getSession();
    return session ? session.credential : null;
  }

  function clearSession() {
    localStorage.removeItem(storageKey);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  window.TacticalAuth = { getSession, saveSession, getCredential, clearSession };
})();