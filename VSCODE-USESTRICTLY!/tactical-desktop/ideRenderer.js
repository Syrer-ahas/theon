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

  // Docked AI Copilot Chat State
  let dockedMessages = [];
  let isDockedStreaming = false;

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

        // Define Sparx Dark Obsidian OLED Theme
        monaco.editor.defineTheme('sparx-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { background: '070709' },
            { token: 'comment', foreground: '62626b', fontStyle: 'italic' },
            { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
            { token: 'identifier', foreground: 'f4f4f5' },
            { token: 'string', foreground: 'a7f3d0' },
            { token: 'number', foreground: 'fbbf24' },
            { token: 'type', foreground: 'c084fc' }
          ],
          colors: {
            'editor.background': '#070709',
            'editor.foreground': '#f4f4f5',
            'editorCursor.foreground': '#38bdf8',
            'editor.lineHighlightBackground': '#0d0d12',
            'editorLineNumber.foreground': '#3f3f46',
            'editorLineNumber.activeForeground': '#a1a1aa',
            'editor.selectionBackground': '#1e293b',
            'editor.inactiveSelectionBackground': '#0f172a',
            'editorWidget.background': '#0d0d10',
            'editorWidget.border': 'rgba(255,255,255,0.08)'
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
      refreshGitStatus();
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
    if (!label) return;
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab) {
      label.textContent = activeTab.relativePath || activeTab.name;
    } else {
      label.textContent = 'No file open in editor';
    }
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

    // Show Diff Review Banner at top of editor
    const banner = document.getElementById('ide-diff-review-banner');
    const bannerTitle = document.getElementById('diff-banner-title');
    const bannerStats = document.getElementById('diff-banner-stats');

    if (banner) {
      banner.classList.remove('hidden');
      if (bannerTitle) bannerTitle.textContent = `AI Changes: ${targetTab.name}`;
      if (bannerStats) bannerStats.textContent = `~${diffCount} lines changed`;
    }

    if (typeof window.showToast === 'function') {
      window.showToast('AI changes loaded in buffer. Review and Accept or Reject.');
    }
  }

  function acceptPendingDiff() {
    if (!pendingDiffData) return;
    const banner = document.getElementById('ide-diff-review-banner');
    if (banner) banner.classList.add('hidden');

    saveActiveTab();
    pendingDiffData = null;

    if (typeof window.showToast === 'function') {
      window.showToast('✓ Changes accepted and saved to file.');
    }
  }

  function rejectPendingDiff() {
    if (!pendingDiffData) return;
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

  async function handleSendDockedMessage() {
    const textarea = document.getElementById('docked-chat-textarea');
    const transcript = document.getElementById('docked-chat-transcript');
    const welcomeCard = document.getElementById('docked-welcome-card');
    if (!textarea || !transcript || isDockedStreaming) return;

    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    if (welcomeCard) welcomeCard.style.display = 'none';

    // 1. Append User Bubble
    const userMsg = { role: 'user', content: text };
    dockedMessages.push(userMsg);
    appendDockedBubble('user', text);

    // 2. Gather active file context
    const activeTab = openTabs.find(t => t.id === activeTabId);
    let contextualUserPrompt = text;
    if (activeTab) {
      const code = activeTab.model ? activeTab.model.getValue() : activeTab.content;
      contextualUserPrompt = `${text}\n\n[Active File Context: ${activeTab.relativePath || activeTab.name}]\n\`\`\`${activeTab.extension.replace('.', '')}\n${code}\n\`\`\``;
    }

    // 3. Create Assistant Live Bubble
    isDockedStreaming = true;
    const assistantBubble = appendDockedBubble('assistant', 'Thinking...');
    let assistantText = '';

    // Stream handlers
    const unsubChunk = window.electronAPI.onStreamChunk((chunk) => {
      if (!isDockedStreaming) return;
      const text = (chunk && chunk.text) || (typeof chunk === 'string' ? chunk : '');
      assistantText += text;
      renderDockedAssistantContent(assistantBubble, assistantText);
      transcript.scrollTop = transcript.scrollHeight;
    });

    const unsubEnd = window.electronAPI.onStreamEnd((data) => {
      isDockedStreaming = false;
      if (unsubChunk) unsubChunk();
      if (unsubEnd) unsubEnd();
      const finalTxt = (data && data.fullText) || assistantText || 'Done.';
      renderDockedAssistantContent(assistantBubble, finalTxt);
      dockedMessages.push({ role: 'assistant', content: finalTxt });
    });

    // Send to backend
    window.electronAPI.sendMessage({
      messages: [
        { role: 'system', content: 'You are Sparx, a world-class coding AI assistant embedded in the IDE. Provide concise, clean, production-ready code. Whenever providing code modifications or snippets, use markdown code blocks. Keep conversation calm, unbothered, and concise; respond to casual slang, banter, or unclear non-action messages with a short, natural redirect.' },
        { role: 'user', content: contextualUserPrompt }
      ],
      model: 'sparx-3.9-flash',
      mode: 'ide'
    });
  }

  function appendDockedBubble(role, content) {
    const transcript = document.getElementById('docked-chat-transcript');
    if (!transcript) return null;

    const msgEl = document.createElement('div');
    msgEl.className = `docked-msg ${role}`;
    msgEl.innerHTML = `
      <div class="docked-msg-role">
        ${role === 'user' ? 'You' : '<span style="color:#38bdf8;">✦ Sparx</span>'}
      </div>
      <div class="docked-msg-content">${escapeHTML(content)}</div>
    `;

    transcript.appendChild(msgEl);
    transcript.scrollTop = transcript.scrollHeight;
    return msgEl.querySelector('.docked-msg-content');
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
    if (branchEl) {
      branchEl.textContent = git && git.branch ? git.branch : 'No Git Repo';
    }

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
    currentMode = 'chat';
    const shell = document.getElementById('app-shell');
    const stage = document.getElementById('ide-workspace-stage');
    const btnChat = document.getElementById('btn-mode-chat');
    const btnIde = document.getElementById('btn-mode-ide');

    if (!shell) return;

    shell.classList.remove('mode-ide');
    shell.classList.add('mode-chat');
    if (stage) stage.classList.add('hidden');
    if (btnIde) btnIde.classList.remove('active');
    if (btnChat) btnChat.classList.add('active');
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

    if (btnToggleCopilot) btnToggleCopilot.addEventListener('click', toggleCopilotDock);
    if (btnDockedCollapse) btnDockedCollapse.addEventListener('click', toggleCopilotDock);
    if (btnDockedNewChat) {
      btnDockedNewChat.addEventListener('click', () => {
        dockedMessages = [];
        const transcript = document.getElementById('docked-chat-transcript');
        const welcomeCard = document.getElementById('docked-welcome-card');
        if (transcript) transcript.innerHTML = '';
        if (welcomeCard) {
          transcript.appendChild(welcomeCard);
          welcomeCard.style.display = 'block';
        }
      });
    }

    if (btnDockedSend) btnDockedSend.addEventListener('click', handleSendDockedMessage);
    if (dockedTextarea) {
      dockedTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendDockedMessage();
        }
      });
      dockedTextarea.addEventListener('input', () => {
        dockedTextarea.style.height = 'auto';
        dockedTextarea.style.height = Math.min(dockedTextarea.scrollHeight, 120) + 'px';
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

    // Global Keybindings:
    // Ctrl+` -> Toggle Terminal
    // Ctrl+S -> Save
    // Ctrl+P -> Quick Open File
    // Ctrl+Shift+F -> Global Search
    // Ctrl+L -> Toggle Docked AI Copilot
    window.addEventListener('keydown', (e) => {
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
      if (e.key === 'Escape') {
        hideQuickFileSwitcher();
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
    });
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
