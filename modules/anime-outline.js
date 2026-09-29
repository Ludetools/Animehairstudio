import { ANIME_ANISOTROPIC_SHADER, ANIME_OUTLINE_MAX_WIDTH, ANIME_OUTLINE_MAX_DEPTH_GAP } from './anime-hair-shaders.js';

// Reserve zero for disabled surfaces in the unsigned-byte metadata attachment.
export function packOutlineDepthGap(settings) {
  return settings?.overlap ? (1 + 254 * settings.depthGap / ANIME_OUTLINE_MAX_DEPTH_GAP) / 255 : 0;
}

// Octahedral normals free one byte for overlap width without another texture.
// Nonzero sign at the axes keeps the negative-Z hemisphere representable.
const OUTLINE_NORMAL_GLSL = `
  float encodeOutlineNormalComponent(float x, float y, float z) {
    float divisor = max(abs(x) + abs(y) + abs(z), 0.00000001);
    x /= divisor;
    y /= divisor;
    float folded = (1.0 - abs(y)) * (x >= 0.0 ? 1.0 : -1.0);
    return (z >= 0.0 ? x : folded) * 0.5 + 0.5;
  }
  float unfoldOutlineNormalComponent(float component, float z) {
    float fold = max(-z, 0.0);
    return component + (component >= 0.0 ? -fold : fold);
  }
`;

// A silhouette mask avoids the split-normal cracks and flat-card failures of
// inverted hulls. RGB stores linear ink colour; alpha stores thickness / max.
export const ANIME_OUTLINE_FRAGMENT_SHADER = `
  uniform sampler2D maskTexture;
  uniform sampler2D depthTexture;
  uniform vec2 texel;
  uniform float pixelRatio;
  uniform float maxWidth;
  #ifdef USE_OUTLINE_OVERLAPS
    ${OUTLINE_NORMAL_GLSL}
    uniform sampler2D surfaceTexture;
    uniform mat4 inverseProjection;
    uniform float perspectiveCamera;
    vec3 viewPosition(vec2 uv, float depth) {
      vec4 p = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      return p.xyz / p.w;
    }
    float overlapWidthScale(float gap, float minimumGap) {
      float cutoff = max(0.001, minimumGap);
      float taperSpan = max(0.02, minimumGap * 0.5);
      return smoothstep(cutoff, cutoff + taperSpan, gap);
    }
  #endif
  const float maskWidthScale = ${ANIME_OUTLINE_MAX_WIDTH.toFixed(1)};
  const float maskThreshold = 0.04 / maskWidthScale;
  varying vec2 vUv;
  vec2 maskPixelUv(vec2 uv) {
    return (floor(uv / texel) + 0.5) * texel;
  }
  float outlineStrokeCoverage(float fullWidthPx, float widthScale, float distancePx, float ratio) {
    float widthPx = fullWidthPx * widthScale;
    float edge = 1.0 - smoothstep(widthPx - 0.65, widthPx + 0.65, distancePx);
    // Keep the body solid while it narrows; fade only the final subpixel ink.
    return edge * min(1.0, widthScale * max(1.0, fullWidthPx * ratio));
  }
  void main() {
    vec2 centerUv = maskPixelUv(vUv);
    vec4 center = texture2D(maskTexture, centerUv);
    bool internal = center.a > maskThreshold;
    #ifndef USE_OUTLINE_OVERLAPS
      if (internal) discard;
    #endif
    float centerDepth = texture2D(depthTexture, centerUv).x;
    #ifdef USE_OUTLINE_OVERLAPS
      vec3 centerPosition = viewPosition(centerUv, centerDepth);
      vec3 ray = mix(vec3(0.0, 0.0, -1.0), centerPosition / max(-centerPosition.z, 0.000001), perspectiveCamera);
    #endif
    float coverage = 0.0;
    vec3 ink = vec3(0.0);
    // Half-pixel sampling preserves thin ink even beside a thicker material.
    // Circular rings give round, rather than boxy,
    // corners. Depth rejection keeps ink behind foreground character geometry.
    for (int ring = 0; ring < ${Math.ceil(ANIME_OUTLINE_MAX_WIDTH) + 1}; ring++) {
      float distancePx = 0.5 + float(ring);
      if (distancePx > maxWidth + 0.65) break;
      // Keep arc spacing comparable to the original 4 px / 16-ray kernel.
      // Small widths retain the original cost; wide strokes avoid scalloping.
      float directionCount = max(16.0, ceil(distancePx * 4.0));
      for (int direction = 0; direction < ${Math.ceil((ANIME_OUTLINE_MAX_WIDTH + 0.5) * 4)}; direction++) {
        if (float(direction) >= directionCount) break;
        float angle = float(direction) * 6.2831853072 / directionCount;
        // All semantic data and reconstructed positions belong to this exact
        // texel. Never blend rear hair's ink with a foreground head's depth.
        vec2 sampleUv = maskPixelUv(centerUv + vec2(cos(angle), sin(angle)) * distancePx * pixelRatio * texel);
        if (any(lessThan(sampleUv, vec2(0.0))) || any(greaterThanEqual(sampleUv, vec2(1.0)))) continue;
        vec4 sampleMask = texture2D(maskTexture, sampleUv);
        if (sampleMask.a < maskThreshold) continue;
        float sampleDepth = texture2D(depthTexture, sampleUv).x;
        if (sampleDepth > centerDepth) continue;
        // Smooth the final stroke, not its surface/depth classification. Use
        // the snapped texel's actual distance so rounding cannot widen ink.
        float strokeDistancePx = length((sampleUv - centerUv) / texel) / pixelRatio;
        float strokeWidthPx = sampleMask.a * maskWidthScale;
        float widthScale = 1.0;
        #ifdef USE_OUTLINE_OVERLAPS
          if (internal) {
            vec4 surface = texture2D(surfaceTexture, sampleUv);
            if (surface.a < 0.5 / 255.0) continue;
            vec2 encodedNormal = surface.rg * 2.0 - 1.0;
            vec3 normal = vec3(encodedNormal, 1.0 - abs(encodedNormal.x) - abs(encodedNormal.y));
            normal.xy = vec2(unfoldOutlineNormalComponent(normal.x, normal.z), unfoldOutlineNormalComponent(normal.y, normal.z));
            normal = normalize(normal);
            float denominator = dot(normal, ray);
            if (abs(denominator) < 0.05) continue;
            vec3 foreground = viewPosition(sampleUv, sampleDepth);
            // Intersect the centre ray with the sampled surface's tangent plane.
            // A continuous sloping surface has zero gap, even at wide strokes.
            float gap = dot(normal, centerPosition - foreground) / denominator;
            float minimumGap = max(0.0, (surface.a * 255.0 - 1.0) / 254.0) * ${ANIME_OUTLINE_MAX_DEPTH_GAP.toFixed(1)};
            strokeWidthPx = surface.b * maskWidthScale;
            widthScale = overlapWidthScale(gap, minimumGap);
          }
        #endif
        float strength = outlineStrokeCoverage(strokeWidthPx, widthScale, strokeDistancePx, pixelRatio);
        if (strength > coverage) { coverage = strength; ink = sampleMask.rgb; }
      }
    }
    if (coverage < 0.005) discard;
    gl_FragColor = vec4(ink, coverage);
    #include <colorspace_fragment>
  }
`;

export function animeOutlineSettings(material) {
  const definition = material?.userData?.definition;
  if (material?.userData?.hairShader !== ANIME_ANISOTROPIC_SHADER || !definition?.animeOutlineEnabled) return null;
  return { color: definition.animeOutlineColor, width: definition.animeOutlineWidth,
    overlap: definition.animeOutlineOverlapEnabled, overlapWidth: definition.animeOutlineOverlapWidth ?? definition.animeOutlineWidth,
    depthGap: definition.animeOutlineDepthGap };
}

function isSurface(material) {
  return material && material.visible !== false && material.depthTest !== false
    && material.depthWrite !== false && !material.wireframe
    && (material.uniforms?.uOpacity?.value ?? material.opacity ?? 1) >= 0.99;
}

export function createAnimeOutlineRenderer(THREE) {
  const resources = new WeakMap();

  function dispose(renderer) {
    const state = resources.get(renderer);
    if (!state) return;
    state.target.dispose();
    state.masks.forEach(({ material }) => material.dispose());
    state.quad.geometry.dispose();
    state.quad.material.dispose();
    resources.delete(renderer);
  }

  function createResources(renderer, withOverlaps) {
    const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    const target = new THREE.WebGLRenderTarget(1, 1, {
      // MSAA resolves colour coverage and depth independently. At a head edge
      // that creates impossible records (hair ink, head depth); even bilinear
      // filtering can recreate them. Keep a single nearest surface record.
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      generateMipmaps: false, depthTexture,
      samples: 0, count: withOverlaps ? 2 : 1
    });
    const material = new THREE.ShaderMaterial({
      name: 'AnimeSilhouetteComposite', transparent: true, depthTest: false,
      depthWrite: false, toneMapped: false,
      defines: withOverlaps ? { USE_OUTLINE_OVERLAPS: 1 } : {},
      uniforms: {
        maskTexture: { value: target.texture }, depthTexture: { value: target.depthTexture },
        surfaceTexture: { value: withOverlaps ? target.textures[1] : null },
        inverseProjection: { value: new THREE.Matrix4() }, perspectiveCamera: { value: 1 },
        texel: { value: new THREE.Vector2() }, pixelRatio: { value: 1 }, maxWidth: { value: 1.5 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: ANIME_OUTLINE_FRAGMENT_SHADER
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const overlay = new THREE.Scene();
    overlay.add(quad);
    const state = { target, withOverlaps, masks: new Map(), quad, overlay, camera: new THREE.Camera() };
    resources.set(renderer, state);
    return state;
  }

  function maskFor(state, source) {
    let entry = state.masks.get(source);
    if (!entry) {
      const uniforms = { outlineColor: { value: new THREE.Color() }, outlineWidth: { value: 0 }, outlineDepthGap: { value: 0 }, outlineOverlapWidth: { value: 0 } };
      const material = new THREE.MeshBasicMaterial({ toneMapped: false });
      // Use Three's stock vertex/alpha-test path for morphs, skinning and maps.
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = 'uniform vec3 outlineColor; uniform float outlineWidth;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
          'gl_FragColor = vec4(outlineColor, outlineWidth);');
        if (state.withOverlaps) {
          shader.vertexShader = 'varying vec3 vOutlineViewPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\nvOutlineViewPosition = mvPosition.xyz;');
          shader.fragmentShader = 'varying vec3 vOutlineViewPosition; uniform float outlineDepthGap; uniform float outlineOverlapWidth;\nlayout(location = 1) out highp vec4 outlineSurface;\n' + OUTLINE_NORMAL_GLSL + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4(outlineColor, outlineWidth);', `
            gl_FragColor = vec4(outlineColor, outlineWidth);
            vec3 planeNormal = cross(dFdx(vOutlineViewPosition), dFdy(vOutlineViewPosition));
            planeNormal /= max(length(planeNormal), 0.00000001);
            outlineSurface = vec4(
              encodeOutlineNormalComponent(planeNormal.x, planeNormal.y, planeNormal.z),
              encodeOutlineNormalComponent(planeNormal.y, planeNormal.x, planeNormal.z),
              outlineOverlapWidth, outlineDepthGap);
          `);
        }
        for (const chunk of ['tonemapping_fragment', 'colorspace_fragment', 'premultiplied_alpha_fragment', 'dithering_fragment']) {
          shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, '');
        }
      };
      material.customProgramCacheKey = () => `ahs-anime-silhouette-mask-v3-${state.withOverlaps}`;
      entry = { material, uniforms };
      state.masks.set(source, entry);
    }
    const settings = animeOutlineSettings(source);
    entry.uniforms.outlineColor.value.set(settings?.color || '#000000');
    entry.uniforms.outlineWidth.value = settings ? settings.width / ANIME_OUTLINE_MAX_WIDTH : 0;
    entry.uniforms.outlineDepthGap.value = packOutlineDepthGap(settings);
    entry.uniforms.outlineOverlapWidth.value = settings?.overlap ? settings.overlapWidth / ANIME_OUTLINE_MAX_WIDTH : 0;
    for (const key of ['side', 'map', 'alphaMap', 'alphaTest', 'clippingPlanes', 'clipIntersection']) {
      if (entry.material[key] !== source[key]) {
        entry.material[key] = source[key];
        entry.material.needsUpdate = true;
      }
    }
    entry.material.visible = isSurface(source);
    return entry.material;
  }

  function render(renderer, scene, camera) {
    renderer.render(scene, camera);
    const objects = [], used = new Set();
    let maxWidth = 0;
    let withOverlaps = false;
    scene.traverseVisible(object => {
      if (!(object.isMesh || object.isLine || object.isPoints || object.isSprite)) return;
      objects.push({ object, material: object.material, visible: object.visible, layerMask: object.layers.mask });
      if (!object.isMesh || !object.layers.test(camera.layers)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!isSurface(material)) continue;
        used.add(material);
        const settings = animeOutlineSettings(material);
        maxWidth = Math.max(maxWidth, settings?.width || 0, settings?.overlap ? settings.overlapWidth : 0);
        withOverlaps ||= !!settings?.overlap;
      }
    });
    if (!maxWidth || scene.overrideMaterial) { dispose(renderer); return; }
    if (resources.get(renderer)?.withOverlaps !== withOverlaps) dispose(renderer);
    const state = resources.get(renderer) || createResources(renderer, withOverlaps);
    const target = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getCurrentViewport(new THREE.Vector4());
    const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear, background = scene.background;
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    const restoreObjects = () => objects.forEach(({ object, material, visible, layerMask }) => {
      object.material = material; object.visible = visible; object.layers.mask = layerMask;
    });
    state.target.setSize(Math.max(1, viewport.z), Math.max(1, viewport.w));
    const uniforms = state.quad.material.uniforms;
    uniforms.texel.value.set(1 / state.target.width, 1 / state.target.height);
    uniforms.pixelRatio.value = target ? 1 : renderer.getPixelRatio();
    uniforms.maxWidth.value = maxWidth;
    if (withOverlaps) {
      uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.perspectiveCamera.value = camera.isPerspectiveCamera ? 1 : 0;
    }
    try {
      objects.forEach(({ object, material }) => {
        if (!object.isMesh || !(Array.isArray(material) ? material.some(isSurface) : isSurface(material))) {
          object.visible = false; return;
        }
        object.material = Array.isArray(material)
          ? material.map(source => maskFor(state, source)) : maskFor(state, material);
      });
      scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(state.target);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(scene, camera);
      restoreObjects();
      renderer.setRenderTarget(target, face, mip);
      renderer.render(state.overlay, state.camera);
      if (objects.some(({ object }) => object.userData?.selectionOutlineOverlay && object.layers.test(camera.layers))) {
        // Preserve base-scene depth and ancestor visibility. Disabling layers
        // skips parent meshes without hiding their child selection outlines.
        objects.forEach(({ object }) => {
          if (!object.userData?.selectionOutlineOverlay) object.layers.mask = 0;
        });
        renderer.render(scene, camera);
      }
    } finally {
      restoreObjects();
      scene.background = background;
      renderer.setRenderTarget(target, face, mip);
      renderer.setClearColor(clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      state.masks.forEach((entry, source) => {
        if (!used.has(source)) { entry.material.dispose(); state.masks.delete(source); }
      });
    }
  }
  render.dispose = dispose;
  return render;
}
