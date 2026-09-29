// Isolated crystal experiment with shared, authored gem controls.
export const GEM_SHADER = 'gem-experimental';
export const MINT_CRYSTAL_LOOK = Object.freeze({ color: '#189b90', roughness: 0.16, gemFracturing: 0, gemDepthContrast: 0.7, gemInclusions: 0.45, gemInclusionScale: 1, gemFracturingScale: 1, gemPearlescence: 0, gemRainbowReflections: 0, gemFractureDepth: 0.5 });

export function normalizeGemDepth(source = {}) {
  const result = {};
  for (const key of ['gemDepthContrast', 'gemInclusions', 'gemPearlescence', 'gemRainbowReflections', 'gemFractureDepth']) {
    const value = source[key] == null ? NaN : Number(source[key]);
    result[key] = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : MINT_CRYSTAL_LOOK[key];
  }
  return Object.assign(result, normalizeGemScales(source));
}

function normalizeGemScales(source = {}) {
  const result = {};
  for (const key of ['gemInclusionScale', 'gemFracturingScale']) {
    const value = source[key] == null ? NaN : Number(source[key]);
    result[key] = Number.isFinite(value) ? Math.min(5, Math.max(0.1, value)) : MINT_CRYSTAL_LOOK[key];
  }
  return result;
}

export function setGemHairDepth(material, definition) {
  if (material.userData.hairShader !== GEM_SHADER) return;
  const settings = normalizeGemDepth(definition);
  material.userData.gemDepthUniforms.uGemDepthContrast.value = settings.gemDepthContrast;
  material.userData.gemDepthUniforms.uGemInclusions.value = settings.gemInclusions;
  material.userData.gemDepthUniforms.uGemInclusionScale.value = settings.gemInclusionScale;
  material.userData.gemDepthUniforms.uGemFracturingScale.value = settings.gemFracturingScale;
  material.userData.gemDepthUniforms.uGemPearlescence.value = settings.gemPearlescence;
  material.userData.gemDepthUniforms.uGemRainbowReflections.value = settings.gemRainbowReflections;
  material.userData.gemDepthUniforms.uGemFractureDepth.value = settings.gemFractureDepth;
}

export function normalizeGemFracturing(value) {
  const number = value == null ? NaN : Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

export function setGemHairFracturing(material, value) {
  if (material.userData.hairShader === GEM_SHADER) {
    material.userData.gemFracturingUniform.value = normalizeGemFracturing(value);
  }
}

export function applyMintCrystalLook(material) {
  material.shader = GEM_SHADER;
  Object.assign(material, MINT_CRYSTAL_LOOK);
  material.baseColorGradientEnabled = false;
}

// Capture only on disposable pose geometry; source meshes and exports stay untouched.
export function captureGemRestPosition(THREE, geometry) {
  const position = geometry.attributes.position;
  const values = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    values.set([position.getX(i), position.getY(i), position.getZ(i), 1], i * 4);
  }
  geometry.setAttribute('gemRestPosition', new THREE.Float32BufferAttribute(values, 4));
  const normal = geometry.attributes.normal;
  if (normal) geometry.setAttribute('gemRestNormal', normal.clone());
}

export const GEM_SHADER_FUNCTIONS = `
  uniform vec3 uGemLightDirection;
  uniform float uGemFracturing;
  uniform float uGemDepthContrast;
  uniform float uGemInclusions;
  uniform float uGemInclusionScale;
  uniform float uGemFracturingScale;
  uniform float uGemPearlescence;
  uniform float uGemRainbowReflections;
  uniform float uGemFractureDepth;
  uniform mat3 normalMatrix;
  uniform mat4 modelViewMatrix;
  varying vec3 vGemPosition;
  varying float vGemRestEnabled;
  varying vec3 vGemRestNormal;
  varying vec2 vGemFlowCoordinates;

  vec3 gemSafeNormal(vec3 v) {
    return v / max(length(v), 0.00001);
  }
  mat3 gemInverseFrame(mat3 frame) {
    vec3 x = cross(frame[1], frame[2]);
    vec3 y = cross(frame[2], frame[0]);
    vec3 z = cross(frame[0], frame[1]);
    return transpose(mat3(x, y, z)) / dot(frame[0], x);
  }
  float gemHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  // Continuous domain warping bends the seams between irregular 3D cells.
  // Every depth uses this same field so fissures connect through the volume.
  vec4 gemCrackField(vec3 position) {
    vec3 p = position * (12.0 / uGemFracturingScale);
    p += 0.3 * sin(p.yzx * 1.7 + sin(p.zxy * 2.3));
    vec3 cell = floor(p);
    vec3 local = fract(p);
    float first = 100.0;
    float second = 100.0;
    vec3 nearest = vec3(0.0);
    vec3 nextNearest = vec3(0.0);
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 offset = vec3(float(x), float(y), float(z));
          vec3 seed = cell + offset;
          vec3 site = offset + 0.2 + 0.6 * vec3(gemHash(seed), gemHash(seed + 41.3), gemHash(seed + 79.1)) - local;
          float distanceSquared = dot(site, site);
          if (distanceSquared < first) {
            second = first; nextNearest = nearest;
            first = distanceSquared; nearest = site;
          } else if (distanceSquared < second) {
            second = distanceSquared; nextNearest = site;
          }
        }
      }
    }
    float edgeDistance = (second - first) / max(2.0 * length(nextNearest - nearest), 0.00001);
    return vec4(gemSafeNormal(nextNearest - nearest), edgeDistance);
  }
  float gemCrackCoverage(float distanceToEdge, float width, float footprint) {
    float aa = max(footprint, 0.001);
    return (1.0 - smoothstep(width - aa, width + aa, distanceToEdge)) * min(1.0, width / aa);
  }
  float gemFractureDistance(float depth, float sampleFraction) {
    return 0.2 * depth * sampleFraction;
  }
  float gemFractureOpacity(float coverage, float cellStep) {
    return 1.0 - exp(-coverage * cellStep * 18.0);
  }
  float gemFractureTintWeight(float distanceAlongRay) {
    return 0.65 + 0.3 * (1.0 - exp(-distanceAlongRay * 20.0));
  }
  float gemFlash(float alignment, float roughnessValue);
  vec3 gemSpectralTint(float phase);
  float gemFractureGlint(float alignment, float roughnessValue) {
    float core = gemFlash(alignment, min(1.0, roughnessValue + 0.12));
    float shoulder = gemFlash(alignment, min(1.0, roughnessValue + 0.7));
    return max(core, shoulder * 0.85);
  }
  float gemFractureVisibility(float glint) {
    return 0.1 + 0.9 * clamp(glint, 0.0, 1.0);
  }
  vec4 gemFractureReflection(vec3 sheetNormal, vec3 viewDirection, vec3 lightDirection, float roughnessValue, float phase) {
    vec3 reflected = reflect(-viewDirection, sheetNormal);
    float glint = gemFractureGlint(dot(reflected, lightDirection), roughnessValue);
    return vec4((vec3(0.65) + gemSpectralTint(phase + dot(reflected, lightDirection) * 0.65)
      * uGemRainbowReflections * 1.6) * glint, gemFractureVisibility(glint));
  }
  vec3 gemTraceFractures(vec3 origin, vec3 ray, float pixelFootprint, vec3 lightDirection, vec3 tint, float roughnessValue, mat3 patternToView, mat3 patternNormalMatrix) {
    float frequency = 12.0 / uGemFracturingScale;
    vec4 surface = gemCrackField(origin);
    float edge = gemCrackCoverage(surface.w, 0.0035, pixelFootprint * frequency);
    vec3 viewDirection = gemSafeNormal(patternToView * ray);
    vec3 surfaceNormal = gemSafeNormal(patternNormalMatrix * surface.xyz);
    vec4 surfaceReflection = gemFractureReflection(surfaceNormal, viewDirection, lightDirection, roughnessValue, dot(origin, vec3(2.3, 1.7, 2.9)));
    vec3 result = edge * surfaceReflection.a * (mix(vec3(1.0), tint, gemFractureTintWeight(0.0)) * 0.2
      + surfaceReflection.rgb);
    if (uGemFractureDepth <= 0.0) return result;
    float stepSize = gemFractureDistance(uGemFractureDepth, 1.0) / 16.0;
    float transmission = 1.0 - edge * surfaceReflection.a * 0.65;
    // Integrate finite segments through the SAME 3D sheet field, not repeated
    // copies of surface lines. Segment footprint covers thin intersections.
    for (int sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
      float fraction = (float(sampleIndex) + 0.5) / 16.0;
      float distanceAlongRay = gemFractureDistance(uGemFractureDepth, fraction);
      vec4 sheet = gemCrackField(origin - ray * distanceAlongRay);
      float sweptFootprint = stepSize * frequency * abs(dot(ray, sheet.xyz)) * 0.75;
      float footprint = max(pixelFootprint * frequency, sweptFootprint);
      float coverage = gemCrackCoverage(sheet.w, 0.012, footprint);
      float opacity = gemFractureOpacity(coverage, stepSize * frequency);
      vec3 sheetNormal = gemSafeNormal(patternNormalMatrix * sheet.xyz);
      float depthFade = exp(-distanceAlongRay * 8.0);
      vec3 sheetTint = mix(vec3(1.0), tint, gemFractureTintWeight(distanceAlongRay));
      float phase = dot(origin - ray * distanceAlongRay, vec3(2.3, 1.7, 2.9));
      vec4 reflection = gemFractureReflection(sheetNormal, viewDirection, lightDirection, roughnessValue, phase);
      opacity *= reflection.a;
      result += (sheetTint * 0.2 + reflection.rgb) * transmission * opacity * depthFade;
      transmission *= 1.0 - opacity;
    }
    return result / max(1.0, max(result.r, max(result.g, result.b)));
  }
  float gemFlash(float alignment, float roughnessValue) {
    float width = mix(0.012, 0.28, roughnessValue * roughnessValue);
    float aa = max(fwidth(alignment), 0.002);
    return smoothstep(1.0 - width - aa, 1.0 - width * 0.35 + aa, alignment);
  }
  // Broad continuous volumes, evaluated in the same UV-independent space.
  vec3 gemFlowTilt(vec3 position, float layer) {
    float phase = position.x * 12.56637 + sin(position.y * 3.1 + position.z * 4.0 + layer * 1.7) * 1.2 + layer * 2.3;
    return vec3(sin(phase) * 0.72, cos(phase * 0.65 + position.y * 2.0) * 0.22, sin(position.z * 8.0 + phase * 0.4) * 0.35);
  }
  vec4 gemInclusion(vec3 position, float layer) {
    vec3 p = position * (65.0 / uGemInclusionScale) + layer * vec3(2.31, 4.17, 1.83);
    vec3 cell = floor(p);
    vec3 seed = vec3(gemHash(cell), gemHash(cell + 23.1), gemHash(cell + 7.9));
    vec3 center = vec3(0.3) + seed * 0.4;
    vec3 q = (fract(p) - center) / mix(0.12, 0.22, seed.x);
    float distanceToInclusion = length(q);
    float footprint = fwidth(distanceToInclusion);
    float aa = clamp(footprint, 0.08, 0.4);
    // Small spherical specks rather than long dark needles. Fade subpixel
    // specks instead of turning them into large blurry spots at a distance.
    float coverage = (1.0 - smoothstep(0.65, 1.0 + aa, distanceToInclusion)) / max(1.0, footprint);
    return vec4(seed * 2.0 - 1.0, coverage);
  }
  float gemLayerTransmission(float pocket, float contrast) {
    return exp(-contrast * pocket * 1.6);
  }
  float gemRadiantChannel(float channel, float peak) {
    // Lift coloured reflections without lifting weak channels toward white.
    return pow(clamp(channel / max(peak, 0.00001), 0.0, 1.0), 1.35) * min(1.0, peak * 3.2);
  }
  float gemEdgeMask(float facing, float footprint) {
    float aa = clamp(footprint, 0.001, 0.04);
    return 1.0 - smoothstep(0.06 - aa, 0.22 + aa, facing);
  }
  float gemColourGain(float peak) {
    // One gain for all channels keeps bright teal from clipping to cyan.
    return 0.85 / max(0.85, peak);
  }
  float gemSpectralChannel(float phase, float offset) {
    float wave = 0.5 + 0.5 * cos(6.2831853 * (phase + offset));
    return wave * wave;
  }
  float gemShadowChannel(float channel, float peak, float transmission) {
    float saturation = mix(1.35, 1.0, smoothstep(0.1, 0.8, transmission));
    return pow(clamp(channel / max(peak, 0.00001), 0.0, 1.0), saturation) * peak;
  }
  vec3 gemSpectralTint(float phase) {
    return vec3(gemSpectralChannel(phase, 0.0), gemSpectralChannel(phase, 0.3333333), gemSpectralChannel(phase, 0.6666667));
  }
  float gemInternalBand(float alignment, float across, float roughnessValue) {
    // A broad light source reflected inside the crystal: narrow across its
    // axis, extended along it. Roughness widens the band, not its peak energy.
    float sharpness = mix(120.0, 24.0, roughnessValue);
    return smoothstep(0.08, 0.85, exp(-across * across * sharpness)) * smoothstep(-0.2, 0.65, alignment);
  }
  float gemAnisotropicLobe(float along, float across, float facing, float roughnessValue) {
    float longWidth = mix(0.45, 0.8, roughnessValue);
    float shortWidth = mix(0.04, 0.24, roughnessValue);
    float slope = along * along / (longWidth * longWidth) + across * across / (shortWidth * shortWidth);
    return smoothstep(0.08, 0.85, exp(-slope / max(facing * facing, 0.001))) * smoothstep(0.0, 0.15, facing);
  }
`;

export const GEM_SHADER_LIGHTING = `
  vec3 gemN = gemSafeNormal(normal);
  // Match the Anime shader's flow frame; coordinate density is normalized out.
  vec3 gemDx = dFdx(-vViewPosition);
  vec3 gemDy = dFdy(-vViewPosition);
  vec2 gemFlowDx = dFdx(vGemFlowCoordinates);
  vec2 gemFlowDy = dFdy(vGemFlowCoordinates);
  vec3 gemFlowTangent = gemDx * gemFlowDy.y - gemDy * gemFlowDx.y;
  gemFlowTangent -= gemN * dot(gemFlowTangent, gemN);
  vec3 gemFallback = mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0);
  gemFallback -= gemN * dot(gemFallback, gemN);
  if (dot(gemFallback, gemFallback) < 0.000001) {
    gemFallback = cross(gemN, abs(gemN.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0));
  }
  vec3 gemAlong = gemSafeNormal(dot(gemFlowTangent, gemFlowTangent) > 0.000000000001 ? gemFlowTangent : gemFallback);
  vec3 gemAcross = gemSafeNormal(cross(gemN, gemAlong));
  vec3 gemV = isOrthographic ? vec3(0.0, 0.0, 1.0) : gemSafeNormal(vViewPosition);
  vec3 gemL = gemSafeNormal(mat3(viewMatrix) * uGemLightDirection);
  float gemRoughness = clamp(roughnessFactor, 0.0, 1.0);
  // normalMatrix maps model-space normals to view space. Its transpose maps
  // view directions back to model space, including nonuniform object scales.
  vec3 gemRefractedView = -refract(-gemV, gemN, 1.0 / 1.55);
  mat3 gemPatternToView = mat3(modelViewMatrix);
  mat3 gemPatternNormalMatrix = normalMatrix;
  mat3 gemViewToPattern = transpose(normalMatrix);
  // Reconstruct the local rest-to-posed map from surface derivatives. This
  // follows bending/stretching without using UVs to set procedural density.
  vec3 gemRestDx = dFdx(vGemPosition);
  vec3 gemRestDy = dFdy(vGemPosition);
  float gemRestXLength = length(gemRestDx);
  float gemRestYLength = length(gemRestDy);
  vec3 gemRestCross = cross(gemRestDx, gemRestDy);
  vec3 gemViewCross = cross(gemDx, gemDy);
  float gemRestArea = length(gemRestCross);
  float gemViewArea = length(gemViewCross);
  if (vGemRestEnabled > 0.5 && gemRestXLength > 0.00000001 && gemRestYLength > 0.00000001
      && gemRestArea > gemRestXLength * gemRestYLength * 0.0001 && gemViewArea > 0.0000000000000001) {
    // Orient the depth axis consistently on mirrored meshes and backfaces.
    float restSign = dot(gemRestCross, vGemRestNormal) < 0.0 ? -1.0 : 1.0;
    vec3 viewOutward = gl_FrontFacing ? gemN : -gemN;
    float viewSign = dot(gemViewCross, viewOutward) < 0.0 ? -1.0 : 1.0;
    mat3 restFrame = mat3(gemRestDx / gemRestXLength, gemRestDy / gemRestYLength, gemRestCross / gemRestArea * restSign);
    mat3 viewFrame = mat3(gemDx / gemRestXLength, gemDy / gemRestYLength,
      gemViewCross / gemViewArea * viewSign * sqrt(gemViewArea / gemRestArea));
    gemPatternToView = viewFrame * gemInverseFrame(restFrame);
    gemViewToPattern = gemInverseFrame(gemPatternToView);
    gemPatternNormalMatrix = transpose(gemViewToPattern);
  }
  vec3 gemObjectView = gemSafeNormal(gemViewToPattern * gemRefractedView);
  vec3 gemFacet = gemN;
  vec3 gemReflection = reflect(-gemV, gemFacet);
  float gemFacing = clamp(dot(gemN, gemV), 0.0, 1.0);
  float gemFresnel = pow(1.0 - gemFacing, 3.0);
  float gemLighting = clamp(dot(gemFacet, gemL) * 0.5 + 0.5, 0.0, 1.0);
  // Absorption-like dark interiors; retain authored base colour and gradients.
  vec3 gemBase = max(diffuseColor.rgb, vec3(0.0));
  float gemPeak = max(gemBase.r, max(gemBase.g, gemBase.b));
  vec3 gemRadiantTint = vec3(gemRadiantChannel(gemBase.r, gemPeak), gemRadiantChannel(gemBase.g, gemPeak), gemRadiantChannel(gemBase.b, gemPeak));
  float gemThickness = 0.45 + 0.85 * gemFacing;
  vec3 gemAbsorption = exp(-gemThickness * (vec3(1.0) - clamp(gemBase, 0.0, 1.0)) * 1.3);
  vec3 gemBody = mix(gemBase, gemRadiantTint, 0.55) * mix(vec3(1.0), gemAbsorption, 0.45) * mix(0.28, 1.05, smoothstep(0.15, 0.85, gemLighting));
  vec3 gemWorldL = gemSafeNormal(uGemLightDirection);
  vec3 gemWorldSide = gemSafeNormal(cross(gemWorldL, abs(gemWorldL.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 gemKeySide = gemSafeNormal(mat3(viewMatrix) * gemWorldSide);
  vec3 gemFill = gemSafeNormal(mat3(viewMatrix) * (gemWorldL * 0.3 + gemWorldSide * 0.8 + vec3(0.0, 0.35, 0.0)));
  vec3 gemHalf = gemSafeNormal(gemV + gemL);
  vec3 gemFillHalf = gemSafeNormal(gemV + gemFill);
  float gemSpec = gemAnisotropicLobe(dot(gemHalf, gemAlong), dot(gemHalf, gemAcross), dot(gemHalf, gemN), gemRoughness);
  float gemFillSpec = gemAnisotropicLobe(dot(gemFillHalf, gemAlong), dot(gemFillHalf, gemAcross), dot(gemFillHalf, gemN), min(1.0, gemRoughness + 0.2));
  // Sample behind the surface along the model-space viewing ray. All effects
  // use 3D positions; only the existing authored base gradient still uses UVs.
  vec3 gemInside = vec3(0.0);
  vec3 gemDetails = vec3(0.0);
  vec3 gemFractures = vec3(0.0);
  float gemThroughput = 1.0;
  // Derivatives are evaluated outside the uniform branch and ray integration.
  float gemFractureFootprint = max(length(dFdx(vGemPosition)), length(dFdy(vGemPosition)));
  if (uGemFracturing > 0.0) {
    gemFractures = gemTraceFractures(vGemPosition, gemObjectView, gemFractureFootprint, gemL, gemRadiantTint, gemRoughness, gemPatternToView, gemPatternNormalMatrix) * uGemFracturing;
  }
  for (int layer = 1; layer <= 3; layer++) {
    float gemLayer = float(layer);
    vec3 gemLayerPosition = vGemPosition - gemObjectView * (0.025 * gemLayer);
    vec3 gemInternalTilt = gemFlowTilt(gemLayerPosition, gemLayer);
    vec3 gemInternalNormal = gemSafeNormal(gemN + 0.65 * gemSafeNormal(gemPatternNormalMatrix * gemInternalTilt));
    vec3 gemInternalRay = reflect(-gemV, gemInternalNormal);
    float gemInternalFlash = gemInternalBand(dot(gemInternalRay, gemL), dot(gemInternalRay - gemL, gemAcross), gemRoughness);
    float gemInternalFill = gemInternalBand(dot(gemInternalRay, gemFill), dot(gemInternalRay - gemFill, gemAcross), min(1.0, gemRoughness + 0.2));
    vec3 gemLayerTint = mix(gemRadiantTint, gemBase * gemAbsorption, (gemLayer - 1.0) * 0.2);
    // Broad anisotropic highlights must not dissolve the absorbing pockets.
    float gemPocket = smoothstep(0.2, 0.8, gemInternalTilt.x * 0.5 + 0.5);
    vec4 gemFleck = gemInclusion(gemLayerPosition, gemLayer);
    // Near layers occlude the deeper ones instead of adding all light equally.
    // Surface reflections below remain untouched, preserving pale glints over
    // dark interiors. Inclusions move at their own apparent depth, not on skin.
    gemThroughput *= gemLayerTransmission(gemPocket, uGemDepthContrast);
    gemInside += gemLayerTint * (gemInternalFlash + gemInternalFill * 0.45) * (0.85 / gemLayer)
      * gemThroughput;
    // Saturated fire inside the crystal, only where internal reflections catch
    // the light. The refracted sampling path supplies depth and view parallax.
    float gemRainbowPhase = dot(gemLayerPosition, vec3(2.3, 1.7, 2.9))
      + dot(gemInternalRay, gemL) * 0.65 + gemLayer * 0.23;
    gemInside += gemSpectralTint(gemRainbowPhase) * uGemRainbowReflections
      * (gemInternalFlash + gemInternalFill * 0.45) * gemThroughput * (0.8 / gemLayer);
    vec3 gemSparkleNormal = gemSafeNormal(gemN + 0.8 * gemSafeNormal(gemPatternNormalMatrix * gemFleck.xyz));
    vec3 gemSparkleRay = reflect(-gemV, gemSparkleNormal);
    float gemSparkle = gemFlash(dot(gemSparkleRay, gemL), min(1.0, gemRoughness + 0.18))
      + 0.35 * gemFlash(dot(gemSparkleRay, gemFill), min(1.0, gemRoughness + 0.25));
    gemDetails += mix(vec3(1.0), sqrt(gemBase), 0.25) * gemFleck.a * uGemInclusions
      * gemSparkle * (1.6 / gemLayer) * gemThroughput;
  }
  // Small channel-separated glints imply dispersion, without pretending to
  // refract the scene. Confine colour separation to the grazing reflections.
  vec3 gemSpectrum = vec3(
    gemFlash(dot(gemReflection, gemSafeNormal(gemL + gemKeySide * 0.035)), gemRoughness),
    gemSpec,
    gemFlash(dot(gemReflection, gemSafeNormal(gemL - gemKeySide * 0.035)), gemRoughness)
  );
  float gemPolish = mix(1.0, 0.38, gemRoughness);
  // Keep broad reflections colourful; reserve white for the tight glint.
  vec3 gemSurfaceTint = gemRadiantTint;
  float gemWhiteGlint = gemFlash(dot(gemReflection, gemL), gemRoughness * 0.45);
  // Keep a crisp coloured rim; do not narrow the separate spectral Fresnel.
  float gemRim = gemEdgeMask(gemFacing, fwidth(gemFacing));
  vec3 gemEdge = gemRadiantTint * gemRim * (0.22 + 0.5 * gemLighting);
  vec3 gemInterior = gemBody * mix(1.0, gemThroughput, 0.95) + gemInside * gemPolish;
  float gemInteriorPeak = max(gemInterior.r, max(gemInterior.g, gemInterior.b));
  gemInterior = vec3(gemShadowChannel(gemInterior.r, gemInteriorPeak, gemThroughput),
    gemShadowChannel(gemInterior.g, gemInteriorPeak, gemThroughput),
    gemShadowChannel(gemInterior.b, gemInteriorPeak, gemThroughput));
  vec3 gemColour = gemInterior + gemEdge + gemFractures * gemPolish
    + gemSurfaceTint * (gemSpec + gemFillSpec * 0.3) * gemPolish * 0.55;
  // Thin-film-like pastel sheen on the outer surface, separate from interior fire.
  float gemPearlPhase = (1.0 - gemFacing) * 1.35 + dot(vGemPosition, vec3(0.17, 0.11, 0.13));
  vec3 gemPearlTint = mix(vec3(1.0), gemSpectralTint(gemPearlPhase), 0.65);
  gemColour += gemPearlTint * uGemPearlescence * gemPolish
    * (0.3 * gemFresnel + 0.35 * gemSpec + 0.12 * gemFillSpec);
  gemColour *= gemColourGain(max(gemColour.r, max(gemColour.g, gemColour.b)));
  outgoingLight = gemColour + gemDetails * gemPolish
    + vec3(1.0) * gemWhiteGlint * gemPolish * 0.15
    + gemSpectrum * gemFresnel * 0.07 * uGemRainbowReflections;
`;

export function createGemHairMaterial(THREE, options, lightDirection) {
  const { gemFracturing, gemDepthContrast, gemInclusions, gemInclusionScale, gemFracturingScale, gemPearlescence, gemRainbowReflections, gemFractureDepth, ...surfaceOptions } = options;
  const depth = normalizeGemDepth({ gemDepthContrast, gemInclusions, gemInclusionScale, gemFracturingScale, gemPearlescence, gemRainbowReflections, gemFractureDepth });
  // Reuse stock skinning, normal transforms, maps, vertex colours, clipping,
  // alpha and tone mapping. Replace only the final lighting calculation.
  const material = new THREE.MeshStandardMaterial({
    ...surfaceOptions, name: 'HairGemExperimentalMaterial', metalness: 0,
    transparent: false, depthWrite: true, depthTest: true
  });
  material.userData.hairShader = GEM_SHADER;
  // Stock (non-preview) geometry lacks this optional attribute. The explicit
  // zero flag keeps shared materials correct when mixing posed and rigid users.
  material.defaultAttributeValues = { ...material.defaultAttributeValues, gemRestPosition: [0, 0, 0, 0], gemRestNormal: [0, 1, 0] };
  material.userData.gemFracturingUniform = { value: normalizeGemFracturing(gemFracturing) };
  material.userData.gemDepthUniforms = {
    uGemDepthContrast: { value: depth.gemDepthContrast },
    uGemInclusions: { value: depth.gemInclusions },
    uGemInclusionScale: { value: depth.gemInclusionScale },
    uGemFracturingScale: { value: depth.gemFracturingScale },
    uGemPearlescence: { value: depth.gemPearlescence },
    uGemRainbowReflections: { value: depth.gemRainbowReflections },
    uGemFractureDepth: { value: depth.gemFractureDepth }
  };
  material.onBeforeCompile = shader => {
    const vertexAnchor = '#include <project_vertex>';
    const fragmentAnchor = '#include <opaque_fragment>';
    if (!shader.vertexShader.includes(vertexAnchor) || !shader.fragmentShader.includes(fragmentAnchor)) {
      throw new Error('Gem shader: unsupported material shader chunks');
    }
    shader.uniforms.uGemLightDirection = { value: lightDirection };
    shader.uniforms.uGemFracturing = material.userData.gemFracturingUniform;
    Object.assign(shader.uniforms, material.userData.gemDepthUniforms);
    shader.vertexShader = 'attribute vec4 gemRestPosition;\nattribute vec3 gemRestNormal;\nvarying vec3 vGemRestNormal;\nvarying float vGemRestEnabled;\nvarying vec3 vGemPosition;\nvarying vec2 vGemFlowCoordinates;\n' + shader.vertexShader.replace(vertexAnchor, `${vertexAnchor}\nvGemRestEnabled = gemRestPosition.w;\nvGemRestNormal = gemRestNormal;\nvGemPosition = gemRestPosition.w > 0.5 ? gemRestPosition.xyz : transformed;\nvGemFlowCoordinates = uv;`);
    shader.fragmentShader = GEM_SHADER_FUNCTIONS + shader.fragmentShader.replace(fragmentAnchor, GEM_SHADER_LIGHTING + '\n' + fragmentAnchor);
  };
  material.customProgramCacheKey = () => 'ahs-gem-experimental-v25';
  return material;
}
