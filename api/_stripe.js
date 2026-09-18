const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripePriceForPlan(plan) {
  const prices = {
    pro: process.env.STRIPE_PRICE_PRO,
    premium: process.env.STRIPE_PRICE_PREMIUM,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE
  };
  return prices[plan] || '';
}

export function planForStripePrice(priceId) {
  if (!priceId) return '';
  return Object.entries({
    pro: process.env.STRIPE_PRICE_PRO,
    premium: process.env.STRIPE_PRICE_PREMIUM,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE
  }).find(([, configuredPrice]) => configuredPrice === priceId)?.[0] || '';
}

export function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://tacticalweb.online').replace(/\/$/, '');
}

function appendFormValue(form, key, value) {
  if (value === undefined || value === null || value === '') return;
  form.append(key, String(value));
}

export async function stripeRequest(path, values = {}, method = 'POST') {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Stripe is not configured.');

  const form = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => appendFormValue(form, key, value));
  const suffix = method === 'GET' && form.size ? `?${form.toString()}` : '';
  const response = await fetch(`${STRIPE_API_BASE}${path}${suffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' })
    },
    ...(method === 'GET' ? {} : { body: form.toString() })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'Stripe rejected the request.';
    throw new Error(message);
  }
  return payload;
}

export function subscriptionSummary(subscription) {
  const item = subscription?.items?.data?.[0];
  const priceId = item?.price?.id || '';
  return {
    customerId: typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || '',
    subscriptionId: subscription?.id || '',
    status: subscription?.status || 'inactive',
    plan: subscription?.metadata?.plan || planForStripePrice(priceId) || 'free',
    priceId,
    currentPeriodEnd: Number(item?.current_period_end || subscription?.current_period_end || 0)
  };
}
