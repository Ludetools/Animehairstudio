import { sampleTaperCurve } from './curve-math.js';
const clamp = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
export function bundleMainCurve(curve, taper = 1) {
  return Array.from({length:9},(_,i)=>({position:i/8,
    value: clamp(Array.isArray(curve) ? curve[i]?.value : undefined, Math.pow(1-i/8,taper),0,2), interpolation:'linear'}));
}
export function normalizeStrandBundle(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const layer = (v = {}, fly = false) => ({
    count: Math.round(clamp(v.count, fly ? 10 : 6, 0, 24)),
    width: clamp(v.width, fly ? .035 : .24, .01, .8),
    length: clamp(v.length, fly ? .65 : .95, .1, 1),
    start: clamp(v.start, fly ? .2 : 0, 0, .8),
    follow: clamp(v.follow, fly ? .3 : .9, 0, 1),
    flare: clamp(v.flare, fly ? .7 : .25, 0, 2),
    curl: clamp(v.curl, fly ? .25 : .08, 0, 1),
    // Missing values retain the original placement of saved recipes.
    release: v.release == null ? null : clamp(v.release, .5, 0, .95),
  });
  return { width: clamp(value.width,.35,.02,2), seed: Math.round(clamp(value.seed, 1, 0, 2147483647)), variation: clamp(value.variation,.25,0,1),
    depth: clamp(value.depth,.8,.1,2), taper: clamp(value.taper,1,.2,3),
    widthCurve: bundleMainCurve(value.widthCurve,clamp(value.taper,1,.2,3)),
    depthCurve: bundleMainCurve(value.depthCurve,clamp(value.taper,1,.2,3)),
    medium: layer(value.medium || {}), flyaway: layer(value.flyaway || {},true),
    accents: (Array.isArray(value.accents) ? value.accents : []).slice(0,8).map(normalizeBundleAccent) };
}
export function normalizeBundleAccent(value = {}) {
  const v=value && typeof value==='object' ? value : {};
  return { start:clamp(v.start,.25,0,1), angle:clamp(v.angle,0,-180,180),
    width:clamp(v.width,.3,.02,.8), depth:clamp(v.depth,.65,.1,2),
    length:clamp(v.length,.22,.02,.6), flow:clamp(v.flow,1,-1,1),
    reach:clamp(v.reach,.8,0,3), bend:clamp(v.bend,.35,-2,2) };
}
export function strandBundleTemplate(value) {
  const recipe = normalizeStrandBundle(value);
  const taper = Array.from({length:9},(_,i)=>({position:i/8,value:Math.pow(1-i/8,recipe.taper),interpolation:'linear'}));
  const settings = {taperCurve:taper,depthCurve:taper,taperCurveSecondary:taper,depthCurveSecondary:taper,
    asymmetricWidthCurve:false,asymmetricDepthCurve:false,widthScale:1,depthScale:1,strandRotation:0,twist:0,
    sweepProfile:Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),z:Math.sin(i*Math.PI/4)})),radialSegments:8};
  const strands = [{width:1,depth:recipe.depth,points:[[0,0,0],[0,-.5,0],[0,-1,0]],settings:{...settings,
    taperCurve:recipe.widthCurve,taperCurveSecondary:recipe.widthCurve,
    depthCurve:recipe.depthCurve,depthCurveSecondary:recipe.depthCurve}}];
  for (const [layerIndex, layer] of [recipe.medium,recipe.flyaway].entries()) {
    let state = (recipe.seed ^ (layerIndex ? 0x12345678 : 0x76543210)) >>> 0;
    const random = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; };
    for(let i=0;i<layer.count;i++) {
      const jitter = () => (random()*2-1)*recipe.variation;
      const angle = i/Math.max(1,layer.count)*Math.PI*2+jitter()*.8;
      const start = Math.min(.9,layer.start*(1+jitter()*.5));
      const end = start+(1-start)*Math.min(1,layer.length*(1+jitter()*.3));
      const width = layer.width*(1+jitter()*.35);
      const phase = jitter()*Math.PI, flare = layer.flare*(1+jitter()*.3);
      const pathParameters = Array.from({length:17},(_,j)=>start+(end-start)*j/16);
      const points = pathParameters.map((t,j)=>{
        const u=j/16;
        if (layer.release !== null) {
          const freed = Math.max(0, (u-layer.release)/(1-layer.release));
          const peel = freed*freed*(3-2*freed);
          const emerge = Math.min(1,u/.18);
          const smoothEmerge = emerge*emerge*(3-2*emerge);
          // The generated sweep has a unit-radius profile, not a half-radius one.
          // Begin embedded, then expose the overlapping lock before releasing its tip.
          const surface = .78 + .22*smoothEmerge;
          const envelopeX = sampleTaperCurve(recipe.widthCurve,t);
          const envelopeZ = sampleTaperCurve(recipe.depthCurve,t);
          const radiusX = surface*(envelopeX*layer.follow+(1-layer.follow)) + flare*peel;
          const radiusZ = surface*(envelopeZ*layer.follow+(1-layer.follow)) + flare*peel;
          const a = angle + layer.curl*Math.sin(u*Math.PI)*1.4 + phase*.12*peel;
          return [Math.cos(a)*radiusX,-t,Math.sin(a)*radiusZ*recipe.depth];
        }
        const radiusX=sampleTaperCurve(recipe.widthCurve,t)*.48*layer.follow+.48*(1-layer.follow)+flare*u*u;
        const radiusZ=sampleTaperCurve(recipe.depthCurve,t)*.48*layer.follow+.48*(1-layer.follow)+flare*u*u;
        const a=angle+layer.curl*Math.sin(u*Math.PI)*Math.sin(u*Math.PI+phase)*2;
        return [Math.cos(a)*radiusX,-t,Math.sin(a)*radiusZ*recipe.depth];
      });
      const layerSettings = layer.release === null ? settings : (() => {
        const shape = [layerIndex ? 0 : .2, .72, 1, .92, .78, .58, .36, .15, 0]
          .map((v,j)=>({position:j/8,value:Math.pow(v,recipe.taper),interpolation:'linear'}));
        return {...settings,taperCurve:shape,taperCurveSecondary:shape,depthCurve:shape,depthCurveSecondary:shape};
      })();
      strands.push({width,depth:width*recipe.depth,points,pathParameters,settings:layerSettings});
    }
  }
  for (const accent of recipe.accents) {
    const angle=accent.angle*Math.PI/180;
    const rootX=Math.cos(angle)*sampleTaperCurve(recipe.widthCurve,accent.start)*.8;
    const rootZ=Math.sin(angle)*sampleTaperCurve(recipe.depthCurve,accent.start)*recipe.depth*.8;
    const points=Array.from({length:17},(_,i)=>{
      const u=i/16;
      const lateral=accent.reach*u+accent.bend*Math.sin(Math.PI*u);
      return [rootX+Math.cos(angle)*lateral,-accent.start-accent.flow*accent.length*u,
        rootZ+Math.sin(angle)*lateral];
    });
    const shape=[.12,.7,1,.95,.8,.6,.38,.16,0].map((value,i)=>({position:i/8,value,interpolation:'linear'}));
    // Fixed source frame: this lock bends away independently at its attachment,
    // including against the flow, rather than being forced along the parent axis.
    strands.push({width:accent.width,depth:accent.width*accent.depth,points,
      pathParameters:points.map(()=>accent.start),
      settings:{...settings,taperCurve:shape,taperCurveSecondary:shape,depthCurve:shape,depthCurveSecondary:shape}});
  }
  return {baseWidth:1,bundle:true,strands};
}

// An explicit starter recipe; loading it does not replace existing saved recipes.
export function ponytailBundleRecipe() {
  const curve = values => values.map((value, i) => ({ position: i / 8, value, interpolation: 'linear' }));
  return normalizeStrandBundle({
    width: .34, depth: .95, taper: .9, seed: 12, variation: .3,
    widthCurve: curve([.2, .65, .85, .8, .65, .48, .3, .13, 0]),
    depthCurve: curve([.2, .64, .84, .79, .64, .47, .29, .12, 0]),
    medium: { count: 4, width: .2, length: .85, start: 0, follow: 1, flare: .1, curl: .08, release: .72 },
    flyaway: { count: 0, width: .045, length: .87, start: .04, follow: 1, flare: .8, curl: .32, release: .38 },
    accents: [
      {start:.02,angle:0,width:.32,depth:.65,length:.16,flow:-1,reach:.65,bend:.4},
      {start:.38,angle:180,width:.25,depth:.65,length:.24,flow:1,reach:.65,bend:.2},
    ],
  });
}
