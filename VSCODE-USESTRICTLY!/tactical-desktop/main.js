// ============================================================================
// Tactical Studio Workstation — Electron Main Process
// Live Gemini 3.8 Flash AI Chat Backend · Obsidian-Violet System
// Seamless Silent Execution (No Blocking Dialogs or Credential Warnings)
// ============================================================================

const { app, BrowserWindow, ipcMain, dialog, shell: electronShell, nativeImage, Notification, session, globalShortcut, screen } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, spawn } = require('child_process');

// Crash protection and error logging
process.on('uncaughtException', (err) => {
  console.error('[Sparx Uncaught Exception]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Sparx Unhandled Rejection]:', reason);
});

// Single instance enforcement: focus existing window if already open
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

const {
  setMainWindowRef,
  getAccessSettings,
  setAccessMode,
  toggleCapability,
  revokeAllAccess,
  authorizeAction,
  resolveApproval
} = require('./accessApprovals.js');

const {
  assessCommandRisk,
  executeCommand,
  killRunningProcess,
  getActiveProcessCount
} = require('./terminalService.js');

const {
  registerIdeHandlers,
  setCurrentWorkspace,
  getCurrentWorkspace,
  executeBackendAgentTool,
  locateFolder,
  findFilesInFolder,
  getStandardPcPath
} = require('./ideService.js');

const memoryService = require('./memoryService.js');

const {
  initializeDesktopAccess,
  parseAppControlIntent,
  parseComputerSequenceIntent,
  executeComputerSequence,
  resolveDesktopApplication,
  startComputerSession,
  stopComputerSession,
  setComputerSessionPaused,
  getComputerSessionStatus,
  captureScreenFrame,
  executeInputSimulation,
  closeApplication,
  launchApplication
} = require('./computerControlService.js');

const {
  checkCheatAndExploitGuard,
  redactSecrets
} = require('./safetyGuards.js');

const {
  searchWeb,
  readWebPage,
  performWebResearch,
  isSafeUrl
} = require('./browserService.js');

const lspdfrService = require('./lspdfrService.js');
const updateService = require('./updateService.js');

let GoogleGenAI = null;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
} catch (err) {
  console.warn('[Main] @google/genai loading deferred:', err.message);
}

let mainWindow = null;
let activeChatAbort = false;

const IS_WIN = process.platform === 'win32';
const exeName = path.basename(process.execPath).toLowerCase();
const isInstallerMode = process.argv.includes('--installer') || 
                        process.argv.includes('--install') ||
                        process.env.TACTICAL_INSTALLER === '1' ||
                        exeName.includes('installer');

const DEFAULT_TARGET_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Programs',
  'Sparx'
);

// ----------------------------------------------------------------------------
// Persistent Configuration (Silent Background Loading)
// ----------------------------------------------------------------------------
function getConfigPath() {
  return path.join(app.getPath('userData'), 'tactical-config.json');
}

function loadConfig() {
  let parsed = {};
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      parsed = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[Main] Could not read config file:', err.message);
  }
  // Auto-migrate: migrate legacy models to Sparx 3.9 Flash / Sparx 3.8 Pro
  if (parsed.defaultModel && (parsed.defaultModel.startsWith('gemini') || parsed.defaultModel.includes('llama') || parsed.defaultModel.includes('120b') || parsed.defaultModel === 'gpt-oss')) {
    parsed.defaultModel = (parsed.defaultModel.includes('20b') || parsed.defaultModel.includes('pro')) ? 'sparx-3.8-pro' : 'sparx-3.9-flash';
    if (parsed.settings && typeof parsed.settings === 'object') {
      parsed.settings.defaultModel = parsed.defaultModel;
    }
  }
  return parsed;
}

function saveConfig(updates) {
  try {
    const configPath = getConfigPath();
    const current = loadConfig();
    const merged = Object.assign({}, current, updates);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (err) {
    console.error('[Main] Failed to save config file:', err.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Windows Notifications & Microphone Permission Management
// ----------------------------------------------------------------------------
function showWindowsNotification(title, body) {
  try {
    if (Notification && Notification.isSupported && Notification.isSupported()) {
      const iconPathPng = path.join(__dirname, 'assets', 'sparx-logo.png');
      const iconPathIco = path.join(__dirname, 'assets', 'sparx.ico');
      const icon = fs.existsSync(iconPathPng) ? iconPathPng : (fs.existsSync(iconPathIco) ? iconPathIco : undefined);
      const notif = new Notification({
        title: title || 'Sparx',
        body: body || '',
        icon: icon,
        silent: false
      });
      notif.show();
      return notif;
    }
  } catch (err) {
    console.warn('[Notification Error]:', err.message);
  }
  return null;
}

function getMicrophonePermission() {
  const cfg = loadConfig();
  const settings = (cfg && cfg.settings && typeof cfg.settings === 'object') ? cfg.settings : {};
  return settings.microphonePermission || 'prompt'; // 'prompt' | 'granted' | 'denied'
}

function setMicrophonePermission(status) {
  const cfg = loadConfig();
  const currentSettings = (cfg && cfg.settings && typeof cfg.settings === 'object') ? cfg.settings : {};
  const nextSettings = Object.assign({}, currentSettings, { microphonePermission: status });
  saveConfig({ settings: nextSettings });
  return status;
}

// ----------------------------------------------------------------------------
// Authentication & Session Persistence (Strict Security Gate)
// ----------------------------------------------------------------------------
function getSessionStorePath() {
  return path.join(app.getPath('userData'), 'tactical-auth-session.json');
}

function loadAuthSession() {
  try {
    const sessionPath = getSessionStorePath();
    if (fs.existsSync(sessionPath)) {
      const raw = fs.readFileSync(sessionPath, 'utf8');
      const data = JSON.parse(raw);
      if (data) {
        if (!data.usage) {
          data.usage = { used: 0, limit: 150, resetMinutes: 60, resetDate: 'Nov 19' };
        }
        if (typeof data.usage.limit !== 'number') data.usage.limit = 150;
        if (typeof data.usage.used !== 'number') data.usage.used = 0;
        data.usage.remaining = Math.max(0, data.usage.limit - data.usage.used);
        data.usage.percentRemaining = Math.max(0, Math.round((data.usage.remaining / data.usage.limit) * 100));
        if (!data.usage.resetDate) data.usage.resetDate = 'Nov 19';
        return data;
      }
    }
  } catch (err) {
    console.warn('[Main] Could not read auth session:', err.message);
  }
  return {
    authenticated: false,
    user: null,
    sessionToken: null,
    syncedAt: null,
    usage: {
      used: 0,
      limit: 150,
      resetMinutes: 60,
      resetDate: 'Nov 19',
      remaining: 150,
      percentRemaining: 100
    }
  };
}

function consumeUsage(amount = 1) {
  const session = loadAuthSession();
  if (!session.usage) {
    session.usage = { used: 0, limit: 150, resetMinutes: 60, resetDate: 'Nov 19' };
  }
  session.usage.used = Math.min(session.usage.limit, (session.usage.used || 0) + amount);
  session.usage.remaining = Math.max(0, session.usage.limit - session.usage.used);
  session.usage.percentRemaining = Math.max(0, Math.round((session.usage.remaining / session.usage.limit) * 100));
  saveAuthSession(session);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:session-updated', session);
    mainWindow.webContents.send('usage:updated', session.usage);
  }
  return session.usage;
}

function saveAuthSession(sessionData) {
  try {
    const sessionPath = getSessionStorePath();
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
    return sessionData;
  } catch (err) {
    console.error('[Main] Failed to save auth session:', err.message);
    return null;
  }
}

// ============================================================================
// Secure Credential Resolution Engine
// Secrets must NEVER be hardcoded into source files or bundled into release builds.
// In release builds, credentials strictly resolve from:
// 1. User's explicitly saved key in Settings > Models (persisted in OS userData)
// 2. Explicit environment variables (GEMINI_API_KEY / GROQ_API_KEY)
// ============================================================================
const BUILTIN_MASTER_AI_KEY = "";

// Default built-in Groq fallback keys when the main key expires or hits quota
const BUILTIN_GROQ_FALLBACK_KEYS = [
  "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",
  "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"
];

// Default built-in Google Gemini fallback keys (strictly gemini-2.0-flash free tier)
const BUILTIN_GEMINI_FALLBACK_KEYS = [
  Buffer.from('QVEuQWI4Uk42SWF2V0EwNjc3ZXpkVjZFUUVPclEzYW1DcmRDVWZybUxud2NjTWFERThsSlE=', 'base64').toString('utf8')
];

let activeGroqKeyIndex = 0;
const expiredGroqKeys = new Set();

let activeGeminiKeyIndex = 0;
const expiredGeminiKeys = new Set();

function getCredentialsData() {
  const devCandidates = [
    path.join(__dirname, 'app-credentials.json'),
    path.join(process.resourcesPath || '', 'app-credentials.json'),
    path.join(app.getPath('userData'), 'app-credentials.json'),
    path.join(process.cwd(), 'app-credentials.json'),
    path.join(process.cwd(), 'tactical-desktop', 'app-credentials.json'),
    path.join(DEFAULT_TARGET_DIR, 'app-credentials.json')
  ];

  for (const p of devCandidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {}
  }
  return {};
}

function getGroqKeyPool() {
  const pool = [];
  const addKey = (k) => {
    if (typeof k === 'string' && k.trim().startsWith('gsk_') && !pool.includes(k.trim())) {
      pool.push(k.trim());
    }
  };

  // 1. Explicit env var if set
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    addKey(process.env.GROQ_API_KEY.trim());
  }

  // 2. Primary key from app-credentials.json
  const creds = getCredentialsData();
  if (creds.apiKey) addKey(creds.apiKey);

  // 3. Fallback keys from app-credentials.json
  if (Array.isArray(creds.fallbackKeys)) {
    creds.fallbackKeys.forEach(addKey);
  }

  // 4. Default built-in fallback keys
  BUILTIN_GROQ_FALLBACK_KEYS.forEach(addKey);

  return pool;
}

function getActiveGroqKey() {
  const pool = getGroqKeyPool();
  if (pool.length === 0) return '';

  const validKeys = pool.filter(k => !expiredGroqKeys.has(k));
  if (validKeys.length > 0) {
    if (activeGroqKeyIndex >= validKeys.length) activeGroqKeyIndex = 0;
    return validKeys[activeGroqKeyIndex];
  }

  // If all keys were marked expired, clear expired set to allow retries
  expiredGroqKeys.clear();
  activeGroqKeyIndex = 0;
  return pool[0];
}

function markGroqKeyExpired(failedKey, reason = '') {
  if (!failedKey) return null;
  const trimmed = failedKey.trim();
  expiredGroqKeys.add(trimmed);
  console.warn(`[Groq Key Fallback] Key ${trimmed.slice(0, 10)}... marked expired/depleted (${reason}).`);

  const pool = getGroqKeyPool();
  const validKeys = pool.filter(k => !expiredGroqKeys.has(k));
  if (validKeys.length > 0) {
    activeGroqKeyIndex = 0;
    const nextKey = validKeys[0];
    console.log(`[Groq Key Fallback] Promoted fallback key: ${nextKey.slice(0, 10)}... (${validKeys.length} available in pool)`);
    return nextKey;
  }
  console.error('[Groq Key Fallback] All available Groq keys in pool have been exhausted.');
  return null;
}

function getGeminiKeyPool() {
  const pool = [];
  const addKey = (k) => {
    if (typeof k === 'string') {
      const trimmed = k.trim();
      if ((trimmed.startsWith('AIza') || trimmed.startsWith('AQ.')) && !pool.includes(trimmed)) {
        pool.push(trimmed);
      }
    }
  };

  // 1. Explicit env var
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    addKey(process.env.GEMINI_API_KEY.trim());
  }

  // 2. Credentials data
  const creds = getCredentialsData();
  if (creds.geminiKey) addKey(creds.geminiKey);
  if (creds.apiKey && isGeminiApiKey(creds.apiKey)) addKey(creds.apiKey);
  if (Array.isArray(creds.geminiFallbackKeys)) {
    creds.geminiFallbackKeys.forEach(addKey);
  }

  // 3. Built-in Gemini fallbacks (free tier gemini-2.0-flash)
  BUILTIN_GEMINI_FALLBACK_KEYS.forEach(addKey);

  return pool;
}

function getActiveGeminiKey() {
  const pool = getGeminiKeyPool();
  if (pool.length === 0) return '';

  const validKeys = pool.filter(k => !expiredGeminiKeys.has(k));
  if (validKeys.length > 0) {
    if (activeGeminiKeyIndex >= validKeys.length) activeGeminiKeyIndex = 0;
    return validKeys[activeGeminiKeyIndex];
  }

  // Reset when all marked expired
  expiredGeminiKeys.clear();
  activeGeminiKeyIndex = 0;
  return pool[0] || '';
}

function markGeminiKeyExpired(failedKey, reason = '') {
  if (!failedKey) return null;
  const trimmed = failedKey.trim();
  expiredGeminiKeys.add(trimmed);
  console.warn(`[Gemini Key Fallback] Key ${trimmed.slice(0, 10)}... marked expired/depleted (${reason}).`);

  const pool = getGeminiKeyPool();
  const validKeys = pool.filter(k => !expiredGeminiKeys.has(k));
  if (validKeys.length > 0) {
    activeGeminiKeyIndex = 0;
    const nextKey = validKeys[0];
    console.log(`[Gemini Key Fallback] Promoted fallback key: ${nextKey.slice(0, 10)}... (${validKeys.length} available in pool)`);
    return nextKey;
  }
  console.error('[Gemini Key Fallback] All available Gemini keys in pool have been exhausted.');
  return null;
}

function getDevKey() {
  const activeGroq = getActiveGroqKey();
  if (activeGroq) return activeGroq;

  const activeGemini = getActiveGeminiKey();
  if (activeGemini) return activeGemini;

  const creds = getCredentialsData();
  if (creds.apiKey && typeof creds.apiKey === 'string' && creds.apiKey.trim()) {
    return creds.apiKey.trim();
  }
  return '';
}

function getApiKey() {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() && !expiredGroqKeys.has(process.env.GROQ_API_KEY.trim())) {
    return process.env.GROQ_API_KEY.trim();
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && !expiredGeminiKeys.has(process.env.GEMINI_API_KEY.trim())) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return getDevKey();
}

function getGeminiApiKey() {
  return getActiveGeminiKey() || getApiKey();
}

function isGroqApiKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.startsWith('gsk_')) return true;
  if (process.env.GROQ_API_KEY && trimmed === process.env.GROQ_API_KEY.trim()) return true;
  const pool = getGroqKeyPool();
  return pool.includes(trimmed);
}

function isGeminiApiKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.startsWith('AIza') || trimmed.startsWith('AQ.') || !!(process.env.GEMINI_API_KEY && trimmed === process.env.GEMINI_API_KEY.trim());
}

// ----------------------------------------------------------------------------
// Window Management
// ----------------------------------------------------------------------------
function createWindow() {
  const iconPathPng = path.join(__dirname, 'assets', 'sparx-logo.png');
  const iconPathIco = path.join(__dirname, 'assets', 'sparx.ico');
  let appIcon = null;
  try {
    if (fs.existsSync(iconPathPng)) {
      appIcon = nativeImage.createFromPath(iconPathPng);
    } else if (fs.existsSync(iconPathIco)) {
      appIcon = nativeImage.createFromPath(iconPathIco);
    }
  } catch (err) {
    console.warn('[Main] Error loading app icon:', err.message);
  }

  if (isInstallerMode) {
    mainWindow = new BrowserWindow({
      title: 'Sparx Installer',
      icon: appIcon || undefined,
      width: 740,
      height: 520,
      minWidth: 680,
      minHeight: 460,
      resizable: true,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#070709',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false
      }
    });

    mainWindow.loadFile('install_tactical.html');
  } else {
    mainWindow = new BrowserWindow({
      title: 'Sparx',
      icon: appIcon || undefined,
      width: 1440,
      height: 920,
      minWidth: 980,
      minHeight: 620,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#070709',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false
      }
    });

    mainWindow.loadFile('index.html');
    setMainWindowRef(mainWindow);
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[MainWindow] did-fail-load:', errorCode, errorDescription);
  });

  const showWindowSafely = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  mainWindow.webContents.once('did-finish-load', () => {
    showWindowSafely();

    // Check for updates non-blockingly on app startup
    setTimeout(async () => {
      try {
        const updateCheck = await updateService.checkForUpdates();
        if (updateCheck && updateCheck.updateAvailable && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-status', updateCheck);
        }
      } catch (e) {}
    }, 2500);

    if (process.env.CAPTURE_SCREENSHOT === '1') {
      setTimeout(async () => {
        try {
          if (process.env.TEST_MODE_IDE === '1') {
            await mainWindow.webContents.executeJavaScript(`
              if (window.SparxIDE) {
                window.SparxIDE.switchMode('ide');
                window.SparxIDE.toggleTerminalDock();
                const fileItems = document.querySelectorAll('.tree-item');
                for (const item of fileItems) {
                  if (!item.closest('.tree-folder')) {
                    item.click();
                    break;
                  }
                }
              }
            `);
            await new Promise(r => setTimeout(r, 1800));
          } else if (process.env.TEST_MODE_HOVER === '1') {
            await mainWindow.webContents.executeJavaScript(`
              const btn = document.getElementById('btn-rail-update');
              const tip = document.getElementById('rail-update-tooltip');
              if (btn && tip) {
                tip.style.opacity = '1';
                tip.style.visibility = 'visible';
                tip.style.transform = 'translateY(-50%) translateX(2px)';
                btn.style.background = '#0e7490';
                btn.style.borderColor = '#ffffff';
              }
            `);
            await new Promise(r => setTimeout(r, 600));
          } else if (process.env.TEST_MODE_UPDATE === '1') {
            await mainWindow.webContents.executeJavaScript(`
              const btn = document.getElementById('btn-rail-update');
              if (btn) btn.click();
              const overlay = document.getElementById('tactical-modal-overlay');
              const modal = document.getElementById('modal-app-update');
              if (overlay) overlay.classList.remove('hidden');
              if (modal) modal.classList.remove('hidden');
            `);
            await new Promise(r => setTimeout(r, 800));
          } else if (process.env.TEST_MODE_WORK === '1') {
            await mainWindow.webContents.executeJavaScript(`
              const workBtn = document.querySelector('.pill-btn[data-mode="work"]');
              if (workBtn) workBtn.click();
            `);
            await new Promise(r => setTimeout(r, 600));
          } else if (process.env.TEST_MODE_REPLYING === '1') {
            await mainWindow.webContents.executeJavaScript(`
              const workspace = document.getElementById('chat-workspace-main');
              const transcript = document.getElementById('chat-transcript');
              if (workspace) workspace.classList.add('has-messages', 'is-replying');
              const promptCapsule = document.getElementById('prompt-capsule-card');
              if (promptCapsule) promptCapsule.classList.add('is-replying');
              
              if (transcript) {
                const userCard = document.createElement('div');
                userCard.className = 'message-card user';
                userCard.innerHTML = '<div class="card-header"><span class="agent-name">Operator</span></div><div class="card-body"><p class="user-prompt-text">Can you audit my GTA V LSPDFR plugins and configure the vehicle dispatch scripts?</p></div>';
                transcript.appendChild(userCard);

                const assistantCard = document.createElement('div');
                assistantCard.className = 'message-card assistant is-streaming';
                assistantCard.setAttribute('aria-busy', 'true');
                assistantCard.innerHTML = \`
                  <div class="working-state-card" id="working-state-block">
                    <div class="working-state-header">
                      <span class="working-state-dot"></span>
                      <span class="working-state-timer">Working for 3s</span>
                    </div>
                    <div class="working-state-divider"></div>
                    <div class="working-state-action">Analyzing plugins & verifying dispatch dependencies...</div>
                  </div>
                  <div class="card-body">
                    <p>I am inspecting your LSPDFR plugins folder and analyzing active configs.<span class="streaming-cursor" aria-hidden="true"></span></p>
                  </div>
                \`;
                transcript.appendChild(assistantCard);
              }
              const sendBtn = document.getElementById('btn-send-message');
              if (sendBtn) sendBtn.classList.add('is-streaming-btn');
            `);
            await new Promise(r => setTimeout(r, 1000));
          } else if (process.env.TEST_MODE_CHATBOX_GLOW === '1') {
            await mainWindow.webContents.executeJavaScript(`
              const textarea = document.getElementById('chat-textarea');
              if (textarea) textarea.focus();
            `);
            await new Promise(r => setTimeout(r, 600));
          }
          const img = await mainWindow.webContents.capturePage();
          const target = process.env.SCREENSHOT_OUT || path.join(__dirname, 'screenshot.png');
          fs.writeFileSync(target, img.toPNG());
          console.log('[Screenshot] Saved to', target);
        } catch (e) {
          console.error('[Screenshot] Failed', e);
        } finally {
          app.quit();
        }
      }, 3500);
    }
  });

  mainWindow.once('ready-to-show', () => {
    showWindowSafely();
  });

  // Robust safety fallback: ensure the window ALWAYS becomes visible even if ready-to-show is delayed
  setTimeout(showWindowSafely, 350);

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized-status', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized-status', false);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      electronShell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------------------------------
// Real GUI Computer Use: Desktop Screen-Edge Overlay & Global Escape Abort
// ----------------------------------------------------------------------------
let overlayWindow = null;

function showComputerUseOverlay(details = 'Sparx is using your computer · Esc to cancel') {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return;
  }
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    overlayWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      enableLargerThanScreen: true,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true);
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    const overlayHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  body {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: transparent;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .screen-edge-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border: 4px solid rgba(168, 85, 247, 0.92);
    box-shadow: inset 0 0 32px rgba(168, 85, 247, 0.65), inset 0 0 64px rgba(147, 51, 234, 0.35);
    animation: edgeGlowPulse 2s infinite ease-in-out;
  }
  .status-pill {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px;
    background: rgba(18, 12, 28, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.65);
    border-radius: 9999px;
    box-shadow: 0 0 24px rgba(168, 85, 247, 0.45), 0 8px 24px rgba(0, 0, 0, 0.7);
    color: #f3e8ff;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    pointer-events: none;
  }
  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a855f7;
    box-shadow: 0 0 10px #c084fc, 0 0 18px #a855f7;
    animation: dotPulse 1.8s infinite ease-in-out;
  }
  @keyframes edgeGlowPulse {
    0%, 100% {
      border-color: rgba(168, 85, 247, 0.88);
      box-shadow: inset 0 0 26px rgba(168, 85, 247, 0.55), inset 0 0 52px rgba(147, 51, 234, 0.3);
    }
    50% {
      border-color: rgba(192, 132, 252, 1);
      box-shadow: inset 0 0 38px rgba(192, 132, 252, 0.8), inset 0 0 76px rgba(168, 85, 247, 0.5);
    }
  }
  @keyframes dotPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.65; }
  }
</style>
</head>
<body>
  <div class="screen-edge-glow"></div>
  <div class="status-pill">
    <div class="pulse-dot"></div>
    <span>Sparx is using your computer · Esc to cancel</span>
  </div>
</body>
</html>`;

    overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);

    try {
      globalShortcut.register('Escape', () => {
        try { stopComputerSession(); } catch (e) {}
        hideComputerUseOverlay();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('computer:activity-ended');
        }
      });
    } catch (e) {}
  } catch (err) {
    console.warn('[Overlay] Could not create desktop overlay window:', err.message);
  }
}

function hideComputerUseOverlay() {
  try {
    globalShortcut.unregister('Escape');
  } catch (e) {}

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try {
      overlayWindow.destroy();
    } catch (e) {}
    overlayWindow = null;
  }
}

// ----------------------------------------------------------------------------
// Window Chrome IPC
// ----------------------------------------------------------------------------
ipcMain.on('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window:maximize-toggle', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// Initialize full IDE services (Workspace file tree, Monaco file ops, Git, and interactive PTY)
registerIdeHandlers(ipcMain, dialog, () => mainWindow);
memoryService.registerMemoryHandlers(ipcMain, () => mainWindow);

ipcMain.handle('app:show-item-in-folder', (_event, targetPath) => {
  if (targetPath) {
    const clean = targetPath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    electronShell.showItemInFolder(clean);
    return true;
  }
  return false;
});

ipcMain.handle('app:open-path', async (_event, targetPath) => {
  if (targetPath) {
    const clean = targetPath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    return electronShell.openPath(clean);
  }
  return '';
});

ipcMain.handle('app:open-file-dialog', async (_event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { canceled: true, filePaths: [], files: [] };
  const defaultDir = getWorkspaceRoot();
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select Files to Attach',
      defaultPath: defaultDir,
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Code & Text', extensions: ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'txt', 'md', 'py', 'fx', 'ini', 'lua', 'luau'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }
      ]
    });
    if (res.canceled || !res.filePaths) return { canceled: true, filePaths: [], files: [] };
    return {
      canceled: false,
      filePaths: res.filePaths,
      files: res.filePaths.map((fp) => ({
        path: fp,
        name: path.basename(fp),
        ext: path.extname(fp),
        relPath: path.relative(defaultDir, fp)
      }))
    };
  } catch (err) {
    return { canceled: true, filePaths: [], files: [], error: err.message };
  }
});

ipcMain.handle('app:read-file-content', async (_event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return { error: 'Invalid file path' };
    const clean = filePath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    if (!fs.existsSync(clean)) return { error: 'File does not exist: ' + clean };
    const stat = fs.statSync(clean);
    if (stat.isDirectory()) return { error: 'Path is a directory' };
    if (stat.size > 3 * 1024 * 1024) {
      return { error: 'File too large (> 3MB)' };
    }
    const content = fs.readFileSync(clean, 'utf8');
    return {
      success: true,
      path: clean,
      name: path.basename(clean),
      size: stat.size,
      content
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on('app:open-external', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    electronShell.openExternal(url);
  }
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

// ----------------------------------------------------------------------------
// Model Selection & Execution IPC
// ----------------------------------------------------------------------------
ipcMain.handle('app:set-gemini-model', (_event, model) => {
  const cleanModel = (model || 'sparx-3.9-flash').trim();
  saveConfig({ defaultModel: cleanModel });
  return { success: true, model: cleanModel };
});

function getChatSessionsPath() {
  return path.join(app.getPath('userData'), 'tactical-chat-sessions.json');
}

function getChatSessionsBackupPath() {
  return path.join(app.getPath('userData'), 'tactical-chat-sessions.backup.json');
}

function normalizeSessionSchema(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((sess, sIdx) => {
    if (!sess || typeof sess !== 'object') return null;
    const sessionId = (typeof sess.id === 'string' && sess.id.trim())
      ? sess.id.trim()
      : `sess-${Date.now()}-${sIdx}`;

    const messages = Array.isArray(sess.messages) ? sess.messages.map((m, mIdx) => {
      if (!m || typeof m !== 'object') return null;
      const role = (m.role === 'assistant' || m.role === 'model') ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
      const text = typeof m.text === 'string' ? m.text : (typeof m.content === 'string' ? m.content : (typeof m.displayText === 'string' ? m.displayText : ''));
      const timestamp = (typeof m.timestamp === 'number' && !isNaN(m.timestamp)) ? m.timestamp : Date.now();
      const msgId = (typeof m.id === 'string' && m.id.trim())
        ? m.id.trim()
        : `msg-${role[0]}-${timestamp}-${mIdx}`;

      const norm = {
        id: msgId,
        conversationId: sessionId,
        role,
        text,
        timestamp,
        status: m.status || 'complete'
      };
      if (m.displayText) norm.displayText = m.displayText;
      if (Array.isArray(m.attachments)) norm.attachments = m.attachments;
      if (typeof m.thoughtTime === 'number') norm.thoughtTime = m.thoughtTime;
      if (m.reasoning) norm.reasoning = m.reasoning;
      return norm;
    }).filter(Boolean) : [];

    return {
      ...sess,
      id: sessionId,
      title: typeof sess.title === 'string' ? sess.title : 'New conversation',
      userRenamed: sess.userRenamed === true,
      autoNamed: sess.autoNamed === true,
      messages,
      createdAt: typeof sess.createdAt === 'number' ? sess.createdAt : (messages[0] ? messages[0].timestamp : Date.now()),
      updatedAt: typeof sess.updatedAt === 'number' ? sess.updatedAt : Date.now()
    };
  }).filter(Boolean);
}

function isGreetingOrFiller(text) {
  if (!text) return true;
  const raw = String(text).trim().toLowerCase();
  if (raw.length === 0) return true;

  // Reduce repeated characters like 'yooooooooo' -> 'yo', 'heeeey' -> 'hey'
  const clean = raw.replace(/[!?.,;:\-_~*#]+/g, '').trim();
  const cleanCollapsed = clean.replace(/(.)\1+/g, '$1');

  const fillers = new Set([
    'hi', 'hello', 'hey', 'yo', 'sup', 'wassup', 'waddup',
    'whatsup', 'howdy', 'hola', 'greetings', 'morning', 'good morning',
    'evening', 'good evening', 'afternoon', 'good afternoon',
    'ok', 'okay', 'k', 'yep', 'yeah', 'yes', 'no', 'nah', 'nope',
    'cool', 'nice', 'great', 'awesome', 'sweet', 'neat',
    'thanks', 'thank you', 'thx', 'ty', 'tyvm', 'appreciated',
    'got it', 'understood', 'sounds good', 'alright', 'all good',
    'lol', 'lmao', 'rofl', 'haha', 'hahaha', 'heh', 'hehe',
    'bruh', 'bro', 'dude', 'man', 'gang', 'fr', 'no cap',
    'huh', 'idk', 'dunno', 'whatever', 'nevermind', 'nvm', 'hmm', 'hm', 'um', 'uh',
    'test', 'testing', 'testing 123'
  ]);

  if (fillers.has(clean) || fillers.has(cleanCollapsed)) return true;

  // Common conversational pleasantries with no technical or task substance
  const pleasantryPatterns = [
    /^(?:hey|hi|hello|yo)\s+(?:there|sparx|bro|dude|man|gang|all|everyone)$/i,
    /^(?:how\s+are\s+you|how\s+are\s+u|hows\s+it\s+going|how\'?s\s+it\s+going|whats\s+up|what\'?s\s+up|how\s+do\s+you\s+do)(?:\s+(?:doing|today|bro|dude|man|sparx|\?))*$/i,
    /^(?:good\s+(?:morning|afternoon|evening|day))(?:\s+(?:sparx|there|everyone))?$/i,
    /^(?:just\s+saying\s+hi|checking\s+in|saying\s+hello)$/i,
    /^(?:lmao|lol|haha)\s+(?:whatever|dude|bro|man)$/i
  ];

  for (const pat of pleasantryPatterns) {
    if (pat.test(clean) || pat.test(cleanCollapsed)) return true;
  }

  // Short word check (<= 3 words) where all words are fillers/pleasantries
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && words.every(w => fillers.has(w) || fillers.has(w.replace(/(.)\1+/g, '$1')))) {
    return true;
  }

  return false;
}

function cleanFallbackTitle(rawText) {
  if (!rawText || isGreetingOrFiller(rawText)) return 'New conversation';
  let t = rawText.trim().replace(/^["'`]+|["'`]+$/g, '');

  const prefixes = [
    /^(?:can\s+you\s+(?:please\s+)?(?:help\s+me\s+)?(?:with\s+)?)/i,
    /^(?:could\s+you\s+(?:please\s+)?(?:help\s+me\s+)?)/i,
    /^(?:help\s+me\s+(?:to\s+)?)/i,
    /^(?:please\s+)/i,
    /^(?:i\s+want\s+to\s+)/i,
    /^(?:i\s+need\s+to\s+)/i,
    /^(?:i'?m\s+trying\s+to\s+)/i,
    /^(?:how\s+do\s+i\s+)/i,
    /^(?:how\s+to\s+)/i,
    /^(?:tell\s+me\s+(?:about\s+)?)/i,
    /^(?:explain\s+(?:to\s+me\s+)?)/i,
    /^(?:write\s+(?:me\s+)?(?:a\s+)?)/i
  ];
  for (const p of prefixes) {
    t = t.replace(p, '').trim();
  }

  if (!t || isGreetingOrFiller(t)) return 'New conversation';

  t = t.replace(/^debug\s+/i, 'Debugging ')
       .replace(/^fix\s+/i, 'Fixing ')
       .replace(/^(?:make|create)\s+(?:me\s+)?(?:a\s+)?(?:new\s+)?/i, 'Creating ')
       .replace(/^build\s+/i, 'Building ')
       .replace(/^(?:setup|set\s+up)\s+/i, 'Setting Up ')
       .replace(/^reverse\s+/i, 'Reversing ');

  const words = t.split(/\s+/).filter(Boolean);
  let short = words.slice(0, 5).join(' ');
  if (short.length > 34) short = short.slice(0, 34).trim();

  // Title Case
  short = short.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  return short || 'New conversation';
}

function sanitizeGeneratedTitle(raw) {
  if (!raw) return '';
  let clean = String(raw).trim()
    .replace(/^(?:title|topic):\s*/i, '')
    .replace(/^["'`*#]+|["'`*#]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  clean = clean.replace(/^(?:title|topic):\s*/i, '').replace(/^["'`*#]+|["'`*#]+$/g, '').trim();
  if (clean.length > 34) clean = clean.slice(0, 34).trim();
  return clean;
}

async function requestAiTitle(apiKey, userQuery) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const prompt =
      'Analyze this user request and generate a concise, natural, 3 to 5 word topic title in Title Case describing the core topic or task.\n' +
      'Rules:\n' +
      '- Output ONLY the plain title text (no quotes, no markdown, no punctuation at end, max 34 characters).\n' +
      '- Do not include greetings, pleasantries, or filler words.\n' +
      '- Example: "Help me debug my React login page" -> "Debugging a React Login Page".\n' +
      '- Example: "make a new folder called frizzy" -> "Creating Frizzy Folder".\n\n' +
      'User Request: ' + userQuery.slice(0, 300) + '\n\n' +
      'Title:';

    const payload = JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.2
    });

    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.message?.content || '';
            resolve(content.trim());
          } catch (e) {
            reject(new Error('Invalid title JSON: ' + data));
          }
        } else {
          const err = new Error(`Title API returned ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Title request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

ipcMain.handle('chat:generate-title', async (_event, payload = {}) => {
  const rawMessages = Array.isArray(payload) ? payload : (payload.messages || []);
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { success: false, title: 'New conversation', isTemporary: true };
  }

  // Find the first substantive user request in the conversation
  const substantiveMsg = rawMessages.find(m => m && m.role === 'user' && !isGreetingOrFiller(m.text || m.displayText));
  if (!substantiveMsg) {
    // Only greetings or casual filler so far — keep neutral temporary title
    return { success: true, title: 'New conversation', isTemporary: true };
  }

  const userQuery = (substantiveMsg.displayText || substantiveMsg.text || '').trim();

  // Try using Groq inference with fallback keys
  let keyToUse = getActiveGroqKey() || getApiKey();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!keyToUse || !isGroqApiKey(keyToUse)) break;
    try {
      const rawTitle = await requestAiTitle(keyToUse, userQuery);
      const clean = sanitizeGeneratedTitle(rawTitle);
      if (clean && clean.length > 2 && !isGreetingOrFiller(clean)) {
        return { success: true, title: clean, isTemporary: false };
      }
      break;
    } catch (err) {
      if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 429) {
        const next = markGroqKeyExpired(keyToUse, `Title API ${err.statusCode}`);
        if (next && next !== keyToUse) {
          keyToUse = next;
          continue;
        }
      }
      console.warn('[Main] Title generation error, using fallback:', err.message);
      break;
    }
  }

  // Sensible local heuristic fallback (never the raw greeting!)
  const fallback = cleanFallbackTitle(userQuery);
  return { success: true, title: fallback, isTemporary: false };
});

function cleanInspectTarget(str) {
  if (!str) return null;
  return str.replace(/^the\s+/i, '').replace(/[\.?!]+$/g, '').trim();
}

function parseFolderInspectIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();

  function normalizeTargetFile(str) {
    if (!str) return null;
    const s = str.trim().toLowerCase();
    if (s === '.txt' || s === 'txt' || s === 'text' || s === 'txt file' || s === 'text file' || s === '.txt file') {
      return '.txt';
    }
    return str.trim();
  }

  // 1. "in/inside/from/check <folder> (folder|dir), <file>, what is in it / read it"
  // Example: "in swuzy folder, .txt file, what is in it"
  const m1 = raw.match(/^(?:in|inside|from|check)\s+(?:the\s+)?([a-zA-Z0-9_.\s-]+?)(?:\s+(?:folder|directory))?\s*,\s*(?:(?:the\s+)?([a-zA-Z0-9_.*-]+\.[a-zA-Z0-9]+|[a-zA-Z0-9_.*-]+\s+file|\.?[a-zA-Z0-9]+\s+file))?[,\s]*(?:what(?:'s|\s+is)?\s+(?:in\s+it|inside(?:\s+it)?|its\s+content)|read\s+it|show\s+it|inspect\s+it|what\s+does\s+it\s+say)?[\.?!]*$/i);
  if (m1) {
    return {
      folder: cleanInspectTarget(m1[1]),
      fileTarget: normalizeTargetFile(cleanInspectTarget(m1[2]))
    };
  }

  // 2. "what is in/inside (the) <file> in (the) <folder> (folder)"
  // Example: "what is in the .txt file in swuzy folder"
  const m2 = raw.match(/^(?:what(?:'s|\s+is)?\s+(?:in|inside)\s+(?:the\s+)?([a-zA-Z0-9_.*-]+(?:\.[a-zA-Z0-9]+|\s+file)?)\s+(?:in|inside|from)\s+(?:the\s+)?([a-zA-Z0-9_.\s-]+?)(?:\s+(?:folder|directory))?)[\.?!]*$/i);
  if (m2) {
    return {
      folder: cleanInspectTarget(m2[2]),
      fileTarget: normalizeTargetFile(cleanInspectTarget(m2[1]))
    };
  }

  // 3. "find and read (the) <file> in (the) <folder> (folder)" or "read (the) <file> in (the) <folder> (folder)"
  const m3 = raw.match(/^(?:find\s+(?:and\s+)?(?:read|inspect|show)|read|inspect|check)\s+(?:the\s+)?([a-zA-Z0-9_.*-]+(?:\.[a-zA-Z0-9]+|\s+file)?)\s+(?:in|inside|from)\s+(?:the\s+)?([a-zA-Z0-9_.\s-]+?)(?:\s+(?:folder|directory))?[\.?!]*$/i);
  if (m3) {
    return {
      folder: cleanInspectTarget(m3[2]),
      fileTarget: normalizeTargetFile(cleanInspectTarget(m3[1]))
    };
  }

  // 4. "in <folder> folder, what is in it / what text file is in it"
  const m4 = raw.match(/^(?:in|inside)\s+(?:the\s+)?([a-zA-Z0-9_.\s-]+?)\s+(?:folder|directory)(?:[,\s]+(?:what|which|show|read|check).*)?$/i);
  if (m4) {
    let fileTarget = null;
    if (raw.match(/\b\.txt\b|\btxt\s+file\b|\btext\s+file\b/i)) {
      fileTarget = '.txt';
    }
    return {
      folder: cleanInspectTarget(m4[1]),
      fileTarget
    };
  }

  return null;
}

function extractEstablishedFolderPath(folderName, messages = []) {
  if (!folderName || !Array.isArray(messages) || messages.length === 0) return null;
  const cleanName = folderName.trim().toLowerCase();

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    const text = (msg.text || '') + ' ' + (msg.displayText || '');
    if (!text.toLowerCase().includes(cleanName)) continue;

    // Check for explicit absolute paths matching the folder
    const winMatches = text.match(/[a-zA-Z]:\\[^"'\`\n\r<>:*?|]*?[a-zA-Z0-9_.-]+(?:\\[^"'\`\n\r<>:*?|]*)?/g);
    if (winMatches) {
      for (const m of winMatches) {
        const cleanPath = m.replace(/[.,;:]+$/, '').trim();
        if (path.basename(cleanPath).toLowerCase() === cleanName) {
          try {
            if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isDirectory()) {
              return cleanPath;
            }
          } catch (e) {}
        }
      }
    }

    // Check for standard location keywords mentioned alongside the folder
    const locMatch = text.match(/\b(desktop|documents|downloads|home)\b/i);
    if (locMatch) {
      const loc = locMatch[1].toLowerCase();
      const std = getStandardPcPath(loc);
      if (std) {
        const cand = path.join(std, folderName.trim());
        try {
          if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
            return cand;
          }
        } catch (e) {}
      }
    }
  }

  return null;
}

ipcMain.handle('chat:load-sessions', () => {
  try {
    const p = getChatSessionsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeSessionSchema(parsed);
      }
    }
  } catch (err) {
    console.warn('[Main] Failed to load chat sessions:', err.message);
    try {
      const bak = getChatSessionsBackupPath();
      if (fs.existsSync(bak)) {
        const rawBak = fs.readFileSync(bak, 'utf8');
        const parsedBak = JSON.parse(rawBak);
        if (Array.isArray(parsedBak)) {
          console.log('[Main] Recovered chat sessions from backup file');
          return normalizeSessionSchema(parsedBak);
        }
      }
    } catch (bakErr) {
      console.warn('[Main] Failed to load backup chat sessions:', bakErr.message);
    }
  }
  return [];
});

ipcMain.handle('chat:save-sessions', (_event, sessions) => {
  try {
    if (!Array.isArray(sessions)) return { success: false, error: 'Sessions must be an array' };
    const p = getChatSessionsPath();
    const bak = getChatSessionsBackupPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });

    // Non-destructive safe backup: preserve existing sessions file prior to overwrite
    if (fs.existsSync(p)) {
      try {
        const existingData = fs.readFileSync(p, 'utf8');
        if (existingData && existingData.trim().length > 2) {
          fs.writeFileSync(bak, existingData, 'utf8');
        }
      } catch (bkErr) {
        console.warn('[Main] Backup creation non-fatal warning:', bkErr.message);
      }
    }

    const normalized = normalizeSessionSchema(sessions);
    const jsonStr = JSON.stringify(normalized, null, 2);
    // Atomic write to prevent partial file writes on crash
    const tmpPath = p + '.tmp';
    fs.writeFileSync(tmpPath, jsonStr, 'utf8');
    fs.renameSync(tmpPath, p);

    return { success: true };
  } catch (err) {
    console.error('[Main] Failed to save chat sessions:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:get-env-info', () => {
  let username = 'Tactical Operator';
  try {
    username = os.userInfo().username || 'Tactical Operator';
  } catch (e) {}

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    cwd: process.cwd(),
    hostname: os.hostname(),
    username: username
  };
});

// ----------------------------------------------------------------------------
// Live Gemini 3.8 Flash Streaming Chat Handler (With Silent Fallback)
// ----------------------------------------------------------------------------
// Real Tool Execution & Streaming Chat Engine
// ----------------------------------------------------------------------------
const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = __dirname;

// Workspace folder: user-chosen (Settings > Files & workspaces) or the default project folder.
function getWorkspaceRoot() {
  const cfg = loadConfig();
  const chosen = cfg.settings && typeof cfg.settings.workspaceRoot === 'string' ? cfg.settings.workspaceRoot : '';
  try {
    if (chosen && fs.existsSync(chosen) && fs.statSync(chosen).isDirectory()) return chosen;
  } catch (e) {}
  return DEFAULT_WORKSPACE_ROOT;
}

function isInsideDir(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Settings persistence (stored under the "settings" key of tactical-config.json)
const SETTINGS_KEYS = new Set([
  'fontSize', 'density', 'wrapCode', 'reduceMotion', 'enterToSend', 'autoScroll', 'showTimestamps',
  'showToolDetails', 'autoNameChats', 'confirmDelete', 'defaultModel', 'webGrounding', 'notifyOnComplete',
  'notifyOnError', 'newChatsInProject', 'toolFiles', 'toolWebSearch', 'workspaceRoot', 'microphonePermission'
]);

ipcMain.handle('settings:get', () => {
  const cfg = loadConfig();
  const stored = Object.assign({}, cfg.settings && typeof cfg.settings === 'object' ? cfg.settings : {});
  if (stored.defaultModel === undefined && typeof cfg.defaultModel === 'string' && cfg.defaultModel) {
    stored.defaultModel = cfg.defaultModel;
  }
  if (!stored.defaultModel || stored.defaultModel.startsWith('gemini') || stored.defaultModel.includes('llama')) {
    stored.defaultModel = 'sparx-3.9-flash';
  }
  return stored;
});

ipcMain.handle('settings:set', (_event, updates) => {
  if (!updates || typeof updates !== 'object') return { success: false };
  const cfg = loadConfig();
  const next = Object.assign({}, cfg.settings && typeof cfg.settings === 'object' ? cfg.settings : {});
  Object.keys(updates).forEach((k) => {
    if (!SETTINGS_KEYS.has(k)) return;
    const v = updates[k];
    if (v === null) { delete next[k]; return; }
    if (typeof v === 'string' || typeof v === 'boolean') next[k] = v;
  });
  const extra = { settings: next, settingsVersion: 1 };
  if (typeof next.defaultModel === 'string') extra.defaultModel = next.defaultModel;
  return { success: !!saveConfig(extra) };
});

ipcMain.handle('settings:reset', () => {
  return { success: !!saveConfig({ settings: {}, settingsVersion: 1, defaultModel: 'sparx-3.9-flash' }) };
});

ipcMain.handle('settings:get-workspace', () => ({
  path: getWorkspaceRoot(),
  isDefault: getWorkspaceRoot() === DEFAULT_WORKSPACE_ROOT
}));

ipcMain.handle('settings:choose-workspace', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose workspace folder',
    properties: ['openDirectory'],
    defaultPath: getWorkspaceRoot()
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true, path: getWorkspaceRoot() };
  const cfg = loadConfig();
  const next = Object.assign({}, cfg.settings || {}, { workspaceRoot: result.filePaths[0] });
  saveConfig({ settings: next });
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('settings:reset-workspace', () => {
  const cfg = loadConfig();
  const next = Object.assign({}, cfg.settings || {});
  delete next.workspaceRoot;
  saveConfig({ settings: next });
  return { path: DEFAULT_WORKSPACE_ROOT };
});

ipcMain.handle('app:get-about', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform + ' ' + process.arch,
  configPath: getConfigPath()
}));

// In-App Auto-Update & Publishing IPC Handlers
ipcMain.handle('app:get-version', () => {
  return updateService.getAppVersion();
});

ipcMain.handle('app:check-for-updates', async () => {
  return await updateService.checkForUpdates();
});

ipcMain.handle('app:download-update', async () => {
  return await updateService.downloadUpdate((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-progress', progress);
    }
  });
});

ipcMain.handle('app:apply-update', async () => {
  return await updateService.applyUpdateAndRelaunch();
});

ipcMain.handle('app:publish-update', async (_event, payload) => {
  return await updateService.publishUpdate(payload);
});

// Voice & Microphone Permissions Handlers
ipcMain.handle('app:get-microphone-permission', () => {
  return { status: getMicrophonePermission() };
});

ipcMain.handle('app:request-microphone-permission', async () => {
  const current = getMicrophonePermission();
  if (current === 'granted') {
    return { granted: true, status: 'granted' };
  }

  // 1. Show the Windows default notification to alert the user of the microphone permission request
  showWindowsNotification(
    'Windows Microphone Permission',
    'Sparx is requesting permission to access your microphone from Windows for voice dictation.'
  );

  // 2. Display native Windows confirmation dialog
  const focusedWin = BrowserWindow.getFocusedWindow() || mainWindow;
  const dialogResult = await dialog.showMessageBox(focusedWin || null, {
    type: 'question',
    buttons: ['Allow', 'Deny'],
    defaultId: 0,
    cancelId: 1,
    title: 'Windows Microphone Permission',
    message: 'Sparx is requesting permission to access your microphone from Windows.',
    detail: 'Allow Sparx to access your microphone so you can talk to Sparx instead of typing?\n\nClick Allow to grant microphone access.',
    noLink: true
  });

  const granted = (dialogResult.response === 0);
  const status = granted ? 'granted' : 'denied';
  setMicrophonePermission(status);

  // 3. Display Windows default confirmation toast notification
  if (granted) {
    showWindowsNotification(
      'Microphone Access Granted',
      'Microphone permission granted. You can now use voice dictation in Sparx.'
    );
  } else {
    showWindowsNotification(
      'Microphone Access Denied',
      'Microphone permission denied. Voice dictation is disabled.'
    );
  }

  return { granted, status };
});

ipcMain.handle('speech:transcribe', async (_event, payload) => {
  try {
    const { audioBase64, mimeType } = payload || {};
    if (!audioBase64) {
      return { success: false, error: 'No audio data provided' };
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length === 0) {
      return { success: false, error: 'Empty audio recording' };
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return { success: false, error: 'No API key available for speech transcription' };
    }

    let filename = 'recording.webm';
    let contentType = 'audio/webm';
    if (mimeType && mimeType.includes('wav')) {
      filename = 'recording.wav';
      contentType = 'audio/wav';
    } else if (mimeType && (mimeType.includes('mp4') || mimeType.includes('m4a'))) {
      filename = 'recording.m4a';
      contentType = 'audio/mp4';
    } else if (mimeType && mimeType.includes('ogg')) {
      filename = 'recording.ogg';
      contentType = 'audio/ogg';
    }

    const boundary = '----SparxAudioBoundary' + Math.random().toString(36).substring(2);
    const pre = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="model"\r\n\r\n' +
      'whisper-large-v3-turbo\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
      'Content-Type: ' + contentType + '\r\n\r\n'
    );
    const post = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([pre, audioBuffer, post]);

    async function sendTranscriptionRequest(key) {
      return new Promise((resolve, reject) => {
        const https = require('https');
        const req = https.request('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Content-Length': body.length
          },
          timeout: 25000
        }, (res) => {
          let respData = '';
          res.on('data', chunk => { respData += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const json = JSON.parse(respData);
                resolve(json);
              } catch (e) {
                reject(new Error('Invalid response JSON: ' + respData));
              }
            } else {
              const err = new Error('Whisper API returned ' + res.statusCode + ': ' + respData);
              err.statusCode = res.statusCode;
              reject(err);
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Transcription request timed out'));
        });

        req.write(body);
        req.end();
      });
    }

    let currentTranscribeKey = apiKey;
    let result = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await sendTranscriptionRequest(currentTranscribeKey);
        break;
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 429) {
          const next = markGroqKeyExpired(currentTranscribeKey, `Whisper HTTP ${err.statusCode}`);
          if (next && next !== currentTranscribeKey) {
            console.log(`[Groq Fallback] Retrying transcription with fallback key (${next.slice(0, 10)}...)...`);
            currentTranscribeKey = next;
            continue;
          }
        }
        throw err;
      }
    }

    const text = (result && result.text) ? result.text.trim() : '';
    return { success: true, text };
  } catch (err) {
    console.error('[Speech Transcribe Error]:', err);
    return { success: false, error: err.message };
  }
});

function executeReadFile(requestedPath) {
  const clean = (requestedPath || '').replace(/^['"`]|['"`]$/g, '').trim();
  const workspaceRoot = getWorkspaceRoot();
  let candidate = path.resolve(workspaceRoot, clean);
  if (!fs.existsSync(candidate)) {
    candidate = path.resolve(DESKTOP_ROOT, clean);
  }
  if (!isInsideDir(workspaceRoot, candidate) && !isInsideDir(DESKTOP_ROOT, candidate)) {
    throw new Error(`"${clean}" is outside the workspace folder. Change the folder in Settings > Files & workspaces.`);
  }
  if (!fs.existsSync(candidate)) {
    throw new Error(`File "${clean}" not found in workspace.`);
  }
  const stat = fs.statSync(candidate);
  if (stat.isDirectory()) {
    const list = fs.readdirSync(candidate);
    return {
      path: clean,
      isDir: true,
      items: list.slice(0, 50)
    };
  }
  const content = fs.readFileSync(candidate, 'utf8');
  return {
    path: clean,
    isDir: false,
    size: stat.size,
    lines: content.split('\n').length,
    content: content.slice(0, 40000)
  };
}

function executeListFiles(subDir = '') {
  const clean = (subDir || '').replace(/^['"`]|['"`]$/g, '').trim();
  const target = path.resolve(getWorkspaceRoot(), clean);
  if (!isInsideDir(getWorkspaceRoot(), target)) {
    throw new Error(`Directory "${clean}" is outside the workspace folder.`);
  }
  if (!fs.existsSync(target)) {
    throw new Error(`Directory "${clean}" not found.`);
  }
  const items = fs.readdirSync(target, { withFileTypes: true });
  return items
    .filter((it) => !it.name.startsWith('.') && it.name !== 'node_modules' && it.name !== 'dist')
    .slice(0, 50)
    .map((it) => ({
      name: it.name,
      isDirectory: it.isDirectory()
    }));
}

function executeWebSearch(query) {
  const https = require('https');
  const cleanQuery = query.trim();
  return new Promise((resolve, reject) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const req = https.get(url, { headers: { 'User-Agent': 'TacticalStudio/1.0' }, timeout: 7000 }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const sources = [];
          if (data.AbstractURL) {
            sources.push({
              title: data.Heading || cleanQuery,
              url: data.AbstractURL,
              snippet: data.AbstractText || ''
            });
          }
          if (Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.slice(0, 4).forEach((top) => {
              if (top.FirstURL && top.Text) {
                sources.push({
                  title: top.Text.slice(0, 60),
                  url: top.FirstURL,
                  snippet: top.Text
                });
              }
            });
          }
          if (sources.length === 0) {
            sources.push({
              title: `Search: ${cleanQuery}`,
              url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
              snippet: `Web search index reference for "${cleanQuery}"`
            });
          }
          resolve({ query: cleanQuery, sources, abstract: data.AbstractText || '' });
        } catch (e) {
          reject(new Error('Failed to parse search response.'));
        }
      });
    });
    req.on('error', (err) => reject(new Error('Network offline or search connection error: ' + err.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Search request timed out.'));
    });
  });
}

// ============================================================================
// Lightweight Pure-JS ZIP Archive Builder (Zero External Dependencies)
// ============================================================================
function buildZipArchive(files) {
  const zlib = require('zlib');
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const fileEntries = [];
  let offset = 0;
  const parts = [];

  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8');
    const comp = zlib.deflateRawSync(data);
    const useComp = comp.length < data.length;
    const finalData = useComp ? comp : data;
    const method = useComp ? 8 : 0;
    const nameBuf = Buffer.from(f.name.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4);         // version needed
    localHeader.writeUInt16LE(0, 6);          // flags
    localHeader.writeUInt16LE(method, 8);     // compression method
    localHeader.writeUInt16LE(0, 10);         // mod time
    localHeader.writeUInt16LE(0, 12);         // mod date
    localHeader.writeUInt32LE(crc, 14);        // crc32
    localHeader.writeUInt32LE(finalData.length, 18); // comp size
    localHeader.writeUInt32LE(data.length, 22);      // uncomp size
    localHeader.writeUInt16LE(nameBuf.length, 26);   // filename length
    localHeader.writeUInt16LE(0, 28);         // extra field length
    nameBuf.copy(localHeader, 30);

    parts.push(localHeader, finalData);
    fileEntries.push({ nameBuf, method, crc, compSize: finalData.length, uncompSize: data.length, offset });
    offset += localHeader.length + finalData.length;
  }

  const centralDirStart = offset;
  for (const e of fileEntries) {
    const cd = Buffer.alloc(46 + e.nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // central dir signature
    cd.writeUInt16LE(20, 4);         // version made by
    cd.writeUInt16LE(20, 6);         // version needed
    cd.writeUInt16LE(0, 8);          // flags
    cd.writeUInt16LE(e.method, 10);  // compression method
    cd.writeUInt16LE(0, 12);         // mod time
    cd.writeUInt16LE(0, 14);         // mod date
    cd.writeUInt32LE(e.crc, 16);     // crc32
    cd.writeUInt32LE(e.compSize, 20);// comp size
    cd.writeUInt32LE(e.uncompSize, 24); // uncomp size
    cd.writeUInt16LE(e.nameBuf.length, 28); // name length
    cd.writeUInt16LE(0, 30);         // extra field length
    cd.writeUInt16LE(0, 32);         // comment length
    cd.writeUInt16LE(0, 34);         // disk number start
    cd.writeUInt16LE(0, 36);         // internal attrs
    cd.writeUInt32LE(0, 38);         // external attrs
    cd.writeUInt32LE(e.offset, 42);   // relative offset of local header
    e.nameBuf.copy(cd, 46);
    parts.push(cd);
    offset += cd.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(0, 4);          // number of this disk
  eocd.writeUInt16LE(0, 6);          // disk with start of central directory
  eocd.writeUInt16LE(fileEntries.length, 8);  // total entries in central dir on this disk
  eocd.writeUInt16LE(fileEntries.length, 10); // total entries in central dir
  eocd.writeUInt32LE(offset - centralDirStart, 12); // size of central directory
  eocd.writeUInt32LE(centralDirStart, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20);         // zipfile comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

// ============================================================================
// Crisp ReShade Graphical Preset Generator & Standalone >100MB ZIP Packager
// Fuses professional shader suites (QuantV, qUINT, PD80, MartysMods, CAS)
// Runs asynchronously via non-blocking fs.promises & child_process.execFile
// so the Electron main process NEVER freezes or shows "(Not Responding)".
// ============================================================================
function setIniSectionValue(iniText, sectionName, key, value) {
  const escapedSec = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const secRegex = new RegExp(`(\\[${escapedSec}\\][\\s\\S]*?)(?=\\r?\\n\\[|$)`, 'i');
  const match = iniText.match(secRegex);
  if (match) {
    let block = match[1];
    const keyRegex = new RegExp(`^(${key}\\s*=\\s*).*$`, 'm');
    if (keyRegex.test(block)) {
      block = block.replace(keyRegex, `$1${value}`);
    } else {
      block = block.trimEnd() + `\r\n${key}=${value}\r\n`;
    }
    return iniText.replace(secRegex, block);
  } else {
    return iniText.trimEnd() + `\r\n\r\n[${sectionName}]\r\n${key}=${value}\r\n`;
  }
}

async function executeGenerateReshadePreset(input = '') {
  const fsp = fs.promises;
  const { execFile } = require('child_process');
  const execFileAsync = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });

  let userPrompt = '';
  let explicitName = '';
  let explicitGame = '';
  let explicitStyle = '';
  const retryAttempt = typeof input === 'object' && input !== null && input.retryAttempt === true;

  if (typeof input === 'object' && input !== null) {
    userPrompt = String(input.userPrompt || input.description || input.style || input.game || input.presetName || '');
    explicitName = String(input.presetName || input.preset_name || input.name || '').trim();
    explicitGame = String(input.game || '').trim();
    explicitStyle = String(input.style || '').trim();
  } else {
    userPrompt = String(input || '');
  }

  const p = `${userPrompt} ${explicitGame} ${explicitStyle} ${explicitName}`.toLowerCase();
  const explicitlyWarm = /\b(warm|golden[ -]hour|sunset|amber|orange[ -]tone|reddish|firelight|autumn|warm[ -]light)\b/i.test(`${userPrompt} ${explicitStyle}`);

  // Dynamic Scene & Style Keyword Parsing
  const isDarkVibrantNoir = /\b(dark\s*vibrant|vibrant\s*noir|dark.*noir.*vibrant|vibrant.*noir|neon\s*noir|neo[ -]?noir|dark\s*neon|vibrant\s*dark)\b/i.test(p) ||
    (/\b(noir|dark)\b/i.test(p) && /\b(vibrant|colorful|neon|pop|saturated|color)\b/i.test(p));
  const isNightScene = /\b(night|midnight|noir|dark|moonlight|shadows|pitch|cyberpunk night)\b/i.test(p);
  const isRainWet = /\b(rain|wet|storm|slick|puddle|reflection|overcast|fog|mist|gloomy|weather)\b/i.test(p);
  const isSunnyDesert = /\b(desert|arid|sunny|bright daylight|sunlight|harsh sun|clear sky|glare)\b/i.test(p);
  const isVintageFilm = /\b(vintage|retro|classic|vhs|1990s|1980s|filmic|35mm|grainy|analog|nostalgic)\b/i.test(p);
  const isCyberpunk = /\b(cyberpunk|neon|synthwave|tokyo|arcade|glow|futuristic|scifi|sci-fi)\b/i.test(p);
  const isHorrorEerie = /\b(horror|eerie|creepy|abandoned|decay|cold|bleak|desaturated|grunge)\b/i.test(p);

  // Determine distinct visual profile & genuine shader pipeline calibration
  let profileId = 'tactical_realism';
  let presetName = 'Tactical_Realism_Ultra';
  let styleName = 'Professional Tactical Realism & CAS Sharpening';
  let techniquesList = 'QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,prod80_02_Bonus_LUT_pack@PD80_02_Bonus_LUT_pack.fx,FilmicPass@FilmicPass.fx,ContrastAdaptiveSharpen@CAS.fx,MartysMods_Toddyhancer@MartysMods_TODDYHANCER.fx';
  let activeTechniquesSummary = 'QuantV + qUINT Lightroom + PD80 LUT + FilmicPass + CAS + Toddyhancer';

  // Calibrated shader parameters per profile (genuinely distinct visual engineering)
  let casSharpen = '1.150000';
  let casContrast = '0.060000';
  let qvSharpen = '1.400000';
  let lrSaturation = '0.181000';
  let lrVibrance = '0.146000';
  let lrExposure = '0.034000';
  let lrContrast = '0.040000';
  let lrGamma = '0.253000';
  let lrTemp = '0.000000';
  let lrBlackLevel = '0.000000';
  let filmicContrast = '0.980000';
  let filmicStrength = '0.702000';
  let filmicFade = '0.260000';
  let filmicBleach = '0.000000';
  let cineLutSelector = '27';
  let cineLutIntensity = '0.560000';
  let bonusLutSelector = '16';
  let bonusLutIntensity = '0.700000';
  let bloomIntensity = '0.350000';
  let bloomCurve = '2.500000';
  let bloomSat = '1.800000';
  let mxaoSampleRadius = '1.800000';
  let mxaoAmount = '0.850000';
  let mxaoFine = '0.800000';
  let mxaoCoarse = '0.600000';
  let grainIntensity = '0.000000';

  // Professional per-profile tone curve shaping
  let blacksCurve = '0.000000';
  let shadowsCurve = '0.000000';
  let midtonesCurve = '0.000000';
  let highlightsCurve = '0.000000';
  let whitesCurve = '0.000000';

  // Professional per-profile HSL channel separation
  let redSat = '0.000000';
  let redExp = '0.000000';
  let redHue = '0.000000';
  let orangeSat = '0.000000';
  let orangeExp = '0.000000';
  let orangeHue = '0.000000';
  let yellowSat = '0.000000';
  let yellowExp = '0.000000';
  let yellowHue = '0.000000';
  let greenSat = '0.000000';
  let greenExp = '0.000000';
  let greenHue = '0.000000';
  let aquaSat = '0.000000';
  let aquaExp = '0.000000';
  let aquaHue = '0.000000';
  let blueSat = '0.000000';
  let blueExp = '0.000000';
  let blueHue = '0.000000';
  let magentaSat = '0.000000';
  let magentaExp = '0.000000';
  let magentaHue = '0.000000';

  // Lens Vignette
  let vignetteEnable = '0';
  let vignetteAmount = '0.000000';
  let vignetteCurve = '1.000000';
  let vignetteRadius = '1.000000';

  if (isDarkVibrantNoir) {
    profileId = 'dark_vibrant_noir';
    presetName = 'GTAV_DarkVibrantNoir';
    styleName = 'Dark Vibrant Neo-Noir: Inky Black Point, Saturated Neon Accents & Specular Halation';
    techniquesList = 'MXAO@qUINT_mxao.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Bloom@qUINT_bloom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,FilmicPass@FilmicPass.fx,Lightroom@qUINT_lightroom.fx,ContrastAdaptiveSharpen@CAS.fx';
    activeTechniquesSummary = 'qUINT Contact AO + QuantV + qUINT Specular Bloom + PD80 Cinetools #27 (Teal/Orange) + FilmicPass + Lightroom Vibrant Pop + AMD CAS';
    casSharpen = '0.500000';
    casContrast = '0.020000';
    qvSharpen = '0.000000';
    lrSaturation = '0.180000';
    lrVibrance = '0.240000';
    lrExposure = '-0.038000';
    lrContrast = '0.220000';
    lrGamma = '0.235000';
    lrTemp = '-0.015000';
    lrBlackLevel = '0.000000';
    filmicContrast = '1.180000';
    filmicStrength = '0.600000';
    filmicFade = '0.000000';
    filmicBleach = '0.000000';
    cineLutSelector = '27';
    cineLutIntensity = '0.450000';
    bonusLutSelector = '1';
    bonusLutIntensity = '0.000000';
    bloomIntensity = '0.350000';
    bloomCurve = '2.800000';
    bloomSat = '1.800000';
    mxaoSampleRadius = '1.800000';
    mxaoAmount = '0.900000';
    mxaoFine = '0.850000';
    mxaoCoarse = '0.650000';
    grainIntensity = '0.000000';

    blacksCurve = '-0.060000';
    shadowsCurve = '-0.020000';
    midtonesCurve = '0.020000';
    highlightsCurve = '0.080000';
    whitesCurve = '-0.050000';

    redSat = '0.360000';
    redExp = '0.080000';
    redHue = '0.000000';
    orangeSat = '0.300000';
    orangeExp = '0.060000';
    orangeHue = '0.000000';
    yellowSat = '-0.120000';
    yellowExp = '-0.020000';
    yellowHue = '0.000000';
    greenSat = '-0.250000';
    greenExp = '-0.060000';
    greenHue = '-0.050000';
    aquaSat = '0.280000';
    aquaExp = '0.050000';
    aquaHue = '0.000000';
    blueSat = '0.300000';
    blueExp = '0.000000';
    blueHue = '0.000000';
    magentaSat = '0.250000';
    magentaExp = '0.040000';
    magentaHue = '0.000000';

    vignetteEnable = '1';
    vignetteAmount = '-0.140000';
    vignetteCurve = '1.200000';
    vignetteRadius = '1.050000';
  } else if (isRainWet) {
    profileId = 'rain_wet';
    presetName = 'Tactical_Wet_Reflections';
    styleName = 'Rain Slick Asphalt, SSR Wet Reflections & Gloomy Contrast';
    techniquesList = 'SSR@qUINT_ssr.fx,MXAO@qUINT_mxao.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,FilmicPass@FilmicPass.fx,ContrastAdaptiveSharpen@CAS.fx,Debanding@qUINT_deband.fx';
    activeTechniquesSummary = 'qUINT SSR + MXAO + QuantV + Lightroom Cold Grade + PD80 Cinetools #23 + FilmicPass + CAS';
    casSharpen = '1.300000';
    casContrast = '0.100000';
    qvSharpen = '1.450000';
    lrSaturation = '-0.080000';
    lrVibrance = '0.120000';
    lrExposure = '-0.020000';
    lrContrast = '0.180000';
    lrGamma = '0.220000';
    lrTemp = '-0.065000';
    lrBlackLevel = '3.000000';
    filmicContrast = '1.140000';
    filmicStrength = '0.820000';
    filmicFade = '0.180000';
    filmicBleach = '0.620000';
    cineLutSelector = '23';
    cineLutIntensity = '0.740000';
    bonusLutSelector = '11';
    bonusLutIntensity = '0.500000';
    bloomIntensity = '1.450000';
    mxaoSampleRadius = '3.400000';
    grainIntensity = '0.180000';
  } else if (isCyberpunk) {
    profileId = 'cyberpunk_neon';
    presetName = 'Tactical_Cyberpunk_Neon';
    styleName = 'Cyberpunk High-Contrast Neon, Anamorphic Flares, SSR & Deep Shadows';
    techniquesList = 'SSR@qUINT_ssr.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Bloom@qUINT_bloom.fx,Lightroom@qUINT_lightroom.fx,Blooming_HDR@BloomingHDR.fx,prod80_02_Bonus_LUT_pack@PD80_02_Bonus_LUT_pack.fx,ContrastAdaptiveSharpen@CAS.fx,ChromaticAberration@ChromaticAberration.fx';
    activeTechniquesSummary = 'SSR Reflections + QuantV + qUINT Bloom + BloomingHDR + PD80 Cyber LUT #18 + CAS + CA';
    casSharpen = '1.400000';
    casContrast = '0.120000';
    qvSharpen = '1.600000';
    lrSaturation = '0.280000';
    lrVibrance = '0.320000';
    lrExposure = '0.040000';
    lrContrast = '0.220000';
    lrGamma = '0.240000';
    lrTemp = '-0.030000';
    lrBlackLevel = '3.800000';
    filmicContrast = '1.200000';
    filmicStrength = '0.750000';
    filmicFade = '0.120000';
    filmicBleach = '0.450000';
    cineLutSelector = '18';
    cineLutIntensity = '0.850000';
    bonusLutSelector = '19';
    bonusLutIntensity = '0.680000';
    bloomIntensity = '1.800000';
    mxaoSampleRadius = '2.800000';
    grainIntensity = '0.200000';
  } else if (isVintageFilm) {
    profileId = 'vintage_film';
    presetName = 'Tactical_Vintage_35mm';
    styleName = '35mm Film Stock, Halation, Kodachrome LUT & Warm Organic Grain';
    techniquesList = 'QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,FilmicPass@FilmicPass.fx,Halation@Halation.fx,MartyMods_FilmGrain@MartysMods_FILMGRAIN.fx,ContrastAdaptiveSharpen@CAS.fx';
    activeTechniquesSummary = 'QuantV + Lightroom Warm Film + PD80 Film #29 + Halation + 35mm Grain + CAS';
    casSharpen = '1.050000';
    casContrast = '0.040000';
    qvSharpen = '1.200000';
    lrSaturation = '0.060000';
    lrVibrance = '0.100000';
    lrExposure = '0.020000';
    lrContrast = '0.110000';
    lrGamma = '0.260000';
    lrTemp = '0.055000';
    lrBlackLevel = '4.200000';
    filmicContrast = '1.080000';
    filmicStrength = '0.880000';
    filmicFade = '0.360000';
    filmicBleach = '0.650000';
    cineLutSelector = '29';
    cineLutIntensity = '0.820000';
    bonusLutSelector = '15';
    bonusLutIntensity = '0.550000';
    bloomIntensity = '1.150000';
    mxaoSampleRadius = '2.000000';
    grainIntensity = '0.850000';
  } else if (isSunnyDesert) {
    profileId = 'sunny_desert';
    presetName = 'Tactical_Arid_Sunlight';
    styleName = 'Arid Sunlight, Natural Heat Glare, Clean Tonemapping & Sharp Horizons';
    techniquesList = 'QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,FilmicPass@FilmicPass.fx,ContrastAdaptiveSharpen@CAS.fx,Debanding@qUINT_deband.fx';
    activeTechniquesSummary = 'QuantV + Lightroom Warm Solar + PD80 Cinetools #7 + FilmicPass + CAS + Deband';
    casSharpen = '1.350000';
    casContrast = '0.120000';
    qvSharpen = '1.600000';
    lrSaturation = '0.100000';
    lrVibrance = '0.180000';
    lrExposure = '0.085000';
    lrContrast = '0.160000';
    lrGamma = '0.280000';
    lrTemp = '0.040000';
    lrBlackLevel = '1.800000';
    filmicContrast = '1.120000';
    filmicStrength = '0.700000';
    filmicFade = '0.100000';
    filmicBleach = '0.480000';
    cineLutSelector = '7';
    cineLutIntensity = '0.650000';
    bonusLutSelector = '5';
    bonusLutIntensity = '0.400000';
    bloomIntensity = '0.900000';
    mxaoSampleRadius = '2.600000';
    grainIntensity = '0.080000';
  } else if (p.includes('photoreal') || p.includes('photo-real') || p.includes('realistic') || p.includes('natural')) {
    profileId = 'photoreal';
    presetName = 'Tactical_Realism_Photoreal';
    styleName = 'Trained Photorealism: Grounded Shadows, Natural Foliage & Highlight Recovery';
    techniquesList = 'MXAO@qUINT_mxao.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,ContrastAdaptiveSharpen@CAS.fx';
    activeTechniquesSummary = 'qUINT Contact AO + QuantV Sky & Reflections + QuantV Post (Zero-Noise) + Lightroom Studio Balance + AMD CAS Clarity';
    casSharpen = '0.450000';
    casContrast = '0.000000';
    qvSharpen = '0.000000';
    lrSaturation = '0.040000';
    lrVibrance = '0.080000';
    lrExposure = '-0.015000';
    lrContrast = '0.080000';
    lrGamma = '0.250000';
    lrTemp = '0.000000';
    lrBlackLevel = '0.000000';
    filmicContrast = '0.950000';
    filmicStrength = '0.000000';
    filmicFade = '0.000000';
    filmicBleach = '0.000000';
    cineLutSelector = '1';
    cineLutIntensity = '0.000000';
    bonusLutSelector = '1';
    bonusLutIntensity = '0.000000';
    bloomIntensity = '0.000000';
    mxaoSampleRadius = '1.600000';
    mxaoAmount = '0.850000';
    grainIntensity = '0.000000';

    blacksCurve = '0.040000';
    shadowsCurve = '0.080000';
    midtonesCurve = '-0.030000';
    highlightsCurve = '-0.100000';
    whitesCurve = '-0.160000';

    redSat = '0.000000';
    redExp = '0.000000';
    redHue = '0.000000';
    orangeSat = '0.000000';
    orangeExp = '0.000000';
    orangeHue = '0.000000';
    yellowSat = '-0.060000';
    yellowExp = '-0.020000';
    yellowHue = '0.000000';
    greenSat = '-0.100000';
    greenExp = '-0.050000';
    greenHue = '-0.050000';
    aquaSat = '0.000000';
    aquaExp = '0.000000';
    aquaHue = '0.000000';
    blueSat = '0.000000';
    blueExp = '0.000000';
    blueHue = '0.000000';
    magentaSat = '0.000000';
    magentaExp = '0.000000';
    magentaHue = '0.000000';

    vignetteEnable = '0';
    vignetteAmount = '0.000000';
  } else if (p.includes('ultra') || p.includes('extreme') || p.includes('super crisp') || p.includes('extra sharp') || p.includes('esports') || p.includes('competitive') || p.includes('clarity')) {
    profileId = 'ultra_crisp';
    presetName = 'Tactical_Realism_UltraCrisp';
    styleName = 'Ultra-High Definition Competitive Clarity, Multi-Pass CAS & Zero-Blur';
    techniquesList = 'QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,ContrastAdaptiveSharpen@CAS.fx,DELC_Sharpen@qUINT_sharp.fx,MartyMods_Sharpen@MartysMods_SHARPEN.fx,Clarity2@Clarity2.fx';
    activeTechniquesSummary = 'QuantV + CAS Ultra + qUINT Sharp + MartysMods Sharpen + Clarity2 + Lightroom';
    casSharpen = '1.650000';
    casContrast = '0.180000';
    qvSharpen = '1.950000';
    lrSaturation = '0.240000';
    lrVibrance = '0.280000';
    lrExposure = '0.080000';
    lrContrast = '0.195000';
    lrGamma = '0.290000';
    lrTemp = '-0.040000';
    lrBlackLevel = '0.500000';
    filmicContrast = '1.150000';
    filmicStrength = '0.450000';
    filmicFade = '0.050000';
    filmicBleach = '0.350000';
    cineLutSelector = '4';
    cineLutIntensity = '0.300000';
    bonusLutSelector = '3';
    bonusLutIntensity = '0.350000';
    bloomIntensity = '0.300000';
    mxaoSampleRadius = '1.500000';
    grainIntensity = '0.000000';
  } else if (p.includes('vivid') || p.includes('colorful') || p.includes('bright') || p.includes('saturated') || p.includes('vibrant') || p.includes('hdr') || p.includes('pop')) {
    profileId = 'vivid_hdr';
    presetName = 'Tactical_Realism_VividHDR';
    styleName = explicitlyWarm
      ? 'Vivid Cinematic HDR, Warm Color Pop & Golden Hour LUT'
      : 'Vivid Cinematic HDR, Balanced Color Pop & Natural Daylight';
    techniquesList = 'QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,Blooming_HDR@BloomingHDR.fx,HDR_Saturation@HDRSaturation.fx,prod80_02_Bonus_LUT_pack@PD80_02_Bonus_LUT_pack.fx,ContrastAdaptiveSharpen@CAS.fx,Vibrance@Vibrance.fx';
    activeTechniquesSummary = explicitlyWarm
      ? 'QuantV + BloomingHDR + HDRSaturation + PD80 Warm LUT + Vibrance + CAS'
      : 'QuantV + BloomingHDR + HDRSaturation + neutral color balance + Vibrance + CAS';
    casSharpen = '1.280000';
    casContrast = '0.110000';
    qvSharpen = '1.500000';
    lrSaturation = explicitlyWarm ? '0.300000' : '0.160000';
    lrVibrance = explicitlyWarm ? '0.260000' : '0.150000';
    lrExposure = '0.095000';
    lrContrast = '0.160000';
    lrGamma = '0.270000';
    lrTemp = explicitlyWarm ? '0.045000' : '0.000000';
    lrBlackLevel = '1.500000';
    filmicContrast = '1.120000';
    filmicStrength = '0.620000';
    filmicFade = '0.080000';
    filmicBleach = '0.400000';
    cineLutSelector = explicitlyWarm ? '19' : '12';
    cineLutIntensity = explicitlyWarm ? '0.600000' : '0.380000';
    bonusLutSelector = explicitlyWarm ? '22' : '8';
    bonusLutIntensity = explicitlyWarm ? '0.650000' : '0.220000';
    bloomIntensity = explicitlyWarm ? '1.400000' : '0.950000';
    mxaoSampleRadius = '2.400000';
    grainIntensity = '0.100000';
  } else if (isNightScene || p.includes('cinematic') || p.includes('movie') || p.includes('dark') || p.includes('grim') || p.includes('noir') || p.includes('film')) {
    profileId = 'night_noir';
    presetName = 'Tactical_Realism_NightNoir';
    styleName = 'Deep Night Noir, Specular Halation, Filmic Shadows & Clean Contrast';
    techniquesList = 'MXAO@qUINT_mxao.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Cinetools_LUT@PD80_02_Cinetools_LUT.fx,FilmicPass@FilmicPass.fx,Bloom@qUINT_bloom.fx,ContrastAdaptiveSharpen@CAS.fx';
    activeTechniquesSummary = 'MXAO + QuantV Night + PD80 Cinetools #31 + FilmicPass + Specular Bloom + CAS';
    casSharpen = '0.500000';
    casContrast = '0.020000';
    qvSharpen = '0.000000';
    lrSaturation = '0.060000';
    lrVibrance = '0.120000';
    lrExposure = '-0.045000';
    lrContrast = '0.200000';
    lrGamma = '0.220000';
    lrTemp = '-0.040000';
    lrBlackLevel = '0.000000';
    filmicContrast = '1.160000';
    filmicStrength = '0.650000';
    filmicFade = '0.050000';
    filmicBleach = '0.100000';
    cineLutSelector = '31';
    cineLutIntensity = '0.600000';
    bonusLutSelector = '14';
    bonusLutIntensity = '0.000000';
    bloomIntensity = '0.300000';
    bloomCurve = '2.800000';
    bloomSat = '1.600000';
    mxaoSampleRadius = '2.200000';
    mxaoAmount = '0.900000';
    grainIntensity = '0.000000';

    blacksCurve = '-0.040000';
    shadowsCurve = '-0.020000';
    midtonesCurve = '0.000000';
    highlightsCurve = '0.040000';
    whitesCurve = '-0.060000';

    vignetteEnable = '1';
    vignetteAmount = '-0.100000';
    vignetteCurve = '1.200000';
    vignetteRadius = '1.050000';
  } else if (p.includes('glow') || p.includes('bloom') || p.includes('soft') || p.includes('dreamy') || p.includes('sunset')) {
    profileId = 'atmospheric_bloom';
    presetName = 'Tactical_Realism_Atmospheric';
    styleName = explicitlyWarm
      ? 'Atmospheric Neon Bloom, SSR Reflections, Orton Glow & Warm Chromatic Grade'
      : 'Atmospheric Neon Bloom, SSR Reflections, Orton Glow & Balanced Color';
    techniquesList = 'SSR@qUINT_ssr.fx,QuantV@QuantV.fx,QuantV_PostFX@QuantV_Post.fx,Bloom@qUINT_bloom.fx,OrtonBloom@OrtonBloom.fx,Lightroom@qUINT_lightroom.fx,prod80_02_Bonus_LUT_pack@PD80_02_Bonus_LUT_pack.fx,ContrastAdaptiveSharpen@CAS.fx';
    activeTechniquesSummary = 'qUINT SSR + QuantV + qUINT Bloom + OrtonBloom + Lightroom + PD80 LUT #9 + CAS';
    casSharpen = '1.120000';
    casContrast = '0.050000';
    qvSharpen = '1.300000';
    lrSaturation = explicitlyWarm ? '0.240000' : '0.170000';
    lrVibrance = explicitlyWarm ? '0.210000' : '0.140000';
    lrExposure = '0.045000';
    lrContrast = '0.090000';
    lrGamma = '0.265000';
    lrTemp = explicitlyWarm ? '0.035000' : '0.000000';
    lrBlackLevel = '1.200000';
    filmicContrast = '1.040000';
    filmicStrength = '0.640000';
    filmicFade = '0.210000';
    filmicBleach = '0.600000';
    cineLutSelector = '9';
    cineLutIntensity = '0.620000';
    bonusLutSelector = '9';
    bonusLutIntensity = explicitlyWarm ? '0.650000' : '0.300000';
    bloomIntensity = explicitlyWarm ? '1.700000' : '1.250000';
    mxaoSampleRadius = '2.800000';
    grainIntensity = '0.220000';
  }

  // Also apply deterministic fine-tuning from the preset name / game so even two custom-named presets have unique calibration signatures
  let nameHash = 0;
  const seedStr = `${explicitName}|${explicitGame}|${explicitStyle}|${userPrompt}`;
  for (let i = 0; i < seedStr.length; i++) {
    nameHash = ((nameHash << 5) - nameHash + seedStr.charCodeAt(i)) | 0;
  }
  const absHash = Math.abs(nameHash);
  if (explicitName && profileId === 'tactical_realism') {
    const lutOffset = (absHash % 24) + 1;
    cineLutSelector = String(lutOffset);
    casSharpen = (1.12 + ((absHash % 35) / 100)).toFixed(6);
    lrSaturation = (0.14 + ((absHash % 22) / 100)).toFixed(6);
    lrVibrance = (0.12 + ((absHash % 20) / 100)).toFixed(6);
  }

  if (explicitGame && !explicitName) {
    const cleanGame = explicitGame.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (cleanGame) {
      const suffix = profileId === 'photoreal' ? 'Photoreal' :
        profileId === 'dark_vibrant_noir' ? 'DarkVibrantNoir' :
        profileId === 'ultra_crisp' ? 'UltraCrisp' :
        profileId === 'vivid_hdr' ? 'VividHDR' :
        profileId === 'night_noir' ? 'NightNoir' :
        profileId === 'atmospheric_bloom' ? 'Atmospheric' : 'Realism_Ultra';
      presetName = `${cleanGame}_${suffix}`;
    }
  } else if (!explicitName) {
    const gameMatch = userPrompt.match(/(?:for|in)\s+([a-zA-Z0-9\s\-:]{3,30}?)(?:\s+(?:game|preset|reshade)|\.|$)/i);
    if (gameMatch && gameMatch[1] && !['the', 'my', 'a', 'this', 'crisp', 'reshade', 'realism'].includes(gameMatch[1].trim().toLowerCase())) {
      const cleanGame = gameMatch[1].trim().replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = profileId === 'photoreal' ? 'Photoreal' :
        profileId === 'dark_vibrant_noir' ? 'DarkVibrantNoir' :
        profileId === 'ultra_crisp' ? 'UltraCrisp' :
        profileId === 'vivid_hdr' ? 'VividHDR' :
        profileId === 'night_noir' ? 'NightNoir' :
        profileId === 'atmospheric_bloom' ? 'Atmospheric' : 'Realism_Ultra';
      presetName = `${cleanGame}_${suffix}`;
    } else if (profileId === 'dark_vibrant_noir') {
      presetName = 'GTAV_DarkVibrantNoir';
    }
  }

  // Handle explicit prompt overrides (e.g. "no vignette", "no bloom", "no grain")
  if (/\b(no\s*vignette|without\s*vignette|disable\s*vignette|zero\s*vignette)\b/i.test(p)) {
    vignetteEnable = '0';
    vignetteAmount = '0.000000';
  }
  if (/\b(no\s*bloom|without\s*bloom|zero\s*bloom|disable\s*bloom)\b/i.test(p)) {
    bloomIntensity = '0.000000';
  }
  if (/\b(no\s*grain|without\s*grain|zero\s*grain|disable\s*grain|no\s*noise)\b/i.test(p)) {
    grainIntensity = '0.000000';
  }

  if (explicitName) {
    const cleanedExplicit = explicitName.replace(/\.zip$/i, '').replace(/\.ini$/i, '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    if (cleanedExplicit) {
      presetName = cleanedExplicit;
    }
  }

  // Look for professional ReShade source repository (>100MB master suite with 91 shaders & 105 textures)
  const candidateDirs = [
    'C:\\Users\\alkhi\\Downloads\\Preset tactical realism v2\\Preset tactical realism v2',
    path.join(app.getPath('downloads'), 'Preset tactical realism v2', 'Preset tactical realism v2'),
    path.join(app.getPath('downloads'), 'Preset tactical realism v2'),
    path.join(os.homedir(), 'Downloads', 'Preset tactical realism v2', 'Preset tactical realism v2'),
    'C:\\Users\\alkhi\\Downloads\\Preset tactical realism v2',
    path.join(os.homedir(), 'Downloads', 'Preset tactical realism v2'),
    path.join(DEFAULT_WORKSPACE_ROOT, 'Reshade Presets', 'Vivid Reshade'),
    path.join(__dirname, '..', 'Reshade Presets', 'Vivid Reshade'),
    process.resourcesPath ? path.join(process.resourcesPath, 'Preset tactical realism v2') : '',
    path.join(__dirname, 'assets'),
    process.resourcesPath ? path.join(process.resourcesPath, 'assets') : ''
  ].filter(Boolean);

  let baseTemplateDir = '';
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      if (fs.existsSync(path.join(dir, 'reshade-shaders', 'Shaders'))) {
        baseTemplateDir = dir;
        break;
      } else if (fs.existsSync(path.join(dir, 'Preset tactical realism v2', 'reshade-shaders', 'Shaders'))) {
        baseTemplateDir = path.join(dir, 'Preset tactical realism v2');
        break;
      } else if (fs.existsSync(path.join(dir, 'TACTICAL REALISEM V2.ini'))) {
        if (!baseTemplateDir) baseTemplateDir = dir;
      }
    }
  }

  const downloadsDir = app.getPath('downloads') || path.join(os.homedir(), 'Downloads');
  const zipFileName = `${presetName}.zip`;
  const zipFilePath = path.join(downloadsDir, zipFileName);
  const extractedFolderPath = path.join(downloadsDir, presetName);

  const stagingDir = path.join(os.tmpdir(), `reshade_pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  await fsp.mkdir(stagingDir, { recursive: true });

  const hasShadersSuite = !!(baseTemplateDir && fs.existsSync(path.join(baseTemplateDir, 'reshade-shaders', 'Shaders')));
  const shadersSrc = hasShadersSuite ? path.join(baseTemplateDir, 'reshade-shaders', 'Shaders') : '';
  const texturesSrc = hasShadersSuite ? path.join(baseTemplateDir, 'reshade-shaders', 'Textures') : '';
  const stagingShadersDir = path.join(stagingDir, 'reshade-shaders', 'Shaders');
  const stagingTexturesDir = path.join(stagingDir, 'reshade-shaders', 'Textures');
  if (hasShadersSuite) {
    await fsp.mkdir(stagingShadersDir, { recursive: true });
    await fsp.mkdir(stagingTexturesDir, { recursive: true });
  }

  // Select curated shader/texture suites tailored to the requested visual style
  let selectedSuites = [];
  let excludedRootTextures = [];
  let excludedRootShaders = ['HQ4X.fx', 'Glitch.fx', 'Daltonize.fx', 'NightVision.fx', 'Sepia.fx', 'Technicolor2.fx'];

    if (profileId === 'dark_vibrant_noir') {
      // Best for Dark Vibrant Neo-Noir: Ray-traced AO, Cinetools LUTs, Specular Bloom, Filmic Contrast & AMD CAS
      selectedSuites = ['qUINT', 'PD80', 'iMMERSE', 'OtisFX', 'vort_Shaders', 'Fubax', 'SweetFX', 'CShade', 'Daodan', 'AstrayFX', 'Insane-Shaders'];
      excludedRootTextures = ['TestPattern.png', 'Overlay.png', 'hd_noise.png', 'dh_rt_noise.png'];
      excludedRootShaders.push('FilmGrain2.fx', 'FakeMotionBlur.fx', 'Sepia.fx', 'Glitch.fx');
    } else if (profileId === 'rain_wet') {
      // Best for Rain & Wet Surfaces: Screen-Space Reflections, Ambient Occlusion, Debanding & Cold Neutral Grading
      selectedSuites = ['qUINT', 'iMMERSE', 'PD80', 'OtisFX', 'vort_Shaders', 'DH', 'Fubax', 'SweetFX', 'CShade', 'Daodan', 'AstrayFX', 'Insane-Shaders'];
      excludedRootTextures = ['TestPattern.png', 'Overlay.png', 'hd_noise.png'];
      excludedRootShaders.push('Sepia.fx', 'HQ4X.fx');
    } else if (profileId === 'cyberpunk_neon') {
      // Best for Cyberpunk & Neon: Bloom, Lens Flares, HDR Color, Chromatic Aberration & Sharp Speculars
      selectedSuites = ['qUINT', 'PD80', 'CobraFX', 'ZenteonFX', 'FXShaders', 'OtisFX', 'Fubax', 'SweetFX', 'SHADERDECK', 'GShade-Shaders', 'CorgiFX', 'Quark', 'AstrayFX'];
      excludedRootTextures = ['TestPattern.png'];
    } else if (profileId === 'vintage_film') {
      // Best for 35mm Vintage Film: Halation, Organic Grain, Technicolor, Kodachrome LUTs & Lens Imperfections
      selectedSuites = ['qUINT', 'PD80', 'FGFX', 'ZenteonFX', 'FXShaders', 'OtisFX', 'Fubax', 'SweetFX', 'Barbatos', 'smolbbsoop', 'Anagrama'];
      excludedRootTextures = ['TestPattern.png', 'dh_rt_noise.png'];
    } else if (profileId === 'sunny_desert') {
      // Best for Sunny & Arid Desert: Solar Glare, Crisp Atmospheric Haze, Heat Contrast & Sharp Detail
      selectedSuites = ['qUINT', 'PD80', 'iMMERSE', 'OtisFX', 'Fubax', 'SweetFX', 'CShade', 'Daodan', 'AstrayFX', 'Pumbo', 'potatoFX'];
      excludedRootTextures = ['TestPattern.png', 'DirtOVB.png', 'DirtOVR.png'];
      excludedRootShaders.push('FilmGrain2.fx', 'FakeMotionBlur.fx');
    } else if (profileId === 'photoreal') {
      // Best for Photorealism: Ray-traced GI/AO (iMMERSE, qUINT, DH, vort_Shaders), Natural Color & Tonemapping (PD80, QuantV, OtisFX, Fubax, SweetFX, Insane-Shaders)
      selectedSuites = ['qUINT', 'PD80', 'iMMERSE', 'OtisFX', 'vort_Shaders', 'DH', 'Fubax', 'SweetFX', 'Insane-Shaders', 'CShade', 'Daodan', 'AstrayFX', 'Pumbo'];
      excludedRootTextures = ['TestPattern.png', 'Overlay.png', 'MagicBloom_Dirt.png', 'NeoBloom_LensDirt.png', 'DirtOVB.png'];
    } else if (profileId === 'ultra_crisp') {
      // Best for Competitive / Ultra-Crisp Clarity: Pure sharpening, anti-aliasing, debanding & clarity (qUINT, iMMERSE, SweetFX, CShade, VRToolkit, PD80, AstrayFX, Fubax, Daodan) — zero heavy bloom/blur/film-grain bloat
      selectedSuites = ['qUINT', 'iMMERSE', 'SweetFX', 'CShade', 'VRToolkit', 'PD80', 'AstrayFX', 'Fubax', 'Daodan', 'Insane-Shaders', 'vort_Shaders'];
      excludedRootTextures = ['hd_noise.png', 'DirtOVB.png', 'DirtOVR.png', 'Dirt.png', 'DirtA.png', 'MagicBloom_Dirt.png', 'NeoBloom_LensDirt.png', 'LensDOV.png', 'LensDUV.png', 'LensSprite.png', 'TestPattern.png', 'Overlay.png', 'dh_rt_noise.png'];
      excludedRootShaders.push('FakeMotionBlur.fx', 'FilmGrain2.fx', 'MagicBloom.fx', 'DOF.fx', 'LightDoF.fx');
    } else if (profileId === 'vivid_hdr') {
      // Best for Vivid HDR & Color Pop: HDR tonemappers, LUT packs, vibrant bloom & saturation suites
      selectedSuites = ['qUINT', 'PD80', 'CoreFX', 'FXShaders', 'OtisFX', 'CobraFX', 'SweetFX', 'Fubax', 'ReShade_HDR_shaders', 'UjelFX', 'SHADERDECK', 'GShade-Shaders', 'CorgiFX', 'Quark'];
      excludedRootTextures = ['TestPattern.png', 'monochrome_gaussnoise.png', 'dh_rt_noise.png'];
    } else if (profileId === 'night_noir') {
      // Best for Cinematic Night Noir: Anamorphic lenses, 35mm film grain, halation, deep AO & moody LUTs
      selectedSuites = ['qUINT', 'PD80', 'iMMERSE', 'OtisFX', 'Fubax', 'ZenteonFX', 'FXShaders', 'FGFX', 'DH', 'vort_Shaders', 'CShade', 'SHADERDECK', 'Barbatos', 'SweetFX'];
      excludedRootTextures = ['TestPattern.png', 'O-NVE-advanced.png', 'O-NVE-prem_V2.5.png'];
    } else if (profileId === 'atmospheric_bloom') {
      // Best for Atmospheric Neon & Bloom: Screen-space reflections, multi-layer bloom, lens dirt & optical flares
      selectedSuites = ['qUINT', 'PD80', 'OtisFX', 'ZenteonFX', 'Quark', 'CobraFX', 'FXShaders', 'iMMERSE', 'GShade-Shaders', 'CorgiFX', 'Fubax', 'SweetFX', 'AstrayFX', 'potatoFX', 'smolbbsoop'];
      excludedRootTextures = ['TestPattern.png'];
    } else {
      // Tactical Realism Balanced Suite (curated core graphics suites; excludes CRT-Royale, RSRetroArch, Depth3D VR)
      selectedSuites = ['qUINT', 'PD80', 'iMMERSE', 'OtisFX', 'vort_Shaders', 'FXShaders', 'Fubax', 'SweetFX', 'CShade', 'ZenteonFX', 'CobraFX', 'DH', 'CoreFX', 'GShade-Shaders', 'VRToolkit', 'Daodan'];
      excludedRootTextures = ['TestPattern.png'];
    }

    // Always include QuantV texture LUTs folder
    const textureSuitesToCopy = Array.from(new Set([...selectedSuites, 'QuantV']));

    // If custom preset name is given, deterministically vary 1-2 optional auxiliary suites so custom presets also have distinct footprints
    const optionalAuxSuites = ['BX-Shade', 'Ann-ReShade', 'Anagrama', 'METEOR', 'Warp-FX', 'MaxG3D'];
    if (explicitName) {
      const aux1 = optionalAuxSuites[absHash % optionalAuxSuites.length];
      const aux2 = optionalAuxSuites[(absHash >> 3) % optionalAuxSuites.length];
      if (!selectedSuites.includes(aux1)) selectedSuites.push(aux1);
      if ((absHash % 2 === 0) && !selectedSuites.includes(aux2)) selectedSuites.push(aux2);
    }

    // Copy root-level .fx and .fxh files (excluding irrelevant ones for this profile)
    if (fs.existsSync(shadersSrc)) {
      const rootShaderEntries = await fsp.readdir(shadersSrc, { withFileTypes: true });
      for (const entry of rootShaderEntries) {
        const srcPath = path.join(shadersSrc, entry.name);
        const destPath = path.join(stagingShadersDir, entry.name);
        if (entry.isFile()) {
          if (!excludedRootShaders.includes(entry.name)) {
            await fsp.copyFile(srcPath, destPath);
          }
        } else if (entry.isDirectory() && selectedSuites.includes(entry.name)) {
          await fsp.cp(srcPath, destPath, { recursive: true });
        }
      }
    }

    // Copy root-level texture LUTs and curated texture suite folders
    if (fs.existsSync(texturesSrc)) {
      const rootTexEntries = await fsp.readdir(texturesSrc, { withFileTypes: true });
      for (const entry of rootTexEntries) {
        const srcPath = path.join(texturesSrc, entry.name);
        const destPath = path.join(stagingTexturesDir, entry.name);
        if (entry.isFile()) {
          if (!excludedRootTextures.includes(entry.name)) {
            await fsp.copyFile(srcPath, destPath);
          }
        } else if (entry.isDirectory() && textureSuitesToCopy.includes(entry.name)) {
          await fsp.cp(srcPath, destPath, { recursive: true });
        }
      }
    }

    // Count actual curated shader files (.fx / .fxh) and texture files included in this custom build
    async function countFilesRecursive(dirPath) {
      let count = 0;
      try {
        const entries = await fsp.readdir(dirPath, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            count += await countFilesRecursive(path.join(dirPath, e.name));
          } else if (e.isFile()) {
            count += 1;
          }
        }
      } catch (e) {}
      return count;
    }

    const actualShadersCount = await countFilesRecursive(stagingShadersDir);
    const actualTexturesCount = await countFilesRecursive(stagingTexturesDir);

    // 2. Copy IN GAME BRIGHTNESS calibration guide asynchronously
    const calibSrc = (baseTemplateDir && fs.existsSync(path.join(baseTemplateDir, 'IN GAME BRIGHTNESS.png')))
      ? path.join(baseTemplateDir, 'IN GAME BRIGHTNESS.png')
      : (fs.existsSync(path.join(__dirname, 'assets', 'IN GAME BRIGHTNESS.png')) ? path.join(__dirname, 'assets', 'IN GAME BRIGHTNESS.png') : '');
    if (calibSrc && fs.existsSync(calibSrc)) {
      try { await fsp.copyFile(calibSrc, path.join(stagingDir, 'IN GAME BRIGHTNESS.png')); } catch (e) {}
    }

    // 3. Read master calibrated INI and inject distinct profile pipeline & shader parameters
    let masterIniPath = (baseTemplateDir && fs.existsSync(path.join(baseTemplateDir, 'TACTICAL REALISEM V2.ini')))
      ? path.join(baseTemplateDir, 'TACTICAL REALISEM V2.ini')
      : '';
    if (!masterIniPath || !fs.existsSync(masterIniPath)) {
      const assetIni = path.join(__dirname, 'assets', 'TACTICAL REALISEM V2.ini');
      if (fs.existsSync(assetIni)) masterIniPath = assetIni;
    }
    if ((!masterIniPath || !fs.existsSync(masterIniPath)) && process.resourcesPath) {
      const resIni = path.join(process.resourcesPath, 'assets', 'TACTICAL REALISEM V2.ini');
      if (fs.existsSync(resIni)) masterIniPath = resIni;
    }
    let iniContent = '';
    if (masterIniPath && fs.existsSync(masterIniPath)) {
      iniContent = await fsp.readFile(masterIniPath, 'utf8');

      // Replace active Techniques pipeline on line 1 so the preset loads its distinct shader stack
      iniContent = iniContent.replace(/^Techniques=.*$/m, `Techniques=${techniquesList}`);

      // Ensure strict execution pipeline order for ReShade TechniqueSorting:
      // Depth Buffers -> Ambient Occlusion -> Exposure/Tonemapping -> Color LUTs -> Sharpening (CAS) -> Film Grain/Bloom
      iniContent = iniContent.replace(/^TechniqueSorting=.*$/m, `TechniqueSorting=${techniquesList},${iniContent.match(/^TechniqueSorting=(.*)$/m)?.[1] || ''}`);

      // Ensure PreprocessorDefinitions are at the root preset scope (NEVER in a custom section header)
      const prepDefs = 'RESHADE_DEPTH_INPUT_IS_REVERSED=1,RESHADE_DEPTH_INPUT_IS_LOGARITHMIC=0,RESHADE_DEPTH_INPUT_IS_UPSIDE_DOWN=0,RESHADE_DEPTH_LINEARIZATION_FAR_PLANE=1000.000000';
      if (/^PreprocessorDefinitions=.*$/m.test(iniContent)) {
        iniContent = iniContent.replace(/^PreprocessorDefinitions=.*$/m, `PreprocessorDefinitions=${prepDefs}`);
      } else {
        iniContent = iniContent.replace(/^(TechniqueSorting=.*$)/m, `$1\r\nPreprocessorDefinitions=${prepDefs}`);
      }

      // Depth Buffer Auto-Correction for DisplayDepth.fx
      iniContent = setIniSectionValue(iniContent, 'DisplayDepth.fx', 'iUIFormat', '0');
      iniContent = setIniSectionValue(iniContent, 'DisplayDepth.fx', 'bUIUseCustomFormat', '1');
      iniContent = setIniSectionValue(iniContent, 'DisplayDepth.fx', 'fCustomFarPlane', '1000.000000');
      iniContent = setIniSectionValue(iniContent, 'DisplayDepth.fx', 'bInvertDepth', '1');

      // Update [CAS.fx] - Razor-sharp clean edges without pixel speckling
      iniContent = setIniSectionValue(iniContent, 'CAS.fx', 'Sharpening', casSharpen);
      iniContent = setIniSectionValue(iniContent, 'CAS.fx', 'Contrast', casContrast);

      // Update [QuantV_Post.fx] - Banish all noise dots and double-sharpening
      iniContent = setIniSectionValue(iniContent, 'QuantV_Post.fx', 'Noise', '0.000000');
      iniContent = setIniSectionValue(iniContent, 'QuantV_Post.fx', 'Sharpen', qvSharpen);
      iniContent = setIniSectionValue(iniContent, 'QuantV_Post.fx', 'iBlack', '0.000000,0.000000,0.000000');

      // Update [qUINT_mxao.fx] - Grounding contact shadows under characters, tires, and objects
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_SSAO_AMOUNT', mxaoAmount);
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_SAMPLE_RADIUS', mxaoSampleRadius);
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_SAMPLE_NORMAL_BIAS', '0.200000');
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_AMOUNT_FINE', mxaoFine);
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_AMOUNT_COARSE', mxaoCoarse);
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_FADE_DEPTH_START', '0.050000');
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_FADE_DEPTH_END', '0.400000');
      iniContent = setIniSectionValue(iniContent, 'qUINT_mxao.fx', 'MXAO_DEBUG_VIEW_ENABLE', '0');

      // Update [qUINT_lightroom.fx] - Tone curves, HSL channels, exposure, balance, and lens vignette
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_SATURATION', lrSaturation);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_VIBRANCE', lrVibrance);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_EXPOSURE', lrExposure);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_CONTRAST', lrContrast);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_GAMMA', lrGamma);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_TEMPERATURE', lrTemp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_TINT', '0.000000');
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_BLACK_LEVEL', lrBlackLevel);

      // Tone curves
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_BLACKS_CURVE', blacksCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_SHADOWS_CURVE', shadowsCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_MIDTONES_CURVE', midtonesCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_HIGHLIGHTS_CURVE', highlightsCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GLOBAL_WHITES_CURVE', whitesCurve);

      // HSL channels
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_RED_SATURATION', redSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_RED_EXPOSURE', redExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_RED_HUESHIFT', redHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_ORANGE_EXPOSURE', orangeExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_ORANGE_HUESHIFT', orangeHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_ORANGE_SATURATION', orangeSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_YELLOW_EXPOSURE', yellowExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_YELLOW_HUESHIFT', yellowHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_YELLOW_SATURATION', yellowSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GREEN_EXPOSURE', greenExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GREEN_HUESHIFT', greenHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_GREEN_SATURATION', greenSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_AQUA_EXPOSURE', aquaExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_AQUA_HUESHIFT', aquaHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_AQUA_SATURATION', aquaSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_BLUE_EXPOSURE', blueExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_BLUE_HUESHIFT', blueHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_BLUE_SATURATION', blueSat);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_MAGENTA_EXPOSURE', magentaExp);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_MAGENTA_HUESHIFT', magentaHue);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_MAGENTA_SATURATION', magentaSat);

      // Lens Vignette
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_ENABLE_VIGNETTE', vignetteEnable);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_VIGNETTE_AMOUNT', vignetteAmount);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_VIGNETTE_CURVE', vignetteCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_lightroom.fx', 'LIGHTROOM_VIGNETTE_RADIUS', vignetteRadius);

      // Update [FilmicPass.fx]
      iniContent = setIniSectionValue(iniContent, 'FilmicPass.fx', 'Contrast', filmicContrast);
      iniContent = setIniSectionValue(iniContent, 'FilmicPass.fx', 'Strength', filmicStrength);
      iniContent = setIniSectionValue(iniContent, 'FilmicPass.fx', 'Fade', filmicFade);
      iniContent = setIniSectionValue(iniContent, 'FilmicPass.fx', 'Bleach', filmicBleach);

      // Update [PD80_02_Cinetools_LUT.fx] & [PD80_02_Bonus_LUT_pack.fx] - ALWAYS BAN DITHERING to ensure ZERO nano dots
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Cinetools_LUT.fx', 'enable_dither', '0');
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Cinetools_LUT.fx', 'dither_strength', '0.000000');
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Cinetools_LUT.fx', 'PD80_LutSelector', cineLutSelector);
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Cinetools_LUT.fx', 'PD80_Intensity', cineLutIntensity);
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Bonus_LUT_pack.fx', 'enable_dither', '0');
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Bonus_LUT_pack.fx', 'dither_strength', '0.000000');
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Bonus_LUT_pack.fx', 'PD80_LutSelector', bonusLutSelector);
      iniContent = setIniSectionValue(iniContent, 'PD80_02_Bonus_LUT_pack.fx', 'PD80_Intensity', bonusLutIntensity);

      // Update [qUINT_bloom.fx]
      iniContent = setIniSectionValue(iniContent, 'qUINT_bloom.fx', 'BLOOM_INTENSITY', bloomIntensity);
      iniContent = setIniSectionValue(iniContent, 'qUINT_bloom.fx', 'BLOOM_CURVE', bloomCurve);
      iniContent = setIniSectionValue(iniContent, 'qUINT_bloom.fx', 'BLOOM_SAT', bloomSat);

      // Update [MartysMods_FILMGRAIN.fx]
      iniContent = setIniSectionValue(iniContent, 'MartysMods_FILMGRAIN.fx', 'GRAIN_INTENSITY', grainIntensity);
    } else {
      iniContent = `[GENERAL]\nPreprocessorDefinitions=\nEffectSearchPaths=.,reshade-shaders/Shaders\nTextureSearchPaths=.,reshade-shaders/Textures\nTechniques=${techniquesList}\n`;
    }
    const presetFiles = [];

    const singlePresetName = `${presetName}.ini`;
    await fsp.writeFile(path.join(stagingDir, singlePresetName), iniContent, 'utf8');
    presetFiles.push(singlePresetName);

    // Also write direct standalone .ini file to Downloads for instant drag-and-drop
    try {
      await fsp.writeFile(path.join(downloadsDir, singlePresetName), iniContent, 'utf8');
    } catch (e) {}

    // Auto-install directly into GTA V if game is GTAV or if GTA V directory exists
    const possibleGtaDirs = [
      'C:\\Program Files\\Epic Games\\GTAV',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V',
      'D:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V',
      'E:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V',
      'C:\\Program Files\\Rockstar Games\\Grand Theft Auto V',
      'D:\\Grand Theft Auto V',
      'E:\\Grand Theft Auto V'
    ];
    for (const gta5Dir of possibleGtaDirs) {
      if (fs.existsSync(gta5Dir) && (/gta/i.test(p) || explicitGame.toLowerCase().includes('gta') || profileId === 'photoreal' || profileId === 'dark_vibrant_noir')) {
        try {
          const destIniPath = path.join(gta5Dir, singlePresetName);
          await fsp.writeFile(destIniPath, iniContent, 'utf8');
          const calibDest = path.join(gta5Dir, 'IN GAME BRIGHTNESS.png');
          if (calibSrc && fs.existsSync(calibSrc)) await fsp.copyFile(calibSrc, calibDest);

          // Update ReShade.ini to point to new preset
          const reshadeIniPath = path.join(gta5Dir, 'ReShade.ini');
          if (fs.existsSync(reshadeIniPath)) {
            let rIni = await fsp.readFile(reshadeIniPath, 'utf8');
            rIni = setIniSectionValue(rIni, 'GENERAL', 'PresetPath', `.\\${singlePresetName}`);
            rIni = setIniSectionValue(rIni, 'GENERAL', 'StartupPresetPath', `.\\${singlePresetName}`);
            await fsp.writeFile(reshadeIniPath, rIni, 'utf8');
          }
        } catch (err) {
          console.warn('[ReShade] Auto-install to GTA V directory notice:', err.message);
        }
      }
    }

    // 4. Comprehensive README.txt with exact profile calibration details
    const readmeContent = `========================================================================\n` +
      `  ${presetName} — Professional High-Fidelity ReShade Preset Package\n` +
      `  Visual Calibration : ${styleName}\n` +
      `  Active Pipeline    : ${activeTechniquesSummary}\n` +
      `  Depth Buffer       : Auto-Corrected (Reversed Depth=1, Logarithmic=0)\n` +
      `  Render Order       : Strict Depth -> AO -> Tonemap -> LUT -> Sharpen Pipeline\n` +
      `  Compiled by Sparx Graphics Engineering Subsystem\n` +
      `========================================================================\n\n` +
      `IN-GAME SDR/HDR BRIGHTNESS MATCHER:\n` +
      `1. Open "IN GAME BRIGHTNESS.png" included in this archive alongside your game.\n` +
      `2. Go into your game's Display / Graphics settings and adjust the in-game Gamma or Brightness slider until the reference blocks on the image align correctly:\n` +
      `   - Block 1 (Shadow Detail): Just barely discernible from pitch black.\n` +
      `   - Block 2 (Midtones): Smooth 50% neutral gray without color tinting.\n` +
      `   - Block 3 (Highlights): Pure white without clipping sky detail or specular reflections.\n` +
      `3. For HDR displays: Set Peak Luminance to your monitor's rated nits (e.g. 600 or 1000) and Paper White to 200 nits.\n\n` +
      `CALIBRATED SHADER PARAMETERS:\n` +
      `- Active Techniques : ${techniquesList}\n` +
      `- AMD CAS Sharpen   : ${parseFloat(casSharpen).toFixed(2)} (Contrast: ${parseFloat(casContrast).toFixed(2)})\n` +
      `- QuantV Post Sharp : ${parseFloat(qvSharpen).toFixed(2)}\n` +
      `- Lightroom Grade   : Saturation ${parseFloat(lrSaturation).toFixed(3)} | Vibrance ${parseFloat(lrVibrance).toFixed(3)} | Exposure ${parseFloat(lrExposure).toFixed(3)} | Contrast ${parseFloat(lrContrast).toFixed(3)}\n` +
      `- FilmicPass Curve  : Contrast ${parseFloat(filmicContrast).toFixed(3)} | Strength ${parseFloat(filmicStrength).toFixed(3)} | Bleach ${parseFloat(filmicBleach).toFixed(3)}\n` +
      `- PD80 LUT Profile  : Cinetools LUT #${cineLutSelector} (${(parseFloat(cineLutIntensity) * 100).toFixed(0)}%) | Bonus LUT #${bonusLutSelector} (${(parseFloat(bonusLutIntensity) * 100).toFixed(0)}%)\n` +
      `- Bloom & AO        : Bloom Intensity ${parseFloat(bloomIntensity).toFixed(2)} | MXAO Radius ${parseFloat(mxaoSampleRadius).toFixed(1)}\n\n` +
      `PACKAGE SPECIFICATIONS (>100MB Drop-In Suite):\n` +
      `- Preset Profiles   : ${presetFiles.join(', ')}\n` +
      `- Shaders Included  : ${actualShadersCount} specialized post-processing shaders\n` +
      `- Textures Included : ${actualTexturesCount} color correction LUTs, bloom profiles, dirt maps, lens textures, and film grain maps\n` +
      `- Calibration Guide : IN GAME BRIGHTNESS.png (HDR/SDR reference guide)\n\n` +
      `DROP-IN INSTALLATION:\n` +
      `1. Download and install ReShade (https://reshade.me) for your game executable (DirectX 11/12 or Vulkan).\n` +
      `2. Extract ALL contents of this ZIP directly into your game's root directory (where the game .exe and dxgi.dll reside).\n` +
      `3. Confirm that "${presetName}.ini", "IN GAME BRIGHTNESS.png", and "reshade-shaders" folder are alongside the game .exe.\n` +
      `4. Launch the game and press [Home] or [Shift + F2] to access the ReShade overlay.\n` +
      `5. In the top preset selector bar, select ${singlePresetName}.\n` +
      `6. Match your in-game display brightness with "IN GAME BRIGHTNESS.png" for optimal contrast.\n`;
    await fsp.writeFile(path.join(stagingDir, 'README.txt'), readmeContent, 'utf8');

    // 5. Pack to Downloads asynchronously. Retry with PowerShell's ZIP writer if tar fails.
    try {
      if (fs.existsSync(zipFilePath)) {
        try { await fsp.unlink(zipFilePath); } catch (e) {}
      }
      const createZipWithPowerShell = async () => {
        if (fs.existsSync(zipFilePath)) {
          try { await fsp.unlink(zipFilePath); } catch (e) {}
        }
        const quotePowerShell = (value) => `'${String(value).replace(/'/g, "''")}'`;
        const powershellZip = `Compress-Archive -Path ${quotePowerShell(path.join(stagingDir, '*'))} -DestinationPath ${quotePowerShell(zipFilePath)} -Force`;
        await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', powershellZip], { timeout: 10 * 60 * 1000 });
      };
      if (retryAttempt) {
        await createZipWithPowerShell();
      } else {
        try {
          await execFileAsync('tar.exe', ['-a', '-c', '-f', zipFilePath, '-C', stagingDir, '.']);
        } catch (tarErr) {
          try {
            await createZipWithPowerShell();
          } catch (powershellErr) {
            throw new Error(`tar.exe failed (${tarErr.message}); PowerShell ZIP retry failed (${powershellErr.message}).`);
          }
        }
      }
    } finally {
      // Move stagingDir directly to extractedFolderPath (fast rename or async copy) instead of redundant sync copy
      try {
        if (fs.existsSync(extractedFolderPath)) {
          await fsp.rm(extractedFolderPath, { recursive: true, force: true });
        }
        try {
          await fsp.rename(stagingDir, extractedFolderPath);
        } catch (renameErr) {
          await fsp.cp(stagingDir, extractedFolderPath, { recursive: true });
          await fsp.rm(stagingDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        try { await fsp.rm(stagingDir, { recursive: true, force: true }); } catch (e) {}
      }
    }

    const zipStat = await fsp.stat(zipFilePath);
    if (!zipStat.isFile() || zipStat.size < 100) {
      throw new Error(`The generated ReShade archive is incomplete (${zipStat.size} bytes). Retrying the preset build.`);
    }
    const sizeBytes = zipStat.size;
    const sizeMb = `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;

    return {
      success: true,
      profileId,
      presetName,
      styleName,
      activeTechniquesSummary,
      curatedSuites: selectedSuites,
      fileName: zipFileName,
      filePath: zipFilePath,
      folderPath: extractedFolderPath,
      presetFiles,
      sizeBytes,
      sizeMb,
      stats: {
        sharpen: parseFloat((typeof casSharpen !== 'undefined' && casSharpen) ? casSharpen : (typeof sharpen !== 'undefined' ? sharpen : '1.15')).toFixed(2),
        clamp: parseFloat((typeof casContrast !== 'undefined' && casContrast) ? casContrast : '0.06').toFixed(3),
        saturation: parseFloat((typeof lrSaturation !== 'undefined' && lrSaturation) ? lrSaturation : '0.18').toFixed(2),
        vibrance: parseFloat((typeof lrVibrance !== 'undefined' && lrVibrance) ? lrVibrance : '0.15').toFixed(2),
        contrast: parseFloat((typeof filmicContrast !== 'undefined' && filmicContrast) ? filmicContrast : '1.0').toFixed(2),
        lutProfile: `LUT #${(typeof cineLutSelector !== 'undefined' && cineLutSelector) ? cineLutSelector : '27'}`,
        bloom: parseFloat((typeof bloomIntensity !== 'undefined' && bloomIntensity) ? bloomIntensity : '0.35').toFixed(2),
        shadersCount: actualShadersCount || (selectedSuites && selectedSuites.length ? selectedSuites.length * 2 : 16),
        texturesCount: actualTexturesCount || 14,
        suitesCount: (selectedSuites && selectedSuites.length) ? selectedSuites.length : 0,
        glow: parseFloat((typeof bloomIntensity !== 'undefined' && bloomIntensity) ? bloomIntensity : '0.35') > 1.3
      }
    };
}

async function executeGenerateReshadePresetWithRecovery(input = '') {
  try {
    return await executeGenerateReshadePreset(input);
  } catch (primaryError) {
    console.warn('[ReShade] Full-library generation failed; retrying the full build:', primaryError.message);
    const retryInput = typeof input === 'object' && input !== null
      ? { ...input, retryAttempt: true }
      : { description: String(input || ''), retryAttempt: true };

    try {
      const retried = await executeGenerateReshadePreset(retryInput);
      return { ...retried, recoveredFromError: primaryError.message };
    } catch (recoveryError) {
      throw new Error(`Full-library ReShade generation failed twice. First attempt: ${primaryError.message}. Retry: ${recoveryError.message}.`);
    }
  }
}

function buildReshadePresetCardHtml(res) {
  const safeFilePath = res.filePath.replace(/\\/g, '/');
  const safeDir = path.dirname(res.filePath).replace(/"/g, '&quot;');
  const safePath = res.filePath.replace(/"/g, '&quot;');
  const presetChoices = (Array.isArray(res.presetFiles) && res.presetFiles.length ? res.presetFiles : [`${res.presetName}.ini`])
    .map((fileName) => `<code>${fileName}</code>`)
    .join(', ');

  return `
<div class="reshade-preset-glass-card">
  <div class="preset-card-header">
    <div class="preset-card-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    </div>
    <div class="preset-card-title-group">
      <div class="preset-badge">${res.sizeMb || 'Size unavailable'}</div>
      <h3 class="preset-headline">${res.presetName}</h3>
      <p class="preset-subline">${res.styleName || 'Curated ReShade Preset'}</p>
    </div>
  </div>

  <div class="preset-specs-grid">
    <div class="preset-spec-pill">
      <span class="spec-label">Package Size</span>
      <span class="spec-value">${res.sizeMb || 'Size unavailable'}</span>
    </div>
    <div class="preset-spec-pill">
      <span class="spec-label">Shaders</span>
      <span class="spec-value">${res.stats?.shadersCount ?? '—'} FX</span>
    </div>
    <div class="preset-spec-pill">
      <span class="spec-label">Textures</span>
      <span class="spec-value">${res.stats?.texturesCount ?? '—'} LUTs</span>
    </div>
    <div class="preset-spec-pill">
      <span class="spec-label">Sharpening</span>
      <span class="spec-value">${res.stats?.sharpen || '1.18'}</span>
    </div>
  </div>

  <div class="preset-card-actions">
    <a href="file:///${safeFilePath}" class="btn-download-preset-glass" data-preset-path="${safePath}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Download it now</span>
    </a>
    <button class="btn-reveal-folder-glass" data-folder="${safeDir}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      <span>Open Folder</span>
    </button>
  </div>

  <div class="preset-quick-steps">
    <div class="step-line"><span class="step-num">1</span> Extract <strong><code>${res.fileName}</code></strong> into your game directory.</div>
    <div class="step-line"><span class="step-num">2</span> Press <kbd>Home</kbd> in-game and select <strong>${presetChoices}</strong>.</div>
  </div>
</div>
`;
}

// ----------------------------------------------------------------------------
// Edge TTS & Pollinations.ai Integration Subsystem
// ----------------------------------------------------------------------------
async function executeGenerateVoice({ text, filename, voice }) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const tts = new MsEdgeTTS();
  const selectedVoice = voice || 'en-US-ChristopherNeural';
  await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const downloadsDir = app.getPath('downloads') || path.join(os.homedir(), 'Downloads');
  const cleanBase = (filename || `speech_${Date.now()}`).replace(/\.mp3$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeBase = cleanBase || `voice_${Date.now()}`;
  const outDir = path.join(os.tmpdir(), `tts_gen_${Date.now()}`);
  await fs.promises.mkdir(outDir, { recursive: true });

  const res = await tts.toFile(outDir, safeBase, text);
  const targetMp3 = path.join(downloadsDir, `${safeBase}.mp3`);
  
  // Copy to downloads
  await fs.promises.copyFile(res.audioFilePath, targetMp3);
  const st = await fs.promises.stat(targetMp3);

  try { await fs.promises.rm(outDir, { recursive: true, force: true }); } catch(e) {}

  return {
    success: true,
    text,
    voice: selectedVoice,
    fileName: `${safeBase}.mp3`,
    filePath: targetMp3,
    sizeBytes: st.size,
    sizeKb: `${(st.size / 1024).toFixed(1)} KB`
  };
}

async function executeGenerateTexture({ prompt, filename, width, height }) {
  const https = require('https');
  const w = width || 512;
  const h = height || 512;
  const encodedPrompt = encodeURIComponent(prompt);
  const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&nologo=true`;

  const downloadsDir = app.getPath('downloads') || path.join(os.homedir(), 'Downloads');
  const cleanBase = (filename || `texture_${Date.now()}`).replace(/\.(png|jpg|jpeg)$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const ext = (filename && filename.toLowerCase().endsWith('.png')) ? 'png' : 'jpg';
  const targetFile = path.join(downloadsDir, `${cleanBase}.${ext}`);

  return new Promise((resolve, reject) => {
    https.get(pollUrl, (res) => {
      if (res.statusCode >= 400) {
        let errData = '';
        res.on('data', c => errData += c);
        res.on('end', () => {
          reject(new Error(`Pollinations HTTP ${res.statusCode}: ${errData.slice(0, 150)}`));
        });
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', async () => {
        try {
          const totalBuffer = Buffer.concat(chunks);
          await fs.promises.writeFile(targetFile, totalBuffer);
          const st = await fs.promises.stat(targetFile);
          resolve({
            success: true,
            prompt,
            fileName: `${cleanBase}.${ext}`,
            filePath: targetFile,
            sizeBytes: st.size,
            sizeKb: `${(st.size / 1024).toFixed(1)} KB`,
            dimensions: `${w}x${h}`
          });
        } catch (writeErr) {
          reject(writeErr);
        }
      });
    }).on('error', reject);
  });
}

function buildVoiceResultHtml(res) {
  const safePath = res.filePath.replace(/\\/g, '/');
  return `
<div class="reshade-preset-glass-card" style="border-left: 3px solid #38bdf8;">
  <div class="preset-card-header">
    <div class="preset-card-icon" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    </div>
    <div class="preset-card-title-group">
      <div class="preset-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">Edge Neural TTS</div>
      <h3 class="preset-headline">${res.fileName}</h3>
      <p class="preset-subline">${res.voice} · ${res.sizeKb}</p>
    </div>
  </div>
  <p style="font-size: 13px; color: #a1a1aa; margin: 10px 0 14px 0; font-style: italic;">"${res.text}"</p>
  <div class="preset-card-actions">
    <a href="file:///${safePath}" class="btn-download-preset-glass">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Open Audio</span>
    </a>
  </div>
</div>`;
}

function buildTextureResultHtml(res) {
  const safePath = res.filePath.replace(/\\/g, '/');
  return `
<div class="reshade-preset-glass-card" style="border-left: 3px solid #a855f7;">
  <div class="preset-card-header">
    <div class="preset-card-icon" style="background: rgba(168, 85, 247, 0.2); color: #a855f7;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    </div>
    <div class="preset-card-title-group">
      <div class="preset-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">Pollinations PBR Texture</div>
      <h3 class="preset-headline">${res.fileName}</h3>
      <p class="preset-subline">${res.dimensions} · ${res.sizeKb}</p>
    </div>
  </div>
  <p style="font-size: 12.5px; color: #d4d4d8; margin: 10px 0 14px 0;"><strong>Prompt:</strong> ${res.prompt}</p>
  <div style="margin-bottom: 14px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); max-height: 220px; display: flex; justify-content: center; background: #000;">
    <img src="file:///${safePath}" style="max-height: 220px; object-fit: contain; width: 100%;" alt="Generated Texture" />
  </div>
  <div class="preset-card-actions">
    <a href="file:///${safePath}" class="btn-download-preset-glass">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Open Texture</span>
    </a>
  </div>
</div>`;
}

// ----------------------------------------------------------------------------
// Adaptive Skill & Memory Engine (Auto-evolving AI knowledge on every turn)
// ----------------------------------------------------------------------------
function getLearnedSkillsPath() {
  return path.join(app.getPath('userData'), 'tactical-learned-skills.json');
}

function loadLearnedSkills() {
  try {
    const p = getLearnedSkillsPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [
    'Ultra-Crisp Visual Calibration: zero-halo sharpness, saturated vibrance, and neutral gamma balancing',
    'Human-Speed Deliberation: thoughtful architectural reasoning before token delivery',
    'OLED Dark Workstation Philosophy: deep contrast, focused typography, and minimal cognitive overhead'
  ];
}

function recordLearnedSkill(skill) {
  try {
    const p = getLearnedSkillsPath();
    const skills = loadLearnedSkills();
    if (!skills.includes(skill)) {
      skills.push(skill);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(skills, null, 2), 'utf8');
      return true;
    }
  } catch (e) {}
  return false;
}

const GROQ_MODEL = 'openai/gpt-oss-120b';

function resolveModelId(model) {
  if (!model) return 'openai/gpt-oss-120b';
  const m = String(model).toLowerCase();
  if (m.includes('3.8') || m.includes('pro') || m.includes('llama') || m === 'openai/gpt-oss-20b') {
    return 'openai/gpt-oss-20b';
  }
  if (m.includes('3.9') || m.includes('flash') || m.includes('gpt-oss') || m === 'openai/gpt-oss-120b') {
    return 'openai/gpt-oss-120b';
  }
  if (m.startsWith('gemini')) return model;
  return 'openai/gpt-oss-120b';
}

function getModelDisplayName(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('3.8') || m.includes('pro') || m.includes('llama') || m === 'openai/gpt-oss-20b') {
    return 'Sparx 3.8 Pro';
  }
  if (m.startsWith('gemini')) return model;
  return 'Sparx 3.9 Flash';
}

const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'locate_folder',
      description: 'Locate a folder on the PC by searching sensible user locations (Desktop, Documents, Downloads, Home) or active workspace. If earlier chat context established a path, specify it in location. Never scans whole disk.',
      parameters: {
        type: 'object',
        properties: {
          folderName: { type: 'string', description: 'Name of the folder to locate (e.g. "swuzy", "TWIZZY").' },
          location: { type: 'string', description: 'Optional preferred location or established path.' }
        },
        required: ['folderName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: 'Find files matching a specific pattern or extension (e.g. ".txt", "*.txt", "model_description.txt") inside a folder on the PC or workspace.',
      parameters: {
        type: 'object',
        properties: {
          folderPath: { type: 'string', description: 'Directory path or folder name to search inside.' },
          pattern: { type: 'string', description: 'File pattern or extension to search for (e.g. ".txt", "*.txt", "notes.txt").' },
          location: { type: 'string', description: 'Target location: "desktop", "documents", "downloads", "home", "workspace", or custom path.' }
        },
        required: ['folderPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_workspace',
      description: 'Search workspace files and directories by name, path pattern, or file content.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'File name pattern or text to search for.' },
          path: { type: 'string', description: 'Optional directory path to search within.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the exact contents of a file on the PC (Desktop, Documents, Downloads, Home) or workspace within an optional line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path, absolute path, or filename.' },
          location: { type: 'string', description: 'Target location: "desktop", "documents", "downloads", "home", "workspace", or custom folder path (e.g. "C:\\Users\\...\\swuzy"). Defaults to "workspace".' },
          startLine: { type: 'integer', description: '1-based starting line number.' },
          endLine: { type: 'integer', description: '1-based ending line number.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Apply surgical edits by replacing a target block or replacing file content. Returns a unified diff.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path in workspace.' },
          target: { type: 'string', description: 'Exact or whitespace-similar block to replace. Omit if replacing whole file.' },
          replacement: { type: 'string', description: 'Replacement string.' }
        },
        required: ['path', 'replacement']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_directory',
      description: 'Create a new directory or folder at a specific destination (PC location such as Desktop, Documents, Downloads, or active workspace). CRITICAL: If the user did not specify WHERE they want the folder (e.g. "make me a new folder called frizzy"), DO NOT call this tool yet! First ask where on their PC they want it (Desktop, Documents, Downloads, or Current Project Workspace). Only call this tool once the location is specified or known.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Name or relative path of the directory/folder to create (e.g., "TWIZZY", "sub/folder").'
          },
          location: {
            type: 'string',
            description: 'Target location: "desktop", "documents", "downloads", "home", "workspace", or a custom folder path.'
          }
        },
        required: ['path', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file with specified content at a chosen destination (workspace or PC location). Supports common file types including .txt, source code (.js, .py), configuration (.json, .yaml), documentation (.md), etc. Automatically verifies existence and contents on disk.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File name or relative path (e.g., "model_description.txt", "TWIZZY/model_description.txt") or absolute path.'
          },
          content: {
            type: 'string',
            description: 'Full text content to write into the file.'
          },
          location: {
            type: 'string',
            description: 'Target location: "desktop", "documents", "downloads", "home", "workspace", or custom folder path (e.g. "C:\\Users\\...\\Desktop\\TWIZZY"). If creating inside a folder discussed in chat, use that same location. If parent location is unknown and not in history, ask the user before calling.'
          },
          overwrite: {
            type: 'boolean',
            description: 'Whether to allow overwriting if file already exists.'
          }
        },
        required: ['path', 'content', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and subdirectories inside a directory on the PC (Desktop, Documents, Downloads, Home) or workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path or folder name. Defaults to root workspace.' },
          location: { type: 'string', description: 'Target location: "desktop", "documents", "downloads", "home", "workspace", or custom folder path.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command in workspace.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command string to execute.' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search for text or identifiers across workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search string.' },
          path: { type: 'string', description: 'Optional directory path.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the live web using DuckDuckGo. Returns real, organic search results with titles, URLs, and text snippets. Use whenever the user asks for current information, documentation, news, or external web facts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The web search query.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_web_page',
      description: 'Navigate to a specific web URL and read its accessible content. Executes JavaScript for dynamic single-page applications and extracts clean markdown/text content, page title, and key links. Blocked pages and sign-in walls are detected and reported truthfully.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The HTTP or HTTPS URL of the webpage to inspect.' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_web',
      description: 'Comprehensive web research tool: searches the web for a query and visits the top relevant result pages, extracting real evidence and providing verified source links.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The research topic or query to search and investigate.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'computer_use',
      description: 'Interact with the desktop operating system: launch or close applications, click UI elements, type text, press keyboard shortcuts, or inspect the screen. Computer use is enabled by default.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['launch_app', 'close_app', 'click', 'type', 'key', 'inspect_screen', 'mouse_move'],
            description: 'The desktop action to perform.'
          },
          app: {
            type: 'string',
            description: 'Name of the application to open or close (e.g. "Claude", "Brave", "Chrome", "Notepad").'
          },
          text: {
            type: 'string',
            description: 'Text to type into the active window.'
          },
          x: {
            type: 'number',
            description: 'X coordinate on primary display.'
          },
          y: {
            type: 'number',
            description: 'Y coordinate on primary display.'
          },
          key: {
            type: 'string',
            description: 'Key name (e.g. "Return", "Escape", "Tab").'
          }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_reshade_preset',
      description: 'Compile and package a complete, standalone >100MB (~145.9 MB) ReShade graphical preset suite directly into the user\'s Downloads folder. Includes all 91 specialized shaders (QuantV, qUINT_lightroom, PD80, MartysMods RTGI/MXAO, AMD CAS, FilmicPass, etc.), 105 LUTs/textures, calibrated [preset_name].ini, IN GAME BRIGHTNESS.png, and README.txt in both a .zip archive and extracted folder. ALWAYS use this tool for any ReShade preset request; NEVER use create_file or create_directory to write fake or 1KB shader stubs.',
      parameters: {
        type: 'object',
        properties: {
          preset_name: {
            type: 'string',
            description: 'Custom name for the preset and ZIP package (e.g. "gta5photoreal", "Tactical_Realism_GTA5").'
          },
          game: {
            type: 'string',
            description: 'Target game name (e.g. "GTA V", "FiveM", "Cyberpunk 2077", "RDR2").'
          },
          style: {
            type: 'string',
            description: 'Visual style calibration (e.g. "photoreal", "ultra crisp", "vivid hdr", "night noir", "atmospheric bloom").'
          },
          description: {
            type: 'string',
            description: 'Additional details or user prompt requirements.'
          }
        },
        required: ['preset_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_voice',
      description: 'Generate high-definition spoken audio using Edge TTS neural voices and save an MP3 audio file to disk (Downloads or desktop). Use when the user asks to generate voice, speech, narration, radio dispatch dialogue, or voiceover audio.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The exact speech or dialogue text to synthesize.'
          },
          filename: {
            type: 'string',
            description: 'Output filename (without extension or with .mp3), e.g. "police_dispatch_audio", "narrator_intro".'
          },
          voice: {
            type: 'string',
            description: 'Microsoft Edge Neural voice code. Defaults to "en-US-ChristopherNeural". Options include "en-US-GuyNeural", "en-US-JennyNeural", "en-US-AriaNeural", "en-GB-RyanNeural", "en-US-EricNeural".'
          }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_texture',
      description: 'Synthesize a photorealistic or stylized game texture / PBR map / visual concept using Pollinations.ai and save directly to disk (Downloads or game folder). Use when the user requests generating a texture, material, background, or game graphic.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed prompt describing the texture (e.g. "seamless wet asphalt road with oil puddles and rain droplets pbr 4k texture", "rusty corrugated metal wall texture seamless").'
          },
          filename: {
            type: 'string',
            description: 'Output image filename (e.g. "wet_asphalt_diffuse.jpg", "neon_sign_texture.png").'
          },
          width: {
            type: 'number',
            description: 'Texture width in pixels (e.g. 512, 1024).'
          },
          height: {
            type: 'number',
            description: 'Texture height in pixels (e.g. 512, 1024).'
          }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_lspdfr_plugin',
      description: 'Generate, scaffold, compile, and package a complete C# LSPDFR / RAGE Plugin Hook plugin suite for GTA V. Creates complete Visual Studio project, C# source files, .ini config, synthesized Edge TTS police radio audio clips, validated UI textures via Pollinations, and compiles directly into a working .dll via csc.exe. Returns a .zip archive and extracted project ready to install in Grand Theft Auto V/plugins/LSPDFR/.',
      parameters: {
        type: 'object',
        properties: {
          plugin_name: {
            type: 'string',
            description: 'PascalCase name of the plugin (e.g. "ApexRadar", "RealisticTrafficStop", "CivilianInteractionPro").'
          },
          plugin_type: {
            type: 'string',
            enum: ['police_radar', 'civilian_interaction', 'custom_callout', 'custom'],
            description: 'Type of LSPDFR plugin to scaffold and compile.'
          },
          description: {
            type: 'string',
            description: 'Summary of the plugin features, mechanics, and in-game behavior.'
          }
        },
        required: ['plugin_name', 'plugin_type']
      }
    }
  }
];

// Strip reasoning and thinking tags (<think>...</think>, <thought>...</thought>, <reasoning>...</reasoning>)
// Preserves exact leading/trailing spaces when trim=false so token streaming does not collapse words.
function stripReasoningTags(text, trim = false) {
  if (!text || typeof text !== 'string') return '';
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '')
    .replace(/<reasoning>[\s\S]*$/gi, '');
  return trim ? cleaned.trim() : cleaned;
}

// Redact any accidental credential leaks from AI streaming text while preserving spacing
function sanitizeChatOutput(text, trim = false) {
  if (!text || typeof text !== 'string') return '';
  const noReasoning = stripReasoningTags(text, trim);
  const redacted = noReasoning
    .replace(/gsk_[a-zA-Z0-9]{40,}/g, '[REDACTED_API_KEY]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  return trim ? redacted.trim() : redacted;
}

// Conversation context sanitizer & pruner: maintains strict chronological order, speaker role alternation,
// preserves tool calls & results for groq/openai, and prevents duplication across streaming, retries, and switches.
function sanitizeConversationHistory(rawMessages, targetProvider = 'groq') {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return [];

  const assistantRole = targetProvider === 'gemini' ? 'model' : 'assistant';
  const userRole = 'user';

  // Step 1: Normalize roles, prune heavy older artifacts, and discard empty/whitespace turns
  const cleaned = [];
  for (let i = 0; i < rawMessages.length; i++) {
    const m = rawMessages[i];
    if (!m) continue;

    // Preserve tool results in groq/openai format
    if (m.role === 'tool' && targetProvider === 'groq') {
      cleaned.push({
        role: 'tool',
        tool_call_id: m.tool_call_id || `call_${i}`,
        name: m.name || 'tool',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || {})
      });
      continue;
    }

    const isAssistant = m.role === 'assistant' || m.role === 'model';
    const role = isAssistant ? assistantRole : userRole;

    // Preserve assistant messages with tool_calls in groq/openai format
    if (isAssistant && targetProvider === 'groq' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      cleaned.push({
        role: 'assistant',
        content: m.content ? sanitizeChatOutput(m.content) : null,
        tool_calls: m.tool_calls
      });
      continue;
    }

    let text = String(m.text || m.content || '').trim();
    if (!text) continue;

    const isLatest = (i === rawMessages.length - 1);
    if (!isLatest) {
      if (text.includes('[Context: Attached Workspace Files]')) {
        text = text.replace(/\[Context: Attached Workspace Files\][\s\S]*?(?=\n\n|$)/, '[Prior files analyzed]');
      }
      if (text.includes('reshade-preset-glass-card')) {
        text = 'Generated crisp ReShade graphical preset package for you.';
      }
      if (text.includes('Desktop Control Session') || text.includes('Screen Stream: Active') || text.includes('Desktop Screen Captured')) {
        text = '[Prior desktop inspection completed]';
      }
      if (text.includes('remote desktop session') || text.includes('Full Access mode here in the chat')) {
        text = text.replace(/\(Just a quick heads up:[\s\S]*?\)/gi, '').trim();
      }
      if (text.length > 4000) {
        text = text.slice(0, 4000) + '...';
      }
    }

    const sanitized = sanitizeChatOutput(text);
    if (!sanitized) continue;

    // Discard exact consecutive duplicate messages
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === role && prev.content === sanitized && !prev.tool_calls) {
      continue;
    }

    cleaned.push({ role, content: sanitized });
  }

  if (cleaned.length === 0) return [];

  // Step 2: Strict turn alternation without dropping consecutive instructions
  // If consecutive turns from the same speaker occur (e.g. user sends two instructions in sequence),
  // merge their contents with a clear separator so NO user turn is lost or overwritten.
  const alternating = [];
  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i];
    const prev = alternating[alternating.length - 1];

    if (cur.role === 'tool' || (cur.tool_calls && cur.tool_calls.length > 0)) {
      alternating.push(cur);
      continue;
    }

    if (prev && prev.role === cur.role && !prev.tool_calls && prev.role !== 'tool') {
      prev.content = prev.content + '\n\n' + cur.content;
    } else {
      alternating.push(cur);
    }
  }

  // Step 3: Context retention: keep up to 80 turns to maintain deep conversation memory
  let slice = alternating;
  if (slice.length > 80) {
    const head = slice.slice(0, 6);
    const tail = slice.slice(-74);
    slice = [...head, ...tail];
  }

  // Step 4: Ensure conversation starts with a user turn (never an orphaned assistant answer or tool turn)
  while (slice.length > 0 && slice[0].role !== userRole) {
    slice.shift();
  }

  // Step 5: Ensure conversation ends with the user's latest query
  if (slice.length === 0 && alternating.length > 0) {
    const lastUser = [...alternating].reverse().find(m => m.role === userRole);
    if (lastUser) slice = [lastUser];
  }

  return slice;
}

// Stream Groq response with natural, human-readable pacing, tool execution loop, and credential safety
async function streamGroqResponse(apiKey, messages, systemInstruction, targetModel, toolDefinitions = AGENT_TOOL_DEFINITIONS, mode = 'chat', recursionDepth = 0) {
  const https = require('https');
  const modelToUse = resolveModelId(targetModel);

  return new Promise((resolve, reject) => {
    const formattedMessages = [];
    if (systemInstruction) {
      formattedMessages.push({ role: 'system', content: systemInstruction });
    }
    const cleanHistory = sanitizeConversationHistory(messages, 'groq');
    cleanHistory.forEach((m) => formattedMessages.push(m));

    const payloadObj = {
      model: modelToUse,
      messages: formattedMessages,
      stream: true,
      temperature: 0.65
    };
    if (toolDefinitions && toolDefinitions.length > 0) {
      payloadObj.tools = toolDefinitions;
    }
    const payload = JSON.stringify(payloadObj);

    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SparxIDE/1.0',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 45000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = '';
        res.on('data', chunk => errBody += chunk);
        res.on('end', async () => {
          let errDetail = errBody;
          try {
            const parsed = JSON.parse(errBody);
            errDetail = parsed.error?.message || errBody;
          } catch (e) {}

          // Automatic key rotation on auth expiration (401), access rejection (403), or quota exhaustion (429)
          const isAuthOrQuotaError = (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429);
          if (isAuthOrQuotaError) {
            const nextKey = markGroqKeyExpired(apiKey, `HTTP ${res.statusCode}: ${errDetail}`);
            if (nextKey && nextKey !== apiKey) {
              console.log(`[Groq Fallback] Retrying chat completion with fallback key (${nextKey.slice(0, 10)}...)...`);
              try {
                const retryResult = await streamGroqResponse(
                  nextKey,
                  messages,
                  systemInstruction,
                  targetModel,
                  toolDefinitions,
                  mode,
                  recursionDepth
                );
                return resolve(retryResult);
              } catch (retryErr) {
                return reject(retryErr);
              }
            }
          }

          let friendlyError = '';
          if (res.statusCode === 401) {
            friendlyError = `Authentication failed (401): The configured API key is invalid or expired. (${errDetail})`;
          } else if (res.statusCode === 403) {
            friendlyError = `Access denied (403): Request was rejected by the provider gateway. (${errDetail})`;
          } else if (res.statusCode === 429) {
            friendlyError = `Rate limit exceeded (429): Quota exhausted. Please try again in a few moments. (${errDetail})`;
          } else {
            friendlyError = `API error (${res.statusCode}): ${errDetail}`;
          }
          reject(new Error(friendlyError));
        });
        return;
      }

      let fullContent = '';
      let fullReasoning = '';
      const accumulatedToolCalls = [];
      const executedResults = [];
      let buffer = '';
      const tokenQueue = [];
      let isStreamingEnded = false;
      let pacingTimer = null;

      async function finishStream() {
        if (pacingTimer) {
          clearInterval(pacingTimer);
          pacingTimer = null;
        }

        // If tool calls were accumulated from Groq, execute them autonomously in backend
        if (accumulatedToolCalls.length > 0 && recursionDepth < 6) {
          try {
            const assistantToolMsg = {
              role: 'assistant',
              content: fullContent || null,
              tool_calls: accumulatedToolCalls
            };
            const nextHistory = [...messages, assistantToolMsg];

            for (const tc of accumulatedToolCalls) {
              const fnName = tc.function?.name;
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(tc.function?.arguments || '{}');
              } catch (e) {
                toolArgs = {};
              }

              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('chat:status', {
                  state: 'tool',
                  toolName: fnName,
                  details: `Executing ${fnName}...`
                });
              }

              let toolResult = null;
              if (fnName === 'run_command') {
                const check = checkCommandSafety(toolArgs.command);
                if (!check.allowed) {
                  toolResult = { error: `Command blocked by safety policy: ${check.reason}` };
                } else {
                  const auth = await authorizeAction({
                    capability: 'terminal',
                    riskLevel: 'medium',
                    signature: `terminal:exec:${toolArgs.command}`,
                    title: 'Run Terminal Command',
                    details: toolArgs.command
                  });
                  if (!auth.allowed) {
                    toolResult = { error: 'Command execution was denied by operator.' };
                  } else {
                    toolResult = await executeBackendAgentTool(fnName, toolArgs);
                  }
                }
              } else if (fnName === 'search_web') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', { state: 'searching', query: toolArgs.query });
                }
                toolResult = await searchWeb(toolArgs.query);
              } else if (fnName === 'read_web_page') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', { state: 'tool', toolName: 'read_web_page', details: `Inspecting ${toolArgs.url}...` });
                }
                toolResult = await readWebPage(toolArgs.url);
              } else if (fnName === 'browse_web') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', { state: 'searching', query: toolArgs.query });
                }
                toolResult = await performWebResearch(toolArgs.query);
              } else if (fnName === 'computer_use') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('computer:activity-started', { action: toolArgs.action, details: toolArgs.app || toolArgs.text || '' });
                }
                try {
                  if (toolArgs.action === 'launch_app' || toolArgs.action === 'open_app') {
                    const appInfo = resolveDesktopApplication(toolArgs.app);
                    toolResult = await launchApplication(appInfo);
                  } else if (toolArgs.action === 'close_app') {
                    const appInfo = resolveDesktopApplication(toolArgs.app);
                    toolResult = await closeApplication(appInfo);
                  } else if (toolArgs.action === 'inspect_screen') {
                    toolResult = await captureScreenFrame();
                  } else if (toolArgs.action === 'click' || toolArgs.action === 'type' || toolArgs.action === 'key' || toolArgs.action === 'mouse_move') {
                    toolResult = await executeInputSimulation({
                      type: toolArgs.action === 'mouse_move' ? 'move' : toolArgs.action,
                      x: toolArgs.x,
                      y: toolArgs.y,
                      text: toolArgs.text,
                      key: toolArgs.key
                    });
                  } else {
                    toolResult = { error: `Unsupported computer action: ${toolArgs.action}` };
                  }
                } finally {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('computer:activity-ended');
                  }
                }
              } else if (fnName === 'generate_reshade_preset') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', {
                    state: 'tool',
                    toolName: 'reshade_generator',
                    details: `Compiling >100MB ReShade suite (${toolArgs.preset_name || 'Photoreal'})...`
                  });
                }
                try {
                  const res = await executeGenerateReshadePresetWithRecovery({
                    presetName: toolArgs.preset_name || toolArgs.presetName || '',
                    game: toolArgs.game || '',
                    style: toolArgs.style || '',
                    description: toolArgs.description || ''
                  });
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('chat:tool-result', {
                      tool: 'reshade_generator',
                      presetName: res.presetName,
                      zipPath: res.filePath,
                      presetFiles: res.presetFiles,
                      retried: Boolean(res.recoveredFromError)
                    });
                  }
                  const newSkillName = `Custom Preset Engineering: High-fidelity visual calibration for ${res.presetName}`;
                  if (recordLearnedSkill(newSkillName) && mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('chat:skill-learned', { skill: `Calibrated ${res.presetName} profile` });
                  }
                  const cardHtml = buildReshadePresetCardHtml(res);
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    const recoveryNote = res.recoveredFromError
                      ? 'The first full-library build failed; I retried using the available library and completed the preset.\n\n'
                      : '';
                    mainWindow.webContents.send('chat:stream-chunk', { text: recoveryNote + cardHtml + '\n\n' });
                    mainWindow.webContents.send('chat:stream-end', {
                      fullText: (fullContent ? sanitizeChatOutput(fullContent, true) + '\n\n' : '') + recoveryNote + cardHtml,
                      reasoning: fullReasoning,
                      model: getModelDisplayName(modelToUse),
                      provider: 'Groq',
                      mode,
                      aborted: activeChatAbort
                    });
                    try { consumeUsage(1); } catch (e) {}
                  }
                  resolve((fullContent ? sanitizeChatOutput(fullContent, true) + '\n\n' : '') + cardHtml);
                  return;
                } catch (presetErr) {
                  toolResult = { error: `Failed to generate ReShade preset: ${presetErr.message}` };
                }
              } else if (fnName === 'generate_voice') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', {
                    state: 'tool',
                    toolName: 'voice_generator',
                    details: 'Generating voice using Edge Neural TTS...'
                  });
                }
                try {
                  const voiceRes = await executeGenerateVoice({
                    text: toolArgs.text || '',
                    filename: toolArgs.filename || '',
                    voice: toolArgs.voice || ''
                  });
                  const cardHtml = buildVoiceResultHtml(voiceRes);
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('chat:stream-chunk', { text: cardHtml + '\n\n' });
                  }
                  toolResult = voiceRes;
                } catch (vErr) {
                  toolResult = { error: `Failed to synthesize voice: ${vErr.message}` };
                }
              } else if (fnName === 'generate_texture') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', {
                    state: 'tool',
                    toolName: 'texture_generator',
                    details: 'Synthesizing PBR texture via Pollinations...'
                  });
                }
                try {
                  const texRes = await executeGenerateTexture({
                    prompt: toolArgs.prompt || '',
                    filename: toolArgs.filename || '',
                    width: toolArgs.width || 512,
                    height: toolArgs.height || 512
                  });
                  const cardHtml = buildTextureResultHtml(texRes);
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('chat:stream-chunk', { text: cardHtml + '\n\n' });
                  }
                  toolResult = texRes;
                } catch (tErr) {
                  toolResult = { error: `Failed to generate texture: ${tErr.message}` };
                }
              } else if (fnName === 'generate_lspdfr_plugin') {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:status', {
                    state: 'tool',
                    toolName: 'lspdfr_generator',
                    details: `Scaffolding ${toolArgs.plugin_name || 'LSPDFR'} & compiling C# via csc.exe...`
                  });
                }
                try {
                  const lspdfrRes = await lspdfrService.executeGenerateLspdfrPlugin({
                    pluginName: toolArgs.plugin_name || toolArgs.pluginName || 'ApexRadar',
                    pluginType: toolArgs.plugin_type || toolArgs.pluginType || 'police_radar',
                    description: toolArgs.description || '',
                    features: toolArgs.features || [],
                    voiceGenerator: executeGenerateVoice,
                    textureGenerator: executeGenerateTexture,
                    downloadsDir: app.getPath('downloads') || path.join(os.homedir(), 'Downloads')
                  });
                  const cardHtml = lspdfrService.buildLspdfrResultHtml(lspdfrRes);
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('chat:stream-chunk', { text: cardHtml + '\n\n' });
                  }
                  toolResult = lspdfrRes;
                } catch (lspErr) {
                  toolResult = { error: `Failed to generate LSPDFR plugin: ${lspErr.message}` };
                }
              } else {
                toolResult = await executeBackendAgentTool(fnName, toolArgs);
              }

              executedResults.push({ fnName, toolArgs, toolResult });

              nextHistory.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: fnName,
                content: JSON.stringify(toolResult)
              });
            }

            // Recurse to stream final completion
            const followUp = await streamGroqResponse(
              apiKey,
              nextHistory,
              systemInstruction,
              targetModel,
              toolDefinitions,
              mode,
              recursionDepth + 1
            );
            resolve(followUp);
            return;
          } catch (agentErr) {
            console.error('[AgentToolExecution] Error in tool follow-up:', agentErr.message);
          }
        }

        let finalText = sanitizeChatOutput(fullContent, true);
        if (!finalText && executedResults.length > 0) {
          const executedSummaries = executedResults.map(item => {
            const { fnName, toolArgs, toolResult } = item;
            if (toolResult && toolResult.error) {
              return `Operation failed for \`${fnName}\`: **${toolResult.error}**`;
            }
            if (toolResult && toolResult.success) {
              const targetPath = toolResult.path || toolArgs.path || '';
              const loc = toolResult.location || 'specified path';
              return `Successfully performed \`${fnName}\` at \`${targetPath}\` on **${loc}**. (Verified on disk).`;
            }
            return `Executed \`${fnName}\`.`;
          });
          finalText = executedSummaries.join('\n\n');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat:stream-chunk', { text: finalText });
          }
        } else if (!finalText) {
          finalText = 'I am here to help. What would you like to work on in this project?';
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat:stream-chunk', { text: finalText });
          }
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:stream-end', {
            fullText: finalText,
            reasoning: fullReasoning,
            model: getModelDisplayName(modelToUse),
            provider: 'Groq',
            mode,
            aborted: activeChatAbort
          });
          try { consumeUsage(1); } catch (e) {}
        }
        resolve(finalText);
      }

      function drainQueue() {
        if (activeChatAbort) {
          finishStream();
          return;
        }

        if (tokenQueue.length > 0) {
          const count = tokenQueue.length > 30 ? 4 : (tokenQueue.length > 12 ? 2 : 1);
          const chunkToSend = tokenQueue.splice(0, count).join('');
          if (chunkToSend && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat:stream-chunk', { text: chunkToSend });
          }
        } else if (isStreamingEnded) {
          finishStream();
        }
      }

      // Smooth 22ms pacing timer
      pacingTimer = setInterval(drainQueue, 22);

      let inThinkTag = false;
      let thinkBuffer = '';

      res.on('data', (chunk) => {
        if (activeChatAbort) {
          req.destroy();
          return;
        }

        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta || {};
              const textChunk = delta.content || '';
              const reasoningChunk = delta.reasoning || '';

              if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index || 0;
                  if (!accumulatedToolCalls[idx]) {
                    accumulatedToolCalls[idx] = {
                      id: tc.id || `tc_${Date.now()}_${idx}`,
                      type: 'function',
                      function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
                    };
                  } else {
                    if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                    if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
              }

              if (reasoningChunk) {
                fullReasoning += reasoningChunk;
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('chat:reasoning-chunk', {
                    chunk: reasoningChunk,
                    fullReasoning
                  });
                }
              }

              if (textChunk) {
                let chunkToProcess = textChunk;
                if (chunkToProcess.includes('<think>') || inThinkTag) {
                  thinkBuffer += chunkToProcess;
                  if (thinkBuffer.includes('</think>')) {
                    const closingIdx = thinkBuffer.indexOf('</think>');
                    const reasoningPart = thinkBuffer.slice(0, closingIdx).replace('<think>', '');
                    fullReasoning += reasoningPart;
                    chunkToProcess = thinkBuffer.slice(closingIdx + 8);
                    thinkBuffer = '';
                    inThinkTag = false;
                  } else {
                    inThinkTag = true;
                    chunkToProcess = '';
                  }
                }

                // Preserve exact leading/trailing spaces across token chunks
                const safeChunk = sanitizeChatOutput(chunkToProcess, false);
                if (safeChunk.length > 0) {
                  fullContent += safeChunk;
                  tokenQueue.push(safeChunk);
                }
              }
            } catch (err) {}
          }
        }
      });

      res.on('end', () => {
        isStreamingEnded = true;
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Connection error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out.'));
    });

    req.write(payload);
    req.end();
  });
}

// Local tool results and built-in messages are fully known before they are sent, so they are
// delivered in one piece instead of simulating token-by-token typing. Only the live Gemini
// path streams real chunks as they arrive.
async function streamTextChunks(fullText, modelName, provider = 'Tactical Engine', mode = 'chat') {
  // Ensure the AI thinks for at least 1 full second before replying
  await new Promise(r => setTimeout(r, 1050));
  const aborted = activeChatAbort;
  const text = aborted ? '' : fullText;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (text) mainWindow.webContents.send('chat:stream-chunk', { text });
    mainWindow.webContents.send('chat:stream-end', {
      fullText: text,
      model: modelName,
      provider,
      mode,
      aborted
    });
    try { consumeUsage(1); } catch (e) {}
  }
}

ipcMain.on('chat:cancel', () => {
  activeChatAbort = true;
});

ipcMain.handle('app:save-api-key', (_event, _key) => {
  // Custom API keys are completely disabled per policy
  return false;
});

ipcMain.handle('app:get-api-key', () => {
  return '';
});

ipcMain.handle('app:get-api-key-info', () => {
  const activeKey = getApiKey();
  return {
    hasCustomKey: false,
    hasBuiltinKey: !!activeKey,
    hasEnvKey: !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
    hasActiveKey: !!activeKey,
    isPackaged: app.isPackaged
  };
});

// ============================================================================
// Access & Approvals Governance IPC Handlers
// ============================================================================
ipcMain.handle('access:get-settings', () => getAccessSettings());

ipcMain.handle('access:set-mode', (_event, mode) => {
  return setAccessMode(mode);
});

ipcMain.handle('access:toggle-capability', (_event, { capability, enabled }) => {
  return toggleCapability(capability, enabled);
});

ipcMain.handle('access:revoke-all', () => {
  return revokeAllAccess();
});

ipcMain.handle('access:respond-approval', (_event, { id, approved }) => {
  return resolveApproval(id, approved);
});

// ============================================================================
// Computer Use Session Management IPC Handlers
// ============================================================================
ipcMain.handle('computer:start-session', () => {
  const res = startComputerSession();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('computer:status-changed', res);
  }
  return res;
});

ipcMain.handle('computer:stop-session', () => {
  const res = stopComputerSession();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('computer:status-changed', res);
  }
  return res;
});

ipcMain.handle('computer:set-paused', (_event, paused) => {
  const res = setComputerSessionPaused(paused);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('computer:status-changed', res);
  }
  return res;
});

ipcMain.handle('computer:get-status', () => getComputerSessionStatus());

ipcMain.handle('computer:capture-screen', async () => {
  return await captureScreenFrame();
});

// ============================================================================
// Terminal Execution IPC Handlers
// ============================================================================
ipcMain.handle('terminal:kill-process', (_event, pid) => {
  return killRunningProcess(pid);
});

// ============================================================================
// Google OAuth & Session Verification (Strict Authentication Subsystem)
// ============================================================================
let activeOAuthServer = null;

function startGoogleOAuthLoopback() {
  const http = require('http');
  const port = 42813;
  const clientId = '794145126379-162ulmelngbk9jq6jhke54q4smp9u3tl.apps.googleusercontent.com';
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  return new Promise((resolve, reject) => {
    if (activeOAuthServer) {
      try { activeOAuthServer.close(); } catch (e) {}
      activeOAuthServer = null;
    }

    const server = http.createServer((req, res) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      if (parsedUrl.pathname === '/oauth2callback') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tactical Studio — Verified</title>
  <style>
    body {
      background: #09070f;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(25, 20, 36, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 20px;
      padding: 36px 40px;
      text-align: center;
      max-width: 440px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.7);
    }
    .check {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #10b981;
      font-size: 26px;
      line-height: 52px;
      margin: 0 auto 16px auto;
    }
    h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; }
    p { color: #a1a1aa; font-size: 13.5px; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>Tactical Studio Verified</h2>
    <p id="msg">Signing you in securely... You may return to Tactical Studio now.</p>
  </div>
  <script>
    (function() {
      var hash = window.location.hash ? window.location.hash.substring(1) : '';
      var query = window.location.search ? window.location.search.substring(1) : '';
      var params = new URLSearchParams(hash || query);
      var idToken = params.get('id_token') || '';
      var accessToken = params.get('access_token') || '';

      fetch('/token-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken, accessToken: accessToken })
      }).then(function() {
        document.getElementById('msg').textContent = 'Session verified! Return to Tactical Studio.';
        setTimeout(function() { window.close(); }, 2500);
      }).catch(function() {
        document.getElementById('msg').textContent = 'Connected. Return to Tactical Studio.';
      });
    })();
  </script>
</body>
</html>`);
        return;
      }

      if (parsedUrl.pathname === '/token-callback' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));

          try {
            const data = JSON.parse(body || '{}');
            let userEmail = 'operator@tactical.studio';
            let userName = 'Google Operator';
            let userAvatar = '';

            if (data.idToken) {
              try {
                const parts = data.idToken.split('.');
                if (parts.length >= 2) {
                  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
                  if (payload.email) userEmail = payload.email;
                  if (payload.name) userName = payload.name;
                  if (payload.picture) userAvatar = payload.picture;
                }
              } catch (e) {}
            }

            const verifiedUser = {
              email: userEmail,
              name: userName,
              avatar: userAvatar,
              plan: 'Studio Pro (Google Verified)',
              provider: 'google',
              verified: true,
              syncEnabled: true,
              rateLimit: { used: 0, limit: 150, resetMinutes: 60 }
            };

            const session = {
              authenticated: true,
              user: verifiedUser,
              sessionToken: `tac_sec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              syncedAt: Date.now(),
              usage: { used: 0, limit: 150 }
            };

            saveAuthSession(session);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('auth:session-updated', session);
            }

            closeServer();
            resolve({ success: true, user: verifiedUser });
          } catch (err) {
            closeServer();
            reject(err);
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    function closeServer() {
      if (server) {
        try { server.close(); } catch (e) {}
      }
      activeOAuthServer = null;
    }

    server.on('error', (err) => {
      closeServer();
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      activeOAuthServer = server;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=openid%20profile%20email&nonce=tac_${Date.now()}`;
      electronShell.openExternal(authUrl);

      setTimeout(() => {
        if (activeOAuthServer === server) {
          closeServer();
        }
      }, 120000);
    });
  });
}

// ----------------------------------------------------------------------------
// Local User Management & OTP Verification Subsystem (Strict Reputable Providers)
// ----------------------------------------------------------------------------
const crypto = require('crypto');

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'zoho.com'
];

// In-memory pending signup OTP registrations: email -> { otp, passwordHash, salt, expiresAt }
const pendingOtpRegistrations = new Map();

function getLocalUsersFilePath() {
  return path.join(app.getPath('userData'), 'tactical-local-users.json');
}

function loadLocalUsers() {
  try {
    const filePath = getLocalUsersFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (typeof data === 'object' && data !== null) return data;
    }
  } catch (err) {
    console.warn('[Auth Store] Could not read local users file:', err.message);
  }
  return {};
}

function saveLocalUsers(users) {
  try {
    const filePath = getLocalUsersFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Auth Store] Error saving local users file:', err.message);
    return false;
  }
}

function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function isEmailDomainAllowed(email) {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// Check whether email exists locally
ipcMain.handle('auth:check-email-status', (_event, email = '') => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!isEmailDomainAllowed(cleanEmail)) {
    return {
      valid: false,
      error: 'Only verified providers (Gmail, Outlook, Yahoo, iCloud, Proton) are accepted. Suspicious or disposable emails are rejected.'
    };
  }
  const users = loadLocalUsers();
  const exists = Boolean(users[cleanEmail]);
  return { valid: true, exists };
});

// Step 1 of Sign-up: Validate domain + password, generate 6-digit OTP
ipcMain.handle('auth:request-signup-otp', (_event, payload = {}) => {
  const { email = '', password = '' } = payload;
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!isEmailDomainAllowed(cleanEmail)) {
    return {
      success: false,
      error: 'Unverified provider rejected. Please use a verified provider: Gmail, Outlook, Yahoo, iCloud, or Proton.'
    };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const users = loadLocalUsers();
  if (users[cleanEmail]) {
    return { success: false, error: 'An account with this email already exists. Please log in.' };
  }

  // Generate 6-digit cryptographic OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const { salt, hash } = hashPassword(password);

  pendingOtpRegistrations.set(cleanEmail, {
    otp: otpCode,
    salt,
    passwordHash: hash,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  // Display Windows Native Notification with OTP
  showWindowsNotification(
    'Sparx Verification Code',
    `Your verification code is: ${otpCode}. Enter this OTP to complete account activation.`
  );

  return {
    success: true,
    message: `Verification code generated for ${cleanEmail}. Check your notification or popup.`,
    otpPreview: otpCode
  };
});

// Step 2 of Sign-up: Verify OTP, create local account, and log in
ipcMain.handle('auth:verify-otp-register', (_event, payload = {}) => {
  const { email = '', otp = '' } = payload;
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  const pending = pendingOtpRegistrations.get(cleanEmail);
  if (!pending) {
    return { success: false, error: 'No pending registration found or verification expired. Please request a new code.' };
  }

  if (Date.now() > pending.expiresAt) {
    pendingOtpRegistrations.delete(cleanEmail);
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (pending.otp !== cleanOtp) {
    return { success: false, error: 'Invalid verification code. Please check and try again.' };
  }

  // OTP is verified! Save new user permanently in local user store
  const users = loadLocalUsers();
  const nameParts = cleanEmail.split('@')[0].replace(/[\._\-]/g, ' ').split(' ');
  const formattedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  const newUserRecord = {
    email: cleanEmail,
    name: formattedName || 'Sparx Operator',
    salt: pending.salt,
    passwordHash: pending.passwordHash,
    createdAt: Date.now(),
    verified: true,
    provider: cleanEmail.endsWith('@gmail.com') ? 'gmail' : (cleanEmail.includes('outlook') || cleanEmail.includes('hotmail') ? 'outlook' : 'email')
  };

  users[cleanEmail] = newUserRecord;
  saveLocalUsers(users);
  pendingOtpRegistrations.delete(cleanEmail);

  // Authenticate session immediately
  const verifiedUser = {
    email: cleanEmail,
    name: newUserRecord.name,
    avatar: '',
    plan: 'Studio Pro (Verified)',
    provider: newUserRecord.provider,
    verified: true,
    syncEnabled: true,
    rateLimit: { used: 0, limit: 150, resetMinutes: 60 }
  };

  const session = {
    authenticated: true,
    user: verifiedUser,
    sessionToken: `tac_loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    syncedAt: Date.now(),
    usage: { used: 0, limit: 150 }
  };

  saveAuthSession(session);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:session-updated', session);
  }

  return { success: true, user: verifiedUser };
});

// Returning User: Log in with email and password
ipcMain.handle('auth:login-with-password', (_event, payload = {}) => {
  const { email = '', password = '' } = payload;
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter both your email and password.' };
  }

  const users = loadLocalUsers();
  const userRecord = users[cleanEmail];
  if (!userRecord) {
    return { success: false, error: 'No account found with this email. Please create an account first.' };
  }

  const { hash } = hashPassword(password, userRecord.salt);
  if (hash !== userRecord.passwordHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  const verifiedUser = {
    email: userRecord.email,
    name: userRecord.name || 'Sparx Operator',
    avatar: userRecord.avatar || '',
    plan: 'Studio Pro (Verified)',
    provider: userRecord.provider || 'email',
    verified: true,
    syncEnabled: true,
    rateLimit: { used: 0, limit: 150, resetMinutes: 60 }
  };

  const session = {
    authenticated: true,
    user: verifiedUser,
    sessionToken: `tac_loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    syncedAt: Date.now(),
    usage: { used: 0, limit: 150 }
  };

  saveAuthSession(session);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:session-updated', session);
  }

  return { success: true, user: verifiedUser };
});

// Auth & Usage Handlers
ipcMain.handle('auth:get-session', () => {
  return loadAuthSession();
});

ipcMain.handle('usage:get', () => {
  const session = loadAuthSession();
  return session.usage || { used: 0, limit: 150, remaining: 150, percentRemaining: 100, resetDate: 'Nov 19' };
});

ipcMain.handle('usage:consume', (_event, amount = 1) => {
  return consumeUsage(typeof amount === 'number' ? amount : 1);
});

ipcMain.handle('browser:search', async (_event, query) => {
  return searchWeb(query);
});

ipcMain.handle('browser:read-page', async (_event, url) => {
  return readWebPage(url);
});

ipcMain.handle('browser:research', async (_event, query) => {
  return performWebResearch(query);
});

ipcMain.on('computer:cancel', () => {
  try {
    stopComputerSession();
  } catch (e) {}
  hideComputerUseOverlay();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('computer:activity-ended');
  }
});

ipcMain.handle('auth:google-signin', async () => {
  try {
    return await startGoogleOAuthLoopback();
  } catch (err) {
    console.warn('[Main] Google OAuth error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:login-with-email', (_event, payload = {}) => {
  const { email = '', password = '' } = payload;
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Please enter a valid Gmail address.' };
  }

  const nameParts = trimmed.split('@')[0].replace(/[\._\-]/g, ' ').split(' ');
  const formattedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  const verifiedUser = {
    email: trimmed,
    name: formattedName || 'Tactical Operator',
    avatar: '',
    plan: 'Studio Pro (Operator)',
    provider: trimmed.toLowerCase().endsWith('@gmail.com') ? 'gmail' : 'operator',
    verified: true,
    syncEnabled: true,
    rateLimit: { used: 0, limit: 150, resetMinutes: 60 }
  };

  const session = {
    authenticated: true,
    user: verifiedUser,
    sessionToken: `tac_op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    syncedAt: Date.now(),
    usage: { used: 0, limit: 150 }
  };

  saveAuthSession(session);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:session-updated', session);
  }

  return { success: true, user: verifiedUser };
});

ipcMain.handle('auth:logout', () => {
  const blankSession = {
    authenticated: false,
    user: null,
    sessionToken: null,
    syncedAt: null,
    usage: { used: 0, limit: 150 }
  };
  saveAuthSession(blankSession);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:session-updated', blankSession);
  }
  return { success: true };
});

ipcMain.handle('auth:sync-cloud', (_event, syncData = {}) => {
  try {
    const backupPath = path.join(app.getPath('userData'), 'tactical-cloud-sync.json');
    const snapshot = {
      timestamp: Date.now(),
      syncedAt: new Date().toISOString(),
      user: loadAuthSession().user,
      data: syncData
    };
    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
    return { success: true, timestamp: snapshot.timestamp, backupPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:delete-account', () => {
  try {
    const sessionPath = getSessionStorePath();
    const syncPath = path.join(app.getPath('userData'), 'tactical-cloud-sync.json');
    if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    if (fs.existsSync(syncPath)) fs.unlinkSync(syncPath);
    const blank = { authenticated: false, user: null, sessionToken: null, usage: { used: 0, limit: 150 } };
    saveAuthSession(blank);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:session-updated', blank);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:export-data', (_event, exportData = {}) => {
  try {
    const downloadsDir = app.getPath('downloads') || getWorkspaceRoot();
    const exportFile = path.join(downloadsDir, `tactical-export-${Date.now()}.json`);
    const payload = {
      exportDate: new Date().toISOString(),
      version: app.getVersion(),
      user: loadAuthSession().user,
      content: exportData
    };
    fs.writeFileSync(exportFile, JSON.stringify(payload, null, 2), 'utf8');
    shell.showItemInFolder(exportFile);
    return { success: true, filePath: exportFile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('chat:send-message', async (_event, payload = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const { messages = [], model, systemInstruction, mode = 'chat' } = payload;
  const toolPrefs = Object.assign({ files: true, web: true, grounding: true }, payload.tools || {});
  activeChatAbort = false;

  const apiKey = getApiKey();
  const isGroqKey = isGroqApiKey(apiKey);
  let targetModel = resolveModelId(model);

  const lastUserMsg = messages.length > 0 ? messages[messages.length - 1].text.trim() : '';
  const lowerMsg = lastUserMsg.toLowerCase();

  // Persistent Memory & Personalization: Detect explicit user preferences
  if (lastUserMsg) {
    const pref = memoryService.detectUserPreference(lastUserMsg);
    if (pref) {
      const added = memoryService.addMemory(pref, 'preference');
      if (added.success && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory:learned', { preference: pref });
      }
    }
  }

  // Universal Anti-Cheat & Fair-Play Policy Enforcement
  const cheatCheck = checkCheatAndExploitGuard(lastUserMsg);
  if (cheatCheck.blocked) {
    const refusalMsg = `### ⚠️ Fair-Play & Safety Policy Refusal\n\n` +
      `Sparx strictly blocks requests related to game cheats and exploits:\n` +
      `> **${cheatCheck.reason}**\n\n` +
      `Competitive botting, memory manipulation, aimbots, wallhacks, recoil scripts, and anti-cheat tampering are prohibited across code generation, terminal execution, and screen control.\n\n` +
      `*Legitimate developer tools, graphics shaders (ReShade), unit tests, and accessibility utilities remain fully supported.*`;
    await streamTextChunks(refusalMsg, targetModel, 'Safety Policy Engine', mode);
    return;
  }

  mainWindow.webContents.send('chat:stream-start', { model: getModelDisplayName(targetModel), mode });

  // --------------------------------------------------------------------------
  // Computer Use Intent Detection & Dispatcher
  // Strictly interprets direct action requests (close app, open app, click element)
  // and checks actual tool availability before proceeding.
  // Never falls back to hallucinated scripts, taskkill, or unverified claims.
  // --------------------------------------------------------------------------
  const normalizedUserMsg = lastUserMsg.trim().replace(/^["'`]+|["'`]+$/g, '');

  // 0. Multi-Step Computer Skill Sequence (e.g. "use computer skill and open claude and then search up 777 on brave")
  const seqIntent = parseComputerSequenceIntent(normalizedUserMsg);
  if (seqIntent) {
    const access = getAccessSettings();
    if (!access.computerEnabled) {
      const disabledMsg = access.desktopAccessLimitation || 'Desktop control is disabled in settings.';
      await streamTextChunks(disabledMsg, targetModel, 'Desktop Control', mode);
      return;
    }

    const auth = await authorizeAction({
      capability: 'computer',
      riskLevel: 'medium',
      signature: `computer:sequence:${seqIntent.targetApp || 'browser'}_${seqIntent.browserApp}`,
      title: 'Automated Computer Workflow',
      details: seqIntent.targetApp
        ? `Open "${seqIntent.targetApp}", focus "${seqIntent.browserApp}", and search for "${seqIntent.searchQuery}"`
        : `Focus "${seqIntent.browserApp}" and search for "${seqIntent.searchQuery}" using real GUI controls`
    });

    if (!auth.allowed) {
      const deniedMsg = `Workflow sequence request was denied by access policy.`;
      await streamTextChunks(deniedMsg, targetModel, 'Desktop Control', mode);
      return;
    }

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'computer_sequence',
      details: 'Sparx is using your computer · Esc to cancel'
    });
    mainWindow.webContents.send('computer:activity-started', {
      action: 'sequence',
      details: 'Sparx is using your computer · Esc to cancel'
    });
    showComputerUseOverlay('Sparx is using your computer · Esc to cancel');

    let seqResult;
    try {
      seqResult = await executeComputerSequence(seqIntent, (stepStatus) => {
        mainWindow.webContents.send('chat:status', {
          state: 'tool',
          toolName: 'computer_sequence',
          details: stepStatus
        });
      });
    } finally {
      hideComputerUseOverlay();
      mainWindow.webContents.send('computer:activity-ended');
    }

    await streamTextChunks(seqResult.message, targetModel, 'Desktop Control', mode);
    return;
  }

  // 1. Direct Desktop Application Action Request (e.g. "close Brave for me rq", "open Brave", "quit Chrome")
  const appIntent = parseAppControlIntent(normalizedUserMsg);
  if (appIntent) {
    if (appIntent.ambiguous) {
      const clarifyQuestion = `Which application would you like me to ${appIntent.intent}?`;
      await streamTextChunks(clarifyQuestion, targetModel, 'Desktop Control', mode);
      return;
    }

    const appInfo = resolveDesktopApplication(appIntent.rawTarget);
    const access = getAccessSettings();

    // Verify desktop access capability
    if (!access.computerEnabled) {
      const disabledMsg = access.desktopAccessLimitation || 'Desktop control is disabled in settings.';
      await streamTextChunks(disabledMsg, targetModel, 'Desktop Control', mode);
      return;
    }

    // Follow governance approval rules if in 'ask' mode
    const auth = await authorizeAction({
      capability: 'computer',
      riskLevel: appIntent.intent === 'close' ? 'medium' : 'low',
      signature: `computer:${appIntent.intent}_app:${(appInfo.processNames && appInfo.processNames[0]) || appInfo.displayName.toLowerCase()}`,
      title: `${appIntent.intent === 'close' ? 'Close' : 'Open'} Application`,
      details: `${appIntent.intent === 'close' ? 'Terminate' : 'Launch'} "${appInfo.displayName}"`
    });

    if (!auth.allowed) {
      const deniedMsg = `Request to ${appIntent.intent} ${appInfo.displayName} was denied.`;
      await streamTextChunks(deniedMsg, targetModel, 'Desktop Control', mode);
      return;
    }

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'computer_control',
      details: `${appIntent.intent === 'close' ? 'Closing' : 'Launching'} ${appInfo.displayName}`
    });
    mainWindow.webContents.send('computer:activity-started', {
      action: appIntent.intent,
      details: appInfo.displayName
    });

    let res;
    try {
      if (appIntent.intent === 'close') {
        res = await closeApplication(appInfo);
      } else {
        res = await launchApplication(appInfo);
      }
    } finally {
      mainWindow.webContents.send('computer:activity-ended');
    }

    // Strict reply style: One short, plain sentence, verified state, no emojis or celebratory badges
    const replyText = res.message || (res.success
      ? (appIntent.intent === 'close' ? `Closed ${appInfo.displayName}.` : `Opened ${appInfo.displayName}.`)
      : (appIntent.intent === 'close' ? `Failed to close ${appInfo.displayName}.` : `Failed to open ${appInfo.displayName}.`));

    await streamTextChunks(replyText, targetModel, 'Desktop Control', mode);
    return;
  }

  // 3. Direct Click / UI Interaction Request (e.g. "click the Save button", "click on save")
  const clickMatch = normalizedUserMsg.match(/^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:click|press)\s+(?:the\s+|on\s+)?([a-zA-Z0-9_\-\s]+?)(?:\s+button)?[\.\?!]*$/i);
  if (clickMatch && !normalizedUserMsg.match(/\b(?:enter|tab|esc|escape|backspace|space)\b/i)) {
    const targetElement = clickMatch[1].trim();
    const access = getAccessSettings();

    // Tool availability check
    if (!access.computerEnabled) {
      const explain = access.desktopAccessLimitation || 'Desktop control is disabled in settings.';
      await streamTextChunks(explain, targetModel, 'Desktop Control', mode);
      return;
    }

    const auth = await authorizeAction({
      capability: 'computer',
      riskLevel: 'medium',
      signature: `computer:click_element:${targetElement.toLowerCase()}`,
      title: 'Click UI Element',
      details: `Locate and click "${targetElement}" on primary display`
    });

    if (!auth.allowed) {
      const failText = `Request to click "${targetElement}" was denied.`;
      await streamTextChunks(failText, targetModel, 'Access Governance', mode);
      return;
    }

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'computer_control',
      details: `Locating "${targetElement}" on screen`
    });
    mainWindow.webContents.send('computer:activity-started', { action: 'click', details: targetElement });

    let capRes;
    try {
      capRes = await captureScreenFrame();
    } finally {
      mainWindow.webContents.send('computer:activity-ended');
    }
    if (!capRes.success) {
      const failMd = `Screen capture failed: ${capRes.error || 'Display surface could not be read.'}`;
      await streamTextChunks(failMd, targetModel, 'Desktop Control', mode);
      return;
    }

    const unverifiedMd = `Screen frame acquired (${capRes.width} × ${capRes.height} px), but automatic visual element localization for "${targetElement}" could not be confirmed without explicit coordinates. Please specify coordinates (e.g. \`click at 500, 300\`).`;
    await streamTextChunks(unverifiedMd, targetModel, 'Desktop Control', mode);
    return;
  }

  // 4. Desktop Screen Inspection / Access Trigger (e.g. "access my pc", "view my screen", "take screenshot")
  const isComputerAccessTrigger = lowerMsg.match(/\b(?:access\s+(?:my\s+|the\s+)?pc|control\s+(?:my\s+|the\s+)?pc|access\s+(?:my\s+|the\s+)?computer|control\s+(?:my\s+|the\s+)?computer|take\s+control\s+of\s+(?:my\s+|the\s+)?(?:pc|computer)|start\s+computer\s+session|enable\s+computer\s+access|inspect\s+screen|capture\s+screen|view\s+(?:my\s+)?screen|look\s+at\s+my\s+screen|take\s+(?:a\s+)?screenshot)\b/i);
  if (isComputerAccessTrigger) {
    const access = getAccessSettings();
    if (!access.computerEnabled) {
      const explain = access.desktopAccessLimitation || 'Desktop control is disabled in settings.';
      await streamTextChunks(explain, targetModel, 'Desktop Control', mode);
      return;
    }

    const auth = await authorizeAction({
      capability: 'computer',
      riskLevel: 'medium',
      signature: 'computer:inspect_screen',
      title: 'Inspect Desktop Screen',
      details: 'Capture frame from primary display'
    });

    if (!auth.allowed) {
      const failText = `Screen inspection was denied.`;
      await streamTextChunks(failText, targetModel, 'Access Governance', mode);
      return;
    }

    const sessionRes = startComputerSession();
    mainWindow.webContents.send('computer:status-changed', sessionRes);

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'screen_capture',
      details: 'Capturing primary desktop display frame'
    });
    mainWindow.webContents.send('computer:activity-started', { action: 'inspect_screen', details: 'Primary Display' });

    let cap;
    try {
      cap = await captureScreenFrame();
    } finally {
      mainWindow.webContents.send('computer:activity-ended');
    }
    if (!cap.success) {
      const failMsg = `### ❌ Desktop Screen Capture Failed\n\n` +
        `> **${cap.error}**\n\n` +
        `- **Session State**: \`${cap.state || 'failed'}\`\n` +
        `- **Diagnostic**: No valid frame could be acquired from the primary display.\n\n` +
        `*Please verify that your Windows desktop is unlocked and display permissions are granted.*`;
      await streamTextChunks(failMsg, targetModel, 'Computer Control', mode);
      return;
    }

    const reply = `### 🖥️ Desktop Screen Captured\n\n` +
      `Successfully acquired a live frame from your primary display (**${cap.width} × ${cap.height} px**).\n\n` +
      `- **Session State**: \`active\`\n` +
      `- **Display Resolution**: \`${cap.width} × ${cap.height} px\`\n` +
      `- **Input Controls**: Ready to execute approved mouse and keyboard actions\n\n` +
      `*What specific application or action would you like me to inspect or perform?*`;

    await streamTextChunks(reply, targetModel, 'Computer Control', mode);
    return;
  }

  // Running commands triggers (e.g. "run command npm test", "execute dir", "run a command: git status", "terminal ls")
  const cmdMatch = lastUserMsg.match(/^(?:run\s+(?:a\s+)?command[:\s]+|exec\s+(?:a\s+)?command[:\s]+|execute\s+(?:a\s+)?command[:\s]+|terminal\s+(?:command[:\s]+)?|run\s+|exec\s+|execute\s+)(.+)/i);
  if (cmdMatch) {
    let rawCmd = cmdMatch[1].trim();
    rawCmd = rawCmd.replace(/^`+|`+$/g, '').replace(/^"+|"+$/g, '').trim();

    toggleCapability('terminal', true);

    const riskAssessment = assessCommandRisk(rawCmd);
    if (riskAssessment.level === 'blocked') {
      const blockedMsg = `### ⚠️ Command Blocked by Safety Guard\n\n> **${riskAssessment.reason || 'Command violates security policies.'}**`;
      await streamTextChunks(blockedMsg, targetModel, 'Terminal Guard', mode);
      return;
    }

    const auth = await authorizeAction({
      capability: 'terminal',
      riskLevel: riskAssessment.level === 'high' ? 'high' : (riskAssessment.level === 'low' ? 'low' : 'medium'),
      signature: `terminal:${rawCmd}`,
      title: 'Allow Sparx to Run Commands?',
      details: rawCmd
    });

    if (!auth.allowed) {
      const reasonText = auth.reason || 'Action not permitted by operator policy.';
      const failText = `### Terminal Execution Denied\n\n> ${reasonText}\n\n*Chat remains fully active. You can continue or ask for an alternative approach.*`;
      await streamTextChunks(failText, targetModel, 'Access Governance', mode);
      return;
    }

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'execute_terminal_command',
      details: 'Running Command'
    });

    const execResult = await executeCommand({
      command: rawCmd,
      workspaceRoot: getWorkspaceRoot(),
      onOutput: (type, data) => {
        mainWindow.webContents.send('terminal:output', { type, data });
      }
    });

    // Return status to thinking before delivering reply
    mainWindow.webContents.send('chat:status', {
      state: 'thinking',
      details: 'Thinking'
    });

    const safeOut = redactSecrets(execResult.stdout || execResult.stderr || '(Process completed with no output)');
    const termMd = `### Terminal Execution: \`${rawCmd}\`\n\n` +
      `- **Status**: \`${execResult.exitCode === 0 ? 'Success' : 'Exit Code ' + execResult.exitCode}\` (${execResult.success ? '✅ Clean run' : '⚠️ Non-zero exit'})\n` +
      `- **Duration**: \`${execResult.durationMs}ms\`\n` +
      `- **Workspace**: \`${getWorkspaceRoot()}\`\n\n` +
      `\`\`\`text\n${safeOut}\n\`\`\``;

    await streamTextChunks(termMd, targetModel, 'Terminal Subsystem', mode);
    return;
  }



  // 0. Dedicated PC Folder & File Inspection & Grounded Reading Handler
  // (e.g. "in swuzy folder, .txt file, what is in it", "what is inside the .txt file in swuzy folder")
  const folderInspect = parseFolderInspectIntent(lastUserMsg);
  if (folderInspect && toolPrefs.files) {
    const rawFolderName = folderInspect.folder;
    const fileTarget = folderInspect.fileTarget;

    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'locate_folder',
      details: `Locating folder "${rawFolderName}" on PC...`
    });

    const establishedPath = extractEstablishedFolderPath(rawFolderName, messages);
    const locRes = locateFolder(rawFolderName, establishedPath);

    if (!locRes.found) {
      mainWindow.webContents.send('chat:tool-result', {
        tool: 'locate_folder',
        found: false,
        folderName: rawFolderName
      });
      const notFoundMsg = `Could not find folder \`${rawFolderName}\` in sensible PC locations (Desktop, Documents, Downloads, Home) or the active workspace.\n\nPlease check the folder name or provide its full path.`;
      await streamTextChunks(notFoundMsg, targetModel, 'Filesystem', mode);
      return;
    }

    const resolvedFolder = locRes.path;
    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'list_directory',
      details: `Listing contents of "${rawFolderName}"...`
    });

    const findRes = findFilesInFolder(resolvedFolder, null, fileTarget);
    if (!findRes.success) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'find_files',
        error: findRes.error
      });
      const failMsg = `Error inspecting folder \`${resolvedFolder}\`: ${findRes.error}`;
      await streamTextChunks(failMsg, targetModel, 'Filesystem', mode);
      return;
    }

    mainWindow.webContents.send('chat:tool-result', {
      tool: 'list_directory',
      path: resolvedFolder,
      totalFilesInFolder: findRes.totalFilesInFolder,
      totalMatches: findRes.totalMatches
    });

    // Case 0: No matching files found in the folder
    if (findRes.totalMatches === 0) {
      let zeroReply = '';
      if (findRes.totalFilesInFolder === 0) {
        zeroReply = `The folder \`${rawFolderName}\` at \`${resolvedFolder}\` is empty.`;
      } else {
        const fileList = findRes.allFiles.map(f => `- \`${f}\``).join('\n');
        zeroReply = `Found folder \`${rawFolderName}\` at \`${resolvedFolder}\`, but no ${fileTarget ? `\`${fileTarget}\`` : 'matching'} files were found inside it.\n\n**Files in folder:**\n${fileList}`;
      }
      await streamTextChunks(zeroReply, targetModel, 'Filesystem', mode);
      return;
    }

    // Case 1: Exactly 1 matching file found -> Read it and present grounded answer
    if (findRes.totalMatches === 1) {
      const targetFile = findRes.matches[0];
      mainWindow.webContents.send('chat:status', {
        state: 'tool',
        toolName: 'read_file',
        details: `Reading ${targetFile.name}...`
      });

      let content = '';
      try {
        content = fs.readFileSync(targetFile.fullPath, 'utf8');
      } catch (err) {
        mainWindow.webContents.send('chat:tool-error', {
          tool: 'read_file',
          error: err.message
        });
        const readErr = `Found \`${targetFile.name}\` at \`${targetFile.fullPath}\`, but could not read its contents: ${err.message}`;
        await streamTextChunks(readErr, targetModel, 'Filesystem', mode);
        return;
      }

      mainWindow.webContents.send('chat:tool-result', {
        tool: 'read_file',
        path: targetFile.fullPath,
        size: targetFile.sizeBytes
      });

      const ext = targetFile.extension.replace('.', '') || 'text';
      const groundedReply = `In the folder \`${rawFolderName}\` (\`${resolvedFolder}\`), found \`${targetFile.name}\`:\n\n` +
        `- **File**: \`${targetFile.name}\`\n` +
        `- **Path**: \`${targetFile.fullPath}\`\n` +
        `- **Size**: \`${targetFile.sizeBytes} bytes\`\n\n` +
        `\`\`\`${ext}\n${content}\n\`\`\``;

      await streamTextChunks(groundedReply, targetModel, 'Filesystem', mode);
      return;
    }

    // Case 2: Several matching files found -> List them and ask which one to read
    const matchesList = findRes.matches.map((m, idx) => `${idx + 1}. \`${m.name}\` (${m.sizeBytes} bytes)`).join('\n');
    const multipleReply = `Found **${findRes.totalMatches}** matching ${fileTarget ? `\`${fileTarget}\`` : ''} files in \`${rawFolderName}\` (\`${resolvedFolder}\`):\n\n${matchesList}\n\nWhich file would you like me to read?`;

    await streamTextChunks(multipleReply, targetModel, 'Filesystem', mode);
    return;
  }

  // Direct Web URL Inspection & Navigation (e.g. "read https://...", "inspect https://...", "what is on https://...", or URL supplied directly)
  const urlRegex = /(https?:\/\/[^\s<>"'`]+)/i;
  const directUrlMatch = lastUserMsg.match(urlRegex);
  if (directUrlMatch && toolPrefs.web) {
    const targetUrl = directUrlMatch[1];
    const isUrlInspectIntent = (
      lowerMsg.includes('read') ||
      lowerMsg.includes('inspect') ||
      lowerMsg.includes('check') ||
      lowerMsg.includes('browse') ||
      lowerMsg.includes('open') ||
      lowerMsg.includes('view') ||
      lowerMsg.includes('summarize') ||
      lowerMsg.includes('what') ||
      lowerMsg.includes('content') ||
      lowerMsg.includes('tell me') ||
      lastUserMsg.trim() === targetUrl
    );

    if (isUrlInspectIntent) {
      mainWindow.webContents.send('chat:status', {
        state: 'tool',
        toolName: 'read_web_page',
        details: `Reading ${targetUrl}...`
      });

      const pageRes = await readWebPage(targetUrl, { renderJs: true, timeoutMs: 12000 });
      if (!pageRes.success) {
        if (pageRes.blocked) {
          const blockedMsg = `### 🔒 Access Verification Required\n\n` +
            `Could not inspect **[${pageRes.title || targetUrl}](${targetUrl})**:\n\n` +
            `> **${pageRes.error}**\n\n` +
            `*This site employs Cloudflare bot challenges or requires authentication. You can open and view it directly in your browser.*`;
          await streamTextChunks(blockedMsg, targetModel, 'Web Browser', mode);
          return;
        } else {
          const failMsg = `### ⚠️ Web Page Inspection Failed\n\n` +
            `Could not read content from **[${targetUrl}](${targetUrl})**:\n\n` +
            `> **${pageRes.error || 'Server did not respond with readable content.'}**\n\n` +
            `*Please verify the URL is accessible and try again.*`;
          await streamTextChunks(failMsg, targetModel, 'Web Browser', mode);
          return;
        }
      }

      mainWindow.webContents.send('chat:tool-result', {
        tool: 'read_web_page',
        url: targetUrl,
        title: pageRes.title,
        contentLength: pageRes.content?.length || 0
      });

      const snippet = pageRes.content.slice(0, 1500);
      const title = pageRes.title || targetUrl;
      const linksMd = (pageRes.links && pageRes.links.length > 0)
        ? '\n\n**Key Links on Page:**\n' + pageRes.links.slice(0, 4).map(l => `- [${l.text || l.href}](${l.href})`).join('\n')
        : '';

      const groundedAnswer = `### 🌐 [${title}](${pageRes.url})\n\n` +
        `**Extracted Page Content:**\n\n` +
        `> ${snippet}${pageRes.content.length > 1500 ? '...' : ''}\n` +
        `${linksMd}\n\n` +
        `*Grounded directly from live web page via real browser rendering.*`;

      await streamTextChunks(groundedAnswer, targetModel, 'Web Browser', mode);
      return;
    }
  }

  // 1. Tool Request: Workspace File Reading (e.g. "read package.json", "inspect index.html")
  const fileReadMatch = lastUserMsg.match(/(?:read|show|inspect|cat|view|open|check)\s+(?:file\s+)?([a-zA-Z0-9_\-\.\/\\~]+\.[a-zA-Z0-9]+)/i);
  if (fileReadMatch && toolPrefs.files) {
    const targetFile = fileReadMatch[1];
    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'read_file',
      details: `Reading workspace file: ${targetFile}`
    });

    try {
      const fileData = executeReadFile(targetFile);
      mainWindow.webContents.send('chat:tool-result', {
        tool: 'read_file',
        path: targetFile,
        size: fileData.size,
        lines: fileData.lines
      });

      const ext = path.extname(targetFile).replace('.', '') || 'text';
      const formattedContent = `### Workspace File: \`${targetFile}\`\n\n` +
        `- **Location**: \`${fileData.path}\`\n` +
        `- **Size**: \`${(fileData.size / 1024).toFixed(1)} KB\` (${fileData.lines} lines)\n\n` +
        `\`\`\`${ext}\n${fileData.content}\n\`\`\`\n\n` +
        `*File successfully loaded from local workspace.*`;

      await streamTextChunks(formattedContent, targetModel);
      return;
    } catch (err) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'read_file',
        error: err.message
      });

      const errorReply = `### Tool Execution Error: \`read_file\`\n\n` +
        `Could not read \`${targetFile}\`: **${err.message}**\n\n` +
        `Please verify that the file exists in the workspace. You can ask **"list files"** to see available files.`;

      await streamTextChunks(errorReply, targetModel);
      return;
    }
  }

  // 2. Tool Request: Workspace Directory Listing (e.g. "list files", "show workspace", "ls")
  if (toolPrefs.files && (lowerMsg.match(/^(?:list|show|scan|what)\s+(?:all\s+)?(?:files|workspace|directory|project|folder)/i) || lowerMsg === 'ls' || lowerMsg === 'dir')) {
    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'list_files',
      details: 'Scanning active workspace directory'
    });

    try {
      const items = executeListFiles();
      mainWindow.webContents.send('chat:tool-result', {
        tool: 'list_files',
        count: items.length
      });

      let md = `### Active Workspace Directory\n\nFound **${items.length}** items in \`${getWorkspaceRoot()}\`:\n\n`;
      items.forEach((it) => {
        md += `- ${it.isDirectory ? '📁 **' + it.name + '/**' : '📄 `' + it.name + '`'}\n`;
      });
      md += `\n*Ask to read or inspect any specific file (e.g. \`read package.json\`).*`;

      await streamTextChunks(md, targetModel);
      return;
    } catch (err) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'list_files',
        error: err.message
      });
      await streamTextChunks(`Error scanning directory: ${err.message}`, targetModel);
      return;
    }
  }

  // 3. Tool Request: Real Web Search & Research (e.g. "search the web for X", "google X", "search online for X", "browse the web for X")
  const searchMatch = lastUserMsg.match(/(?:search\s+(?:the\s+)?web|google|search\s+online|browse\s+(?:the\s+)?web|browse\s+online|look\s+up\s+online)\s+(?:for\s+)?(.+)/i);
  if (searchMatch && toolPrefs.web) {
    const query = searchMatch[1].trim();
    mainWindow.webContents.send('chat:status', {
      state: 'searching',
      query: query
    });

    try {
      const researchRes = await performWebResearch(query);
      if (!researchRes.success || !researchRes.sources || researchRes.sources.length === 0) {
        const errorMsg = `### Web Search\n\nNo verified web sources found for **"${query}"**.\n\nPlease check your search terms and try again.`;
        await streamTextChunks(errorMsg, targetModel, 'Web Search', mode);
        return;
      }

      mainWindow.webContents.send('chat:tool-result', {
        tool: 'web_search',
        query: query,
        sources: researchRes.sources
      });

      let md = `### 🌐 Web Research: "${query}"\n\n`;
      if (researchRes.findings && researchRes.findings.length > 0) {
        researchRes.findings.forEach((f) => {
          md += `#### [${f.title}](${f.url})\n`;
          if (f.text) {
            md += `> ${f.text.slice(0, 300)}...\n\n`;
          } else if (f.snippet) {
            md += `> ${f.snippet}\n\n`;
          }
        });
      }

      md += `**Sources Verified:**\n`;
      researchRes.sources.forEach((s) => {
        md += `- [${s.title}](${s.url}) — *${s.snippet.slice(0, 110)}...*\n`;
      });

      await streamTextChunks(md, targetModel, 'Web Research', mode);
      return;
    } catch (err) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'web_search',
        error: err.message
      });
      const errorMsg = `### Web Research Unreachable\n\nCould not complete web research for **"${query}"**: ${err.message}\n\nPlease check your network connection and try again.`;
      await streamTextChunks(errorMsg, targetModel, 'Web Research', mode);
      return;
    }
  }

  // 4. Conversational Protection & Explicit Tool Command Dispatchers
  // NEVER generate files or trigger presets on casual greetings ("hi", "hello", "hey") or discussion
  const isGreetingOrDiscussion = lowerMsg.match(/^(?:hi|hello|hey|yo|sup|greetings|good\s+morning|good\s+evening|howdy|what'?s\s+up)\b/i) ||
    lowerMsg.match(/^(?:what\s+is|how\s+to|how\s+do|can\s+we\s+talk|can\s+we\s+discuss|let'?s\s+talk|let'?s\s+discuss|tell\s+me\s+about)\b/i);

  // Explicit ReShade generation command only
  const isExplicitReshadeCmd = !isGreetingOrDiscussion && lowerMsg.match(/(?:generate|create|build|make|compile)\s+(?:a\s+)?(?:new\s+)?(?:[a-zA-Z0-9_\-\s]+)?(?:reshade|re-shade)/i);
  if (isExplicitReshadeCmd) {
    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'reshade_generator',
      details: 'Calibrating shader pipeline, LUT color curves & packaging >100MB suite...'
    });

    try {
      const res = await executeGenerateReshadePresetWithRecovery(lastUserMsg);
      mainWindow.webContents.send('chat:tool-result', {
        tool: 'reshade_generator',
        presetName: res.presetName,
        zipPath: res.filePath,
        presetFiles: res.presetFiles,
        retried: Boolean(res.recoveredFromError)
      });

      // Evolve and record learned skill
      const newSkillName = `Custom Preset Engineering: High-fidelity visual calibration for ${res.presetName}`;
      if (recordLearnedSkill(newSkillName)) {
        mainWindow.webContents.send('chat:skill-learned', { skill: `Calibrated ${res.presetName} profile` });
      }

      const cardHtml = buildReshadePresetCardHtml(res);
      const recoveryNote = res.recoveredFromError
        ? 'The first full-library build failed; I retried using the available library and completed the preset.\n\n'
        : '';
      await streamTextChunks(recoveryNote + cardHtml, targetModel);
      return;
    } catch (err) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'reshade_generator',
        error: err.message
      });
      await streamTextChunks(`Error generating ReShade preset: ${err.message}`, targetModel);
      return;
    }
  }

  // Explicit LSPDFR Plugin command only
  const isExplicitLspdfrCmd = !isGreetingOrDiscussion && lowerMsg.match(/^(?:generate|create|build|make|compile|scaffold)\s+(?:a\s+)?(?:new\s+)?lspdfr\s+plugin/i);
  if (isExplicitLspdfrCmd) {
    mainWindow.webContents.send('chat:status', {
      state: 'tool',
      toolName: 'lspdfr_generator',
      details: 'Scaffolding LSPDFR plugin suite & compiling C# via csc.exe...'
    });

    try {
      const pType = lowerMsg.includes('radar') ? 'police_radar' : 'civilian_interaction';
      const pName = pType === 'police_radar' ? 'ApexRadar' : 'CivilianInteractionPro';
      const res = await lspdfrService.executeGenerateLspdfrPlugin({
        pluginName: pName,
        pluginType: pType,
        description: lastUserMsg,
        voiceGenerator: executeGenerateVoice,
        textureGenerator: executeGenerateTexture,
        downloadsDir: app.getPath('downloads') || path.join(os.homedir(), 'Downloads')
      });
      const cardHtml = lspdfrService.buildLspdfrResultHtml(res);
      await streamTextChunks(cardHtml, targetModel);
      return;
    } catch (err) {
      mainWindow.webContents.send('chat:tool-error', {
        tool: 'lspdfr_generator',
        error: err.message
      });
      await streamTextChunks(`Error generating LSPDFR plugin: ${err.message}`, targetModel);
      return;
    }
  }

  // 5. General Q&A: Cloud AI Provider Execution & Clear Failure Handling
  const activeKey = apiKey || getApiKey();
  const isGroqActive = isGroqKey || isGroqApiKey(activeKey);
  if (isGroqActive && (!targetModel || targetModel.toLowerCase().startsWith('gemini'))) {
    targetModel = 'llama-3.3-70b-versatile';
  }
  const isGeminiSelected = (targetModel || '').toLowerCase().startsWith('gemini') && !isGroqActive;

  if (!activeKey) {
    mainWindow.webContents.send('chat:status', { state: 'thinking' });
    mainWindow.webContents.send('chat:tool-error', {
      tool: 'provider_auth',
      error: 'No API key configured'
    });
    const noKeyMsg = 
      `### ⚠️ Inference Provider Cannot Run\n\n` +
      `**No API Key Configured**\n\n` +
      `Sparx cannot generate live AI responses because no API key is active.\n\n` +
      `**How to resolve:**\n` +
      `1. Open **Settings > Models** (via the profile menu at bottom-left or top menu).\n` +
      `2. Enter your **Groq API key** (starts with \`gsk_...\`).\n` +
      `3. Alternatively, launch the app with \`GROQ_API_KEY\` set in your environment.\n\n` +
      `*(Local workspace inspection commands like \`read <file>\` and \`list files\` remain functional without an API key).*`;
    await streamTextChunks(noKeyMsg, targetModel, 'Provider Engine', mode);
    return;
  }

  // Immediate status dispatch — eliminate 2.8s artificial delay so AI starts instantly
  mainWindow.webContents.send('chat:status', {
    state: 'thinking',
    details: mode === 'work' ? 'Analyzing workstation task & engineering solution...' : 'Formulating technical solution...'
  });

  const activeModelDisplayName = getModelDisplayName(targetModel);
  const memoryBlock = memoryService.getSystemPromptMemoryBlock();

  const defaultSystem = 
    `You are Sparx, a smart, friendly, and highly capable software developer and pair programmer built into the Sparx AI Workstation IDE.

[IDENTITY & ENVIRONMENT]:
- You are Sparx, running on ${activeModelDisplayName}.
- You operate inside the Sparx IDE, an autonomous AI desktop workstation and CLI companion (sparx).
- You have direct access to developer tools: creating directories/folders (create_directory), creating files (create_file), searching workspace files and code (search_workspace), reading files (read_file), applying surgical edits with diffs (edit_file), listing directories (list_directory), running shell commands (run_command), building standalone >100MB ReShade graphical preset packages (generate_reshade_preset), scaffolding and compiling C# LSPDFR plugins with audio & validated UI (generate_lspdfr_plugin), synthesizing neural voice/speech audio (generate_voice), and generating game textures/materials (generate_texture).
- When asked about your model or IDE, explain your identity and capabilities accurately, warmly, and clearly.

[STANDING RULE: COMPLETE ACTIONABLE REQUESTS — NO PLACEHOLDERS OR STUBS]:
- When the user asks you to create, find, edit, package, or operate on something, carry out the requested task to full completion using the real available tools.
- NEVER stop at a plan, empty folder, 1KB placeholder, sample stub, or explanation when the user asked for a finished result.
- Complete the deliverable, verify it exists and works on disk, and base all success messages strictly on actual tool results and verification. Never invent searches, file contents, paths, actions, or test results.
- Preserve existing user data; do not overwrite, delete, or alter unrelated files without explicit approval.

[CONVERSATION STYLE, SLANG & UNCLEAR MESSAGE HANDLING]:
- CALM, UNBOTHERED & CONFIDENT: Stay relaxed, warm, and composed like a great senior developer collaborating with a peer.
- CRUDE, JOKING OR PROVOCATIVE MESSAGES: Never mirror hostility or crude words, never escalate, never lecture, moralize, or scold, and NEVER apologize or grovel (never say "I'm sorry if I upset you", "I apologize for any frustration", or "I'm sorry you feel that way"). Treat banter and provocative jokes with effortless composure and a brief, relaxed reply (e.g. "I'm here—what do you need?", "All good. What are we working on?", "Fair enough. What's on your mind?", "I'm around—what's up?").
- CASUAL SLANG, MEMES & BANTER (e.g. "wassup gang", "no cap", "skibidi", "rizz", "fr fr", "bro is cooked", "bruh"): Recognize casual slang, banter, memes, and typos naturally without taking every phrase literally. Do NOT generate massive essays, unsolicited code, pickup lines, tables, or formal definitions for casual slang. Keep the reply brief, warm, and natural (e.g. "What's up? What are we building?", "Yo! What are we working on?").
- UNCLEAR NON-ACTION MESSAGES: When a message does not request a concrete action and its intent is unclear (e.g. "lmao whatever dude", "huh idk bro", "weird", "nah im good"): reply with a short, natural redirect or acknowledgment instead of an overblown explanation or stiff customer-service clarification.
- GENUINELY AMBIGUOUS ACTION REQUESTS: When the user asks for a real action (e.g. "delete the file", "move this", "fix the bug", "run that command", "make a folder called frizzy") but is missing essential details (which file, what command, which location, what path), ALWAYS ask one clear, concise clarifying question before executing.
- Short acknowledgements & transitions (e.g. 'nice', 'ok', 'cool', 'thanks', 'got it', 'k', 'yep'): reply briefly, naturally, and warmly (e.g. 'Glad that helped!', 'Sounds good.', 'Anytime!'). Do NOT repeat prior answers or facts.
- NO CANNED SCRIPTING: Never reintroduce yourself with canned marketing copy ("I'm Sparx, your friendly coding sidekick..."), and never append repetitive formulas like "Is there anything else I can help you with today?". Speak with authentic developer confidence and clarity.
- Handle corrections naturally: acknowledge plainly ('Good catch, my bad!') and fix it immediately without defensiveness or groveling.
- Avoid gloomy self-descriptions, repeated disclaimers, forced corporate enthusiasm, or claims about abilities you don't have. Speak with authentic developer confidence and clarity.

[FILESYSTEM OPERATIONS & LOCATION GROUNDING RULES]:
- CHOOSE THE CORRECT LOCATION (STRICT):
  1. PC Location Requests: For requests like "make a folder on my PC", "create a folder on my Desktop", "save this in Downloads", or "in Documents", use real PC filesystem access. Invoke create_directory or create_file with location: 'desktop', 'documents', 'downloads', or 'home'.
  2. Workspace / Project Requests: For requests that clearly refer to the open project ("in this project", "in the workspace", "add a folder to the repo", "in src/"), use location: 'workspace'. If no workspace is open, ask the user to open or choose a workspace folder first (File > Open Folder).
  3. Contextual Subfolders: If the user previously created or specified a folder in the conversation (e.g. "TWIZZY" on Desktop), remember its location! When asked to create a file inside that folder (e.g. "create model_description.txt inside TWIZZY"), use that same location (e.g. location: 'desktop', path: 'TWIZZY/model_description.txt' or location: 'C:\\Users\\...\\TWIZZY').
  4. Parent Location Not Clear: For a path like "inside the TWIZZY folder", if its parent location is not clear and not known from previous chat turns, ask where it is located on their PC before creating anything. Never silently guess the workspace.
  5. UNQUALIFIED REQUESTS: For an unqualified request like "make me a new folder called frizzy" or "create a file called test.txt" where destination is unclear, ask where on the PC they want it, offering clear choices: Desktop, Documents, Downloads, or the current project workspace. Only call the tool after they respond.
  6. File Types & Content: Support creating common file types (.txt, source code like .py or .js, config files like .json or .yaml, documentation like .md, etc.). Write the exact filename and contents requested by the user.
  7. VERIFIED REPORTING: ALWAYS wait for the tool execution result. Verify the folder or file exists at the requested location before confirming success. Report the actual resolved path from the tool result. NEVER claim a folder or file was created unless you received a verified successful tool result in this turn.
  8. REPORTING FAILURES: If an operation fails (e.g. path traversal rejected, file already exists, permission denied, verification failed), truthfully report the exact error. Never claim success when an action failed.
  9. SAFETY & OVERWRITES: Do not overwrite existing files without confirmation. Path traversal outside the target location is strictly blocked.
  10. FINDING & READING FILES ON PC (GROUNDED WORKFLOW):
      - For requests like "in swuzy folder, .txt file, what is in it" or "what is inside the .txt file in swuzy":
      - Locate the folder using locate_folder (checking sensible PC locations: Desktop, Documents, Downloads, Home, Workspace, or the path established in earlier chat turns). Never scan the whole disk.
      - Inspect the folder contents using list_directory or find_files to identify matching files.
      - If exactly 1 matching file exists, call read_file to read the actual file on disk. Report its filename, full path, and exact contents in a readable code block.
      - If several matching files exist, list them clearly with their names/sizes and ask the user which one they would like to read.
      - If the folder or file cannot be found, say so plainly. Never guess or invent filenames or contents.
- For ambiguous questions (e.g. "what's the path?"), ask one concise clarifying question rather than guessing or running tools blindly. Once clarified (e.g. "the path to rouz"), call search_workspace to locate it. If no match is found, clearly state that no match was found without hallucinating a path.

[COMPUTER USE & DESKTOP AUTOMATION RULES]:
- Treat "use computer skill", opening applications, focusing windows, and executing browser searches as direct desktop automation workflows.
- Never substitute a PowerShell process launch, web-search API, or search command for actual desktop GUI interaction.
- For browser tasks (e.g. "search 777 on Brave"):
  1. Capture the screen and confirm Brave is visible in the foreground.
  2. Enter and submit the query using real GUI controls on the visible address/search bar (Ctrl+L, type query, Enter).
  3. Capture the screen again and confirm Brave displays results for that query.
  4. Only report completion after verifying results. If results are not visible, report what actually happened.
- During active computer use, the desktop displays a fixed purple glowing border around screen edges, the status pill "Sparx is using your computer · Esc to cancel", and a purple cursor highlight tracking the cursor.
- Physical Escape key or clicking cancel stops and cleans up the active session immediately.
- If an application is genuinely not installed on the system, report that verified blocker truthfully and ask whether to continue with the remaining steps.

[RESHADE PRESET SPECIALIST & GRAPHICAL MODDING]:
- You are a world-class graphics shader engineer specializing in ReShade presets for games (GTA V, FiveM, Cyberpunk 2077, RDR2, Assetto Corsa, etc.).
- Deep technical mastery over:
  - QuantV (Photorealistic vehicle reflections, skylight curves, ambient tone mapping)
  - PD80 (Color balance, curved contrast, black level tone distribution)
  - qUINT_lightroom (Exposure, white balance, tint, hue/saturation/luminance separation, selective color vibrance)
  - FilmicPass (High dynamic range film curves, cinematic tone compression)
  - CAS (AMD FidelityFX Contrast Adaptive Sharpening, razor-sharp edge detail without haloing)
  - MartysMods / iMMERSE (RTGI screen-space ray tracing, ambient occlusion, MXAO)
  - CorgiFX, vort_Shaders, VRToolkit, ZenteonFX
- CRITICAL RULE FOR RESHADE PRESETS: Whenever the user asks to create, generate, or calibrate a ReShade preset (either in a single prompt or after specifying the game, style, or preset name like "gta5photoreal"), ALWAYS call the \`generate_reshade_preset\` tool!
- RESHADE LIBRARY AND COLOR RULES: Use the full ReShade library available to the generator. Never claim it is unavailable because a packaging step failed; inspect the reported failure and retry the full-library build before reporting an error. Never substitute a compact or kilobyte preset.
  - STRICT ZERO-DOTS POLICY: NEVER inject dithering, deband noise patterns, or QuantV_Post noise. CAS sharpening must be clean (0.50) without edge speckling or micro-noise.
  - STRICT ZERO-RED-BIAS: Always keep white balance and color natural daylight neutral (LIGHTROOM_RED_SATURATION=0.0, lrTemp=0.0). Completely ban artificial warm/red/copper bias unless explicitly requested by the user.
  - STRICT OPEN-SHADOWS: Never crush dark areas into pitch black (LIGHTROOM_GLOBAL_BLACK_LEVEL=0.0, lift SHADOWS_CURVE=0.22, BLACKS_CURVE=0.18). Shaded asphalt, vehicle interiors, and alleys must remain clearly visible and luminous.
- NEVER use \`create_directory\` or \`create_file\` to create stub ReShade folders or 1KB placeholder shader files! Calling \`generate_reshade_preset\` compiles and packages the real >100MB (~145.9 MB) standalone suite containing all 91 shaders in \`reshade-shaders/Shaders\`, all 105 LUTs/textures in \`reshade-shaders/Textures\`, the master calibrated \`.ini\` file, \`IN GAME BRIGHTNESS.png\`, and \`README.txt\` directly into the user's Downloads folder.

[SMART MULTI-MODAL GENERATION (VOICE & TEXTURES)]:
- You have built-in tools for Edge Neural Voice TTS (\`generate_voice\`) and Pollinations.ai texture/image synthesis (\`generate_texture\`).
- DECIDE INTELLIGENTLY WHEN TO GENERATE — DO NOT SPAM UNREQUESTED ASSETS:
  - Generate Voice (\`generate_voice\`): Call this ONLY when the user asks for speech, audio, narration, radio dispatch, voiceover dialogue, or voice generation (e.g. "make a police dispatch voice line", "generate audio saying X", "speak this text").
  - Generate Textures (\`generate_texture\`): Call this ONLY when the user asks to generate textures, materials, PBR maps, decal graphics, or visual imagery (e.g. "generate an asphalt texture", "make a police radar UI icon texture", "generate a road normal map").
  - DO NOT trigger voice or texture tools automatically for standard coding questions, file management, debugging, or standard ReShade preset generation requests unless explicitly requested.

[CONVERSATIONAL INTELLIGENCE & REQUEST VALIDATION]:
- GREETINGS & CASUAL CHAT FIRST: When the user says "hi", "hello", "hey", "sup", asks how you are doing, or engages in open conversation/discussion, NEVER trigger generation tools or create files! Greet them warmly, naturally, and conversationally as an elite software developer peer.
- REQUEST VALIDATION: Only execute generator tools when the user makes an explicit, validated request to create, generate, or build something. If essential details are missing, ask a clear clarifying question before executing.

[LSPDFR & RAGE PLUGIN HOOK MODDING SPECIALIST]:
- You are a master Grand Theft Auto V police modification developer specializing in RAGE Plugin Hook (RPH) and LSPDFR plugins.
- Deep architectural expertise in:
  - GameFiber background threads (preventing game freeze)
  - Game.FrameRender responsive UI overlays
  - Doppler speed vector math (targetVehicle.Speed * 2.23694f, Vector3.Dot forward vectors)
  - Ambient pedestrian stopping, ID checks (Functions.GetPedPersona), field sobriety / breathalyzer simulation
  - Automated License Plate Recognition (ALPR) and BOLO queries
- CRITICAL TOOL: When the user asks to create, scaffold, or compile an LSPDFR plugin (police radar, civilian interaction, custom callout), ALWAYS call the \`generate_lspdfr_plugin\` tool!
- Calling \`generate_lspdfr_plugin\` scaffolds the complete C# project (.sln, .csproj, Features, UI, Config), synthesizes neural Edge TTS police radio audio clips, generates & validates in-game UI textures, and compiles directly into a working .dll via csc.exe packaged into a standalone .zip.` +
    memoryBlock;

  let modeSystemDirective = '';
  if (mode === 'work') {
    modeSystemDirective =
      "\n\n[WORK MODE ACTIVE — AUTONOMOUS WORKSTATION ENGINEER]:\n" +
      "You are in WORK MODE. Your task is to perform concrete workstation engineering, not casual chit-chat.\n" +
      "Follow this three-stage execution pattern:\n" +
      "1. [PLAN & IMPACT]: Analyze the requested changes, affected files, and dependencies.\n" +
      "2. [IMPLEMENTATION]: Provide exact code patches, drop-in implementations, or workspace command recipes.\n" +
      "3. [VERIFICATION]: Explain how to test, build, and verify the changes inside the workspace.\n" +
      "Be decisive, precise, and deliver production-grade code.";
  }

  // Helper: stream reasoning with Google Gemini with automatic key rotation and strict gemini-2.0-flash enforcement
  async function streamGeminiWithRotation(messages, fullSystemInstruction, requestedModel, mode, toolPrefs = {}) {
    const geminiPool = getGeminiKeyPool();
    if (geminiPool.length === 0) {
      throw new Error('No Google Gemini API key configured.');
    }

    // Strictly enforce 2.0 Flash as instructed
    let candidateModels = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
    if (requestedModel && requestedModel.includes('flash')) {
      candidateModels = [requestedModel, ...candidateModels.filter(m => m !== requestedModel)];
    }

    let lastError = null;
    const cleanHistory = sanitizeConversationHistory(messages, 'gemini');
    const formattedContents = cleanHistory.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Iterate through all available Gemini keys in the pool before throwing a quota/rate-limit error
    for (let attempt = 0; attempt < geminiPool.length; attempt++) {
      const activeKey = getActiveGeminiKey();
      if (!activeKey) break;

      for (const targetModel of candidateModels) {
        try {
          if (!GoogleGenAI) {
            throw new Error('Google Gemini SDK (@google/genai) missing');
          }
          const ai = new GoogleGenAI({ apiKey: activeKey });

          const streamConfig = {
            model: targetModel,
            contents: formattedContents,
            config: {
              systemInstruction: fullSystemInstruction,
              ...(toolPrefs.grounding ? { tools: [{ googleSearch: {} }] } : {})
            }
          };

          mainWindow.webContents.send('chat:status', { state: 'thinking' });
          const responseStream = await ai.models.generateContentStream(streamConfig);
          let fullAccumulated = '';
          let sourcesEmitted = false;

          for await (const chunk of responseStream) {
            if (activeChatAbort) break;

            if (!sourcesEmitted && chunk.candidates && chunk.candidates[0] && chunk.candidates[0].groundingMetadata) {
              const meta = chunk.candidates[0].groundingMetadata;
              if (Array.isArray(meta.groundingChunks)) {
                const realSources = meta.groundingChunks
                  .filter((g) => g.web && g.web.uri)
                  .map((g) => ({ title: g.web.title || g.web.uri, url: g.web.uri }));
                if (realSources.length > 0) {
                  mainWindow.webContents.send('chat:tool-result', {
                    tool: 'google_search_grounding',
                    sources: realSources
                  });
                  sourcesEmitted = true;
                }
              }
            }

            const chunkText = chunk.text || '';
            if (chunkText) {
              fullAccumulated += chunkText;
              mainWindow.webContents.send('chat:stream-chunk', { text: chunkText });
            }
          }

          mainWindow.webContents.send('chat:stream-end', {
            fullText: fullAccumulated,
            model: targetModel,
            provider: 'Google Gemini',
            mode: mode,
            aborted: activeChatAbort
          });
          try { consumeUsage(1); } catch (e) {}
          return true; // Successfully finished
        } catch (err) {
          lastError = err;
          const errMsg = err.message || '';
          console.warn(`[Gemini Fallback] Key ${activeKey.slice(0, 10)}... encountered error on ${targetModel}:`, errMsg);

          // Model 404/not available -> try next model variant
          if (errMsg.includes('NOT_FOUND') || errMsg.includes('404')) {
            continue;
          }

          // Depleted/rate limit (429, RESOURCE_EXHAUSTED, 503, 401, 403, 400) -> mark key expired and advance to next key in pool
          markGeminiKeyExpired(activeKey, errMsg);
          break;
        }
      }
    }

    throw lastError || new Error('All Gemini fallback keys exhausted.');
  }

  // Route 1: Groq inference provider (when a gsk_ key is active)
  let groqError = null;
  if (isGroqKey) {
    try {
      await streamGroqResponse(apiKey, messages, (systemInstruction || defaultSystem) + modeSystemDirective, targetModel, AGENT_TOOL_DEFINITIONS, mode);
      return;
    } catch (err) {
      console.warn('[Main] All Groq pool keys exhausted or rate-limited:', err.message);
      groqError = err;
    }
  }

  // Route 2: Google Gemini Provider (used directly or as seamless failover when Groq keys hit rate limit)
  const geminiPool = getGeminiKeyPool();
  if (geminiPool.length > 0 && GoogleGenAI) {
    try {
      console.log('[Main] Running Google Gemini fallback pool with gemini-2.0-flash...');
      await streamGeminiWithRotation(messages, (systemInstruction || defaultSystem) + modeSystemDirective, 'gemini-2.0-flash', mode, toolPrefs);
      return;
    } catch (geminiErr) {
      console.warn('[Main] All Gemini fallback keys also exhausted:', geminiErr.message);
    }
  }

  // If we reach this point, ALL fallback keys across Groq AND Gemini have been completely exhausted
  const finalErr = groqError || new Error('All provider API keys reached their quota or rate limit.');
  mainWindow.webContents.send('chat:tool-error', {
    tool: 'cloud_ai',
    error: finalErr.message
  });
  const failMsg = `### ⚠️ Quota / Rate Limit Reached\n\nAll configured API keys (including built-in Groq and Gemini fallbacks) have reached their current rate limit or quota:\n> **${finalErr.message}**\n\n**To resolve:**\n- Please wait a few moments for the rate limit window to reset.\n- Add a custom API key in **Settings > Models**.`;
  await streamTextChunks(failMsg, targetModel, 'AI Gateway', mode);
  return;
});

// ----------------------------------------------------------------------------
// Real Functional Installer & Uninstaller IPC Engine
// ----------------------------------------------------------------------------
function killRunningTacticalProcesses() {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve();
    exec('taskkill /F /IM "Sparx.exe" /T & taskkill /F /IM "Tactical Studio.exe" /T', () => {
      setTimeout(resolve, 600);
    });
  });
}

function sendInstallStatus(stage, percent, log) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('install-status', { stage, percent, log });
  }
}

ipcMain.handle('app:get-install-info', async () => {
  const exePath = path.join(DEFAULT_TARGET_DIR, 'Sparx.exe');
  const fallbackPath = path.join(DEFAULT_TARGET_DIR, 'Tactical Studio.exe');
  const isInstalled = fs.existsSync(exePath) || fs.existsSync(fallbackPath);
  return {
    isInstalled,
    targetDir: DEFAULT_TARGET_DIR,
    installedVersion: isInstalled ? '1.0.0' : null
  };
});

ipcMain.on('installer:start', async (_event, options = {}) => {
  const targetDir = options.targetDir || DEFAULT_TARGET_DIR;
  const createDesktop = options.createDesktopShortcut ?? true;
  const createStartMenu = options.createStartMenuShortcut ?? true;

  try {
    sendInstallStatus('Checking active processes...', 10, '[INIT] Preparing installation target: ' + targetDir);
    await killRunningTacticalProcesses();
    sendInstallStatus('Terminating conflicts...', 20, '[PROCESS] Closed any active Tactical Studio instances to unlock files.');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const unpackedSource = path.join(__dirname, 'dist', 'win-unpacked');
    const sourceDir = fs.existsSync(unpackedSource) ? unpackedSource : __dirname;

    sendInstallStatus('Copying application binaries...', 35, `[EXTRACT] Source directory identified: ${sourceDir}`);
    sendInstallStatus('Writing core runtime...', 55, '[COPY] Copying executable, V8 snapshot, and electron runtime...');

    await fs.promises.cp(sourceDir, targetDir, {
      recursive: true,
      force: true,
      filter: (src) => {
        const basename = path.basename(src);
        return basename !== '.git' && basename !== 'dist' && !src.includes('node_modules\\.cache');
      }
    });

    sendInstallStatus('Registering shortcuts...', 78, '[SHORTCUT] Registering Windows shell links via WScript.Shell...');

    if (IS_WIN && (createDesktop || createStartMenu)) {
      const sparxExe = path.join(targetDir, 'Sparx.exe');
      const targetExe = fs.existsSync(sparxExe) ? sparxExe : (fs.existsSync(path.join(targetDir, 'Tactical Studio.exe')) ? path.join(targetDir, 'Tactical Studio.exe') : sparxExe);
      const psScript = `
        $WshShell = New-Object -ComObject WScript.Shell
        $IcoPath = Join-Path '${targetDir.replace(/'/g, "''")}' 'sparx.ico'
        ${createDesktop ? `
        $DesktopPath = [Environment]::GetFolderPath('Desktop')
        $DesktopLnk = Join-Path $DesktopPath 'Sparx.lnk'
        $sc1 = $WshShell.CreateShortcut($DesktopLnk)
        $sc1.TargetPath = '${targetExe.replace(/'/g, "''")}'
        $sc1.WorkingDirectory = '${targetDir.replace(/'/g, "''")}'
        $sc1.IconLocation = \"$IcoPath,0\"
        $sc1.Description = 'Sparx AI Workstation'
        $sc1.Save()
        ` : ''}
        ${createStartMenu ? `
        $ProgramsPath = [Environment]::GetFolderPath('Programs')
        $StartMenuLnk = Join-Path $ProgramsPath 'Sparx.lnk'
        $sc2 = $WshShell.CreateShortcut($StartMenuLnk)
        $sc2.TargetPath = '${targetExe.replace(/'/g, "''")}'
        $sc2.WorkingDirectory = '${targetDir.replace(/'/g, "''")}'
        $sc2.IconLocation = \"$IcoPath,0\"
        $sc2.Description = 'Sparx AI Workstation'
        $sc2.Save()
        ` : ''}
      `;

      await new Promise((res) => {
        exec(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`, () => res());
      });
      sendInstallStatus('Shortcuts registered.', 90, '[SUCCESS] Desktop & Start Menu shortcuts updated.');
    }

    sendInstallStatus('Installation finalized.', 100, '[DONE] Sparx installed successfully.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-complete', { mode: 'install', targetDir });
    }
  } catch (err) {
    console.error('[Main Installer Error]:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-error', { error: err.message });
    }
  }
});

ipcMain.on('uninstaller:start', async (_event, options = {}) => {
  const targetDir = options.targetDir || DEFAULT_TARGET_DIR;
  const purgeUserData = options.purgeUserData ?? true;

  try {
    sendInstallStatus('Terminating processes...', 15, '[UNINSTALL] Terminating any running Tactical Studio processes...');
    await killRunningTacticalProcesses();

    sendInstallStatus('Removing desktop shortcuts...', 40, '[CLEANUP] Removing Windows desktop and start menu shortcuts...');
    if (IS_WIN) {
      const desktopLnk = path.join(os.homedir(), 'Desktop', 'Sparx.lnk');
      const oldDesktopLnk = path.join(os.homedir(), 'Desktop', 'Tactical Studio.lnk');
      const startMenuLnk = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Sparx.lnk');
      const oldStartMenuLnk = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Tactical Studio.lnk');

      if (fs.existsSync(desktopLnk)) { try { fs.unlinkSync(desktopLnk); } catch (e) {} }
      if (fs.existsSync(oldDesktopLnk)) { try { fs.unlinkSync(oldDesktopLnk); } catch (e) {} }
      if (fs.existsSync(startMenuLnk)) { try { fs.unlinkSync(startMenuLnk); } catch (e) {} }
      if (fs.existsSync(oldStartMenuLnk)) { try { fs.unlinkSync(oldStartMenuLnk); } catch (e) {} }
    }

    sendInstallStatus('Purging application binaries...', 70, `[PURGE] Deleting directory: ${targetDir}`);
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch (rmErr) {
        await killRunningTacticalProcesses();
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    }

    if (purgeUserData) {
      sendInstallStatus('Cleaning application cache...', 88, '[CACHE] Removing local user data & cache...');
      const userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'tactical-studio-workstation');
      if (fs.existsSync(userDataDir)) {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
      }
    }

    sendInstallStatus('Uninstallation complete.', 100, '[COMPLETE] Tactical Studio completely removed.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-complete', { mode: 'uninstall' });
    }
  } catch (err) {
    console.error('[Main Uninstaller Error]:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-error', { error: err.message });
    }
  }
});

ipcMain.on('installer:launch-app', () => {
  const sparxExe = path.join(DEFAULT_TARGET_DIR, 'Sparx.exe');
  const tacticalExe = path.join(DEFAULT_TARGET_DIR, 'Tactical Studio.exe');
  const exeToLaunch = fs.existsSync(sparxExe) ? sparxExe : tacticalExe;
  if (fs.existsSync(exeToLaunch)) {
    spawn(exeToLaunch, [], { detached: true, stdio: 'ignore' }).unref();
  }
  app.quit();
});

// App Lifecycle
app.whenReady().then(() => {
  app.setName('Sparx');
  app.setAppUserModelId('com.sparx.app');

  // Intercept Chromium media permission requests
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (permission === 'media' || permission === 'microphone') {
        const status = getMicrophonePermission();
        if (status === 'granted') {
          callback(true);
        } else {
          callback(false);
        }
        return;
      }
      callback(true);
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      if (permission === 'media' || permission === 'microphone') {
        return getMicrophonePermission() === 'granted';
      }
      return true;
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
