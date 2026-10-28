// ============================================================================
// Sparx AI Workstation — Full IDE Service
// Workspace File Tree, Monaco File Operations, Git Control, & Interactive PTY
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const Diff = require('diff');

let electronApp = null;
try {
  electronApp = require('electron').app;
} catch (e) {}

let pty = null;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('[IDEService] node-pty optional load failed:', e.message);
}

// ----------------------------------------------------------------------------
// Active State
// ----------------------------------------------------------------------------
let currentWorkspaceDir = path.resolve(__dirname, '..');
const activeTerminals = new Map();
let terminalCounter = 0;
let mainWindowGetter = null;

function setMainWindowGetter(fn) {
  mainWindowGetter = fn;
}

function notifyWorkspaceChanged() {
  if (mainWindowGetter) {
    try {
      const win = mainWindowGetter();
      if (win && !win.isDestroyed()) {
        win.webContents.send('ide:workspace-changed');
      }
    } catch (e) {}
  }
}

function setCurrentWorkspace(dir) {
  if (dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    currentWorkspaceDir = path.resolve(dir);
  } else if (dir === null || dir === '') {
    currentWorkspaceDir = null;
  }
}

function getCurrentWorkspace() {
  return currentWorkspaceDir;
}

function getStandardPcPath(locKey) {
  const norm = String(locKey || '').trim().toLowerCase();
  let resolved = null;
  if (electronApp && typeof electronApp.getPath === 'function') {
    try {
      if (norm === 'desktop') resolved = electronApp.getPath('desktop');
      else if (norm === 'documents' || norm === 'document' || norm === 'docs') resolved = electronApp.getPath('documents');
      else if (norm === 'downloads' || norm === 'download') resolved = electronApp.getPath('downloads');
      else if (norm === 'home' || norm === 'user' || norm === 'pc') resolved = electronApp.getPath('home');
    } catch (e) {
      console.warn('[IDEService] electron app.getPath failed for', norm, e.message);
    }
  }

  if (!resolved) {
    const home = os.homedir();
    if (norm === 'desktop') resolved = path.join(home, 'Desktop');
    else if (norm === 'documents' || norm === 'document' || norm === 'docs') resolved = path.join(home, 'Documents');
    else if (norm === 'downloads' || norm === 'download') resolved = path.join(home, 'Downloads');
    else if (norm === 'home' || norm === 'user' || norm === 'pc') resolved = home;
  }

  return resolved;
}

function checkForbiddenRoot(p) {
  const forbiddenRoots = [
    'c:\\', 'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
    'c:\\programdata', 'c:\\system volume information',
    '/bin', '/sbin', '/etc', '/sys', '/proc', '/dev', '/usr', '/root'
  ];
  const norm = path.resolve(p).toLowerCase();
  for (const f of forbiddenRoots) {
    if (norm === f || norm === f.replace(/\\/g, '/')) {
      return { error: `Security violation: Modifying critical system directory "${p}" is blocked.` };
    }
  }
  return { allowed: true };
}

function resolveSafeTarget(requestedPath, locationKey = 'workspace') {
  const clean = String(requestedPath || '').replace(/^['"`]|['"`]$/g, '').trim();
  if (!clean) {
    return { error: 'Path argument is required and cannot be empty.' };
  }

  const rawLoc = String(locationKey || 'workspace').trim();
  const loc = rawLoc.toLowerCase();
  let baseDir = null;
  let locType = loc;

  // Case 1: requestedPath is already an absolute path
  if (path.isAbsolute(clean)) {
    const resolvedDirect = path.resolve(clean);
    const forbidden = checkForbiddenRoot(resolvedDirect);
    if (forbidden.error) return forbidden;

    const home = os.homedir();
    const ws = getCurrentWorkspace();
    const isInsideHome = !path.relative(home, resolvedDirect).startsWith('..');
    const isInsideWs = ws ? !path.relative(ws, resolvedDirect).startsWith('..') : false;

    if (!isInsideHome && !isInsideWs) {
      return {
        error: `Path traversal rejected: "${clean}" is outside permissible user directory boundaries.`
      };
    }

    return {
      fullPath: resolvedDirect,
      relativePath: path.basename(resolvedDirect),
      baseDir: path.dirname(resolvedDirect),
      locationType: isInsideWs ? 'workspace' : 'custom',
      displayPath: resolvedDirect
    };
  }

  // Case 2: locationKey is an absolute directory path
  if (path.isAbsolute(rawLoc)) {
    const resolvedBase = path.resolve(rawLoc);
    const forbidden = checkForbiddenRoot(resolvedBase);
    if (forbidden.error) return forbidden;

    baseDir = resolvedBase;
    locType = 'custom';
  } else if (loc === 'workspace' || loc === 'project' || loc === 'repo') {
    const ws = getCurrentWorkspace();
    if (!ws || typeof ws !== 'string' || !fs.existsSync(ws)) {
      return {
        error: 'No workspace is currently open. Please open or choose a workspace folder first (File > Open Folder), or specify a PC location (e.g. Desktop, Documents, Downloads).'
      };
    }
    baseDir = path.resolve(ws);
    locType = 'workspace';
  } else if (['desktop', 'documents', 'docs', 'downloads', 'download', 'home', 'user', 'pc'].includes(loc)) {
    baseDir = getStandardPcPath(loc);
    if (!baseDir || !fs.existsSync(baseDir)) {
      return {
        error: `PC location "${loc}" is unavailable or cannot be accessed on this machine. PC-wide filesystem access for that location is not available.`
      };
    }
    locType = (loc === 'docs') ? 'documents' : (['home', 'user', 'pc'].includes(loc) ? 'pc' : (loc === 'download' ? 'downloads' : loc));
  } else {
    // Custom subfolder name (e.g. "TWIZZY")
    // Check if it exists in Desktop, Downloads, Documents, or Workspace
    const deskCandidate = path.join(getStandardPcPath('desktop'), rawLoc);
    const downCandidate = path.join(getStandardPcPath('downloads'), rawLoc);
    const docsCandidate = path.join(getStandardPcPath('documents'), rawLoc);
    const ws = getCurrentWorkspace();
    const wsCandidate = ws ? path.join(ws, rawLoc) : null;

    if (fs.existsSync(deskCandidate) && fs.statSync(deskCandidate).isDirectory()) {
      baseDir = deskCandidate;
      locType = 'desktop';
    } else if (fs.existsSync(downCandidate) && fs.statSync(downCandidate).isDirectory()) {
      baseDir = downCandidate;
      locType = 'downloads';
    } else if (fs.existsSync(docsCandidate) && fs.statSync(docsCandidate).isDirectory()) {
      baseDir = docsCandidate;
      locType = 'documents';
    } else if (wsCandidate && fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isDirectory()) {
      baseDir = wsCandidate;
      locType = 'workspace';
    } else if (ws && fs.existsSync(ws)) {
      baseDir = path.resolve(ws, rawLoc);
      locType = 'workspace';
    } else {
      return {
        error: `Parent folder "${rawLoc}" could not be located. Please specify its full path or location (e.g. Desktop, Documents, Downloads, or active workspace).`
      };
    }
  }

  const resolved = path.resolve(baseDir, clean);

  // Safety checks
  const forbidden = checkForbiddenRoot(resolved);
  if (forbidden.error) return forbidden;

  // Traversal checks
  const relFromBase = path.relative(baseDir, resolved);
  if (relFromBase.startsWith('..') || path.isAbsolute(relFromBase)) {
    return {
      error: `Path traversal rejected: "${clean}" escapes the target ${locType} location ("${baseDir}").`
    };
  }

  const displayRel = path.relative(baseDir, resolved).replace(/\\/g, '/');

  return {
    fullPath: resolved,
    relativePath: displayRel || '.',
    baseDir,
    locationType: locType,
    displayPath: resolved
  };
}

function resolveSafeWorkspacePath(ws, requestedPath) {
  if (ws && (!currentWorkspaceDir || path.resolve(ws) !== currentWorkspaceDir)) {
    setCurrentWorkspace(ws);
  }
  return resolveSafeTarget(requestedPath, 'workspace');
}

// ----------------------------------------------------------------------------
// Focused PC Folder & File Locator
// Searches sensible PC locations (Desktop, Documents, Downloads, Home, Workspace)
// Does NOT scan the entire drive.
// ----------------------------------------------------------------------------
function locateFolder(folderName, preferredLocation = null) {
  const clean = String(folderName || '').replace(/^['"`]+|['"`]+$/g, '').trim();
  if (!clean) return { success: false, found: false, error: 'Folder name is required.' };

  // 1. Direct absolute path check
  if (path.isAbsolute(clean)) {
    if (fs.existsSync(clean) && fs.statSync(clean).isDirectory()) {
      return { success: true, found: true, path: path.resolve(clean), locationType: 'custom' };
    }
    return { success: false, found: false, error: `Directory not found at path "${clean}".` };
  }

  // 2. Preferred location check (e.g. established from prior conversation)
  if (preferredLocation) {
    let prefDir = null;
    if (path.isAbsolute(preferredLocation)) {
      prefDir = preferredLocation;
    } else {
      prefDir = getStandardPcPath(preferredLocation);
    }
    if (prefDir && fs.existsSync(prefDir)) {
      const candidate = path.join(prefDir, clean);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return {
          success: true,
          found: true,
          path: path.resolve(candidate),
          locationType: path.isAbsolute(preferredLocation) ? 'custom' : preferredLocation
        };
      }
      if (path.basename(prefDir).toLowerCase() === clean.toLowerCase() && fs.statSync(prefDir).isDirectory()) {
        return {
          success: true,
          found: true,
          path: path.resolve(prefDir),
          locationType: 'custom'
        };
      }
    }
  }

  // 3. Sensible PC Locations (Desktop, Downloads, Documents, Home, Workspace)
  const sensible = [
    { loc: 'desktop', dir: getStandardPcPath('desktop') },
    { loc: 'downloads', dir: getStandardPcPath('downloads') },
    { loc: 'documents', dir: getStandardPcPath('documents') },
    { loc: 'home', dir: getStandardPcPath('home') }
  ];
  const ws = getCurrentWorkspace();
  if (ws && fs.existsSync(ws)) {
    sensible.push({ loc: 'workspace', dir: ws });
  }

  // Check top level of each sensible location
  for (const s of sensible) {
    if (!s.dir || !fs.existsSync(s.dir)) continue;
    const cand = path.join(s.dir, clean);
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return {
        success: true,
        found: true,
        path: path.resolve(cand),
        locationType: s.loc
      };
    }
  }

  // 4. Check 1-level deep in Desktop, Downloads, Documents (focused lookup only, no deep scan)
  for (const s of sensible.slice(0, 3)) {
    if (!s.dir || !fs.existsSync(s.dir)) continue;
    try {
      const entries = fs.readdirSync(s.dir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
        const subCand = path.join(s.dir, ent.name, clean);
        if (fs.existsSync(subCand) && fs.statSync(subCand).isDirectory()) {
          return {
            success: true,
            found: true,
            path: path.resolve(subCand),
            locationType: s.loc,
            parentSubfolder: ent.name
          };
        }
      }
    } catch (e) {}
  }

  return {
    success: true,
    found: false,
    searchedLocations: ['Desktop', 'Downloads', 'Documents', 'Home', ws ? 'Workspace' : null].filter(Boolean),
    error: `Folder "${clean}" could not be found in sensible PC locations (Desktop, Documents, Downloads, Home) or active workspace.`
  };
}

function findFilesInFolder(folderPath, location = null, pattern = null) {
  let targetDir = null;
  if (path.isAbsolute(folderPath)) {
    targetDir = folderPath;
  } else {
    const locRes = locateFolder(folderPath, location);
    if (!locRes.found) {
      return { success: false, error: locRes.error || `Folder "${folderPath}" not found.` };
    }
    targetDir = locRes.path;
  }

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return { success: false, error: `Directory "${targetDir}" not found on disk.` };
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const matches = [];
    const allFiles = [];

    const normPattern = pattern ? pattern.toLowerCase().trim() : null;

    for (const ent of entries) {
      if (ent.isDirectory() || ent.name.startsWith('.')) continue;
      const fullPath = path.join(targetDir, ent.name);
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }

      const fileInfo = {
        name: ent.name,
        path: fullPath,
        fullPath,
        sizeBytes: stat.size,
        extension: path.extname(ent.name).toLowerCase()
      };
      allFiles.push(fileInfo);

      let matched = false;
      if (!normPattern || normPattern === '*' || normPattern === '*.*') {
        matched = true;
      } else if (normPattern === '.txt' || normPattern === 'txt' || normPattern === '*.txt' || normPattern === 'text') {
        matched = fileInfo.extension === '.txt';
      } else if (normPattern.startsWith('.')) {
        matched = fileInfo.extension === normPattern;
      } else if (normPattern.startsWith('*.')) {
        matched = fileInfo.extension === normPattern.slice(1);
      } else {
        matched = ent.name.toLowerCase() === normPattern || ent.name.toLowerCase().includes(normPattern);
      }

      if (matched) {
        matches.push(fileInfo);
      }
    }

    return {
      success: true,
      folderPath: targetDir,
      totalFilesInFolder: allFiles.length,
      allFiles: allFiles.map(f => f.name),
      totalMatches: matches.length,
      matches
    };
  } catch (err) {
    return { success: false, error: `Failed to inspect directory "${targetDir}": ${err.message}` };
  }
}

// ----------------------------------------------------------------------------
// File Tree Crawler
// ----------------------------------------------------------------------------
const IGNORE_PATTERNS = new Set([
  '.git', 'node_modules', 'dist', '.cache', '.vscode', '.idea',
  'build', 'out', '.DS_Store', 'Thumbs.db', 'package-lock.json'
]);

function buildDirectoryTree(dirPath, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) return null;

  const name = path.basename(dirPath) || dirPath;
  const tree = {
    name,
    path: dirPath,
    relativePath: path.relative(currentWorkspaceDir, dirPath) || '.',
    isDirectory: true,
    children: []
  };

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    // Sort: directories first, then files alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    for (const ent of entries) {
      if (IGNORE_PATTERNS.has(ent.name) || ent.name.startsWith('.system_generated')) continue;
      const full = path.join(dirPath, ent.name);

      if (ent.isDirectory()) {
        const sub = buildDirectoryTree(full, maxDepth, currentDepth + 1);
        if (sub) tree.children.push(sub);
      } else {
        const ext = path.extname(ent.name).toLowerCase();
        let size = 0;
        try { size = fs.statSync(full).size; } catch (e) {}
        tree.children.push({
          name: ent.name,
          path: full,
          relativePath: path.relative(currentWorkspaceDir, full),
          isDirectory: false,
          extension: ext,
          size
        });
      }
    }
  } catch (err) {
    console.warn('[IDEService] Error reading dir:', dirPath, err.message);
  }

  return tree;
}

// ----------------------------------------------------------------------------
// Git Integration
// ----------------------------------------------------------------------------
function getGitInfo(repoDir = currentWorkspaceDir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: repoDir, stdio: 'ignore' });
  } catch (e) {
    return { isRepo: false, branch: '', files: [], clean: true };
  }

  let branch = 'main';
  try {
    branch = execSync('git branch --show-current', { cwd: repoDir, encoding: 'utf8' }).trim() || 'detached';
  } catch (e) {}

  const files = [];
  try {
    const statusOut = execSync('git status --porcelain', { cwd: repoDir, encoding: 'utf8' });
    const lines = statusOut.split(/\r?\n/).filter(l => l.trim().length > 0);
    for (const line of lines) {
      const x = line[0];
      const y = line[1];
      const filePath = line.substring(3).trim();
      let status = 'modified';
      if (x === '?' && y === '?') status = 'untracked';
      else if (x === 'A' || y === 'A') status = 'added';
      else if (x === 'D' || y === 'D') status = 'deleted';
      else if (x === 'R' || y === 'R') status = 'renamed';
      files.push({
        status,
        path: filePath,
        fullPath: path.resolve(repoDir, filePath),
        staged: x !== ' ' && x !== '?'
      });
    }
  } catch (e) {}

  return {
    isRepo: true,
    branch,
    files,
    clean: files.length === 0
  };
}

function getGitDiff(filePath, repoDir = currentWorkspaceDir) {
  try {
    if (filePath) {
      return execSync(`git diff HEAD -- "${filePath}"`, { cwd: repoDir, encoding: 'utf8' });
    }
    return execSync('git diff HEAD', { cwd: repoDir, encoding: 'utf8' });
  } catch (e) {
    try {
      return execSync(`git diff -- "${filePath}"`, { cwd: repoDir, encoding: 'utf8' });
    } catch (err) {
      return '';
    }
  }
}

function commitGit(message, repoDir = currentWorkspaceDir) {
  try {
    execSync('git add -A', { cwd: repoDir, stdio: 'pipe' });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoDir, encoding: 'utf8' });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------------------------
// IPC Registration
// ----------------------------------------------------------------------------
function registerIdeHandlers(ipcMain, dialog, getMainWindow) {
  setMainWindowGetter(getMainWindow);

  ipcMain.handle('ide:close-workspace', () => {
    setCurrentWorkspace(null);
    notifyWorkspaceChanged();
    return { success: true };
  });

  // 1. Workspace Folder Selection
  ipcMain.handle('ide:select-folder', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Open Workspace Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    const chosen = result.filePaths[0];
    setCurrentWorkspace(chosen);
    const tree = buildDirectoryTree(chosen);
    const git = getGitInfo(chosen);

    return {
      canceled: false,
      folderPath: chosen,
      folderName: path.basename(chosen),
      tree,
      git
    };
  });

  ipcMain.handle('ide:get-workspace-tree', () => {
    return {
      folderPath: currentWorkspaceDir,
      folderName: path.basename(currentWorkspaceDir),
      tree: buildDirectoryTree(currentWorkspaceDir),
      git: getGitInfo(currentWorkspaceDir)
    };
  });

  // 2. File Reading & Writing
  ipcMain.handle('ide:read-file', (_event, filePath) => {
    try {
      const full = path.isAbsolute(filePath) ? filePath : path.resolve(currentWorkspaceDir, filePath);
      if (!fs.existsSync(full)) {
        return { success: false, error: 'File does not exist: ' + filePath };
      }
      const stat = fs.statSync(full);
      if (stat.size > 10 * 1024 * 1024) {
        return { success: false, error: 'File is too large to open in editor (>10MB)' };
      }
      const content = fs.readFileSync(full, 'utf8');
      const ext = path.extname(full).toLowerCase();
      return {
        success: true,
        path: full,
        relativePath: path.relative(currentWorkspaceDir, full),
        name: path.basename(full),
        content,
        extension: ext,
        size: stat.size,
        mtime: stat.mtimeMs
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ide:save-file', (_event, filePath, content) => {
    try {
      const full = path.isAbsolute(filePath) ? filePath : path.resolve(currentWorkspaceDir, filePath);
      const dir = path.dirname(full);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      const stat = fs.statSync(full);
      return {
        success: true,
        path: full,
        mtime: stat.mtimeMs,
        size: stat.size
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ide:create-file', (_event, filePath) => {
    try {
      const full = path.isAbsolute(filePath) ? filePath : path.resolve(currentWorkspaceDir, filePath);
      const dir = path.dirname(full);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(full)) fs.writeFileSync(full, '', 'utf8');
      return { success: true, path: full };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ide:create-folder', (_event, folderPath) => {
    try {
      const full = path.isAbsolute(folderPath) ? folderPath : path.resolve(currentWorkspaceDir, folderPath);
      if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
      return { success: true, path: full };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ide:delete-item', (_event, itemPath) => {
    try {
      const full = path.isAbsolute(itemPath) ? itemPath : path.resolve(currentWorkspaceDir, itemPath);
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 3. Git Operations
  ipcMain.handle('ide:git-status', () => {
    return getGitInfo(currentWorkspaceDir);
  });

  ipcMain.handle('ide:git-diff', (_event, filePath) => {
    return getGitDiff(filePath, currentWorkspaceDir);
  });

  ipcMain.handle('ide:git-commit', (_event, message) => {
    return commitGit(message, currentWorkspaceDir);
  });

  // 4. Inline Diff Calculation
  ipcMain.handle('ide:generate-diff', (_event, oldText, newText, filename = 'file') => {
    try {
      const patch = Diff.createPatch(filename, oldText || '', newText || '');
      const parsed = Diff.parsePatch(patch);
      return { success: true, patch, parsed };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Workspace File Listing (for Ctrl+P Quick Switcher)
  ipcMain.handle('ide:list-files', () => {
    try {
      const ws = currentWorkspaceDir;
      if (!ws || !fs.existsSync(ws)) return { success: false, files: [] };
      const files = [];

      function walk(dir, depth = 0) {
        if (depth > 8 || files.length >= 2000) return;
        let list = [];
        try {
          list = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) { return; }

        for (const item of list) {
          if (IGNORE_PATTERNS.has(item.name) || item.name.startsWith('.git') || item.name.startsWith('.system_generated')) continue;
          const sub = path.join(dir, item.name);
          const rel = path.relative(ws, sub).replace(/\\/g, '/');

          if (item.isDirectory()) {
            walk(sub, depth + 1);
          } else {
            files.push({
              name: item.name,
              relativePath: rel,
              fullPath: sub,
              ext: path.extname(item.name).toLowerCase()
            });
          }
        }
      }

      walk(ws, 0);
      return { success: true, files };
    } catch (e) {
      return { success: false, error: e.message, files: [] };
    }
  });

  // Global Workspace Full-Text Search (for Ctrl+Shift+F)
  ipcMain.handle('ide:global-search', (_event, options = {}) => {
    try {
      const ws = currentWorkspaceDir;
      if (!ws || !fs.existsSync(ws)) return { success: false, results: [], totalMatches: 0 };
      const query = String(options.query || '').trim();
      if (!query) return { success: true, results: [], totalMatches: 0 };

      const isCaseSensitive = !!options.caseSensitive;
      const isRegex = !!options.regex;
      const isWholeWord = !!options.wholeWord;

      let matcher = null;
      if (isRegex) {
        try {
          let flags = isCaseSensitive ? 'g' : 'gi';
          matcher = new RegExp(query, flags);
        } catch (reErr) {
          return { success: false, error: 'Invalid Regular Expression: ' + reErr.message, results: [], totalMatches: 0 };
        }
      } else if (isWholeWord) {
        let flags = isCaseSensitive ? 'g' : 'gi';
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matcher = new RegExp(`\\b${escaped}\\b`, flags);
      }

      const queryForSearch = isCaseSensitive ? query : query.toLowerCase();
      const resultsByFile = new Map();
      let totalMatches = 0;

      function walk(dir, depth = 0) {
        if (depth > 8 || totalMatches >= 500) return;
        let list = [];
        try {
          list = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) { return; }

        for (const item of list) {
          if (IGNORE_PATTERNS.has(item.name) || item.name.startsWith('.git') || item.name.startsWith('.system_generated')) continue;
          const sub = path.join(dir, item.name);
          const rel = path.relative(ws, sub).replace(/\\/g, '/');

          if (item.isDirectory()) {
            walk(sub, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (!SEARCH_EXTENSIONS.has(ext)) continue;

            try {
              const stat = fs.statSync(sub);
              if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

              const text = fs.readFileSync(sub, 'utf8');
              const lines = text.split(/\r?\n/);

              for (let i = 0; i < lines.length; i++) {
                const lineText = lines[i];
                let isMatch = false;

                if (matcher) {
                  matcher.lastIndex = 0;
                  isMatch = matcher.test(lineText);
                } else {
                  isMatch = isCaseSensitive ? lineText.includes(queryForSearch) : lineText.toLowerCase().includes(queryForSearch);
                }

                if (isMatch) {
                  totalMatches++;
                  if (!resultsByFile.has(rel)) {
                    resultsByFile.set(rel, {
                      file: rel,
                      name: item.name,
                      fullPath: sub,
                      matches: []
                    });
                  }
                  resultsByFile.get(rel).matches.push({
                    line: i + 1,
                    text: lineText.trim()
                  });

                  if (totalMatches >= 500) break;
                }
              }
            } catch (e) {}
          }
        }
      }

      walk(ws, 0);
      const results = Array.from(resultsByFile.values());
      return { success: true, results, totalMatches };
    } catch (e) {
      return { success: false, error: e.message, results: [], totalMatches: 0 };
    }
  });

  // 5. Interactive PTY Terminal
  ipcMain.handle('ide:terminal-spawn', (_event, options = {}) => {
    const termId = `term_${++terminalCounter}`;
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const cwd = options.cwd || currentWorkspaceDir;

    if (!pty) {
      return { success: false, error: 'node-pty module is not available on this platform' };
    }

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });

      const win = getMainWindow();
      ptyProcess.onData((data) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(`terminal:data:${termId}`, data);
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(`terminal:exit:${termId}`, { exitCode, signal });
        }
        activeTerminals.delete(termId);
      });

      activeTerminals.set(termId, ptyProcess);
      return { success: true, termId, shell, cwd };
    } catch (err) {
      console.error('[Terminal PTY Spawn Error]:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('ide:terminal-write', (_event, termId, data) => {
    const proc = activeTerminals.get(termId);
    if (proc) {
      try { proc.write(data); } catch (e) {}
    }
  });

  ipcMain.on('ide:terminal-resize', (_event, termId, cols, rows) => {
    const proc = activeTerminals.get(termId);
    if (proc) {
      try { proc.resize(Math.max(10, cols), Math.max(5, rows)); } catch (e) {}
    }
  });

  ipcMain.on('ide:terminal-kill', (_event, termId) => {
    const proc = activeTerminals.get(termId);
    if (proc) {
      try { proc.kill(); } catch (e) {}
      activeTerminals.delete(termId);
    }
  });
}

function fuzzyReplace(content, target, replacement) {
  if (content.includes(target)) {
    const idx = content.indexOf(target);
    const lineNum = content.slice(0, idx).split(/\r?\n/).length;
    return {
      success: true,
      newContent: content.replace(target, replacement),
      startLine: lineNum,
      targetLines: target.split(/\r?\n/).length,
      replacementLines: replacement.split(/\r?\n/).length
    };
  }

  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget = target.replace(/\r\n/g, '\n');
  const normReplacement = replacement.replace(/\r\n/g, '\n');

  if (normContent.includes(normTarget)) {
    const idx = normContent.indexOf(normTarget);
    const lineNum = normContent.slice(0, idx).split('\n').length;
    const replaced = normContent.replace(normTarget, normReplacement);
    const finalContent = content.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
    return {
      success: true,
      newContent: finalContent,
      startLine: lineNum,
      targetLines: normTarget.split('\n').length,
      replacementLines: normReplacement.split('\n').length
    };
  }

  const fileLines = normContent.split('\n');
  const targetLines = normTarget.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (targetLines.length === 0) {
    return { success: false, error: 'Target replacement block is empty.' };
  }

  for (let i = 0; i <= fileLines.length - targetLines.length; i++) {
    let match = true;
    for (let j = 0; j < targetLines.length; j++) {
      if (fileLines[i + j].trim() !== targetLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      const repLines = normReplacement.split('\n');
      const newLines = [
        ...fileLines.slice(0, i),
        ...repLines,
        ...fileLines.slice(i + targetLines.length)
      ];
      let replaced = newLines.join('\n');
      if (content.includes('\r\n')) {
        replaced = replaced.replace(/\n/g, '\r\n');
      }
      return {
        success: true,
        newContent: replaced,
        startLine: i + 1,
        targetLines: targetLines.length,
        replacementLines: repLines.length
      };
    }
  }

  return { success: false, error: 'Target block not found in file. Check indentation and whitespace.' };
}

const SEARCH_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.html', '.css',
  '.md', '.txt', '.py', '.rs', '.go', '.c', '.cpp', '.h', '.hpp',
  '.sh', '.ps1', '.bat', '.cmd', '.yaml', '.yml', '.lua', '.luau',
  '.toml', '.ini', '.cfg', '.xml', '.sql'
]);

function executeBackendAgentTool(toolName, toolArgs = {}) {
  const ws = getCurrentWorkspace();
  switch (toolName) {
    case 'create_directory':
    case 'create_folder': {
      const targetPath = toolArgs.path || toolArgs.dirPath || toolArgs.folderName || toolArgs.name;
      const location = toolArgs.location || 'workspace';
      const safe = resolveSafeTarget(targetPath, location);
      if (safe.error) return { success: false, operation: 'create_directory', error: safe.error };

      try {
        if (fs.existsSync(safe.fullPath)) {
          const stat = fs.statSync(safe.fullPath);
          if (stat.isDirectory()) {
            return {
              success: true,
              alreadyExisted: true,
              operation: 'create_directory',
              location: safe.locationType,
              path: safe.fullPath,
              relativePath: safe.relativePath,
              verifiedOnDisk: true,
              message: `Directory "${safe.fullPath}" already exists on ${safe.locationType}.`
            };
          } else {
            return {
              success: false,
              operation: 'create_directory',
              location: safe.locationType,
              error: `A file with name "${safe.fullPath}" already exists on ${safe.locationType}.`
            };
          }
        }

        // Real filesystem creation
        fs.mkdirSync(safe.fullPath, { recursive: true });

        // Verification step: verify item exists at the expected path on disk
        if (!fs.existsSync(safe.fullPath) || !fs.statSync(safe.fullPath).isDirectory()) {
          return {
            success: false,
            operation: 'create_directory',
            location: safe.locationType,
            error: `Verification failed: Directory "${safe.fullPath}" was not found on disk after creation.`
          };
        }

        if (safe.locationType === 'workspace') {
          notifyWorkspaceChanged();
        }

        return {
          success: true,
          operation: 'create_directory',
          location: safe.locationType,
          path: safe.fullPath,
          relativePath: safe.relativePath,
          verifiedOnDisk: true,
          message: `Successfully created directory "${safe.fullPath}" on ${safe.locationType}.`
        };
      } catch (err) {
        return {
          success: false,
          operation: 'create_directory',
          location: safe.locationType,
          path: safe.fullPath || targetPath,
          error: `Failed to create directory "${targetPath}": ${err.message}`
        };
      }
    }

    case 'create_file': {
      const targetPath = toolArgs.path || toolArgs.filePath || toolArgs.name;
      const location = toolArgs.location || 'workspace';
      const safe = resolveSafeTarget(targetPath, location);
      if (safe.error) return { success: false, operation: 'create_file', error: safe.error };

      const content = String(toolArgs.content !== undefined ? toolArgs.content : '');

      if (fs.existsSync(safe.fullPath) && !toolArgs.overwrite) {
        return {
          success: false,
          operation: 'create_file',
          location: safe.locationType,
          path: safe.fullPath,
          error: `File "${safe.fullPath}" already exists. Confirm before overwriting existing files, or pass overwrite=true.`
        };
      }

      try {
        const parentDir = path.dirname(safe.fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        // Real filesystem write
        fs.writeFileSync(safe.fullPath, content, 'utf8');

        // Verification step: verify existence on disk AND verify contents too
        if (!fs.existsSync(safe.fullPath)) {
          return {
            success: false,
            operation: 'create_file',
            location: safe.locationType,
            path: safe.fullPath,
            error: `Verification failed: File "${safe.fullPath}" was not found on disk after creation.`
          };
        }

        const readBack = fs.readFileSync(safe.fullPath, 'utf8');
        if (readBack !== content) {
          return {
            success: false,
            operation: 'create_file',
            location: safe.locationType,
            path: safe.fullPath,
            error: `Verification failed: Content on disk did not match requested content for "${safe.fullPath}".`
          };
        }

        const stat = fs.statSync(safe.fullPath);
        if (safe.locationType === 'workspace') {
          notifyWorkspaceChanged();
        }

        return {
          success: true,
          operation: 'create_file',
          location: safe.locationType,
          path: safe.fullPath,
          relativePath: safe.relativePath,
          sizeBytes: stat.size,
          verifiedOnDisk: true,
          verifiedContent: true,
          message: `Successfully created file "${safe.fullPath}" (${stat.size} bytes) on ${safe.locationType}.`
        };
      } catch (err) {
        return {
          success: false,
          operation: 'create_file',
          location: safe.locationType,
          path: safe.fullPath || targetPath,
          error: `Failed to create file "${targetPath}": ${err.message}`
        };
      }
    }

    case 'locate_folder':
    case 'find_folder': {
      const folderName = toolArgs.folderName || toolArgs.name || toolArgs.folder || toolArgs.path;
      if (!folderName) {
        return { success: false, error: 'folderName argument is required.' };
      }
      return locateFolder(folderName, toolArgs.location);
    }

    case 'find_files': {
      const folder = toolArgs.folderPath || toolArgs.folder || toolArgs.path || '.';
      const location = toolArgs.location || null;
      const pattern = toolArgs.pattern || toolArgs.extension || toolArgs.ext;
      return findFilesInFolder(folder, location, pattern);
    }

    case 'read_file': {
      const targetPath = toolArgs.path || toolArgs.filePath || toolArgs.file;
      let location = toolArgs.location || 'workspace';
      let safe = resolveSafeTarget(targetPath, location);
      if ((safe.error || !fs.existsSync(safe.fullPath)) && !path.isAbsolute(targetPath) && (location === 'workspace' || !toolArgs.location)) {
        const parts = targetPath.split(/[/\\]/);
        if (parts.length > 1) {
          const folderPart = parts[0];
          const filePart = parts.slice(1).join(path.sep);
          const located = locateFolder(folderPart);
          if (located.found) {
            safe = resolveSafeTarget(filePart, located.path);
          }
        }
      }
      if (safe.error) return { success: false, error: safe.error };

      if (!fs.existsSync(safe.fullPath)) {
        return { success: false, error: `File not found: ${safe.fullPath}` };
      }
      try {
        const stat = fs.statSync(safe.fullPath);
        if (stat.isDirectory()) {
          return { success: false, error: `Path is a directory, not a file: ${safe.fullPath}. Use list_directory instead.` };
        }
        if (stat.size > 5 * 1024 * 1024) {
          return { success: false, error: `File is too large to read entirely (${(stat.size / 1024 / 1024).toFixed(1)}MB). Specify startLine and endLine.` };
        }

        const content = fs.readFileSync(safe.fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const start = Math.max(1, parseInt(toolArgs.startLine, 10) || 1);
        const end = Math.min(lines.length, parseInt(toolArgs.endLine, 10) || lines.length);
        const slice = lines.slice(start - 1, end).map((l, idx) => `${start + idx}: ${l}`).join('\n');

        return {
          success: true,
          path: safe.fullPath,
          relativePath: safe.relativePath,
          location: safe.locationType,
          sizeBytes: stat.size,
          totalLines: lines.length,
          startLine: start,
          endLine: end,
          content: (toolArgs.startLine || toolArgs.endLine) ? slice : content,
          formattedLines: slice,
          exactContent: content
        };
      } catch (err) {
        return { success: false, error: `Error reading file ${safe.fullPath}: ${err.message}` };
      }
    }

    case 'edit_file': {
      const targetPath = toolArgs.path || toolArgs.filePath;
      const safe = resolveSafeTarget(targetPath, toolArgs.location || 'workspace');
      if (safe.error) return { success: false, error: safe.error };

      if (!fs.existsSync(safe.fullPath)) {
        return { success: false, error: `File not found: ${safe.fullPath}` };
      }

      try {
        const oldContent = fs.readFileSync(safe.fullPath, 'utf8');
        let newContent = '';
        let startLine = 1;
        let linesCount = 0;

        if (toolArgs.target !== undefined && toolArgs.target !== null && String(toolArgs.target).trim() !== '') {
          const res = fuzzyReplace(oldContent, String(toolArgs.target), String(toolArgs.replacement || ''));
          if (!res.success) {
            return { success: false, error: res.error, path: safe.fullPath };
          }
          newContent = res.newContent;
          startLine = res.startLine || 1;
          linesCount = res.replacementLines || 1;
        } else {
          newContent = String(toolArgs.replacement !== undefined ? toolArgs.replacement : toolArgs.content || '');
          linesCount = newContent.split(/\r?\n/).length;
        }

        fs.writeFileSync(safe.fullPath, newContent, 'utf8');

        // Verify write on disk
        const verifiedContent = fs.readFileSync(safe.fullPath, 'utf8');
        if (verifiedContent !== newContent) {
          return { success: false, error: `Verification failed: File edit was not written correctly to disk.` };
        }

        let patch = '';
        try {
          patch = Diff.createPatch(path.basename(safe.fullPath), oldContent, newContent, 'original', 'modified');
        } catch (pe) {
          patch = `--- ${safe.fullPath}\n+++ ${safe.fullPath}\n(Diff generation unavailable)`;
        }

        if (safe.locationType === 'workspace') {
          notifyWorkspaceChanged();
        }

        return {
          success: true,
          path: safe.fullPath,
          relativePath: safe.relativePath,
          location: safe.locationType,
          diff: patch,
          linesChanged: {
            startLine,
            linesCount
          },
          verifiedOnDisk: true,
          message: `Successfully edited ${safe.fullPath}`
        };
      } catch (err) {
        return { success: false, error: `Error editing file ${safe.fullPath}: ${err.message}` };
      }
    }

    case 'list_directory': {
      const targetDir = toolArgs.path || toolArgs.dirPath || toolArgs.folder || '.';
      let location = toolArgs.location || 'workspace';
      let safe = resolveSafeTarget(targetDir, location);
      if ((safe.error || !fs.existsSync(safe.fullPath)) && !path.isAbsolute(targetDir) && (location === 'workspace' || !toolArgs.location)) {
        const located = locateFolder(targetDir);
        if (located.found) {
          safe = {
            fullPath: located.path,
            relativePath: path.basename(located.path),
            baseDir: path.dirname(located.path),
            locationType: located.locationType,
            displayPath: located.path
          };
        }
      }
      if (safe.error) return { success: false, error: safe.error };

      if (!fs.existsSync(safe.fullPath)) {
        return { success: false, error: `Directory not found: ${safe.fullPath}` };
      }
      try {
        const entries = fs.readdirSync(safe.fullPath, { withFileTypes: true });
        const items = [];
        for (const ent of entries) {
          if (IGNORE_PATTERNS.has(ent.name) || ent.name.startsWith('.git')) continue;
          let size = 0;
          try {
            const entPath = path.join(safe.fullPath, ent.name);
            if (!ent.isDirectory()) size = fs.statSync(entPath).size;
          } catch (e) {}
          items.push({
            name: ent.name,
            isDirectory: ent.isDirectory(),
            sizeBytes: size
          });
        }
        return {
          success: true,
          path: safe.fullPath,
          relativePath: safe.relativePath,
          location: safe.locationType,
          total: items.length,
          items: items.slice(0, 100)
        };
      } catch (err) {
        return { success: false, error: `Error listing directory: ${err.message}` };
      }
    }

    case 'search_workspace':
    case 'search_code': {
      if (!ws || !fs.existsSync(ws)) {
        return { error: 'No workspace is currently open. Please open or choose a workspace folder first.' };
      }
      const query = String(toolArgs.query || '').trim();
      if (!query) {
        return { error: 'Search query is required.' };
      }
      const safe = resolveSafeWorkspacePath(ws, toolArgs.path || '.');
      if (safe.error) return { error: safe.error };
      const targetDir = safe.fullPath;

      const fileMatches = [];
      const contentMatches = [];
      const queryLower = query.toLowerCase();

      function walk(dir, depth = 0) {
        if (!fs.existsSync(dir) || depth > 8) return;
        let list = [];
        try {
          list = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
          return;
        }

        for (const item of list) {
          if (IGNORE_PATTERNS.has(item.name) || item.name.startsWith('.git')) continue;
          const sub = path.join(dir, item.name);
          const rel = path.relative(ws, sub).replace(/\\/g, '/');

          // Match file or directory names
          if (item.name.toLowerCase().includes(queryLower)) {
            fileMatches.push({
              name: item.name,
              path: rel,
              isDirectory: item.isDirectory()
            });
          }

          if (item.isDirectory()) {
            walk(sub, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (SEARCH_EXTENSIONS.has(ext)) {
              try {
                const stat = fs.statSync(sub);
                if (stat.size <= 2 * 1024 * 1024) { // Up to 2MB text files
                  const txt = fs.readFileSync(sub, 'utf8');
                  if (txt.toLowerCase().includes(queryLower)) {
                    const lines = txt.split(/\r?\n/);
                    for (let idx = 0; idx < lines.length; idx++) {
                      if (lines[idx].toLowerCase().includes(queryLower)) {
                        contentMatches.push({
                          file: rel,
                          line: idx + 1,
                          snippet: lines[idx].trim().slice(0, 160)
                        });
                        if (contentMatches.length >= 40) break;
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      }

      walk(targetDir);

      const total = fileMatches.length + contentMatches.length;
      const relTarget = path.relative(ws, targetDir).replace(/\\/g, '/') || '.';

      return {
        query,
        searchedDirectory: relTarget,
        fileMatches: fileMatches.slice(0, 30),
        contentMatches: contentMatches.slice(0, 30),
        totalMatches: total,
        message: total > 0
          ? `Found ${fileMatches.length} matching file/directory paths and ${contentMatches.length} content matches in ${relTarget}.`
          : `No files, directories, or content matching "${query}" were found in ${relTarget}.`
      };
    }

    case 'run_command': {
      if (!ws || !fs.existsSync(ws)) {
        return { error: 'No workspace is currently open. Please open or choose a workspace folder first.' };
      }
      const command = String(toolArgs.command || '').trim();
      if (!command) return { error: 'Command argument is required.' };
      const startTime = Date.now();
      try {
        const out = execSync(command, {
          cwd: ws,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
          maxBuffer: 4 * 1024 * 1024
        });
        const durationMs = Date.now() - startTime;
        return {
          command,
          stdout: out.trim(),
          stderr: '',
          exitCode: 0,
          durationMs
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        return {
          command,
          stdout: (err.stdout || '').toString().trim(),
          stderr: (err.stderr || '').toString().trim(),
          exitCode: err.status !== undefined ? err.status : 1,
          durationMs,
          error: err.message
        };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

module.exports = {
  registerIdeHandlers,
  setCurrentWorkspace,
  getCurrentWorkspace,
  getStandardPcPath,
  resolveSafeTarget,
  resolveSafeWorkspacePath,
  setMainWindowGetter,
  notifyWorkspaceChanged,
  buildDirectoryTree,
  getGitInfo,
  getGitDiff,
  commitGit,
  fuzzyReplace,
  executeBackendAgentTool,
  locateFolder,
  findFilesInFolder
};
