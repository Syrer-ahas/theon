// Vercel serverless function: POST /api/newsletter
// Required environment variable: RESEND_API_KEY
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
  if (!apiKey) {
    return response.status(500).json({ error: 'Newsletter is not configured yet.' });
  }

  try {
    // 1. Save the email to Resend's global contacts API endpoint
    const resendResponse = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ email, unsubscribed: false })
    });
    const result = await resendResponse.json().catch(() => ({}));

    // Resend returns a 409 status code for an address that is already subscribed.
    if (!resendResponse.ok && resendResponse.status !== 409) {
      console.error('Resend newsletter request failed:', result);
      return response.status(502).json({ error: 'We could not save your subscription. Please try again.' });
    }

    // 2. AUTOMATION: Fire the welcome email ONLY if they are a brand new subscriber (status 200/201)
    if (resendResponse.ok) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${apiKey}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            from: 'Tactical Dispatch <contact@tacticalweb.online>',
            to: email,
            subject: 'Welcome to Tactical Dispatch ✦',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
                <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -0.05em; margin-bottom: 16px;">Welcome to the list!</h1>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">Thanks for subscribing to Tactical Web updates. You'll be the first to know about new project updates, engine updates, and drops.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="font-size: 12px; color: #888;">You received this because you signed up at tacticalweb.online.</p>
              </div>
            `
          })
        });
      } catch (emailError) {
        // If the email fails to fire, we still want the user to see a successful signup
        console.error('Failed to send welcome email automation:', emailError);
      }
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Newsletter endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}