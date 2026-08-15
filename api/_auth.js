// Shared strict Google JWT verification for all API endpoints.
// Enforces signature validation (RS256 via Google JWKS), issuer, audience,
// expiry buffer, issued-at window, and email_verified — denies everything else.

import crypto from 'crypto';

const GOOGLE_CLIENT_ID = '794145126379-162ulmelngbk9jq6jhke54q4smp9u3tl.apps.googleusercontent.com';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const KEY_CACHE_MS = 6 * 60 * 60 * 1000; // refresh public keys every 6h
const EXPIRY_BUFFER_MS = 60 * 1000; // token must be valid for ≥60 more seconds
const CLOCK_SKEW_MS = 60 * 1000;

// Cache fetched Google public keys across invocations.
let cachedKeys = null;
let cachedKeysAt = 0;

function base64UrlDecode(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

function base64UrlDecodeString(str) {
  const buf = base64UrlDecode(str);
  return buf ? buf.toString('utf-8') : null;
}

async function getGoogleKeys() {
  const now = Date.now();
  if (cachedKeys && (now - cachedKeysAt) < KEY_CACHE_MS) {
    return cachedKeys;
  }
  try {
    const resp = await fetch(GOOGLE_JWKS_URL);
    if (!resp.ok) return cachedKeys;
    const jwks = await resp.json();
    cachedKeys = jwks.keys || [];
    cachedKeysAt = now;
    return cachedKeys;
  } catch {
    // Fall back to stale cache if a key refresh fails.
    return cachedKeys;
  }
}

/**
 * Strictly verify a Google ID token.
 * Returns the verified payload on success, or null on any failure.
 *
 * Rejects:
 *  - malformed JWT (not 3 parts, bad JSON, non-RS256, missing kid)
 *  - tokens from a non-Google issuer
 *  - tokens whose audience/azp do not match our Google client
 *  - exp missing, non-numeric, already expired, or within 60s of expiry
 *  - iat missing, non-numeric, or issued in the future (clock-skew allowed)
 *  - emails that are not Google-verified
 *  - tokens whose RS256 signature does not verify against Google's JWKS
 */
export async function verifyGoogleJWT(token) {
  if (!token || typeof token !== 'string' || token.includes(' ')) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  const headerRaw = base64UrlDecodeString(headerB64);
  const payloadRaw = base64UrlDecodeString(payloadB64);
  if (!headerRaw || !payloadRaw) return null;

  let header, payload;
  try {
    header = JSON.parse(headerRaw);
    payload = JSON.parse(payloadRaw);
  } catch {
    return null;
  }

  // 1. Algorithm must be RS256, typ JWT, and a kid must be present for key lookup.
  if (!header || header.alg !== 'RS256' || header.typ !== 'JWT' || !header.kid) return null;

  // 2. Issuer must be Google.
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    return null;
  }

  // 3. Audience + authorized-party must match our configured Google client.
  const audOk = Array.isArray(payload.aud)
    ? payload.aud.includes(GOOGLE_CLIENT_ID)
    : payload.aud === GOOGLE_CLIENT_ID;
  if (!audOk || payload.azp !== GOOGLE_CLIENT_ID) return null;

  // 4. Strict expiry: must still be valid for ≥60 seconds.
  if (
    typeof payload.exp !== 'number' ||
    Number.isNaN(payload.exp) ||
    payload.exp * 1000 <= Date.now() + EXPIRY_BUFFER_MS
  ) {
    return null;
  }

  // 5. Issued-at: must not be in the future (beyond clock skew).
  if (
    typeof payload.iat !== 'number' ||
    Number.isNaN(payload.iat) ||
    payload.iat * 1000 > Date.now() + CLOCK_SKEW_MS
  ) {
    return null;
  }

  // 6. Email must be present and Google-verified (STRICT).
  if (!payload.email || typeof payload.email !== 'string' || payload.email.length === 0) {
    return null;
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    return null;
  }

  // 7. Cryptographic signature verification against Google's JWKS (STRICT).
  const keys = await getGoogleKeys();
  if (!keys || !Array.isArray(keys) || keys.length === 0) return null;

  const jwk = keys.find(k => k.kid === header.kid && k.alg === 'RS256' && k.kty === 'RSA' && k.n && k.e);
  if (!jwk) return null;

  try {
    const publicKey = crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
    const signedData = Buffer.from(`${headerB64}.${payloadB64}`, 'utf-8');
    const signature = base64UrlDecode(signatureB64);
    if (!signature) return null;

    const valid = crypto.verify('SHA256', signedData, publicKey, signature);
    if (!valid) return null;
  } catch {
    return null;
  }

  return payload;
}

/**
 * Extract the session token from the Authorization header (preferred) or request body.
 */
export function extractSessionToken(request) {
  const authHeader = request.headers?.authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  // Legacy fallback: allow session in body.
  if (request.body && typeof request.body?.session === 'string' && request.body.session.trim()) {
    return request.body.session.trim();
  }
  return null;
}