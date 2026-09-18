import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { hasPersistentBillingStore } from './_billing.js';
import { publicSiteUrl, stripeConfigured, stripePriceForPlan, stripeRequest } from './_stripe.js';

const VALID_PLANS = new Set(['pro', 'premium', 'enterprise']);

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub || !user?.email) return response.status(401).json({ error: 'Sign in with Google before choosing a plan.' });
  if (!stripeConfigured()) return response.status(503).json({ error: 'Stripe is not configured.' });
  if (!hasPersistentBillingStore()) return response.status(503).json({ error: 'Persistent billing storage must be configured before checkout.' });

  const plan = String(request.body?.plan || '').trim().toLowerCase();
  if (!VALID_PLANS.has(plan)) return response.status(400).json({ error: 'Choose a valid plan.' });
  const priceId = stripePriceForPlan(plan);
  if (!priceId) return response.status(503).json({ error: `The ${plan} Stripe Price ID is not configured.` });

  try {
    const baseUrl = publicSiteUrl();
    const session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      customer_email: user.email,
      client_reference_id: user.sub,
      'metadata[google_subject]': user.sub,
      'metadata[plan]': plan,
      'subscription_data[metadata][google_subject]': user.sub,
      'subscription_data[metadata][plan]': plan,
      allow_promotion_codes: true,
      success_url: `${baseUrl}/account.html?checkout=success`,
      cancel_url: `${baseUrl}/pro.html?checkout=cancelled`
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout error:', error.message);
    return response.status(502).json({ error: 'Checkout could not be started. Check your Stripe Price configuration.' });
  }
}
