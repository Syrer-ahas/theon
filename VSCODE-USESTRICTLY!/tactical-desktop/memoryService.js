// ============================================================================
// Sparx AI Workstation — Persistent Memory & Personalization Service
// Safe cross-session preference storage, operator controls, & credential filtering
// ============================================================================

const fs = require('fs');
const path = require('path');

let electronApp = null;
try {
  const electron = require('electron');
  electronApp = electron.app;
} catch (e) {}

// Sensitive patterns that must NEVER be saved to persistent memory
const SENSITIVE_PATTERNS = [
  /gsk_[a-zA-Z0-9]{30,}/i,
  /AIza[0-9A-Za-z-_]{30,}/i,
  /sk-[a-zA-Z0-9]{30,}/i,
  /ghp_[a-zA-Z0-9]{30,}/i,
  /gho_[a-zA-Z0-9]{30,}/i,
  /xox[baprs]-[0-9a-zA-Z]{10,}/i,
  /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
  /password\s*[:=]\s*[^\s]+/i,
  /secret\s*[:=]\s*[^\s]+/i,
  /api[_-]?key\s*[:=]\s*[^\s]+/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/i
];

function getMemoryFilePath() {
  if (electronApp) {
    try {
      return path.join(electronApp.getPath('userData'), 'sparx-memory.json');
    } catch (e) {}
  }
  return path.join(process.cwd(), 'sparx-memory.json');
}

function loadMemoryState() {
  try {
    const p = getMemoryFilePath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          enabled: parsed.enabled !== false,
          memories: Array.isArray(parsed.memories) ? parsed.memories : []
        };
      }
    }
  } catch (err) {
    console.warn('[MemoryService] Error loading memory state:', err.message);
  }
  return {
    enabled: true,
    memories: []
  };
}

function saveMemoryState(state) {
  try {
    const p = getMemoryFilePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[MemoryService] Error saving memory state:', err.message);
    return false;
  }
}

function isSensitive(text) {
  if (!text || typeof text !== 'string') return false;
  return SENSITIVE_PATTERNS.some(regex => regex.test(text));
}

function getMemories() {
  return loadMemoryState();
}

function setMemoryEnabled(enabled) {
  const state = loadMemoryState();
  state.enabled = !!enabled;
  saveMemoryState(state);
  return state;
}

function addMemory(text, category = 'preference') {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Memory text is required' };
  }

  const clean = text.trim();
  if (clean.length < 3) {
    return { success: false, error: 'Memory text too short' };
  }
  if (clean.length > 500) {
    return { success: false, error: 'Memory text too long (max 500 characters)' };
  }

  // Check for secrets / credentials
  if (isSensitive(clean)) {
    return {
      success: false,
      error: 'Cannot save memory containing credentials, keys, or sensitive secrets.'
    };
  }

  const state = loadMemoryState();
  // Deduplicate
  const existing = state.memories.find(m => m.text.toLowerCase() === clean.toLowerCase());
  if (existing) {
    return { success: true, memory: existing, duplicate: true };
  }

  const newEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: clean,
    category,
    createdAt: new Date().toISOString()
  };

  state.memories.push(newEntry);
  saveMemoryState(state);
  return { success: true, memory: newEntry };
}

function deleteMemory(id) {
  const state = loadMemoryState();
  const initialLen = state.memories.length;
  state.memories = state.memories.filter(m => m.id !== id);
  if (state.memories.length !== initialLen) {
    saveMemoryState(state);
    return { success: true };
  }
  return { success: false, error: 'Memory entry not found' };
}

function clearMemories() {
  const state = loadMemoryState();
  state.memories = [];
  saveMemoryState(state);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Explicit Preference Extraction from User Message
// Detects statements like "Remember that I prefer TypeScript", "I always use tabs"
// ----------------------------------------------------------------------------
const EXPLICIT_PREF_PATTERNS = [
  /^(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i,
  /^(?:keep\s+in\s+mind|note\s+that)\s+(?:that\s+)?(.+)$/i,
  /^(?:from\s+now\s+on\s*,?\s*)(.+)$/i,
  /^(?:my\s+preferred\s+(?:language|stack|framework|style|indentation)\s+is\s+)(.+)$/i,
  /^(?:i\s+(?:always|prefer to)\s+(?:use|write|format)\s+)(.+)$/i
];

function detectUserPreference(userText) {
  if (!userText || typeof userText !== 'string') return null;
  const trimmed = userText.trim().replace(/^["'`]+|["'`]+$/g, '');

  for (const regex of EXPLICIT_PREF_PATTERNS) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      let pref = match[1].trim();
      // Clean trailing punctuation
      pref = pref.replace(/[\.\?!]+$/, '');
      if (pref.length >= 4 && !isSensitive(pref)) {
        return pref;
      }
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Prompt Block Generator
// Formats saved preferences for injection into the model's system prompt
// ----------------------------------------------------------------------------
function getSystemPromptMemoryBlock() {
  const state = loadMemoryState();
  if (!state.enabled || !state.memories || state.memories.length === 0) {
    return '';
  }

  const lines = state.memories.map(m => `- ${m.text}`);
  return `\n\n[SAVED OPERATOR PREFERENCES & PERSISTENT MEMORY]:\n${lines.join('\n')}\n(Apply these saved operator preferences naturally in your code, formatting, and responses across conversations.)`;
}

// ----------------------------------------------------------------------------
// IPC Handler Registration
// ----------------------------------------------------------------------------
function registerMemoryHandlers(ipcMain, getMainWindow) {
  ipcMain.handle('memory:get', () => {
    return getMemories();
  });

  ipcMain.handle('memory:toggle', (_e, enabled) => {
    const state = setMemoryEnabled(enabled);
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('memory:updated', state);
    }
    return state;
  });

  ipcMain.handle('memory:add', (_e, { text, category }) => {
    const res = addMemory(text, category);
    const win = getMainWindow ? getMainWindow() : null;
    if (res.success && win && !win.isDestroyed()) {
      win.webContents.send('memory:updated', loadMemoryState());
    }
    return res;
  });

  ipcMain.handle('memory:delete', (_e, id) => {
    const res = deleteMemory(id);
    const win = getMainWindow ? getMainWindow() : null;
    if (res.success && win && !win.isDestroyed()) {
      win.webContents.send('memory:updated', loadMemoryState());
    }
    return res;
  });

  ipcMain.handle('memory:clear', () => {
    const res = clearMemories();
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('memory:updated', loadMemoryState());
    }
    return res;
  });
}

module.exports = {
  getMemoryFilePath,
  loadMemoryState,
  saveMemoryState,
  getMemories,
  setMemoryEnabled,
  addMemory,
  deleteMemory,
  clearMemories,
  detectUserPreference,
  getSystemPromptMemoryBlock,
  registerMemoryHandlers,
  isSensitive
};
