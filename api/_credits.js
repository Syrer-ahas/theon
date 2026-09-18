import crypto from 'crypto';

export const DAILY_CREDIT_AMOUNT = 1;
export const GENERATION_COST = 1;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const localStore = globalThis.__TACTICAL_CREDIT_STORE__ || new Map();
globalThis.__TACTICAL_CREDIT_STORE__ = localStore;
const localIdentityIndex = globalThis.__TACTICAL_IDENTITY_INDEX__ || new Map();
globalThis.__TACTICAL_IDENTITY_INDEX__ = localIdentityIndex;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function hasPersistentCreditStore() {
  return Boolean(redisConfig());
}

function accountKey(subject) {
  if (!subject || typeof subject !== 'string') throw new Error('Verified user subject is required.');
  const digest = crypto.createHash('sha256').update(subject).digest('hex');
  return `tactical:credits:v1:${digest}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function identityKey(email) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('A valid verified email is required.');
  const digest = crypto.createHash('sha256').update(normalized).digest('hex');
  return `tactical:identity:v1:${digest}`;
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config) return null;
  const result = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!result.ok) throw new Error('Persistent credit store is unavailable.');
  const payload = await result.json();
  if (payload.error) throw new Error('Persistent credit store rejected the operation.');
  return payload.result;
}

const CLAIM_SCRIPT = `
local credits = tonumber(redis.call('HGET', KEYS[1], 'credits') or '0')
local last = tonumber(redis.call('HGET', KEYS[1], 'lastDailyAt') or '0')
local banned = tonumber(redis.call('HGET', KEYS[1], 'banned') or '0')
local now = tonumber(ARGV[1])
local amount = tonumber(ARGV[2])
local cooldown = tonumber(ARGV[3])
local granted = 0
if banned == 1 then
  return {credits, last, granted, banned}
end
if last == 0 or (now - last) >= cooldown then
  credits = credits + amount
  last = now
  granted = amount
  redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
end
return {credits, last, granted, banned}
`;

const CONSUME_SCRIPT = `
local credits = tonumber(redis.call('HGET', KEYS[1], 'credits') or '0')
local last = tonumber(redis.call('HGET', KEYS[1], 'lastDailyAt') or '0')
local banned = tonumber(redis.call('HGET', KEYS[1], 'banned') or '0')
local now = tonumber(ARGV[1])
local daily = tonumber(ARGV[2])
local cooldown = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local granted = 0
if banned == 1 then
  return {0, credits, last, granted, banned}
end
if last == 0 or (now - last) >= cooldown then
  credits = credits + daily
  last = now
  granted = daily
end
if credits < cost then
  redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
  return {0, credits, last, granted, banned}
end
credits = credits - cost
redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
return {1, credits, last, granted, banned}
`;

function claimLocal(subject, now) {
  const current = localStore.get(subject) || { credits: 0, lastDailyAt: 0, banned: false };
  let granted = 0;
  if (!current.banned && (current.lastDailyAt === 0 || now - current.lastDailyAt >= DAILY_COOLDOWN_MS)) {
    current.credits += DAILY_CREDIT_AMOUNT;
    current.lastDailyAt = now;
    granted = DAILY_CREDIT_AMOUNT;
  }
  localStore.set(subject, current);
  return { ...current, granted };
}

async function registerIdentity(subject, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const config = redisConfig();
  if (config) {
    await redisCommand(['SET', identityKey(normalized), subject]);
    await redisCommand(['HSET', accountKey(subject), 'email', normalized]);
  } else {
    localIdentityIndex.set(normalized, subject);
    const current = localStore.get(subject) || { credits: 0, lastDailyAt: 0, banned: false };
    current.email = normalized;
    localStore.set(subject, current);
  }
}

async function subjectForEmail(email) {
  const normalized = normalizeEmail(email);
  const config = redisConfig();
  if (config) return await redisCommand(['GET', identityKey(normalized)]);
  return localIdentityIndex.get(normalized) || null;
}

export async function getCreditAccount(subject, email) {
  await registerIdentity(subject, email);
  const now = Date.now();
  const config = redisConfig();
  let account;
  if (config) {
    const result = await redisCommand(['EVAL', CLAIM_SCRIPT, '1', accountKey(subject), String(now), String(DAILY_CREDIT_AMOUNT), String(DAILY_COOLDOWN_MS)]);
    account = { credits: Number(result[0]), lastDailyAt: Number(result[1]), granted: Number(result[2]), banned: Number(result[3]) === 1 };
  } else {
    account = claimLocal(subject, now);
  }
  return {
    credits: account.credits,
    dailyCredit: DAILY_CREDIT_AMOUNT,
    granted: account.granted,
    lastDailyAt: account.lastDailyAt,
    nextDailyAt: account.lastDailyAt + DAILY_COOLDOWN_MS,
    banned: Boolean(account.banned),
    persistent: Boolean(config)
  };
}

export async function consumeGenerationCredit(subject, email) {
  await registerIdentity(subject, email);
  const now = Date.now();
  const config = redisConfig();
  if (config) {
    const result = await redisCommand(['EVAL', CONSUME_SCRIPT, '1', accountKey(subject), String(now), String(DAILY_CREDIT_AMOUNT), String(DAILY_COOLDOWN_MS), String(GENERATION_COST)]);
    return {
      ok: Number(result[0]) === 1,
      credits: Number(result[1]),
      lastDailyAt: Number(result[2]),
      granted: Number(result[3]),
      banned: Number(result[4]) === 1
    };
  }

  const account = claimLocal(subject, now);
  if (account.banned) return { ok: false, ...account };
  if (account.credits < GENERATION_COST) return { ok: false, ...account };
  account.credits -= GENERATION_COST;
  localStore.set(subject, { credits: account.credits, lastDailyAt: account.lastDailyAt });
  return { ok: true, ...account };
}

export async function refundGenerationCredit(subject) {
  const config = redisConfig();
  if (config) {
    const credits = await redisCommand(['HINCRBY', accountKey(subject), 'credits', String(GENERATION_COST)]);
    return Number(credits);
  }
  const current = localStore.get(subject) || { credits: 0, lastDailyAt: 0 };
  current.credits += GENERATION_COST;
  localStore.set(subject, current);
  return current.credits;
}

export async function getUserAccountByEmail(email) {
  const normalized = normalizeEmail(email);
  const subject = await subjectForEmail(normalized);
  if (!subject) return null;
  const config = redisConfig();
  if (config) {
    const values = await redisCommand(['HMGET', accountKey(subject), 'credits', 'lastDailyAt', 'banned']);
    return { email: normalized, credits: Number(values?.[0] || 0), lastDailyAt: Number(values?.[1] || 0), banned: Number(values?.[2] || 0) === 1, persistent: true };
  }
  const account = localStore.get(subject) || { credits: 0, lastDailyAt: 0, banned: false };
  return { email: normalized, credits: Number(account.credits || 0), lastDailyAt: Number(account.lastDailyAt || 0), banned: Boolean(account.banned), persistent: false };
}

export async function adjustUserCreditsByEmail(email, delta) {
  const normalized = normalizeEmail(email);
  const subject = await subjectForEmail(normalized);
  if (!subject) return null;
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) throw new Error('Credit adjustment must be a non-zero integer up to 100000.');
  const config = redisConfig();
  if (config) {
    const script = `local current=tonumber(redis.call('HGET',KEYS[1],'credits') or '0') local updated=math.max(0,current+tonumber(ARGV[1])) redis.call('HSET',KEYS[1],'credits',updated) return updated`;
    await redisCommand(['EVAL', script, '1', accountKey(subject), String(amount)]);
  } else {
    const account = localStore.get(subject) || { credits: 0, lastDailyAt: 0, banned: false, email: normalized };
    account.credits = Math.max(0, Number(account.credits || 0) + amount);
    localStore.set(subject, account);
  }
  return getUserAccountByEmail(normalized);
}

export async function setUserBanByEmail(email, banned) {
  const normalized = normalizeEmail(email);
  const subject = await subjectForEmail(normalized);
  if (!subject) return null;
  const config = redisConfig();
  if (config) {
    await redisCommand(['HSET', accountKey(subject), 'banned', banned ? '1' : '0']);
  } else {
    const account = localStore.get(subject) || { credits: 0, lastDailyAt: 0, email: normalized };
    account.banned = Boolean(banned);
    localStore.set(subject, account);
  }
  return getUserAccountByEmail(normalized);
}
