import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { redeemCode } from './_billing.js';

const planNames = {
  pro: 'Tactical PRO',
  premium: 'Tactical Premium',
  enterprise: 'Tactical Enterprise'
};

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub || !user.email) return response.status(401).json({ error: 'Verified sign-in required.' });

  const code = String(request.body?.code || '').trim().toLowerCase();
  const requestedPlan = String(request.body?.plan || '').trim().toLowerCase();
  if (!/^TACT(?:-[A-Z0-9]{4}){7}$/.test(code.toUpperCase()) || !planNames[requestedPlan]) {
    return response.status(400).json({ error: 'That code is not valid for this plan.' });
  }

  try {
    const redeemed = await redeemCode(code.toUpperCase(), requestedPlan, user.sub, user.email);
    if (!redeemed) return response.status(400).json({ error: 'That code is invalid, already used, or for another plan.' });
    return response.status(200).json({ plan: requestedPlan, planName: planNames[requestedPlan] });
  } catch (error) {
    console.error('Redeem code error:', error);
    return response.status(503).json({ error: 'Code redemption is temporarily unavailable.' });
  }
}