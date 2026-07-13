// cookie.js — lightweight consent banner that appears once and remembers the choice
(function(){
  const COOKIE_NAME = 'tactical-web-consent';
  const STORAGE_KEY = 'tactical-web-consent';
  const bannerId = 'cookieBanner';
  const acceptId = 'cookieAcceptBtn';
  const declineId = 'cookieDeclineBtn';

  function getStoredConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function hasConsent() {
    const stored = getStoredConsent();
    if (stored === 'accepted' || stored === 'declined') return true;
    return document.cookie.split(';').some(c => c.trim().startsWith(COOKIE_NAME + '='));
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // ignore storage errors so the page remains functional
    }
    const expiry = value === 'accepted' ? '; max-age=31536000' : '; max-age=0';
    document.cookie = COOKIE_NAME + '=' + value + expiry + '; path=/; SameSite=Lax';
  }

  function hideBanner() {
    const banner = document.getElementById(bannerId);
    if (banner) banner.classList.add('hidden');
  }

  function showBanner() {
    const banner = document.getElementById(bannerId);
    if (banner) banner.classList.remove('hidden');
  }

  function bindBanner() {
    const banner = document.getElementById(bannerId);
    const acceptBtn = document.getElementById(acceptId);
    const declineBtn = document.getElementById(declineId);

    if (!banner) return;

    const handleChoice = (value) => {
      setConsent(value);
      hideBanner();
    };

    if (acceptBtn) acceptBtn.addEventListener('click', () => handleChoice('accepted'));
    if (declineBtn) declineBtn.addEventListener('click', () => handleChoice('declined'));
    showBanner();
  }

  if (hasConsent()) {
    hideBanner();
    return;
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindBanner();
  });
})();
