// Vercel serverless function: GET + POST /api/credits
// Manages server-side credit balances with daily login bonus.
// GET: returns current balance (auto-grants 50 daily credits if 24h elapsed)
// POST: deduct/reset/claim actions
// For production, replace the in-memory Map with Vercel KV, Upstash Redis, or a database.

const creditStore = new Map(); // email -> { credits, lastDailyClaim }
const DEFAULT_CREDITS = 50;
const MIN_CREDITS = 6;
const DAILY_BONUS = 50;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function getStore(email) {
  if (!creditStore.has(email)) {
    creditStore.set(email, { credits: DEFAULT_CREDITS, lastDailyClaim: 0 });
  }
  return creditStore.get(email);
}

function setStore(email, data) {
  creditStore.set(email, data);
}

// Returns the credit balance after potentially granting daily bonus
function getCreditsWithDaily(email) {
  const store = getStore(email);
  const now = Date.now();

  if (store.lastDailyClaim === 0 || (now - store.lastDailyClaim) >= DAILY_COOLDOWN_MS) {
    // First visit or 24h+ elapsed — grant daily bonus
    store.credits = (store.credits || 0) + DAILY_BONUS;
    store.lastDailyClaim = now;
    setStore(email, store);
  }

  return store.credits;
}

function getCreditsRaw(email) {
  return getStore(email).credits;
}

function setCredits(email, credits) {
  const store = getStore(email);
  store.credits = credits;
  setStore(email, store);
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const authHeader = request.headers.authorization || '';
  const sessionToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (request.body?.session || '');

  if (!sessionToken) {
    return response.status(401).json({ error: 'Session token required.' });
  }

  const decoded = decodeJWT(sessionToken);
  if (!decoded || !decoded.email) {
    return response.status(401).json({ error: 'Invalid session token.' });
  }

  const email = decoded.email;
  const now = Date.now();

  if (request.method === 'GET') {
    // GET triggers the daily login check and auto-grants if eligible
    const credits = getCreditsWithDaily(email);
    const store = getStore(email);
    const dailyClaimed = store.lastDailyClaim;
    const nextDailyAt = dailyClaimed + DAILY_COOLDOWN_MS;
    const canClaimDaily = (now - dailyClaimed) >= DAILY_COOLDOWN_MS;

    return response.status(200).json({
      credits,
      dailyBonus: DAILY_BONUS,
      dailyCooldownMs: DAILY_COOLDOWN_MS,
      lastDailyClaim: dailyClaimed,
      nextDailyAt,
      canClaimDaily,
      minCredits: MIN_CREDITS
    });
  }

  if (request.method === 'POST') {
    const { action, cost } = request.body || {};

    if (action === 'deduct') {
      const currentCredits = getCreditsRaw(email);

      if (currentCredits < MIN_CREDITS) {
        return response.status(403).json({
          error: `Insufficient credits. Minimum ${MIN_CREDITS} required, you have ${currentCredits}.`,
          credits: currentCredits
        });
      }

      if (currentCredits < cost) {
        return response.status(403).json({
          error: `Not enough credits. Need ${cost}, have ${currentCredits}.`,
          credits: currentCredits
        });
      }

      const newBalance = currentCredits - cost;
      setCredits(email, newBalance);

      return response.status(200).json({
        credits: newBalance,
        deducted: cost,
        previousCredits: currentCredits
      });
    }

    if (action === 'claim') {
      const store = getStore(email);

      if (store.lastDailyClaim && (now - store.lastDailyClaim) < DAILY_COOLDOWN_MS) {
        const timeLeft = DAILY_COOLDOWN_MS - (now - store.lastDailyClaim);
        const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
        return response.status(429).json({
          error: `Daily credits already claimed. Next available in ~${hoursLeft} hour(s).`,
          credits: store.credits,
          nextDailyAt: store.lastDailyClaim + DAILY_COOLDOWN_MS
        });
      }

      store.credits = (store.credits || 0) + DAILY_BONUS;
      store.lastDailyClaim = now;
      setStore(email, store);

      return response.status(200).json({
        credits: store.credits,
        bonus: DAILY_BONUS,
        message: 'Daily 50 credits claimed!'
      });
    }

    if (action === 'reset') {
      setCredits(email, DEFAULT_CREDITS);
      return response.status(200).json({
        credits: DEFAULT_CREDITS,
        message: 'Credits reset to default.'
      });
    }

    return response.status(400).json({ error: 'Invalid action. Use "deduct", "claim", or "reset".' });
  }

  response.setHeader('Allow', 'GET, POST, OPTIONS');
  return response.status(405).json({ error: 'Method not allowed.' });
}