// ============================================================================
// Tactical Studio Workstation — Renderer UI Controller
// Modern Tech Architecture · Dynamic 4-Hour Hero Greeting · Monochrome Rail
// Instant Hover Tooltips · Inline Accordion Usage · Full-Screen Settings View
// Seamless Silent Streaming & Session History Switching
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // --------------------------------------------------------------------------
  // 1. Core State
  // --------------------------------------------------------------------------
  let currentSessionId = null;
  let isStreaming = false;
  let activeAssistantCard = null;
  let activeAssistantText = '';
  let activeReasoningText = '';
  let activeStreamingMessageId = null;
  let streamSaveThrottleTimer = null;
  let currentModel = 'sparx-3.9-flash';
  let currentMode = 'chat';
  let replyHadError = false;

  // DOM Elements - Workstation & Chat
  const chatWorkspaceMain = document.getElementById('chat-workspace-main');
  const chatTranscript = document.getElementById('chat-transcript');
  const chatTextarea = document.getElementById('chat-textarea');
  const btnSendMessage = document.getElementById('btn-send-message');
  const btnVoiceRecord = document.getElementById('btn-voice-record');
  const voiceRecordingBanner = document.getElementById('voice-recording-banner');
  const voiceRecordingLabel = document.getElementById('voice-recording-label');
  const voiceRecordingTimer = document.getElementById('voice-recording-timer');
  const voiceSoundwaves = document.getElementById('voice-soundwaves');
  const btnVoiceCancel = document.getElementById('btn-voice-cancel');
  const btnVoiceDone = document.getElementById('btn-voice-done');
  const btnStopStream = document.getElementById('btn-stop-stream');
  const heroHeading = document.getElementById('hero-heading');

  // Sidebar & Navigation
  const sidebar = document.getElementById('workspace-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnNewChat = document.getElementById('btn-new-chat');
  const btnNewChatTop = document.getElementById('btn-new-chat-top');
  const sessionListContainer = document.getElementById('session-list');
  const activeFolderToggle = document.getElementById('active-folder-toggle');
  const folderSubItems = document.getElementById('folder-sub-items');
  const projectChatsList = document.getElementById('project-chats-list');

  // Activity Rail
  const railButtons = document.querySelectorAll('.rail-btn');
  const btnRailMore = document.getElementById('btn-rail-more');
  const btnUserAvatar = document.getElementById('btn-user-avatar');
  const avatarPopupMenu = document.getElementById('avatar-popup-menu');

  // Account Menu & Accordion Elements
  const menuUsageAccordion = document.getElementById('menu-usage-accordion');
  const menuUsageTrigger = document.getElementById('menu-usage-trigger');
  const menuSettingsBtn = document.getElementById('menu-settings-btn');
  const menuUpgradeLimits = document.getElementById('menu-upgrade-limits');
  const menuHelpBtn = document.getElementById('menu-help-btn');
  const menuLogoutBtn = document.getElementById('menu-logout-btn');
  const linkUpgradePlus = document.getElementById('link-upgrade-plus');
  const linkLearnMore = document.getElementById('link-learn-more');

  // --------------------------------------------------------------------------
  // STRICT LOGIN GATE (Google OAuth / Verified Email OTP Authentication)
  // --------------------------------------------------------------------------
  const loginGateScreen = document.getElementById('login-gate-screen');
  const btnGoogleOAuth = document.getElementById('btn-google-oauth');
  const formLoginAuth = document.getElementById('form-login-auth');
  const inputLoginEmail = document.getElementById('login-email-input');
  const inputLoginPassword = document.getElementById('login-password-input');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');

  const formLoginOtp = document.getElementById('form-login-otp');
  const inputLoginOtp = document.getElementById('login-otp-input');
  const otpTargetEmail = document.getElementById('otp-target-email');
  const btnOtpVerify = document.getElementById('btn-otp-verify');
  const btnOtpBack = document.getElementById('btn-otp-back');
  const loginStatusMsg = document.getElementById('login-status-msg');

  let pendingAuthEmail = '';
  let pendingAuthPassword = '';

  function setLoginStatus(msg, type = 'info') {
    if (!loginStatusMsg) return;
    if (!msg) {
      loginStatusMsg.textContent = '';
      loginStatusMsg.className = 'login-status-msg hidden';
      return;
    }
    loginStatusMsg.textContent = msg;
    loginStatusMsg.className = `login-status-msg ${type}`;
    loginStatusMsg.classList.remove('hidden');
  }

  function applyUserProfile(user) {
    if (!user) return;
    const nameElem = document.querySelector('.popup-user-name');
    const tierElem = document.querySelector('.popup-user-tier');
    const avatarMini = document.querySelectorAll('.popup-avatar-mini');
    const userAvatarCircle = document.getElementById('btn-user-avatar');

    const displayName = user.name || (user.email ? user.email.split('@')[0] : 'Sparx Operator');
    const initials = (displayName || 'SO').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

    if (nameElem) nameElem.textContent = displayName;
    if (tierElem) tierElem.textContent = user.plan || 'Studio Pro';

    avatarMini.forEach(el => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;" />`;
      } else {
        el.textContent = initials;
      }
    });

    if (userAvatarCircle) {
      if (user.avatar) {
        userAvatarCircle.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;" />`;
      } else {
        userAvatarCircle.innerHTML = `<span>${initials}</span>`;
      }
      userAvatarCircle.title = `${displayName} (${user.email || ''})`;
    }
  }

  function showLoginGate() {
    if (loginGateScreen) {
      loginGateScreen.classList.remove('hidden');
      loginGateScreen.style.display = 'flex';
      loginGateScreen.style.opacity = '1';
      loginGateScreen.style.pointerEvents = 'all';
    }
  }

  function hideLoginGate() {
    if (loginGateScreen) {
      loginGateScreen.style.opacity = '0';
      loginGateScreen.style.pointerEvents = 'none';
      setTimeout(() => {
        loginGateScreen.classList.add('hidden');
        loginGateScreen.style.display = 'none';
      }, 300);
    }
  }

  async function checkAuthSession() {
    try {
      if (window.electronAPI && typeof window.electronAPI.getSession === 'function') {
        const session = await window.electronAPI.getSession();
        if (!session || !session.authenticated) {
          showLoginGate();
        } else {
          hideLoginGate();
          applyUserProfile(session.user);
        }
      }
    } catch (e) {
      console.warn('[Auth] Check session error:', e);
    }
  }

  if (btnGoogleOAuth) {
    btnGoogleOAuth.addEventListener('click', async () => {
      btnGoogleOAuth.classList.add('opacity-70');
      btnGoogleOAuth.disabled = true;
      setLoginStatus('Opening Google Sign-In in browser...', 'info');
      try {
        const res = await window.electronAPI.googleSignIn();
        if (res && res.success) {
          setLoginStatus(`✓ Signed in as ${res.user.email}`, 'success');
          showToast(`✓ Signed in as ${res.user.email}`);
          hideLoginGate();
          applyUserProfile(res.user);
        } else if (res && res.error) {
          setLoginStatus(res.error, 'error');
          showToast(`Sign-in error: ${res.error}`);
        }
      } catch (err) {
        setLoginStatus(err.message, 'error');
        showToast(`Sign-in error: ${err.message}`);
      } finally {
        btnGoogleOAuth.classList.remove('opacity-70');
        btnGoogleOAuth.disabled = false;
      }
    });
  }

  // Handle Email & Password Submission (Login or Register via OTP)
  if (formLoginAuth) {
    formLoginAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoginStatus('');
      const email = inputLoginEmail ? inputLoginEmail.value.trim().toLowerCase() : '';
      const password = inputLoginPassword ? inputLoginPassword.value : '';

      if (!email || !email.includes('@')) {
        setLoginStatus('Please enter a valid email address.', 'error');
        return;
      }

      if (!password || password.length < 6) {
        setLoginStatus('Password must be at least 6 characters.', 'error');
        return;
      }

      if (btnAuthSubmit) {
        btnAuthSubmit.disabled = true;
        btnAuthSubmit.textContent = 'Checking...';
      }

      try {
        // First check email domain and registration status
        const status = await window.electronAPI.checkEmailStatus(email);
        if (!status.valid) {
          setLoginStatus(status.error || 'Only verified email providers are accepted.', 'error');
          return;
        }

        if (status.exists) {
          // Returning user: authenticate directly with saved password
          btnAuthSubmit.textContent = 'Signing in...';
          const loginRes = await window.electronAPI.loginWithPassword({ email, password });
          if (loginRes.success) {
            setLoginStatus(`✓ Welcome back, ${loginRes.user.name}!`, 'success');
            showToast(`✓ Welcome back, ${loginRes.user.name}`);
            hideLoginGate();
            applyUserProfile(loginRes.user);
          } else {
            setLoginStatus(loginRes.error || 'Incorrect password.', 'error');
          }
        } else {
          // New user: request OTP verification
          btnAuthSubmit.textContent = 'Generating OTP...';
          const otpRes = await window.electronAPI.requestSignupOtp({ email, password });
          if (otpRes.success) {
            pendingAuthEmail = email;
            pendingAuthPassword = password;

            // Switch to OTP card
            formLoginAuth.classList.add('hidden');
            formLoginOtp.classList.remove('hidden');
            if (otpTargetEmail) otpTargetEmail.textContent = email;
            if (inputLoginOtp) {
              inputLoginOtp.value = '';
              inputLoginOtp.focus();
            }

            setLoginStatus(`Verification code generated: ${otpRes.otpPreview || 'Check notification'}`, 'info');
            showToast(`Verification code: ${otpRes.otpPreview || 'Sent to notification'}`);
          } else {
            setLoginStatus(otpRes.error || 'Failed to generate verification code.', 'error');
          }
        }
      } catch (err) {
        setLoginStatus(`Error: ${err.message}`, 'error');
      } finally {
        if (btnAuthSubmit) {
          btnAuthSubmit.disabled = false;
          btnAuthSubmit.textContent = 'Continue';
        }
      }
    });
  }

  // Handle OTP Verification Submission
  if (formLoginOtp) {
    formLoginOtp.addEventListener('submit', async (e) => {
      e.preventDefault();
      setLoginStatus('');
      const otp = inputLoginOtp ? inputLoginOtp.value.trim() : '';

      if (!otp || otp.length < 6) {
        setLoginStatus('Please enter the complete 6-digit code.', 'error');
        return;
      }

      if (btnOtpVerify) {
        btnOtpVerify.disabled = true;
        btnOtpVerify.textContent = 'Verifying...';
      }

      try {
        const verifyRes = await window.electronAPI.verifyOtpAndRegister({
          email: pendingAuthEmail,
          otp
        });

        if (verifyRes.success) {
          setLoginStatus('✓ Verification successful! Account activated.', 'success');
          showToast(`✓ Account verified: ${verifyRes.user.email}`);
          hideLoginGate();
          applyUserProfile(verifyRes.user);
        } else {
          setLoginStatus(verifyRes.error || 'Invalid verification code.', 'error');
        }
      } catch (err) {
        setLoginStatus(`Verification error: ${err.message}`, 'error');
      } finally {
        if (btnOtpVerify) {
          btnOtpVerify.disabled = false;
          btnOtpVerify.textContent = 'Verify & Sign In';
        }
      }
    });
  }

  if (btnOtpBack) {
    btnOtpBack.addEventListener('click', () => {
      formLoginOtp.classList.add('hidden');
      formLoginAuth.classList.remove('hidden');
      setLoginStatus('');
    });
  }

  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', async () => {
      if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
        await window.electronAPI.logout();
        showToast('Logged out of Sparx');
        showLoginGate();
      }
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onAuthStateChanged === 'function') {
    window.electronAPI.onAuthStateChanged((session) => {
      if (!session || !session.authenticated) {
        showLoginGate();
      } else {
        hideLoginGate();
        applyUserProfile(session.user);
      }
    });
  }

  // Trigger initial auth check
  checkAuthSession();

  // Dedicated Full-Screen Settings View Elements
  const settingsViewPage = document.getElementById('settings-view-page');
  const btnSettingsBack = document.getElementById('btn-settings-back');
  const settingsNavItems = document.querySelectorAll('.settings-nav-item');

  // Destination Views Elements & Transitions
  const destinationViewsContainer = document.getElementById('destination-views-container');
  const destinationPanes = document.querySelectorAll('.dest-pane, .destination-pane');
  const destBackButtons = document.querySelectorAll('.btn-dest-back');

  // Window Controls (Native Windows Style)
  const btnClose = document.getElementById('btn-close');
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');

  if (btnClose) btnClose.addEventListener('click', () => window.electronAPI.close());
  if (btnMin) btnMin.addEventListener('click', () => window.electronAPI.minimize());
  if (btnMax) {
    btnMax.addEventListener('click', () => window.electronAPI.maximizeToggle());
    if (window.electronAPI && typeof window.electronAPI.onMaximizeStatus === 'function') {
      window.electronAPI.onMaximizeStatus((isMax) => {
        btnMax.title = isMax ? 'Restore Down' : 'Maximize';
        btnMax.setAttribute('aria-label', isMax ? 'Restore Down' : 'Maximize');
        if (isMax) {
          btnMax.innerHTML = `
            <svg class="win-icon-restore" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 0.5H9.5V7.5M0.5 2.5H7.5V9.5H0.5V2.5Z" stroke="currentColor" stroke-width="1"/>
            </svg>
          `;
        } else {
          btnMax.innerHTML = `
            <svg class="win-icon-maximize" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1"/>
            </svg>
          `;
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Requirement 1: Dynamic Rotating Greeting (4-Hour Window Persistence)
  // --------------------------------------------------------------------------
  const GREETING_PHRASES = [
    "What should we work on?",
    "How are you, Bro?",
    "Good Afternoon",
    "How are we Today?",
    "Ready to build?",
    "Let's make something clean",
    "What's on the agenda?",
    "System online. What next?",
    "Sparx Workstation ready",
    "Let's push some code",
    "Where are we starting?"
  ];

  function updateHeroGreeting() {
    if (!heroHeading) return;
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const storedGreeting = localStorage.getItem('tactical_greeting_text');
    const storedTimestamp = parseInt(localStorage.getItem('tactical_greeting_timestamp') || '0', 10);
    const now = Date.now();

    if (storedGreeting && (now - storedTimestamp < FOUR_HOURS_MS)) {
      heroHeading.textContent = storedGreeting;
    } else {
      let available = GREETING_PHRASES.filter((g) => g !== storedGreeting);
      if (available.length === 0) available = GREETING_PHRASES;
      const picked = available[Math.floor(Math.random() * available.length)];
      localStorage.setItem('tactical_greeting_text', picked);
      localStorage.setItem('tactical_greeting_timestamp', now.toString());
      heroHeading.textContent = picked;
    }
  }

  // --------------------------------------------------------------------------
  // 3. Segmented Pill Switcher [ Chat | Work ] above Hero Greeting
  // --------------------------------------------------------------------------
  const appShell = document.getElementById('app-shell');
  const modePillButtons = document.querySelectorAll('.pill-btn');
  const pillGlider = document.getElementById('pill-slider-glider');
  const segmentedPillControl = document.getElementById('hero-mode-switch');

  function setMode(mode) {
    currentMode = mode;
    modePillButtons.forEach((b) => {
      const isActive = b.dataset.mode === mode;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (segmentedPillControl) {
      segmentedPillControl.setAttribute('data-active', mode);
    }
    if (pillGlider) {
      if (mode === 'work') {
        pillGlider.classList.add('glider-work');
      } else {
        pillGlider.classList.remove('glider-work');
      }
    }

    if (appShell && appShell.classList.contains('standalone-page-mode')) {
      showChatStage();
    }
    if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
      closeSettingsView();
    }

    if (chatTextarea) {
      if (mode === 'work') {
        chatTextarea.placeholder = 'Describe what you want Sparx to accomplish…';
        if (heroHeading) heroHeading.textContent = 'What should we work on?';
      } else {
        chatTextarea.placeholder = 'Ask Sparx anything…';
        updateHeroGreeting();
      }
      chatTextarea.focus();
    }
  }

  modePillButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
    });
  });

  // --------------------------------------------------------------------------
  // Attach Files Engine (Native File Dialog + Interactive Tray + Drag-and-Drop)
  // --------------------------------------------------------------------------
  let attachedFiles = [];
  const btnAttachFile = document.getElementById('btn-attach-file');
  const contextPillFiles = document.getElementById('context-pill-files');
  const attachedFilesTray = document.getElementById('attached-files-tray');
  const promptCapsuleCard = document.getElementById('prompt-capsule-card');
  const nativeFilePicker = document.getElementById('native-file-picker');

  if (nativeFilePicker) {
    nativeFilePicker.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      files.forEach((f) => {
        const p = f.path || f.name;
        if (!attachedFiles.some((existing) => existing.path === p)) {
          attachedFiles.push({
            name: f.name,
            path: p,
            size: f.size
          });
        }
      });
      renderAttachedFilesTray();
      if (chatTextarea) chatTextarea.focus();
      showToast(`Attached ${files.length} file${files.length === 1 ? '' : 's'}`);
      nativeFilePicker.value = '';
    });
  }

  async function handleAttachFiles() {
    let dialogSuccess = false;
    if (window.electronAPI && typeof window.electronAPI.openFileDialog === 'function') {
      try {
        const res = await window.electronAPI.openFileDialog({ title: 'Select workspace files to attach' });
        if (res && !res.canceled && res.files && res.files.length > 0) {
          res.files.forEach((f) => {
            if (!attachedFiles.some((existing) => existing.path === f.path)) {
              attachedFiles.push(f);
            }
          });
          renderAttachedFilesTray();
          if (chatTextarea) chatTextarea.focus();
          showToast(`Attached ${res.files.length} file${res.files.length === 1 ? '' : 's'}`);
          dialogSuccess = true;
          return;
        } else if (res && !res.canceled) {
          dialogSuccess = true;
        }
      } catch (err) {
        console.warn('[AttachFiles] Dialog error, fallback to HTML picker:', err);
      }
    }

    if (!dialogSuccess && nativeFilePicker) {
      nativeFilePicker.click();
    }
  }

  function renderAttachedFilesTray() {
    if (!attachedFilesTray) return;
    attachedFilesTray.innerHTML = '';
    if (attachedFiles.length === 0) {
      attachedFilesTray.classList.add('hidden');
      if (contextPillFiles) {
        contextPillFiles.classList.remove('has-attachments');
        contextPillFiles.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Files</span>
        `;
      }
      return;
    }

    attachedFilesTray.classList.remove('hidden');
    attachedFiles.forEach((f, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attached-file-chip';
      chip.title = f.path;
      chip.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        </svg>
        <span class="chip-name">${escapeHTML(f.name)}</span>
        <button class="btn-remove-chip" type="button" title="Remove file">×</button>
      `;
      chip.querySelector('.btn-remove-chip').addEventListener('click', (e) => {
        e.stopPropagation();
        attachedFiles.splice(idx, 1);
        renderAttachedFilesTray();
      });
      attachedFilesTray.appendChild(chip);
    });

    if (contextPillFiles) {
      contextPillFiles.classList.add('has-attachments');
      contextPillFiles.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        </svg>
        <span>Files (${attachedFiles.length})</span>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // Floating Tool & Attachment Popup (+ Button Engine - Matching Image 5)
  // --------------------------------------------------------------------------
  const tacticalAttachPopup = document.getElementById('tactical-attach-popup');
  const attachItemFiles = document.getElementById('attach-item-files');
  const attachItemWork = document.getElementById('attach-item-work');

  if (btnAttachFile) {
    btnAttachFile.addEventListener('click', (e) => {
      e.stopPropagation();
      const accessApprovalPopup = document.getElementById('access-approval-popup');
      if (accessApprovalPopup) accessApprovalPopup.classList.add('hidden');
      if (modelDropdownMenu) modelDropdownMenu.classList.add('hidden');
      if (avatarPopupMenu) avatarPopupMenu.classList.add('hidden');

      if (tacticalAttachPopup) {
        tacticalAttachPopup.classList.toggle('hidden');
      }
    });
  }

  if (attachItemFiles) {
    attachItemFiles.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tacticalAttachPopup) tacticalAttachPopup.classList.add('hidden');
      handleAttachFiles();
    });
  }

  if (attachItemWork) {
    attachItemWork.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tacticalAttachPopup) tacticalAttachPopup.classList.add('hidden');
      const workBtn = document.querySelector('.pill-btn[data-mode="work"]');
      if (workBtn) {
        workBtn.click();
      } else {
        if (typeof setMode === 'function') {
          setMode('work');
        } else {
          currentMode = 'work';
          if (chatTextarea) chatTextarea.placeholder = 'Describe what you want Sparx to accomplish…';
          if (heroHeading) heroHeading.textContent = 'What should we work on?';
        }
      }
      showToast('Switched to Work in Project mode');
    });
  }

  // Handle other rich tools in tacticalAttachPopup
  const attachOtherItems = [
    { id: 'attach-item-sketch', name: 'Sketch', prompt: 'Create or edit an architectural sketch / diagram.' },
    { id: 'attach-item-documents', name: 'Documents', prompt: 'Draft and review documentation.' },
    { id: 'attach-item-pdf', name: 'PDF', prompt: 'Inspect or generate a PDF report.' },
    { id: 'attach-item-spreadsheets', name: 'Spreadsheets', prompt: 'Analyze and format spreadsheet data.' },
    { id: 'attach-item-presentations', name: 'Presentations', prompt: 'Prepare presentation deck slides.' },
    { id: 'attach-item-template', name: 'Template Creator', prompt: 'Generate reusable template structure.' },
    { id: 'attach-item-browser', name: 'Browser', prompt: 'Open and control in-app browser session.' },
    { id: 'attach-item-studio', name: 'Attach Sparx', prompt: 'Attach Sparx runtime context.' },
    { id: 'attach-item-goal', name: 'Goal', prompt: 'Set an autonomous multi-step execution goal: ' }
  ];

  attachOtherItems.forEach(({ id, name, prompt }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tacticalAttachPopup) tacticalAttachPopup.classList.add('hidden');
        if (chatTextarea) {
          if (!chatTextarea.value.trim()) {
            chatTextarea.value = prompt;
          } else {
            chatTextarea.value += ' ' + prompt;
          }
          chatTextarea.focus();
        }
        showToast(`${name} tool attached`);
      });
    }
  });

  if (contextPillFiles) {
    contextPillFiles.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAttachFiles();
    });
  }

  if (promptCapsuleCard) {
    promptCapsuleCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      promptCapsuleCard.style.borderColor = '#38bdf8';
    });
    promptCapsuleCard.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      promptCapsuleCard.style.borderColor = '';
    });
    promptCapsuleCard.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      promptCapsuleCard.style.borderColor = '';
      if (e.dataTransfer && e.dataTransfer.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const filePath = file.path;
          if (filePath && !attachedFiles.some((f) => f.path === filePath)) {
            attachedFiles.push({
              path: filePath,
              name: file.name,
              ext: filePath.split('.').pop()
            });
          }
        }
        renderAttachedFilesTray();
        if (chatTextarea) chatTextarea.focus();
      }
    });
  }

  // Composer Plugins Chip Navigation (Requirement 5)
  const contextPillPlugins = document.getElementById('context-pill-plugins');
  if (contextPillPlugins) {
    contextPillPlugins.addEventListener('click', () => {
      showDestinationView('plugins');
    });
  }

  // Folder Tree Toggle in Sidebar
  if (activeFolderToggle && folderSubItems) {
    activeFolderToggle.addEventListener('click', () => {
      folderSubItems.style.display = folderSubItems.style.display === 'none' ? 'flex' : 'none';
    });
  }

  // --------------------------------------------------------------------------
  // 4. Custom Model Selector Dropdown
  // --------------------------------------------------------------------------
  const modelDropdown = document.getElementById('model-dropdown');
  const modelDropdownTrigger = document.getElementById('model-dropdown-trigger');
  const modelDropdownMenu = document.getElementById('model-dropdown-menu');
  const currentModelLabel = document.getElementById('current-model-label');
  const modelOptions = document.querySelectorAll('.model-option');

  if (modelDropdownTrigger && modelDropdownMenu) {
    modelDropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = modelDropdownMenu.classList.contains('hidden');
      if (isHidden) {
        modelDropdownMenu.classList.remove('hidden');
        modelDropdown.classList.add('open');
      } else {
        modelDropdownMenu.classList.add('hidden');
        modelDropdown.classList.remove('open');
      }
    });

    modelOptions.forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        modelOptions.forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');

        currentModel = opt.dataset.model;
        const name = opt.querySelector('.model-option-name').textContent;
        if (currentModelLabel) currentModelLabel.textContent = name;

        if (window.electronAPI && typeof window.electronAPI.setGeminiModel === 'function') {
          window.electronAPI.setGeminiModel(currentModel);
        }
        persistSetting('defaultModel', currentModel);

        modelDropdownMenu.classList.add('hidden');
        modelDropdown.classList.remove('open');
      });
    });

    window.addEventListener('click', (e) => {
      if (modelDropdown && !modelDropdown.contains(e.target)) {
        modelDropdownMenu.classList.add('hidden');
        modelDropdown.classList.remove('open');
      }
      const wrapAttach = document.getElementById('wrap-attach-popup');
      const wrapAccess = document.getElementById('wrap-access-popup');
      const attachPopup = document.getElementById('tactical-attach-popup');
      const accessPopup = document.getElementById('access-approval-popup');
      if (attachPopup && !attachPopup.classList.contains('hidden')) {
        if (!wrapAttach || !wrapAttach.contains(e.target)) {
          attachPopup.classList.add('hidden');
        }
      }
      if (accessPopup && !accessPopup.classList.contains('hidden')) {
        if (!wrapAccess || !wrapAccess.contains(e.target)) {
          accessPopup.classList.add('hidden');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. Account Popup Menu with Inline Accordion & Full-Screen Settings View
  // --------------------------------------------------------------------------
  function toggleAvatarMenu(e) {
    if (e) e.stopPropagation();
    if (!avatarPopupMenu) return;
    const isHidden = avatarPopupMenu.classList.contains('hidden');
    avatarPopupMenu.classList.toggle('hidden', !isHidden);
  }

  if (btnUserAvatar && avatarPopupMenu) {
    btnUserAvatar.addEventListener('click', toggleAvatarMenu);
    if (btnRailMore) btnRailMore.addEventListener('click', toggleAvatarMenu);

    window.addEventListener('click', (e) => {
      if (!avatarPopupMenu.contains(e.target) && e.target !== btnUserAvatar && e.target !== btnRailMore) {
        avatarPopupMenu.classList.add('hidden');
      }
    });
  }

  // Inline Accordion for "Usage remaining"
  if (menuUsageTrigger && menuUsageAccordion) {
    menuUsageTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menuUsageAccordion.classList.toggle('open');
    });
  }

  // Destination Views & Settings View Transitions
  function showDestinationView(destId) {
    if (avatarPopupMenu) avatarPopupMenu.classList.add('hidden');
    if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
      settingsViewPage.classList.add('hidden');
    }
    if (chatWorkspaceMain) chatWorkspaceMain.style.display = 'none';
    if (appShell) appShell.classList.add('standalone-page-mode');
    if (sidebar) sidebar.style.display = 'none';
    if (destinationViewsContainer) destinationViewsContainer.classList.remove('hidden');

    destinationPanes.forEach((pane) => {
      pane.classList.add('hidden');
    });

    const targetPane = document.getElementById(`dest-pane-${destId}`);
    if (targetPane) {
      targetPane.classList.remove('hidden');
    }

    railButtons.forEach((b) => {
      if (b.dataset.rail === destId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    pushViewHistory(destId);
  }

  function showChatStage() {
    if (appShell) appShell.classList.remove('standalone-page-mode');
    if (sidebar) sidebar.style.display = '';
    if (destinationViewsContainer) destinationViewsContainer.classList.add('hidden');
    if (settingsViewPage) settingsViewPage.classList.add('hidden');
    if (chatWorkspaceMain) chatWorkspaceMain.style.display = 'flex';

    railButtons.forEach((b) => {
      if (b.dataset.rail === 'home') {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    pushViewHistory('chat');
  }

  function openSettingsView() {
    if (avatarPopupMenu) avatarPopupMenu.classList.add('hidden');
    if (destinationViewsContainer) destinationViewsContainer.classList.add('hidden');
    if (chatWorkspaceMain) chatWorkspaceMain.style.display = 'none';
    if (settingsViewPage) settingsViewPage.classList.remove('hidden');
    pushViewHistory('settings');
  }

  function closeSettingsView() {
    if (settingsViewPage) settingsViewPage.classList.add('hidden');
    if (destinationViewsContainer && !destinationViewsContainer.classList.contains('hidden')) {
      // Keep destination view visible
    } else {
      if (chatWorkspaceMain) chatWorkspaceMain.style.display = 'flex';
      pushViewHistory('chat');
    }
  }

  // --------------------------------------------------------------------------
  // Navigation History Stack & Top Bar Back/Forward Controls
  // --------------------------------------------------------------------------
  const btnNavBack = document.getElementById('btn-nav-back');
  const btnNavForward = document.getElementById('btn-nav-forward');
  const viewHistory = ['chat'];
  let viewHistoryIdx = 0;

  function pushViewHistory(viewName) {
    if (viewHistory[viewHistoryIdx] === viewName) return;
    viewHistory.splice(viewHistoryIdx + 1);
    viewHistory.push(viewName);
    viewHistoryIdx = viewHistory.length - 1;
    syncNavButtons();
  }

  function syncNavButtons() {
    if (btnNavBack) btnNavBack.style.opacity = viewHistoryIdx > 0 ? '1' : '0.35';
    if (btnNavForward) btnNavForward.style.opacity = viewHistoryIdx < viewHistory.length - 1 ? '1' : '0.35';
  }

  function navigateToHistoryView(viewName) {
    if (viewName === 'chat') {
      showChatStage();
    } else if (viewName === 'settings') {
      openSettingsView();
    } else {
      showDestinationView(viewName);
    }
  }

  if (btnNavBack) {
    btnNavBack.addEventListener('click', () => {
      if (viewHistoryIdx > 0) {
        viewHistoryIdx--;
        navigateToHistoryView(viewHistory[viewHistoryIdx]);
        syncNavButtons();
      }
    });
  }

  if (btnNavForward) {
    btnNavForward.addEventListener('click', () => {
      if (viewHistoryIdx < viewHistory.length - 1) {
        viewHistoryIdx++;
        navigateToHistoryView(viewHistory[viewHistoryIdx]);
        syncNavButtons();
      }
    });
  }

  // Sidebar Header Workspace Selector Button
  const btnWorkspaceSelector = document.getElementById('btn-workspace-selector');
  if (btnWorkspaceSelector) {
    btnWorkspaceSelector.addEventListener('click', () => {
      showDestinationView('workspace');
    });
  }

  // Sidebar Header Mini Action Buttons
  const btnSidebarNotifications = document.getElementById('btn-sidebar-notifications');
  const btnSidebarSearch = document.getElementById('btn-sidebar-search');
  if (btnSidebarNotifications) {
    btnSidebarNotifications.addEventListener('click', () => {
      openSettingsView();
      switchSettingsTab('notifications');
    });
  }
  if (btnSidebarSearch) {
    btnSidebarSearch.addEventListener('click', () => {
      if (chatTextarea) {
        chatTextarea.focus();
        showToast('Type in the composer to search or ask anything');
      }
    });
  }

  // Marketplace Integrations Install Buttons (+)
  document.querySelectorAll('.plugin-action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.marketplace-card, .plugin-card') || btn.parentElement;
      const titleElem = card ? card.querySelector('.marketplace-card-title, .plugin-card-title') : null;
      const title = titleElem ? titleElem.textContent.trim() : 'Integration';
      const isInstalled = btn.classList.toggle('installed');
      if (isInstalled) {
        btn.textContent = '✓';
        btn.title = 'Integration enabled (click to remove)';
        showToast(`✓ Enabled ${title} integration`);
      } else {
        btn.textContent = '+';
        btn.title = 'Add integration';
        showToast(`Disabled ${title} integration`);
      }
    });
  });

  // Plugins Page Refresh Button
  const btnPluginsRefresh = document.getElementById('btn-plugins-refresh');
  if (btnPluginsRefresh) {
    btnPluginsRefresh.addEventListener('click', () => {
      btnPluginsRefresh.style.transform = 'rotate(360deg)';
      btnPluginsRefresh.style.transition = 'transform 0.5s ease';
      setTimeout(() => {
        btnPluginsRefresh.style.transform = 'none';
        btnPluginsRefresh.style.transition = 'none';
        renderPersonalPlugins();
        showToast('Plugins and marketplace integrations synchronized');
      }, 500);
    });
  }

  // Plugins Featured Banner Install Button
  const btnBannerInstall = document.getElementById('btn-banner-install');
  if (btnBannerInstall) {
    btnBannerInstall.addEventListener('click', () => {
      btnBannerInstall.textContent = 'Installed ✓';
      btnBannerInstall.style.background = '#22c55e';
      showToast('✓ Tactical Supercharge installed successfully');
    });
  }

  // Back to chat handlers across all standalone pages
  document.querySelectorAll('.btn-dest-back, .btn-dest-back-standalone').forEach((btn) => {
    btn.addEventListener('click', () => {
      showChatStage();
    });
  });

  // Plugins Standalone Page Tab Switching (Plugins vs Skills)
  const tabBtnPlugins = document.getElementById('tab-btn-plugins');
  const tabBtnSkills = document.getElementById('tab-btn-skills');
  const pluginsViewPane = document.getElementById('plugins-view-pane');
  const skillsViewPane = document.getElementById('skills-view-pane');

  if (tabBtnPlugins && tabBtnSkills && pluginsViewPane && skillsViewPane) {
    tabBtnPlugins.addEventListener('click', () => {
      tabBtnPlugins.classList.add('active');
      tabBtnSkills.classList.remove('active');
      pluginsViewPane.classList.remove('hidden');
      skillsViewPane.classList.add('hidden');
    });

    tabBtnSkills.addEventListener('click', () => {
      tabBtnSkills.classList.add('active');
      tabBtnPlugins.classList.remove('active');
      skillsViewPane.classList.remove('hidden');
      pluginsViewPane.classList.add('hidden');
    });
  }

  // Plugins Live Search Filtering
  const pluginsSearchInput = document.getElementById('plugins-search-input');
  if (pluginsSearchInput) {
    pluginsSearchInput.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      document.querySelectorAll('#plugins-view-pane .plugin-card').forEach((card) => {
        const name = (card.dataset.name || '').toLowerCase();
        const desc = (card.dataset.desc || '').toLowerCase();
        if (!q || name.includes(q) || desc.includes(q)) {
          card.classList.remove('card-hidden');
        } else {
          card.classList.add('card-hidden');
        }
      });
    });
  }

  // Companion Banner Dismiss
  const btnBannerClose = document.getElementById('btn-banner-close');
  const pluginsCompanionBanner = document.getElementById('plugins-companion-banner');
  if (btnBannerClose && pluginsCompanionBanner) {
    btnBannerClose.addEventListener('click', () => {
      pluginsCompanionBanner.classList.add('hidden');
    });
  }

  // Focus Search in Customize Sidebar
  const btnPluginsFocusSearch = document.getElementById('btn-plugins-focus-search');
  if (btnPluginsFocusSearch && pluginsSearchInput) {
    btnPluginsFocusSearch.addEventListener('click', () => {
      pluginsSearchInput.focus();
    });
  }

  // Settings Gear in Plugins Header
  const btnPluginsSettings = document.getElementById('btn-plugins-settings');
  if (btnPluginsSettings) {
    btnPluginsSettings.addEventListener('click', () => {
      openSettingsView();
      switchSettingsTab('tools');
    });
  }

  // --------------------------------------------------------------------------
  // Plugins "Add" Dropdown Menu & Modals System
  // --------------------------------------------------------------------------
  const btnPluginsAdd = document.getElementById('btn-plugins-add');
  const pluginsAddMenu = document.getElementById('plugins-add-menu');
  const pluginsAddDropdownWrap = document.getElementById('plugins-add-dropdown-wrap');
  const inputPluginArchive = document.getElementById('input-plugin-archive');

  const tacticalModalOverlay = document.getElementById('tactical-modal-overlay');
  const modalCreatePlugin = document.getElementById('modal-create-plugin');
  const modalAddMarketplace = document.getElementById('modal-add-marketplace');
  const modalAddMcp = document.getElementById('modal-add-mcp');
  const modalRenameSession = document.getElementById('modal-rename-session');

  const pluginsPublicContainer = document.getElementById('plugins-public-container');
  const pluginsPersonalContainer = document.getElementById('plugins-personal-container');
  const personalPluginsGrid = document.getElementById('personal-plugins-grid');
  const personalPluginsCount = document.getElementById('personal-plugins-count');
  const pluginsEmptyPersonal = document.getElementById('plugins-empty-personal');
  const pluginsInstalledListNav = document.getElementById('plugins-installed-list-nav');

  function openTacticalModal(modalElem) {
    if (!tacticalModalOverlay || !modalElem) return;
    tacticalModalOverlay.querySelectorAll('.tactical-modal-box').forEach((box) => box.classList.add('hidden'));
    modalElem.classList.remove('hidden');
    tacticalModalOverlay.classList.remove('hidden');
    const firstInput = modalElem.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeAllModals() {
    if (tacticalModalOverlay) tacticalModalOverlay.classList.add('hidden');
    document.querySelectorAll('.tactical-modal-box').forEach((box) => box.classList.add('hidden'));
  }

  if (tacticalModalOverlay) {
    tacticalModalOverlay.addEventListener('click', (e) => {
      if (e.target === tacticalModalOverlay) {
        const updateBox = document.getElementById('modal-app-update');
        if (updateBox && !updateBox.classList.contains('hidden')) {
          return; // Do not dismiss modal while updating
        }
        closeAllModals();
      }
    });
  }

  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });

  // Toggle Plugins Add Menu
  if (btnPluginsAdd && pluginsAddMenu) {
    btnPluginsAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = pluginsAddMenu.classList.contains('hidden');
      pluginsAddMenu.classList.toggle('hidden', !isHidden);
      btnPluginsAdd.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      if (isHidden) {
        const firstMenuItem = pluginsAddMenu.querySelector('.plugins-add-menu-item');
        if (firstMenuItem) firstMenuItem.focus();
      }
    });

    // Keyboard navigation in Add Menu
    pluginsAddMenu.addEventListener('keydown', (e) => {
      const items = Array.from(pluginsAddMenu.querySelectorAll('.plugins-add-menu-item'));
      const activeIdx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = (activeIdx + 1) % items.length;
        items[nextIdx].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = (activeIdx - 1 + items.length) % items.length;
        items[prevIdx].focus();
      } else if (e.key === 'Escape') {
        pluginsAddMenu.classList.add('hidden');
        btnPluginsAdd.setAttribute('aria-expanded', 'false');
        btnPluginsAdd.focus();
      }
    });
  }

  // Close Add Menu on outside click
  document.addEventListener('click', (e) => {
    if (pluginsAddMenu && !pluginsAddMenu.classList.contains('hidden')) {
      if (pluginsAddDropdownWrap && !pluginsAddDropdownWrap.contains(e.target)) {
        pluginsAddMenu.classList.add('hidden');
        if (btnPluginsAdd) btnPluginsAdd.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Add Option 1: Create plugin
  const btnMenuCreatePlugin = document.getElementById('btn-menu-create-plugin');
  if (btnMenuCreatePlugin) {
    btnMenuCreatePlugin.addEventListener('click', () => {
      if (pluginsAddMenu) pluginsAddMenu.classList.add('hidden');
      openTacticalModal(modalCreatePlugin);
    });
  }

  const btnSubmitCreatePlugin = document.getElementById('btn-submit-create-plugin');
  if (btnSubmitCreatePlugin) {
    btnSubmitCreatePlugin.addEventListener('click', () => {
      const nameInput = document.getElementById('input-create-plugin-name');
      const descInput = document.getElementById('input-create-plugin-desc');
      const catSelect = document.getElementById('select-create-plugin-cat');

      const name = (nameInput ? nameInput.value : '').trim();
      const desc = (descInput ? descInput.value : '').trim() || 'Custom workspace plugin';
      const category = catSelect ? catSelect.value : 'Developer Tools';

      if (!name) {
        showToast('Please enter a plugin name');
        if (nameInput) nameInput.focus();
        return;
      }

      addCustomPlugin({
        id: 'plugin-' + Date.now(),
        name,
        desc,
        category,
        type: 'custom',
        status: 'Active',
        createdAt: Date.now()
      });

      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      closeAllModals();
      showToast(`Plugin "${name}" created and registered`);
      switchToPersonalFilter();
    });
  }

  // Add Option 2: Add a marketplace
  const btnMenuAddMarketplace = document.getElementById('btn-menu-add-marketplace');
  if (btnMenuAddMarketplace) {
    btnMenuAddMarketplace.addEventListener('click', () => {
      if (pluginsAddMenu) pluginsAddMenu.classList.add('hidden');
      openTacticalModal(modalAddMarketplace);
    });
  }

  const btnSubmitAddMarketplace = document.getElementById('btn-submit-add-marketplace');
  if (btnSubmitAddMarketplace) {
    btnSubmitAddMarketplace.addEventListener('click', () => {
      const nameInput = document.getElementById('input-marketplace-name');
      const urlInput = document.getElementById('input-marketplace-url');

      const name = (nameInput ? nameInput.value : '').trim() || 'Custom Marketplace';
      const url = (urlInput ? urlInput.value : '').trim();

      if (!url) {
        showToast('Please enter a marketplace registry URL');
        if (urlInput) urlInput.focus();
        return;
      }

      try {
        let markets = JSON.parse(localStorage.getItem('tactical_marketplaces') || '[]');
        markets.push({ name, url, connectedAt: Date.now() });
        localStorage.setItem('tactical_marketplaces', JSON.stringify(markets));
      } catch (e) {}

      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      closeAllModals();
      showToast(`Marketplace "${name}" connected successfully`);
    });
  }

  // Add Option 3: Upload plugin archive
  const btnMenuUploadArchive = document.getElementById('btn-menu-upload-archive');
  if (btnMenuUploadArchive && inputPluginArchive) {
    btnMenuUploadArchive.addEventListener('click', () => {
      if (pluginsAddMenu) pluginsAddMenu.classList.add('hidden');
      inputPluginArchive.click();
    });

    inputPluginArchive.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const validExts = ['.zip', '.tar.gz', '.tgz'];
      const isExtValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!isExtValid) {
        showToast('Please select a valid plugin archive (.zip or .tar.gz)');
        inputPluginArchive.value = '';
        return;
      }

      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
      const cleanPluginName = file.name.replace(/\.(zip|tar\.gz|tgz)$/i, '');

      addCustomPlugin({
        id: 'archive-' + Date.now(),
        name: cleanPluginName,
        desc: `Installed from archive (${file.name}, ${sizeStr})`,
        category: 'Archive Package',
        type: 'archive',
        status: 'Installed',
        createdAt: Date.now()
      });

      inputPluginArchive.value = '';
      showToast(`Plugin archive "${file.name}" (${sizeStr}) verified and registered`);
      switchToPersonalFilter();
    });
  }

  // Add Option 4: Add custom MCP server
  const btnMenuCustomMcp = document.getElementById('btn-menu-custom-mcp');
  if (btnMenuCustomMcp) {
    btnMenuCustomMcp.addEventListener('click', () => {
      if (pluginsAddMenu) pluginsAddMenu.classList.add('hidden');
      openTacticalModal(modalAddMcp);
    });
  }

  const btnSubmitAddMcp = document.getElementById('btn-submit-add-mcp');
  if (btnSubmitAddMcp) {
    btnSubmitAddMcp.addEventListener('click', () => {
      const nameInput = document.getElementById('input-mcp-name');
      const transportSelect = document.getElementById('select-mcp-transport');
      const commandInput = document.getElementById('input-mcp-command');
      const argsInput = document.getElementById('input-mcp-args');

      const name = (nameInput ? nameInput.value : '').trim();
      const transport = transportSelect ? transportSelect.value : 'stdio';
      const command = (commandInput ? commandInput.value : '').trim();
      const args = (argsInput ? argsInput.value : '').trim();

      if (!name) {
        showToast('Please enter an MCP server name');
        if (nameInput) nameInput.focus();
        return;
      }
      if (!command) {
        showToast('Please enter the server execution command or URL');
        if (commandInput) commandInput.focus();
        return;
      }

      try {
        let servers = JSON.parse(localStorage.getItem('tactical_mcp_servers') || '[]');
        servers.push({ name, transport, command, args, registeredAt: Date.now() });
        localStorage.setItem('tactical_mcp_servers', JSON.stringify(servers));
      } catch (e) {}

      addCustomPlugin({
        id: 'mcp-' + Date.now(),
        name: `${name} (MCP)`,
        desc: `Model Context Protocol via ${transport}: ${command}`,
        category: 'MCP Server',
        type: 'mcp',
        status: 'Connected',
        createdAt: Date.now()
      });

      if (nameInput) nameInput.value = '';
      if (commandInput) commandInput.value = '';
      if (argsInput) argsInput.value = '';
      closeAllModals();
      showToast(`Custom MCP server "${name}" (${transport}) registered and active`);
      switchToPersonalFilter();
    });
  }

  // Personal Plugins Storage & Rendering
  function getCustomPlugins() {
    try {
      return JSON.parse(localStorage.getItem('tactical_custom_plugins') || '[]');
    } catch (e) {
      return [];
    }
  }

  function addCustomPlugin(item) {
    const list = getCustomPlugins();
    list.unshift(item);
    try {
      localStorage.setItem('tactical_custom_plugins', JSON.stringify(list));
    } catch (e) {}
    renderPersonalPlugins();
  }

  function renderPersonalPlugins() {
    if (!personalPluginsGrid || !pluginsEmptyPersonal) return;
    const list = getCustomPlugins();

    if (personalPluginsCount) {
      personalPluginsCount.textContent = `${list.length} ${list.length === 1 ? 'plugin' : 'plugins'} installed`;
    }
    if (pluginsInstalledListNav) {
      pluginsInstalledListNav.textContent = list.length > 0 ? `${list.length} installed` : 'No installed plugins';
    }

    if (list.length === 0) {
      pluginsEmptyPersonal.classList.remove('hidden');
      personalPluginsGrid.innerHTML = '';
      return;
    }

    pluginsEmptyPersonal.classList.add('hidden');
    personalPluginsGrid.innerHTML = '';

    list.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'plugin-card';
      card.dataset.name = p.name;
      card.dataset.desc = p.desc;
      card.innerHTML = `
        <div class="plugin-card-left">
          <div class="plugin-avatar icon-neutral" title="${escapeHTML(p.name)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
          <div class="plugin-meta">
            <div class="plugin-title">${escapeHTML(p.name)}</div>
            <div class="plugin-desc">${escapeHTML(p.desc)}</div>
          </div>
        </div>
        <span class="plugin-status-badge">${escapeHTML(p.status || 'Active')}</span>
      `;
      personalPluginsGrid.appendChild(card);
    });
  }

  function switchToPersonalFilter() {
    const btnFilterPersonal = document.getElementById('filter-btn-personal');
    const btnFilterPublic = document.getElementById('filter-btn-public');
    if (btnFilterPersonal && btnFilterPublic) {
      btnFilterPersonal.classList.add('active');
      btnFilterPublic.classList.remove('active');
    }
    if (pluginsPublicContainer) pluginsPublicContainer.classList.add('hidden');
    if (pluginsPersonalContainer) pluginsPersonalContainer.classList.remove('hidden');
    renderPersonalPlugins();
  }

  function switchToPublicFilter() {
    const btnFilterPersonal = document.getElementById('filter-btn-personal');
    const btnFilterPublic = document.getElementById('filter-btn-public');
    if (btnFilterPersonal && btnFilterPublic) {
      btnFilterPublic.classList.add('active');
      btnFilterPersonal.classList.remove('active');
    }
    if (pluginsPublicContainer) pluginsPublicContainer.classList.remove('hidden');
    if (pluginsPersonalContainer) pluginsPersonalContainer.classList.add('hidden');
  }

  const btnFilterPublic = document.getElementById('filter-btn-public');
  const btnFilterPersonal = document.getElementById('filter-btn-personal');
  if (btnFilterPublic) btnFilterPublic.addEventListener('click', switchToPublicFilter);
  if (btnFilterPersonal) btnFilterPersonal.addEventListener('click', switchToPersonalFilter);

  const btnEmptyCreatePlugin = document.getElementById('btn-empty-create-plugin');
  if (btnEmptyCreatePlugin) {
    btnEmptyCreatePlugin.addEventListener('click', () => openTacticalModal(modalCreatePlugin));
  }

  // Workspaces view project switch buttons
  document.querySelectorAll('[data-session-target]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sessTarget = btn.dataset.sessionTarget;
      if (sessTarget) {
        showChatStage();
        loadSession(sessTarget);
      }
    });
  });

  const btnGotoSettingsIntegrations = document.getElementById('btn-goto-settings-integrations');
  if (btnGotoSettingsIntegrations) {
    btnGotoSettingsIntegrations.addEventListener('click', () => {
      showChatStage();
      openSettingsView();
      switchSettingsTab('tools');
    });
  }

  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsView();
    });
  }

  if (btnSettingsBack) {
    btnSettingsBack.addEventListener('click', closeSettingsView);
  }

  // Settings Multi-Page Tab Switching (Every button has its own dedicated page)
  const settingsContentPanes = document.querySelectorAll('.settings-content-pane');

  function updateUsageMetrics() {
    const stored = getStoredSessions();
    let totalChars = 0;
    stored.forEach((s) => {
      (s.messages || []).forEach((m) => {
        totalChars += (m.text || '').length;
      });
    });
    const approxTokens = Math.max(Math.round(totalChars / 4), 120);
    const percent = Math.min(((approxTokens / 1048576) * 100).toFixed(2), 100);
    const usageTokenElem = document.getElementById('settings-usage-token-text');
    if (usageTokenElem) usageTokenElem.textContent = `${percent}% allocated (${approxTokens.toLocaleString()} tokens)`;
  }

  function switchSettingsTab(tabKey, moveFocus = false) {
    settingsNavItems.forEach((n) => {
      const isActive = n.dataset.v2Tab === tabKey;
      n.classList.toggle('active', isActive);
      n.setAttribute('aria-selected', isActive ? 'true' : 'false');
      n.tabIndex = isActive ? 0 : -1;
      if (isActive && moveFocus) n.focus();
    });

    settingsContentPane_toggle(tabKey);

    if (tabKey === 'usage') {
      updateUsageMetrics();
      if (typeof updateUsageDisplay === 'function') updateUsageDisplay();
    }
    refreshSettingsPaneData(tabKey);
  }

  function settingsContentPane_toggle(tabKey) {
    settingsContentPanes.forEach((pane) => {
      pane.classList.toggle('hidden', pane.id !== `settings-pane-${tabKey}`);
    });
    const search = document.getElementById('settings-search-input');
    if (search && search.value) {
      search.value = '';
      document.querySelectorAll('.settings-field-row').forEach((row) => { row.style.display = ''; });
    }
  }

  settingsNavItems.forEach((item, idx) => {
    item.setAttribute('role', 'tab');
    item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false');
    item.tabIndex = item.classList.contains('active') ? 0 : -1;
    item.setAttribute('aria-controls', `settings-pane-${item.dataset.v2Tab}`);
    item.addEventListener('click', () => {
      const tabKey = item.dataset.v2Tab;
      if (tabKey) switchSettingsTab(tabKey);
    });
    item.addEventListener('keydown', (e) => {
      const items = Array.from(settingsNavItems);
      let target = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') target = items[(idx + 1) % items.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') target = items[(idx - 1 + items.length) % items.length];
      else if (e.key === 'Home') target = items[0];
      else if (e.key === 'End') target = items[items.length - 1];
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchSettingsTab(item.dataset.v2Tab);
        return;
      }
      if (target) {
        e.preventDefault();
        switchSettingsTab(target.dataset.v2Tab, true);
      }
    });
  });

  // Settings Live Search Filter
  const settingsSearchInput = document.getElementById('settings-search-input');
  if (settingsSearchInput) {
    settingsSearchInput.setAttribute('aria-label', 'Search settings on this page');
    settingsSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const activePane = document.querySelector('.settings-content-pane:not(.hidden)');
      if (!activePane) return;

      const rows = activePane.querySelectorAll('.settings-field-row');
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!query || text.includes(query)) ? '' : 'none';
      });
    });
  }

  // Settings Clear Cache (Usage page): same action as Privacy & data > Delete all conversations
  const btnSettingsClearCache = document.getElementById('btn-settings-clear-cache');
  if (btnSettingsClearCache) {
    btnSettingsClearCache.addEventListener('click', () => deleteAllConversations());
  }

  // Settings Install Plugin
  // (removed: the old "Install plugin from repository" control had no backing implementation)

  // External Action Links (Using Electron openExternal or fallback)
  function openURL(url) {
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  if (linkUpgradePlus) linkUpgradePlus.addEventListener('click', () => openURL('https://github.com'));
  if (linkLearnMore) linkLearnMore.addEventListener('click', () => openURL('https://github.com'));
  if (menuUpgradeLimits) menuUpgradeLimits.addEventListener('click', () => openURL('https://github.com'));

  const linkRiskDocs = document.getElementById('link-risk-docs');
  if (linkRiskDocs) linkRiskDocs.addEventListener('click', (e) => {
    e.preventDefault();
    openURL('https://github.com');
  });

  if (menuHelpBtn) {
    menuHelpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openURL('https://github.com');
    });
  }

  // Logout / Clear Session
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (avatarPopupMenu) avatarPopupMenu.classList.add('hidden');
      localStorage.removeItem('tactical_studio_sessions');
      startNewChat();
      showToast('Signed out of Sparx Operator session');
    });
  }

  // Toast Notification System
  function showToast(message, duration = 2800) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // --------------------------------------------------------------------------
  // 6. Activity Rail & Sidebar Navigation
  // --------------------------------------------------------------------------
  function toggleSidebar(forceState) {
    if (!sidebar) return;
    if (appShell && appShell.classList.contains('standalone-page-mode')) {
      showChatStage();
      sidebar.classList.remove('collapsed');
      if (btnToggleSidebar) btnToggleSidebar.style.color = 'var(--text-primary)';
      return;
    }
    const shouldCollapse = forceState !== undefined ? !forceState : !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', shouldCollapse);
    if (btnToggleSidebar) {
      btnToggleSidebar.style.color = shouldCollapse ? 'var(--text-muted)' : 'var(--text-primary)';
    }
  }

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', () => toggleSidebar());

  railButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const railId = btn.dataset.rail;

      if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
        closeSettingsView();
      }

      if (railId === 'home') {
        showChatStage();
        startNewChat();
      } else if (railId === 'history' && sessionListContainer) {
        showChatStage();
        if (sidebar && sidebar.classList.contains('collapsed')) {
          toggleSidebar(false);
        }
        sessionListContainer.scrollIntoView({ behavior: 'smooth' });
      } else if (railId === 'more') {
        if (avatarPopupMenu) avatarPopupMenu.classList.toggle('hidden');
      } else if (['workspace', 'scheduled-tasks', 'library', 'plugins', 'connectors'].includes(railId)) {
        showDestinationView(railId);
      }
    });
  });

  // Global Keybindings
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tacticalModalOverlay && !tacticalModalOverlay.classList.contains('hidden')) {
        closeAllModals();
        return;
      }
      if (pluginsAddMenu && !pluginsAddMenu.classList.contains('hidden')) {
        pluginsAddMenu.classList.add('hidden');
        if (btnPluginsAdd) btnPluginsAdd.setAttribute('aria-expanded', 'false');
        return;
      }
      if (destinationViewsContainer && !destinationViewsContainer.classList.contains('hidden')) {
        showChatStage();
        return;
      }
      if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
        closeSettingsView();
        return;
      }
      if (avatarPopupMenu && !avatarPopupMenu.classList.contains('hidden')) {
        avatarPopupMenu.classList.add('hidden');
        return;
      }
      if (modelDropdownMenu && !modelDropdownMenu.classList.contains('hidden')) {
        modelDropdownMenu.classList.add('hidden');
        modelDropdown.classList.remove('open');
        return;
      }
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      openSettingsView();
      return;
    }

    if (e.ctrlKey && (e.key.toLowerCase() === 'n' || (e.shiftKey && e.key.toLowerCase() === 'o'))) {
      e.preventDefault();
      if (destinationViewsContainer && !destinationViewsContainer.classList.contains('hidden')) {
        showChatStage();
      }
      if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
        closeSettingsView();
      }
      startNewChat();
      return;
    }
  });

  // --------------------------------------------------------------------------
  // 7. Multi-Session Switching, Renaming & ChatGPT-Style Persistence
  // --------------------------------------------------------------------------
  const pinnedListContainer = document.getElementById('pinned-list');
  let targetRenameSessionId = null;

  let inMemorySessions = null;

  async function initChatSessionsPersistence() {
    let diskSessions = [];
    if (window.electronAPI && typeof window.electronAPI.loadChatSessions === 'function') {
      try {
        diskSessions = await window.electronAPI.loadChatSessions();
      } catch (e) {}
    }
    const localRaw = localStorage.getItem('tactical_studio_sessions');
    let localSessions = [];
    try {
      localSessions = localRaw ? JSON.parse(localRaw) : [];
    } catch (e) {}

    if (Array.isArray(diskSessions) && diskSessions.length > 0) {
      inMemorySessions = diskSessions;
      try { localStorage.setItem('tactical_studio_sessions', JSON.stringify(diskSessions)); } catch (e) {}
    } else if (Array.isArray(localSessions) && localSessions.length > 0) {
      inMemorySessions = localSessions;
      if (window.electronAPI && typeof window.electronAPI.saveChatSessions === 'function') {
        window.electronAPI.saveChatSessions(localSessions).catch(() => {});
      }
    } else {
      inMemorySessions = [];
    }
  }

  function getStoredSessions() {
    if (inMemorySessions !== null) return inMemorySessions;
    try {
      const raw = localStorage.getItem('tactical_studio_sessions');
      inMemorySessions = raw ? JSON.parse(raw) : [];
    } catch (e) {
      inMemorySessions = [];
    }
    return inMemorySessions;
  }

  async function saveStoredSessions(sessions) {
    inMemorySessions = Array.isArray(sessions) ? sessions : [];
    try {
      localStorage.setItem('tactical_studio_sessions', JSON.stringify(inMemorySessions));
    } catch (e) {}
    if (window.electronAPI && typeof window.electronAPI.saveChatSessions === 'function') {
      try {
        const res = await window.electronAPI.saveChatSessions(inMemorySessions);
        if (res && res.success === false) {
          console.error('[Sparx Persistence] Failed to save chat sessions to disk:', res.error);
        }
        return res;
      } catch (err) {
        console.error('[Sparx Persistence] Save sessions IPC exception:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  }

  // Pre-seed default pinned and project sessions matching ChatGPT desktop reference
  function ensureBuiltinSessions() {
    localStorage.setItem("tactical_no_sample_sessions", "1");
  }

  function getSessionById(id) {
    const list = getStoredSessions();
    return list.find((s) => s.id === id) || null;
  }

  async function saveCurrentSession(session) {
    const list = getStoredSessions();
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.unshift(session);
    }
    const res = await saveStoredSessions(list);
    try { localStorage.setItem('tactical_last_active_session', session.id); } catch (e) {}
    renderAllSidebarSessions();
    return res;
  }

  function deleteSession(id, e) {
    if (e) e.stopPropagation();
    if (settings.confirmDelete && !window.confirm('Delete this conversation? This cannot be undone.')) return;
    let list = getStoredSessions();
    list = list.filter((s) => s.id !== id);
    saveStoredSessions(list);

    if (currentSessionId === id) {
      startNewChat();
    } else {
      renderAllSidebarSessions();
    }
    showToast('Conversation deleted');
  }

  function openRenameModal(sessionId, e) {
    if (e) e.stopPropagation();
    const session = getSessionById(sessionId);
    if (!session) return;
    targetRenameSessionId = sessionId;
    const inputTitle = document.getElementById('input-rename-session-title');
    if (inputTitle) inputTitle.value = session.title || '';
    openTacticalModal(modalRenameSession);
    if (inputTitle) setTimeout(() => inputTitle.focus(), 60);
  }

  const btnSubmitRenameSession = document.getElementById('btn-submit-rename-session');
  const inputRenameSessionTitle = document.getElementById('input-rename-session-title');

  function handleSaveRename() {
    if (!targetRenameSessionId) return;
    const session = getSessionById(targetRenameSessionId);
    if (!session) return;
    const newTitle = inputRenameSessionTitle ? inputRenameSessionTitle.value.trim() : '';
    if (!newTitle) {
      showToast('Please enter a conversation title');
      return;
    }

    session.title = newTitle;
    session.userRenamed = true;
    session.updatedAt = Date.now();
    saveCurrentSession(session);
    closeAllModals();
    showToast(`Renamed conversation to "${newTitle}"`);
    targetRenameSessionId = null;
  }

  async function checkAndUpdateSessionTitle(session) {
    if (!session || session.userRenamed) return;
    if (session.autoNamed && session.title && session.title !== 'New conversation') return;
    if (!Array.isArray(session.messages) || session.messages.length === 0) return;

    try {
      if (window.electronAPI && typeof window.electronAPI.generateChatTitle === 'function') {
        const res = await window.electronAPI.generateChatTitle(session.messages);
        if (res && res.success && res.title) {
          const current = getSessionById(session.id);
          if (!current || current.userRenamed) return;
          if (current.title !== res.title || (!current.autoNamed && !res.isTemporary)) {
            current.title = res.title;
            current.autoNamed = !res.isTemporary;
            current.updatedAt = Date.now();
            await saveCurrentSession(current);
            const titleEl = document.querySelector(`.session-item[data-session-id="${current.id}"] .session-title`);
            if (titleEl) {
              titleEl.textContent = current.title;
              titleEl.setAttribute('title', current.title);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Sparx Title] Failed to check/update title:', e);
    }
  }

  if (btnSubmitRenameSession) btnSubmitRenameSession.addEventListener('click', handleSaveRename);
  if (inputRenameSessionTitle) {
    inputRenameSessionTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveRename();
      }
    });
  }

  // --------------------------------------------------------------------------
  // Access & Approvals Governance & Computer Use Control Subsystem
  // --------------------------------------------------------------------------
  const modalAccessApprovals = document.getElementById('modal-access-approvals');
  const btnAccessApprovals = document.getElementById('btn-access-approvals');
  const accessApprovalPopup = document.getElementById('access-approval-popup');
  const accessModeIndicator = document.getElementById('access-mode-indicator');
  const accessModeLabel = document.getElementById('access-mode-label');
  const accessModeIcon = document.getElementById('access-mode-icon');
  const accessPopupItems = document.querySelectorAll('.access-popup-item');
  const btnAccessLearnMore = document.getElementById('btn-access-learn-more');
  const activeSessionIndicator = document.getElementById('active-session-indicator');
  const activeSessionLabel = document.getElementById('active-session-label');
  const btnStopActiveSession = document.getElementById('btn-stop-active-session');

  const switchCapTerminal = document.getElementById('switch-cap-terminal');
  const switchCapComputer = document.getElementById('switch-cap-computer');
  const boxComputerSessionControls = document.getElementById('box-computer-session-controls');
  const badgeComputerSessionStatus = document.getElementById('badge-computer-session-status');
  const pillComputerSessionTime = document.getElementById('pill-computer-session-time');
  const btnToggleComputerSession = document.getElementById('btn-toggle-computer-session');
  const btnPauseComputerSession = document.getElementById('btn-pause-computer-session');
  const btnModalRevokeAll = document.getElementById('btn-modal-revoke-all');

  const radioModeAsk = document.getElementById('radio-mode-ask');
  const radioModeAuto = document.getElementById('radio-mode-auto');
  const radioModeFull = document.getElementById('radio-mode-full');
  const labelModeAsk = document.getElementById('label-mode-ask');
  const labelModeAuto = document.getElementById('label-mode-auto');
  const labelModeFull = document.getElementById('label-mode-full');

  let computerSessionTimer = null;

  function updateModeUI(mode) {
    if (labelModeAsk) labelModeAsk.classList.toggle('selected', mode === 'ask');
    if (labelModeAuto) labelModeAuto.classList.toggle('selected', mode === 'auto');
    if (labelModeFull) labelModeFull.classList.toggle('selected', mode === 'full');

    if (radioModeAsk) radioModeAsk.checked = (mode === 'ask');
    if (radioModeAuto) radioModeAuto.checked = (mode === 'auto');
    if (radioModeFull) radioModeFull.checked = (mode === 'full');

    const modeLabels = {
      ask: 'Ask for approval',
      auto: 'Approve for me',
      full: 'Full access'
    };

    if (accessModeLabel) accessModeLabel.textContent = modeLabels[mode] || 'Approve for me';
    if (accessModeIndicator) {
      accessModeIndicator.dataset.mode = mode || 'auto';
      accessModeIndicator.classList.toggle('active-full', mode === 'full');
    }

    if (accessModeIcon) {
      if (mode === 'full') {
        accessModeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      } else if (mode === 'auto') {
        accessModeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;
      } else {
        accessModeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>`;
      }
    }

    if (accessPopupItems && accessPopupItems.length > 0) {
      accessPopupItems.forEach((btn) => {
        const itemMode = btn.dataset.mode;
        const isActive = (itemMode === mode);
        btn.classList.toggle('active', isActive);
        const check = btn.querySelector('.access-item-check');
        if (check) {
          check.classList.toggle('hidden', !isActive);
        }
      });
    }
  }

  function updateAccessSettingsUI(settings) {
    if (!settings) return;
    if (switchCapTerminal) switchCapTerminal.checked = !!settings.terminalEnabled;
    if (switchCapComputer) {
      switchCapComputer.checked = !!settings.computerEnabled;
      if (boxComputerSessionControls) {
        boxComputerSessionControls.classList.toggle('hidden', !settings.computerEnabled);
      }
    }
    updateModeUI(settings.mode || 'auto');
  }

  function updateComputerSessionUI(status) {
    if (!status) return;
    const { active, paused, startedAt } = status;

    if (badgeComputerSessionStatus) {
      if (!active) {
        badgeComputerSessionStatus.textContent = 'Session Stopped';
        badgeComputerSessionStatus.className = 'session-status-badge inactive';
      } else if (paused) {
        badgeComputerSessionStatus.textContent = 'Session Paused';
        badgeComputerSessionStatus.className = 'session-status-badge paused';
      } else {
        badgeComputerSessionStatus.textContent = 'Session Active';
        badgeComputerSessionStatus.className = 'session-status-badge active';
      }
    }

    if (btnToggleComputerSession) {
      if (active) {
        btnToggleComputerSession.textContent = 'Stop Session';
        btnToggleComputerSession.classList.add('is-active-btn');
      } else {
        btnToggleComputerSession.textContent = 'Start Computer Session';
        btnToggleComputerSession.classList.remove('is-active-btn');
      }
    }

    if (btnPauseComputerSession) {
      btnPauseComputerSession.classList.toggle('hidden', !active);
      btnPauseComputerSession.textContent = paused ? 'Resume Control' : 'Pause Control';
    }

    if (activeSessionIndicator) {
      activeSessionIndicator.classList.toggle('hidden', !active);
      if (activeSessionLabel) {
        activeSessionLabel.textContent = paused ? 'Screen Paused' : 'Screen Active';
      }
    }

    if (active && startedAt) {
      if (pillComputerSessionTime) pillComputerSessionTime.classList.remove('hidden');
      if (!computerSessionTimer) {
        computerSessionTimer = setInterval(() => {
          const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
          const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const secs = String(elapsed % 60).padStart(2, '0');
          if (pillComputerSessionTime) pillComputerSessionTime.textContent = `${mins}:${secs}`;
        }, 1000);
      }
    } else {
      if (pillComputerSessionTime) pillComputerSessionTime.classList.add('hidden');
      if (computerSessionTimer) {
        clearInterval(computerSessionTimer);
        computerSessionTimer = null;
      }
    }
  }

  // Toggle access popup menu (Image 4)
  if (accessModeIndicator) {
    accessModeIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      const attachPopup = document.getElementById('tactical-attach-popup');
      if (attachPopup) attachPopup.classList.add('hidden');
      if (modelDropdownMenu) modelDropdownMenu.classList.add('hidden');
      if (avatarPopupMenu) avatarPopupMenu.classList.add('hidden');

      if (accessApprovalPopup) {
        accessApprovalPopup.classList.toggle('hidden');
      }
    });
  }

  // Popup options selection
  if (accessPopupItems && accessPopupItems.length > 0) {
    accessPopupItems.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetMode = btn.dataset.mode;
        if (window.electronAPI && window.electronAPI.setAccessMode) {
          await window.electronAPI.setAccessMode(targetMode);
        }
        updateModeUI(targetMode);
        if (accessApprovalPopup) accessApprovalPopup.classList.add('hidden');
        const labels = { ask: 'Ask for approval', auto: 'Approve for me', full: 'Full access' };
        showToast(`Approval policy set to: ${labels[targetMode] || targetMode}`);
      });
    });
  }

  // Learn more in popup opens deep modal
  if (btnAccessLearnMore) {
    btnAccessLearnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      if (accessApprovalPopup) accessApprovalPopup.classList.add('hidden');
      openTacticalModal(modalAccessApprovals);
    });
  }

  // Open modal triggers
  if (btnAccessApprovals) {
    btnAccessApprovals.addEventListener('click', (e) => {
      e.stopPropagation();
      openTacticalModal(modalAccessApprovals);
    });
  }

  // Capability switches
  if (switchCapTerminal) {
    switchCapTerminal.addEventListener('change', async () => {
      if (window.electronAPI && window.electronAPI.toggleAccessCapability) {
        const next = await window.electronAPI.toggleAccessCapability('terminal', switchCapTerminal.checked);
        updateAccessSettingsUI(next);
        showToast(switchCapTerminal.checked ? 'Terminal execution enabled' : 'Terminal execution disabled');
      }
    });
  }

  if (switchCapComputer) {
    switchCapComputer.addEventListener('change', async () => {
      if (window.electronAPI && window.electronAPI.toggleAccessCapability) {
        const next = await window.electronAPI.toggleAccessCapability('computer', switchCapComputer.checked);
        updateAccessSettingsUI(next);
        showToast(switchCapComputer.checked ? 'Computer access enabled' : 'Computer access disabled');
      }
    });
  }

  // Mode radio buttons: Exactly 3 modes
  [radioModeAsk, radioModeAuto, radioModeFull].forEach((radio) => {
    if (radio) {
      radio.addEventListener('change', async () => {
        if (radio.checked && window.electronAPI && window.electronAPI.setAccessMode) {
          await window.electronAPI.setAccessMode(radio.value);
          updateModeUI(radio.value);
          const labels = { ask: 'Ask for approval', auto: 'Approve for me', full: 'Full access' };
          showToast(`Approval policy set to: ${labels[radio.value]}`);
        }
      });
    }
  });

  // Computer Session Start/Stop & Pause buttons
  if (btnToggleComputerSession) {
    btnToggleComputerSession.addEventListener('click', async () => {
      if (!window.electronAPI) return;
      const status = await window.electronAPI.getComputerSessionStatus();
      if (status && status.active) {
        const res = await window.electronAPI.stopComputerSession();
        updateComputerSessionUI(res);
        showToast('Computer Use session stopped');
      } else {
        const res = await window.electronAPI.startComputerSession();
        updateComputerSessionUI(res);
        showToast('Computer Use session started');
      }
    });
  }

  if (btnPauseComputerSession) {
    btnPauseComputerSession.addEventListener('click', async () => {
      if (!window.electronAPI) return;
      const status = await window.electronAPI.getComputerSessionStatus();
      const nextPaused = !status.paused;
      const res = await window.electronAPI.setComputerSessionPaused(nextPaused);
      updateComputerSessionUI(res);
      showToast(nextPaused ? 'Desktop control paused' : 'Desktop control resumed');
    });
  }

  if (btnStopActiveSession) {
    btnStopActiveSession.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.stopComputerSession) {
        const res = await window.electronAPI.stopComputerSession();
        updateComputerSessionUI(res);
        showToast('Active session stopped immediately');
      }
    });
  }

  // Revoke All button
  if (btnModalRevokeAll) {
    btnModalRevokeAll.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.revokeAllAccess) {
        const res = await window.electronAPI.revokeAllAccess();
        updateAccessSettingsUI(res);
        if (window.electronAPI.getComputerSessionStatus) {
          const cStatus = await window.electronAPI.getComputerSessionStatus();
          updateComputerSessionUI(cStatus);
        }
        showToast('All autonomous capabilities and sessions revoked immediately');
      }
    });
  }

  // Initialize Access settings from backend on load
  if (window.electronAPI && window.electronAPI.getAccessSettings) {
    window.electronAPI.getAccessSettings().then((settings) => {
      updateAccessSettingsUI(settings);
    }).catch(() => {});
  }

  if (window.electronAPI && window.electronAPI.onAccessStatusChanged) {
    window.electronAPI.onAccessStatusChanged((settings) => {
      updateAccessSettingsUI(settings);
    });
  }

  if (window.electronAPI && window.electronAPI.onComputerStatusChanged) {
    window.electronAPI.onComputerStatusChanged((status) => {
      updateComputerSessionUI(status);
    });
  }

  // Ensure approval banner is strictly hidden by default on startup
  const initialChatboxApprovalBanner = document.getElementById('chatbox-approval-banner');
  const initialPromptCapsule = document.getElementById('prompt-capsule-card');
  if (initialChatboxApprovalBanner) {
    initialChatboxApprovalBanner.classList.add('hidden');
    initialChatboxApprovalBanner.style.display = 'none';
  }
  if (initialPromptCapsule) {
    initialPromptCapsule.classList.remove('has-approval');
  }

  // In-Chat Interactive Approval Handler (Inside Chatbox & Transcript)
  if (window.electronAPI && typeof window.electronAPI.onRequestApproval === 'function') {
    window.electronAPI.onRequestApproval((req) => {
      if (!chatTranscript) return;

      const promptCapsule = document.getElementById('prompt-capsule-card');
      const chatboxApprovalBanner = document.getElementById('chatbox-approval-banner');
      const btnChatboxNo = document.getElementById('btn-chatbox-approval-no');
      const btnChatboxYes = document.getElementById('btn-chatbox-approval-yes');
      const chatboxApprovalText = document.getElementById('chatbox-approval-text');

      const approvalPrompt = 'Allow Sparx to Run Commands?';
      if (chatboxApprovalText) chatboxApprovalText.textContent = approvalPrompt;

      // Morph the chatbox into the wide approval bar with cool luminous glow
      if (promptCapsule && chatboxApprovalBanner) {
        promptCapsule.classList.add('has-approval');
        chatboxApprovalBanner.classList.remove('hidden');
        chatboxApprovalBanner.style.display = 'block';
        if (btnChatboxNo) btnChatboxNo.disabled = false;
        if (btnChatboxYes) btnChatboxYes.disabled = false;
      }

      // Transcript companion card (wide, no badges, no code box, white Yes/No buttons)
      const card = document.createElement('div');
      card.className = 'approval-card';
      card.id = `approval-card-${req.id}`;
      card.setAttribute('role', 'alertdialog');
      card.setAttribute('aria-labelledby', `approval-title-${req.id}`);

      card.innerHTML = `
        <div class="approval-card-left">
          <span class="approval-card-title" id="approval-title-${req.id}">${escapeHTML(approvalPrompt)}</span>
        </div>
        <div class="approval-card-footer">
          <button class="btn-approval-no" type="button" data-approval-id="${req.id}">No</button>
          <button class="btn-approval-yes" type="button" data-approval-id="${req.id}">Yes</button>
        </div>
      `;

      const denyBtn = card.querySelector('.btn-approval-no');
      const approveBtn = card.querySelector('.btn-approval-yes');
      const footer = card.querySelector('.approval-card-footer');

      let resolved = false;
      const handleDecision = async (approved) => {
        if (resolved) return;
        resolved = true;

        if (denyBtn) denyBtn.disabled = true;
        if (approveBtn) approveBtn.disabled = true;
        if (btnChatboxNo) btnChatboxNo.disabled = true;
        if (btnChatboxYes) btnChatboxYes.disabled = true;

        // Dismiss the in-chatbox banner smoothly
        if (promptCapsule && chatboxApprovalBanner) {
          promptCapsule.classList.remove('has-approval');
          chatboxApprovalBanner.classList.add('hidden');
          chatboxApprovalBanner.style.display = 'none';
        }

        // Deliver operator decision to main process
        if (window.electronAPI && typeof window.electronAPI.respondApproval === 'function') {
          await window.electronAPI.respondApproval(req.id, approved);
        }

        // Stamp transcript resolution
        if (approved) {
          card.classList.add('resolved-approved');
          footer.innerHTML = `
            <div class="approval-resolved-stamp approved">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Allowed Sparx to run commands</span>
            </div>
          `;
        } else {
          card.classList.add('resolved-denied');
          footer.innerHTML = `
            <div class="approval-resolved-stamp denied">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Commands declined by operator</span>
            </div>
          `;
        }
      };

      if (btnChatboxNo) btnChatboxNo.onclick = () => handleDecision(false);
      if (btnChatboxYes) btnChatboxYes.onclick = () => handleDecision(true);
      if (denyBtn) denyBtn.onclick = () => handleDecision(false);
      if (approveBtn) approveBtn.onclick = () => handleDecision(true);

      chatTranscript.appendChild(card);
      scrollTranscriptToBottom();
      announce(approvalPrompt);
    });
  }

  // Create a sidebar session DOM element with hover rename & delete buttons
  function createSidebarItemElement(sess, extraClass = '') {
    const item = document.createElement('div');
    item.className = `${extraClass} session-item ${sess.id === currentSessionId ? 'active' : ''}`;
    item.dataset.sessionId = sess.id;
    item.dataset.title = sess.title || '';

    item.innerHTML = `
      <div class="session-title-wrap">
        <span class="session-title" title="${escapeHTML(sess.title)}">${escapeHTML(sess.title || 'New conversation')}</span>
      </div>
      <div class="session-actions-group">
        <button class="session-action-btn btn-rename-session" title="Rename conversation" data-session-id="${sess.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="session-action-btn delete btn-delete-session" title="Delete conversation" data-session-id="${sess.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    item.addEventListener('click', () => loadSession(sess.id));

    const renBtn = item.querySelector('.btn-rename-session');
    if (renBtn) renBtn.addEventListener('click', (e) => openRenameModal(sess.id, e));

    const delBtn = item.querySelector('.btn-delete-session');
    if (delBtn) delBtn.addEventListener('click', (e) => deleteSession(sess.id, e));

    return item;
  }

  // Render all sidebar session groups: Pinned, Project, and Recents
  function renderAllSidebarSessions() {
    const allSessions = getStoredSessions();

    // 1. Pinned Section
    if (pinnedListContainer) {
      pinnedListContainer.innerHTML = '';
      const pinned = allSessions.filter((s) => s.isPinned);
      if (pinned.length === 0) {
        pinnedListContainer.innerHTML = '<div class="session-empty-state"><span>No pinned chats</span></div>';
      } else {
        pinned.forEach((sess) => {
          pinnedListContainer.appendChild(createSidebarItemElement(sess, 'clean-text-link'));
        });
      }
    }

    // 2. Project Folder Section
    if (projectChatsList) {
      projectChatsList.innerHTML = '';
      const projectChats = allSessions.filter((s) => s.projectId && !s.isPinned);
      if (projectChats.length === 0) {
        projectChatsList.innerHTML = '<div class="session-empty-state"><span>No project chats</span></div>';
      } else {
        projectChats.forEach((sess) => {
          projectChatsList.appendChild(createSidebarItemElement(sess, 'clean-text-link'));
        });
      }
    } else if (folderSubItems) {
      folderSubItems.innerHTML = '';
      const projectChats = allSessions.filter((s) => s.projectId && !s.isPinned);
      if (projectChats.length === 0) {
        folderSubItems.innerHTML = '<div class="session-empty-state"><span>No project chats</span></div>';
      } else {
        projectChats.forEach((sess) => {
          folderSubItems.appendChild(createSidebarItemElement(sess, 'sub-link-item'));
        });
      }
    }

    // 3. Recents Section
    if (sessionListContainer) {
      sessionListContainer.innerHTML = '';
      const recents = allSessions
        .filter((s) => !s.projectId && !s.isPinned)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      if (recents.length === 0) {
        sessionListContainer.innerHTML = '<div class="session-empty-state"><span>No recent sessions</span></div>';
      } else {
        recents.forEach((sess) => {
          sessionListContainer.appendChild(createSidebarItemElement(sess, 'clean-text-link'));
        });
      }
    }
  }

  // Switch to clicked session: updates sidebar highlight, loads messages, docks prompt capsule
  function loadSession(id) {
    const session = getSessionById(id);
    if (!session) return;

    if (destinationViewsContainer && !destinationViewsContainer.classList.contains('hidden')) {
      showChatStage();
    }

    if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
      closeSettingsView();
    }

    currentSessionId = id;
    try { localStorage.setItem('tactical_last_active_session', id); } catch (e) {}

    // Highlight clicked session across all sidebar links (Pinned, Projects, Recents)
    document.querySelectorAll('.session-item').forEach((elem) => {
      elem.classList.toggle('active', elem.dataset.sessionId === id);
    });

    if (chatTranscript) chatTranscript.innerHTML = '';

    if (session.messages && session.messages.length > 0) {
      if (chatWorkspaceMain) chatWorkspaceMain.classList.add('has-messages');

      session.messages.forEach((msg) => {
        if (!msg) return;
        if (msg.role === 'user') {
          renderUserCard(msg.displayText || msg.text || '', msg.timestamp, msg.attachments);
        } else {
          const card = renderAssistantCard(msg.text || '', msg.timestamp, msg.thoughtTime, msg.reasoning);
          if (msg.status === 'partial' && card) {
            const stopNote = document.createElement('div');
            stopNote.className = 'generation-stopped-note';
            stopNote.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"></rect>
              </svg>
              <span>Response interrupted</span>
            `;
            card.appendChild(stopNote);
          }
        }
      });

      scrollTranscriptToBottom();
    } else {
      if (chatWorkspaceMain) chatWorkspaceMain.classList.remove('has-messages');
    }

    if (chatTextarea) chatTextarea.focus();
  }

  // "+ New chat": Resets view back to centered hero greeting with dynamic title
  function startNewChat() {
    currentSessionId = null;
    try { localStorage.removeItem('tactical_last_active_session'); } catch (e) {}
    isStreaming = false;
    setReplyingState(false);
    activeAssistantCard = null;
    activeAssistantText = '';
    activeReasoningText = '';
    activeStreamingMessageId = null;
    if (streamSaveThrottleTimer) {
      clearTimeout(streamSaveThrottleTimer);
      streamSaveThrottleTimer = null;
    }

    if (destinationViewsContainer && !destinationViewsContainer.classList.contains('hidden')) {
      showChatStage();
    }

    if (settingsViewPage && !settingsViewPage.classList.contains('hidden')) {
      closeSettingsView();
    }

    if (btnStopStream) btnStopStream.classList.add('hidden');
    if (chatTranscript) chatTranscript.innerHTML = '';
    if (chatWorkspaceMain) chatWorkspaceMain.classList.remove('has-messages');

    // Remove active highlight from all sidebar items
    document.querySelectorAll('.session-item').forEach((elem) => {
      elem.classList.remove('active');
    });

    // Refresh hero greeting & placeholder according to current mode
    if (currentMode === 'work') {
      if (heroHeading) heroHeading.textContent = 'What should we work on?';
      if (chatTextarea) chatTextarea.placeholder = 'Describe what you want Sparx to accomplish…';
    } else {
      updateHeroGreeting();
      if (chatTextarea) chatTextarea.placeholder = 'Ask Sparx anything…';
    }

    attachedFiles = [];
    renderAttachedFilesTray();

    if (chatTextarea) {
      chatTextarea.value = '';
      chatTextarea.style.height = 'auto';
      chatTextarea.focus();
    }
  }

  if (btnNewChat) btnNewChat.addEventListener('click', startNewChat);
  if (btnNewChatTop) btnNewChatTop.addEventListener('click', startNewChat);

  // --------------------------------------------------------------------------
  // 8. Message Rendering & Markdown Parsing
  // --------------------------------------------------------------------------
  let userIsScrolledUp = false;
  if (chatTranscript) {
    chatTranscript.addEventListener('scroll', () => {
      const distanceFromBottom = chatTranscript.scrollHeight - chatTranscript.scrollTop - chatTranscript.clientHeight;
      userIsScrolledUp = distanceFromBottom > 60;
    }, { passive: true });
  }

  function scrollTranscriptToBottom(force = false) {
    if (!chatTranscript) return;
    if (force || !userIsScrolledUp) {
      chatTranscript.scrollTop = chatTranscript.scrollHeight;
    }
  }

  function renderUserCard(text, timestamp, attachments = []) {
    const card = document.createElement('div');
    card.className = 'message-card user';
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let attachmentsHtml = '';
    if (attachments && attachments.length > 0) {
      attachmentsHtml = `
        <div class="user-card-attachments">
          ${attachments.map((a) => `
            <span class="user-attached-file-badge" title="${escapeHTML(a.path || '')}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              </svg>
              <span>${escapeHTML(a.name || a)}</span>
            </span>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="author-info">
          <span class="agent-name">Operator</span>
        </div>
        ${timeStr ? `<span class="timestamp">${timeStr}</span>` : ''}
      </div>
      <div class="card-body">
        ${attachmentsHtml}
        <p class="user-prompt-text">${escapeHTML(text).replace(/\n/g, '<br/>')}</p>
      </div>
      <div class="message-hover-actions">
        <button class="btn-msg-action btn-copy-prompt" type="button" title="Copy prompt">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
        <button class="btn-msg-action btn-edit-prompt" type="button" title="Edit prompt">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Edit</span>
        </button>
      </div>
    `;

    const copyBtn = card.querySelector('.btn-copy-prompt');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color:#38bdf8;">Copied!</span>
          `;
          setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1600);
        } catch (err) {
          console.error('Failed to copy prompt:', err);
        }
      });
    }

    const editBtn = card.querySelector('.btn-edit-prompt');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatTextarea) {
          chatTextarea.value = text;
          chatTextarea.focus();
          chatTextarea.style.height = 'auto';
          chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 180) + 'px';
          chatTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    chatTranscript.appendChild(card);
    userIsScrolledUp = false;
    scrollTranscriptToBottom(true);
  }

  let workingStartTime = null;
  let workingTimerInterval = null;

  function renderAssistantCard(markdownText, timestamp, thoughtTime) {
    const card = document.createElement('div');
    card.className = 'message-card assistant';
    const parsedHTML = formatMarkdown(markdownText);
    const hasThought = typeof thoughtTime === 'number' && thoughtTime > 0;

    let thoughtHtml = '';
    if (hasThought) {
      thoughtHtml = `
        <div class="working-state-card completed collapsed-state">
          <div class="working-state-header">
            <span class="working-state-timer">Thought for ${thoughtTime}s</span>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      ${thoughtHtml}
      <div class="card-body">${parsedHTML}</div>
      <div class="message-hover-actions">
        <button class="btn-msg-action btn-copy-response" type="button" title="Copy response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    `;

    const copyBtn = card.querySelector('.btn-copy-response');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(markdownText);
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color:#38bdf8;">Copied!</span>
          `;
          setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1600);
        } catch (err) {
          console.error('Failed to copy response:', err);
        }
      });
    }

    chatTranscript.appendChild(card);
    enhanceCodeBlocks(card);
    scrollTranscriptToBottom();
    return card;
  }

  function setReplyingState(replying) {
    const promptCapsule = document.getElementById('prompt-capsule-card');
    if (promptCapsule) promptCapsule.classList.toggle('is-replying', !!replying);
    if (chatWorkspaceMain) chatWorkspaceMain.classList.toggle('is-replying', !!replying);
  }

  function createLiveStreamingCard() {
    workingStartTime = Date.now();
    if (workingTimerInterval) {
      clearInterval(workingTimerInterval);
      workingTimerInterval = null;
    }

    const isWork = (currentMode === 'work');
    const initialAction = isWork ? 'Analyzing task & planning engineering steps' : 'Thinking';

    const card = document.createElement('div');
    card.className = 'message-card assistant is-streaming';
    card.setAttribute('aria-busy', 'true');
    card.innerHTML = `
      <div class="working-state-card" id="working-state-block">
        <div class="working-state-header">
          <span class="working-state-dot"></span>
          <span class="working-state-timer">Working for 1s</span>
        </div>
        <div class="working-state-divider"></div>
        <div class="working-state-action">${initialAction}</div>
      </div>
      <div class="card-body"></div>
    `;

    const timerSpan = card.querySelector('.working-state-timer');
    const cardBlock = card.querySelector('.working-state-card');

    workingTimerInterval = setInterval(() => {
      if (!workingStartTime) return;
      const sec = Math.max(1, Math.floor((Date.now() - workingStartTime) / 1000));
      if (timerSpan && !cardBlock.classList.contains('completed')) {
        timerSpan.textContent = `Working for ${sec}s`;
      }
    }, 1000);

    chatTranscript.appendChild(card);
    scrollTranscriptToBottom();
    return card;
  }

  function formatMarkdown(raw) {
    if (!raw) return '';
    try {
      if (window.electronAPI && typeof window.electronAPI.parseMarkdown === 'function') {
        return window.electronAPI.parseMarkdown(raw);
      }
      if (window.marked && typeof window.marked.parse === 'function') {
        return window.marked.parse(raw);
      }
    } catch (e) {}
    return `<p>${escapeHTML(raw).replace(/\n/g, '<br/>')}</p>`;
  }

  function enhanceCodeBlocks(container) {
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      if (pre.dataset.enhanced) return;
      pre.dataset.enhanced = 'true';

      const codeElem = pre.querySelector('code');
      const text = codeElem ? codeElem.textContent : pre.textContent;

      let lang = 'code';
      if (codeElem && codeElem.className) {
        const match = codeElem.className.match(/language-(\w+)/);
        if (match) lang = match[1];
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-card';

      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span class="code-lang">${lang}</span>
        <div class="code-header-actions" style="display: flex; align-items: center; gap: 6px;">
          <button class="btn-apply-editor" title="Apply code to editor" type="button" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Apply to Editor</span>
          </button>
          <button class="btn-copy">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        </div>
      `;

      const applyBtn = header.querySelector('.btn-apply-editor');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          if (window.SparxIDE && typeof window.SparxIDE.applyToEditor === 'function') {
            window.SparxIDE.applyToEditor(text.trim());
          }
        });
      }

      const copyBtn = header.querySelector('.btn-copy');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text.trim()).then(() => {
          const original = copyBtn.innerHTML;
          copyBtn.innerHTML = '<span>Copied!</span>';
          setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
        });
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      pre.className = 'code-pre';
      wrapper.appendChild(pre);
    });
  }

  // --------------------------------------------------------------------------
  // 9. Seamless Silent Chat Dispatch & Interactive Working States
  // --------------------------------------------------------------------------
  async function handleSendMessage(overrideText = null) {
    if (isStreaming) {
      if (window.electronAPI && typeof window.electronAPI.cancelChat === 'function') {
        window.electronAPI.cancelChat();
      }
      isStreaming = false;
      setReplyingState(false);
      if (btnSendMessage) {
        btnSendMessage.classList.remove('is-streaming-btn');
        btnSendMessage.setAttribute('title', settings.enterToSend === 'ctrl-enter' ? 'Send (Ctrl+Enter)' : 'Send (Enter)');
        btnSendMessage.setAttribute('aria-label', 'Send message');
      }
      if (activeAssistantCard) {
        activeAssistantCard.classList.remove('is-streaming');
      }
      const userCards = chatTranscript ? chatTranscript.querySelectorAll('.message-card.user') : [];
      if (userCards.length > 0) {
        userCards[userCards.length - 1].classList.add('has-stopped');
      }
      return;
    }

    if (!chatTextarea) return;
    const rawUserText = (overrideText !== null && overrideText !== undefined) ? overrideText.trim() : chatTextarea.value.trim();
    if (!rawUserText) return;

    // Snapshot attached files & reset tray
    const currentAttachments = [...attachedFiles];
    attachedFiles = [];
    renderAttachedFilesTray();

    let fullPromptText = rawUserText;
    if (currentAttachments.length > 0 && window.electronAPI && typeof window.electronAPI.readFileContent === 'function') {
      let fileContextBlock = '\n\n[Context: Attached Workspace Files]\n';
      for (const att of currentAttachments) {
        try {
          const fileRes = await window.electronAPI.readFileContent(att.path);
          if (fileRes && fileRes.success && fileRes.content) {
            fileContextBlock += `--- File: ${att.name} (${att.path}) ---\n\`\`\`\n${fileRes.content.slice(0, 20000)}\n\`\`\`\n\n`;
          } else {
            fileContextBlock += `--- File: ${att.name} (${att.path}) ---\n\n`;
          }
        } catch (e) {
          fileContextBlock += `--- File: ${att.name} (${att.path}) ---\n\n`;
        }
      }
      fullPromptText = rawUserText + fileContextBlock;
    }

    let session = currentSessionId ? getSessionById(currentSessionId) : null;
    if (!session) {
      session = {
        id: 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title: 'New conversation',
        userRenamed: false,
        autoNamed: false,
        projectId: settings.newChatsInProject ? 'tactical-project' : null,
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      };
      currentSessionId = session.id;
    }

    const userMsgTimestamp = Date.now();
    const userMsgId = 'msg-u-' + userMsgTimestamp + '-' + Math.random().toString(36).slice(2, 8);
    const userMsgObj = {
      id: userMsgId,
      conversationId: session.id,
      role: 'user',
      text: fullPromptText,
      displayText: rawUserText,
      attachments: currentAttachments,
      timestamp: userMsgTimestamp,
      status: 'complete'
    };
    session.messages.push(userMsgObj);

    // Create assistant placeholder turn immediately with stable ID
    const assistantMsgTimestamp = Date.now();
    activeStreamingMessageId = 'msg-a-' + assistantMsgTimestamp + '-' + Math.random().toString(36).slice(2, 8);
    const assistantPlaceholder = {
      id: activeStreamingMessageId,
      conversationId: session.id,
      role: 'assistant',
      text: '',
      status: 'streaming',
      thoughtTime: 0,
      reasoning: '',
      timestamp: assistantMsgTimestamp
    };
    session.messages.push(assistantPlaceholder);
    session.updatedAt = Date.now();
    saveCurrentSession(session);
    checkAndUpdateSessionTitle(session);

    if (chatWorkspaceMain && !chatWorkspaceMain.classList.contains('has-messages')) {
      chatWorkspaceMain.classList.add('has-messages');
    }

    renderUserCard(rawUserText, userMsgObj.timestamp, currentAttachments);

    if (!overrideText) {
      chatTextarea.value = '';
      chatTextarea.style.height = 'auto';
    }

    replyHadError = false;
    isStreaming = true;
    setReplyingState(true);
    activeAssistantText = '';
    activeReasoningText = '';
    if (btnSendMessage) {
      btnSendMessage.classList.add('is-streaming-btn');
      btnSendMessage.setAttribute('title', 'Stop response');
      btnSendMessage.setAttribute('aria-label', 'Stop response');
    }
    if (btnStopStream) btnStopStream.classList.add('hidden');
    activeAssistantCard = createLiveStreamingCard();

    if (typeof decrementUsageOptimistic === 'function') {
      decrementUsageOptimistic();
    }

    // Silently dispatch message to backend
    window.electronAPI.sendMessage({
      messages: session.messages,
      model: currentModel,
      mode: currentMode,
      tools: {
        files: settings.toolFiles,
        web: settings.toolWebSearch,
        grounding: settings.webGrounding
      }
    });
  }

  // --------------------------------------------------------------------------
  // Voice Recording & Windows Speech Dictation Subsystem
  // --------------------------------------------------------------------------
  let voiceMediaStream = null;
  let voiceMediaRecorder = null;
  let voiceAudioChunks = [];
  let voiceTimerInterval = null;
  let voiceStartTime = 0;
  let isVoiceRecording = false;

  function updateVoiceTimerDisplay() {
    if (!voiceStartTime || !voiceRecordingTimer) return;
    const elapsedSec = Math.floor((Date.now() - voiceStartTime) / 1000);
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    voiceRecordingTimer.textContent = `${mins}:${secs}`;
  }

  function startVoiceTimer() {
    voiceStartTime = Date.now();
    updateVoiceTimerDisplay();
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = setInterval(updateVoiceTimerDisplay, 500);
  }

  function stopVoiceTimer() {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
    if (voiceRecordingTimer) voiceRecordingTimer.textContent = '00:00';
  }

  function setVoiceRecordingUI(recording, statusLabel) {
    if (btnVoiceRecord) {
      if (recording) {
        btnVoiceRecord.classList.add('is-recording');
        btnVoiceRecord.setAttribute('title', 'Stop recording and transcribe');
      } else {
        btnVoiceRecord.classList.remove('is-recording');
        btnVoiceRecord.setAttribute('title', 'Voice dictation (Talk instead of typing)');
      }
    }

    if (voiceRecordingBanner) {
      if (recording) {
        voiceRecordingBanner.classList.remove('hidden');
        if (voiceRecordingLabel) {
          voiceRecordingLabel.textContent = statusLabel || 'Listening to your voice...';
        }
        if (voiceSoundwaves) voiceSoundwaves.style.display = 'flex';
        if (btnVoiceDone) btnVoiceDone.style.display = 'inline-block';
        if (btnVoiceCancel) btnVoiceCancel.style.display = 'inline-block';
      } else if (statusLabel) {
        // Transcribing / processing state
        voiceRecordingBanner.classList.remove('hidden');
        if (voiceRecordingLabel) {
          voiceRecordingLabel.textContent = statusLabel;
        }
        if (voiceSoundwaves) voiceSoundwaves.style.display = 'none';
        if (btnVoiceDone) btnVoiceDone.style.display = 'none';
        if (btnVoiceCancel) btnVoiceCancel.style.display = 'none';
      } else {
        voiceRecordingBanner.classList.add('hidden');
      }
    }
  }

  async function startVoiceRecording() {
    if (isVoiceRecording) return;

    // Check Windows microphone permission first
    try {
      const permRes = await window.electronAPI.getMicrophonePermission();
      if (!permRes || permRes.status !== 'granted') {
        // User must accept permissions from Windows default notification and native prompt
        const reqRes = await window.electronAPI.requestMicrophonePermission();
        if (!reqRes || !reqRes.granted) {
          showToast('Microphone access was denied in Windows.');
          return;
        }
      }
    } catch (err) {
      console.warn('[Microphone permission check failed]:', err);
    }

    try {
      voiceMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err) {
      console.error('[getUserMedia error]:', err);
      showToast('Could not access microphone: ' + (err.message || 'Permission denied'));
      return;
    }

    voiceAudioChunks = [];
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
    }

    try {
      voiceMediaRecorder = mimeType ? new MediaRecorder(voiceMediaStream, { mimeType }) : new MediaRecorder(voiceMediaStream);
    } catch (e) {
      voiceMediaRecorder = new MediaRecorder(voiceMediaStream);
    }

    voiceMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        voiceAudioChunks.push(event.data);
      }
    };

    voiceMediaRecorder.start(250);
    isVoiceRecording = true;
    setVoiceRecordingUI(true, 'Listening to your voice...');
    startVoiceTimer();
  }

  async function stopVoiceRecording(shouldTranscribe) {
    if (!isVoiceRecording) return;
    isVoiceRecording = false;
    stopVoiceTimer();

    if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
      try {
        voiceMediaRecorder.stop();
      } catch (e) {}
    }

    if (voiceMediaStream) {
      voiceMediaStream.getTracks().forEach(track => track.stop());
      voiceMediaStream = null;
    }

    if (!shouldTranscribe) {
      voiceAudioChunks = [];
      setVoiceRecordingUI(false);
      return;
    }

    setVoiceRecordingUI(false, 'Transcribing speech with Sparx...');

    // Short timeout to guarantee final data slice is flushed
    setTimeout(async () => {
      try {
        const mimeType = voiceMediaRecorder ? (voiceMediaRecorder.mimeType || 'audio/webm') : 'audio/webm';
        const audioBlob = new Blob(voiceAudioChunks, { type: mimeType });
        voiceAudioChunks = [];

        if (audioBlob.size < 200) {
          setVoiceRecordingUI(false);
          showToast('Recording was too short to transcribe.');
          return;
        }

        const arrayBuf = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binaryStr = '';
        const chunkSz = 8192;
        for (let i = 0; i < bytes.length; i += chunkSz) {
          const sub = bytes.subarray(i, i + chunkSz);
          binaryStr += String.fromCharCode.apply(null, sub);
        }
        const audioBase64 = btoa(binaryStr);

        const result = await window.electronAPI.transcribeAudio({
          audioBase64,
          mimeType
        });

        if (result && result.success && result.text) {
          const transcribed = result.text.trim();
          if (transcribed) {
            if (chatTextarea) {
              const currentVal = chatTextarea.value.trim();
              if (currentVal) {
                chatTextarea.value = currentVal + ' ' + transcribed;
              } else {
                chatTextarea.value = transcribed;
              }
              chatTextarea.style.height = 'auto';
              chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 180) + 'px';
              chatTextarea.focus();
            }
            showToast('Voice transcribed into prompt!');
          } else {
            showToast('No speech detected in audio.');
          }
        } else if (result && !result.success) {
          showToast('Transcription failed: ' + (result.error || 'Server error'));
        }
      } catch (err) {
        console.error('[Voice transcription error]:', err);
        showToast('Transcription error: ' + err.message);
      } finally {
        setVoiceRecordingUI(false);
      }
    }, 150);
  }

  if (btnVoiceRecord) {
    btnVoiceRecord.addEventListener('click', () => {
      if (isVoiceRecording) {
        stopVoiceRecording(true);
      } else {
        startVoiceRecording();
      }
    });
  }

  if (btnVoiceDone) {
    btnVoiceDone.addEventListener('click', () => {
      stopVoiceRecording(true);
    });
  }

  if (btnVoiceCancel) {
    btnVoiceCancel.addEventListener('click', () => {
      stopVoiceRecording(false);
    });
  }

  if (btnSendMessage) btnSendMessage.addEventListener('click', () => handleSendMessage());

  if (chatTextarea) {
    chatTextarea.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const hasModifier = e.ctrlKey || e.metaKey;
      // "enter" mode: Enter sends. "ctrl-enter" mode: only Ctrl/Cmd+Enter sends, Enter adds a new line.
      const shouldSend = settings.enterToSend === 'ctrl-enter' ? hasModifier : true;
      if (shouldSend) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    chatTextarea.addEventListener('input', () => {
      chatTextarea.style.height = 'auto';
      chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 180) + 'px';
    });
  }

  if (btnStopStream) {
    btnStopStream.addEventListener('click', () => {
      if (isStreaming) {
        window.electronAPI.cancelChat();
        if (activeAssistantCard) {
          activeAssistantCard.classList.remove('is-streaming');
        }
      }
    });
  }

  // Interactive Transcript Delegation: Retry Actions & External Links
  if (chatTranscript) {
    chatTranscript.addEventListener('click', (e) => {
      const retryBtn = e.target.closest('.btn-retry-action');
      if (retryBtn) {
        e.preventDefault();
        let retryPrompt = '';
        if (currentSessionId) {
          const sess = getSessionById(currentSessionId);
          if (sess && sess.messages && sess.messages.length > 0) {
            for (let i = sess.messages.length - 1; i >= 0; i--) {
              if (sess.messages[i].role === 'user') {
                retryPrompt = sess.messages[i].displayText || sess.messages[i].text;
                // Slice off this user turn and any failed turns so handleSendMessage does not duplicate the turn
                sess.messages = sess.messages.slice(0, i);
                saveCurrentSession(sess);
                break;
              }
            }
          }
        }
        if (!retryPrompt) {
          const userCards = chatTranscript.querySelectorAll('.message-card.user .card-body p');
          if (userCards.length > 0) {
            retryPrompt = userCards[userCards.length - 1].textContent;
          }
        }

        // Remove the failed assistant card and preceding user card from DOM
        const lastAssistantCard = chatTranscript.querySelector('.message-card.assistant:last-child');
        if (lastAssistantCard) lastAssistantCard.remove();
        const lastUserCard = chatTranscript.querySelector('.message-card.user:last-child');
        if (lastUserCard) lastUserCard.remove();

        if (retryPrompt) {
          handleSendMessage(retryPrompt);
        }
        return;
      }

      const link = e.target.closest('a');
      if (link && link.href) {
        if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
          e.preventDefault();
          openURL(link.href);
        } else if (link.href.startsWith('file://')) {
          e.preventDefault();
          if (window.electronAPI && typeof window.electronAPI.showItemInFolder === 'function') {
            window.electronAPI.showItemInFolder(link.href);
          }
        }
      }

      // ReShade Preset Card Action Buttons
      const btnPresetDownload = e.target.closest('.btn-download-preset-glass');
      if (btnPresetDownload) {
        e.preventDefault();
        const pPath = btnPresetDownload.dataset.presetPath || btnPresetDownload.getAttribute('href')?.replace('file:///', '');
        if (pPath && window.electronAPI && typeof window.electronAPI.showItemInFolder === 'function') {
          window.electronAPI.showItemInFolder(pPath);
        }
        return;
      }

      const btnPresetFolder = e.target.closest('.btn-reveal-folder-glass');
      if (btnPresetFolder) {
        e.preventDefault();
        const fPath = btnPresetFolder.dataset.folder;
        if (fPath && window.electronAPI && typeof window.electronAPI.openPath === 'function') {
          window.electronAPI.openPath(fPath);
        }
        return;
      }
    });
  }

  // Streaming & Working States IPC Handlers
  window.electronAPI.onStreamStart(() => {
    isStreaming = true;
    setReplyingState(true);
    if (btnSendMessage) {
      btnSendMessage.classList.add('is-streaming-btn');
      btnSendMessage.setAttribute('title', 'Stop response');
      btnSendMessage.setAttribute('aria-label', 'Stop response');
    }
    if (btnStopStream) btnStopStream.classList.add('hidden');
    if (activeAssistantCard) {
      activeAssistantCard.classList.add('is-streaming');
    }
  });

  window.electronAPI.onChatStatus((data) => {
    if (!activeAssistantCard) return;
    const actionElem = activeAssistantCard.querySelector('.working-state-action');
    if (!actionElem) return;

    if (data.state === 'thinking') {
      actionElem.textContent = 'Thinking';
    } else if (data.state === 'searching') {
      actionElem.textContent = `Searching web for "${data.query || ''}"...`;
    } else if (data.state === 'tool') {
      if (data.toolName === 'execute_terminal_command' || data.details === 'Running Command') {
        actionElem.textContent = 'Running Command';
      } else {
        actionElem.textContent = `${data.details || data.toolName || 'Executing tool'}...`;
      }
    }
    scrollTranscriptToBottom();
  });

  if (window.electronAPI.onReasoningChunk) {
    window.electronAPI.onReasoningChunk((data) => {
      if (!activeAssistantCard) return;
      const chunk = (data && data.chunk) || '';
      activeReasoningText += chunk;
      const actionElem = activeAssistantCard.querySelector('.working-state-action');
      if (actionElem && actionElem.textContent !== 'Thinking') {
        actionElem.textContent = 'Thinking';
      }
      if (settings.autoScroll) scrollTranscriptToBottom();
    });
  }

  window.electronAPI.onToolResult((data) => {
    if (!activeAssistantCard) return;
    const statusContainer = activeAssistantCard.querySelector('.card-status-container');
    if (statusContainer) {
      statusContainer.innerHTML = '';
    }

    const bodyElem = activeAssistantCard.querySelector('.card-body');
    if (!bodyElem) return;

    if (data.tool === 'web_search' || data.tool === 'google_search_grounding') {
      const sources = data.sources || [];
      if (sources.length > 0) {
        let sourcesHtml = `
          <div class="assistant-sources-container">
            <div class="sources-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>Sources (${sources.length})</span>
            </div>
            <div class="sources-list">
        `;
        sources.forEach((s) => {
          sourcesHtml += `
            <a href="${escapeHTML(s.url)}" target="_blank" class="source-item" title="${escapeHTML(s.snippet || s.title || s.url)}">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>${escapeHTML(s.title || s.url)}</span>
            </a>
          `;
        });
        sourcesHtml += `</div></div>`;

        const existingSources = activeAssistantCard.querySelector('.assistant-sources-container');
        if (!existingSources) {
          activeAssistantCard.insertBefore(document.createRange().createContextualFragment(sourcesHtml), bodyElem);
        }
      }
    } else if (data.tool === 'read_file') {
      const detailsHtml = `
        <details class="tool-result-details">
          <summary class="tool-summary-header">
            <svg class="tool-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Read workspace file: <code>${escapeHTML(data.path)}</code></span>
            <span class="tool-meta-badge">${(data.size / 1024).toFixed(1)} KB · ${data.lines} lines</span>
          </summary>
          <div class="tool-result-body">Loaded ${data.lines} lines (${(data.size / 1024).toFixed(1)} KB) from workspace.</div>
        </details>
      `;
      activeAssistantCard.insertBefore(document.createRange().createContextualFragment(detailsHtml), bodyElem);
    } else if (data.tool === 'list_files') {
      const detailsHtml = `
        <details class="tool-result-details">
          <summary class="tool-summary-header">
            <svg class="tool-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Scanned workspace directory</span>
            <span class="tool-meta-badge">${data.count} items found</span>
          </summary>
          <div class="tool-result-body">Discovered ${data.count} project items in active workspace.</div>
        </details>
      `;
      activeAssistantCard.insertBefore(document.createRange().createContextualFragment(detailsHtml), bodyElem);
    }

    scrollTranscriptToBottom();
  });

  window.electronAPI.onToolError((data) => {
    replyHadError = true;
    announce('A tool action failed. A retry button is available.');
    notifyIfBackground('notifyOnError', 'Reply failed', String((data && data.error) || 'A tool action failed.').slice(0, 120));
    if (!activeAssistantCard) return;
    const statusContainer = activeAssistantCard.querySelector('.card-status-container');
    if (statusContainer) statusContainer.innerHTML = '';

    const bodyElem = activeAssistantCard.querySelector('.card-body');
    const errorHtml = `
      <div class="assistant-error-card">
        <div class="error-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Tool Execution Issue (${escapeHTML(data.tool || 'Action')})</span>
        </div>
        <div class="error-message">${escapeHTML(data.error || 'An error occurred during execution.')}</div>
        <button class="btn-retry-action" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Retry Action</span>
        </button>
      </div>
    `;
    if (bodyElem) {
      activeAssistantCard.insertBefore(document.createRange().createContextualFragment(errorHtml), bodyElem);
    }
    scrollTranscriptToBottom();
  });

  window.electronAPI.onStreamChunk((data) => {
    const chunkText = (data && data.text) || (typeof data === 'string' ? data : '');
    activeAssistantText += chunkText;

    // Incremental stream persistence: update active assistant turn in memory and throttled to disk
    if (currentSessionId && activeStreamingMessageId) {
      const session = getSessionById(currentSessionId);
      if (session && Array.isArray(session.messages)) {
        const activeMsg = session.messages.find(m => m.id === activeStreamingMessageId);
        if (activeMsg) {
          activeMsg.text = activeAssistantText;
          activeMsg.status = 'partial';
          session.updatedAt = Date.now();
          if (!streamSaveThrottleTimer) {
            streamSaveThrottleTimer = setTimeout(() => {
              streamSaveThrottleTimer = null;
              saveStoredSessions(getStoredSessions());
            }, 800);
          }
        }
      }
    }

    if (!activeAssistantCard) return;

    const cardBlock = activeAssistantCard.querySelector('.working-state-card');
    if (cardBlock && !cardBlock.classList.contains('completed')) {
      if (workingTimerInterval) {
        clearInterval(workingTimerInterval);
        workingTimerInterval = null;
      }
      const finalSec = workingStartTime ? Math.max(1, Math.floor((Date.now() - workingStartTime) / 1000)) : 1;
      cardBlock.classList.add('completed', 'collapsed-state');
      const timerSpan = cardBlock.querySelector('.working-state-timer');
      if (timerSpan) {
        timerSpan.textContent = `Thought for ${finalSec}s`;
      }
    }

    const bodyElem = activeAssistantCard.querySelector('.card-body');
    if (bodyElem) {
      bodyElem.innerHTML = formatMarkdown(activeAssistantText) + '<span class="streaming-cursor" aria-hidden="true"></span>';
      enhanceCodeBlocks(activeAssistantCard);
    }
    if (settings.autoScroll) scrollTranscriptToBottom();
  });

  window.electronAPI.onStreamEnd(async (data) => {
    isStreaming = false;
    setReplyingState(false);
    if (streamSaveThrottleTimer) {
      clearTimeout(streamSaveThrottleTimer);
      streamSaveThrottleTimer = null;
    }
    if (workingTimerInterval) {
      clearInterval(workingTimerInterval);
      workingTimerInterval = null;
    }
    if (btnSendMessage) {
      btnSendMessage.classList.remove('is-streaming-btn');
      btnSendMessage.setAttribute('title', settings.enterToSend === 'ctrl-enter' ? 'Send (Ctrl+Enter)' : 'Send (Enter)');
      btnSendMessage.setAttribute('aria-label', 'Send message');
    }
    if (btnStopStream) btnStopStream.classList.add('hidden');
    announce(data && data.aborted ? 'Generation stopped.' : 'Response complete.');
    if (!(data && data.aborted) && !replyHadError) notifyIfBackground('notifyOnComplete', 'Reply finished', 'Sparx has finished replying.');
    replyHadError = false;

    if (data && data.aborted) {
      const userCards = chatTranscript ? chatTranscript.querySelectorAll('.message-card.user') : [];
      if (userCards.length > 0) {
        userCards[userCards.length - 1].classList.add('has-stopped');
      }
    }

    const finalContent = (data && data.fullText) || activeAssistantText;
    const finalSec = workingStartTime ? Math.max(1, Math.floor((Date.now() - workingStartTime) / 1000)) : 1;
    const reasoningText = (data && data.reasoning) || activeReasoningText || '';

    if (activeAssistantCard) {
      activeAssistantCard.classList.remove('is-streaming');
      activeAssistantCard.removeAttribute('aria-busy');

      const cardBlock = activeAssistantCard.querySelector('.working-state-card');
      if (cardBlock) {
        cardBlock.classList.add('completed', 'collapsed-state');
        const timerSpan = cardBlock.querySelector('.working-state-timer');
        if (timerSpan) {
          timerSpan.textContent = `Thought for ${finalSec}s`;
        }
      }

      const bodyElem = activeAssistantCard.querySelector('.card-body');
      if (bodyElem) {
        bodyElem.innerHTML = formatMarkdown(finalContent);
        enhanceCodeBlocks(activeAssistantCard);
      }

      // Add hover copy button to completed streaming assistant card
      const hoverActions = document.createElement('div');
      hoverActions.className = 'message-hover-actions';
      hoverActions.innerHTML = `
        <button class="btn-msg-action btn-copy-response" type="button" title="Copy response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      `;
      const copyBtn = hoverActions.querySelector('.btn-copy-response');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(finalContent);
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span style="color:#38bdf8;">Copied!</span>
            `;
            setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1600);
          } catch (err) {
            console.error('Failed to copy response:', err);
          }
        });
      }
      activeAssistantCard.appendChild(hoverActions);

      if (data && data.aborted) {
        const stopNote = document.createElement('div');
        stopNote.className = 'generation-stopped-note';
        stopNote.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
          </svg>
          <span>Generation stopped</span>
        `;
        activeAssistantCard.appendChild(stopNote);
      }
    }

    // Persist completed assistant message directly to session and disk
    if (currentSessionId) {
      const session = getSessionById(currentSessionId);
      if (session && Array.isArray(session.messages)) {
        let msg = activeStreamingMessageId ? session.messages.find(m => m.id === activeStreamingMessageId) : null;
        if (!msg) {
          msg = {
            id: 'msg-a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            conversationId: session.id,
            role: 'assistant',
            timestamp: Date.now()
          };
          session.messages.push(msg);
        }
        msg.text = finalContent;
        msg.thoughtTime = finalSec;
        msg.reasoning = reasoningText;
        msg.status = (data && data.aborted) ? 'partial' : 'complete';
        session.updatedAt = Date.now();
        const saveRes = await saveCurrentSession(session);
        if (saveRes && saveRes.success === false) {
          console.error('[Sparx Persistence] Save completed response failed:', saveRes.error);
        }
        checkAndUpdateSessionTitle(session);
      }
    }

    activeAssistantCard = null;
    activeAssistantText = '';
    activeReasoningText = '';
    activeStreamingMessageId = null;
    workingStartTime = null;
    scrollTranscriptToBottom();
  });

  window.electronAPI.onChatError(async (data) => {
    isStreaming = false;
    setReplyingState(false);
    if (streamSaveThrottleTimer) {
      clearTimeout(streamSaveThrottleTimer);
      streamSaveThrottleTimer = null;
    }
    if (workingTimerInterval) {
      clearInterval(workingTimerInterval);
      workingTimerInterval = null;
    }
    if (btnSendMessage) {
      btnSendMessage.classList.remove('is-streaming-btn');
      btnSendMessage.setAttribute('title', settings.enterToSend === 'ctrl-enter' ? 'Send (Ctrl+Enter)' : 'Send (Enter)');
      btnSendMessage.setAttribute('aria-label', 'Send message');
    }
    if (btnStopStream) btnStopStream.classList.add('hidden');
    announce('The reply failed. A retry button is available.');
    notifyIfBackground('notifyOnError', 'Reply failed', (data && data.error) ? String(data.error).slice(0, 120) : 'Sparx could not complete the reply.');

    const errMsg = (data && data.error) || 'An error occurred during response generation.';

    if (currentSessionId && activeStreamingMessageId) {
      const session = getSessionById(currentSessionId);
      if (session && Array.isArray(session.messages)) {
        const msg = session.messages.find(m => m.id === activeStreamingMessageId);
        if (msg) {
          if (!msg.text || !msg.text.trim()) {
            msg.text = `⚠️ Error: ${errMsg}`;
            msg.status = 'error';
          } else {
            msg.status = 'partial';
          }
          await saveCurrentSession(session);
        }
      }
    }

    if (activeAssistantCard) {
      activeAssistantCard.classList.remove('is-streaming');
      activeAssistantCard.removeAttribute('aria-busy');

      const cardBlock = activeAssistantCard.querySelector('.working-state-card');
      if (cardBlock) {
        cardBlock.classList.add('completed', 'collapsed-state');
      }

      const bodyElem = activeAssistantCard.querySelector('.card-body');
      const errorHtml = `
        <div class="assistant-error-card">
          <div class="error-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Generation Failed</span>
          </div>
          <div class="error-message">${escapeHTML(errMsg)}</div>
          <button class="btn-retry-action" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Retry</span>
          </button>
        </div>
      `;
      if (bodyElem) {
        bodyElem.innerHTML = errorHtml;
      }
    }

    activeAssistantCard = null;
    activeAssistantText = '';
    activeReasoningText = '';
    activeStreamingMessageId = null;
    scrollTranscriptToBottom();
  });

  // Adaptive Skill Evolution Notifications
  if (window.electronAPI.onSkillLearned) {
    window.electronAPI.onSkillLearned((data) => {
      if (!data || !data.skill) return;
      announce(`AI developed skill: ${data.skill}`);
      // Show subtle notification banner
      if (typeof showStatusBanner === 'function') {
        showStatusBanner(`AI evolved: learned ${data.category || 'skill'} ("${data.skill.slice(0, 40)}...")`, 'info');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 9b. Settings System (persisted in the main-process config file via IPC)
  // --------------------------------------------------------------------------
  const DEFAULT_SETTINGS = {
    theme: 'midnight-oled',
    accent: 'cyan',
    font: 'default',
    fontSize: 'medium',
    density: 'comfortable',
    wrapCode: true,
    reduceMotion: 'system',
    enterToSend: 'enter',
    autoScroll: true,
    showTimestamps: true,
    showToolDetails: true,
    autoNameChats: true,
    confirmDelete: true,
    defaultModel: 'sparx-3.9-flash',
    webGrounding: true,
    notifyOnComplete: false,
    notifyOnError: false,
    newChatsInProject: true,
    toolFiles: true,
    toolWebSearch: true
  };

  const SETTING_CHOICES = {
    theme: [
      'obsidian-violet',
      'midnight-oled',
      'halloween-spooky',
      'cyber-emerald',
      'electric-cyan',
      'sunset-coral',
      'nordic-frost',
      'synthwave-84',
      'solar-amber',
      'dracula-vampire'
    ],
    accent: ['violet', 'pumpkin', 'cyan', 'emerald', 'coral', 'amber', 'magenta', 'frost', 'monochrome'],
    font: ['default', 'mono', 'system'],
    fontSize: ['small', 'medium', 'large'],
    density: ['comfortable', 'compact'],
    reduceMotion: ['system', 'always'],
    enterToSend: ['enter', 'ctrl-enter'],
    defaultModel: Array.from(document.querySelectorAll('.model-option')).map((o) => o.dataset.model)
  };

  let settings = Object.assign({}, DEFAULT_SETTINGS);

  // Accept only known keys with the right type and an allowed value; anything else falls back to the default.
  function sanitizeSettings(raw) {
    const clean = Object.assign({}, DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object') return clean;
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
      const value = raw[key];
      if (typeof value !== typeof DEFAULT_SETTINGS[key]) return;
      if (SETTING_CHOICES[key] && !SETTING_CHOICES[key].includes(value)) return;
      clean[key] = value;
    });
    return clean;
  }

  function announce(message) {
    const region = document.getElementById('sr-announcer');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 30);
  }

  function titleFromText(text) {
    if (!text) return 'New conversation';
    let t = String(text).trim().replace(/^["'`]+|["'`]+$/g, '');
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
    t = t.replace(/^debug\s+/i, 'Debugging ')
         .replace(/^fix\s+/i, 'Fixing ')
         .replace(/^(?:make|create)\s+(?:me\s+)?(?:a\s+)?(?:new\s+)?/i, 'Creating ')
         .replace(/^build\s+/i, 'Building ')
         .replace(/^(?:setup|set\s+up)\s+/i, 'Setting Up ');
    const words = t.split(/\s+/).filter(Boolean);
    let short = words.slice(0, 5).join(' ');
    if (short.length > 34) short = short.slice(0, 34).trim();
    short = short.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
    return short || 'New conversation';
  }

  function selectModel(model) {
    if (!model) model = 'sparx-3.9-flash';
    let target = Array.from(modelOptions).find((o) => o.dataset.model === model);
    if (!target) {
      const lower = String(model).toLowerCase();
      if (lower.includes('3.8') || lower.includes('pro') || lower.includes('llama') || lower.includes('20b')) {
        target = Array.from(modelOptions).find((o) => o.dataset.model === 'sparx-3.8-pro');
      } else {
        target = Array.from(modelOptions).find((o) => o.dataset.model === 'sparx-3.9-flash');
      }
    }
    if (!target) return;
    modelOptions.forEach((o) => o.classList.toggle('active', o === target));
    currentModel = target.dataset.model;
    const nameElem = target.querySelector('.model-option-name');
    if (currentModelLabel && nameElem) currentModelLabel.textContent = nameElem.textContent;
  }

  function applySettings() {
    const body = document.body;
    const docEl = document.documentElement;

    const theme = settings.theme || 'obsidian-violet';
    docEl.dataset.theme = theme;
    body.dataset.theme = theme;

    const accent = settings.accent || 'violet';
    docEl.dataset.accent = accent;
    body.dataset.accent = accent;

    const font = settings.font || 'default';
    docEl.dataset.font = font;
    body.dataset.font = font;

    body.dataset.fontsize = settings.fontSize;
    body.dataset.density = settings.density;
    body.classList.toggle('code-no-wrap', !settings.wrapCode);
    body.classList.toggle('reduce-motion', settings.reduceMotion === 'always');
    body.classList.toggle('hide-timestamps', !settings.showTimestamps);
    body.classList.toggle('hide-tool-details', !settings.showToolDetails);
    if (!isStreaming) selectModel(settings.defaultModel);
    if (btnSendMessage) {
      btnSendMessage.title = settings.enterToSend === 'ctrl-enter' ? 'Send (Ctrl+Enter)' : 'Send (Enter)';
      btnSendMessage.setAttribute('aria-label', 'Send message');
    }
  }

  function syncSettingsControls() {
    document.querySelectorAll('[data-setting]').forEach((el) => {
      const key = el.dataset.setting;
      if (!(key in settings)) return;
      if (el.type === 'checkbox') el.checked = !!settings[key];
      else el.value = settings[key];
    });
  }

  function persistSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    settings[key] = value;
    applySettings();
    syncSettingsControls();
    if (window.electronAPI && typeof window.electronAPI.setSettings === 'function') {
      window.electronAPI.setSettings({ [key]: value }).catch(() => showToast('Could not save this setting'));
    }
  }

  async function initSettings() {
    try {
      const stored = await window.electronAPI.getSettings();
      settings = sanitizeSettings(stored);
    } catch (e) {
      settings = Object.assign({}, DEFAULT_SETTINGS);
    }
    applySettings();
    syncSettingsControls();
  }

  document.querySelectorAll('[data-setting]').forEach((el) => {
    el.addEventListener('change', () => {
      const key = el.dataset.setting;
      const value = el.type === 'checkbox' ? el.checked : el.value;
      if (SETTING_CHOICES[key] && !SETTING_CHOICES[key].includes(value)) {
        syncSettingsControls();
        return;
      }
      persistSetting(key, value);
      announce('Setting saved');
    });
  });

  // Desktop notifications (only for events this app produces: reply finished / reply failed)
  function notifyIfBackground(settingKey, title, body) {
    if (!settings[settingKey] || document.hasFocus() || !('Notification' in window)) return;
    const show = () => { try { new Notification(title, { body }); } catch (e) {} };
    if (Notification.permission === 'granted') show();
    else if (Notification.permission === 'default') Notification.requestPermission().then((p) => { if (p === 'granted') show(); });
  }

  const btnTestNotification = document.getElementById('btn-test-notification');
  if (btnTestNotification) {
    btnTestNotification.addEventListener('click', async () => {
      const status = document.getElementById('notify-test-status');
      const setStatus = (t) => { if (status) status.textContent = t; };
      if (!('Notification' in window)) { setStatus('Notifications are not available in this environment.'); return; }
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('Notifications are blocked. Allow them in your system settings.'); return; }
      new Notification('Sparx', { body: 'Test notification.' });
      setStatus('Test notification sent. If you did not see it, check your system notification settings.');
    });
  }

  // Models: API key
  const inputGeminiApiKey = document.getElementById('input-gemini-api-key');
  const btnSaveApiKey = document.getElementById('btn-save-api-key');
  const btnClearApiKey = document.getElementById('btn-clear-api-key');
  const apiKeyError = document.getElementById('api-key-error');

  function setApiKeyError(message) {
    if (apiKeyError) apiKeyError.textContent = message || '';
    if (inputGeminiApiKey) inputGeminiApiKey.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  async function refreshApiKeyPlaceholder() {
    if (!inputGeminiApiKey) return;
    try {
      const info = (window.electronAPI && window.electronAPI.getApiKeyInfo)
        ? await window.electronAPI.getApiKeyInfo()
        : {};
      if (info.hasCustomKey) {
        inputGeminiApiKey.placeholder = 'Custom key active. Paste a new key to replace it.';
      } else if (info.hasBuiltinKey) {
        inputGeminiApiKey.placeholder = 'Built-in system key active. Paste your own key to override.';
      } else if (info.hasEnvKey) {
        inputGeminiApiKey.placeholder = 'Environment key active. Paste your own key to override.';
      } else {
        inputGeminiApiKey.placeholder = 'Paste API key';
      }
    } catch (e) {
      inputGeminiApiKey.placeholder = 'Paste API key';
    }
  }

  if (btnSaveApiKey && inputGeminiApiKey) {
    btnSaveApiKey.addEventListener('click', async () => {
      const key = inputGeminiApiKey.value.trim();
      if (!key) { setApiKeyError('Paste an API key first, or use Remove to delete the saved key.'); return; }
      if (/\s/.test(key) || key.length < 20) { setApiKeyError('This does not look like a valid API key (no spaces, at least 20 characters).'); return; }
      setApiKeyError('');
      await window.electronAPI.saveApiKey(key);
      inputGeminiApiKey.value = '';
      await refreshApiKeyPlaceholder();
      showToast('API key saved');
    });
  }

  if (btnClearApiKey) {
    btnClearApiKey.addEventListener('click', async () => {
      setApiKeyError('');
      await window.electronAPI.saveApiKey('');
      if (inputGeminiApiKey) inputGeminiApiKey.value = '';
      await refreshApiKeyPlaceholder();
      const info = (window.electronAPI && window.electronAPI.getApiKeyInfo)
        ? await window.electronAPI.getApiKeyInfo()
        : {};
      showToast(info.hasBuiltinKey ? 'Custom key removed (using built-in key)' : 'Saved API key removed');
    });
  }

  // Files & workspaces: workspace folder
  async function refreshWorkspaceChip() {
    const chip = document.getElementById('workspace-path-chip');
    const resetBtn = document.getElementById('btn-reset-folder');
    if (!chip) return;
    try {
      const ws = await window.electronAPI.getWorkspace();
      chip.textContent = ws.path + (ws.isDefault ? '  (default)' : '');
      if (resetBtn) resetBtn.disabled = !!ws.isDefault;
    } catch (e) {
      chip.textContent = 'Unavailable';
    }
  }

  const btnChooseFolder = document.getElementById('btn-change-folder');
  if (btnChooseFolder) {
    btnChooseFolder.addEventListener('click', async () => {
      const res = await window.electronAPI.chooseWorkspace();
      if (!res.canceled) showToast('Workspace folder updated');
      refreshWorkspaceChip();
    });
  }

  const btnResetFolder = document.getElementById('btn-reset-folder');
  if (btnResetFolder) {
    btnResetFolder.addEventListener('click', async () => {
      await window.electronAPI.resetWorkspace();
      showToast('Workspace folder reset to default');
      refreshWorkspaceChip();
    });
  }

  // Tools & integrations: summary of what is saved locally
  function refreshToolsSummary() {
    const el = document.getElementById('tools-registered-summary');
    if (!el) return;
    const readCount = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]').length; } catch (e) { return 0; } };
    const plugins = getCustomPlugins().filter((p) => p.type !== 'mcp').length;
    el.textContent = `${plugins} custom plugin${plugins === 1 ? '' : 's'}, ${readCount('tactical_mcp_servers')} MCP server${readCount('tactical_mcp_servers') === 1 ? '' : 's'}, ${readCount('tactical_marketplaces')} marketplace${readCount('tactical_marketplaces') === 1 ? '' : 's'} saved.`;
  }

  const btnOpenPluginsPage = document.getElementById('btn-open-plugins-page');
  if (btnOpenPluginsPage) btnOpenPluginsPage.addEventListener('click', () => showDestinationView('plugins'));

  // Privacy & data
  async function refreshPrivacyInfo() {
    const count = getStoredSessions().length;
    const countEl = document.getElementById('privacy-chat-count');
    if (countEl) countEl.textContent = `${count} conversation${count === 1 ? '' : 's'}`;
    const pathEl = document.getElementById('privacy-config-path');
    if (pathEl) {
      try { pathEl.textContent = (await window.electronAPI.getAbout()).configPath; } catch (e) {}
    }
    refreshMicPermissionUI();
  }

  const btnExportChats = document.getElementById('btn-export-chats');
  if (btnExportChats) {
    btnExportChats.addEventListener('click', () => {
      const sessions = getStoredSessions();
      if (sessions.length === 0) { showToast('There are no conversations to export'); return; }
      const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tactical-studio-conversations.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function deleteAllConversations() {
    if (!window.confirm('Delete ALL saved conversations from this app? This cannot be undone.')) return;
    saveStoredSessions([]);
    try { localStorage.setItem('tactical_no_sample_sessions', '1'); } catch (e) {}
    startNewChat();
    renderAllSidebarSessions();
    updateUsageMetrics();
    refreshPrivacyInfo();
    showToast('All conversations deleted');
  }

  const btnDeleteAllChats = document.getElementById('btn-delete-all-chats');
  if (btnDeleteAllChats) btnDeleteAllChats.addEventListener('click', deleteAllConversations);

  // Microphone & Voice Dictation Permission Management in Settings
  const micPermBadge = document.getElementById('mic-perm-status-badge');
  const btnRequestMicPerm = document.getElementById('btn-request-mic-perm');
  const btnRevokeMicPerm = document.getElementById('btn-revoke-mic-perm');

  async function refreshMicPermissionUI() {
    if (!micPermBadge) return;
    try {
      const res = await window.electronAPI.getMicrophonePermission();
      const status = (res && res.status) ? res.status : 'prompt';
      if (status === 'granted') {
        micPermBadge.textContent = 'Authorized';
        micPermBadge.style.color = '#34d399';
        micPermBadge.style.background = 'rgba(52, 211, 153, 0.15)';
        micPermBadge.style.border = '1px solid rgba(52, 211, 153, 0.3)';
      } else if (status === 'denied') {
        micPermBadge.textContent = 'Denied';
        micPermBadge.style.color = '#f87171';
        micPermBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        micPermBadge.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      } else {
        micPermBadge.textContent = 'Not Requested';
        micPermBadge.style.color = '#a1a1aa';
        micPermBadge.style.background = 'rgba(255, 255, 255, 0.08)';
        micPermBadge.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      }
    } catch (e) {
      micPermBadge.textContent = 'Unknown';
    }
  }

  if (btnRequestMicPerm) {
    btnRequestMicPerm.addEventListener('click', async () => {
      const res = await window.electronAPI.requestMicrophonePermission();
      refreshMicPermissionUI();
      if (res && res.granted) {
        showToast('Microphone access granted!');
      } else {
        showToast('Microphone access was denied.');
      }
    });
  }

  if (btnRevokeMicPerm) {
    btnRevokeMicPerm.addEventListener('click', async () => {
      await window.electronAPI.setSettings({ microphonePermission: 'denied' });
      refreshMicPermissionUI();
      showToast('Microphone permission revoked.');
    });
  }

  // About & restore defaults
  async function refreshAboutInfo() {
    try {
      const about = await window.electronAPI.getAbout();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('about-version', about.version);
      set('about-electron', about.electron);
      set('about-platform', about.platform);
    } catch (e) {}
  }

  const btnRestoreDefaults = document.getElementById('btn-restore-defaults');
  if (btnRestoreDefaults) {
    btnRestoreDefaults.addEventListener('click', async () => {
      if (!window.confirm('Restore all settings to their defaults? Conversations, your API key and saved plugins are kept.')) return;
      settings = Object.assign({}, DEFAULT_SETTINGS);
      try { await window.electronAPI.resetSettings(); } catch (e) {}
      applySettings();
      syncSettingsControls();
      refreshWorkspaceChip();
      showToast('Settings restored to defaults');
    });
  }

  // Refresh pane-specific information whenever a settings page is shown
  function refreshSettingsPaneData(tabKey) {
    if (tabKey === 'files') refreshWorkspaceChip();
    else if (tabKey === 'tools') refreshToolsSummary();
    else if (tabKey === 'privacy') refreshPrivacyInfo();
    else if (tabKey === 'about') refreshAboutInfo();
    else if (tabKey === 'models') refreshApiKeyPlaceholder();
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --------------------------------------------------------------------------
  // Persistent Memory & Personalization Controls
  // --------------------------------------------------------------------------
  async function renderMemoryList() {
    if (!window.electronAPI || !window.electronAPI.getMemories) return;
    const container = document.getElementById('memory-items-container');
    const toggle = document.getElementById('set-persistentMemory');
    if (!container) return;

    try {
      const state = await window.electronAPI.getMemories();
      if (toggle) toggle.checked = !!state.enabled;

      container.innerHTML = '';
      if (!state.memories || state.memories.length === 0) {
        container.innerHTML = '<div style="color: var(--text-tertiary, #888); font-size: 12px; padding: 6px 0; font-style: italic;">No preferences saved yet. You can state preferences in chat (e.g. &quot;Remember that I prefer TypeScript&quot;) or add them manually above.</div>';
        return;
      }

      state.memories.forEach((m) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; font-size: 12px; gap: 8px;';
        
        const txt = document.createElement('span');
        txt.style.cssText = 'flex: 1; word-break: break-word;';
        txt.textContent = m.text;

        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'background: transparent; border: none; color: #ff6b6b; cursor: pointer; padding: 2px 6px; font-size: 12px; border-radius: 4px;';
        delBtn.textContent = '✕';
        delBtn.title = 'Delete memory';
        delBtn.addEventListener('click', async () => {
          await window.electronAPI.deleteMemory(m.id);
          renderMemoryList();
        });

        row.appendChild(txt);
        row.appendChild(delBtn);
        container.appendChild(row);
      });
    } catch (e) {
      console.warn('Could not load memories:', e);
    }
  }

  function initMemoryControls() {
    const toggle = document.getElementById('set-persistentMemory');
    const input = document.getElementById('input-new-memory');
    const addBtn = document.getElementById('btn-add-memory');
    const clearBtn = document.getElementById('btn-clear-memories');

    if (toggle) {
      toggle.addEventListener('change', async () => {
        if (window.electronAPI && window.electronAPI.toggleMemory) {
          await window.electronAPI.toggleMemory(toggle.checked);
        }
      });
    }

    if (addBtn && input) {
      const doAdd = async () => {
        const val = input.value.trim();
        if (!val || !window.electronAPI || !window.electronAPI.addMemory) return;
        const res = await window.electronAPI.addMemory(val, 'preference');
        if (res.success) {
          input.value = '';
          renderMemoryList();
        } else if (res.error) {
          alert(res.error);
        }
      };
      addBtn.addEventListener('click', doAdd);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doAdd();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all saved memories and preferences?')) {
          if (window.electronAPI && window.electronAPI.clearMemories) {
            await window.electronAPI.clearMemories();
            renderMemoryList();
          }
        }
      });
    }

    if (window.electronAPI && window.electronAPI.onMemoryUpdated) {
      window.electronAPI.onMemoryUpdated(() => {
        renderMemoryList();
      });
    }

    renderMemoryList();
  }

  // --------------------------------------------------------------------------
  // Usage Tracking & Real-Time Balance Decrement
  // --------------------------------------------------------------------------
  let cachedUsage = { used: 0, limit: 150, remaining: 150, percentRemaining: 100, resetDate: 'Nov 19' };

  async function updateUsageDisplay(usageData) {
    if (usageData && typeof usageData === 'object') {
      cachedUsage = Object.assign({}, cachedUsage, usageData);
    } else if (window.electronAPI && typeof window.electronAPI.getUsage === 'function') {
      try {
        const u = await window.electronAPI.getUsage();
        if (u) cachedUsage = Object.assign({}, cachedUsage, u);
      } catch (e) {}
    }

    const limit = typeof cachedUsage.limit === 'number' ? cachedUsage.limit : 150;
    const used = typeof cachedUsage.used === 'number' ? cachedUsage.used : 0;
    const remaining = typeof cachedUsage.remaining === 'number' ? cachedUsage.remaining : Math.max(0, limit - used);
    const percentRemaining = typeof cachedUsage.percentRemaining === 'number' ? cachedUsage.percentRemaining : Math.max(0, Math.round((remaining / limit) * 100));
    const resetDate = cachedUsage.resetDate || 'Nov 19';

    // 1. Popup accordion elements
    const metaEl = document.getElementById('usage-sub-meta-text');
    if (metaEl) {
      metaEl.innerHTML = `${percentRemaining}% &nbsp; ${resetDate}`;
    }
    const fillEl = document.getElementById('usage-mini-fill-bar');
    if (fillEl) {
      fillEl.style.width = `${percentRemaining}%`;
    }

    // 2. Settings allowance element
    const allowEl = document.getElementById('settings-usage-allowance-text');
    if (allowEl) {
      allowEl.textContent = `${remaining} / ${limit} remaining (${percentRemaining}%)`;
    }
  }

  function decrementUsageOptimistic() {
    const limit = cachedUsage.limit || 150;
    const nextUsed = Math.min(limit, (cachedUsage.used || 0) + 1);
    const nextRemaining = Math.max(0, limit - nextUsed);
    const nextPercent = Math.max(0, Math.round((nextRemaining / limit) * 100));
    updateUsageDisplay({
      used: nextUsed,
      remaining: nextRemaining,
      percentRemaining: nextPercent
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onUsageUpdated === 'function') {
    window.electronAPI.onUsageUpdated((usage) => {
      updateUsageDisplay(usage);
    });
  }

  // --------------------------------------------------------------------------
  // Floating Computer-Use Banner & Purple Cursor Halo Subsystem
  // --------------------------------------------------------------------------
  const computerBanner = document.getElementById('computer-active-banner');
  const computerHalo = document.getElementById('computer-cursor-halo');
  const computerEdgeGlow = document.getElementById('computer-screen-edge-glow');
  const btnCancelComputer = document.getElementById('btn-cancel-computer-use');
  let isComputerControlActive = false;

  function setComputerUseActive(active, details = '') {
    isComputerControlActive = !!active;
    if (active) {
      if (computerBanner) computerBanner.classList.remove('hidden');
      if (computerHalo) computerHalo.classList.remove('hidden');
      if (computerEdgeGlow) computerEdgeGlow.classList.remove('hidden');
    } else {
      if (computerBanner) computerBanner.classList.add('hidden');
      if (computerHalo) computerHalo.classList.add('hidden');
      if (computerEdgeGlow) computerEdgeGlow.classList.add('hidden');
    }
  }

  // Smooth mouse movement tracking for halo (uses requestAnimationFrame for lightweight performance)
  let haloX = -100;
  let haloY = -100;
  let haloRaf = null;

  window.addEventListener('mousemove', (e) => {
    if (!isComputerControlActive || !computerHalo) return;
    haloX = e.clientX;
    haloY = e.clientY;
    if (!haloRaf) {
      haloRaf = requestAnimationFrame(() => {
        if (computerHalo) {
          computerHalo.style.transform = `translate3d(${haloX}px, ${haloY}px, 0)`;
        }
        haloRaf = null;
      });
    }
  }, { passive: true });

  // Escape key or Cancel button immediately stops computer control
  function triggerComputerCancel() {
    if (isComputerControlActive) {
      setComputerUseActive(false);
      if (window.electronAPI && typeof window.electronAPI.cancelComputerUse === 'function') {
        window.electronAPI.cancelComputerUse();
      }
      showToast('Computer control stopped');
    }
  }

  if (btnCancelComputer) {
    btnCancelComputer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerComputerCancel();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isComputerControlActive) {
      e.preventDefault();
      triggerComputerCancel();
    }
  });

  if (window.electronAPI && typeof window.electronAPI.onComputerActivityStarted === 'function') {
    window.electronAPI.onComputerActivityStarted((info) => {
      setComputerUseActive(true, info?.details || '');
    });
  }

  if (window.electronAPI && typeof window.electronAPI.onComputerActivityEnded === 'function') {
    window.electronAPI.onComputerActivityEnded(() => {
      setComputerUseActive(false);
    });
  }

  // --------------------------------------------------------------------------
  // Interactive Top System Menubar (File, Edit, View, Help)
  // --------------------------------------------------------------------------
  function initTopMenubar() {
    const dropdownWrappers = document.querySelectorAll('.menu-dropdown-wrapper');
    let openMenuId = null;

    function closeAllMenus() {
      document.querySelectorAll('.top-menu-popup').forEach(p => p.classList.add('hidden'));
      document.querySelectorAll('.top-menu-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-expanded', 'false');
      });
      openMenuId = null;
    }

    dropdownWrappers.forEach((wrap) => {
      const btn = wrap.querySelector('.top-menu-btn');
      const popup = wrap.querySelector('.top-menu-popup');
      if (!btn || !popup) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openMenuId === wrap.id) {
          closeAllMenus();
        } else {
          closeAllMenus();
          popup.classList.remove('hidden');
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
          openMenuId = wrap.id;
        }
      });

      btn.addEventListener('mouseenter', () => {
        if (openMenuId && openMenuId !== wrap.id) {
          closeAllMenus();
          popup.classList.remove('hidden');
          btn.classList.add('active');
          btn.setAttribute('aria-expanded', 'true');
          openMenuId = wrap.id;
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.system-menu')) {
        closeAllMenus();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openMenuId) {
        closeAllMenus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startNewChat();
      }
    });

    // Menubar Action Dispatcher
    document.querySelectorAll('.menu-action-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-menu-action');
        closeAllMenus();

        switch (action) {
          case 'new-chat':
            startNewChat();
            break;
          case 'open-folder':
            if (window.SparxIDE) {
              const openBtn = document.getElementById('btn-explorer-open-folder') || document.getElementById('btn-open-workspace');
              if (openBtn) openBtn.click();
            }
            break;
          case 'save-file':
            if (window.SparxIDE && typeof window.SparxIDE.saveActiveTab === 'function') {
              window.SparxIDE.saveActiveTab();
            }
            break;
          case 'settings':
            openSettingsView();
            break;
          case 'exit':
            if (window.electronAPI && typeof window.electronAPI.close === 'function') {
              window.electronAPI.close();
            }
            break;
          case 'undo':
            document.execCommand('undo');
            break;
          case 'redo':
            document.execCommand('redo');
            break;
          case 'cut':
            document.execCommand('cut');
            break;
          case 'copy':
            document.execCommand('copy');
            break;
          case 'paste':
            navigator.clipboard.readText().then(text => {
              if (text && chatTextarea) {
                chatTextarea.focus();
                document.execCommand('insertText', false, text);
              }
            }).catch(() => {
              document.execCommand('paste');
            });
            break;
          case 'select-all':
            if (chatTextarea && document.activeElement === chatTextarea) {
              chatTextarea.select();
            } else {
              document.execCommand('selectAll');
            }
            break;
          case 'toggle-sidebar':
            const btnSidebar = document.getElementById('btn-toggle-sidebar');
            if (btnSidebar) btnSidebar.click();
            break;
          case 'zoom-in':
            if (window.electronAPI && typeof window.electronAPI.getZoomLevel === 'function') {
              window.electronAPI.setZoomLevel(window.electronAPI.getZoomLevel() + 0.5);
            }
            break;
          case 'zoom-out':
            if (window.electronAPI && typeof window.electronAPI.getZoomLevel === 'function') {
              window.electronAPI.setZoomLevel(window.electronAPI.getZoomLevel() - 0.5);
            }
            break;
          case 'zoom-reset':
            if (window.electronAPI && typeof window.electronAPI.setZoomLevel === 'function') {
              window.electronAPI.setZoomLevel(0);
            }
            break;
          case 'shortcuts':
            showToast('Keyboard Shortcuts: Ctrl+N New Chat · Ctrl+P Quick Open · Ctrl+` Terminal · Ctrl+Shift+C Return to Chat · Esc Stop');
            break;
          case 'guide':
            showToast('Sparx Workstation: Autonomous AI coding companion and desktop automation IDE.');
            break;
          case 'about':
            showToast('Sparx AI Workstation v1.0.0 · Obsidian-Violet Architecture · Real GUI Automation Engine');
            break;
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // In-App Auto-Updater & Publishing System (Navigation Rail Action)
  // --------------------------------------------------------------------------
  function initInAppUpdater() {
    const btnRailUpdate = document.getElementById('btn-rail-update');
    const updateBadgeDot = document.getElementById('update-badge-dot');
    const railUpdateTooltip = document.getElementById('rail-update-tooltip');
    const modalAppUpdate = document.getElementById('modal-app-update');
    if (!btnRailUpdate || !modalAppUpdate) return;

    const iconDefault = btnRailUpdate.querySelector('.update-icon-default');
    const iconSpinning = btnRailUpdate.querySelector('.update-icon-spinning');
    const updateProgressBar = document.getElementById('update-progress-bar');
    const updateProgressLabel = document.getElementById('update-progress-label');

    let isUpdating = false;

    function setSpinning(spinning) {
      if (iconDefault) iconDefault.classList.toggle('hidden', spinning);
      if (iconSpinning) iconSpinning.classList.toggle('hidden', !spinning);
    }

    async function checkUpdates(silent = false) {
      if (!window.electronAPI || typeof window.electronAPI.checkForUpdates !== 'function') return;
      setSpinning(true);
      try {
        const res = await window.electronAPI.checkForUpdates();
        if (res && res.updateAvailable) {
          if (updateBadgeDot) updateBadgeDot.classList.remove('hidden');
          if (railUpdateTooltip) railUpdateTooltip.textContent = `Install Update (v${res.latestVersion})`;
        } else {
          if (updateBadgeDot) updateBadgeDot.classList.add('hidden');
          if (railUpdateTooltip) railUpdateTooltip.textContent = `Sparx Up to Date`;
        }
        return res;
      } catch (err) {
        if (!silent) showToast(`Update check error: ${err.message}`);
      } finally {
        setSpinning(false);
      }
    }

    async function startAutoUpdate() {
      if (isUpdating) return;
      isUpdating = true;

      // 1-to-1 Replica Modal: open immediately
      openTacticalModal(modalAppUpdate);

      if (updateProgressBar) updateProgressBar.style.width = '20%';
      if (updateProgressLabel) updateProgressLabel.textContent = 'Preparing...';

      // Check for available updates
      let check = null;
      try {
        check = await window.electronAPI.checkForUpdates();
      } catch (e) {}

      if (!check || !check.updateAvailable) {
        if (updateProgressLabel) updateProgressLabel.textContent = 'Up to date';
        if (updateProgressBar) updateProgressBar.style.width = '100%';
        setTimeout(() => {
          closeAllModals();
          isUpdating = false;
        }, 1200);
        return;
      }

      // Small pause to show the native "Preparing..." phase
      await new Promise((r) => setTimeout(r, 650));

      if (updateProgressBar) updateProgressBar.style.width = '35%';
      if (updateProgressLabel) updateProgressLabel.textContent = 'Downloading...';

      try {
        await window.electronAPI.downloadUpdate();

        // Download verified and staged, show installing state
        if (updateProgressBar) updateProgressBar.style.width = '96%';
        if (updateProgressLabel) updateProgressLabel.textContent = 'Installing...';

        await new Promise((r) => setTimeout(r, 800));

        // Relaunching phase
        if (updateProgressBar) updateProgressBar.style.width = '100%';
        if (updateProgressLabel) updateProgressLabel.textContent = 'Restarting...';

        await new Promise((r) => setTimeout(r, 450));
        await window.electronAPI.applyUpdate();
      } catch (err) {
        console.error('[Updater] Auto-update failed:', err);
        if (updateProgressLabel) updateProgressLabel.textContent = 'Failed';
        showToast(`Update error: ${err.message}`);
        setTimeout(() => {
          closeAllModals();
          isUpdating = false;
        }, 2500);
      }
    }

    // Direct one-click auto update trigger
    btnRailUpdate.addEventListener('click', (e) => {
      e.stopPropagation();
      startAutoUpdate();
    });

    // Progress events from backend
    if (window.electronAPI && typeof window.electronAPI.onUpdateProgress === 'function') {
      window.electronAPI.onUpdateProgress((p) => {
        if (updateProgressBar) {
          const clamped = Math.max(20, Math.min(94, p.percent));
          updateProgressBar.style.width = `${clamped}%`;
        }
        if (updateProgressLabel) {
          if (p.percent < 85) {
            updateProgressLabel.textContent = 'Downloading...';
          } else {
            updateProgressLabel.textContent = 'Installing...';
          }
        }
      });
    }

    // Status events from startup
    if (window.electronAPI && typeof window.electronAPI.onUpdateStatus === 'function') {
      window.electronAPI.onUpdateStatus((status) => {
        if (status && status.updateAvailable) {
          if (updateBadgeDot) updateBadgeDot.classList.remove('hidden');
          if (railUpdateTooltip) railUpdateTooltip.textContent = `Install Update (v${status.latestVersion})`;
        }
      });
    }

    // Startup check after 2 seconds
    setTimeout(() => checkUpdates(true), 2000);
  }

  // --------------------------------------------------------------------------
  // 10. Bootstrap
  // --------------------------------------------------------------------------
  await initSettings();
  initMemoryControls();
  initTopMenubar();
  initInAppUpdater();
  updateHeroGreeting();
  await initChatSessionsPersistence();
  localStorage.setItem('tactical_no_sample_sessions', '1');
  renderAllSidebarSessions();
  // Opening sparx newly always directs directly to a new chat, not the last opened chat
  startNewChat();
  renderPersonalPlugins();
  syncNavButtons();
  updateUsageDisplay();
  if (chatTextarea) chatTextarea.focus();
});