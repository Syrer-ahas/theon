import crypto from 'crypto';

const localBilling = globalThis.__TACTICAL_BILLING_STORE__ || new Map();
globalThis.__TACTICAL_BILLING_STORE__ = localBilling;
const localCustomers = globalThis.__TACTICAL_STRIPE_CUSTOMERS__ || new Map();
globalThis.__TACTICAL_STRIPE_CUSTOMERS__ = localCustomers;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function billingKey(subject) {
  return `tactical:billing:v1:${digest(subject)}`;
}

function customerKey(customerId) {
  return `tactical:stripe-customer:v1:${digest(customerId)}`;
}

function redeemCodeKey(code) {
  return `tactical:redeem-code:v1:${digest(code)}`;
}

function redeemClaimKey(code) {
  return `tactical:redeem-claim:v1:${digest(code)}`;
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config) return null;
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error('Persistent billing storage is unavailable.');
  const payload = await response.json();
  if (payload.error) throw new Error('Persistent billing storage rejected the operation.');
  return payload.result;
}

function normalize(record = {}) {
  const status = String(record.status || 'inactive');
  const plan = String(record.plan || 'free');
  return {
    plan: ['active', 'trialing'].includes(status) ? plan : 'free',
    status,
    customerId: String(record.customerId || ''),
    subscriptionId: String(record.subscriptionId || ''),
    priceId: String(record.priceId || ''),
    currentPeriodEnd: Number(record.currentPeriodEnd || 0),
    persistent: Boolean(redisConfig())
  };
}

export function hasPersistentBillingStore() {
  return Boolean(redisConfig());
}

export async function saveBillingAccount(subject, record) {
  if (!subject) throw new Error('A verified user subject is required.');
  const updated = {
    email: String(record.email || '').trim().toLowerCase(),
    customerId: String(record.customerId || ''),
    subscriptionId: String(record.subscriptionId || ''),
    status: String(record.status || 'inactive'),
    plan: String(record.plan || 'free'),
    priceId: String(record.priceId || ''),
    currentPeriodEnd: String(Number(record.currentPeriodEnd || 0)),
    updatedAt: String(Date.now())
  };
  const config = redisConfig();
  if (config) {
    await redisCommand(['HSET', billingKey(subject), ...Object.entries(updated).flat()]);
    if (updated.customerId) await redisCommand(['SET', customerKey(updated.customerId), subject]);
  } else {
    localBilling.set(subject, updated);
    if (updated.customerId) localCustomers.set(updated.customerId, subject);
  }
  return normalize(updated);
}

export async function getBillingAccount(subject) {
  if (!subject) return normalize();
  const config = redisConfig();
  if (!config) return normalize(localBilling.get(subject));
  const values = await redisCommand(['HMGET', billingKey(subject), 'customerId', 'subscriptionId', 'status', 'plan', 'priceId', 'currentPeriodEnd']);
  return normalize({
    customerId: values?.[0], subscriptionId: values?.[1], status: values?.[2],
    plan: values?.[3], priceId: values?.[4], currentPeriodEnd: values?.[5]
  });
}

export async function subjectForStripeCustomer(customerId) {
  if (!customerId) return '';
  const config = redisConfig();
  if (config) return await redisCommand(['GET', customerKey(customerId)]) || '';
  return localCustomers.get(customerId) || '';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REDEEM_CODE_TTL_MS = 24 * 60 * 60 * 1000;

function createCodeValue() {
  const groups = Array.from({ length: 7 }, () => {
    return Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]).join('');
  });
  return `TACT-${groups.join('-')}`;
}

export async function createRedeemCode(plan) {
  const code = createCodeValue();
  const createdAt = Date.now();
  const record = { plan, status: 'available', createdAt: String(createdAt), expiresAt: String(createdAt + REDEEM_CODE_TTL_MS) };
  const config = redisConfig();
  if (config) {
    await redisCommand(['HSET', redeemCodeKey(code), ...Object.entries(record).flat()]);
  } else {
    localBilling.set(redeemCodeKey(code), record);
  }
  return code;
}

export async function redeemCode(code, plan, subject, email) {
  const key = redeemCodeKey(code);
  const config = redisConfig();
  let record;
  if (config) {
    const values = await redisCommand(['HMGET', key, 'plan', 'status', 'expiresAt']);
    record = { plan: values?.[0], status: values?.[1], expiresAt: values?.[2] };
  } else {
    record = localBilling.get(key) || {};
  }
  const expiresAt = Number(record.expiresAt);
  if (record.plan !== plan || record.status !== 'available' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const remainingSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));

  if (config) {
    const claimed = await redisCommand(['SET', redeemClaimKey(code), subject, 'NX', 'EX', String(remainingSeconds)]);
    if (claimed !== 'OK') return false;
  } else {
    const claimKey = redeemClaimKey(code);
    if (localBilling.has(claimKey)) return false;
    localBilling.set(claimKey, subject);
  }

  const updated = { ...record, status: 'redeemed', redeemedBy: subject, redeemedAt: String(Date.now()) };
  if (config) {
    await redisCommand(['HSET', key, ...Object.entries(updated).flat()]);
  } else {
    localBilling.set(key, updated);
  }
  await saveBillingAccount(subject, {
    email,
    status: 'active',
    plan,
    subscriptionId: `redeem:${digest(code).slice(0, 16)}`
  });
  return true;
}
