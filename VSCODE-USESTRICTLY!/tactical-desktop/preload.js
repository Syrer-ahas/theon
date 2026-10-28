// ============================================================================
// Tactical Studio Workstation — Secure Preload Bridge
// contextBridge Isolation, Streaming AI IPC, & Markdown Parsing
// ============================================================================

const { contextBridge, ipcRenderer, webFrame } = require('electron');

let markedInstance = null;
try {
  // marked v18 is "type": "module", so require('marked') fails, and its UMD file is also treated as ESM by require().
  // Load the UMD bundle's source and evaluate it as a CommonJS-style module instead.
  const fs = require('fs');
  const umdPath = require('path').join(__dirname, 'node_modules', 'marked', 'lib', 'marked.umd.js');
  const umdModule = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(umdPath, 'utf8'))(umdModule, umdModule.exports);
  const markedPkg = umdModule.exports;
  markedInstance = markedPkg.marked || markedPkg;
} catch (e) {
  console.warn('[Preload] marked package loading deferred:', e.message);
}

// Reply HTML comes from a model / web content, so strip active content before it is inserted into the page.
function sanitizeHtml(html) {
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,base').forEach((n) => n.remove());
    tpl.content.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '').trim().toLowerCase();
        if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href') && /^(javascript|data|vbscript):/.test(value))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return tpl.innerHTML;
  } catch (e) {
    return String(html || '').replace(/</g, '&lt;');
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Chrome Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  setZoomLevel: (level) => {
    try { webFrame.setZoomLevel(level); } catch (e) {}
  },
  getZoomLevel: () => {
    try { return webFrame.getZoomLevel(); } catch (e) { return 0; }
  },
  onMaximizeStatus: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, isMax) => callback(isMax);
      ipcRenderer.on('window:maximized-status', listener);
      return () => ipcRenderer.removeListener('window:maximized-status', listener);
    }
  },

  // Streaming AI Chat Handlers
  sendMessage: (payload) => ipcRenderer.send('chat:send-message', payload),
  cancelChat: () => ipcRenderer.send('chat:cancel'),
  setGeminiModel: (model) => ipcRenderer.invoke('app:set-gemini-model', model),
  loadChatSessions: () => ipcRenderer.invoke('chat:load-sessions'),
  saveChatSessions: (sessions) => ipcRenderer.invoke('chat:save-sessions', sessions),
  generateChatTitle: (messages) => ipcRenderer.invoke('chat:generate-title', messages),

  onStreamStart: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:stream-start', listener);
      return () => ipcRenderer.removeListener('chat:stream-start', listener);
    }
  },

  onStreamChunk: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:stream-chunk', listener);
      return () => ipcRenderer.removeListener('chat:stream-chunk', listener);
    }
  },

  onReasoningChunk: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:reasoning-chunk', listener);
      return () => ipcRenderer.removeListener('chat:reasoning-chunk', listener);
    }
  },

  onStreamEnd: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:stream-end', listener);
      return () => ipcRenderer.removeListener('chat:stream-end', listener);
    }
  },

  onChatStatus: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:status', listener);
      return () => ipcRenderer.removeListener('chat:status', listener);
    }
  },

  onSkillLearned: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:skill-learned', listener);
      return () => ipcRenderer.removeListener('chat:skill-learned', listener);
    }
  },

  onToolResult: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:tool-result', listener);
      return () => ipcRenderer.removeListener('chat:tool-result', listener);
    }
  },

  onToolError: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:tool-error', listener);
      return () => ipcRenderer.removeListener('chat:tool-error', listener);
    }
  },

  onChatError: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('chat:error', listener);
      return () => ipcRenderer.removeListener('chat:error', listener);
    }
  },

  // API Key Management
  saveApiKey: (key) => ipcRenderer.invoke('app:save-api-key', key),
  getApiKey: () => ipcRenderer.invoke('app:get-api-key'),
  getApiKeyInfo: () => ipcRenderer.invoke('app:get-api-key-info'),

  // App Settings (persisted in the main-process config file)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (updates) => ipcRenderer.invoke('settings:set', updates),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  getWorkspace: () => ipcRenderer.invoke('settings:get-workspace'),
  chooseWorkspace: () => ipcRenderer.invoke('settings:choose-workspace'),
  resetWorkspace: () => ipcRenderer.invoke('settings:reset-workspace'),
  getAbout: () => ipcRenderer.invoke('app:get-about'),

  // In-App Auto-Update & Publishing API
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  applyUpdate: () => ipcRenderer.invoke('app:apply-update'),
  publishUpdate: (payload) => ipcRenderer.invoke('app:publish-update', payload),
  onUpdateProgress: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('app:update-progress', listener);
      return () => ipcRenderer.removeListener('app:update-progress', listener);
    }
  },
  onUpdateStatus: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('app:update-status', listener);
      return () => ipcRenderer.removeListener('app:update-status', listener);
    }
  },

  showItemInFolder: (path) => ipcRenderer.invoke('app:show-item-in-folder', path),
  openPath: (path) => ipcRenderer.invoke('app:open-path', path),
  openFileDialog: (options) => ipcRenderer.invoke('app:open-file-dialog', options),
  readFileContent: (path) => ipcRenderer.invoke('app:read-file-content', path),

  // Markdown Parser
  parseMarkdown: (markdownText) => {
    if (markedInstance && typeof markedInstance.parse === 'function') {
      try {
        return sanitizeHtml(markedInstance.parse(markdownText || ''));
      } catch (err) {
        console.error('[Preload] Markdown parse error:', err);
      }
    }
    return '<p>' + String(markdownText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') + '</p>';
  },

  // Environment & Diagnostics
  getEnvInfo: () => ipcRenderer.invoke('app:get-env-info'),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),

  // Authentication & Cloud Sync Bridge
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  googleSignIn: () => ipcRenderer.invoke('auth:google-signin'),
  checkEmailStatus: (email) => ipcRenderer.invoke('auth:check-email-status', email),
  requestSignupOtp: (payload) => ipcRenderer.invoke('auth:request-signup-otp', payload),
  verifyOtpAndRegister: (payload) => ipcRenderer.invoke('auth:verify-otp-register', payload),
  loginWithPassword: (payload) => ipcRenderer.invoke('auth:login-with-password', payload),
  loginWithEmail: (payload) => ipcRenderer.invoke('auth:login-with-email', payload),
  logout: () => ipcRenderer.invoke('auth:logout'),
  syncCloud: (data) => ipcRenderer.invoke('auth:sync-cloud', data),
  deleteAccount: () => ipcRenderer.invoke('auth:delete-account'),
  exportData: () => ipcRenderer.invoke('auth:export-data'),
  onAuthStateChanged: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, session) => callback(session);
      ipcRenderer.on('auth:session-updated', listener);
      return () => ipcRenderer.removeListener('auth:session-updated', listener);
    }
  },

  // Installer Operations
  getInstallInfo: () => ipcRenderer.invoke('app:get-install-info'),
  startInstall: (options) => ipcRenderer.send('installer:start', options),
  startUninstall: (options) => ipcRenderer.send('uninstaller:start', options),
  launchInstalledApp: () => ipcRenderer.send('installer:launch-app'),
  onInstallStatus: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('install-status', listener);
      return () => ipcRenderer.removeListener('install-status', listener);
    }
  },
  onInstallComplete: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('install-complete', listener);
      return () => ipcRenderer.removeListener('install-complete', listener);
    }
  },
  onInstallError: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('install-error', listener);
      return () => ipcRenderer.removeListener('install-error', listener);
    }
  },

  // Access & Approvals Governance Subsystem
  getAccessSettings: () => ipcRenderer.invoke('access:get-settings'),
  setAccessMode: (mode) => ipcRenderer.invoke('access:set-mode', mode),
  toggleAccessCapability: (capability, enabled) => ipcRenderer.invoke('access:toggle-capability', { capability, enabled }),
  revokeAllAccess: () => ipcRenderer.invoke('access:revoke-all'),
  respondApproval: (id, approved) => ipcRenderer.invoke('access:respond-approval', { id, approved }),
  onAccessStatusChanged: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('access:status-changed', listener);
      return () => ipcRenderer.removeListener('access:status-changed', listener);
    }
  },
  onRequestApproval: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('access:request-approval', listener);
      return () => ipcRenderer.removeListener('access:request-approval', listener);
    }
  },

  // Computer Use & Screen Capture Subsystem
  startComputerSession: () => ipcRenderer.invoke('computer:start-session'),
  stopComputerSession: () => ipcRenderer.invoke('computer:stop-session'),
  setComputerSessionPaused: (paused) => ipcRenderer.invoke('computer:set-paused', paused),
  getComputerSessionStatus: () => ipcRenderer.invoke('computer:get-status'),
  captureScreen: () => ipcRenderer.invoke('computer:capture-screen'),
  cancelComputerUse: () => ipcRenderer.send('computer:cancel'),
  onComputerStatusChanged: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('computer:status-changed', listener);
      return () => ipcRenderer.removeListener('computer:status-changed', listener);
    }
  },
  onComputerActivityStarted: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('computer:activity-started', listener);
      return () => ipcRenderer.removeListener('computer:activity-started', listener);
    }
  },
  onComputerActivityEnded: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('computer:activity-ended', listener);
      return () => ipcRenderer.removeListener('computer:activity-ended', listener);
    }
  },

  // Usage & Quotas Subsystem
  getUsage: () => ipcRenderer.invoke('usage:get'),
  consumeUsage: (amount) => ipcRenderer.invoke('usage:consume', amount),
  onUsageUpdated: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('usage:updated', listener);
      return () => ipcRenderer.removeListener('usage:updated', listener);
    }
  },

  // Web Browser & Research Subsystem
  searchWeb: (query) => ipcRenderer.invoke('browser:search', query),
  readWebPage: (url) => ipcRenderer.invoke('browser:read-page', url),
  browseWeb: (query) => ipcRenderer.invoke('browser:research', query),

  // Terminal & Command Execution Subsystem
  killTerminalProcess: (pid) => ipcRenderer.invoke('terminal:kill-process', pid),
  onTerminalOutput: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('terminal:output', listener);
      return () => ipcRenderer.removeListener('terminal:output', listener);
    }
  },

  // Full IDE Subsystem (Workspace File Tree, Monaco File Ops, Git, Interactive PTY)
  ideSelectFolder: () => ipcRenderer.invoke('ide:select-folder'),
  ideGetWorkspaceTree: () => ipcRenderer.invoke('ide:get-workspace-tree'),
  ideReadFile: (filePath) => ipcRenderer.invoke('ide:read-file', filePath),
  ideSaveFile: (filePath, content) => ipcRenderer.invoke('ide:save-file', filePath, content),
  ideCreateFile: (filePath) => ipcRenderer.invoke('ide:create-file', filePath),
  ideCreateFolder: (folderPath) => ipcRenderer.invoke('ide:create-folder', folderPath),
  ideDeleteItem: (itemPath) => ipcRenderer.invoke('ide:delete-item', itemPath),
  ideCloseWorkspace: () => ipcRenderer.invoke('ide:close-workspace'),
  onWorkspaceChanged: (callback) => {
    if (typeof callback === 'function') {
      const listener = () => callback();
      ipcRenderer.on('ide:workspace-changed', listener);
      return () => ipcRenderer.removeListener('ide:workspace-changed', listener);
    }
  },
  ideGitStatus: () => ipcRenderer.invoke('ide:git-status'),
  ideGitDiff: (filePath) => ipcRenderer.invoke('ide:git-diff', filePath),
  ideGitCommit: (message) => ipcRenderer.invoke('ide:git-commit', message),
  ideGenerateDiff: (oldText, newText, filename) => ipcRenderer.invoke('ide:generate-diff', oldText, newText, filename),
  ideListFiles: () => ipcRenderer.invoke('ide:list-files'),
  ideGlobalSearch: (options) => ipcRenderer.invoke('ide:global-search', options),
  ideTerminalSpawn: (options) => ipcRenderer.invoke('ide:terminal-spawn', options),
  ideTerminalWrite: (termId, data) => ipcRenderer.send('ide:terminal-write', termId, data),
  ideTerminalResize: (termId, cols, rows) => ipcRenderer.send('ide:terminal-resize', termId, cols, rows),
  ideTerminalKill: (termId) => ipcRenderer.send('ide:terminal-kill', termId),
  onTerminalData: (termId, callback) => {
    if (typeof callback === 'function') {
      const channel = `terminal:data:${termId}`;
      const listener = (_event, data) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  },
  onTerminalExit: (termId, callback) => {
    if (typeof callback === 'function') {
      const channel = `terminal:exit:${termId}`;
      const listener = (_event, data) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  },

  // Persistent Memory & Personalization API
  getMemories: () => ipcRenderer.invoke('memory:get'),
  addMemory: (text, category) => ipcRenderer.invoke('memory:add', { text, category }),
  deleteMemory: (id) => ipcRenderer.invoke('memory:delete', id),
  clearMemories: () => ipcRenderer.invoke('memory:clear'),
  toggleMemory: (enabled) => ipcRenderer.invoke('memory:toggle', enabled),
  onMemoryUpdated: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('memory:updated', listener);
      return () => ipcRenderer.removeListener('memory:updated', listener);
    }
  },

  // Windows Microphone Permission & Speech Dictation API
  getMicrophonePermission: () => ipcRenderer.invoke('app:get-microphone-permission'),
  requestMicrophonePermission: () => ipcRenderer.invoke('app:request-microphone-permission'),
  transcribeAudio: (payload) => ipcRenderer.invoke('speech:transcribe', payload)
});
