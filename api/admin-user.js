import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { adjustUserCreditsByEmail, getUserAccountByEmail, setUserBanByEmail } from './_credits.js';

const DEFAULT_ADMIN_EMAIL = 'alkhidirea@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const token = extractSessionToken(request);
  if (!token) return response.status(401).json({ error: 'Administrator sign-in required.' });

  let admin = null;
  try { admin = await verifyGoogleJWT(token); } catch (_) {}
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  if (!admin || normalizeEmail(admin.email) !== adminEmail) {
    return response.status(403).json({ error: 'Administrator access required.' });
  }

  const email = normalizeEmail(request.body?.email);
  const action = String(request.body?.action || 'lookup');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid Google account email.' });
  }
  if (email === adminEmail && (action === 'ban' || action === 'unban')) {
    return response.status(400).json({ error: 'The administrator account cannot be banned.' });
  }

  try {
    let account;
    if (action === 'lookup') {
      account = await getUserAccountByEmail(email);
    } else if (action === 'add' || action === 'remove') {
      const amount = Number(request.body?.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
        return response.status(400).json({ error: 'Enter a whole credit amount from 1 to 100000.' });
      }
      account = await adjustUserCreditsByEmail(email, action === 'add' ? amount : -amount);
    } else if (action === 'ban' || action === 'unban') {
      account = await setUserBanByEmail(email, action === 'ban');
    } else {
      return response.status(400).json({ error: 'Unsupported account action.' });
    }

    if (!account) {
      return response.status(404).json({ error: 'User not found. They must sign in once before they can be managed.' });
    }
    return response.status(200).json({ ok: true, account });
  } catch (error) {
    console.error('Admin user action failed:', error);
    return response.status(503).json({ error: 'User account service unavailable.' });
  }
}
