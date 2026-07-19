// Vercel serverless function: POST /api/generate
// Required environment variable: GROQ_API_KEY
// Generates a ReShade preset .ini + shader.fx using llama-3.1-8b-instant
// Returns text content; the client builds the .zip with JSZip
// Credit deduction: client sends session JWT + cost, server validates and deducts.

const DEFAULT_CREDITS = 50;
const MIN_CREDITS = 6;
const CREDIT_RATE = 6; // credits per second

// In-memory store for credits. For production, replace with Vercel KV / Redis / DB.
const creditStore = new Map();

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function getCredits(email) {
  if (!creditStore.has(email)) {
    creditStore.set(email, { credits: DEFAULT_CREDITS });
  }
  return creditStore.get(email).credits;
}

function setCredits(email, credits) {
  creditStore.set(email, { credits });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const { game, style, severity, quality, hardware, palette, prompt, presetName, session, cost } = request.body || {};

  if (!game || !prompt) {
    return response.status(400).json({ error: 'Game and prompt are required.' });
  }

  // --- Credit validation (server-side) ---
  if (!session) {
    return response.status(401).json({ error: 'Session token required for generation.' });
  }

  const decoded = decodeJWT(session);
  if (!decoded || !decoded.email) {
    return response.status(401).json({ error: 'Invalid session token.' });
  }

  const email = decoded.email;
  const calculatedCost = Math.max(MIN_CREDITS, (cost || MIN_CREDITS));
  const currentCredits = getCredits(email);

  if (currentCredits < MIN_CREDITS) {
    return response.status(403).json({
      error: `Insufficient credits. Minimum ${MIN_CREDITS} required, you have ${currentCredits}.`,
      creditsRemaining: currentCredits
    });
  }

  if (currentCredits < calculatedCost) {
    return response.status(403).json({
      error: `Not enough credits. Need ${calculatedCost}, have ${currentCredits}.`,
      creditsRemaining: currentCredits,
      cost: calculatedCost
    });
  }

  // Deduct credits BEFORE calling the AI (prevents abuse on failed AI calls too)
  const newBalance = currentCredits - calculatedCost;
  setCredits(email, newBalance);
  // --- End credit validation ---

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Groq API key not configured.' });
  }

  const systemPrompt = `Act as a ReShade v4.0+ Expert. Generate two separate files (Preset.ini and Shader.fx) for a preset named '${presetName || 'Tactical Preset'}' for the game "${game}".

You MUST respond with ONLY valid JSON in this exact format (no markdown, no code fences, no extra text):
{
  "preset_ini": "...",
  "shader_fx": "..."
}

CRITICAL RULES (DO NOT IGNORE):

NO NESTED SECTIONS IN .INI: The .ini file must use a flat list for settings. Do NOT use headers like [Colorfulness.fx] or indentation inside [TechniqueSettings]. Every setting must be on its own line as SettingName=Value.
VARIABLE MATCHING: Every key in the .ini [TechniqueSettings] section must exactly match the name of a uniform variable declared in the .fx file. If the .ini has Sharpness, the .fx must have uniform float Sharpness.
USE THE VARIABLES: The .fx pixel shader main() function must use the declared uniform variables in its math. Do NOT hardcode numbers (e.g., do not write col * 1.5; write col * Sharpness).
MANDATORY SAMPLER: The .fx file must define texture2D BackBuffer : COLOR; and a sampler before main().
TECHNIQUE BLOCK: The .fx file must end with a technique block that links VertexShader = PostProcessVS and PixelShader = main.

FILE 1: preset.ini
Include [General] with PerformanceMode=1.
Include [Techniques] listing standard shaders (e.g., LumaSharpen.fx=1, Curves.fx=1, Vibrance.fx=1) with 1 or 0.
Include [TechniqueSettings] with a flat list of settings. Example format:
[TechniqueSettings]
SharpStrength=0.5
VibranceAmount=2.5
CurvesContrast=1.2
(Do not group them under sub-headers).

FILE 2: shader.fx — APPLY THESE EXACT REQUIREMENTS 1 TO 1:

1. Uniform Annotations: Add the required UI annotations (< ui_type = "slider"; ui_min = ...; ui_max = ...; >) to ALL uniform variables so they appear correctly in the ReShade overlay menu.

2. Luminance Function: Since Luma() is not built-in, define a custom function (e.g., float get_luma(float3 c)) using the standard Rec.709 coefficients: dot(c, float3(0.2126, 0.7152, 0.0722)).

3. Correct Syntax: Use the standard ReShade PostProcessVS vertex shader and ReShade::BackBuffer sampler. Ensure the main function signature matches float4 main(float4 vpos : SV_Position, float2 uv : TEXCOORD) : SV_Target.

4. Formatting: Keep the logic provided in the main function for the processing steps, but ensure the variables are correctly scoped and the syntax is valid HLSL for ReShade.

Style: ${style || 'cinematic'} | Severity: ${severity || 'medium'} | Quality: ${quality || 'balanced'} | Hardware: ${hardware || 'mid'} | Palette: ${palette || 'cinematic'}
User prompt: ${prompt}

Output ONLY the JSON object with preset_ini and shader_fx strings. No explanations, no markdown.`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a preset for ${game}. The user wants: ${prompt}. Style: ${style || 'cinematic'}, Hardware: ${hardware || 'mid'}, Quality: ${quality || 'balanced'}.` }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    const data = await groqResponse.json();
    if (!groqResponse.ok) {
      console.error('Groq API error:', data);
      return response.status(502).json({ error: 'Preset generation failed.' });
    }

    const text = data?.choices?.[0]?.message?.content || '';
    
    let presetData;
    try {
      presetData = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          presetData = JSON.parse(jsonMatch[1].trim());
        } catch { presetData = null; }
      }
    }

    if (!presetData || !presetData.preset_ini) {
      // Fallback with all 4 requirements applied
      presetData = {
        preset_ini: `[General]\nPerformanceMode=1\n\n[Techniques]\nLumaSharpen.fx=1\nCurves.fx=1\nVibrance.fx=1\nColorfulness.fx=1\nFilmicPass.fx=1\nLevels.fx=1\nMagicBloom.fx=1\nVignette.fx=1\nLiftGammaGain.fx=1\nSepia.fx=0\n\n[TechniqueSettings]\nSharpStrength=0.5\nVibranceAmount=2.5\nCurvesContrast=1.2\nColorfulnessIntensity=1.2\nFilmicStrength=0.75\nBlackPoint=0.06\nWhitePoint=0.92\nBloomIntensity=0.6\nVignetteRadius=0.65\nLiftAmount=0.0,0.03,0.08`,
        shader_fx: `#include "ReShade.fxh"\n\n// Custom luminance function using Rec.709 coefficients\nfloat get_luma(float3 c)\n{\n    return dot(c, float3(0.2126, 0.7152, 0.0722));\n}\n\nuniform float SharpStrength <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 2.0;\n    ui_name = "Sharpening Strength";\n> = 0.5;\n\nuniform float VibranceAmount <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 5.0;\n    ui_name = "Vibrance";\n> = 2.5;\n\nuniform float CurvesContrast <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 3.0;\n    ui_name = "Curves Contrast";\n> = 1.2;\n\nuniform float ColorfulnessIntensity <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 3.0;\n    ui_name = "Colorfulness";\n> = 1.2;\n\nuniform float FilmicStrength <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 2.0;\n    ui_name = "Filmic Strength";\n> = 0.75;\n\nuniform float BlackPoint <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 1.0;\n    ui_name = "Black Point";\n> = 0.06;\n\nuniform float WhitePoint <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 1.0;\n    ui_name = "White Point";\n> = 0.92;\n\nuniform float BloomIntensity <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 2.0;\n    ui_name = "Bloom Intensity";\n> = 0.6;\n\nuniform float VignetteRadius <\n    ui_type = "slider";\n    ui_min = 0.0; ui_max = 1.5;\n    ui_name = "Vignette Radius";\n> = 0.65;\n\nuniform float3 LiftAmount <\n    ui_name = "Lift";\n    ui_category = "LiftGammaGain";\n> = float3(0.0, 0.03, 0.08);\n\nfloat4 main(float4 vpos : SV_Position, float2 uv : TEXCOORD) : SV_Target\n{\n    float4 screenColor = tex2D(ReShade::BackBuffer, uv);\n    float3 col = screenColor.rgb;\n    // Black/White point adjustment (Levels)\n    col = saturate((col - BlackPoint) / (WhitePoint - BlackPoint + 0.001));\n    // Colorfulness / contrast boost\n    col = pow(col, 1.0 / (1.0 + CurvesContrast * 0.15));\n    col *= (1.0 + ColorfulnessIntensity * 0.25);\n    // Filmic tone mapping\n    col = saturate(col * (1.0 + FilmicStrength * 0.3) / (col * FilmicStrength * 0.3 + 1.0));\n    // Vibrance boost using custom luminance\n    float luma = get_luma(col);\n    col = lerp(luma, col, 1.0 + VibranceAmount * 0.1);\n    // Bloom simulation (multi-tap blur)\n    float4 blurColor = tex2D(ReShade::BackBuffer, uv * 0.98 + 0.01);\n    blurColor += tex2D(ReShade::BackBuffer, uv * 0.96 + 0.02);\n    blurColor += tex2D(ReShade::BackBuffer, uv * 0.94 + 0.03);\n    blurColor *= 0.333;\n    col += blurColor.rgb * BloomIntensity * 0.15;\n    // Vignette\n    float2 centered = uv - 0.5;\n    float vignette = 1.0 - dot(centered, centered) * 2.0 * (1.0 / max(VignetteRadius * 0.5, 0.001));\n    col *= saturate(vignette);\n    // Lift adjustment\n    col += LiftAmount * 0.05;\n    col = saturate(col);\n    return float4(col, screenColor.a);\n}\n\ntechnique SharpContrast < ui_info = "Sharp Contrast Grade"; >\n{\n    pass Pass1\n    {\n        VertexShader = PostProcessVS;\n        PixelShader = main;\n    }\n}`
      };
    }

    const readmeText = `Tactical Web Preset Package\nGame: ${game}\nPrompt: ${prompt}\nStyle: ${style || 'cinematic'}\nHardware: ${hardware || 'mid'}\nQuality: ${quality || 'balanced'}\n\nInstallation:\n1. Copy preset.ini to your ReShade presets folder\n2. Copy shader.fx to your ReShade shaders folder\n3. Copy the DLL files from the "binaries" folder to your game's root directory\n4. Load the preset in-game\n\nGenerated by Tactical AI (Groq llama-3.1-8b-instant)\n\nREQUIRED DLLs (included in binaries/ folder):\n- dxgi.dll\n- opengl32.dll`;

    return response.status(200).json({
      preset_ini: presetData.preset_ini,
      shader_fx: presetData.shader_fx,
      readme: readmeText,
      presetName: presetName || 'Tactical Preset',
      binaries: ['dxgi.dll', 'opengl32.dll', 'IMPORTANT.txt']
    });

  } catch (error) {
    console.error('Generate endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong during generation.' });
  }
}