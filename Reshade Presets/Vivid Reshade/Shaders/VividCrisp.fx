/*
    Vivid Crisp — lightweight ReShade effect
    One fullscreen pass, no depth access, no extra render targets.
    Color controls are fused into the same pixel shader as optional sharpening
    and a small 3x3 bloom tap, so disabled options add no sampling cost.
*/

uniform bool EnableColor <
    ui_label = "Enable color grading";
> = true;

uniform bool EnableSharpen <
    ui_label = "Enable detail sharpening";
> = true;

uniform bool EnableGlow <
    ui_label = "Enable subtle glow";
> = false;

uniform float Saturation <
    ui_label = "Saturation";
    ui_min = 0.0; ui_max = 2.0; ui_step = 0.01;
> = 1.18;

uniform float Vibrance <
    ui_label = "Vibrance";
    ui_min = -1.0; ui_max = 1.0; ui_step = 0.01;
> = 0.16;

uniform float Contrast <
    ui_label = "Contrast";
    ui_min = 0.5; ui_max = 1.5; ui_step = 0.01;
> = 1.06;

uniform float Brightness <
    ui_label = "Brightness";
    ui_min = -0.25; ui_max = 0.25; ui_step = 0.005;
> = 0.0;

uniform float Gamma <
    ui_label = "Gamma";
    ui_min = 0.5; ui_max = 1.5; ui_step = 0.01;
> = 1.0;

uniform float Temperature <
    ui_label = "Warm / cool";
    ui_min = -0.25; ui_max = 0.25; ui_step = 0.005;
> = 0.0;

uniform float Tint <
    ui_label = "Magenta / green tint";
    ui_min = -0.15; ui_max = 0.15; ui_step = 0.005;
> = 0.0;

uniform float SharpenStrength <
    ui_label = "Sharpen strength";
    ui_min = 0.0; ui_max = 1.0; ui_step = 0.01;
> = 0.38;

uniform float SharpenClamp <
    ui_label = "Sharpen halo limit";
    ui_min = 0.005; ui_max = 0.12; ui_step = 0.001;
> = 0.035;

uniform float GlowStrength <
    ui_label = "Glow strength";
    ui_min = 0.0; ui_max = 1.0; ui_step = 0.01;
> = 0.18;

uniform float GlowThreshold <
    ui_label = "Glow brightness threshold";
    ui_min = 0.0; ui_max = 2.0; ui_step = 0.01;
> = 0.82;

uniform int GlowRadius <
    ui_label = "Glow radius (pixels)";
    ui_min = 1; ui_max = 3;
> = 1;

texture2D BackBufferTex : COLOR;
sampler2D BackBuffer
{
    Texture = BackBufferTex;
    AddressU = CLAMP;
    AddressV = CLAMP;
};

float3 SampleColor(float2 uv)
{
    return tex2D(BackBuffer, uv).rgb;
}

float4 VividCrispPS(float4 position : SV_Position, float2 uv : TEXCOORD0) : SV_Target
{
    float3 center = SampleColor(uv);
    float3 color = center;

    if (EnableSharpen && SharpenStrength > 0.0)
    {
        float2 px = float2(BUFFER_RCP_WIDTH, BUFFER_RCP_HEIGHT);
        float3 north = SampleColor(uv + float2(0.0, -px.y));
        float3 south = SampleColor(uv + float2(0.0,  px.y));
        float3 east  = SampleColor(uv + float2( px.x, 0.0));
        float3 west  = SampleColor(uv + float2(-px.x, 0.0));
        float3 detail = center - (north + south + east + west) * 0.25;
        color += clamp(detail * SharpenStrength, -SharpenClamp, SharpenClamp);
    }

    if (EnableGlow && GlowStrength > 0.0)
    {
        float2 px = float2(BUFFER_RCP_WIDTH, BUFFER_RCP_HEIGHT) * (float)GlowRadius;
        float3 bloom = 0.0;
        bloom += max(SampleColor(uv + float2(-px.x, -px.y)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2( 0.0,  -px.y)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2( px.x, -px.y)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2(-px.x,  0.0)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2( px.x,  0.0)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2(-px.x,  px.y)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2( 0.0,   px.y)) - GlowThreshold, 0.0);
        bloom += max(SampleColor(uv + float2( px.x,  px.y)) - GlowThreshold, 0.0);
        color += (bloom * 0.125) * GlowStrength;
    }

    if (EnableColor)
    {
        float luma = dot(color, float3(0.2126, 0.7152, 0.0722));
        float chroma = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
        float vibranceScale = 1.0 + Vibrance * (1.0 - saturate(chroma));
        color = luma + (color - luma) * Saturation * vibranceScale;
        color = (color - 0.5) * Contrast + 0.5 + Brightness;
        color *= float3(1.0 + Temperature, 1.0 + Tint * 0.35, 1.0 - Temperature);
        color = pow(max(color, 0.0), 1.0 / max(Gamma, 0.01));
    }

    return float4(saturate(color), 1.0);
}

technique VividCrisp < ui_label = "Vivid Crisp"; >
{
    pass
    {
        VertexShader = PostProcessVS;
        PixelShader = VividCrispPS;
    }
}
