// Vercel serverless function: POST /api/chat
// Required environment variable: GOOGLE_API_KEY
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const { message, history } = request.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return response.status(400).json({ error: 'Message is required.' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'AI is not configured yet.' });
  }

  const systemPrompt = `You are Tactical AI, an expert ReShade preset generation assistant for Tactical Web. Your role:

1. Help users create high-quality ReShade presets by suggesting shaders, parameters, and optimization strategies.
2. Provide specific .fx shader names and numeric values (e.g., "Colorfulness.fx at 1.2 contrast").
3. Tailor advice to specific games (Cyberpunk 2077, Elden Ring, RDR2, etc.) and visual styles (cinematic, vibrant, night, warm, cold, sharp).
4. When asked to generate a preset, respond with a structured .ini-format preset including [PRESET], [Techniques], and [TechniqueSettings] sections.
5. Be concise, knowledgeable, and reference real ReShade shaders. Keep responses under 250 words.
6. Stay in character as a helpful preset engineer. If asked about non-ReShade topics, gently steer back to preset generation.

The website is tacticalweb.online — a ReShade preset generation platform using AI.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am Tactical AI, ready to help with ReShade presets.' }] }
  ];

  // Add conversation history if provided
  if (Array.isArray(history)) {
    history.forEach(msg => {
      if (msg.role && msg.text) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
      }
    });
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', data);
      return response.status(502).json({ error: 'AI request failed. Please try again.' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!reply) {
      return response.status(502).json({ error: 'AI returned an empty response.' });
    }

    return response.status(200).json({ reply });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}