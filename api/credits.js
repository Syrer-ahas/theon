import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { getCreditAccount } from './_credits.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization');
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const token = extractSessionToken(request);
  if (!token) return response.status(401).json({ error: 'Verified sign-in required.', credits: 0 });

  let user = null;
  try {
    user = await verifyGoogleJWT(token);
  } catch (_) {}
  if (!user || !user.sub) {
    return response.status(401).json({ error: 'Invalid or expired session.', credits: 0 });
  }

  try {
    const account = await getCreditAccount(user.sub, user.email);
    return response.status(200).json(account);
  } catch (error) {
    console.error('Credit account error:', error);
    return response.status(503).json({ error: 'Credit service unavailable.', credits: 0 });
  }
}
