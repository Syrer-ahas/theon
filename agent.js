(() => {
  'use strict';
  const el = (id) => document.getElementById(id);
  const state = { session: null, chats: [], activeId: null, busy: false, credits: 0, downloads: new Map() };

  function planName() {
    try { return localStorage.getItem('tactical-web-selected-plan') || 'Free'; } catch (_) { return 'Free'; }
  }
  function isPaid() { return planName() !== 'Free'; }
  function chatLimit() { return isPaid() ? Infinity : 2; }
  function storageKey() { return `tactical-web-saved-chats:${state.session?.email?.toLowerCase() || 'guest'}`; }
  function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function activeChat() { return state.chats.find((chat) => chat.id === state.activeId) || null; }

  function loadChats() {
    if (!state.session) { state.chats = []; state.activeId = null; return; }
    try {
      const value = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      state.chats = Array.isArray(value) ? value.slice(0, isPaid() ? 100 : 2) : [];
    } catch (_) { state.chats = []; }
    state.activeId = state.chats[0]?.id || null;
  }

  function saveChats() {
    if (!state.session) return;
    try { localStorage.setItem(storageKey(), JSON.stringify(state.chats.slice(0, isPaid() ? 100 : 2))); } catch (_) {}
    el('saveState').textContent = 'Saved in this browser';
  }

  function makeChat() {
    const current = activeChat();
    if (current && current.messages.length === 0) return current;
    if (state.chats.length >= chatLimit()) {
      showNotice('Free accounts can save up to two chats. Continue an existing chat, delete one, or upgrade for more.');
      return null;
    }
    const chat = { id: uid(), title: 'New conversation', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), model: el('agentModel').value, messages: [] };
    state.chats.unshift(chat);
    state.activeId = chat.id;
    saveChats();
    render();
    return chat;
  }

  function showNotice(message) {
    el('agentNotice').textContent = message;
    el('agentNotice').hidden = false;
  }
  function clearNotice() { el('agentNotice').hidden = true; }

  function renderSidebar() {
    const list = el('conversationList');
    list.replaceChildren();
    state.chats.forEach((chat) => {
      const button = document.createElement('button');
      button.className = `conversation-item${chat.id === state.activeId ? ' active' : ''}`;
      button.type = 'button';
      const title = document.createElement('span');
      title.className = 'conversation-title';
      title.textContent = chat.title || 'New conversation';
      const date = document.createElement('span');
      date.className = 'conversation-date';
      date.textContent = new Date(chat.updatedAt).toLocaleDateString();
      const remove = document.createElement('span');
      remove.className = 'conversation-delete';
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', 'Delete chat');
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        state.chats = state.chats.filter((item) => item.id !== chat.id);
        if (state.activeId === chat.id) state.activeId = state.chats[0]?.id || null;
        saveChats();
        render();
      });
      button.addEventListener('click', () => { state.activeId = chat.id; clearNotice(); render(); });
      button.append(title, date, remove);
      list.appendChild(button);
    });
    el('chatPlan').textContent = isPaid() ? `${planName()} · ${state.chats.length} saved chats` : `Free plan · ${state.chats.length} of 2 chats used`;
    el('newChatBtn').disabled = !state.session || (!isPaid() && state.chats.length >= 2 && activeChat()?.messages.length > 0);
  }

  function createMessageNode(message) {
    const row = document.createElement('div');
    row.className = `message ${message.role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const text = document.createElement('div');
    text.textContent = message.text;
    bubble.appendChild(text);
    const download = state.downloads.get(message.id);
    if (download) {
      const wrap = document.createElement('div');
      wrap.className = 'download-row';
      const link = document.createElement('a');
      link.className = 'download-link';
      link.href = download.url;
      link.download = download.filename;
      link.textContent = 'Download preset package';
      wrap.appendChild(link);
      bubble.appendChild(wrap);
    }
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(meta);
    row.appendChild(bubble);
    return row;
  }

  function renderMessages() {
    const chat = activeChat();
    el('chatTitle').textContent = chat?.title || 'Tactical AI';
    el('saveState').textContent = chat ? 'Saved in this browser' : 'Start or select a conversation';
    if (chat?.model) el('agentModel').value = chat.model;
    const messages = el('messages');
    messages.replaceChildren();
    const hasMessages = Boolean(chat?.messages?.length);
    el('emptyChat').hidden = hasMessages;
    messages.hidden = !hasMessages;
    if (hasMessages) chat.messages.forEach((message) => messages.appendChild(createMessageNode(message)));
    el('messageArea').scrollTop = el('messageArea').scrollHeight;
  }

  function render() {
    renderSidebar();
    renderMessages();
    const signedIn = Boolean(state.session);
    el('authOverlay').hidden = signedIn;
    el('chatInput').disabled = !signedIn || state.busy;
    el('sendBtn').disabled = !signedIn || state.busy;
    el('agentModel').disabled = !signedIn || state.busy;
    el('creditDisplay').textContent = `${state.credits} credits`;
  }

  function appendMessage(role, text) {
    const chat = activeChat() || makeChat();
    if (!chat) return null;
    const message = { id: uid(), role, text, time: new Date().toISOString() };
    chat.messages.push(message);
    chat.updatedAt = message.time;
    if (role === 'user' && chat.title === 'New conversation') chat.title = text.slice(0, 42) || 'New conversation';
    saveChats();
    render();
    return message;
  }

  function setTyping(show) {
    const old = el('typingIndicator');
    if (old) old.remove();
    if (!show) return;
    const typing = document.createElement('div');
    typing.id = 'typingIndicator';
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    el('messages').hidden = false;
    el('messages').appendChild(typing);
    el('messageArea').scrollTop = el('messageArea').scrollHeight;
  }

  async function generatePreset(params) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.TacticalSignIn.getSessionToken()}` },
      body: JSON.stringify({ game: params.game || 'Cyberpunk 2077', style: params.style || 'cinematic', hardware: params.hardware || 'mid', prompt: params.prompt || 'custom preset', presetName: params.presetName || 'Tactical Preset' })
    });
    const data = await response.json().catch(() => ({}));
    if (Number.isInteger(Number(data.creditsRemaining))) window.TacticalCredits.acceptServerBalance(data);
    if (!response.ok) throw new Error(data.error || 'Preset generation failed.');
    const zip = new JSZip();
    zip.file('preset.ini', data.preset_ini);
    zip.file('shader.fx', data.shader_fx);
    zip.file('README.txt', data.readme);
    const blob = await zip.generateAsync({ type: 'blob' });
    const message = appendMessage('agent', `Your preset package is ready. ${data.creditsRemaining} credits remain.`);
    if (message) {
      state.downloads.set(message.id, { url: URL.createObjectURL(blob), filename: `${data.presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-package.zip` });
      renderMessages();
    }
  }

  async function sendMessage(textOverride) {
    if (!state.session) { await signIn(); return; }
    const text = String(textOverride ?? el('chatInput').value).trim();
    if (!text || state.busy) return;
    const chat = activeChat() || makeChat();
    if (!chat) return;
    clearNotice();
    appendMessage('user', text);
    el('chatInput').value = '';
    el('charCount').textContent = '0 / 1000';
    state.busy = true;
    render();
    setTyping(true);
    try {
      const history = chat.messages.slice(-13, -1).map((message) => ({ role: message.role === 'agent' ? 'model' : 'user', text: message.text }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.TacticalSignIn.getSessionToken()}` },
        body: JSON.stringify({ message: text, history, model: el('agentModel').value })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) window.TacticalSignIn.signOut();
      if (!response.ok) throw new Error(data.error || 'The agent could not respond.');
      setTyping(false);
      appendMessage('agent', data.reply || 'Your request is ready for generation.');
      if (data.generate) {
        if (state.credits < 1) throw new Error('You need one credit to generate a preset package.');
        setTyping(true);
        await generatePreset(data.generate);
      }
    } catch (error) {
      setTyping(false);
      showNotice(error.message || 'The request could not be completed.');
    } finally {
      state.busy = false;
      render();
      el('chatInput').focus();
    }
  }

  async function signIn() {
    try {
      const signedIn = await window.TacticalSignIn.signInWithGoogle();
      if (!signedIn) return;
      state.session = signedIn;
      loadChats();
      await window.TacticalCredits.sync({ force: true });
      clearNotice();
      render();
      processHomepageDraft();
    } catch (error) { showNotice(error.message || 'Google sign-in could not be completed.'); }
  }

  function processHomepageDraft() {
    if (!state.session) return;
    let prompt = '';
    let autoSend = false;
    try {
      prompt = localStorage.getItem('tactical-web-draft-prompt') || '';
      autoSend = localStorage.getItem('tactical-web-agent-autosend') === 'true';
      localStorage.removeItem('tactical-web-agent-autosend');
      if (autoSend) localStorage.removeItem('tactical-web-draft-prompt');
    } catch (_) {}
    if (prompt) {
      el('chatInput').value = prompt;
      el('charCount').textContent = `${prompt.length} / 1000`;
      if (autoSend) sendMessage(prompt);
    }
  }

  function boot() {
    state.session = window.TacticalSignIn.getSession();
    loadChats();
    el('newChatBtn').addEventListener('click', () => { clearNotice(); makeChat(); el('chatInput').focus(); });
    el('sendBtn').addEventListener('click', () => sendMessage());
    el('signInBtn').addEventListener('click', signIn);
    el('agentModel').addEventListener('change', () => {
      try { localStorage.setItem('tactical-web-selected-model', el('agentModel').value); } catch (_) {}
      const chat = activeChat();
      if (chat) { chat.model = el('agentModel').value; saveChats(); }
    });
    el('chatInput').addEventListener('input', () => { el('charCount').textContent = `${el('chatInput').value.length} / 1000`; });
    el('chatInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    document.querySelectorAll('[data-agent-suggestion]').forEach((button) => button.addEventListener('click', () => sendMessage(button.dataset.agentSuggestion)));
    window.addEventListener('tw-credits-changed', (event) => { state.credits = event.detail?.authenticated ? Number(event.detail.credits || 0) : 0; render(); });
    document.addEventListener('tactical-auth-changed', (event) => {
      state.session = event.detail?.session || null;
      loadChats();
      render();
    });
    const selectedModel = localStorage.getItem('tactical-web-selected-model');
    if (selectedModel && Array.from(el('agentModel').options).some((option) => option.value === selectedModel)) el('agentModel').value = selectedModel;
    render();
    el('upgradeChatLink').hidden = isPaid();
    if (state.session) {
      window.TacticalCredits.sync({ force: true });
      processHomepageDraft();
    }
  }

  window.addEventListener('beforeunload', () => state.downloads.forEach((download) => URL.revokeObjectURL(download.url)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
