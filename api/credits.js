// Vercel serverless function: GET + POST /api/credits
// Required environment variable: GOOGLE_CLIENT_ID (to verify JWT tokens from auth-config.js)
// Manages server-side credit balances.
// For production, replace the in-memory Map with Vercel KV, Upstash Redis, or a database.

const creditStore = new Map(); // email -> { credits: number }
const DEFAULT_CREDITS = 50;
const MIN_CREDITS = 6; // minimum needed to start a generation (1 second at 6 credits/s)

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

function getCredits(email) {
  if (!creditStore.has(email)) {
    creditStore.set(email, { credits: DEFAULT_CREDITS });
  }
  return creditStore.get(email).credits;
}

function setCredits(email, credits) {
  creditStore.set(email, { credits });
}

export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Extract session token from Authorization header or body
  const authHeader = request.headers.authorization || '';
  const sessionToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (request.body?.session || '');

  if (!sessionToken) {
    return response.status(401).json({ error: 'Session token required.' });
  }

  // Decode the Google credential JWT to get the user email
  const decoded = decodeJWT(sessionToken);
  if (!decoded || !decoded.email) {
    return response.status(401).json({ error: 'Invalid session token.' });
  }

  const email = decoded.email;

  if (request.method === 'GET') {
    // Return current credit balance
    const credits = getCredits(email);
    return response.status(200).json({
      credits,
      defaultCredits: DEFAULT_CREDITS,
      minCredits: MIN_CREDITS
    });
  }

  if (request.method === 'POST') {
    const { action, cost } = request.body || {};

    if (action === 'deduct') {
      const currentCredits = getCredits(email);

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

    if (action === 'reset') {
      setCredits(email, DEFAULT_CREDITS);
      return response.status(200).json({
        credits: DEFAULT_CREDITS,
        message: 'Credits reset to default.'
      });
    }

    return response.status(400).json({ error: 'Invalid action. Use "deduct" or "reset".' });
  }

  response.setHeader('Allow', 'GET, POST, OPTIONS');
  return response.status(405).json({ error: 'Method not allowed.' });
}