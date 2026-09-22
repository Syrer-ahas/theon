import { verifyGoogleJWT, extractSessionToken } from './_auth.js';

const DEFAULT_ADMIN_EMAIL = 'alkhidirea@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const token = extractSessionToken(request);
  const admin = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  if (!admin || normalizeEmail(admin.email) !== adminEmail) {
    return response.status(403).json({ error: 'Administrator access required.' });
  }

  const secure = request.headers?.['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const flags = ['Path=/', 'Max-Age=3600', 'HttpOnly', 'SameSite=Strict'];
  if (secure) flags.push('Secure');
  response.setHeader('Set-Cookie', `tactical-admin-session=${encodeURIComponent(token)}; ${flags.join('; ')}`);
  return response.status(204).end();
}