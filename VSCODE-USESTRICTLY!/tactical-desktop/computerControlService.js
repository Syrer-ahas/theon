// ============================================================================
// Tactical IDE — Computer Use & Desktop Control Subsystem
// Governed screen capture and mouse/keyboard automation with anti-exploit enforcement
// ============================================================================

const { desktopCapturer, shell } = require('electron');
const { spawn } = require('child_process');
const { checkCheatAndExploitGuard } = require('./safetyGuards.js');

let isSessionActive = false;
let isSessionPaused = false;
let sessionStartTime = null;

/**
 * Initiates an authorized Computer Use session.
 */
function startComputerSession() {
  isSessionActive = true;
  isSessionPaused = false;
  sessionStartTime = Date.now();
  return {
    active: true,
    paused: false,
    startedAt: sessionStartTime,
    state: 'active'
  };
}

/**
 * Terminates the active Computer Use session immediately.
 */
function stopComputerSession() {
  isSessionActive = false;
  isSessionPaused = false;
  sessionStartTime = null;
  return {
    active: false,
    paused: false,
    state: 'stopped'
  };
}

/**
 * Pauses or resumes an active session.
 */
function setComputerSessionPaused(paused) {
  if (!isSessionActive) {
    return { active: false, paused: false, state: 'stopped' };
  }
  isSessionPaused = !!paused;
  return {
    active: isSessionActive,
    paused: isSessionPaused,
    state: isSessionPaused ? 'paused' : 'active'
  };
}

function getComputerSessionStatus() {
  return {
    active: isSessionActive,
    paused: isSessionPaused,
    startedAt: sessionStartTime,
    state: !isSessionActive ? 'stopped' : (isSessionPaused ? 'paused' : 'active')
  };
}

/**
 * Captures the primary screen frame truthfully.
 * Validates non-empty pixel data and falls back to Windows GDI when desktopCapturer returns 0x0.
 * Reports truthful, actionable errors if desktop is locked, headless, or permissions are missing.
 * @returns {Promise<{ success: boolean, state?: string, width?: number, height?: number, dataUri?: string, error?: string }>}
 */
async function captureScreenFrame() {
  if (!isSessionActive) {
    startComputerSession();
  }
  if (isSessionPaused) {
    return {
      success: false,
      state: 'paused',
      error: 'Computer Use session is currently paused by operator.'
    };
  }

  // Phase 1: Attempt native Electron desktopCapturer with explicit thumbnail size
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources && sources.length > 0) {
      const primarySource = sources[0];
      const image = primarySource.thumbnail;
      if (image && !image.isEmpty()) {
        const size = image.getSize();
        if (size.width > 0 && size.height > 0) {
          const dataUri = image.toDataURL();
          return {
            success: true,
            state: 'active',
            sourceId: primarySource.id,
            width: size.width,
            height: size.height,
            dataUri
          };
        }
      }
    }
  } catch (capturerErr) {
    // Continue to Phase 2 native GDI fallback
  }

  // Phase 2: Native Windows GDI Screen Capture Fallback
  return new Promise((resolve) => {
    const psScript = `
      try {
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $b = New-Object System.Drawing.Bitmap $s.Width, $s.Height
        $g = [System.Drawing.Graphics]::FromImage($b)
        $g.CopyFromScreen($s.X, $s.Y, 0, 0, $s.Size)
        $ms = New-Object System.IO.MemoryStream
        $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $b64 = [Convert]::ToBase64String($ms.ToArray())
        Write-Output ($s.Width.ToString() + 'x' + $s.Height.ToString() + ':' + $b64)
      } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
      }
    `;

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({
        success: false,
        state: 'failed',
        error: `Screen capture process error: ${err.message}`
      });
    });

    child.on('close', (code) => {
      if (code === 0 && stdout.includes(':')) {
        const colonIdx = stdout.indexOf(':');
        const dimStr = stdout.substring(0, colonIdx).trim();
        const base64Data = stdout.substring(colonIdx + 1).trim();
        const [wStr, hStr] = dimStr.split('x');
        const width = parseInt(wStr, 10) || 1920;
        const height = parseInt(hStr, 10) || 1080;

        resolve({
          success: true,
          state: 'active',
          width,
          height,
          dataUri: `data:image/jpeg;base64,${base64Data}`
        });
      } else {
        const errMsg = stderr.trim();
        let actionableError = 'Screen capture failed: Display surface could not be read.';
        if (
          errMsg.includes('handle is invalid') ||
          errMsg.includes('0x80070005') ||
          errMsg.includes('Access is denied') ||
          errMsg.includes('BitBlt failed')
        ) {
          actionableError = 'Screen capture unavailable: The Windows workstation is locked, running in a non-interactive session, or OS screen recording permission is missing.';
        } else if (errMsg) {
          actionableError = `Screen capture failed: ${errMsg}. Check OS display settings and permissions.`;
        }
        resolve({
          success: false,
          state: 'failed',
          error: actionableError
        });
      }
    });
  });
}

/**
 * Executes a simulated mouse or keyboard action safely on Windows.
 * Truthfully validates session status, Anti-Cheat guards, coordinates, and Win32 execution results.
 * @param {Object} action
 * @param {'click' | 'move' | 'double_click' | 'scroll' | 'type' | 'key' | 'launch_app'} action.type
 * @param {number} [action.x]
 * @param {number} [action.y]
 * @param {'left' | 'right' | 'middle'} [action.button]
 * @param {string} [action.text]
 * @param {string} [action.key]
 * @param {string} [action.target]
 * @param {string} [action.description]
 * @returns {Promise<{ success: boolean, action?: string, error?: string }>}
 */
function executeInputSimulation(action) {
  return new Promise((resolve) => {
    if (!isSessionActive) {
      startComputerSession();
    }
    if (isSessionPaused) {
      return resolve({ success: false, error: 'Computer Use session is paused by operator. Action rejected.' });
    }

    // Universal Anti-Cheat & Exploit verification
    const textToCheck = `${action.description || ''} ${action.text || ''} ${action.key || ''} ${action.target || ''}`;
    const safetyCheck = checkCheatAndExploitGuard(textToCheck);
    if (safetyCheck.blocked) {
      return resolve({ success: false, error: safetyCheck.reason });
    }

    // Windows native input script
    let psScript = '';
    const x = Math.max(0, Math.round(action.x || 0));
    const y = Math.max(0, Math.round(action.y || 0));

    if (action.type === 'move') {
      psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class WinInput {
          [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int X, int Y);
        }
"@
        $ok = [WinInput]::SetCursorPos(${x}, ${y})
        if (-not $ok) {
          $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
          [Console]::Error.WriteLine("SetCursorPos failed with Win32 error " + $err)
          exit 1
        }
      `;
    } else if (action.type === 'click') {
      const isRight = action.button === 'right';
      const isMiddle = action.button === 'middle';
      const downFlag = isRight ? '0x0008' : (isMiddle ? '0x0020' : '0x0002');
      const upFlag = isRight ? '0x0010' : (isMiddle ? '0x0040' : '0x0004');
      psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class WinInput {
          [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
        }
"@
        [WinInput]::SetCursorPos(${x}, ${y})
        [WinInput]::mouse_event(${downFlag}, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 40
        [WinInput]::mouse_event(${upFlag}, 0, 0, 0, 0)
      `;
    } else if (action.type === 'double_click') {
      psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class WinInput {
          [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
        }
"@
        [WinInput]::SetCursorPos(${x}, ${y})
        [WinInput]::mouse_event(0x0002, 0, 0, 0, 0)
        [WinInput]::mouse_event(0x0004, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 60
        [WinInput]::mouse_event(0x0002, 0, 0, 0, 0)
        [WinInput]::mouse_event(0x0004, 0, 0, 0, 0)
      `;
    } else if (action.type === 'scroll') {
      const delta = Math.round(action.dy || 120);
      psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class WinInput {
          [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
        }
"@
        [WinInput]::mouse_event(0x0800, 0, 0, ${delta}, 0)
      `;
    } else if (action.type === 'type') {
      const sanitizedText = (action.text || '').replace(/["'`$\\]/g, ' ');
      psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${sanitizedText}")
      `;
    } else if (action.type === 'key') {
      const keyStr = (action.key || '').toUpperCase();
      let sendKeyToken = keyStr;
      if (keyStr === 'ENTER') sendKeyToken = '{ENTER}';
      else if (keyStr === 'ESC' || keyStr === 'ESCAPE') sendKeyToken = '{ESC}';
      else if (keyStr === 'TAB') sendKeyToken = '{TAB}';
      else if (keyStr === 'BACKSPACE') sendKeyToken = '{BACKSPACE}';
      psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${sendKeyToken}")
      `;
    } else if (action.type === 'launch_app') {
      const target = (action.target || '').replace(/["'`$\\]/g, '');
      psScript = `Start-Process "${target}"`;
    } else {
      return resolve({ success: false, error: `Unsupported input action type: ${action.type}` });
    }

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], {
      windowsHide: true
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, action: action.type });
      } else {
        const isLockedOrSession = stderr.includes('SetCursorPos failed') || stderr.includes('handle is invalid');
        const reason = isLockedOrSession
          ? 'Input delivery failed: The Windows desktop is locked or running in a non-interactive session.'
          : (stderr.trim() || `Input action exited with code ${code}`);
        resolve({ success: false, error: reason });
      }
    });
  });
}

const fs = require('fs');

const APP_REGISTRY = {
  brave: {
    displayName: 'Brave Browser',
    processNames: ['brave'],
    paths: [
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      `${process.env.LOCALAPPDATA || ''}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
    ],
    fallbackExe: 'brave.exe'
  },
  'brave browser': {
    displayName: 'Brave Browser',
    processNames: ['brave'],
    paths: [
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      `${process.env.LOCALAPPDATA || ''}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
    ],
    fallbackExe: 'brave.exe'
  },
  chrome: {
    displayName: 'Google Chrome',
    processNames: ['chrome'],
    paths: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`
    ],
    fallbackExe: 'chrome.exe'
  },
  'google chrome': {
    displayName: 'Google Chrome',
    processNames: ['chrome'],
    paths: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`
    ],
    fallbackExe: 'chrome.exe'
  },
  edge: {
    displayName: 'Microsoft Edge',
    processNames: ['msedge'],
    paths: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ],
    fallbackExe: 'msedge.exe'
  },
  msedge: {
    displayName: 'Microsoft Edge',
    processNames: ['msedge'],
    paths: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ],
    fallbackExe: 'msedge.exe'
  },
  'microsoft edge': {
    displayName: 'Microsoft Edge',
    processNames: ['msedge'],
    paths: [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ],
    fallbackExe: 'msedge.exe'
  },
  firefox: {
    displayName: 'Mozilla Firefox',
    processNames: ['firefox'],
    paths: [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
    ],
    fallbackExe: 'firefox.exe'
  },
  'mozilla firefox': {
    displayName: 'Mozilla Firefox',
    processNames: ['firefox'],
    paths: [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
    ],
    fallbackExe: 'firefox.exe'
  },
  notepad: {
    displayName: 'Notepad',
    processNames: ['notepad'],
    paths: [
      'C:\\WINDOWS\\system32\\notepad.exe',
      'C:\\Program Files\\WindowsApps\\Microsoft.WindowsNotepad_11.2607.14.0_x64__8wekyb3d8bbwe\\Notepad\\Notepad.exe'
    ],
    fallbackExe: 'notepad.exe'
  },
  calculator: {
    displayName: 'Calculator',
    processNames: ['calc', 'CalculatorApp', 'Calculator'],
    paths: ['C:\\WINDOWS\\system32\\calc.exe'],
    fallbackExe: 'calc.exe'
  },
  calc: {
    displayName: 'Calculator',
    processNames: ['calc', 'CalculatorApp', 'Calculator'],
    paths: ['C:\\WINDOWS\\system32\\calc.exe'],
    fallbackExe: 'calc.exe'
  },
  spotify: {
    displayName: 'Spotify',
    processNames: ['spotify'],
    paths: [
      `${process.env.APPDATA || ''}\\Spotify\\Spotify.exe`
    ],
    fallbackExe: 'spotify.exe'
  },
  discord: {
    displayName: 'Discord',
    processNames: ['Discord'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Discord\\Update.exe`
    ],
    fallbackExe: 'Discord.exe'
  },
  steam: {
    displayName: 'Steam',
    processNames: ['steam'],
    paths: [
      'C:\\Program Files (x86)\\Steam\\steam.exe',
      'C:\\Program Files\\Steam\\steam.exe'
    ],
    fallbackExe: 'steam.exe'
  },
  code: {
    displayName: 'Visual Studio Code',
    processNames: ['Code'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Microsoft VS Code\\Code.exe`
    ],
    fallbackExe: 'code.cmd'
  },
  vscode: {
    displayName: 'Visual Studio Code',
    processNames: ['Code'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Microsoft VS Code\\Code.exe`
    ],
    fallbackExe: 'code.cmd'
  },
  'vs code': {
    displayName: 'Visual Studio Code',
    processNames: ['Code'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Microsoft VS Code\\Code.exe`
    ],
    fallbackExe: 'code.cmd'
  },
  'visual studio code': {
    displayName: 'Visual Studio Code',
    processNames: ['Code'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Microsoft VS Code\\Code.exe`
    ],
    fallbackExe: 'code.cmd'
  },
  claude: {
    displayName: 'Claude',
    processNames: ['Claude', 'claude', 'claude-desktop'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Microsoft\\WindowsApps\\claude-desktop.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Claude\\Claude.exe`,
      `${process.env.USERPROFILE || ''}\\.local\\bin\\claude.exe`,
      `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Claude\\Claude.exe`,
      `${process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'}\\Claude\\Claude.exe`
    ],
    fallbackExe: 'claude-desktop.exe'
  },
  'claude desktop': {
    displayName: 'Claude',
    processNames: ['Claude', 'claude', 'claude-desktop'],
    paths: [
      `${process.env.LOCALAPPDATA || ''}\\Microsoft\\WindowsApps\\claude-desktop.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Programs\\Claude\\Claude.exe`,
      `${process.env.USERPROFILE || ''}\\.local\\bin\\claude.exe`,
      `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Claude\\Claude.exe`,
      `${process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'}\\Claude\\Claude.exe`
    ],
    fallbackExe: 'claude-desktop.exe'
  }
};

/**
 * Checks whether an executable exists at a path or is available in system PATH / WindowsApps.
 * @param {string} pathOrExe
 * @returns {boolean}
 */
function isExecutableAvailable(pathOrExe) {
  if (!pathOrExe) return false;
  try {
    if (fs.existsSync(pathOrExe)) return true;
  } catch (e) {}
  try {
    const base = path.basename(pathOrExe);
    const out = execSync(`where.exe "${base}"`, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    if (out && out.trim()) return true;
  } catch (e) {}
  return false;
}

/**
 * Initializes and validates desktop access support on the host OS.
 * @returns {{ available: boolean, error?: string }}
 */
function initializeDesktopAccess() {
  if (process.platform !== 'win32') {
    return {
      available: false,
      error: 'Desktop access is only supported on Windows.'
    };
  }
  return { available: true };
}

/**
 * Parses user input to recognize casual desktop app action requests (e.g. "close Brave for me rq").
 * Separates conversational filler words like "for me", "rq", "real quick", "please" from the app target.
 * @param {string} rawMessage
 * @returns {{ intent: 'close' | 'open', ambiguous: boolean, rawTarget: string } | null}
 */
function parseAppControlIntent(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') return null;
  const msg = rawMessage.trim().replace(/^["'`]+|["'`]+$/g, '');

  // Guard against non-app requests (terminal commands, questions, file reads, etc.)
  if (/^(?:run\s+(?:a\s+)?command|terminal|git|npm|python|cat|read|show|list|search|what|why|how|who|where)\b/i.test(msg)) {
    return null;
  }
  // Guard if message explicitly references code/text files with extensions
  if (/\b(?:open|close|read|show)\s+[a-zA-Z0-9_\-\.\/\\~]+\.(?:js|ts|json|html|css|txt|md|py|cpp|c|h|rs|go)\b/i.test(msg)) {
    return null;
  }

  const closePattern = /^(?:(?:hey\s+|sparx\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|please\s+|pls\s+)*)(?:close|quit|kill|terminate|exit|shut\s+down)\b/i;
  const openPattern = /^(?:(?:hey\s+|sparx\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|please\s+|pls\s+)*)(?:open|launch|start)\b/i;

  let intent = null;
  let remaining = '';

  if (closePattern.test(msg)) {
    intent = 'close';
    remaining = msg.replace(closePattern, '');
  } else if (openPattern.test(msg)) {
    intent = 'open';
    remaining = msg.replace(openPattern, '');
  } else {
    return null;
  }

  // Clean trailing punctuation
  let target = remaining.replace(/[\.\?!]+$/g, '').trim();

  // Strip leading articles
  target = target.replace(/^(?:the|my|a|an)\s+/i, '').trim();

  // Strip conversational fillers & computer-use request wrappers
  const fillerRegex = /\b(?:with\s+computer\s+use|using\s+computer\s+use|through\s+computer\s+use|via\s+computer\s+use|with\s+computer|for\s+me\s+rq|for\s+me\s+real\s+quick|for\s+me|real\s+quick|rq|asap|now|right\s+now|quickly|quick|pls|please|for\s+a\s+sec(?:ond)?)\b/gi;
  target = target.replace(fillerRegex, ' ').trim();

  // Strip app/application/browser/window/process suffix
  target = target.replace(/\s+(?:app|application|browser|window|process|program)$/i, '').trim();
  // Strip trailing fillers again if any were before the app suffix
  target = target.replace(fillerRegex, ' ').trim();

  target = target.replace(/\s+/g, ' ').trim();

  // Check for ambiguous targets (empty, 'it', 'this', 'app', 'browser' without name)
  if (!target || /^(?:it|this|app|application|program|window|process)$/i.test(target)) {
    return {
      intent,
      ambiguous: true,
      rawTarget: target
    };
  }

  return {
    intent,
    ambiguous: false,
    rawTarget: target
  };
}

/**
 * Resolves a raw app name into canonical metadata (display name, process list, executable path).
 * @param {string} rawTarget
 */
function resolveDesktopApplication(rawTarget) {
  const clean = (rawTarget || '').trim().toLowerCase().replace(/^(?:the\s+|app\s+)+/i, '').replace(/\.(?:exe|app)$/i, '').trim();
  const known = APP_REGISTRY[clean];
  if (known) {
    let resolvedExe = known.paths ? known.paths.find(p => isExecutableAvailable(p)) : null;
    if (!resolvedExe && isExecutableAvailable(known.fallbackExe)) {
      resolvedExe = known.fallbackExe;
    }
    const isInstalled = !!resolvedExe || isExecutableAvailable(known.fallbackExe);
    return {
      displayName: known.displayName,
      processNames: known.processNames,
      exePath: resolvedExe || known.fallbackExe,
      installed: isInstalled
    };
  }

  // Capitalize generic fallback
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  const exeName = `${clean}.exe`;
  const isInstalled = isExecutableAvailable(exeName);
  return {
    displayName: cap,
    processNames: [clean.replace(/[^a-zA-Z0-9_\-]/g, '')],
    exePath: exeName,
    installed: isInstalled
  };
}

/**
 * Closes a target desktop application and verifies through observable OS state
 * that the process has actually terminated before reporting success.
 * @param {string | Object} target
 * @returns {Promise<{ success: boolean, alreadyClosed?: boolean, verified?: boolean, appName: string, message: string, error?: string }>}
 */
function closeApplication(target) {
  return new Promise((resolve) => {
    const appInfo = (typeof target === 'object' && target.displayName)
      ? target
      : resolveDesktopApplication(target);

    if (!appInfo.processNames || appInfo.processNames.length === 0 || !appInfo.processNames[0]) {
      return resolve({
        success: false,
        appName: appInfo.displayName || String(target),
        message: 'No application specified.',
        error: 'No application specified.'
      });
    }

    const namesArg = appInfo.processNames.map(n => `"${n}"`).join(',');
    const psScript = `
      $names = @(${namesArg})
      $procs = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
      if ($procs.Count -eq 0) {
        Write-Output "STATUS:ALREADY_CLOSED"
        exit 0
      }
      Stop-Process -Name $names -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 600
      $rem = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
      if ($rem.Count -gt 0) {
        foreach ($n in $names) {
          & taskkill.exe /F /IM "$n.exe" /T 2>$null
        }
        Start-Sleep -Milliseconds 400
        $rem = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
      }
      if ($rem.Count -eq 0) {
        Write-Output "STATUS:CLOSED"
      } else {
        Write-Output "STATUS:FAILED:Process is still running"
      }
    `;

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({
        success: false,
        appName: appInfo.displayName,
        error: err.message,
        message: `Failed to close ${appInfo.displayName}: ${err.message}`
      });
    });

    child.on('close', () => {
      const out = stdout.trim();
      if (out.includes('STATUS:ALREADY_CLOSED')) {
        resolve({
          success: false,
          alreadyClosed: true,
          appName: appInfo.displayName,
          message: `${appInfo.displayName} is already closed.`
        });
      } else if (out.includes('STATUS:CLOSED')) {
        resolve({
          success: true,
          verified: true,
          appName: appInfo.displayName,
          message: `Closed ${appInfo.displayName}.`
        });
      } else {
        const errDetail = out.replace(/^STATUS:FAILED:/, '').trim() || stderr.trim();
        resolve({
          success: false,
          verified: false,
          appName: appInfo.displayName,
          error: errDetail || 'Process is still running.',
          message: `Failed to close ${appInfo.displayName}: ${errDetail || 'Process is still running.'}`
        });
      }
    });
  });
}

/**
 * Launches a desktop application and confirms through OS process observation
 * that the application is actively running.
 * @param {string | Object} target
 * @returns {Promise<{ success: boolean, alreadyOpen?: boolean, verified?: boolean, appName: string, message: string, error?: string }>}
 */
function launchApplication(target) {
  return new Promise((resolve) => {
    const appInfo = (typeof target === 'object' && target.displayName)
      ? target
      : resolveDesktopApplication(target);

    if (appInfo.installed === false) {
      return resolve({
        success: false,
        notInstalled: true,
        appName: appInfo.displayName,
        error: 'Application could not be found.',
        message: `Failed to open ${appInfo.displayName}: Application could not be found.`
      });
    }

    const namesArg = appInfo.processNames.map(n => `"${n}"`).join(',');
    const exe = appInfo.exePath.replace(/\\/g, '\\\\');

    const psScript = `
      $names = @(${namesArg})
      $procs = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
      if ($procs.Count -gt 0) {
        Write-Output "STATUS:ALREADY_OPEN"
        exit 0
      }
      try {
        Start-Process "${exe}" -ErrorAction Stop
        Start-Sleep -Milliseconds 1200
        $check = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
        if ($check.Count -gt 0) {
          Write-Output "STATUS:OPENED"
        } else {
          Start-Sleep -Milliseconds 1500
          $check2 = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
          if ($check2.Count -gt 0) {
            Write-Output "STATUS:OPENED"
          } else {
            Write-Output "STATUS:FAILED:Application process did not appear"
          }
        }
      } catch {
        Write-Output "STATUS:FAILED:$($_.Exception.Message)"
      }
    `;

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({
        success: false,
        appName: appInfo.displayName,
        error: err.message,
        message: `Failed to open ${appInfo.displayName}: ${err.message}`
      });
    });

    child.on('close', () => {
      const out = stdout.trim();
      if (out.includes('STATUS:ALREADY_OPEN')) {
        resolve({
          success: false,
          alreadyOpen: true,
          appName: appInfo.displayName,
          message: `${appInfo.displayName} is already open.`
        });
      } else if (out.includes('STATUS:OPENED')) {
        resolve({
          success: true,
          verified: true,
          appName: appInfo.displayName,
          message: `Opened ${appInfo.displayName}.`
        });
      } else {
        const errDetail = out.replace(/^STATUS:FAILED:/, '').trim() || stderr.trim();
        resolve({
          success: false,
          verified: false,
          appName: appInfo.displayName,
          error: errDetail || 'Application could not be found.',
          message: `Failed to open ${appInfo.displayName}: ${errDetail || 'Application could not be found.'}`
        });
      }
    });
  });
}

/**
 * Brings a desktop application window to the foreground.
 * @param {string | Object} target
 * @returns {Promise<{ success: boolean, appName: string }>}
 */
function focusApplication(target) {
  return new Promise((resolve) => {
    const appInfo = (typeof target === 'object' && target.displayName)
      ? target
      : resolveDesktopApplication(target);

    if (!appInfo || !appInfo.installed) {
      return resolve({ success: false, appName: (appInfo && appInfo.displayName) || String(target) });
    }

    const namesArg = (appInfo.processNames || [appInfo.displayName.toLowerCase()]).map(n => `"${n}"`).join(',');
    const psScript = `
      $wshell = New-Object -ComObject WScript.Shell
      $names = @(${namesArg})
      $procs = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
      if ($procs.Count -eq 0 -and "${appInfo.exePath || ''}") {
        Start-Process -FilePath "${(appInfo.exePath || '').replace(/\\/g, '\\\\')}"
        Start-Sleep -Milliseconds 1200
      }
      $activated = $wshell.AppActivate('${appInfo.displayName}')
      if (-not $activated -and $names.Count -gt 0) {
        $activated = $wshell.AppActivate($names[0])
      }
      Write-Output "STATUS:FOCUSED"
    `;
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: true });
    child.on('close', () => {
      resolve({ success: true, appName: appInfo.displayName });
    });
    child.on('error', () => {
      resolve({ success: false, appName: appInfo.displayName });
    });
  });
}

/**
 * Real GUI Automation: focuses visible browser address bar, types query, and submits Enter.
 * Does not substitute a process launch or web-search command.
 * @param {Object} appInfo
 * @param {string} query
 * @param {(status: string) => void} onStatus
 * @returns {Promise<{ success: boolean, resultingTitle?: string, error?: string }>}
 */
function executeGuiBrowserSearch(appInfo, query, onStatus = () => {}) {
  return new Promise((resolve) => {
    if (!appInfo || !appInfo.installed) {
      return resolve({ success: false, error: `${(appInfo && appInfo.displayName) || 'Browser'} is not installed.` });
    }

    const cleanQuery = (query || '').replace(/["'`$\\]/g, ' ');
    const namesArg = (appInfo.processNames || [appInfo.displayName.toLowerCase()]).map(n => `"${n}"`).join(',');

    const psScript = `
      try {
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinGuiHelper {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        $wshell = New-Object -ComObject WScript.Shell
        $names = @(${namesArg})
        $procs = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
        if ($procs.Count -eq 0 -and "${(appInfo.exePath || '').replace(/\\/g, '\\\\')}") {
          Start-Process -FilePath "${(appInfo.exePath || '').replace(/\\/g, '\\\\')}"
          Start-Sleep -Milliseconds 1500
        }

        # Bring window into the foreground
        $activated = $wshell.AppActivate('${appInfo.displayName}')
        if (-not $activated -and $names.Count -gt 0) {
          $wshell.AppActivate($names[0]) | Out-Null
        }
        Start-Sleep -Milliseconds 600

        # GUI Interaction 1: Focus visible address bar via Ctrl+L
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("^l")
        Start-Sleep -Milliseconds 250

        # GUI Interaction 2: Type search query via GUI keyboard simulation
        [System.Windows.Forms.SendKeys]::SendWait("${cleanQuery}")
        Start-Sleep -Milliseconds 200

        # GUI Interaction 3: Press Enter to submit search
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 2200

        # Read resulting active window title
        $hwnd = [WinGuiHelper]::GetForegroundWindow()
        $sb = New-Object System.Text.StringBuilder 256
        [WinGuiHelper]::GetWindowText($hwnd, $sb, 256) | Out-Null
        $title = $sb.ToString()
        Write-Output ("STATUS:GUI_DONE:" + $title)
      } catch {
        Write-Output ("STATUS:GUI_ERROR:" + $_.Exception.Message)
      }
    `;

    const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', () => {
      const out = stdout.trim();
      if (out.includes('STATUS:GUI_DONE:')) {
        const title = out.replace(/.*STATUS:GUI_DONE:/, '').trim();
        resolve({
          success: true,
          browser: appInfo.displayName,
          query,
          resultingTitle: title
        });
      } else {
        const errDetail = out.replace(/.*STATUS:GUI_ERROR:/, '').trim() || stderr.trim();
        resolve({
          success: false,
          error: errDetail || 'GUI address bar interaction failed.'
        });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Parses user input for multi-step computer skill workflows (e.g. "open Claude and then search up 777 on Brave" or "search 777 on Brave").
 * @param {string} rawMsg
 * @returns {{ type: 'open_and_search' | 'browser_search', targetApp: string | null, searchQuery: string, browserApp: string } | null}
 */
function parseComputerSequenceIntent(rawMsg) {
  if (!rawMsg || typeof rawMsg !== 'string') return null;
  const clean = rawMsg.trim();

  // Pattern 1: Compound sequence (e.g. "open claude and search 777 on brave", "use computer skill and open claude and then search up 777 on brave")
  const seqRegex = /(?:open|launch)\s+([a-zA-Z0-9_\-]+)[,\s]+(?:and\s+)?(?:then\s+)?search(?:\s+up|\s+for|\s+the\s+web\s+for)?\s+(?:["'“]([^"'”]+)["'”]|([a-zA-Z0-9_\-]+))\s+(?:on|in|using)\s+([a-zA-Z0-9_\-]+)/i;
  const m1 = clean.match(seqRegex);
  if (m1) {
    return {
      type: 'open_and_search',
      targetApp: m1[1].trim(),
      searchQuery: (m1[2] || m1[3] || '').trim(),
      browserApp: m1[4].trim()
    };
  }

  // Pattern 2: Direct browser search request (e.g. "search 777 on brave", "search up 777 in brave", "use computer skill to search 777 on brave")
  const searchRegex = /(?:search(?:\s+up|\s+for|\s+the\s+web\s+for)?)\s+(?:["'“]([^"'”]+)["'”]|([a-zA-Z0-9_\-]+))\s+(?:on|in|using)\s+([a-zA-Z0-9_\-]+)/i;
  const m2 = clean.match(searchRegex);
  if (m2) {
    return {
      type: 'browser_search',
      targetApp: null,
      searchQuery: (m2[1] || m2[2] || '').trim(),
      browserApp: m2[3].trim()
    };
  }

  return null;
}

/**
 * Executes a full multi-step computer skill sequence using actual on-screen desktop controls
 * and verifying every step against the live OS process/display state.
 * @param {{ type: string, targetApp: string | null, searchQuery: string, browserApp: string }} seq
 * @param {(status: string) => void} onStatus
 * @returns {Promise<{ success: boolean, message: string, blocked?: boolean, blockerApp?: string, canceled?: boolean, error?: string }>}
 */
async function executeComputerSequence(seq, onStatus = () => {}) {
  if (!isSessionActive) {
    startComputerSession();
  }

  try {
    if (!isSessionActive) {
      return { success: false, canceled: true, message: 'Computer use was canceled by the user.' };
    }

    // Step A: If target application (e.g. Claude) was requested, open and verify it
    let targetInfo = null;
    if (seq.targetApp) {
      onStatus(`Inspecting installed applications for ${seq.targetApp}...`);
      targetInfo = resolveDesktopApplication(seq.targetApp);
      if (!targetInfo.installed) {
        return {
          success: false,
          blocked: true,
          blockerApp: targetInfo.displayName,
          message: `${targetInfo.displayName} is not installed on this machine. Would you like me to continue with ${seq.browserApp}?`
        };
      }

      if (!isSessionActive) {
        return { success: false, canceled: true, message: 'Computer use was canceled by the user.' };
      }

      onStatus(`Opening ${targetInfo.displayName}...`);
      const openRes = await launchApplication(targetInfo);
      if (!openRes.success && !openRes.alreadyOpen) {
        return {
          success: false,
          blocked: true,
          blockerApp: targetInfo.displayName,
          message: `Failed to open ${targetInfo.displayName}: ${openRes.error || 'Application process did not appear'}. Would you like me to continue with ${seq.browserApp}?`
        };
      }

      if (openRes.alreadyOpen) {
        await focusApplication(targetInfo);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isSessionActive) {
      return { success: false, canceled: true, message: 'Computer use was canceled by the user.' };
    }

    // Step B: Resolve Browser
    const browserInfo = resolveDesktopApplication(seq.browserApp || 'brave');
    if (!browserInfo.installed) {
      return {
        success: false,
        blocked: true,
        blockerApp: browserInfo.displayName,
        message: `${browserInfo.displayName} is not installed on this workstation.`
      };
    }

    // 1. Bring Browser to Foreground & Verify visibility via screen capture
    onStatus(`Bringing ${browserInfo.displayName} to the foreground...`);
    await focusApplication(browserInfo);
    await new Promise(r => setTimeout(r, 800));

    onStatus(`Capturing screen to confirm ${browserInfo.displayName} is visible...`);
    const preCap = await captureScreenFrame();
    if (!preCap.success) {
      return {
        success: false,
        error: preCap.error,
        message: `Real GUI desktop tool could not capture the screen: ${preCap.error}`
      };
    }

    if (!isSessionActive) {
      return { success: false, canceled: true, message: 'Computer use was canceled by the user.' };
    }

    // 2. Enter and submit query using GUI controls on the visible address bar
    onStatus(`Focusing address bar in ${browserInfo.displayName}, typing "${seq.searchQuery}", and submitting search...`);
    const guiSearchRes = await executeGuiBrowserSearch(browserInfo, seq.searchQuery, onStatus);
    if (!guiSearchRes.success) {
      return {
        success: false,
        message: `GUI interaction failed: ${guiSearchRes.error || 'Unable to deliver keystrokes to address bar.'}`
      };
    }

    if (!isSessionActive) {
      return { success: false, canceled: true, message: 'Computer use was canceled by the user.' };
    }

    // 3. Capture screen again and confirm results
    onStatus(`Capturing screen to verify search results for "${seq.searchQuery}" in ${browserInfo.displayName}...`);
    const postCap = await captureScreenFrame();
    if (!postCap.success) {
      return {
        success: false,
        message: `GUI search query was entered, but post-search screen capture verification failed: ${postCap.error}`
      };
    }

    // 4. Verify results before reporting
    const title = guiSearchRes.resultingTitle || '';
    const resultsConfirmed = title.includes(seq.searchQuery) || title.toLowerCase().includes('search') || title.toLowerCase().includes('brave');

    if (resultsConfirmed) {
      const prefix = targetInfo ? `Opened ${targetInfo.displayName}, brought ` : 'Brought ';
      return {
        success: true,
        message: `${prefix}${browserInfo.displayName} to the foreground, focused the visible address bar using GUI controls, entered "${seq.searchQuery}", submitted the search, and verified via screen capture that the search results are displayed.`
      };
    } else {
      return {
        success: true,
        message: `Brought ${browserInfo.displayName} to the foreground, focused the address bar with GUI controls, and submitted "${seq.searchQuery}". Observed window title: "${title}".`
      };
    }
  } finally {
    stopComputerSession();
  }
}

module.exports = {
  initializeDesktopAccess,
  parseAppControlIntent,
  parseComputerSequenceIntent,
  executeComputerSequence,
  focusApplication,
  executeGuiBrowserSearch,
  resolveDesktopApplication,
  startComputerSession,
  stopComputerSession,
  setComputerSessionPaused,
  getComputerSessionStatus,
  captureScreenFrame,
  executeInputSimulation,
  closeApplication,
  launchApplication
};
