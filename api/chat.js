// Vercel serverless function: POST /api/chat
// Required environment variable: GOOGLE_API_KEY
// Dual mode: conversation + intent detection for preset generation
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

  const systemPrompt = `You are Tactical AI, the chat and intake assistant for Tactical Web. You have TWO modes:

MODE 1 - CONVERSATION: Help users with ReShade advice, answer questions about shaders, optimization, visual styles. Be concise, knowledgeable, under 250 words.

MODE 2 - PRESET INTAKE: When the user wants to GENERATE a preset, guide them to provide:
- Game they're playing
- What kind of look they want (cinematic, vibrant, night, warm, cold, etc.)
- Their PC specs (low-end, mid-range, high-end, ultra)
- Any specific shaders or effects they want

DETECTION RULES:
- If user asks to "generate", "create", "make a preset", "build", or similar — switch to intake mode
- If user asks a general question about ReShade, shaders, optimization, etc. — stay in conversation mode
- If user talks about a specific game + style, start collecting details

OUTPUT FORMAT:
- For conversation mode: respond normally with helpful text
- For intake mode: respond naturally asking for the next missing detail. When ALL details are collected (game, style, hardware), end your response with exactly: [GENERATE:game=GAME|style=STYLE|hardware=HARDWARE|prompt=FULL_PROMPT|presetName=NAME]

Example: "I've got everything I need! Let me generate that preset for you. [GENERATE:game=Cyberpunk 2077|style=cinematic night|hardware=high-end|prompt=Create a cinematic night preset with soft contrast and warm highlights|presetName=Night City Dreams]"

The website is tacticalweb.online — a ReShade preset generation platform.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am Tactical AI, ready to help with ReShade presets and guide users through preset generation.' }] }
  ];

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

    // Check if reply contains a generation trigger
    const genMatch = reply.match(/\[GENERATE:(.*?)\]/);
    if (genMatch) {
      const params = {};
      genMatch[1].split('|').forEach(pair => {
        const [key, ...val] = pair.split('=');
        params[key.trim()] = val.join('=').trim();
      });
      // Return both the reply text and the generation params
      const cleanReply = reply.replace(/\[GENERATE:.*?\]/, '').trim();
      return response.status(200).json({ 
        reply: cleanReply,
        generate: {
          game: params.game || '',
          style: params.style || 'cinematic',
          hardware: params.hardware || 'mid',
          prompt: params.prompt || '',
          presetName: params.presetName || 'Tactical Preset'
        }
      });
    }

    return response.status(200).json({ reply });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}