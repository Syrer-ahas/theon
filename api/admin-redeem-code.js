import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { createRedeemCode } from './_billing.js';

const ADMIN_EMAIL = 'alkhidirea@gmail.com';
const validPlans = new Set(['pro', 'premium', 'enterprise']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const token = extractSessionToken(request);
  const admin = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!admin || normalizeEmail(admin.email) !== ADMIN_EMAIL) {
    return response.status(403).json({ error: 'Administrator access required.' });
  }

  const plan = String(request.body?.plan || '').trim().toLowerCase();
  if (!validPlans.has(plan)) return response.status(400).json({ error: 'Choose a valid subscription plan.' });

  try {
    const code = await createRedeemCode(plan);
    return response.status(200).json({ code, plan });
  } catch (error) {
    console.error('Admin redeem code generation failed:', error);
    return response.status(503).json({ error: 'Code generation is temporarily unavailable.' });
  }
}