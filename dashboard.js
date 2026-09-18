(() => {
  'use strict';
  const ADMIN_EMAIL = 'alkhidirea@gmail.com';
  const session = window.TacticalAuth?.getSession?.();
  if (!session || session.email !== ADMIN_EMAIL) {
    window.location.replace('index.html');
    return;
  }

  const byId = (id) => document.getElementById(id);
  const get = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } };
  const getNumber = (key) => Number(get(key, '0')) || 0;
  const getJson = (key, fallback) => { try { return JSON.parse(get(key, '')) ?? fallback; } catch (_) { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } };
  let toastTimer;
  let serverPlan = 'Free';

  async function loadBillingPlan() {
    try {
      const response = await fetch('/api/billing', {
        headers: { Authorization: `Bearer ${session.credential}` },
        cache: 'no-store'
      });
      const billing = await response.json().catch(() => ({}));
      if (response.ok) serverPlan = ({ pro: 'Tactical PRO', premium: 'Tactical Premium', enterprise: 'Tactical Enterprise' })[billing.plan] || 'Free';
    } catch (_) {}
    byId('profilePlan').textContent = serverPlan;
  }

  function toast(message) {
    const element = byId('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
  }

  function activities() {
    const value = getJson('tactical-web-activity-log', []);
    return Array.isArray(value) ? value : [];
  }

  function saveActivities(items) {
    set('tactical-web-activity-log', JSON.stringify(items.slice(-100)));
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || 'Date unavailable') : date.toLocaleString();
  }

  function renderActivity() {
    const list = byId('activityList');
    const query = byId('activitySearch')?.value.trim().toLowerCase() || '';
    const sourceItems = activities();
    const items = sourceItems.map((item, index) => ({ item, index })).filter(({ item }) => {
      const text = typeof item === 'string' ? item : `${item.action || ''} ${item.date || ''}`;
      return !query || text.toLowerCase().includes(query);
    }).reverse();
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No activity has been recorded yet.';
      list.appendChild(empty);
      return;
    }
    items.forEach(({ item, index }) => {
      const row = document.createElement('div');
      row.className = 'activity-item';
      const dot = document.createElement('span');
      dot.className = 'activity-dot';
      const copy = document.createElement('div');
      copy.className = 'activity-copy';
      const title = document.createElement('strong');
      title.textContent = typeof item === 'string' ? item : item.action || 'Workspace update';
      const date = document.createElement('span');
      date.textContent = typeof item === 'string' ? 'Legacy entry' : formatDate(item.date);
      copy.append(title, date);
      const remove = document.createElement('button');
      remove.className = 'activity-remove';
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove activity');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const current = activities();
        current.splice(index, 1);
        saveActivities(current);
        refresh();
        toast('Activity removed.');
      });
      row.append(dot, copy, remove);
      list.appendChild(row);
    });
  }

  function renderChart() {
    const chart = byId('usageChart');
    const counts = Array(7).fill(0);
    const today = new Date();
    activities().forEach((item) => {
      if (!item || typeof item === 'string') return;
      const itemDate = new Date(item.date);
      if (Number.isNaN(itemDate.getTime())) return;
      const daysAgo = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo] += 1;
    });
    const max = Math.max(...counts, 1);
    chart.replaceChildren();
    counts.forEach((count, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const column = document.createElement('div');
      column.className = 'usage-column';
      const track = document.createElement('div');
      track.className = 'usage-track';
      track.title = `${count} activities`;
      const bar = document.createElement('div');
      bar.className = 'usage-bar';
      bar.style.height = `${Math.max(4, (count / max) * 100)}%`;
      const label = document.createElement('span');
      label.className = 'usage-label';
      label.textContent = date.toLocaleDateString(undefined, { weekday: 'short' });
      track.appendChild(bar);
      column.append(track, label);
      chart.appendChild(column);
    });
  }

  function storageEntries(query = '') {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const value = get(key);
      if (!query || `${key} ${value}`.toLowerCase().includes(query.toLowerCase())) entries.push([key, value]);
    }
    return entries.sort(([a], [b]) => a.localeCompare(b));
  }

  function renderStorage() {
    const list = byId('storageList');
    const entries = storageEntries(byId('storageSearch').value.trim());
    list.replaceChildren();
    byId('storageCount').textContent = `${entries.length} visible keys`;
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No matching browser data found.';
      list.appendChild(empty);
      return;
    }
    entries.forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'storage-row';
      const keyCell = document.createElement('div');
      keyCell.className = 'storage-key';
      keyCell.textContent = key;
      const valueCell = document.createElement('div');
      valueCell.className = 'storage-value';
      valueCell.textContent = value.length > 500 ? `${value.slice(0, 500)}…` : value;
      row.append(keyCell, valueCell);
      list.appendChild(row);
    });
  }

  function storageSize() {
    return storageEntries().reduce((total, [key, value]) => total + (key.length + value.length) * 2, 0);
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportActivity() {
    const escapeCell = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
    const rows = activities().map((item) => [
      typeof item === 'string' ? item : item.action,
      typeof item === 'string' ? '' : item.date
    ]);
    const csv = [['Action', 'Date'], ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
    downloadText(`tactical-activity-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    toast('Activity exported as CSV.');
  }

  function workspaceData() {
    const data = {};
    storageEntries().forEach(([key, value]) => {
      if (key !== 'tactical-web-google-session' && key !== 'tactical-web-snapshots') data[key] = value;
    });
    return data;
  }

  function snapshots() {
    const value = getJson('tactical-web-snapshots', []);
    return Array.isArray(value) ? value : [];
  }

  function saveSnapshots(items) {
    set('tactical-web-snapshots', JSON.stringify(items.slice(-8)));
  }

  function renderSnapshots() {
    const list = byId('snapshotList');
    const items = snapshots().slice().reverse();
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No snapshots have been created.';
      list.appendChild(empty);
      return;
    }
    items.forEach((snapshot) => {
      const row = document.createElement('div');
      row.className = 'snapshot-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = snapshot.name;
      const meta = document.createElement('span');
      meta.textContent = `${formatDate(snapshot.createdAt)} · ${Object.keys(snapshot.data || {}).length} keys`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'snapshot-actions';
      const restore = document.createElement('button');
      restore.className = 'studio-button small';
      restore.type = 'button';
      restore.textContent = 'Restore';
      restore.addEventListener('click', () => {
        if (!confirm(`Restore ${snapshot.name}? Current authentication will be preserved.`)) return;
        Object.entries(snapshot.data || {}).forEach(([key, value]) => {
          if (key.startsWith('tactical-') && typeof value === 'string') set(key, value);
        });
        loadPreferences();
        refresh();
        toast('Snapshot restored.');
      });
      const remove = document.createElement('button');
      remove.className = 'studio-button small danger';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        saveSnapshots(snapshots().filter((item) => item.id !== snapshot.id));
        renderSnapshots();
        toast('Snapshot deleted.');
      });
      actions.append(restore, remove);
      row.append(copy, actions);
      list.appendChild(row);
    });
  }

  function createSnapshot() {
    const now = new Date();
    const items = snapshots();
    items.push({ id: `${now.getTime()}`, name: `Snapshot ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, createdAt: now.toISOString(), data: workspaceData() });
    saveSnapshots(items);
    renderSnapshots();
    toast('Workspace snapshot created.');
  }

  function renderGoal() {
    const presetCount = getNumber('tactical-web-preset-count');
    const goal = Math.max(1, getNumber('tactical-web-preset-goal') || 10);
    const percent = Math.min(100, Math.round((presetCount / goal) * 100));
    byId('goalInput').value = goal;
    byId('goalProgress').textContent = `${presetCount.toLocaleString()} / ${goal.toLocaleString()}`;
    byId('goalPercent').textContent = `${percent} percent`;
    byId('goalFill').style.width = `${percent}%`;
  }

  function runDiagnostics() {
    const checks = {
      healthAuth: Boolean(window.google?.accounts?.id),
      healthSession: Boolean(window.TacticalAuth?.getSession?.()),
      healthCredits: Boolean(window.TacticalCredits),
      healthStorage: (() => { try { set('_tw_test', '1'); localStorage.removeItem('_tw_test'); return true; } catch (_) { return false; } })(),
      healthNetwork: navigator.onLine,
      healthSecure: window.isSecureContext
    };
    Object.entries(checks).forEach(([id, ok]) => {
      const element = byId(id);
      element.textContent = ok ? 'Available' : 'Unavailable';
      element.style.color = ok ? 'var(--studio-green)' : 'var(--studio-red)';
    });
    byId('healthUsage').textContent = `${Math.ceil(storageSize() / 1024)} KB used`;
  }

  function refresh() {
    const firstSeen = get('tactical-web-first-seen');
    const creditSnapshot = window.TacticalCredits?.getSnapshot?.() || { credits: 0 };
    byId('adminName').textContent = session.name || 'Administrator';
    byId('adminEmail').textContent = session.email;
    byId('metricPresets').textContent = getNumber('tactical-web-preset-count').toLocaleString();
    byId('metricCredits').textContent = Number(creditSnapshot.credits || 0).toLocaleString();
    byId('metricVisits').textContent = getNumber('tactical-web-visit-count').toLocaleString();
    byId('metricActivity').textContent = activities().length.toLocaleString();
    byId('profileName').textContent = session.name || 'Administrator';
    byId('profileEmail').textContent = session.email;
    byId('profilePlan').textContent = serverPlan;
    byId('profileSince').textContent = firstSeen ? new Date(firstSeen).toLocaleDateString() : 'Not recorded';
    renderActivity();
    renderChart();
    renderStorage();
    renderSnapshots();
    renderGoal();
    runDiagnostics();
    byId('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function exportData() {
    const data = workspaceData();
    downloadText(`tactical-web-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2), 'application/json');
    toast('Workspace backup exported without authentication data.');
  }

  async function importData(file) {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid backup file.');
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('tactical-') && key !== 'tactical-web-google-session' && typeof value === 'string') set(key, value);
    });
    refresh();
    toast('Workspace backup imported.');
  }

  let managedAccount = null;

  function renderManagedAccount(account) {
    managedAccount = account || null;
    byId('accountResult').hidden = !account;
    byId('accountControls').hidden = !account;
    if (!account) return;
    byId('managedAccountEmail').textContent = account.email;
    byId('managedCredits').textContent = Number(account.credits || 0).toLocaleString();
    byId('managedBanState').textContent = account.banned ? 'Banned' : 'Active';
    byId('managedBanState').style.color = account.banned ? 'var(--studio-red)' : 'var(--studio-green)';
    byId('banUserBtn').disabled = Boolean(account.banned);
    byId('unbanUserBtn').disabled = !account.banned;
  }

  async function manageUser(action) {
    const email = byId('managedEmail').value.trim().toLowerCase();
    const amount = Number(byId('creditAmount').value);
    const token = window.TacticalSignIn?.getSessionToken?.();
    if (!email || !token) { byId('userAdminStatus').textContent = 'A valid email and administrator session are required.'; return; }

    const controls = [byId('lookupUserBtn'), byId('addCreditsBtn'), byId('removeCreditsBtn'), byId('banUserBtn'), byId('unbanUserBtn')];
    controls.forEach((button) => { button.disabled = true; });
    byId('userAdminStatus').textContent = action === 'lookup' ? 'Looking up user…' : 'Applying account change…';
    try {
      const response = await fetch('/api/admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
        body: JSON.stringify({ email, action, amount })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) window.TacticalSignIn?.signOut?.();
      if (!response.ok) throw new Error(payload.error || 'The account action failed.');
      renderManagedAccount(payload.account);
      const actionLabel = { lookup: 'User loaded', add: 'Credits added', remove: 'Credits removed', ban: 'User banned', unban: 'User access restored' }[action];
      byId('userAdminStatus').textContent = `${actionLabel}. Current balance: ${payload.account.credits}.`;
      if (action !== 'lookup') {
        const items = activities();
        items.push({ action: `${actionLabel}: ${email}`, date: new Date().toISOString() });
        saveActivities(items);
        refresh();
      }
    } catch (error) {
      renderManagedAccount(null);
      byId('userAdminStatus').textContent = error.message || 'The account action failed.';
    } finally {
      byId('lookupUserBtn').disabled = false;
      if (managedAccount) {
        byId('addCreditsBtn').disabled = false;
        byId('removeCreditsBtn').disabled = false;
        byId('banUserBtn').disabled = Boolean(managedAccount.banned);
        byId('unbanUserBtn').disabled = !managedAccount.banned;
      }
    }
  }

  function boot() {
    document.querySelectorAll('[data-dashboard-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-dashboard-tab]').forEach((item) => item.classList.toggle('active', item === tab));
        document.querySelectorAll('[data-dashboard-view]').forEach((view) => { view.hidden = view.dataset.dashboardView !== tab.dataset.dashboardTab; });
      });
    });
    byId('activityForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = byId('activityInput');
      const action = input.value.trim();
      if (!action) return;
      const items = activities();
      items.push({ action, date: new Date().toISOString() });
      saveActivities(items);
      input.value = '';
      refresh();
      toast('Activity added.');
    });
    byId('clearActivityBtn').addEventListener('click', () => {
      if (!confirm('Clear the activity history?')) return;
      saveActivities([]);
      refresh();
      toast('Activity history cleared.');
    });
    byId('activitySearch').addEventListener('input', renderActivity);
    byId('exportActivityBtn').addEventListener('click', exportActivity);
    byId('quickPrompt').addEventListener('input', (event) => {
      byId('launchCount').textContent = `${event.currentTarget.value.length} / 600`;
    });
    byId('saveDraftBtn').addEventListener('click', () => {
      const prompt = byId('quickPrompt').value.trim();
      if (!prompt) { toast('Enter a generation brief first.'); return; }
      set('tactical-web-draft-prompt', prompt);
      set('tactical-web-selected-model', byId('quickModel').value);
      if (byId('quickGame').value.trim()) set('tactical-web-draft-game', byId('quickGame').value.trim());
      toast('Generation draft saved.');
    });
    byId('quickLaunchForm').addEventListener('submit', (event) => {
      event.preventDefault();
      byId('saveDraftBtn').click();
      if (!byId('quickPrompt').value.trim()) return;
      window.location.href = 'generator.html';
    });
    byId('createSnapshotBtn').addEventListener('click', createSnapshot);
    byId('saveGoalBtn').addEventListener('click', () => {
      const goal = Math.max(1, Math.min(10000, Number(byId('goalInput').value) || 10));
      set('tactical-web-preset-goal', String(goal));
      renderGoal();
      toast('Preset goal updated.');
    });
    byId('clearDraftBtn').addEventListener('click', () => {
      localStorage.removeItem('tactical-web-draft-prompt');
      localStorage.removeItem('tactical-web-draft-game');
      byId('quickPrompt').value = '';
      byId('launchCount').textContent = '0 / 600';
      toast('Saved generation draft cleared.');
    });
    byId('resetVisitsBtn').addEventListener('click', () => {
      set('tactical-web-visit-count', '0');
      refresh();
      toast('Visit counter reset.');
    });
    byId('resetNewsletterBtn').addEventListener('click', () => {
      localStorage.removeItem('tactical-web-newsletter-subscribed');
      localStorage.removeItem('tactical-web-newsletter-dismissed-at');
      toast('Newsletter state reset.');
    });
    byId('copySummaryBtn').addEventListener('click', async () => {
      const summary = `Tactical Web workspace\nPresets: ${getNumber('tactical-web-preset-count')}\nCredits: ${window.TacticalCredits?.getSnapshot?.().credits || 0}\nVisits: ${getNumber('tactical-web-visit-count')}\nActivity entries: ${activities().length}\nStorage: ${Math.ceil(storageSize() / 1024)} KB`;
      try { await navigator.clipboard.writeText(summary); toast('Workspace summary copied.'); }
      catch (_) { toast('Clipboard access is unavailable.'); }
    });
    byId('userLookupForm').addEventListener('submit', (event) => { event.preventDefault(); manageUser('lookup'); });
    byId('addCreditsBtn').addEventListener('click', () => manageUser('add'));
    byId('removeCreditsBtn').addEventListener('click', () => manageUser('remove'));
    byId('banUserBtn').addEventListener('click', () => {
      if (confirm(`Ban ${byId('managedEmail').value.trim()} from generation and agent access?`)) manageUser('ban');
    });
    byId('unbanUserBtn').addEventListener('click', () => manageUser('unban'));
    byId('savePreferencesBtn').addEventListener('click', () => {
      const preferences = {
        defaultGame: byId('defaultGame').value.trim(),
        quality: byId('defaultQuality').value,
        hardware: byId('defaultHardware').value,
        compact: byId('compactMode').getAttribute('aria-pressed') === 'true'
      };
      set('tactical-web-preferences', JSON.stringify(preferences));
      toast('Workspace preferences saved.');
    });
    byId('compactMode').addEventListener('click', (event) => {
      const pressed = event.currentTarget.getAttribute('aria-pressed') === 'true';
      event.currentTarget.setAttribute('aria-pressed', String(!pressed));
      document.body.classList.toggle('dashboard-compact', !pressed);
    });
    byId('exportDataBtn').addEventListener('click', exportData);
    byId('importDataBtn').addEventListener('click', () => byId('importFile').click());
    byId('importFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importData(file); } catch (error) { toast(error.message || 'The backup could not be imported.'); }
      event.target.value = '';
    });
    byId('refreshBtn').addEventListener('click', () => { refresh(); loadBillingPlan(); toast('Dashboard refreshed.'); });
    byId('storageSearch').addEventListener('input', renderStorage);
    byId('clearPreferencesBtn').addEventListener('click', () => {
      localStorage.removeItem('tactical-web-preferences');
      loadPreferences();
      toast('Preferences reset.');
    });
    byId('signOutBtn').addEventListener('click', () => {
      window.TacticalSignIn?.signOut?.();
      window.location.replace('index.html');
    });
    window.addEventListener('tw-credits-changed', refresh);
    window.addEventListener('online', runDiagnostics);
    window.addEventListener('offline', runDiagnostics);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        byId('activitySearch').focus();
      }
    });
    loadPreferences();
    const savedDraft = get('tactical-web-draft-prompt');
    byId('quickPrompt').value = savedDraft;
    byId('launchCount').textContent = `${savedDraft.length} / 600`;
    refresh();
    loadBillingPlan();
  }

  function loadPreferences() {
    const preferences = getJson('tactical-web-preferences', {});
    byId('defaultGame').value = preferences.defaultGame || '';
    byId('defaultQuality').value = preferences.quality || 'balanced';
    byId('defaultHardware').value = preferences.hardware || 'mid';
    byId('compactMode').setAttribute('aria-pressed', String(Boolean(preferences.compact)));
    document.body.classList.toggle('dashboard-compact', Boolean(preferences.compact));
    byId('quickGame').value = preferences.defaultGame || get('tactical-web-draft-game');
    const selectedModel = get('tactical-web-selected-model', 'Auto');
    if (Array.from(byId('quickModel').options).some((option) => option.value === selectedModel)) byId('quickModel').value = selectedModel;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
