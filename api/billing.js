import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { getBillingAccount } from './_billing.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub) return response.status(401).json({ error: 'Verified sign-in required.' });
  try {
    return response.status(200).json(await getBillingAccount(user.sub));
  } catch (error) {
    console.error('Billing account error:', error);
    return response.status(503).json({ error: 'Billing information is temporarily unavailable.' });
  }
}
