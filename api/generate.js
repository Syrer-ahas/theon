// Vercel serverless function: POST /api/generate
// Required environment variable: GROQ_API_KEY
// Generates a ReShade preset .ini + shader.fx using llama-3.1-8b-instant
// Returns text content; the client builds the .zip with JSZip

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const { game, style, severity, quality, hardware, palette, prompt, presetName } = request.body || {};

  if (!game || !prompt) {
    return response.status(400).json({ error: 'Game and prompt are required.' });
  }

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

FILE 2: shader.fx
Start with #include "ReShade.fxh".
Define the mandatory BackBuffer and Sampler.
Declare uniform variables that exactly match the keys in your generated .ini file. Add < ui_name = "..."; > annotations for the menu.
Write the main() function to read the screen color and apply effects using those uniform variables.
End with the technique block.

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
      // Fallback with flat list and matching uniform variables
      presetData = {
        preset_ini: `[General]\nPerformanceMode=1\n\n[Techniques]\nLumaSharpen.fx=1\nCurves.fx=1\nVibrance.fx=1\nColorfulness.fx=1\nFilmicPass.fx=1\nLevels.fx=1\nMagicBloom.fx=1\nVignette.fx=1\nLiftGammaGain.fx=1\nSepia.fx=0\n\n[TechniqueSettings]\nSharpStrength=0.5\nVibranceAmount=2.5\nCurvesContrast=1.2\nColorfulnessIntensity=1.2\nFilmicStrength=0.75\nBlackPoint=0.06\nWhitePoint=0.92\nBloomIntensity=0.6\nVignetteRadius=0.65\nLiftAmount=0.0,0.03,0.08`,
        shader_fx: `#include "ReShade.fxh"\n\ntexture2D BackBuffer : COLOR;\nsampler SamplerColor {\n    Texture = BackBuffer;\n    Filter = MIN_MAG_MIP_LINEAR;\n    AddressU = Clamp;\n    AddressV = Clamp;\n};\n\nuniform float SharpStrength < ui_name = "Sharpening Strength"; > = 0.5;\nuniform float VibranceAmount < ui_name = "Vibrance"; > = 2.5;\nuniform float CurvesContrast < ui_name = "Curves Contrast"; > = 1.2;\nuniform float ColorfulnessIntensity < ui_name = "Colorfulness"; > = 1.2;\nuniform float FilmicStrength < ui_name = "Filmic Strength"; > = 0.75;\nuniform float BloomIntensity < ui_name = "Bloom Intensity"; > = 0.6;\nuniform float VignetteRadius < ui_name = "Vignette Radius"; > = 0.65;\nuniform float3 LiftAmount < ui_name = "Lift"; > = float3(0.0, 0.03, 0.08);\n\nfloat4 main(float4 color : SV_Target, float2 texcoord : TEXCOORD0) : SV_Target\n{\n    float4 screenColor = tex2D(SamplerColor, texcoord);\n    float3 col = screenColor.rgb;\n    col = pow(col, 1.0 / (1.0 + CurvesContrast * 0.1));\n    col *= (1.0 + ColorfulnessIntensity * 0.2);\n    float luma = dot(col, float3(0.299, 0.587, 0.114));\n    col = lerp(luma, col, 1.0 + VibranceAmount * 0.1);\n    float2 centered = texcoord - 0.5;\n    float vignette = 1.0 - dot(centered, centered) * (1.0 / (VignetteRadius * 0.5));\n    col *= saturate(vignette);\n    return float4(col, screenColor.a);\n}\n\ntechnique SharpContrast < ui_info = "Sharp Contrast Grade"; >\n{\n    pass Pass1\n    {\n        VertexShader = PostProcessVS;\n        PixelShader = main;\n    }\n}`
      };
    }

    const readmeText = `Tactical Web Preset Package\nGame: ${game}\nPrompt: ${prompt}\nStyle: ${style || 'cinematic'}\nHardware: ${hardware || 'mid'}\nQuality: ${quality || 'balanced'}\n\nInstallation:\n1. Copy preset.ini to your ReShade presets folder\n2. Copy shader.fx to your ReShade shaders folder\n3. Copy the DLL files from the "binaries" folder to your game's root directory\n4. Load the preset in-game\n\nGenerated by Tactical AI (Groq llama-3.1-8b-instant)\n\nREQUIRED DLLs (included in binaries/ folder):\n- dxgi.dll\n- opengl32.dll`;

    return response.status(200).json({
      preset_ini: presetData.preset_ini,
      shader_fx: presetData.shader_fx,
      readme: readmeText,
      presetName: presetName || 'Tactical Preset',
      binaries: ['dxgi.dll', 'opengl32.dll']
    });

  } catch (error) {
    console.error('Generate endpoint error:', error);
    return response.status(500).json({ error: 'Something went wrong during generation.' });
  }
}