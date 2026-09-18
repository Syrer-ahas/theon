import { verifyGoogleJWT, extractSessionToken } from './_auth.js';
import { getBillingAccount } from './_billing.js';
import { publicSiteUrl, stripeRequest } from './_stripe.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const token = extractSessionToken(request);
  const user = token ? await verifyGoogleJWT(token).catch(() => null) : null;
  if (!user?.sub) return response.status(401).json({ error: 'Verified sign-in required.' });

  try {
    const billing = await getBillingAccount(user.sub);
    if (!billing.customerId) return response.status(404).json({ error: 'No Stripe billing account exists for this user.' });
    const portal = await stripeRequest('/billing_portal/sessions', {
      customer: billing.customerId,
      return_url: `${publicSiteUrl()}/account.html`
    });
    return response.status(200).json({ url: portal.url });
  } catch (error) {
    console.error('Stripe portal error:', error.message);
    return response.status(502).json({ error: 'Billing management could not be opened.' });
  }
}
