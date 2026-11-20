// ============================================================================
// Sparx AI Workstation — Full IDE Client Controller
// Monaco Code Editor, Multi-File Tabs, Project Explorer, Git & xterm Terminal
// Docked AI Copilot, Quick File Switcher (Ctrl+P), Global Search (Ctrl+Shift+F)
// Apply Diff & Accept Changes into Editor Buffer
// ============================================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  let monacoInstance = null;
  let activeEditor = null;
  let activeDiffEditor = null;
  let activeTerminal = null;
  let activeTerminalId = null;
  let terminalFitAddon = null;

  const openTabs = []; // Array of { id, path, relativePath, name, model, dirty, ext, originalContent }
  let activeTabId = null;
  let currentWorkspaceTree = null;
  let currentGitInfo = null;
  let currentMode = 'chat'; // 'chat' | 'ide'

  // Quick Open File Switcher State (Ctrl+P)
  let quickFilesCache = [];
  let quickSelectedIndex = 0;

  // Global Search State (Ctrl+Shift+F)
  let searchDebounceTimer = null;
  let searchOptions = {
    caseSensitive: false,
    wholeWord: false,
    regex: false
  };

  // Docked AI Assistant State
  let dockedMessages = [];
  let isDockedStreaming = false;
  let includeActiveFileInContext = true;
  let attachedContextFiles = []; // Array of { path, relativePath, name, content }
  let activeSelectionContext = null; // { startLine, endLine, text }
  const CONTEXT_LIMIT_TOKENS = 128000;
  let mentionSelectedIndex = 0;
  let mentionFilteredFiles = [];

  // Active Pending Diff State
  let pendingDiffData = null; // { tabId, originalText, proposedText }

  // Map file extensions to Monaco language identifiers
  const EXT_TO_LANG = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.md': 'markdown',
    '.rs': 'rust',
    '.go': 'go',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'cpp',
    '.cs': 'csharp',
    '.java': 'java',
    '.sh': 'shell',
    '.bash': 'shell',
    '.ps1': 'powershell',
    '.cmd': 'bat',
    '.bat': 'bat',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.toml': 'ini',
    '.ini': 'ini',
    '.luau': 'lua',
    '.lua': 'lua'
  };

  function getLanguageForExt(ext) {
    return EXT_TO_LANG[ext] || 'plaintext';
  }

  // --------------------------------------------------------------------------
  // 1. Monaco Editor Initialization
  // --------------------------------------------------------------------------
  function initMonaco() {
    const container = document.getElementById('monaco-editor-container');
    if (!container) return;

    if (window.require && typeof window.require.config === 'function') {
      window.require.config({ paths: { 'vs': 'node_modules/monaco-editor/min/vs' } });
      window.require(['vs/editor/editor.main'], function (monaco) {
        monacoInstance = monaco;

        // Define Sparx Clean Studio Theme (Zed / GitHub Dark / Claude inspired)
        monaco.editor.defineTheme('sparx-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { background: '0c0c0e' },
            { token: 'comment', foreground: '6e7681', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff7b72' },
            { token: 'identifier', foreground: 'e4e4e7' },
            { token: 'string', foreground: 'a5d6ff' },
            { token: 'number', foreground: '79c0ff' },
            { token: 'type', foreground: 'ffa657' }
          ],
          colors: {
            'editor.background': '#0c0c0e',
            'editor.foreground': '#e4e4e7',
            'editorCursor.foreground': '#f4f4f5',
            'editor.lineHighlightBackground': '#141418',
            'editorLineNumber.foreground': '#4b4b55',
            'editorLineNumber.activeForeground': '#a1a1aa',
            'editor.selectionBackground': '#262630',
            'editor.inactiveSelectionBackground': '#1a1a22',
            'editorWidget.background': '#141418',
            'editorWidget.border': 'rgba(255,255,255,0.09)'
          }
        });

        activeEditor = monaco.editor.create(container, {
          theme: 'sparx-dark',
          automaticLayout: true,
          fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          fontSize: 13,
          lineHeight: 20,
          tabSize: 2,
          minimap: { enabled: true, side: 'right' },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          padding: { top: 12, bottom: 12 }
        });

        // Live Cursor Position -> Status Bar
        activeEditor.onDidChangeCursorPosition((e) => {
          const posEl = document.getElementById('status-cursor-pos');
          if (posEl && e.position) {
            posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
          }
        });

        // Live Selection -> Assistant Context Chip
        activeEditor.onDidChangeCursorSelection((e) => {
          const model = activeEditor.getModel();
          const selPill = document.getElementById('docked-selection-pill');
          const selLabel = document.getElementById('docked-selection-label');
          if (!model || !e.selection || e.selection.isEmpty()) {
            activeSelectionContext = null;
            if (selPill) selPill.classList.add('hidden');
          } else {
            const selectedText = model.getValueInRange(e.selection);
            if (selectedText && selectedText.trim().length > 0) {
              const startLine = e.selection.startLineNumber;
              const endLine = e.selection.endLineNumber;
              activeSelectionContext = { startLine, endLine, text: selectedText };
              const activeTab = openTabs.find(t => t.id === activeTabId);
              const fname = activeTab ? activeTab.name : 'selection';
              if (selLabel) selLabel.textContent = `${fname}:${startLine}-${endLine}`;
              if (selPill) selPill.classList.remove('hidden');
            } else {
              activeSelectionContext = null;
              if (selPill) selPill.classList.add('hidden');
            }
          }
          updateContextWindowMeter();
        });

        // Setup Save Shortcut (Ctrl+S) inside Monaco
        activeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          saveActiveTab();
        });

        // Setup Quick Open Shortcut (Ctrl+P) inside Monaco
        activeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
          showQuickFileSwitcher();
        });

        // Setup Copilot Dock Shortcut (Ctrl+L) inside Monaco
        activeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
          toggleCopilotDock();
        });

        // If tabs were already opened, select active
        if (activeTabId) {
          selectTab(activeTabId);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Multi-File Tabs Management
  // --------------------------------------------------------------------------
  async function openFileInEditor(filePath, targetLine = null) {
    if (!window.electronAPI || !window.electronAPI.ideReadFile) return;

    // Check if already open
    const existing = openTabs.find(t => t.path === filePath || t.relativePath === filePath);
    if (existing) {
      selectTab(existing.id);
      switchMode('ide');
      if (activeEditor && targetLine) {
        activeEditor.revealLineInCenter(targetLine);
        activeEditor.setPosition({ lineNumber: targetLine, column: 1 });
        activeEditor.focus();
      }
      return;
    }

    const res = await window.electronAPI.ideReadFile(filePath);
    if (!res || !res.success) {
      console.error('[Sparx IDE] Failed to read file:', res && res.error);
      return;
    }

    const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const lang = getLanguageForExt(res.extension);

    let model = null;
    if (monacoInstance) {
      model = monacoInstance.editor.createModel(res.content, lang, monacoInstance.Uri.file(res.path));
      model.onDidChangeContent(() => {
        markTabDirty(tabId, true);
      });
    }

    const newTab = {
      id: tabId,
      path: res.path,
      relativePath: res.relativePath,
      name: res.name,
      extension: res.extension,
      content: res.content,
      model,
      dirty: false,
      originalContent: res.content
    };

    openTabs.push(newTab);
    renderTabs();
    selectTab(tabId);
    switchMode('ide');

    if (activeEditor && targetLine) {
      setTimeout(() => {
        activeEditor.revealLineInCenter(targetLine);
        activeEditor.setPosition({ lineNumber: targetLine, column: 1 });
        activeEditor.focus();
      }, 50);
    }
  }

  function renderTabs() {
    const list = document.getElementById('ide-tabs-list');
    const emptyState = document.getElementById('ide-empty-editor');
    if (!list) return;

    list.innerHTML = '';
    if (openTabs.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      updateDockedContextLabel();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    openTabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `ide-tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`;
      el.id = tab.id;

      el.innerHTML = `
        <span class="ide-tab-name">${escapeHTML(tab.name)}</span>
        <span class="ide-tab-dirty"></span>
        <span class="ide-tab-close" title="Close (Ctrl+W)">&times;</span>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('ide-tab-close')) {
          closeTab(tab.id);
        } else {
          selectTab(tab.id);
        }
      });

      list.appendChild(el);
    });

    updateDockedContextLabel();
  }

  function selectTab(tabId) {
    activeTabId = tabId;
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab) return;

    if (activeEditor && tab.model) {
      activeEditor.setModel(tab.model);
      activeEditor.focus();
    }

    renderTabs();
    updateDockedContextLabel();
  }

  function markTabDirty(tabId, isDirty) {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab && tab.dirty !== isDirty) {
      tab.dirty = isDirty;
      const tabEl = document.getElementById(tabId);
      if (tabEl) {
        tabEl.classList.toggle('dirty', isDirty);
      }
      if (tab.id === activeTabId) {
        updateBreadcrumbsAndStatus(tab);
      }
    }
  }

  async function saveActiveTab() {
    if (!activeTabId) return;
    const tab = openTabs.find(t => t.id === activeTabId);
    if (!tab || !window.electronAPI || !window.electronAPI.ideSaveFile) return;

    const content = tab.model ? tab.model.getValue() : tab.content;
    const res = await window.electronAPI.ideSaveFile(tab.path, content);
    if (res && res.success) {
      tab.content = content;
      tab.originalContent = content;
      markTabDirty(tab.id, false);
      if (typeof window.showToast === 'function') {
        window.showToast(`Saved ${tab.name}`);
      }
      updateBreadcrumbsAndStatus(tab);
      refreshGitStatus();
      window.dispatchEvent(new CustomEvent('sparx:file-saved'));
    }
  }

  function closeTab(tabId) {
    const idx = openTabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const [removed] = openTabs.splice(idx, 1);
    if (removed.model) {
      removed.model.dispose();
    }

    if (activeTabId === tabId) {
      if (openTabs.length > 0) {
        const nextIdx = Math.max(0, idx - 1);
        selectTab(openTabs[nextIdx].id);
      } else {
        activeTabId = null;
        if (activeEditor) {
          activeEditor.setModel(null);
        }
      }
    }
    renderTabs();
  }

  function updateDockedContextLabel() {
    const label = document.getElementById('docked-active-file-label');
    const pill = document.getElementById('docked-file-context-pill');
    const activeTab = openTabs.find(t => t.id === activeTabId);

    if (label) {
      label.textContent = activeTab ? (activeTab.relativePath || activeTab.name) : 'No file';
    }
    if (pill) {
      pill.classList.toggle('excluded', !includeActiveFileInContext || !activeTab);
    }

    updateBreadcrumbsAndStatus(activeTab);
    updateContextWindowMeter();
  }

  function updateBreadcrumbsAndStatus(activeTab) {
    const bcPath = document.getElementById('ide-breadcrumbs-path');
    const saveState = document.getElementById('ide-save-state');
    const langEl = document.getElementById('status-language');

    if (bcPath) {
      if (!activeTab) {
        bcPath.innerHTML = '<span class="breadcrumb-muted">No file open</span>';
      } else {
        const rel = activeTab.relativePath || activeTab.name;
        const parts = rel.split(/[\\/]/).filter(Boolean);
        bcPath.innerHTML = parts.map((seg, i) => {
          const isLast = i === parts.length - 1;
          return `<span class="breadcrumb-segment ${isLast ? 'current' : ''}">${escapeHTML(seg)}</span>` +
                 (isLast ? '' : '<span class="breadcrumb-sep">›</span>');
        }).join('');
      }
    }

    if (saveState) {
      if (!activeTab) {
        saveState.textContent = '';
        saveState.classList.remove('dirty');
      } else if (activeTab.dirty) {
        saveState.textContent = 'Unsaved changes';
        saveState.classList.add('dirty');
      } else {
        saveState.textContent = 'Saved';
        saveState.classList.remove('dirty');
      }
    }

    if (langEl) {
      if (!activeTab) {
        langEl.textContent = 'Plain Text';
      } else {
        const lang = getLanguageForExt(activeTab.extension || '');
        langEl.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
      }
    }
  }

  function estimateTokens(str) {
    if (!str) return 0;
    return Math.ceil(String(str).length / 4);
  }

  function formatCompactTokens(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  function updateContextWindowMeter() {
    const sysTokens = 450; // Base IDE system prompt
    let activeTokens = 0;
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab && includeActiveFileInContext) {
      const code = activeTab.model ? activeTab.model.getValue() : activeTab.content;
      activeTokens += estimateTokens(code);
    }
    if (activeSelectionContext && activeSelectionContext.text) {
      activeTokens += estimateTokens(activeSelectionContext.text);
    }

    let attachedTokens = 0;
    attachedContextFiles.forEach(f => {
      attachedTokens += estimateTokens(f.content || '');
    });

    let historyTokens = 0;
    dockedMessages.forEach(m => {
      historyTokens += estimateTokens(m.content || '');
    });

    const totalTokens = sysTokens + activeTokens + attachedTokens + historyTokens;
    const pct = Math.min(100, Math.round((totalTokens / CONTEXT_LIMIT_TOKENS) * 100));

    // Update SVG Ring & Footer Label
    const ringFill = document.getElementById('ctx-ring-fill');
    const pctLabel = document.getElementById('ide-context-pct-label');
    if (ringFill) {
      const circumference = 43.98;
      const offset = circumference - (pct / 100) * circumference;
      ringFill.style.strokeDashoffset = String(offset);
      ringFill.style.stroke = pct > 80 ? '#f85149' : (pct > 55 ? '#e3b341' : '#d97757');
    }
    if (pctLabel) pctLabel.textContent = `${pct}%`;

    // Update Status Bar Context Indicator
    const statusCtx = document.getElementById('status-context-label');
    if (statusCtx) {
      statusCtx.textContent = `${formatCompactTokens(totalTokens)} / 128k ctx`;
    }

    // Update Context Popover Breakdown
    const popPct = document.getElementById('context-pop-pct');
    const popBar = document.getElementById('context-pop-bar-fill');
    const popTotal = document.getElementById('context-pop-total');
    const elSys = document.getElementById('ctx-tokens-system');
    const elAct = document.getElementById('ctx-tokens-active');
    const elAtt = document.getElementById('ctx-tokens-attached');
    const elHis = document.getElementById('ctx-tokens-history');

    if (popPct) popPct.textContent = `${pct}%`;
    if (popBar) {
      popBar.style.width = `${pct}%`;
      popBar.className = 'context-pop-bar-fill' + (pct > 80 ? ' high' : (pct > 55 ? ' warn' : ''));
    }
    if (popTotal) popTotal.textContent = `${totalTokens.toLocaleString()} / ${CONTEXT_LIMIT_TOKENS.toLocaleString()} tokens`;
    if (elSys) elSys.textContent = formatCompactTokens(sysTokens);
    if (elAct) elAct.textContent = formatCompactTokens(activeTokens);
    if (elAtt) elAtt.textContent = formatCompactTokens(attachedTokens);
    if (elHis) elHis.textContent = formatCompactTokens(historyTokens);
  }

  function renderAttachedContextChips() {
    const container = document.getElementById('docked-extra-chips');
    if (!container) return;
    container.innerHTML = '';
    attachedContextFiles.forEach((f, idx) => {
      const chip = document.createElement('span');
      chip.className = 'docked-extra-chip';
      chip.title = f.relativePath || f.path;
      chip.innerHTML = `<span>@${escapeHTML(f.name)}</span><button class="ctx-pill-toggle" type="button" title="Remove">×</button>`;
      chip.querySelector('.ctx-pill-toggle').addEventListener('click', () => {
        attachedContextFiles.splice(idx, 1);
        renderAttachedContextChips();
        updateContextWindowMeter();
      });
      container.appendChild(chip);
    });
  }

  async function attachFileToContext(fileEntry) {
    if (!fileEntry || !fileEntry.path) return;
    if (attachedContextFiles.some(f => f.path === fileEntry.path)) return;
    let content = '';
    if (window.electronAPI && window.electronAPI.ideReadFile) {
      try {
        const res = await window.electronAPI.ideReadFile(fileEntry.path);
        if (res && res.success) content = res.content || '';
      } catch (e) {}
    }
    attachedContextFiles.push({
      path: fileEntry.path,
      relativePath: fileEntry.relativePath || fileEntry.name,
      name: fileEntry.name,
      content
    });
    renderAttachedContextChips();
    updateContextWindowMeter();
  }

  // --------------------------------------------------------------------------
  // 3. P1 Apply Diff & Accept Changes to Monaco
  // --------------------------------------------------------------------------
  async function applyToEditor(newCode, targetPath = null) {
    if (!newCode) return;

    // 1. Switch to IDE mode if currently in chat
    switchMode('ide');

    // 2. Resolve target tab
    let targetTab = null;
    if (targetPath) {
      await openFileInEditor(targetPath);
      targetTab = openTabs.find(t => t.path === targetPath || t.relativePath === targetPath);
    } else {
      targetTab = openTabs.find(t => t.id === activeTabId);
    }

    // If no tab is open at all, open or create untitled scratchpad
    if (!targetTab) {
      if (openTabs.length > 0) {
        targetTab = openTabs[0];
        selectTab(targetTab.id);
      } else {
        // Open the first workspace file or create scratchpad
        const treeRes = await window.electronAPI.ideGetWorkspaceTree();
        if (treeRes && treeRes.tree && treeRes.tree.children && treeRes.tree.children.length > 0) {
          const firstFile = treeRes.tree.children.find(c => !c.isDirectory);
          if (firstFile) {
            await openFileInEditor(firstFile.path);
            targetTab = openTabs.find(t => t.path === firstFile.path);
          }
        }
      }
    }

    if (!targetTab || !targetTab.model) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please open a file in the editor to apply changes.');
      }
      return;
    }

    const currentText = targetTab.model.getValue();
    const originalLines = currentText.split(/\r?\n/).length;
    const newLines = newCode.split(/\r?\n/).length;
    const diffCount = Math.abs(newLines - originalLines);

    // Save state for accept / reject
    pendingDiffData = {
      tabId: targetTab.id,
      originalText: currentText,
      proposedText: newCode
    };

    // Apply proposed text into Monaco editor buffer
    targetTab.model.setValue(newCode);
    markTabDirty(targetTab.id, true);

    // Render real Monaco Diff Editor if available
    const edContainer = document.getElementById('monaco-editor-container');
    const diffContainer = document.getElementById('monaco-diff-container');
    if (monacoInstance && diffContainer && edContainer) {
      edContainer.classList.add('hidden');
      diffContainer.classList.remove('hidden');
      if (!activeDiffEditor) {
        activeDiffEditor = monacoInstance.editor.createDiffEditor(diffContainer, {
          theme: 'sparx-dark',
          automaticLayout: true,
          readOnly: true,
          renderSideBySide: true,
          fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontSize: 13,
          lineHeight: 20
        });
      }
      const lang = getLanguageForExt(targetTab.extension || '');
      const origModel = monacoInstance.editor.createModel(currentText, lang);
      const modModel = monacoInstance.editor.createModel(newCode, lang);
      activeDiffEditor.setModel({ original: origModel, modified: modModel });
      pendingDiffData.diffModels = { origModel, modModel };
    }

    // Show Diff Review Banner at top of editor
    const banner = document.getElementById('ide-diff-review-banner');
    const bannerTitle = document.getElementById('diff-banner-title');
    const bannerStats = document.getElementById('diff-banner-stats');

    if (banner) {
      banner.classList.remove('hidden');
      if (bannerTitle) bannerTitle.textContent = `Reviewing Diff: ${targetTab.name}`;
      if (bannerStats) bannerStats.textContent = `~${diffCount} lines changed`;
    }

    if (typeof window.showToast === 'function') {
      window.showToast('Review diff and Accept or Reject.');
    }
  }

  function closeDiffView() {
    const edContainer = document.getElementById('monaco-editor-container');
    const diffContainer = document.getElementById('monaco-diff-container');
    if (diffContainer) diffContainer.classList.add('hidden');
    if (edContainer) edContainer.classList.remove('hidden');
    if (activeDiffEditor) {
      try { activeDiffEditor.setModel(null); } catch (e) {}
    }
    if (pendingDiffData && pendingDiffData.diffModels) {
      try { pendingDiffData.diffModels.origModel.dispose(); } catch (e) {}
      try { pendingDiffData.diffModels.modModel.dispose(); } catch (e) {}
    }
    if (activeEditor) activeEditor.layout();
  }

  function acceptPendingDiff() {
    if (!pendingDiffData) return;
    closeDiffView();
    const banner = document.getElementById('ide-diff-review-banner');
    if (banner) banner.classList.add('hidden');

    saveActiveTab();
    pendingDiffData = null;

    if (typeof window.showToast === 'function') {
      window.showToast('Changes accepted and saved.');
    }
  }

  function rejectPendingDiff() {
    if (!pendingDiffData) return;
    closeDiffView();
    const tab = openTabs.find(t => t.id === pendingDiffData.tabId);
    if (tab && tab.model) {
      tab.model.setValue(pendingDiffData.originalText);
      markTabDirty(tab.id, false);
    }

    const banner = document.getElementById('ide-diff-review-banner');
    if (banner) banner.classList.add('hidden');

    pendingDiffData = null;

    if (typeof window.showToast === 'function') {
      window.showToast('Changes reverted.');
    }
  }

  // --------------------------------------------------------------------------
  // 4. P1 Quick File Switcher (Ctrl+P Modal)
  // --------------------------------------------------------------------------
  async function showQuickFileSwitcher() {
    const modal = document.getElementById('quick-file-switcher-modal');
    const input = document.getElementById('quick-file-input');
    if (!modal || !input) return;

    modal.classList.remove('hidden');
    input.value = '';
    quickSelectedIndex = 0;

    // Load file list from backend
    if (window.electronAPI && window.electronAPI.ideListFiles) {
      const res = await window.electronAPI.ideListFiles();
      if (res && res.success && Array.isArray(res.files)) {
        quickFilesCache = res.files;
      }
    }

    renderQuickFiles('');
    input.focus();
  }

  function hideQuickFileSwitcher() {
    const modal = document.getElementById('quick-file-switcher-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderQuickFiles(filter) {
    const container = document.getElementById('quick-file-results');
    if (!container) return;

    const norm = String(filter || '').trim().toLowerCase();
    const matched = quickFilesCache.filter(f => {
      if (!norm) return true;
      return f.name.toLowerCase().includes(norm) || f.relativePath.toLowerCase().includes(norm);
    }).slice(0, 50);

    container.innerHTML = '';
    if (matched.length === 0) {
      container.innerHTML = '<div style="padding: 12px; font-size: 12px; color: #71717a; text-align: center;">No matching files found</div>';
      return;
    }

    quickSelectedIndex = Math.min(quickSelectedIndex, matched.length - 1);
    if (quickSelectedIndex < 0) quickSelectedIndex = 0;

    matched.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = `quick-file-item ${idx === quickSelectedIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="quick-file-main">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#38bdf8;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          </svg>
          <span class="quick-file-name">${escapeHTML(file.name)}</span>
          <span class="quick-file-path">${escapeHTML(file.relativePath)}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        openFileInEditor(file.fullPath);
        hideQuickFileSwitcher();
      });

      container.appendChild(item);
    });
  }

  // --------------------------------------------------------------------------
  // 5. P1 Global Search View (Ctrl+Shift+F)
  // --------------------------------------------------------------------------
  async function performGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const container = document.getElementById('search-results-list');
    const summary = document.getElementById('search-summary-row');
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) {
      container.innerHTML = '';
      if (summary) summary.textContent = '';
      return;
    }

    if (summary) summary.textContent = 'Searching workspace...';

    if (window.electronAPI && window.electronAPI.ideGlobalSearch) {
      const res = await window.electronAPI.ideGlobalSearch({
        query,
        caseSensitive: searchOptions.caseSensitive,
        wholeWord: searchOptions.wholeWord,
        regex: searchOptions.regex
      });

      if (!res || !res.success) {
        if (summary) summary.textContent = res && res.error ? res.error : 'Search failed';
        container.innerHTML = '';
        return;
      }

      if (summary) {
        summary.textContent = `${res.totalMatches} match${res.totalMatches === 1 ? '' : 'es'} across ${res.results.length} file${res.results.length === 1 ? '' : 's'}`;
      }

      container.innerHTML = '';
      if (res.results.length === 0) {
        container.innerHTML = '<div style="padding: 12px; font-size: 11.5px; color: #71717a; text-align: center;">No matches found</div>';
        return;
      }

      res.results.forEach(fileGroup => {
        const groupEl = document.createElement('div');
        groupEl.className = 'search-file-group';

        const headerEl = document.createElement('div');
        headerEl.className = 'search-file-header';
        headerEl.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #38bdf8;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          </svg>
          <span>${escapeHTML(fileGroup.file)}</span>
          <span style="font-size: 10px; color: #71717a; margin-left: auto;">${fileGroup.matches.length}</span>
        `;
        groupEl.appendChild(headerEl);

        fileGroup.matches.forEach(match => {
          const matchEl = document.createElement('div');
          matchEl.className = 'search-match-item';
          matchEl.innerHTML = `
            <span class="search-match-line">:${match.line}</span>
            <span class="search-match-text">${escapeHTML(match.text)}</span>
          `;

          matchEl.addEventListener('click', () => {
            openFileInEditor(fileGroup.fullPath, match.line);
          });

          groupEl.appendChild(matchEl);
        });

        container.appendChild(groupEl);
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. P1 Docked AI Copilot Chat Pane (Side-by-Side Real-Time Coding)
  // --------------------------------------------------------------------------
  function toggleCopilotDock() {
    const pane = document.getElementById('ide-docked-chat-pane');
    const toggleBtn = document.getElementById('btn-toggle-copilot-dock');
    if (!pane) return;

    const isCollapsed = pane.classList.contains('collapsed');
    pane.classList.toggle('collapsed', !isCollapsed);

    if (toggleBtn) {
      toggleBtn.classList.toggle('active-copilot', isCollapsed);
    }

    if (activeEditor) {
      setTimeout(() => activeEditor.layout(), 120);
    }
  }

  function stopDockedStreaming() {
    if (!isDockedStreaming) return;
    isDockedStreaming = false;
    if (window.electronAPI && typeof window.electronAPI.cancelChat === 'function') {
      window.electronAPI.cancelChat();
    }
    const sendBtn = document.getElementById('btn-docked-send');
    if (sendBtn) {
      sendBtn.classList.remove('streaming');
      sendBtn.title = 'Send (Enter)';
      sendBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
    }
  }

  function restoreCheckpoint(snapshot) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;
    let restoredCount = 0;
    snapshot.forEach(item => {
      const tab = openTabs.find(t => t.path === item.path);
      if (tab && tab.model) {
        tab.model.setValue(item.content);
        markTabDirty(tab.id, item.content !== tab.originalContent);
        restoredCount++;
      }
    });
    if (typeof window.showToast === 'function') {
      window.showToast(`Restored checkpoint (${restoredCount} file${restoredCount === 1 ? '' : 's'}).`);
    }
  }

  async function handleSendDockedMessage(overridePrompt = null) {
    const textarea = document.getElementById('docked-chat-textarea');
    const transcript = document.getElementById('docked-chat-transcript');
    const welcomeCard = document.getElementById('docked-welcome-card');
    const modeSelect = document.getElementById('ide-agent-mode-select');
    const modelSelect = document.getElementById('ide-model-select');
    if (!transcript) return;

    if (isDockedStreaming) {
      stopDockedStreaming();
      return;
    }

    const text = (typeof overridePrompt === 'string' ? overridePrompt : (textarea ? textarea.value : '')).trim();
    if (!text) return;

    if (!overridePrompt && textarea) {
      textarea.value = '';
      textarea.style.height = 'auto';
    }

    if (welcomeCard) welcomeCard.style.display = 'none';

    const agentMode = modeSelect ? modeSelect.value : 'agent';
    const selectedModel = modelSelect ? modelSelect.value : 'gemini-4-hydrogen';

    // Capture checkpoint of open tabs before this AI turn
    const turnCheckpoint = openTabs.map(t => ({
      path: t.path,
      content: t.model ? t.model.getValue() : t.content
    }));

    // Collect context badges for display
    const contextTags = [];
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab && includeActiveFileInContext) {
      contextTags.push(activeTab.name);
    }
    if (activeSelectionContext) {
      contextTags.push(`L${activeSelectionContext.startLine}-${activeSelectionContext.endLine}`);
    }
    attachedContextFiles.forEach(f => contextTags.push(`@${f.name}`));

    // 1. Append User Bubble
    const userMsg = { role: 'user', content: text };
    dockedMessages.push(userMsg);
    appendDockedBubble('user', text, contextTags);
    updateContextWindowMeter();

    // 2. Build full multi-file + selection + workspace context block
    const contextBlocks = [];
    if (currentWorkspaceTree && currentWorkspaceTree.name) {
      const openNames = openTabs.map(t => t.relativePath || t.name).join(', ');
      contextBlocks.push(`[Workspace: ${currentWorkspaceTree.name}${openNames ? ` | Open tabs: ${openNames}` : ''}]`);
    }
    if (activeTab && includeActiveFileInContext) {
      const code = activeTab.model ? activeTab.model.getValue() : activeTab.content;
      contextBlocks.push(`[Active File: ${activeTab.relativePath || activeTab.name}]\n\`\`\`${(activeTab.extension || '').replace('.', '')}\n${code}\n\`\`\``);
    }
    if (activeSelectionContext && activeSelectionContext.text) {
      contextBlocks.push(`[Selected Lines ${activeSelectionContext.startLine}-${activeSelectionContext.endLine}]\n\`\`\`\n${activeSelectionContext.text}\n\`\`\``);
    }
    attachedContextFiles.forEach(f => {
      contextBlocks.push(`[Attached File: ${f.relativePath || f.name}]\n\`\`\`\n${f.content || ''}\n\`\`\``);
    });

    const contextualUserPrompt = contextBlocks.length > 0
      ? `${text}\n\n${contextBlocks.join('\n\n')}`
      : text;

    const modeDirectives = {
      agent: 'Mode: AGENT. Inspect relevant files first, make clean surgical edits or provide complete fenced code blocks, and verify changes.',
      ask: 'Mode: ASK (Read-Only). Answer questions clearly and concisely based on the provided code context without modifying files.',
      plan: 'Mode: PLAN. Produce a crisp, actionable architectural and implementation plan before writing any code.'
    };

    const systemPrompt = `You are Sparx, an authentic, senior AI software engineer embedded in the IDE. ${modeDirectives[agentMode] || modeDirectives.agent} Provide clean, idiomatic, production-ready code using markdown code blocks. Be direct, practical, and free of filler.`;

    // Build message payload preserving conversation history
    const historyWindow = dockedMessages.slice(-16, -1).map(m => ({ role: m.role, content: m.content }));
    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...historyWindow,
      { role: 'user', content: contextualUserPrompt }
    ];

    // 3. Create Assistant Live Bubble with Trace & Checkpoint
    isDockedStreaming = true;
    const sendBtn = document.getElementById('btn-docked-send');
    if (sendBtn) {
      sendBtn.classList.add('streaming');
      sendBtn.title = 'Stop generating';
      sendBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5"/></svg>';
    }

    const assistantHandle = appendDockedBubble('assistant', 'Thinking...', [], turnCheckpoint);
    const assistantBubble = assistantHandle.contentEl;
    const traceDetails = assistantHandle.traceDetails;
    const traceSummary = assistantHandle.traceSummary;
    const traceSteps = assistantHandle.traceSteps;
    const traceReasoning = assistantHandle.traceReasoning;

    let assistantText = '';
    let reasoningText = '';
    let stepCount = 0;

    const addTraceStep = (label) => {
      if (!traceDetails || !traceSteps) return;
      traceDetails.classList.remove('hidden');
      stepCount++;
      const stepEl = document.createElement('div');
      stepEl.className = 'docked-trace-step';
      stepEl.textContent = `• ${label}`;
      traceSteps.appendChild(stepEl);
      if (traceSummary) traceSummary.textContent = `Working (${stepCount} step${stepCount === 1 ? '' : 's'})`;
    };

    const unsubStatus = window.electronAPI.onChatStatus ? window.electronAPI.onChatStatus((st) => {
      if (!isDockedStreaming || !st) return;
      if (st.details) addTraceStep(st.details);
    }) : null;

    const unsubTool = window.electronAPI.onToolResult ? window.electronAPI.onToolResult((res) => {
      if (!isDockedStreaming || !res) return;
      addTraceStep(`Tool: ${res.tool || 'action'} completed`);
    }) : null;

    const unsubReasoning = window.electronAPI.onReasoningChunk ? window.electronAPI.onReasoningChunk((chunk) => {
      if (!isDockedStreaming) return;
      const rTxt = (chunk && chunk.text) || (typeof chunk === 'string' ? chunk : '');
      if (rTxt && traceDetails && traceReasoning) {
        traceDetails.classList.remove('hidden');
        reasoningText += rTxt;
        traceReasoning.textContent = reasoningText;
        if (traceSummary && stepCount === 0) traceSummary.textContent = 'Reasoning';
      }
    }) : null;

    const unsubChunk = window.electronAPI.onStreamChunk((chunk) => {
      if (!isDockedStreaming) return;
      const chunkStr = (chunk && chunk.text) || (typeof chunk === 'string' ? chunk : '');
      assistantText += chunkStr;
      renderDockedAssistantContent(assistantBubble, assistantText);
      transcript.scrollTop = transcript.scrollHeight;
    });

    const cleanupListeners = () => {
      if (unsubChunk) unsubChunk();
      if (unsubEnd) unsubEnd();
      if (unsubStatus) unsubStatus();
      if (unsubTool) unsubTool();
      if (unsubReasoning) unsubReasoning();
    };

    const unsubEnd = window.electronAPI.onStreamEnd((data) => {
      isDockedStreaming = false;
      cleanupListeners();
      if (sendBtn) {
        sendBtn.classList.remove('streaming');
        sendBtn.title = 'Send (Enter)';
        sendBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
      }
      if (traceSummary && (stepCount > 0 || reasoningText)) {
        traceSummary.textContent = stepCount > 0 ? `Completed ${stepCount} step${stepCount === 1 ? '' : 's'}` : 'Thought process';
      }
      const finalTxt = (data && data.fullText) || assistantText || 'Done.';
      renderDockedAssistantContent(assistantBubble, finalTxt);
      dockedMessages.push({ role: 'assistant', content: finalTxt });
      updateContextWindowMeter();
    });

    // Send to backend
    window.electronAPI.sendMessage({
      messages: payloadMessages,
      model: selectedModel,
      mode: agentMode === 'agent' ? 'work' : 'ide'
    });
  }

  function appendDockedBubble(role, content, contextTags = [], checkpointSnapshot = null) {
    const transcript = document.getElementById('docked-chat-transcript');
    if (!transcript) return null;

    const tagsHtml = (role === 'user' && Array.isArray(contextTags) && contextTags.length > 0)
      ? `<div class="docked-msg-context-tags">${contextTags.map(t => `<span class="docked-msg-ctx-badge">${escapeHTML(t)}</span>`).join('')}</div>`
      : '';

    const msgEl = document.createElement('div');
    msgEl.className = `docked-msg ${role}`;

    const hasRestore = role === 'assistant' && Array.isArray(checkpointSnapshot) && checkpointSnapshot.length > 0;

    msgEl.innerHTML = `
      <div class="docked-msg-header-row">
        <div class="docked-msg-role">${role === 'user' ? 'You' : 'Sparx'}</div>
        ${hasRestore ? '<button class="docked-restore-btn" type="button" title="Restore open files to before this turn">↺ Restore</button>' : ''}
      </div>
      ${tagsHtml}
      ${role === 'assistant' ? '<details class="docked-trace-details hidden"><summary class="docked-trace-summary">Thinking</summary><div class="docked-trace-steps"></div><div class="docked-trace-reasoning"></div></details>' : ''}
      <div class="docked-msg-content">${escapeHTML(content)}</div>
    `;

    if (hasRestore) {
      const restoreBtn = msgEl.querySelector('.docked-restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => restoreCheckpoint(checkpointSnapshot));
      }
    }

    transcript.appendChild(msgEl);
    transcript.scrollTop = transcript.scrollHeight;

    if (role === 'user') {
      return msgEl.querySelector('.docked-msg-content');
    }
    return {
      contentEl: msgEl.querySelector('.docked-msg-content'),
      traceDetails: msgEl.querySelector('.docked-trace-details'),
      traceSummary: msgEl.querySelector('.docked-trace-summary'),
      traceSteps: msgEl.querySelector('.docked-trace-steps'),
      traceReasoning: msgEl.querySelector('.docked-trace-reasoning')
    };
  }

  function renderDockedAssistantContent(container, markdownText) {
    if (!container) return;

    // Fast parse code blocks and format
    let html = '';
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        html = window.marked.parse(markdownText);
      } catch (e) {
        html = escapeHTML(markdownText).replace(/\n/g, '<br/>');
      }
    } else {
      html = escapeHTML(markdownText).replace(/\n/g, '<br/>');
    }

    container.innerHTML = html;

    // Upgrade all code blocks inside docked container with "Apply to Editor" button
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach(pre => {
      const codeEl = pre.querySelector('code');
      const codeText = codeEl ? codeEl.textContent : pre.textContent;
      const langClass = codeEl ? codeEl.className : '';
      const lang = langClass.replace('language-', '') || 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'docked-code-card';

      wrapper.innerHTML = `
        <div class="docked-code-header">
          <span class="docked-code-lang">${escapeHTML(lang)}</span>
          <div class="docked-code-actions">
            <button class="btn-apply-to-editor" type="button" title="Apply this code to active editor">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Apply</span>
            </button>
            <button class="btn-docked-copy" type="button" title="Copy code">Copy</button>
          </div>
        </div>
      `;

      const applyBtn = wrapper.querySelector('.btn-apply-to-editor');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          applyToEditor(codeText.trim());
        });
      }

      const copyBtn = wrapper.querySelector('.btn-docked-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(codeText.trim()).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          });
        });
      }

      pre.className = 'docked-code-body';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
    });
  }

  // --------------------------------------------------------------------------
  // 7. Workspace Explorer File Tree
  // --------------------------------------------------------------------------
  async function loadWorkspaceTree() {
    if (!window.electronAPI || !window.electronAPI.ideGetWorkspaceTree) return;

    const res = await window.electronAPI.ideGetWorkspaceTree();
    if (!res || !res.tree) return;

    currentWorkspaceTree = res.tree;
    const title = document.getElementById('explorer-workspace-name');
    if (title) title.textContent = res.folderName || 'WORKSPACE';

    const container = document.getElementById('explorer-tree-container');
    if (!container) return;

    container.innerHTML = '';
    container.appendChild(renderTreeNode(res.tree, true));
    refreshGitStatus();
  }

  function renderTreeNode(node, isRoot = false) {
    const wrap = document.createElement('div');

    if (node.isDirectory) {
      wrap.className = 'tree-folder' + (isRoot ? ' open' : '');

      const item = document.createElement('div');
      item.className = 'tree-item';
      item.innerHTML = `
        <span class="tree-chevron">▶</span>
        <span class="tree-icon">📁</span>
        <span class="tree-label">${escapeHTML(node.name)}</span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.toggle('open');
      });

      wrap.appendChild(item);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      if (Array.isArray(node.children)) {
        node.children.forEach(child => {
          childrenContainer.appendChild(renderTreeNode(child));
        });
      }
      wrap.appendChild(childrenContainer);
    } else {
      wrap.className = 'tree-file';

      const item = document.createElement('div');
      item.className = 'tree-item';
      item.innerHTML = `
        <span class="tree-chevron" style="opacity:0;">•</span>
        <span class="tree-icon">📄</span>
        <span class="tree-label">${escapeHTML(node.name)}</span>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openFileInEditor(node.path);
      });

      wrap.appendChild(item);
    }

    return wrap;
  }

  // --------------------------------------------------------------------------
  // 8. Git Source Control Integration
  // --------------------------------------------------------------------------
  async function refreshGitStatus() {
    if (!window.electronAPI || !window.electronAPI.ideGitStatus) return;

    const git = await window.electronAPI.ideGitStatus();
    currentGitInfo = git;

    const branchEl = document.getElementById('git-branch-name');
    const statusBranchEl = document.getElementById('status-git-branch');
    const branchText = git && git.branch ? git.branch : 'main';
    if (branchEl) branchEl.textContent = git && git.branch ? git.branch : 'No Git Repo';
    if (statusBranchEl) statusBranchEl.textContent = branchText;

    const list = document.getElementById('git-files-list');
    if (!list) return;

    list.innerHTML = '';
    if (!git || !git.files || git.files.length === 0) {
      list.innerHTML = '<div style="padding: 12px; font-size: 11.5px; color: #71717a; text-align: center;">No local changes</div>';
      return;
    }

    git.files.forEach(f => {
      const el = document.createElement('div');
      el.className = 'git-file-item';
      el.innerHTML = `
        <span>${escapeHTML(f.path)}</span>
        <span class="git-status-badge ${f.status}">${f.status}</span>
      `;

      el.addEventListener('click', () => {
        openFileInEditor(f.path);
      });

      list.appendChild(el);
    });
  }

  // --------------------------------------------------------------------------
  // 9. Interactive Docked xterm.js Terminal with Crisp Cascadia Code
  // --------------------------------------------------------------------------
  async function initTerminal() {
    const container = document.getElementById('xterm-terminal-container');
    if (!container || !window.Terminal) return;

    if (activeTerminal) return;

    activeTerminal = new window.Terminal({
      theme: {
        background: '#070709',
        foreground: '#e4e4e7',
        cursor: '#38bdf8',
        cursorAccent: '#070709',
        selectionBackground: 'rgba(56, 189, 248, 0.35)',
        black: '#18181b',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#ef4444',
        brightGreen: '#10b981',
        brightYellow: '#f59e0b',
        brightBlue: '#38bdf8',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff'
      },
      fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      letterSpacing: 0,
      fontWeight: '400',
      fontWeightBold: '700',
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      smoothScrollDuration: 120,
      allowTransparency: true
    });

    if (window.FitAddon && window.FitAddon.FitAddon) {
      terminalFitAddon = new window.FitAddon.FitAddon();
      activeTerminal.loadAddon(terminalFitAddon);
    } else if (typeof window.FitAddon === 'function') {
      terminalFitAddon = new window.FitAddon();
      activeTerminal.loadAddon(terminalFitAddon);
    }

    activeTerminal.open(container);
    if (terminalFitAddon) terminalFitAddon.fit();

    // Spawn native pty shell process
    if (window.electronAPI && window.electronAPI.ideTerminalSpawn) {
      const res = await window.electronAPI.ideTerminalSpawn({
        cols: activeTerminal.cols || 80,
        rows: activeTerminal.rows || 24
      });

      if (res && res.success) {
        activeTerminalId = res.termId;

        // Pipe PTY output into xterm
        if (window.electronAPI.onTerminalData) {
          window.electronAPI.onTerminalData(activeTerminalId, (data) => {
            activeTerminal.write(data);
          });
        }

        // Pipe user keystrokes into PTY process
        activeTerminal.onData((data) => {
          if (activeTerminalId && window.electronAPI.ideTerminalWrite) {
            window.electronAPI.ideTerminalWrite(activeTerminalId, data);
          }
        });

        // Resize syncing
        activeTerminal.onResize(({ cols, rows }) => {
          if (activeTerminalId && window.electronAPI.ideTerminalResize) {
            window.electronAPI.ideTerminalResize(activeTerminalId, cols, rows);
          }
        });
      }
    }
  }

  function toggleTerminalDock() {
    const dock = document.getElementById('ide-terminal-dock');
    if (!dock) return;
    const isHidden = dock.classList.contains('hidden');
    dock.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      if (!activeTerminal) initTerminal();
      setTimeout(() => {
        if (terminalFitAddon) terminalFitAddon.fit();
        if (activeTerminal) activeTerminal.focus();
      }, 100);
    }
  }

  // --------------------------------------------------------------------------
  // 10. View & Mode Switching (Sparx Chat Mode)
  // --------------------------------------------------------------------------
  function switchMode(mode) {
    const nextMode = mode === 'ide' ? 'ide' : 'chat';
    currentMode = nextMode;
    const shell = document.getElementById('app-shell');
    const stage = document.getElementById('ide-workspace-stage');
    const btnChat = document.getElementById('btn-mode-chat');
    const btnIde = document.getElementById('btn-mode-ide');
    const chatSidebar = document.getElementById('sidebar-panel');

    if (!shell) return;

    if (nextMode === 'ide') {
      shell.classList.remove('mode-chat');
      shell.classList.add('mode-ide');
      if (stage) stage.classList.remove('hidden');
      if (chatSidebar) chatSidebar.classList.add('hidden');
      if (btnIde) btnIde.classList.add('active');
      if (btnChat) btnChat.classList.remove('active');
      if (activeEditor) setTimeout(() => activeEditor.layout(), 60);
      if (terminalFitAddon && activeTerminal) setTimeout(() => terminalFitAddon.fit(), 80);
    } else {
      shell.classList.remove('mode-ide');
      shell.classList.add('mode-chat');
      if (stage) stage.classList.add('hidden');
      if (chatSidebar) chatSidebar.classList.remove('hidden');
      if (btnIde) btnIde.classList.remove('active');
      if (btnChat) btnChat.classList.add('active');
    }
  }

  function switchSidebarTab(tabName) {
    document.querySelectorAll('.sidebar-view-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.ide-nav-tab').forEach(b => b.classList.remove('active'));

    const targetPane = document.getElementById(`sidebar-view-${tabName}`);
    if (targetPane) targetPane.classList.remove('hidden');

    const targetNav = document.getElementById(`tab-nav-${tabName}`);
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'explorer') loadWorkspaceTree();
    if (tabName === 'git') refreshGitStatus();
    if (tabName === 'search') {
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) searchInput.focus();
    }
  }

  // Helper escape
  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --------------------------------------------------------------------------
  // Bootstrap & DOM Events
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initMonaco();
    loadWorkspaceTree();

    // Mode Toggle Buttons
    const btnModeChat = document.getElementById('btn-mode-chat');
    const btnModeIde = document.getElementById('btn-mode-ide');
    if (btnModeChat) btnModeChat.addEventListener('click', () => switchMode('chat'));
    if (btnModeIde) btnModeIde.addEventListener('click', () => switchMode('ide'));

    // Open Workspace Button
    const btnOpenWs = document.getElementById('btn-open-workspace');
    const btnOpenFolderHeader = document.getElementById('btn-explorer-open-folder');
    const handleSelectFolder = async () => {
      if (window.electronAPI && window.electronAPI.ideSelectFolder) {
        const res = await window.electronAPI.ideSelectFolder();
        if (res && !res.canceled) {
          loadWorkspaceTree();
        }
      }
    };
    if (btnOpenWs) btnOpenWs.addEventListener('click', handleSelectFolder);
    if (btnOpenFolderHeader) btnOpenFolderHeader.addEventListener('click', handleSelectFolder);

    // Sidebar navigation tabs (Explorer, Search, Git)
    document.querySelectorAll('.ide-nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const pane = tabBtn.getAttribute('data-pane');
        if (pane) switchSidebarTab(pane);
      });
    });

    if (window.electronAPI && window.electronAPI.onWorkspaceChanged) {
      window.electronAPI.onWorkspaceChanged(() => {
        loadWorkspaceTree();
        refreshGitStatus();
      });
    }

    // Terminal Toggle Buttons
    const btnToggleTerm = document.getElementById('btn-toggle-terminal');
    const btnCloseTerm = document.getElementById('btn-close-terminal');
    const btnClearTerm = document.getElementById('btn-clear-terminal');
    if (btnToggleTerm) btnToggleTerm.addEventListener('click', toggleTerminalDock);
    if (btnCloseTerm) btnCloseTerm.addEventListener('click', toggleTerminalDock);
    if (btnClearTerm) btnClearTerm.addEventListener('click', () => {
      if (activeTerminal) activeTerminal.clear();
    });

    // P1 Diff Review Banner Accept / Reject buttons
    const btnAcceptDiff = document.getElementById('btn-diff-accept-banner');
    const btnRejectDiff = document.getElementById('btn-diff-reject-banner');
    if (btnAcceptDiff) btnAcceptDiff.addEventListener('click', acceptPendingDiff);
    if (btnRejectDiff) btnRejectDiff.addEventListener('click', rejectPendingDiff);

    // P1 Docked AI Copilot Chat Pane Actions
    const btnToggleCopilot = document.getElementById('btn-toggle-copilot-dock');
    const btnDockedCollapse = document.getElementById('btn-docked-collapse');
    const btnDockedNewChat = document.getElementById('btn-docked-new-chat');
    const btnDockedSend = document.getElementById('btn-docked-send');
    const dockedTextarea = document.getElementById('docked-chat-textarea');
    const btnDockedVoice = document.getElementById('btn-docked-voice');

    function resetDockedThread() {
      dockedMessages = [];
      attachedContextFiles = [];
      renderAttachedContextChips();
      const transcript = document.getElementById('docked-chat-transcript');
      const welcomeCard = document.getElementById('docked-welcome-card');
      if (transcript) transcript.innerHTML = '';
      if (welcomeCard && transcript) {
        transcript.appendChild(welcomeCard);
        welcomeCard.style.display = 'block';
      }
      updateContextWindowMeter();
    }

    function compactDockedThread() {
      if (dockedMessages.length <= 4) {
        if (typeof window.showToast === 'function') window.showToast('Context is already compact.');
        return;
      }
      const kept = dockedMessages.slice(-4);
      const droppedCount = dockedMessages.length - kept.length;
      dockedMessages = [
        { role: 'assistant', content: `[Compacted ${droppedCount} earlier messages to free context window]` },
        ...kept
      ];
      updateContextWindowMeter();
      if (typeof window.showToast === 'function') {
        window.showToast(`Compacted ${droppedCount} messages.`);
      }
    }

    if (btnToggleCopilot) btnToggleCopilot.addEventListener('click', toggleCopilotDock);
    if (btnDockedCollapse) btnDockedCollapse.addEventListener('click', toggleCopilotDock);
    if (btnDockedNewChat) btnDockedNewChat.addEventListener('click', resetDockedThread);

    // Context Window Popover & Controls
    const ctxPopover = document.getElementById('ide-context-popover');
    const btnCtxMeter = document.getElementById('btn-ide-context-meter');
    const btnStatusCtx = document.getElementById('status-context-btn');
    const btnCtxCompact = document.getElementById('btn-ctx-compact');
    const btnDockedCompact = document.getElementById('btn-docked-compact');
    const btnCtxClear = document.getElementById('btn-ctx-clear');

    const toggleCtxPopover = (e) => {
      e.stopPropagation();
      if (!ctxPopover) return;
      updateContextWindowMeter();
      ctxPopover.classList.toggle('hidden');
    };
    if (btnCtxMeter) btnCtxMeter.addEventListener('click', toggleCtxPopover);
    if (btnStatusCtx) btnStatusCtx.addEventListener('click', toggleCtxPopover);
    if (btnCtxCompact) btnCtxCompact.addEventListener('click', () => { compactDockedThread(); if (ctxPopover) ctxPopover.classList.add('hidden'); });
    if (btnDockedCompact) btnDockedCompact.addEventListener('click', compactDockedThread);
    if (btnCtxClear) btnCtxClear.addEventListener('click', () => { resetDockedThread(); if (ctxPopover) ctxPopover.classList.add('hidden'); });

    document.addEventListener('click', (e) => {
      if (ctxPopover && !ctxPopover.classList.contains('hidden')) {
        if (!ctxPopover.contains(e.target) && e.target !== btnCtxMeter && e.target !== btnStatusCtx) {
          ctxPopover.classList.add('hidden');
        }
      }
    });

    // Toggle active file inclusion
    const btnToggleActiveFileCtx = document.getElementById('btn-toggle-active-file-ctx');
    if (btnToggleActiveFileCtx) {
      btnToggleActiveFileCtx.addEventListener('click', (e) => {
        e.stopPropagation();
        includeActiveFileInContext = !includeActiveFileInContext;
        updateDockedContextLabel();
      });
    }

    // @ Mention File Picker
    const mentionPopup = document.getElementById('ide-mention-popup');
    const mentionList = document.getElementById('ide-mention-list');
    const btnAddContext = document.getElementById('btn-docked-add-context');

    async function openMentionPopup(query = '') {
      if (!mentionPopup || !mentionList) return;
      if (quickFilesCache.length === 0 && window.electronAPI && window.electronAPI.ideListAllFiles) {
        try {
          const res = await window.electronAPI.ideListAllFiles();
          if (res && res.success && Array.isArray(res.files)) {
            quickFilesCache = res.files;
          }
        } catch (e) {}
      }
      const q = query.trim().toLowerCase();
      mentionFilteredFiles = quickFilesCache
        .filter(f => !q || (f.name && f.name.toLowerCase().includes(q)) || (f.relativePath && f.relativePath.toLowerCase().includes(q)))
        .slice(0, 12);

      mentionList.innerHTML = '';
      if (mentionFilteredFiles.length === 0) {
        mentionList.innerHTML = '<div class="ide-mention-item" style="color:#71717a;">No matching files</div>';
      } else {
        if (mentionSelectedIndex >= mentionFilteredFiles.length) mentionSelectedIndex = 0;
        mentionFilteredFiles.forEach((f, idx) => {
          const item = document.createElement('div');
          item.className = `ide-mention-item ${idx === mentionSelectedIndex ? 'selected' : ''}`;
          item.innerHTML = `<span>${escapeHTML(f.name)}</span><span class="ide-mention-path">${escapeHTML(f.relativePath || '')}</span>`;
          item.addEventListener('click', () => {
            attachFileToContext(f);
            if (dockedTextarea) {
              dockedTextarea.value = dockedTextarea.value.replace(/@[^\s]*$/, '');
              dockedTextarea.focus();
            }
            mentionPopup.classList.add('hidden');
          });
          mentionList.appendChild(item);
        });
      }
      mentionPopup.classList.remove('hidden');
    }

    if (btnAddContext) {
      btnAddContext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mentionPopup && !mentionPopup.classList.contains('hidden')) {
          mentionPopup.classList.add('hidden');
        } else {
          openMentionPopup('');
        }
      });
    }

    // Bottom Panel Tabs (Terminal, Problems, Output) + Maximize
    function switchBottomPanelTab(tabName) {
      document.querySelectorAll('.ide-panel-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-panel-tab') === tabName);
      });
      const termBody = document.getElementById('xterm-terminal-container');
      const probPane = document.getElementById('ide-problems-pane');
      const outPane = document.getElementById('ide-output-pane');
      if (termBody) termBody.classList.toggle('hidden', tabName !== 'terminal');
      if (probPane) probPane.classList.toggle('hidden', tabName !== 'problems');
      if (outPane) outPane.classList.toggle('hidden', tabName !== 'output');
      if (tabName === 'terminal' && terminalFitAddon && activeTerminal) {
        setTimeout(() => terminalFitAddon.fit(), 40);
      }
    }

    document.querySelectorAll('.ide-panel-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-panel-tab');
        if (t) switchBottomPanelTab(t);
      });
    });

    const btnMaxTerm = document.getElementById('btn-maximize-terminal');
    if (btnMaxTerm) {
      btnMaxTerm.addEventListener('click', () => {
        const dock = document.getElementById('ide-terminal-dock');
        if (dock) {
          dock.classList.toggle('maximized');
          if (terminalFitAddon && activeTerminal) setTimeout(() => terminalFitAddon.fit(), 60);
          if (activeEditor) setTimeout(() => activeEditor.layout(), 60);
        }
      });
    }

    // Status Bar Action Buttons
    const statusGitBtn = document.getElementById('status-git-branch-btn');
    const statusProbBtn = document.getElementById('status-problems-btn');
    const statusTermBtn = document.getElementById('status-terminal-btn');
    if (statusGitBtn) statusGitBtn.addEventListener('click', () => switchSidebarTab('git'));
    if (statusProbBtn) statusProbBtn.addEventListener('click', () => {
      const dock = document.getElementById('ide-terminal-dock');
      if (dock && dock.classList.contains('collapsed')) toggleTerminalDock();
      switchBottomPanelTab('problems');
    });
    if (statusTermBtn) statusTermBtn.addEventListener('click', toggleTerminalDock);

    // Split-Pane Drag Resizers
    function setupResizer(resizerId, targetId, direction, invert = false, minSize = 160, maxSize = 600) {
      const resizer = document.getElementById(resizerId);
      const target = document.getElementById(targetId);
      if (!resizer || !target) return;

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizer.classList.add('dragging');
        const startPos = direction === 'v' ? e.clientX : e.clientY;
        const startSize = direction === 'v' ? target.getBoundingClientRect().width : target.getBoundingClientRect().height;

        const onMove = (moveEvent) => {
          const delta = (direction === 'v' ? moveEvent.clientX : moveEvent.clientY) - startPos;
          const next = Math.max(minSize, Math.min(maxSize, startSize + (invert ? -delta : delta)));
          if (direction === 'v') {
            target.style.width = `${next}px`;
          } else {
            target.style.height = `${next}px`;
          }
          if (activeEditor) activeEditor.layout();
          if (terminalFitAddon && activeTerminal) terminalFitAddon.fit();
        };

        const onUp = () => {
          resizer.classList.remove('dragging');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }

    setupResizer('ide-resizer-sidebar', 'ide-sidebar-pane', 'v', false, 170, 460);
    setupResizer('ide-resizer-copilot', 'ide-docked-chat-pane', 'v', true, 300, 620);
    setupResizer('ide-resizer-terminal', 'ide-terminal-dock', 'h', true, 110, 560);

    // Sync initial context meter
    updateContextWindowMeter();

    if (btnDockedSend) btnDockedSend.addEventListener('click', handleSendDockedMessage);
    if (dockedTextarea) {
      dockedTextarea.addEventListener('keydown', (e) => {
        if (mentionPopup && !mentionPopup.classList.contains('hidden')) {
          if (e.key === 'Escape') {
            e.preventDefault();
            mentionPopup.classList.add('hidden');
            return;
          }
          if (e.key === 'ArrowDown' && mentionFilteredFiles.length > 0) {
            e.preventDefault();
            mentionSelectedIndex = (mentionSelectedIndex + 1) % mentionFilteredFiles.length;
            openMentionPopup(dockedTextarea.value.match(/@([^\s]*)$/)?.[1] || '');
            return;
          }
          if (e.key === 'ArrowUp' && mentionFilteredFiles.length > 0) {
            e.preventDefault();
            mentionSelectedIndex = (mentionSelectedIndex - 1 + mentionFilteredFiles.length) % mentionFilteredFiles.length;
            openMentionPopup(dockedTextarea.value.match(/@([^\s]*)$/)?.[1] || '');
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey && mentionFilteredFiles[mentionSelectedIndex]) {
            e.preventDefault();
            attachFileToContext(mentionFilteredFiles[mentionSelectedIndex]);
            dockedTextarea.value = dockedTextarea.value.replace(/@[^\s]*$/, '');
            mentionPopup.classList.add('hidden');
            return;
          }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendDockedMessage();
        }
      });
      dockedTextarea.addEventListener('input', () => {
        dockedTextarea.style.height = 'auto';
        dockedTextarea.style.height = Math.min(dockedTextarea.scrollHeight, 140) + 'px';
        const match = dockedTextarea.value.match(/@([^\s]*)$/);
        if (match) {
          openMentionPopup(match[1]);
        } else if (mentionPopup) {
          mentionPopup.classList.add('hidden');
        }
      });
    }

    if (btnDockedVoice) {
      btnDockedVoice.addEventListener('click', () => {
        const mainMic = document.getElementById('btn-voice-record');
        if (mainMic) mainMic.click();
      });
    }

    // Quick prompt chips in docked welcome card
    document.querySelectorAll('.docked-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const p = chip.getAttribute('data-prompt');
        if (p && dockedTextarea) {
          dockedTextarea.value = p;
          handleSendDockedMessage();
        }
      });
    });

    // Return to Main Chat button
    const btnReturnChat = document.getElementById('btn-return-to-chat');
    if (btnReturnChat) {
      btnReturnChat.addEventListener('click', (e) => {
        e.preventDefault();
        switchMode('chat');
      });
    }

    // P1 Quick File Switcher (Ctrl+P)
    const btnQuickOpen = document.getElementById('btn-quick-open-file');
    const quickModal = document.getElementById('quick-file-switcher-modal');
    const quickBackdrop = document.getElementById('quick-file-backdrop');
    const quickInput = document.getElementById('quick-file-input');

    if (btnQuickOpen) btnQuickOpen.addEventListener('click', showQuickFileSwitcher);
    if (quickBackdrop) quickBackdrop.addEventListener('click', hideQuickFileSwitcher);

    if (quickInput) {
      quickInput.addEventListener('input', (e) => {
        renderQuickFiles(e.target.value);
      });

      quickInput.addEventListener('keydown', (e) => {
        const items = document.querySelectorAll('.quick-file-item');
        if (e.key === 'Escape') {
          hideQuickFileSwitcher();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (items.length > 0) {
            quickSelectedIndex = (quickSelectedIndex + 1) % items.length;
            renderQuickFiles(quickInput.value);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (items.length > 0) {
            quickSelectedIndex = (quickSelectedIndex - 1 + items.length) % items.length;
            renderQuickFiles(quickInput.value);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const selected = document.querySelector('.quick-file-item.selected');
          if (selected) {
            selected.click();
          }
        }
      });
    }

    // P1 Global Search (Ctrl+Shift+F)
    const globalSearchInput = document.getElementById('global-search-input');
    const btnOptCase = document.getElementById('btn-search-opt-case');
    const btnOptWord = document.getElementById('btn-search-opt-word');
    const btnOptRegex = document.getElementById('btn-search-opt-regex');

    if (btnOptCase) {
      btnOptCase.addEventListener('click', () => {
        searchOptions.caseSensitive = !searchOptions.caseSensitive;
        btnOptCase.classList.toggle('active', searchOptions.caseSensitive);
        performGlobalSearch();
      });
    }
    if (btnOptWord) {
      btnOptWord.addEventListener('click', () => {
        searchOptions.wholeWord = !searchOptions.wholeWord;
        btnOptWord.classList.toggle('active', searchOptions.wholeWord);
        performGlobalSearch();
      });
    }
    if (btnOptRegex) {
      btnOptRegex.addEventListener('click', () => {
        searchOptions.regex = !searchOptions.regex;
        btnOptRegex.classList.toggle('active', searchOptions.regex);
        performGlobalSearch();
      });
    }

    if (globalSearchInput) {
      globalSearchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(performGlobalSearch, 300);
      });
      globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          performGlobalSearch();
        }
      });
    }

    // Activity Rail Navigation for IDE
    const railWorkspace = document.getElementById('rail-btn-workspace');
    if (railWorkspace) {
      railWorkspace.addEventListener('click', () => {
        switchSidebarTab('explorer');
        switchMode('ide');
      });
    }

    const railHome = document.getElementById('rail-btn-home');
    if (railHome) {
      railHome.addEventListener('click', () => {
        switchMode('chat');
      });
    }

    // Git Commit Button
    const btnGitCommit = document.getElementById('btn-git-commit');
    const inputGitMsg = document.getElementById('git-commit-msg');
    if (btnGitCommit && inputGitMsg) {
      btnGitCommit.addEventListener('click', async () => {
        const msg = inputGitMsg.value.trim();
        if (!msg) return;
        if (window.electronAPI && window.electronAPI.ideGitCommit) {
          const res = await window.electronAPI.ideGitCommit(msg);
          if (res && res.success) {
            inputGitMsg.value = '';
            refreshGitStatus();
            if (typeof window.showToast === 'function') {
              window.showToast('Git commit successful!');
            }
          }
        }
      });
    }

    // Live Frontend Preview Pane
    const previewPane = document.getElementById('ide-preview-pane');
    const previewFrame = document.getElementById('ide-live-preview-frame');
    const previewLabel = document.getElementById('ide-preview-label');
    const btnTogglePreview = document.getElementById('btn-toggle-preview');
    const btnPreviewDesktop = document.getElementById('btn-preview-desktop');
    const btnPreviewMobile = document.getElementById('btn-preview-mobile');
    const btnPreviewReload = document.getElementById('btn-preview-reload');
    const btnPreviewClose = document.getElementById('btn-preview-close');

    function refreshLivePreview() {
      if (!previewFrame || !previewPane || previewPane.classList.contains('hidden')) return;
      const activeTab = openTabs.find(t => t.id === activeTabId);
      let htmlDoc = '';
      if (activeTab) {
        const val = activeTab.model ? activeTab.model.getValue() : (activeTab.content || '');
        const ext = (activeTab.extension || '').toLowerCase();
        if (ext === '.html' || ext === '.htm') {
          htmlDoc = val;
          if (previewLabel) previewLabel.textContent = activeTab.name;
        } else if (ext === '.css') {
          htmlDoc = `<!DOCTYPE html><html><head><style>${val}</style></head><body style="font-family:sans-serif;padding:24px;"><h2>CSS Preview (${escapeHTML(activeTab.name)})</h2><button>Sample Button</button><div class="card" style="margin-top:12px;padding:12px;border:1px solid #ccc;">Sample Container</div></body></html>`;
          if (previewLabel) previewLabel.textContent = `CSS: ${activeTab.name}`;
        } else {
          // Search open HTML tab or workspace index.html
          const htmlTab = openTabs.find(t => t.extension === '.html' || t.extension === '.htm');
          if (htmlTab) {
            htmlDoc = htmlTab.model ? htmlTab.model.getValue() : htmlTab.content;
            if (previewLabel) previewLabel.textContent = htmlTab.name;
          } else {
            htmlDoc = `<!DOCTYPE html><html><body style="font-family:system-ui;background:#0c0c0e;color:#a1a1aa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><div style="font-size:14px;color:#f4f4f5;margin-bottom:6px;">Frontend Live Preview</div><div style="font-size:12px;">Open an <code>.html</code> or <code>.css</code> file to preview live changes.</div></div></body></html>`;
            if (previewLabel) previewLabel.textContent = 'Live Preview';
          }
        }
      } else {
        htmlDoc = `<!DOCTYPE html><html><body style="font-family:system-ui;background:#0c0c0e;color:#a1a1aa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="font-size:12px;">Open an <code>.html</code> file to preview.</div></body></html>`;
      }
      previewFrame.srcdoc = htmlDoc;
    }

    function togglePreviewPane() {
      if (!previewPane) return;
      const willShow = previewPane.classList.contains('hidden');
      previewPane.classList.toggle('hidden', !willShow);
      if (btnTogglePreview) btnTogglePreview.classList.toggle('active-copilot', willShow);
      if (willShow) refreshLivePreview();
      if (activeEditor) setTimeout(() => activeEditor.layout(), 60);
    }

    if (btnTogglePreview) btnTogglePreview.addEventListener('click', togglePreviewPane);
    window.addEventListener('sparx:file-saved', refreshLivePreview);
    if (btnPreviewClose) btnPreviewClose.addEventListener('click', togglePreviewPane);
    if (btnPreviewReload) btnPreviewReload.addEventListener('click', refreshLivePreview);
    if (btnPreviewDesktop && btnPreviewMobile && previewFrame) {
      btnPreviewDesktop.addEventListener('click', () => {
        previewFrame.classList.remove('mobile');
        btnPreviewDesktop.classList.add('active');
        btnPreviewMobile.classList.remove('active');
      });
      btnPreviewMobile.addEventListener('click', () => {
        previewFrame.classList.add('mobile');
        btnPreviewMobile.classList.add('active');
        btnPreviewDesktop.classList.remove('active');
      });
    }

    // Ctrl+K Floating Inline Edit Bar
    const inlineBar = document.getElementById('ide-inline-edit-bar');
    const inlineInput = document.getElementById('inline-edit-input');
    const inlineScope = document.getElementById('inline-edit-scope');
    const btnInlineClose = document.getElementById('btn-inline-edit-close');
    const btnInlineSubmit = document.getElementById('btn-inline-edit-submit');

    function openInlineEditBar() {
      const activeTab = openTabs.find(t => t.id === activeTabId);
      if (!activeTab || !inlineBar) {
        if (typeof window.showToast === 'function') window.showToast('Open a file first to use inline edit.');
        return;
      }
      if (inlineScope) {
        inlineScope.textContent = activeSelectionContext
          ? `${activeTab.name}:${activeSelectionContext.startLine}-${activeSelectionContext.endLine}`
          : activeTab.name;
      }
      inlineBar.classList.remove('hidden');
      if (inlineInput) {
        inlineInput.value = '';
        inlineInput.focus();
      }
    }

    function closeInlineEditBar() {
      if (inlineBar) inlineBar.classList.add('hidden');
      if (activeEditor) activeEditor.focus();
    }

    async function submitInlineEdit() {
      const instruction = inlineInput ? inlineInput.value.trim() : '';
      const activeTab = openTabs.find(t => t.id === activeTabId);
      if (!instruction || !activeTab) return;
      closeInlineEditBar();

      const fullCode = activeTab.model ? activeTab.model.getValue() : activeTab.content;
      const selectionNote = activeSelectionContext
        ? `Focus on lines ${activeSelectionContext.startLine}-${activeSelectionContext.endLine}:\n\`\`\`\n${activeSelectionContext.text}\n\`\`\`\n`
        : '';

      const prompt = `Edit \`${activeTab.relativePath || activeTab.name}\`: ${instruction}\n\n${selectionNote}Return the complete updated file inside a single fenced code block so it can be diffed directly.`;

      // Ensure assistant pane is visible so user sees the stream + Apply button
      const chatPane = document.getElementById('ide-docked-chat-pane');
      if (chatPane && chatPane.classList.contains('collapsed')) {
        toggleCopilotDock();
      }
      handleSendDockedMessage(prompt);
    }

    if (btnInlineClose) btnInlineClose.addEventListener('click', closeInlineEditBar);
    if (btnInlineSubmit) btnInlineSubmit.addEventListener('click', submitInlineEdit);
    if (inlineInput) {
      inlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeInlineEditBar();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          submitInlineEdit();
        }
      });
    }

    // Explorer New File / New Folder / Refresh Actions
    const btnNewFile = document.getElementById('btn-new-file');
    const btnNewFolder = document.getElementById('btn-new-folder');
    const btnRefreshExplorer = document.getElementById('btn-refresh-explorer');

    if (btnRefreshExplorer) btnRefreshExplorer.addEventListener('click', loadWorkspaceTree);
    if (btnNewFile) {
      btnNewFile.addEventListener('click', async () => {
        if (!currentWorkspaceTree || !currentWorkspaceTree.path) {
          if (typeof window.showToast === 'function') window.showToast('Open a folder first.');
          return;
        }
        const name = window.prompt('New file name (relative to workspace):');
        if (!name || !name.trim()) return;
        const target = `${currentWorkspaceTree.path}\\${name.trim().replace(/\//g, '\\')}`;
        if (window.electronAPI && window.electronAPI.ideCreateFile) {
          const res = await window.electronAPI.ideCreateFile(target);
          if (res && res.success) {
            await loadWorkspaceTree();
            openFileInEditor(target);
          }
        }
      });
    }
    if (btnNewFolder) {
      btnNewFolder.addEventListener('click', async () => {
        if (!currentWorkspaceTree || !currentWorkspaceTree.path) {
          if (typeof window.showToast === 'function') window.showToast('Open a folder first.');
          return;
        }
        const name = window.prompt('New folder name (relative to workspace):');
        if (!name || !name.trim()) return;
        const target = `${currentWorkspaceTree.path}\\${name.trim().replace(/\//g, '\\')}`;
        if (window.electronAPI && window.electronAPI.ideCreateFolder) {
          const res = await window.electronAPI.ideCreateFolder(target);
          if (res && res.success) {
            await loadWorkspaceTree();
          }
        }
      });
    }

    // Command Palette (Ctrl+Shift+P / F1)
    const cmdModal = document.getElementById('command-palette-modal');
    const cmdBackdrop = document.getElementById('command-palette-backdrop');
    const cmdInput = document.getElementById('command-palette-input');
    const cmdResults = document.getElementById('command-palette-results');
    let cmdSelectedIndex = 0;

    const IDE_COMMANDS = [
      { label: 'File: Quick Open', kbd: 'Ctrl+P', run: () => showQuickFileSwitcher() },
      { label: 'File: Save Active File', kbd: 'Ctrl+S', run: () => saveActiveTab() },
      { label: 'File: Open Folder...', kbd: 'Ctrl+O', run: () => handleSelectFolder() },
      { label: 'View: Toggle Terminal', kbd: 'Ctrl+`', run: () => toggleTerminalDock() },
      { label: 'View: Toggle Live Frontend Preview', kbd: '', run: () => togglePreviewPane() },
      { label: 'View: Toggle AI Assistant', kbd: 'Ctrl+L', run: () => toggleCopilotDock() },
      { label: 'Editor: Inline AI Edit', kbd: 'Ctrl+K', run: () => openInlineEditBar() },
      { label: 'View: Explorer', kbd: 'Ctrl+Shift+E', run: () => { switchMode('ide'); switchSidebarTab('explorer'); } },
      { label: 'View: Search Workspace', kbd: 'Ctrl+Shift+F', run: () => { switchMode('ide'); switchSidebarTab('search'); } },
      { label: 'View: Source Control (Git)', kbd: 'Ctrl+Shift+G', run: () => { switchMode('ide'); switchSidebarTab('git'); } },
      { label: 'View: Switch to Chat View', kbd: 'Ctrl+Shift+C', run: () => switchMode('chat') },
      { label: 'Editor: Go to Line', kbd: 'Ctrl+G', run: () => { if (activeEditor) activeEditor.trigger('keyboard', 'editor.action.gotoLine', null); } },
      { label: 'Assistant: Compact Context Window', kbd: '', run: () => compactDockedThread() },
      { label: 'Assistant: Clear Thread', kbd: '', run: () => resetDockedThread() },
      { label: 'Git: Refresh Status', kbd: '', run: () => refreshGitStatus() }
    ];

    function renderCommands(filter = '') {
      if (!cmdResults) return;
      const q = filter.trim().toLowerCase();
      const filtered = IDE_COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q));
      cmdResults.innerHTML = '';
      if (cmdSelectedIndex >= filtered.length) cmdSelectedIndex = 0;
      filtered.forEach((cmd, idx) => {
        const el = document.createElement('div');
        el.className = `quick-file-item ${idx === cmdSelectedIndex ? 'selected' : ''}`;
        el.innerHTML = `<span>${escapeHTML(cmd.label)}</span><span class="quick-file-path">${escapeHTML(cmd.kbd)}</span>`;
        el.addEventListener('click', () => {
          hideCommandPalette();
          cmd.run();
        });
        cmdResults.appendChild(el);
      });
    }

    function showCommandPalette() {
      if (!cmdModal) return;
      cmdSelectedIndex = 0;
      cmdModal.classList.remove('hidden');
      if (cmdInput) {
        cmdInput.value = '';
        cmdInput.focus();
      }
      renderCommands('');
    }

    function hideCommandPalette() {
      if (cmdModal) cmdModal.classList.add('hidden');
    }

    if (cmdBackdrop) cmdBackdrop.addEventListener('click', hideCommandPalette);
    if (cmdInput) {
      cmdInput.addEventListener('input', (e) => {
        cmdSelectedIndex = 0;
        renderCommands(e.target.value);
      });
      cmdInput.addEventListener('keydown', (e) => {
        const items = cmdResults ? cmdResults.querySelectorAll('.quick-file-item') : [];
        if (e.key === 'Escape') {
          hideCommandPalette();
        } else if (e.key === 'ArrowDown' && items.length > 0) {
          e.preventDefault();
          cmdSelectedIndex = (cmdSelectedIndex + 1) % items.length;
          renderCommands(cmdInput.value);
        } else if (e.key === 'ArrowUp' && items.length > 0) {
          e.preventDefault();
          cmdSelectedIndex = (cmdSelectedIndex - 1 + items.length) % items.length;
          renderCommands(cmdInput.value);
        } else if (e.key === 'Enter' && items[cmdSelectedIndex]) {
          e.preventDefault();
          items[cmdSelectedIndex].click();
        }
      });
    }

    // Global Keybindings:
    // Ctrl+Shift+P / F1 -> Command Palette
    // Ctrl+` -> Toggle Terminal
    // Ctrl+S -> Save
    // Ctrl+P -> Quick Open File
    // Ctrl+Shift+F -> Global Search
    // Ctrl+L -> Toggle Docked AI Assistant
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F1') {
        e.preventDefault();
        showCommandPalette();
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminalDock();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveTab();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        showQuickFileSwitcher();
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        switchMode('ide');
        switchSidebarTab('search');
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        switchMode('chat');
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleCopilotDock();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openInlineEditBar();
      }
      if (e.key === 'Escape') {
        hideQuickFileSwitcher();
        hideCommandPalette();
        closeInlineEditBar();
        if (pendingDiffData) {
          rejectPendingDiff();
        }
      }
      if (e.ctrlKey && e.key === 'Enter') {
        if (pendingDiffData) {
          e.preventDefault();
          acceptPendingDiff();
        }
      }
    });

    // Window Resize listener for xterm fit
    window.addEventListener('resize', () => {
      if (terminalFitAddon && activeTerminal) {
        terminalFitAddon.fit();
      }
      if (activeEditor) {
        activeEditor.layout();
      }
      if (activeDiffEditor) {
        activeDiffEditor.layout();
      }
    });

    // Launch directly into IDE workspace by default
    switchMode('ide');
  });

  // Expose Sparx IDE module to global scope
  window.SparxIDE = {
    openFileInEditor,
    switchMode,
    saveActiveTab,
    applyToEditor,
    acceptPendingDiff,
    rejectPendingDiff,
    toggleTerminalDock,
    toggleCopilotDock,
    showQuickFileSwitcher,
    hideQuickFileSwitcher,
    refreshGitStatus,
    loadWorkspaceTree
  };

})();
