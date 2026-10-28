#!/usr/bin/env node

// ============================================================================
// Sparx CLI — Interactive Terminal AI IDE Companion
// Fast streaming, direct file operations, terminal execution, and Git undo
// Models: Sparx 3.9 Flash (openai/gpt-oss-120b) & Sparx 3.8 Pro (openai/gpt-oss-20b)
// ============================================================================

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const vm = require('vm');
const { execSync, spawn } = require('child_process');

// ----------------------------------------------------------------------------
// ANSI Colors & Formatting
// ----------------------------------------------------------------------------
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// ----------------------------------------------------------------------------
// Model Definitions
// ----------------------------------------------------------------------------
const MODELS = {
  'sparx-3.9-flash': {
    id: 'openai/gpt-oss-120b',
    displayName: 'Sparx 3.9 Flash',
    desc: 'High-speed reasoning flagship'
  },
  'sparx-3.8-pro': {
    id: 'openai/gpt-oss-20b',
    displayName: 'Sparx 3.8 Pro',
    desc: 'Lightweight high-efficiency pro engine'
  }
};
let currentModelKey = 'sparx-3.9-flash';

// ----------------------------------------------------------------------------
// API Key Resolution
// ----------------------------------------------------------------------------
function resolveApiKey() {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    return { key: process.env.GROQ_API_KEY.trim(), provider: 'groq' };
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return { key: process.env.GEMINI_API_KEY.trim(), provider: 'gemini' };
  }

  // Look in app credentials
  const credPaths = [
    path.join(__dirname, '..', 'app-credentials.json'),
    path.join(__dirname, 'app-credentials.json'),
    path.join(process.cwd(), 'app-credentials.json'),
    path.join(process.env.APPDATA || '', 'TacticalStudio', 'app-credentials.json'),
    path.join(process.env.APPDATA || '', 'Sparx', 'app-credentials.json')
  ];

  for (const cp of credPaths) {
    if (fs.existsSync(cp)) {
      try {
        const creds = JSON.parse(fs.readFileSync(cp, 'utf8'));
        const key = creds.apiKey || creds.groqApiKey;
        if (key && typeof key === 'string' && key.trim()) {
          return { key: key.trim(), provider: 'groq' };
        }
      } catch (e) {}
    }
  }

  return { key: null, provider: null };
}

// ----------------------------------------------------------------------------
// Git Checkpoint & Undo Engine
// ----------------------------------------------------------------------------
function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function createCheckpoint(msg = 'Sparx checkpoint') {
  if (!isGitRepo()) return false;
  try {
    execSync('git add -A', { stdio: 'ignore' });
    execSync(`git commit -m "chore(sparx): ${msg}" --allow-empty`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function undoLastCheckpoint() {
  if (!isGitRepo()) {
    console.log(`${c.yellow}Directory is not a Git repository. Undo requires Git.${c.reset}`);
    return false;
  }
  try {
    execSync('git reset --hard HEAD~1', { stdio: 'inherit' });
    console.log(`${c.green}✔ Successfully reverted last Sparx checkpoint.${c.reset}`);
    return true;
  } catch (e) {
    console.log(`${c.red}Undo failed:${c.reset} ${e.message}`);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Fuzzy Whitespace-Tolerant Code Replacer
// ----------------------------------------------------------------------------
function fuzzyReplace(content, target, replacement) {
  // 1. Direct exact match
  if (content.includes(target)) {
    return { success: true, newContent: content.replace(target, replacement) };
  }

  // 2. Line-ending normalization (\r\n vs \n)
  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget = target.replace(/\r\n/g, '\n');
  const normReplacement = replacement.replace(/\r\n/g, '\n');

  if (normContent.includes(normTarget)) {
    const replaced = normContent.replace(normTarget, normReplacement);
    const finalContent = content.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
    return { success: true, newContent: finalContent };
  }

  // 3. Trimmed line-by-line block matching
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
      return { success: true, newContent: replaced };
    }
  }

  return { success: false, error: 'Target block not found in file. Check indentation and whitespace.' };
}

// ----------------------------------------------------------------------------
// Tool Definitions & Autonomous Handlers
// ----------------------------------------------------------------------------
const tools = {
  read_file: ({ path: filePath, startLine, endLine }) => {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return { error: `File not found: ${filePath}` };
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const start = Math.max(1, startLine || 1);
    const end = Math.min(lines.length, endLine || lines.length);
    const slice = lines.slice(start - 1, end).map((l, idx) => `${start + idx}: ${l}`).join('\n');
    return { path: filePath, totalLines: lines.length, startLine: start, endLine: end, content: slice };
  },

  edit_file: ({ path: filePath, target, replacement }) => {
    createCheckpoint(`Edit ${filePath}`);
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return { error: `File not found: ${filePath}` };
    const content = fs.readFileSync(fullPath, 'utf8');

    const result = fuzzyReplace(content, target, replacement);
    if (!result.success) {
      return { error: result.error };
    }

    fs.writeFileSync(fullPath, result.newContent, 'utf8');

    // Quick syntax verification for JS/JSON files
    let warning = null;
    if (filePath.endsWith('.json')) {
      try {
        JSON.parse(result.newContent);
      } catch (err) {
        warning = `JSON syntax warning: ${err.message}`;
      }
    } else if (filePath.endsWith('.js')) {
      try {
        new vm.Script(result.newContent);
      } catch (err) {
        warning = `JavaScript syntax warning: ${err.message}`;
      }
    }

    return {
      success: true,
      path: filePath,
      message: `Successfully edited ${filePath}${warning ? ' (' + warning + ')' : ''}`,
      warning
    };
  },

  create_file: ({ path: filePath, content }) => {
    createCheckpoint(`Create ${filePath}`);
    const fullPath = path.resolve(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, path: filePath, message: `Created ${filePath} (${Buffer.byteLength(content, 'utf8')} bytes)` };
  },

  run_command: ({ command }) => {
    try {
      const out = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
      return { stdout: out.trim(), exitCode: 0 };
    } catch (err) {
      return {
        stdout: (err.stdout || '').toString().trim(),
        stderr: (err.stderr || '').toString().trim(),
        exitCode: err.status || 1,
        error: err.message
      };
    }
  },

  search_code: ({ query, path: searchPath = '.' }) => {
    try {
      const full = path.resolve(process.cwd(), searchPath);
      const results = [];
      function walk(dir) {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;
          const sub = path.join(dir, item.name);
          if (item.isDirectory()) {
            walk(sub);
          } else {
            try {
              const txt = fs.readFileSync(sub, 'utf8');
              if (txt.includes(query)) {
                results.push(path.relative(process.cwd(), sub));
              }
            } catch (e) {}
          }
        }
      }
      walk(full);
      return { query, matches: results.slice(0, 25), total: results.length };
    } catch (e) {
      return { error: e.message };
    }
  }
};

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file within an optional line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path.' },
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
      description: 'Replace a target code block with a new replacement block using whitespace-tolerant matching.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path.' },
          target: { type: 'string', description: 'Exact or whitespace-similar block to replace.' },
          replacement: { type: 'string', description: 'Replacement string.' }
        },
        required: ['path', 'target', 'replacement']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file with specified content. Creates directories automatically.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path.' },
          content: { type: 'string', description: 'Full text content to write.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command in the workspace.',
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
      description: 'Search for text or identifiers across the codebase.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search string.' },
          path: { type: 'string', description: 'Optional directory path.' }
        },
        required: ['query']
      }
    }
  }
];

// ----------------------------------------------------------------------------
// Groq LLM API Streaming
// ----------------------------------------------------------------------------
async function callGroqAPI(messages, apiKey, modelId) {
  const payload = {
    model: modelId || MODELS[currentModelKey].id,
    messages,
    tools: toolDefinitions,
    tool_choice: 'auto',
    temperature: 0.6,
    max_tokens: 4096
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  if (!choice) throw new Error('No choices returned by Groq API');
  return choice.message;
}

// ----------------------------------------------------------------------------
// Persistent Memory Integration
// ----------------------------------------------------------------------------
function loadMemoryBlock() {
  try {
    const memoryService = require('../memoryService');
    return memoryService.getSystemPromptMemoryBlock();
  } catch (e) {
    return '';
  }
}

function buildSystemPrompt() {
  const activeModel = MODELS[currentModelKey];
  const memoryBlock = loadMemoryBlock();

  return `You are Sparx, a smart, friendly, and highly capable software developer and pair programmer operating directly in the user's terminal workspace (${process.cwd()}).

[IDENTITY & ENVIRONMENT]:
- You are Sparx, running on ${activeModel.displayName}.
- You operate inside the Sparx Terminal AI IDE companion (CLI).
- You have autonomous access to developer tools: reading files, applying surgical fuzzy diffs, creating files, executing shell commands, searching code, and managing git checkpoints.
- When asked about your model or IDE, state your name (Sparx), model (${activeModel.displayName}), and explain your capabilities clearly and warmly.

[CONVERSATION STYLE & VOICE]:
- Warm, engaged, attentive, and confident. Sound like a great senior developer collaborating with a teammate.
- Natural adaptability: match user tone. Keep simple replies concise; dive deep when the technical challenge calls for it.
- Attentive context: respond directly to the latest message in context. Do not repeat previous answers or restart prior topics.
- When the user gives brief acknowledgements (e.g. 'nice', 'ok', 'thanks', 'cool', 'got it'): reply briefly and warmly (e.g. 'Glad that helped!', 'Sounds good.').
- Do NOT append canned, repetitive follow-ups like 'Is there anything else I can help with?' to every reply.
- Handle corrections naturally: acknowledge plainly ('Good catch, my bad!') and fix it immediately without defensiveness or groveling.${memoryBlock}`;
}

// ----------------------------------------------------------------------------
// Main CLI Interactive REPL
// ----------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);

  // Check for model flag
  const modelFlagIdx = args.findIndex(a => a === '--model' || a === '-m');
  if (modelFlagIdx !== -1 && args[modelFlagIdx + 1]) {
    const m = args[modelFlagIdx + 1].toLowerCase();
    if (m.includes('3.8') || m.includes('pro')) {
      currentModelKey = 'sparx-3.8-pro';
    } else {
      currentModelKey = 'sparx-3.9-flash';
    }
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${c.brightCyan}${c.bold}Sparx Terminal AI IDE v1.0.0${c.reset}
Usage: sparx [options] [query]

Options:
  -h, --help            Show this help message
  -v, --version         Show version number
  -m, --model <name>    Select model: 'flash' (Sparx 3.9 Flash) or 'pro' (Sparx 3.8 Pro)

Interactive Slash Commands:
  /help                 Show slash commands
  /model                Show or switch active LLM engine
  /add <file>           Pin a file into context
  /drop <file>          Drop a pinned file
  /files                Show pinned files
  /diff                 Show Git diff
  /undo                 Revert the last AI change
  /run <cmd>            Execute shell command
  /clear                Clear conversation history
  /exit                 Exit session
`);
    process.exit(0);
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log('sparx 1.0.0');
    process.exit(0);
  }

  const { key } = resolveApiKey();

  console.clear();
  console.log(`
${c.brightCyan}${c.bold}   ███████╗██████╗  █████╗ ██████╗ ██╗  ██╗
   ██╔════╝██╔══██╗██╔══██╗██╔══██╗╚██╗██╔╝
   ███████╗██████╔╝███████║██████╔╝ ╚███╔╝ 
   ╚════██║██╔═══╝ ██╔══██║██╔══██╗ ██╔██╗ 
   ███████║██║     ██║  ██║██║  ██║██╔╝ ██╗
   ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝${c.reset}
  ${c.dim}Sparx Terminal AI IDE · Engine: ${c.cyan}${MODELS[currentModelKey].displayName}${c.dim} · ${c.gray}${process.cwd()}${c.reset}
  ${c.gray}Type your task, or use ${c.white}/help${c.gray} for commands.${c.reset}
`);

  if (!key) {
    console.log(`${c.red}Warning: No API key found in app-credentials.json or GROQ_API_KEY env var.${c.reset}`);
    console.log(`${c.gray}Please set GROQ_API_KEY to start coding with Sparx.${c.reset}\n`);
  }

  const pinnedFiles = new Map();
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt()
    }
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.brightCyan}sparx${c.reset} > `
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Slash Commands
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ').trim();

      switch (cmd) {
        case '/help':
          console.log(`
${c.bold}Sparx CLI Slash Commands:${c.reset}
  ${c.cyan}/model [flash|pro]${c.reset}  Switch model between Sparx 3.9 Flash and Sparx 3.8 Pro
  ${c.cyan}/add <file>${c.reset}         Pin a file's full content into conversation context
  ${c.cyan}/drop <file>${c.reset}        Remove a pinned file from context
  ${c.cyan}/files${c.reset}              List currently pinned files
  ${c.cyan}/diff${c.reset}               View working tree Git diff
  ${c.cyan}/undo${c.reset}               Revert the last Sparx checkpoint
  ${c.cyan}/run <command>${c.reset}     Execute a shell command directly
  ${c.cyan}/clear${c.reset}              Clear conversation history
  ${c.cyan}/exit${c.reset}               Exit Sparx CLI
`);
          break;

        case '/model':
          if (!arg) {
            console.log(`\nActive Engine: ${c.brightCyan}${MODELS[currentModelKey].displayName}${c.reset} (${MODELS[currentModelKey].desc})`);
            console.log(`Available options: ${c.white}/model flash${c.reset} | ${c.white}/model pro${c.reset}\n`);
          } else if (arg.includes('3.8') || arg.toLowerCase().includes('pro')) {
            currentModelKey = 'sparx-3.8-pro';
            messages[0].content = buildSystemPrompt();
            console.log(`${c.green}✔ Switched model to ${MODELS[currentModelKey].displayName}${c.reset}`);
          } else {
            currentModelKey = 'sparx-3.9-flash';
            messages[0].content = buildSystemPrompt();
            console.log(`${c.green}✔ Switched model to ${MODELS[currentModelKey].displayName}${c.reset}`);
          }
          break;

        case '/add':
          if (!arg) {
            console.log(`${c.yellow}Usage: /add <file-path>${c.reset}`);
          } else {
            const fp = path.resolve(process.cwd(), arg);
            if (fs.existsSync(fp)) {
              const content = fs.readFileSync(fp, 'utf8');
              pinnedFiles.set(arg, content);
              console.log(`${c.green}✔ Added ${arg} (${content.split('\n').length} lines) to context.${c.reset}`);
            } else {
              console.log(`${c.red}File not found: ${arg}${c.reset}`);
            }
          }
          break;

        case '/drop':
          if (pinnedFiles.has(arg)) {
            pinnedFiles.delete(arg);
            console.log(`${c.green}✔ Dropped ${arg} from context.${c.reset}`);
          } else {
            console.log(`${c.yellow}File not currently pinned: ${arg}${c.reset}`);
          }
          break;

        case '/files':
          if (pinnedFiles.size === 0) {
            console.log(`${c.dim}No pinned files. Use /add <file> to attach context.${c.reset}`);
          } else {
            console.log(`${c.bold}Pinned Context Files:${c.reset}`);
            for (const [f, txt] of pinnedFiles.entries()) {
              console.log(`  • ${c.cyan}${f}${c.reset} (${txt.split('\n').length} lines)`);
            }
          }
          break;

        case '/diff':
          if (isGitRepo()) {
            try {
              const diffOut = execSync('git diff', { encoding: 'utf8' });
              console.log(diffOut || `${c.dim}No uncommitted changes in working tree.${c.reset}`);
            } catch (e) {
              console.log(`${c.red}Error reading git diff:${c.reset}`, e.message);
            }
          } else {
            console.log(`${c.yellow}Directory is not a Git repository.${c.reset}`);
          }
          break;

        case '/undo':
          undoLastCheckpoint();
          break;

        case '/run':
          if (!arg) {
            console.log(`${c.yellow}Usage: /run <command>${c.reset}`);
          } else {
            console.log(`${c.dim}$ ${arg}${c.reset}`);
            try {
              execSync(arg, { stdio: 'inherit' });
            } catch (e) {}
          }
          break;

        case '/clear':
          messages.length = 1;
          messages[0].content = buildSystemPrompt();
          console.log(`${c.green}✔ Cleared conversation history.${c.reset}`);
          break;

        case '/exit':
        case '/quit':
          rl.close();
          process.exit(0);
          break;

        default:
          console.log(`${c.red}Unknown command: ${cmd}. Type /help for available commands.${c.reset}`);
      }

      rl.prompt();
      return;
    }

    if (!key) {
      console.log(`${c.red}Cannot execute AI prompt: Missing API key.${c.reset}`);
      rl.prompt();
      return;
    }

    // Explicit preference check
    try {
      const memoryService = require('../memoryService');
      const pref = memoryService.detectUserPreference(input);
      if (pref) {
        memoryService.addMemory(pref, 'preference');
        console.log(`${c.magenta}🧠 Remembered preference:${c.reset} ${pref}`);
        messages[0].content = buildSystemPrompt();
      }
    } catch (e) {}

    // Build context with pinned files
    let userPromptWithContext = input;
    if (pinnedFiles.size > 0) {
      let contextBlock = '\n\n--- PINNED CONTEXT FILES ---\n';
      for (const [fp, content] of pinnedFiles.entries()) {
        contextBlock += `\nFile: ${fp}\n\`\`\`\n${content}\n\`\`\`\n`;
      }
      userPromptWithContext += contextBlock;
    }

    messages.push({ role: 'user', content: userPromptWithContext });

    // Autonomous Execution Loop
    let loopCount = 0;
    const maxLoops = 8;

    while (loopCount < maxLoops) {
      loopCount++;
      process.stdout.write(`${c.dim}Thinking...${c.reset}\r`);

      try {
        const assistantMsg = await callGroqAPI(messages, key, MODELS[currentModelKey].id);
        messages.push(assistantMsg);

        // If assistant has text content, print it
        if (assistantMsg.content) {
          process.stdout.write('\r               \r'); // clear "Thinking..."
          console.log(`\n${c.cyan}${c.bold}Sparx:${c.reset} ${assistantMsg.content}\n`);
        }

        // If tool calls are requested, execute them
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          for (const tc of assistantMsg.tool_calls) {
            const fnName = tc.function.name;
            let toolArgs = {};
            try {
              toolArgs = JSON.parse(tc.function.arguments);
            } catch (e) {
              toolArgs = {};
            }

            console.log(`${c.yellow}⚡ Tool [${fnName}]${c.reset} ${c.dim}${JSON.stringify(toolArgs)}${c.reset}`);

            let result = null;
            if (tools[fnName]) {
              result = tools[fnName](toolArgs);
              if (result.success) {
                console.log(`  ${c.green}✔ ${result.message || 'Done'}${c.reset}`);
              } else if (result.error) {
                console.log(`  ${c.red}✖ ${result.error}${c.reset}`);
              } else if (result.stdout !== undefined) {
                console.log(`  ${c.gray}Exit ${result.exitCode}${c.reset}`);
                if (result.stdout) console.log(`  ${c.dim}${result.stdout.slice(0, 300)}${c.reset}`);
              }
            } else {
              result = { error: `Tool ${fnName} not recognized` };
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: fnName,
              content: JSON.stringify(result)
            });
          }
        } else {
          // No more tool calls, turn is complete
          break;
        }
      } catch (err) {
        process.stdout.write('\r               \r');
        console.error(`${c.red}Error:${c.reset}`, err.message);
        break;
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${c.dim}Sparx session closed.${c.reset}`);
    process.exit(0);
  });
}

main().catch(err => {
  console.error(`${c.red}Fatal:${c.reset}`, err);
  process.exit(1);
});
