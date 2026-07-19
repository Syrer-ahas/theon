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

  const systemPrompt = `You are a ReShade Preset Engine. Generate a complete preset for the game "${game}".

You MUST respond with ONLY valid JSON in this exact format (no markdown, no code fences, no extra text):
{
  "preset_ini": "...",
  "shader_fx": "..."
}

--- RULES FOR THE .ini FILE ---
1. Remove [PRESET], [Options], and [Includes] sections — ReShade does not use them.
2. In [Techniques], every shader must be set to =1 (e.g., Colorfulness.fx=1, FilmicPass.fx=1, Levels.fx=1, LumaSharpen.fx=1, Vibrance.fx=1, MagicBloom.fx=1, Vignette.fx=1, Curves.fx=1, LiftGammaGain.fx=1). Set Sepia.fx=0.
3. In [TechniqueSettings], the keys MUST match the exact variable names used inside the corresponding .fx shader files (e.g., if the shader uses ColorfulnessIntensity, use ColorfulnessIntensity, not just "Colorfulness").
4. Add a [General] section at the top with PerformanceMode=1.
5. Style: ${style || 'cinematic'} | Severity: ${severity || 'medium'} | Quality: ${quality || 'balanced'} | Hardware: ${hardware || 'mid'} | Palette: ${palette || 'cinematic'}

--- RULES FOR THE .fx FILE (CRITICAL - follow exactly) ---
1. At the very top, before main(), add the standard ReShade backbuffer definitions:
   texture2D BackBuffer : COLOR;
   sampler SamplerColor {
       Texture = BackBuffer;
       Filter = MIN_MAG_MIP_LINEAR;
       AddressU = Clamp;
       AddressV = Clamp;
   };

2. At the top, add uniform float variables that match .ini settings so users can edit them in the menu. Example:
   uniform float SharpnessAmount < ui_name = "Sharpening"; > = 0.5;
   Do this for Contrast, Gamma, Vignette Intensity, etc., and use these variables inside main() instead of hardcoded numbers.

3. The main() function must use: float4 screenColor = tex2D(SamplerColor, input.tex);

4. In main(), update all function calls to match the argument counts defined:
   - LumaSharpen(screenColor.rgb, 0.5) — add the missing amount argument
   - Curves(src, inf, sup, mid) — pass all 4 required arguments
   - Vignette(...) and LiftGammaGain(...) — pass all required arguments

5. At the very bottom, wrap the shader in a proper technique block:
   technique SharpContrast < ui_info = "Sharp Contrast Grade"; > {
       pass Pass1 {
           VertexShader = PostProcessVS;
           PixelShader = main;
       }
   }

At the end of generation, output the two corrected files in the JSON. Return ONLY the JSON object. No explanations, no markdown.`;

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
      // Fallback with complete correct structure
      presetData = {
        preset_ini: `[General]\nPerformanceMode=1\n\n[Techniques]\nColorfulness.fx=1\nFilmicPass.fx=1\nLevels.fx=1\nLumaSharpen.fx=1\nVibrance.fx=1\nMagicBloom.fx=1\nVignette.fx=1\nCurves.fx=1\nLiftGammaGain.fx=1\nSepia.fx=0\n\n[TechniqueSettings]\nColorfulness.fx=\n  ColorfulnessIntensity=1.200000\n  Contrast=1.050000\n  Gamma=1.000000\nFilmicPass.fx=\n  Strength=0.750000\n  Contrast=1.000000\n  Saturation=0.900000\n  Bleach=0.150000\nLevels.fx=\n  BlackPoint=0.060000\n  WhitePoint=0.920000\n  GammaVal=1.000000\nLumaSharpen.fx=\n  pattern=1\n  sharp_strength=0.500000\n  sharp_clamp=0.035000\nVibrance.fx=\n  Vibrance=2.500000\n  VibranceRGBBalance=1.000000,1.000000,1.000000\nMagicBloom.fx=\n  Intensity=0.600000\n  Threshold=0.250000\nVignette.fx=\n  Type=1\n  Center=0.500000,0.500000\n  Radius=0.650000\n  Slope=2.000000\nCurves.fx=\n  Mode=2\n  Formula=4\n  Contrast=1.200000\nLiftGammaGain.fx=\n  Lift=0.000000,0.030000,0.080000\n  Gamma=0.000000,0.000000,0.000000\n  Gain=0.000000,0.000000,0.040000`,
        shader_fx: `#include "ReShade.fxh"\n\ntexture2D BackBuffer : COLOR;\nsampler SamplerColor {\n    Texture = BackBuffer;\n    Filter = MIN_MAG_MIP_LINEAR;\n    AddressU = Clamp;\n    AddressV = Clamp;\n};\n\nuniform float SharpnessAmount < ui_name = "Sharpening"; ui_category = "LumaSharpen"; > = 0.5;\nuniform float ContrastAmount < ui_name = "Contrast"; ui_category = "Colorfulness"; > = 1.05;\nuniform float GammaAmount < ui_name = "Gamma"; ui_category = "Colorfulness"; > = 1.0;\nuniform float VibranceAmount < ui_name = "Vibrance"; ui_category = "Vibrance"; > = 2.5;\nuniform float BloomIntensity < ui_name = "Bloom Intensity"; ui_category = "MagicBloom"; > = 0.6;\nuniform float VignetteRadius < ui_name = "Vignette Radius"; ui_category = "Vignette"; > = 0.65;\nuniform float VignetteSlope < ui_name = "Vignette Slope"; ui_category = "Vignette"; > = 2.0;\nuniform float3 CurvesMidpoint < ui_name = "Curves Midpoint"; ui_category = "Curves"; > = float3(0.5, 0.5, 0.5);\nuniform float3 LiftAmount < ui_name = "Lift"; ui_category = "LiftGammaGain"; > = float3(0.0, 0.03, 0.08);\nuniform float3 GammaAmount2 < ui_name = "Gamma"; ui_category = "LiftGammaGain"; > = float3(0.0, 0.0, 0.0);\nuniform float3 GainAmount < ui_name = "Gain"; ui_category = "LiftGammaGain"; > = float3(0.0, 0.0, 0.04);\n\nfloat4 main(float4 color : SV_Target, float2 texcoord : TEXCOORD0) : SV_Target\n{\n    float4 screenColor = tex2D(SamplerColor, texcoord);\n    float3 col = screenColor.rgb;\n    col *= col * 1.4;\n    col = log(max(col, 0.0001));\n    col = exp(col);\n    col = pow(col, 1.0 / 2.2);\n    col = col * ContrastAmount;\n    col = pow(col, 1.0 / GammaAmount);\n    return float4(col, screenColor.a);\n}\n\ntechnique SharpContrast < ui_info = "Sharp Contrast Grade"; >\n{\n    pass Pass1\n    {\n        VertexShader = PostProcessVS;\n        PixelShader = main;\n    }\n}`
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