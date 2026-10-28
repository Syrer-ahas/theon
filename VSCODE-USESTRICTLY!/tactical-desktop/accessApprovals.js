// ============================================================================
// Tactical IDE — Access & Approvals Governance Engine
// 3 Modes: 'ask' (default) | 'auto' | 'full' with interactive confirmation
// ============================================================================

const { killRunningProcess } = require('./terminalService.js');
const { stopComputerSession, initializeDesktopAccess } = require('./computerControlService.js');

const initDesktop = initializeDesktopAccess();
const desktopAvailable = !!initDesktop.available;

// Current session access state (defaults to 'auto': only asks when mandatory / high-risk)
// Desktop access is enabled by default when the host platform supports it
let currentAccessState = {
  mode: 'auto', // 'auto' (default: ask only when mandatory) | 'ask' | 'full'
  terminalEnabled: true,
  computerEnabled: desktopAvailable,
  interactiveControlEnabled: desktopAvailable,
  desktopAccessSupported: desktopAvailable,
  desktopAccessInitialized: desktopAvailable,
  desktopAccessLimitation: initDesktop.error || null
};

const pendingApprovals = new Map();
const deniedActionSignatures = new Set();
let mainWindowRef = null;

function setMainWindowRef(win) {
  mainWindowRef = win;
}

function getAccessSettings() {
  return Object.assign({}, currentAccessState);
}

function setAccessMode(newMode) {
  if (['ask', 'auto', 'full'].includes(newMode)) {
    currentAccessState.mode = newMode;
    notifyAccessStatus();
    return true;
  }
  return false;
}

function toggleCapability(capability, enabled) {
  if (capability === 'terminal') {
    currentAccessState.terminalEnabled = !!enabled;
    if (!enabled) killRunningProcess();
  } else if (capability === 'computer') {
    currentAccessState.computerEnabled = !!enabled;
    if (!enabled) stopComputerSession();
  }
  notifyAccessStatus();
  return Object.assign({}, currentAccessState);
}

function revokeAllAccess() {
  currentAccessState.terminalEnabled = false;
  currentAccessState.computerEnabled = false;
  currentAccessState.mode = 'auto'; // Reset to default 'auto' (ask only when mandatory)
  
  // Terminate any active sessions and child processes immediately
  killRunningProcess();
  stopComputerSession();

  // Cancel any pending approvals
  pendingApprovals.forEach(({ resolve }) => {
    resolve({ approved: false, reason: 'Access revoked by operator.' });
  });
  pendingApprovals.clear();
  deniedActionSignatures.clear();

  notifyAccessStatus();
  return Object.assign({}, currentAccessState);
}

function notifyAccessStatus() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('access:status-changed', getAccessSettings());
  }
}

/**
 * Evaluates whether an action can execute automatically or requires explicit in-chat approval.
 * @param {Object} action - Action descriptor
 * @param {'terminal' | 'computer'} action.capability
 * @param {'low' | 'medium' | 'high'} action.riskLevel
 * @param {string} action.signature - Unique string identifying the exact action
 * @param {string} action.title - User-friendly title
 * @param {string} action.details - Context / command
 * @returns {Promise<{ allowed: boolean, reason?: string, deniedByUser?: boolean }>}
 */
async function authorizeAction(action) {
  const { capability, riskLevel = 'medium', signature = '' } = action;

  // 1. Capability check
  if (capability === 'terminal' && !currentAccessState.terminalEnabled) {
    return {
      allowed: false,
      reason: 'Terminal Access is disabled. Enable Terminal Access in the Access & Approvals panel.'
    };
  }
  if (capability === 'computer') {
    if (!currentAccessState.desktopAccessSupported) {
      return {
        allowed: false,
        reason: currentAccessState.desktopAccessLimitation || 'Desktop access is not supported on this platform.'
      };
    }
    const isInteractiveAction = action.interactive === true ||
      (signature && (signature.includes('click') || signature.includes('type') || signature.includes('mouse') || signature.includes('scroll')));
    if (isInteractiveAction && currentAccessState.interactiveControlEnabled === false) {
      return {
        allowed: false,
        reason: 'Interactive desktop control (mouse & keyboard) is disabled in Desktop Control settings.'
      };
    }
  }

  // 2. Denied history check: don't repeatedly ask for the exact same denied action
  if (signature && deniedActionSignatures.has(signature)) {
    return {
      allowed: false,
      deniedByUser: true,
      reason: 'Action was previously denied by operator in this session.'
    };
  }

  // 3. Determine if confirmation is needed based on mode and risk
  let requiresConfirmation = false;
  if (currentAccessState.mode === 'ask') {
    // Mode 1: Ask for approval — confirms every action
    requiresConfirmation = true;
  } else if (currentAccessState.mode === 'auto') {
    // Mode 2: Approve for me (Default) — only asks when mandatory or high-risk
    requiresConfirmation = (riskLevel === 'high' || action.mandatory === true);
  } else if (currentAccessState.mode === 'full') {
    // Mode 3: Full access — only destructive or administrative high-risk actions confirm
    requiresConfirmation = (riskLevel === 'high' || action.mandatory === true);
  }

  if (!requiresConfirmation) {
    return { allowed: true };
  }

  // 4. Request user confirmation via interactive in-chat card
  return new Promise((resolve) => {
    const id = 'appr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    pendingApprovals.set(id, { action, resolve });

    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('access:request-approval', {
        id,
        capability: action.capability,
        title: action.title || 'Action Confirmation Required',
        details: action.details || '',
        riskLevel: action.riskLevel || 'medium',
        mode: currentAccessState.mode
      });
    } else {
      resolve({ allowed: false, reason: 'UI disconnected' });
    }
  });
}

/**
 * Called when the user clicks 'Approve once' or 'Deny' on the in-chat approval card.
 */
function resolveApproval(id, approved) {
  if (!pendingApprovals.has(id)) return false;
  const { action, resolve } = pendingApprovals.get(id);
  pendingApprovals.delete(id);

  if (!approved) {
    if (action.signature) {
      deniedActionSignatures.add(action.signature);
    }
    resolve({ allowed: false, deniedByUser: true, reason: 'Operator denied this action.' });
  } else {
    resolve({ allowed: true });
  }
  return true;
}

module.exports = {
  setMainWindowRef,
  getAccessSettings,
  setAccessMode,
  toggleCapability,
  revokeAllAccess,
  authorizeAction,
  resolveApproval
};
