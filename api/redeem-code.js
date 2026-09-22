import crypto from 'crypto';
import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { saveBillingAccount } from './_billing.js';

const planNames = {
  pro: 'Tactical PRO',
  premium: 'Tactical Premium',
  enterprise: 'Tactical Enterprise'
};

function configuredCodes() {
  return new Map(
    String(process.env.TACTICAL_REDEEM_CODES || '')
      .split(',')
      .map((entry) => entry.trim().split('=').map((part) => part.trim().toLowerCase()))
      .filter(([code, plan]) => code && planNames[plan])
  );
}

function codeId(code) {
  return crypto.createHash('sha256').update(code).digest('hex').slice(0, 16);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub || !user.email) return response.status(401).json({ error: 'Verified sign-in required.' });

  const code = String(request.body?.code || '').trim().toLowerCase();
  const requestedPlan = String(request.body?.plan || '').trim().toLowerCase();
  const plan = configuredCodes().get(code);
  if (!plan || plan !== requestedPlan) return response.status(400).json({ error: 'That code is not valid for this plan.' });

  try {
    await saveBillingAccount(user.sub, {
      email: user.email,
      status: 'active',
      plan,
      subscriptionId: `redeem:${codeId(code)}`
    });
    return response.status(200).json({ plan, planName: planNames[plan] });
  } catch (error) {
    console.error('Redeem code error:', error);
    return response.status(503).json({ error: 'Code redemption is temporarily unavailable.' });
  }
}