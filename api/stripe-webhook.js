import crypto from 'crypto';
import { hasPersistentBillingStore, saveBillingAccount, subjectForStripeCustomer } from './_billing.js';
import { stripeRequest, subscriptionSummary } from './_stripe.js';

export const config = { api: { bodyParser: false } };

async function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (typeof request.rawBody === 'string') return Buffer.from(request.rawBody);
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function validStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const fields = String(header).split(',').map((part) => part.split('='));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  return signatures.some((signature) => {
    const left = Buffer.from(signature, 'hex');
    const right = Buffer.from(expected, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  });
}

async function syncSubscription(subscription) {
  const summary = subscriptionSummary(subscription);
  const subject = subscription?.metadata?.google_subject || await subjectForStripeCustomer(summary.customerId);
  if (!subject) return;
  await saveBillingAccount(subject, { ...summary, email: subscription?.metadata?.email || '' });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !hasPersistentBillingStore()) return response.status(503).json({ error: 'Webhook storage or signing secret is not configured.' });

  const rawBody = await rawRequestBody(request);
  if (!validStripeSignature(rawBody, request.headers?.['stripe-signature'], secret)) {
    return response.status(400).json({ error: 'Invalid Stripe signature.' });
  }

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { return response.status(400).json({ error: 'Invalid webhook payload.' }); }

  try {
    if (event.type === 'checkout.session.completed') {
      const checkout = event.data.object;
      const subject = checkout.client_reference_id || checkout.metadata?.google_subject;
      if (subject && checkout.subscription) {
        const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription.id;
        const subscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {}, 'GET');
        await syncSubscription(subscription);
      }
    }
    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await syncSubscription(event.data.object);
    }
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return response.status(500).json({ error: 'Webhook processing failed.' });
  }
}
