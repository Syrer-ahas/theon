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
    byId('profilePlan').textContent = get('tactical-web-selected-plan', 'Free');
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
    });
    byId('exportDataBtn').addEventListener('click', exportData);
    byId('importDataBtn').addEventListener('click', () => byId('importFile').click());
    byId('importFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importData(file); } catch (error) { toast(error.message || 'The backup could not be imported.'); }
      event.target.value = '';
    });
    byId('refreshBtn').addEventListener('click', () => { refresh(); toast('Dashboard refreshed.'); });
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
    loadPreferences();
    refresh();
  }

  function loadPreferences() {
    const preferences = getJson('tactical-web-preferences', {});
    byId('defaultGame').value = preferences.defaultGame || '';
    byId('defaultQuality').value = preferences.quality || 'balanced';
    byId('defaultHardware').value = preferences.hardware || 'mid';
    byId('compactMode').setAttribute('aria-pressed', String(Boolean(preferences.compact)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
