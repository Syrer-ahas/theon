import crypto from 'crypto';
import { extractSessionToken, verifyGoogleJWT } from './_auth.js';

const memory = globalThis.__TACTICAL_AFFILIATE_STORE__ || new Map();
globalThis.__TACTICAL_AFFILIATE_STORE__ = memory;

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(command) {
  const store = config();
  if (!store) return null;
  const result = await fetch(store.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!result.ok) throw new Error('Affiliate store is unavailable.');
  const payload = await result.json();
  if (payload.error) throw new Error('Affiliate store rejected the operation.');
  return payload.result;
}

function subjectKey(subject) {
  return crypto.createHash('sha256').update(String(subject)).digest('hex');
}

function codeFor(subject) {
  return `AFF-${subjectKey(subject).slice(0, 10).toUpperCase()}`;
}

function ownerKey(code) { return `tactical:affiliate:owner:${code}`; }
function statsKey(subject) { return `tactical:affiliate:stats:${subjectKey(subject)}`; }
function attributionKey(code, subject) { return `tactical:affiliate:attributed:${code}:${subjectKey(subject)}`; }

async function getCode(subject) {
  const key = statsKey(subject);
  const existing = config() ? await redis(['HGET', key, 'code']) : memory.get(key)?.code;
  return existing || codeFor(subject);
}

async function ensureAffiliate(user) {
  const code = await getCode(user.sub);
  if (config()) {
    await redis(['SET', ownerKey(code), user.sub]);
    await redis(['HSET', statsKey(user.sub), 'code', code, 'email', String(user.email).toLowerCase()]);
  } else {
    const key = statsKey(user.sub);
    const current = memory.get(key) || { code, email: String(user.email).toLowerCase(), referrals: 0 };
    memory.set(key, current);
    memory.set(ownerKey(code), user.sub);
  }
  return code;
}

async function stats(user) {
  const code = await ensureAffiliate(user);
  if (config()) {
    const values = await redis(['HMGET', statsKey(user.sub), 'referrals']);
    return { code, referrals: Number(values?.[0] || 0), reward: 'Tracked referrals' };
  }
  const current = memory.get(statsKey(user.sub)) || {};
  return { code, referrals: Number(current.referrals || 0), reward: 'Tracked referrals' };
}

async function attribute(user, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^AFF-[A-Z0-9]{10}$/.test(normalized)) return { tracked: false, reason: 'invalid_code' };
  const owner = config() ? await redis(['GET', ownerKey(normalized)]) : memory.get(ownerKey(normalized));
  if (!owner || owner === user.sub) return { tracked: false, reason: 'not_eligible' };
  if (config()) {
    const claimed = await redis(['SET', attributionKey(normalized, user.sub), '1', 'NX', 'EX', '31536000']);
    if (claimed !== 'OK') return { tracked: false, reason: 'already_tracked' };
    await redis(['HINCRBY', statsKey(owner), 'referrals', '1']);
  } else {
    const key = attributionKey(normalized, user.sub);
    if (memory.has(key)) return { tracked: false, reason: 'already_tracked' };
    memory.set(key, true);
    const keyStats = statsKey(owner);
    const current = memory.get(keyStats) || { code: normalized, referrals: 0 };
    current.referrals = Number(current.referrals || 0) + 1;
    memory.set(keyStats, current);
  }
  return { tracked: true };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed.' });
  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub || !user.email) return response.status(401).json({ error: 'Verified sign-in required.' });

  try {
    if (request.method === 'GET') return response.status(200).json(await stats(user));
    if (request.body?.action === 'attribute') {
      return response.status(200).json(await attribute(user, request.body.code));
    }
    return response.status(200).json(await stats(user));
  } catch (error) {
    console.error('Affiliate request failed:', error);
    return response.status(503).json({ error: 'Affiliate service is temporarily unavailable.' });
  }
}
