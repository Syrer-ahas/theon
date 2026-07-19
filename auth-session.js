(() => {
  const storageKey = 'tactical-web-google-session';

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!session || !session.email || !session.expiresAt || session.expiresAt <= Date.now()) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  }

  function saveSession(profile) {
    const session = {
      name: profile.name || profile.email,
      email: profile.email,
      picture: profile.picture || '',
      expiresAt: Number(profile.exp || 0) * 1000
    };
    if (!session.expiresAt || session.expiresAt <= Date.now()) return null;
    localStorage.setItem(storageKey, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(storageKey);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  window.TacticalAuth = { getSession, saveSession, clearSession };
})();
