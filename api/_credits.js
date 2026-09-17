import crypto from 'crypto';

export const DAILY_CREDIT_AMOUNT = 1;
export const GENERATION_COST = 1;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const localStore = globalThis.__TACTICAL_CREDIT_STORE__ || new Map();
globalThis.__TACTICAL_CREDIT_STORE__ = localStore;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function accountKey(subject) {
  if (!subject || typeof subject !== 'string') throw new Error('Verified user subject is required.');
  const digest = crypto.createHash('sha256').update(subject).digest('hex');
  return `tactical:credits:v1:${digest}`;
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
local now = tonumber(ARGV[1])
local amount = tonumber(ARGV[2])
local cooldown = tonumber(ARGV[3])
local granted = 0
if last == 0 or (now - last) >= cooldown then
  credits = credits + amount
  last = now
  granted = amount
  redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
end
return {credits, last, granted}
`;

const CONSUME_SCRIPT = `
local credits = tonumber(redis.call('HGET', KEYS[1], 'credits') or '0')
local last = tonumber(redis.call('HGET', KEYS[1], 'lastDailyAt') or '0')
local now = tonumber(ARGV[1])
local daily = tonumber(ARGV[2])
local cooldown = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local granted = 0
if last == 0 or (now - last) >= cooldown then
  credits = credits + daily
  last = now
  granted = daily
end
if credits < cost then
  redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
  return {0, credits, last, granted}
end
credits = credits - cost
redis.call('HSET', KEYS[1], 'credits', credits, 'lastDailyAt', last)
return {1, credits, last, granted}
`;

function claimLocal(subject, now) {
  const current = localStore.get(subject) || { credits: 0, lastDailyAt: 0 };
  let granted = 0;
  if (current.lastDailyAt === 0 || now - current.lastDailyAt >= DAILY_COOLDOWN_MS) {
    current.credits += DAILY_CREDIT_AMOUNT;
    current.lastDailyAt = now;
    granted = DAILY_CREDIT_AMOUNT;
  }
  localStore.set(subject, current);
  return { ...current, granted };
}

export async function getCreditAccount(subject) {
  const now = Date.now();
  const config = redisConfig();
  let account;
  if (config) {
    const result = await redisCommand(['EVAL', CLAIM_SCRIPT, '1', accountKey(subject), String(now), String(DAILY_CREDIT_AMOUNT), String(DAILY_COOLDOWN_MS)]);
    account = { credits: Number(result[0]), lastDailyAt: Number(result[1]), granted: Number(result[2]) };
  } else {
    account = claimLocal(subject, now);
  }
  return {
    credits: account.credits,
    dailyCredit: DAILY_CREDIT_AMOUNT,
    granted: account.granted,
    lastDailyAt: account.lastDailyAt,
    nextDailyAt: account.lastDailyAt + DAILY_COOLDOWN_MS,
    persistent: Boolean(config)
  };
}

export async function consumeGenerationCredit(subject) {
  const now = Date.now();
  const config = redisConfig();
  if (config) {
    const result = await redisCommand(['EVAL', CONSUME_SCRIPT, '1', accountKey(subject), String(now), String(DAILY_CREDIT_AMOUNT), String(DAILY_COOLDOWN_MS), String(GENERATION_COST)]);
    return {
      ok: Number(result[0]) === 1,
      credits: Number(result[1]),
      lastDailyAt: Number(result[2]),
      granted: Number(result[3])
    };
  }

  const account = claimLocal(subject, now);
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
