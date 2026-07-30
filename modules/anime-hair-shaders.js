export const STANDARD_ANISOTROPIC_SHADER = "standard-anisotropic";
export const ANIME_ANISOTROPIC_SHADER = "anime-anisotropic";
export const LAMBERT_SHADER = "lambert";

export function normalizeHairShader(value) {
  if (value === ANIME_ANISOTROPIC_SHADER) return ANIME_ANISOTROPIC_SHADER;
  if (value === LAMBERT_SHADER) return LAMBERT_SHADER;
  return STANDARD_ANISOTROPIC_SHADER;
}

export const ANIME_ANISOTROPIC_DEFAULTS = Object.freeze({
  baseColor: "#dbc2aa",
  shadowColor: "#99675c",
  softShadowColor: "#bd917a",
  highlightColor: "#fff8ec",
  rimColor: "#ffd9cf",
  shadowThreshold: 0.67,
  shadowSoftness: 0.05,
  softShadowStrength: 0.65,
  softShadowSpread: 0.41,
  rimStrength: 0.35,
  rimWidth: 0.3,
  highlightStrength: 0.41,
  highlightWidth: 0.051,
  anisotropy: 0.9,
  highlightJaggedness: 0.16,
  highlightNoiseScale: 69,
  highlightNoiseBlur: 1,
  highlightTopFade: 1,
  highlightTopBlur: 0.72,
  highlightEdgeSuppression: 1
});

export const ANIME_ANISOTROPIC_NUMERIC_FIELDS = Object.freeze({
  animeShadowThreshold: { defaultKey: "shadowThreshold", min: 0, max: 1, digits: 2 },
  animeShadowSoftness: { defaultKey: "shadowSoftness", min: 0, max: 0.25, digits: 2 },
  animeSoftShadowStrength: { defaultKey: "softShadowStrength", min: 0, max: 1, digits: 2 },
  animeSoftShadowSpread: { defaultKey: "softShadowSpread", min: 0, max: 0.5, digits: 2 },
  animeRimStrength: { defaultKey: "rimStrength", min: 0, max: 1, digits: 2 },
  animeRimWidth: { defaultKey: "rimWidth", min: 0.02, max: 1, digits: 2 },
  animeHighlightStrength: { defaultKey: "highlightStrength", min: 0, max: 1, digits: 2 },
  animeHighlightWidth: { defaultKey: "highlightWidth", min: 0.002, max: 0.15, digits: 3 },
  animeAnisotropy: { defaultKey: "anisotropy", min: 0, max: 1, digits: 2 },
  animeHighlightJaggedness: { defaultKey: "highlightJaggedness", min: 0, max: 1, digits: 2 },
  animeHighlightNoiseScale: { defaultKey: "highlightNoiseScale", min: 10, max: 200, digits: 0 },
  animeHighlightNoiseBlur: { defaultKey: "highlightNoiseBlur", min: 0, max: 1, digits: 2 },
  animeHighlightTopFade: { defaultKey: "highlightTopFade", min: 0, max: 1, digits: 2 },
  animeHighlightTopBlur: { defaultKey: "highlightTopBlur", min: 0, max: 1, digits: 2 },
  animeHighlightEdgeSuppression: { defaultKey: "highlightEdgeSuppression", min: 0, max: 1, digits: 2 }
});

function normalizedHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

export function normalizeAnimeAnisotropicSettings(source = {}) {
  const normalized = {
    animeBaseColor: normalizedHexColor(source.animeBaseColor, ANIME_ANISOTROPIC_DEFAULTS.baseColor),
    animeShadowColor: normalizedHexColor(source.animeShadowColor, ANIME_ANISOTROPIC_DEFAULTS.shadowColor),
    animeSoftShadowColor: normalizedHexColor(source.animeSoftShadowColor, ANIME_ANISOTROPIC_DEFAULTS.softShadowColor),
    animeHighlightColor: normalizedHexColor(source.animeHighlightColor, ANIME_ANISOTROPIC_DEFAULTS.highlightColor),
    animeRimColor: normalizedHexColor(source.animeRimColor, ANIME_ANISOTROPIC_DEFAULTS.rimColor)
  };
  Object.entries(ANIME_ANISOTROPIC_NUMERIC_FIELDS).forEach(([key, field]) => {
    const value = source[key] == null ? Number.NaN : Number(source[key]);
    const fallback = ANIME_ANISOTROPIC_DEFAULTS[field.defaultKey];
    normalized[key] = Math.min(field.max, Math.max(field.min, Number.isFinite(value) ? value : fallback));
  });
  return normalized;
}

export const ANIME_ANISOTROPIC_VERTEX_SHADER = `
  attribute vec3 color;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vVertexColor;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vVertexColor = color;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const ANIME_ANISOTROPIC_FRAGMENT_SHADER = `
  precision highp float;

  uniform vec3 uBaseColor;
  uniform vec3 uShadowColor;
  uniform vec3 uSoftShadowColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uRimColor;
  uniform vec3 uSelectionColor;
  uniform vec3 uLightDirection;
  uniform float uShadowThreshold;
  uniform float uShadowSoftness;
  uniform float uSoftShadowStrength;
  uniform float uSoftShadowSpread;
  uniform float uRimStrength;
  uniform float uRimWidth;
  uniform float uHighlightStrength;
  uniform float uHighlightWidth;
  uniform float uAnisotropy;
  uniform float uHighlightJaggedness;
  uniform float uHighlightNoiseScale;
  uniform float uHighlightNoiseBlur;
  uniform float uHighlightTopFade;
  uniform float uHighlightTopBlur;
  uniform float uHighlightEdgeSuppression;
  uniform float uSelectionStrength;
  uniform float uOpacity;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying vec3 vVertexColor;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    float bottom = mix(
      hash21(cell),
      hash21(cell + vec2(1.0, 0.0)),
      blend.x
    );
    float top = mix(
      hash21(cell + vec2(0.0, 1.0)),
      hash21(cell + vec2(1.0, 1.0)),
      blend.x
    );
    return mix(bottom, top, blend.y);
  }

  void main() {
    float faceSign = gl_FrontFacing ? 1.0 : -1.0;
    vec3 normal = normalize(vWorldNormal) * faceSign;
    vec3 lightDirection = normalize(uLightDirection);
    float halfLambert = dot(normal, lightDirection) * 0.5 + 0.5;
    float transitionWidth = max(
      uShadowSoftness,
      fwidth(halfLambert) * 0.75
    );
    float lightBand = smoothstep(
      uShadowThreshold - transitionWidth,
      uShadowThreshold + transitionWidth,
      halfLambert
    );
    vec3 multipliedShadowColor = uBaseColor * uShadowColor;
    vec3 multipliedSoftShadowColor = uBaseColor * uSoftShadowColor;
    vec3 color = mix(multipliedShadowColor, uBaseColor, lightBand);

    vec2 noisePoint = vec2(
      vUv.x * uHighlightNoiseScale,
      vUv.y * uHighlightNoiseScale * 0.18
    );
    float blockNoise = hash21(floor(noisePoint));
    float smoothNoise = valueNoise(noisePoint);
    float sharedNoise = mix(
      blockNoise,
      smoothNoise,
      uHighlightNoiseBlur
    ) * 2.0 - 1.0;
    float softShadowRamp = smoothstep(
      uShadowThreshold - uSoftShadowSpread,
      uShadowThreshold + uSoftShadowSpread,
      halfLambert
    );
    float softShadowMask =
      (1.0 - softShadowRamp) * uSoftShadowStrength;
    color = mix(color, multipliedSoftShadowColor, softShadowMask);

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float shadowMask = 1.0 - lightBand;
    float viewFacing = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
    float rimFacing = 1.0 - viewFacing;
    float rimThreshold = 1.0 - uRimWidth;
    float rimEdge = max(fwidth(rimFacing), 0.0005);
    float shadowRim =
      smoothstep(
        rimThreshold - rimEdge,
        rimThreshold + rimEdge,
        rimFacing
      ) *
      shadowMask *
      uRimStrength;
    vec3 rimLightenColor = max(color, uRimColor);
    color = mix(color, rimLightenColor, shadowRim);

    vec3 halfDirection = normalize(lightDirection + viewDirection);
    vec3 fallbackTangent = vec3(0.0, 1.0, 0.0) -
      normal * dot(vec3(0.0, 1.0, 0.0), normal);
    if (dot(fallbackTangent, fallbackTangent) < 0.001) {
      fallbackTangent = vec3(0.0, 0.0, 1.0) -
        normal * dot(vec3(0.0, 0.0, 1.0), normal);
    }
    fallbackTangent = normalize(fallbackTangent);

    vec3 positionDx = dFdx(vWorldPosition);
    vec3 positionDy = dFdy(vWorldPosition);
    vec2 uvDx = dFdx(vUv);
    vec2 uvDy = dFdy(vUv);
    vec3 uvTangent = positionDx * uvDy.y - positionDy * uvDx.y;
    uvTangent -= normal * dot(uvTangent, normal);
    vec3 strandTangent = dot(uvTangent, uvTangent) > 0.000001
      ? normalize(uvTangent)
      : fallbackTangent;

    float rawAnisotropicCoordinate = dot(strandTangent, halfDirection);
    float worldYCorrelation =
      dFdx(rawAnisotropicCoordinate) * dFdx(vWorldPosition.y) +
      dFdy(rawAnisotropicCoordinate) * dFdy(vWorldPosition.y);
    float verticalOrientation = worldYCorrelation < 0.0 ? -1.0 : 1.0;
    float anisotropicCoordinate =
      rawAnisotropicCoordinate * verticalOrientation;
    float isotropicCoordinate =
      1.0 - max(dot(normal, halfDirection), 0.0) - uHighlightWidth;
    float bandCoordinate = mix(
      isotropicCoordinate,
      anisotropicCoordinate,
      uAnisotropy
    );
    float jaggedWidth = max(
      0.001,
      uHighlightWidth * (
        1.0 + sharedNoise * uHighlightJaggedness
      )
    );
    float highlightEdge = max(fwidth(bandCoordinate), 0.0005);
    float sharpLowerEdge = smoothstep(
      -jaggedWidth - highlightEdge * 0.35,
      -jaggedWidth + highlightEdge * 0.35,
      bandCoordinate
    );
    float sharpUpperEdge = 1.0 - smoothstep(
      jaggedWidth - highlightEdge,
      jaggedWidth + highlightEdge,
      bandCoordinate
    );
    float fadeStart = mix(
      jaggedWidth * 0.75,
      -jaggedWidth * 0.15,
      uHighlightTopFade
    );
    float fadeSpan = max(
      highlightEdge,
      jaggedWidth * mix(0.12, 3.0, uHighlightTopBlur)
    );
    float softUpperFade = 1.0 - smoothstep(
      fadeStart,
      fadeStart + fadeSpan,
      bandCoordinate
    );
    float upperProfile = mix(
      sharpUpperEdge,
      softUpperFade,
      uHighlightTopFade
    );
    float highlightMask = sharpLowerEdge * upperProfile;
    float inverseFresnel = smoothstep(0.18, 0.72, viewFacing);
    float highlightEdgeMask = mix(
      1.0,
      inverseFresnel,
      uHighlightEdgeSuppression
    );
    float litHighlight =
      highlightMask *
      lightBand *
      uHighlightStrength *
      highlightEdgeMask;
    vec3 highlightLightenColor = max(color, uHighlightColor);
    color = mix(color, highlightLightenColor, litHighlight);
    color = mix(color, uSelectionColor, uSelectionStrength);

    gl_FragColor = vec4(color * vVertexColor, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
