(() => {
  const byId = (id) => document.getElementById(id);
  const readNumber = (key) => {
    try { return Number(localStorage.getItem(key) || 0); } catch (_) { return 0; }
  };

  function navigateToGenerator() {
    const prompt = byId('promptInput').value.trim();
    const model = byId('modelSelect').value;
    if (!prompt) {
      byId('promptInput').focus();
      byId('composerStatus').textContent = 'Describe the visual result you want first.';
      return;
    }
    try {
      localStorage.setItem('tactical-web-draft-prompt', prompt);
      localStorage.setItem('tactical-web-selected-model', model);
    } catch (_) {}
    if (window.TacticalPageLoader?.navigate) window.TacticalPageLoader.navigate('generator.html');
    else window.location.href = 'generator.html';
  }

  function refreshPulse() {
    const session = window.TacticalAuth?.getSession?.();
    const credits = window.TacticalCredits?.getSnapshot?.().credits || 0;
    byId('pulseAccount').textContent = session ? 'Connected' : 'Guest';
    byId('pulseCredits').textContent = Number(credits).toLocaleString();
    byId('pulsePresets').textContent = readNumber('tactical-web-preset-count').toLocaleString();
  }

  function boot() {
    const input = byId('promptInput');
    const counter = byId('charCount');
    const status = byId('composerStatus');
    const model = byId('modelSelect');

    try {
      const draft = localStorage.getItem('tactical-web-draft-prompt');
      const savedModel = localStorage.getItem('tactical-web-selected-model');
      if (draft) input.value = draft;
      if (savedModel && Array.from(model.options).some((option) => option.value === savedModel)) model.value = savedModel;
    } catch (_) {}

    const updateCount = () => {
      counter.textContent = `${input.value.length} / 600`;
      if (status.textContent) status.textContent = '';
    };
    updateCount();
    input.addEventListener('input', updateCount);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) navigateToGenerator();
    });
    byId('generateBtn').addEventListener('click', navigateToGenerator);
    byId('clearPromptBtn').addEventListener('click', () => {
      input.value = '';
      updateCount();
      input.focus();
    });
    document.querySelectorAll('[data-suggestion]').forEach((button) => {
      button.addEventListener('click', () => {
        input.value = button.dataset.suggestion;
        updateCount();
        input.focus();
      });
    });

    refreshPulse();
    window.addEventListener('tw-credits-changed', refreshPulse);
    document.addEventListener('tactical-auth-changed', refreshPulse);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
