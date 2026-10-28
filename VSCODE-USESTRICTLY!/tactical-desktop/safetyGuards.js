// ============================================================================
// Tactical IDE — Universal Safety & Anti-Exploit Guard Engine
// Strict enforcement against game cheating, memory manipulation, and malware.
// ============================================================================

const CHEAT_PATTERNS = [
  /\baimbot\b/i,
  /\bwallhack\b/i,
  /\besp\s*(?:box|line|hack|cheat)?\b/i,
  /\btriggerbot\b/i,
  /\brecoil\s*(?:script|macro|hack|compensat(?:or|ion))\b/i,
  /\bauto(?:matic)?\s*clicker\s*for\s*(?:game|roblox|valorant|fortnite|csgo|cs2|apex)\b/i,
  /\banti[-_ ]?cheat\s*(?:bypass|evasion|disabler|hook|killer)\b/i,
  /\bcheat\s*engine\b/i,
  /\b(?:read|write)processmemory\b/i,
  /\bdll\s*inject(?:or|ion)\b/i,
  /\bmemory\s*(?:patcher|scanner|hooking|spoofing)\b/i,
  /\bspeedhack\b/i,
  /\bitem\s*dup(?:licat(?:e|ion)|e)\s*exploit\b/i,
  /\bgame\s*exploit\b/i,
  /\bpacket\s*(?:injection|tampering|sniffer)\s*for\s*game\b/i,
  /\broblox\s*(?:executor|script\s*ware|synapse|krnl|fluxus)\b/i,
  /\bcompetitive\s*gameplay\s*bot\b/i,
  /\b(?:pvp|ranked)\s*(?:bot|macro|assist)\b/i
];

const SECRET_PATTERNS = [
  /gsk_[a-zA-Z0-9]{40,}/g,
  /AIza[0-9A-Za-z-_]{35}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /Bearer\s+[a-zA-Z0-9_\-\.]{25,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
];

/**
 * Checks whether an action, command, prompt, or target involves game cheating / exploitation.
 * @param {string} text - Command, prompt, or target description
 * @returns {{ blocked: boolean, reason?: string, isAmbiguous?: boolean }}
 */
function checkCheatAndExploitGuard(text) {
  if (!text || typeof text !== 'string') return { blocked: false };
  const clean = text.trim();

  // Allow legitimate visual tuning & development tools
  const isLegitimateDevModding = (
    clean.includes('reshade') || 
    clean.includes('shader') || 
    clean.includes('color grading') || 
    clean.includes('graphics preset') ||
    clean.includes('accessibility') ||
    clean.includes('unit test') ||
    clean.includes('lint') ||
    clean.includes('git ')
  ) && !clean.includes('aimbot') && !clean.includes('wallhack') && !clean.includes('inject');

  if (isLegitimateDevModding) {
    return { blocked: false };
  }

  for (const pattern of CHEAT_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        blocked: true,
        reason: 'Safety Policy Violation: Generating tools, commands, or automated controls for game cheating, competitive bots, aimbots, recoil macros, anti-cheat evasion, or process memory manipulation is strictly forbidden.'
      };
    }
  }

  // Check for ambiguous gaming automation requests
  if (/\b(?:game|match|matchmaking|server)\s+(?:bot|automate|farm|click)\b/i.test(clean)) {
    return {
      blocked: true,
      isAmbiguous: true,
      reason: 'Ambiguous Automation Request: Automation for competitive gameplay or unfair advantage is prohibited. Please clarify the intended development or accessibility purpose.'
    };
  }

  return { blocked: false };
}

/**
 * Redacts secrets (API keys, private keys, bearer tokens) from text.
 * @param {string} text - Input text
 * @returns {string} Redacted text
 */
function redactSecrets(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

module.exports = {
  checkCheatAndExploitGuard,
  redactSecrets
};
