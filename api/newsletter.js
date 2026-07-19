// Vercel serverless function: POST /api/newsletter
// Required environment variables: RESEND_API_KEY and RESEND_AUDIENCE_ID
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const email = String(request.body?.email || '').trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    return response.status(500).json({ error: 'Newsletter is not configured yet.' });
  }

  try {
    const resendResponse = await fetch(`https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false })
    });
    const result = await resendResponse.json().catch(() => ({}));

    // Resend returns a validation error for an address that is already subscribed.
    // Treat that as a friendly success instead of exposing provider details.
    if (!resendResponse.ok && resendResponse.status !== 409) {
      console.error('Resend newsletter request failed:', result);
      return response.status(502).json({ error: 'We could not save your subscription. Please try again.' });
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Newsletter endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
