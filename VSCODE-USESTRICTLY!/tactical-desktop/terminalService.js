// ============================================================================
// Tactical IDE — Terminal & Command Execution Subsystem
// Sandboxed workspace command execution with risk-based approval guards
// ============================================================================

const { spawn } = require('child_process');
const path = require('path');
const { checkCheatAndExploitGuard, redactSecrets } = require('./safetyGuards.js');

const activeProcesses = new Map();

// Known safe/low-risk workspace inspection and build commands
const LOW_RISK_COMMAND_PREFIXES = [
  'git status',
  'git diff',
  'git log',
  'git branch',
  'git show',
  'npm test',
  'npm run build',
  'npm run pack',
  'npm run lint',
  'npm -v',
  'node -v',
  'ls',
  'dir',
  'pwd',
  'echo',
  'cat',
  'type',
  'find',
  'grep',
  'tsc --noemit',
  'python --version',
  'python -m unittest'
];

// Dangerous / destructive commands that always require explicit confirmation
const HIGH_RISK_PATTERNS = [
  /\b(?:rm|del|rmdir|rd)\s+[-/]/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\breg\s+(?:add|delete)\b/i,
  /\b(?:sudo|runas)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bcurl\b.*\|\s*(?:bash|sh|pwsh|cmd)/i,
  /\bwget\b.*\|\s*(?:bash|sh|pwsh|cmd)/i,
  /\bchmod\s+-R\s+777\b/i,
  /\bnet\s+(?:user|localgroup)\b/i,
  /\bshutdown\b/i
];

/**
 * Classifies command risk level.
 * @param {string} command - Raw command line
 * @returns {'low' | 'high' | 'blocked'}
 */
function assessCommandRisk(command) {
  const clean = (command || '').trim();

  // 1. Cheat & Exploit Guard Check
  const cheatCheck = checkCheatAndExploitGuard(clean);
  if (cheatCheck.blocked) {
    return { level: 'blocked', reason: cheatCheck.reason };
  }

  // 2. High-risk destructive check
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(clean)) {
      return { level: 'high', reason: 'Destructive or administrative system action detected.' };
    }
  }

  // 3. Low-risk match check
  const lower = clean.toLowerCase();
  for (const prefix of LOW_RISK_COMMAND_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + ' ')) {
      return { level: 'low' };
    }
  }

  // Default to standard workspace action
  return { level: 'medium' };
}

/**
 * Executes a command within the specified workspace root.
 * @param {Object} options
 * @param {string} options.command - The command to run
 * @param {string} options.workspaceRoot - Directory in which to run
 * @param {Function} [options.onOutput] - Streaming output callback (type: 'stdout'|'stderr', data: string)
 * @param {number} [options.timeoutMs] - Timeout limit in milliseconds (default 60s)
 * @returns {Promise<{ success: boolean, exitCode: number, stdout: string, stderr: string, durationMs: number, error?: string }>}
 */
function executeCommand({ command, workspaceRoot, onOutput, timeoutMs = 60000 }) {
  return new Promise((resolve) => {
    const cleanCmd = (command || '').trim();
    const risk = assessCommandRisk(cleanCmd);

    if (risk.level === 'blocked') {
      return resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: risk.reason,
        durationMs: 0,
        error: risk.reason
      });
    }

    const processId = 'term-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const startTime = Date.now();
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/sh';
    const args = isWin ? ['-NoProfile', '-Command', cleanCmd] : ['-c', cleanCmd];

    const child = spawn(shell, args, {
      cwd: path.resolve(workspaceRoot || process.cwd()),
      env: Object.assign({}, process.env, {
        CI: 'true',
        TERM: 'dumb'
      }),
      windowsHide: true
    });

    activeProcesses.set(processId, child);

    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch (_) {}
        stderrBuffer += `\n[Tactical Terminal Error]: Command timed out after ${Math.round(timeoutMs / 1000)}s.`;
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      const text = redactSecrets(chunk.toString());
      stdoutBuffer += text;
      if (typeof onOutput === 'function') {
        onOutput({ processId, stream: 'stdout', data: text });
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = redactSecrets(chunk.toString());
      stderrBuffer += text;
      if (typeof onOutput === 'function') {
        onOutput({ processId, stream: 'stderr', data: text });
      }
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      activeProcesses.delete(processId);
      resolve({
        success: false,
        exitCode: -1,
        stdout: stdoutBuffer,
        stderr: stderrBuffer + '\n' + err.message,
        durationMs: Date.now() - startTime,
        error: err.message
      });
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      activeProcesses.delete(processId);
      const exitCode = code === null ? 0 : code;
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout: stdoutBuffer.slice(0, 100000), // Cap output buffer to avoid context overflow
        stderr: stderrBuffer.slice(0, 50000),
        durationMs: Date.now() - startTime,
        error: exitCode !== 0 ? `Process exited with code ${exitCode}` : null
      });
    });
  });
}

function killRunningProcess(processId) {
  if (processId && activeProcesses.has(processId)) {
    const child = activeProcesses.get(processId);
    try {
      child.kill('SIGKILL');
    } catch (_) {}
    activeProcesses.delete(processId);
    return true;
  }
  // If no processId specified, terminate all active processes
  activeProcesses.forEach((child) => {
    try {
      child.kill('SIGKILL');
    } catch (_) {}
  });
  activeProcesses.clear();
  return true;
}

function getActiveProcessCount() {
  return activeProcesses.size;
}

module.exports = {
  assessCommandRisk,
  executeCommand,
  killRunningProcess,
  getActiveProcessCount
};
