// Imported Curve Union 1.0 dependency closure; do not hand-edit.
// core.js: 97e014827051ece0e1172518498ae59576de2a86c8cff4080c7b54928014db8f
export function createCurveUnionRuntime() {
const requestAnimationFrame = callback => setTimeout(callback, 0);
const EPS = 1e-9;

const v3 = {
  add: (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub: (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  scale: (a,s) => [a[0]*s,a[1]*s,a[2]*s],
  dot: (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len: a => Math.hypot(a[0],a[1],a[2]),
  norm(a) { const l=this.len(a); return l>EPS?this.scale(a,1/l):[0,1,0]; },
  mix: (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]
};

const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));

const ahsSourceMath=(()=>{
const tangentCache=new WeakMap(),integratedEnvelopeCache=new WeakMap();
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
function smoothstep(value, minimum, maximum) {
  const amount = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return amount * amount * (3 - 2 * amount);
}
function smoothTaperTangents(curve) {
  const signature = curve.map((point) => `${point.position}:${point.value}`).join("|");
  const cached = tangentCache.get(curve);
  if (cached?.signature === signature) return cached.tangents;
  const intervals = curve.slice(0, -1).map((point, index) => Math.max(0.0001, curve[index + 1].position - point.position));
  const slopes = intervals.map((interval, index) => (curve[index + 1].value - curve[index].value) / interval);
  const tangents = curve.map((point, index) => {
    if (index === 0) return slopes[0] || 0;
    if (index === curve.length - 1) return slopes.at(-1) || 0;
    const before = slopes[index - 1];
    const after = slopes[index];
    if (!before || !after || Math.sign(before) !== Math.sign(after)) return 0;
    const beforeWeight = 2 * intervals[index] + intervals[index - 1];
    const afterWeight = intervals[index] + 2 * intervals[index - 1];
    return (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
  });
  tangentCache.set(curve, { signature, tangents });
  return tangents;
}
function sampleTaperCurve(curve, t) {
  if (!curve?.length) return 1;
  const clampedT = clamp(t, 0, 1);
  const rightIndex = curve.findIndex((point) => point.position >= clampedT);
  if (rightIndex <= 0) return curve[0].value;
  if (rightIndex < 0) return curve.at(-1).value;
  const left = curve[rightIndex - 1];
  const right = curve[rightIndex];
  const span = Math.max(0.0001, right.position - left.position);
  let amount = clamp((clampedT - left.position) / span, 0, 1);
  if (left.interpolation === "constant") amount = 0;
  if (left.interpolation === "smooth") {
    const tangents = smoothTaperTangents(curve);
    const amount2 = amount * amount;
    const amount3 = amount2 * amount;
    const value = (2 * amount3 - 3 * amount2 + 1) * left.value
      + (amount3 - 2 * amount2 + amount) * span * tangents[rightIndex - 1]
      + (-2 * amount3 + 3 * amount2) * right.value
      + (amount3 - amount2) * span * tangents[rightIndex];
    return clamp(value, Math.min(left.value, right.value), Math.max(left.value, right.value));
  }
  return lerp(left.value, right.value, amount);
}
function sampleIntegratedEnvelopeCurve(curve, t, sampleCount = 128) {
  if (!curve?.length) return 0;
  const count = Math.max(16, Math.round(Number(sampleCount) || 128));
  const signature = `${count}|${curve.map((point) => (
    `${point.position}:${point.value}:${point.interpolation}`
  )).join("|")}`;
  let cached = integratedEnvelopeCache.get(curve);
  if (cached?.signature !== signature) {
    const cumulative = [0];
    let previous = sampleTaperCurve(curve, 0);
    for (let index = 1; index <= count; index += 1) {
      const current = sampleTaperCurve(curve, index / count);
      cumulative.push(cumulative.at(-1) + (previous + current) * 0.5 / count);
      previous = current;
    }
    cached = { signature, cumulative };
    integratedEnvelopeCache.set(curve, cached);
  }
  const scaled = clamp(Number(t), 0, 1) * count;
  const index = Math.floor(scaled);
  const nextIndex = Math.min(count, index + 1);
  return lerp(
    cached.cumulative[index],
    cached.cumulative[nextIndex],
    scaled - index
  );
}
function sampleAsymmetricTaperCurve(
  primaryCurve,
  secondaryCurve,
  asymmetric,
  signedCoordinate,
  t
) {
  const curve = asymmetric && signedCoordinate < 0 && secondaryCurve?.length >= 2
    ? secondaryCurve
    : primaryCurve;
  return sampleTaperCurve(curve, t);
}
function profileTopologyCenterWeight(coordinate, minimum, maximum) {
  const value = Number(coordinate);
  const min = Number(minimum);
  const max = Number(maximum);
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (value < 0) return min < -0.000001 ? clamp(1 - value / min, 0, 1) : 0;
  if (value > 0) return max > 0.000001 ? clamp(1 - value / max, 0, 1) : 0;
  return 1;
}
function uniformCurveParameters(segmentCount, start = 0, end = 1) {
  return Array.from({ length: segmentCount + 1 }, (_, index) => lerp(start, end, index / segmentCount));
}
function symmetricClosedCurveParameters(
  segmentCount,
  symmetryAxisParameter = 0,
  requiredParameters = []
) {
  const count = Math.max(3, Math.round(segmentCount));
  const wrap = (value) => ((Number(value) % 1) + 1) % 1;
  const axis = wrap(symmetryAxisParameter);
  const parameters = Array.from({ length: count }, (_, index) => wrap(axis + index / count));
  requiredParameters.forEach((value) => {
    const parameter = wrap(value);
    parameters.push(parameter, wrap(axis * 2 - parameter));
  });
  return parameters
    .sort((a, b) => a - b)
    .filter((value, index, values) => (
      index === 0 || Math.abs(value - values[index - 1]) > 0.00001
    ));
}
function adaptiveCurveParameters(
  sampler,
  segmentLimit,
  aggression,
  start = 0,
  end = 1,
  minimumSegments = 4,
  profileSampler = null,
  symmetricDistribution = false,
  additionalDetailSampler = null
) {
  const maximum = Math.max(minimumSegments, Math.round(segmentLimit));
  const amount = clamp(Number(aggression ?? 0.5), 0, 1);
  if (
    (amount <= 0.001 || maximum <= minimumSegments)
    && !additionalDetailSampler
  ) return uniformCurveParameters(maximum, start, end);
  const probeCount = Math.max(48, maximum * 4);
  const interval = (end - start) / probeCount;
  const baseWeights = [];
  const additionalWeights = [];
  let baseDetailTotal = 0;
  let additionalDetailTotal = 0;
  const sampleProfile = (t) => {
    const value = Number(profileSampler?.(t));
    return Number.isFinite(value) ? value : 0;
  };
  for (let index = 0; index < probeCount; index += 1) {
    const beforeT = start + interval * index;
    const afterT = start + interval * (index + 1);
    const before = sampler.getTangent(beforeT).normalize();
    const after = sampler.getTangent(afterT).normalize();
    const angleRate = before.angleTo(after) / Math.max(0.0001, interval);
    const curvature = smoothstep(angleRate, 0.2, 3.2);
    let profileDetail = 0;
    if (profileSampler) {
      const middleT = (beforeT + afterT) * 0.5;
      const beforeProfile = sampleProfile(beforeT);
      const middleProfile = sampleProfile(middleT);
      const afterProfile = sampleProfile(afterT);
      const slope = Math.abs(afterProfile - beforeProfile) / Math.max(0.0001, interval);
      const bend = Math.abs(afterProfile - middleProfile * 2 + beforeProfile)
        / Math.max(0.0001, interval * interval);
      profileDetail = Math.max(
        smoothstep(slope, 0.25, 3),
        smoothstep(bend, 0.5, 12)
      );
    }
    const middleT = (beforeT + afterT) * 0.5;
    const additionalDetail = Math.max(
      0,
      Number(additionalDetailSampler?.(beforeT, middleT, afterT, interval)) || 0
    );
    baseDetailTotal += Math.max(curvature, profileDetail);
    additionalDetailTotal += additionalDetail;
    baseWeights.push(
      lerp(1, 0.1, amount)
      + curvature * (0.5 + amount * 4.5)
      + profileDetail * (0.4 + amount * 4)
    );
    additionalWeights.push(additionalDetail);
  }
  const averageDetail = baseDetailTotal / probeCount;
  const retainedRatio = lerp(1, 0.22 + Math.sqrt(averageDetail) * 0.5, amount);
  const baseSegmentCount = clamp(Math.round(maximum * retainedRatio), minimumSegments, maximum);
  const additionalSegmentCount = Math.max(0, Math.ceil(additionalDetailTotal - 0.000001));
  let distributionWeights = baseWeights;
  if (additionalSegmentCount > 0 && additionalDetailTotal > 0.000001) {
    const featherRadius = Math.max(3, Math.round(probeCount * 0.06));
    let featheredAdditionalWeights = additionalWeights.map((weight, index) => {
      let weightedTotal = 0;
      let kernelTotal = 0;
      for (let offset = -featherRadius; offset <= featherRadius; offset += 1) {
        const sampleIndex = index + offset;
        if (sampleIndex < 0 || sampleIndex >= additionalWeights.length) continue;
        const kernelWeight = featherRadius + 1 - Math.abs(offset);
        weightedTotal += additionalWeights[sampleIndex] * kernelWeight;
        kernelTotal += kernelWeight;
      }
      return weightedTotal / Math.max(1, kernelTotal);
    });
    const featheredTotal = featheredAdditionalWeights.reduce((total, weight) => total + weight, 0);
    const featherScale = additionalDetailTotal / Math.max(0.0001, featheredTotal);
    featheredAdditionalWeights = featheredAdditionalWeights.map((weight) => weight * featherScale);
    const symmetricBaseWeights = symmetricDistribution
      ? baseWeights.map((weight, index) => (
        (weight + baseWeights[baseWeights.length - 1 - index]) * 0.5
      ))
      : baseWeights;
    const baseWeightTotal = symmetricBaseWeights.reduce((total, weight) => total + weight, 0);
    distributionWeights = symmetricBaseWeights.map((weight, index) => (
      weight / Math.max(0.0001, baseWeightTotal) * baseSegmentCount
      + featheredAdditionalWeights[index]
    ));
  }
  const segmentCount = baseSegmentCount + additionalSegmentCount;
  const weightedParameter = (weights, fraction) => {
    const cumulative = [0];
    weights.forEach((weight) => cumulative.push(cumulative.at(-1) + weight));
    const target = cumulative.at(-1) * fraction;
    let probeIndex = 1;
    while (probeIndex < cumulative.length - 1 && cumulative[probeIndex] < target) probeIndex += 1;
    const beforeWeight = cumulative[probeIndex - 1];
    const span = Math.max(0.0001, cumulative[probeIndex] - beforeWeight);
    const alpha = (target - beforeWeight) / span;
    return lerp(start, end, (probeIndex - 1 + alpha) / probeCount);
  };
  const parameters = [
    start,
    ...Array.from(
      { length: Math.max(0, segmentCount - 1) },
      (_, index) => weightedParameter(distributionWeights, (index + 1) / segmentCount)
    ),
    end
  ];
  if (symmetricDistribution && additionalSegmentCount === 0) {
    const midpoint = (start + end) * 0.5;
    for (let index = 1; index < Math.floor(parameters.length / 2); index += 1) {
      const oppositeIndex = parameters.length - 1 - index;
      const pairedDistance = (
        (parameters[index] - start)
        + (end - parameters[oppositeIndex])
      ) * 0.5;
      parameters[index] = start + pairedDistance;
      parameters[oppositeIndex] = end - pairedDistance;
    }
    if (parameters.length % 2 === 1) parameters[Math.floor(parameters.length / 2)] = midpoint;
  }
  return parameters;
}
function twistCurveDensityDetail(
  curve,
  beforeT,
  middleT,
  afterT,
  strength = 1,
  referenceSegmentCount = 1
) {
  const influence = clamp(Number(strength) || 0, 0, 1);
  if (influence <= 0.0001 || !curve?.length) return 0;
  const before = sampleTaperCurve(curve, beforeT);
  const middle = sampleTaperCurve(curve, middleT);
  const after = sampleTaperCurve(curve, afterT);
  const span = Math.max(0, Number(afterT) - Number(beforeT));
  const averageMagnitude = (
    Math.abs(before)
    + Math.abs(middle) * 4
    + Math.abs(after)
  ) / 6;
  const referenceDensity = Math.max(1, Number(referenceSegmentCount) || 1);
  const normalizedMagnitude = averageMagnitude / 180;
  const softenedMagnitude = normalizedMagnitude <= 1
    ? Math.sqrt(normalizedMagnitude)
    : normalizedMagnitude;
  const supplementalDensityRatio = softenedMagnitude * 2;
  return influence * supplementalDensityRatio * referenceDensity * span;
}
function sampleArray(values, t, fallback = 0) {
  if (!values?.length) return fallback;
  if (values.length === 1) return values[0];
  const scaled = clamp(t, 0, 1) * (values.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(values.length - 1, index + 1);
  return lerp(values[index], values[next], scaled - index);
}
function sampleScale(scales, t, axis) {
  if (!scales?.length) return 1;
  if (scales.length === 1) return scales[0][axis] || 1;
  const scaled = clamp(t, 0, 1) * (scales.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(scales.length - 1, index + 1);
  return lerp(scales[index][axis] || 1, scales[next][axis] || 1, scaled - index);
}
return {sampleTaperCurve,sampleIntegratedEnvelopeCurve,sampleAsymmetricTaperCurve,profileTopologyCenterWeight,uniformCurveParameters,symmetricClosedCurveParameters,adaptiveCurveParameters,twistCurveDensityDetail,sampleArray,sampleScale};
})();

function sweepPoint(frame,profile){
  const coordinates=[0,1].map(axis=>{
    const value=profile[axis],dimension=axis?'depth':'width',negative=frame[dimension+'Negative']??frame[dimension],positive=frame[dimension+'Positive']??frame[dimension],center=frame[axis?'centerZ':'centerX']||0;
    const bounds=frame.profileBounds?.[axis]||[-1,1];
    return value*(value<0?negative:positive)+center*ahsSourceMath.profileTopologyCenterWeight(value,...bounds);
  });
  return v3.add(frame.c,v3.add(v3.scale(frame.x,coordinates[0]),v3.scale(frame.z,coordinates[1])));
}

function sweepProfileCoordinates(frame,point){
  const delta=v3.sub(point,frame.c);
  return [0,1].map(axis=>{
    const dimension=axis?'depth':'width',center=frame[axis?'centerZ':'centerX']||0,value=v3.dot(delta,axis?frame.z:frame.x)-center,negative=value<0,bounds=frame.profileBounds?.[axis]||[-1,1],extent=bounds[negative?0:1];
    const size=frame[dimension+(negative?'Negative':'Positive')]??frame[dimension];
    return value/Math.max(EPS,size-(Math.abs(extent)>EPS?center/extent:0));
  });
}

function polySignedDistance(x,y,poly){
  let inside=false,min=Infinity;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[j],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],h=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy+EPS));
    min=Math.min(min,Math.hypot(x-(a[0]+dx*h),y-(a[1]+dy*h)));
    if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1]+EPS)+a[0]))inside=!inside;
  }
  return inside?-min:min;
}

function sweepDistance(p,sweep){
  let best=Infinity; const fs=sweep.frames;
  for(let i=0;i<fs.length-1;i++){
    const a=fs[i],b=fs[i+1],ab=v3.sub(b.c,a.c),den=v3.dot(ab,ab),raw=v3.dot(v3.sub(p,a.c),ab)/(den+EPS),u=clamp(raw),c=v3.mix(a.c,b.c,u),d=v3.sub(p,c);
    const x=v3.norm(v3.mix(a.x,b.x,u)),z=v3.norm(v3.mix(a.z,b.z,u)),w=a.width+(b.width-a.width)*u,dep=a.depth+(b.depth-a.depth)*u;
    const [nx,nz]=sweepProfileCoordinates(interpolateSweepFrame(a,b,u),p);
    let sd=polySignedDistance(nx,nz,sweep.profile)*Math.min(w,dep);
    if(i===0&&raw<0)sd=Math.max(sd,-v3.dot(d,a.t));
    if(i===fs.length-2&&raw>1)sd=Math.max(sd,v3.dot(d,b.t));
    if(sd<best)best=sd;
  }
  return best;
}

function boundsOf(sweeps){
  let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const s of sweeps)for(const f of s.frames){const r=Math.max(f.width,f.depth);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],f.c[k]-r);hi[k]=Math.max(hi[k],f.c[k]+r);}}
  const size=v3.sub(hi,lo),pad=Math.max(...size)*.08;return {lo:lo.map(x=>x-pad),hi:hi.map(x=>x+pad)};
}

function sourceSweepMesh(sweep){
  const vertices=[],triangles=[],objFaces=[],n=sweep.profile.length,fs=sweep.frames;
  for(const f of fs)for(const p of sweep.profile)vertices.push(sweepPoint(f,p));
  for(let r=0;r<fs.length-1;r++)for(let j=0;j<n;j++){
    const a=r*n+j,b=r*n+(j+1)%n,c=(r+1)*n+(j+1)%n,d=(r+1)*n+j;
    objFaces.push([a,b,c,d]);triangles.push([a,b,c],[a,c,d]);
  }
  const root=vertices.length,tip=root+1;vertices.push([...fs[0].c],[...fs[fs.length-1].c]);
  const rootFace=[],tipFace=[];
  for(let j=0;j<n;j++){const k=(j+1)%n;triangles.push([root,k,j],[tip,(fs.length-1)*n+j,(fs.length-1)*n+k]);rootFace.unshift(j);tipFace.push((fs.length-1)*n+j);}
  objFaces.push(rootFace,tipFace);
  // Reverse winding without rotating the first corner: rotating a nonplanar
  // quad would change its triangulation diagonal in OBJ/render consumers.
  if(sweep.reconstruction==='ahs-source-parity-v1'){triangles.forEach(f=>f.splice(1,f.length-1,...f.slice(1).reverse()));objFaces.forEach(f=>f.splice(1,f.length-1,...f.slice(1).reverse()));}
  return {vertices,faces:triangles,objFaces,preservedStrands:1,remeshedGroups:0};
}

function sweepsOverlap(a,b){
  for(const fa of a.frames)for(const fb of b.frames){
    const reach=Math.max(fa.width,fa.depth)+Math.max(fb.width,fb.depth);
    if(v3.len(v3.sub(fa.c,fb.c))<reach*.92)return true;
  }
  return false;
}

function overlapGroups(sweeps){
  const parent=sweeps.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const regions=new Set(sweeps.map(s=>s.region)),regionalCharts=sweeps.length>8&&regions.size>1;
  for(let i=0;i<sweeps.length;i++)for(let j=i+1;j<sweeps.length;j++)if((!regionalCharts||sweeps[i].region===sweeps[j].region)&&sweepsOverlap(sweeps[i],sweeps[j]))join(i,j);
  const groups=new Map();for(let i=0;i<sweeps.length;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(sweeps[i]);}const result=[];for(const group of groups.values()){if(!regionalCharts||group.length<=2){result.push(group);continue;}const score=(a,b)=>{let total=0;for(let sample=0;sample<9;sample++){const t=sample/10,fa=sweepFrameAt(a,t),fb=sweepFrameAt(b,t),reach=Math.max(fa.width,fa.depth)+Math.max(fb.width,fb.depth),distance=v3.len(v3.sub(fa.c,fb.c))/Math.max(reach,1e-5),alignment=1-clamp(v3.dot(fa.t,fb.t),-1,1);total+=distance+alignment*.35;}return total/9;},candidates=[];for(let a=0;a<group.length;a++)for(let b=a+1;b<group.length;b++)candidates.push({a,b,score:score(group[a],group[b])});candidates.sort((a,b)=>a.score-b.score);const assigned=new Set();for(const pair of candidates)if(!assigned.has(pair.a)&&!assigned.has(pair.b)){assigned.add(pair.a);assigned.add(pair.b);result.push([group[pair.a],group[pair.b]]);}for(let i=0;i<group.length;i++)if(!assigned.has(i))result.push([group[i]]);}return result;
}

function combineMeshes(meshes){
  const out={vertices:[],faces:[],objFaces:[],preservedStrands:0,remeshedGroups:0};
  for(const m of meshes){const o=out.vertices.length;out.vertices.push(...m.vertices);out.faces.push(...m.faces.map(f=>f.map(i=>i+o)));out.objFaces.push(...(m.objFaces||m.faces).map(f=>f.map(i=>i+o)));out.preservedStrands+=m.preservedStrands||0;out.remeshedGroups+=m.remeshedGroups||0;}
  const atlasMeshes=meshes.filter(mesh=>['tip-anchored-rail-atlas','inter-tip-fork-panels','balanced-fork-layout','single-junction-loop'].includes(mesh.topologyMode));if(atlasMeshes.length){out.topologyMode=atlasMeshes.some(mesh=>mesh.topologyMode==='single-junction-loop')?'single-junction-loop':atlasMeshes.some(mesh=>mesh.topologyMode==='balanced-fork-layout')?'balanced-fork-layout':atlasMeshes.some(mesh=>mesh.topologyMode==='inter-tip-fork-panels')?'inter-tip-fork-panels':'tip-anchored-rail-atlas';out.tipPoles=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.tipPoles||0),0);out.forkPanels=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.forkPanels||0),0);out.crotchWelds=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchWelds||0),0);out.crotchPoles=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchPoles||0),0);out.crotchSeamEdges=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchSeamEdges||0),0);out.reducedForkRails=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.reducedForkRails||0),0);out.sourceLoopForks=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.sourceLoopForks||0),0);out.crotchJoinMode=atlasMeshes.some(mesh=>mesh.crotchJoinMode==='two-sided-crotch-edge')?'two-sided-crotch-edge':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='collapsed-crotch-pole')?'collapsed-crotch-pole':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='reduced-rail-split')?'reduced-rail-split':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='split-bridge')?'split-bridge':out.forkPanels&&out.sourceLoopForks===out.forkPanels?'source-loop-zipper':out.crotchWelds?'mixed':'none';out.junctionLoops=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.junctionLoops||0),0);out.splitRows=atlasMeshes.flatMap(mesh=>mesh.splitRows||[]);}out.prunedRows=meshes.reduce((sum,mesh)=>sum+(mesh.prunedRows||0),0);out.topologyMutations=[...new Set(meshes.map(mesh=>mesh.topologyMutation).filter(Boolean))];
  out.jointRows=meshes.map(mesh=>mesh.jointRow).filter(Number.isFinite);out.overlapRuns=meshes.flatMap(mesh=>mesh.overlapRuns||[]);out.effectiveTipSeparations=meshes.map(mesh=>mesh.effectiveTipSeparation).filter(Number.isFinite);out.detachedTipContacts=meshes.filter(mesh=>mesh.detachedTipContact).length;out.insertedAlignmentLoops=meshes.reduce((sum,mesh)=>sum+(mesh.insertedAlignmentLoops||0),0);out.removedAlignmentLoops=meshes.reduce((sum,mesh)=>sum+(mesh.removedAlignmentLoops||0),0);out.alignmentTargetSpacing=meshes.map(mesh=>mesh.alignmentTargetSpacing).filter(Number.isFinite);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of out.vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}out.bounds={lo,hi};return out;
}

function resampleClosedProfile(points,count){
  if(points.length<3)return Array.from({length:count},(_,i)=>[Math.cos(i/count*Math.PI*2),Math.sin(i/count*Math.PI*2)]);
  const lengths=[0];let total=0;for(let i=0;i<points.length;i++){total+=Math.hypot(points[(i+1)%points.length][0]-points[i][0],points[(i+1)%points.length][1]-points[i][1]);lengths.push(total);}
  return Array.from({length:count},(_,sample)=>{const target=sample/count*total;let edge=0;while(edge<points.length-1&&lengths[edge+1]<target)edge++;const t=(target-lengths[edge])/Math.max(lengths[edge+1]-lengths[edge],EPS);return [points[edge][0]+(points[(edge+1)%points.length][0]-points[edge][0])*t,points[edge][1]+(points[(edge+1)%points.length][1]-points[edge][1])*t];});
}

function interpolateSweepFrame(a,b,u){
  const result={c:v3.mix(a.c,b.c,u),t:v3.norm(v3.mix(a.t,b.t,u)),x:v3.norm(v3.mix(a.x,b.x,u)),z:v3.norm(v3.mix(a.z,b.z,u)),width:a.width+(b.width-a.width)*u,depth:a.depth+(b.depth-a.depth)*u};
  for(const key of ['widthPositive','widthNegative','depthPositive','depthNegative','centerX','centerZ','parameter','arcFraction'])if(a[key]!==undefined&&b[key]!==undefined)result[key]=a[key]+(b[key]-a[key])*u;
  if(a.profileBounds)result.profileBounds=a.profileBounds;
  return result;
}

function sweepFrameAt(sweep,t){
  const fs=sweep.frames;
  if(fs[0].arcFraction!==undefined){let lo=0,hi=fs.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(fs[mid].arcFraction<=t)lo=mid;else hi=mid;}return interpolateSweepFrame(fs[lo],fs[hi],clamp((t-fs[lo].arcFraction)/Math.max(EPS,fs[hi].arcFraction-fs[lo].arcFraction)));}
  const q=clamp(t)*(fs.length-1),i=Math.min(fs.length-2,Math.floor(q)),u=q-i;return interpolateSweepFrame(fs[Math.max(0,i)],fs[Math.max(0,i+1)],u);
}

function profileEnvelope(points,x){
  const hits=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[0]<=x&&b[0]>=x)||(b[0]<=x&&a[0]>=x)){const span=b[0]-a[0];if(Math.abs(span)<EPS){hits.push(a[1],b[1]);continue;}const t=(x-a[0])/span;if(t>=0&&t<=1)hits.push(a[1]+(b[1]-a[1])*t);}}
  if(!hits.length){const nearest=points.reduce((best,p)=>Math.abs(p[0]-x)<Math.abs(best[0]-x)?p:best);return {front:nearest[1],back:nearest[1]};}return {front:Math.max(...hits),back:Math.min(...hits)};
}

function projectedSection(sample,profile,u,v){
  const points=profile.map(p=>sweepPoint(sample,p)).map(p=>[v3.dot(p,u),v3.dot(p,v)]),values=points.map(p=>p[0]);return {points,min:Math.min(...values),max:Math.max(...values)};
}

function contactRunSelection(overlapRuns,start,requestedSeparation){
  const rootRuns=overlapRuns.filter(run=>run.start<=start+1),pool=rootRuns.length?rootRuns:overlapRuns,primary=pool.reduce((best,run)=>!best||run.end-run.start>best.end-best.start?run:best,null),hasDetachedTipContact=Boolean(primary&&overlapRuns.some(run=>run.start>primary.end+1)),requested=clamp(Number(requestedSeparation)||0),effective=hasDetachedTipContact&&requested>0?.85+.15*requested:requested;
  return {primary,hasDetachedTipContact,effective};
}

function orientFacesOutward(vertices,faces){
  const edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,edgeFaces=new Map(),adjacency=Array.from({length:faces.length},()=>[]);
  for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const face=faces[faceIndex];for(let edge=0;edge<face.length;edge++){const from=face[edge],to=face[(edge+1)%face.length],key=edgeKey(from,to);if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push({faceIndex,from,to});}}
  for(const uses of edgeFaces.values())if(uses.length===2){const [first,second]=uses,sameDirection=first.from===second.from;adjacency[first.faceIndex].push([second.faceIndex,sameDirection]);adjacency[second.faceIndex].push([first.faceIndex,sameDirection]);}
  const flip=Array(faces.length).fill(undefined),components=[];
  for(let start=0;start<faces.length;start++)if(flip[start]===undefined){const component=[],queue=[start];flip[start]=false;while(queue.length){const current=queue.pop();component.push(current);for(const [neighbor,sameDirection] of adjacency[current]){const required=flip[current]!==sameDirection;if(flip[neighbor]===undefined){flip[neighbor]=required;queue.push(neighbor);}}}components.push(component);}
  for(let faceIndex=0;faceIndex<faces.length;faceIndex++)if(flip[faceIndex])faces[faceIndex].reverse();
  for(const component of components){let volume=0;for(const faceIndex of component){const face=faces[faceIndex],origin=vertices[face[0]];for(let index=1;index<face.length-1;index++)volume+=v3.dot(origin,v3.cross(vertices[face[index]],vertices[face[index+1]]))/6;}if(volume<0)for(const faceIndex of component)faces[faceIndex].reverse();}
  return faces;
}

function branchedCurveMesh(sourceSweeps,axialLoops=16,flowSmooth=.55,options={}){
  const axial=Math.max(8,Math.min(80,Math.round(axialLoops))),radial=Math.max(8,Math.min(24,Math.max(...sourceSweeps.map(s=>s.profile.length)))),columns=Math.max(3,Math.min(16,Math.round(radial/2)+1)),sharedColumns=columns*2-1;
  const strands=sourceSweeps.slice(0,2).map(s=>({samples:Array.from({length:axial},(_,i)=>sweepFrameAt(s,i/(axial-1))),profile:resampleClosedProfile(s.profile,radial)}));
  const deltas=Array.from({length:axial},(_,r)=>v3.sub(strands[1].samples[r].c,strands[0].samples[r].c));let seed=deltas.reduce((best,d)=>v3.dot(d,d)>v3.dot(best,best)?d:best,deltas[axial-1]),previousU,previousV;const frames=[];
  for(let r=0;r<axial;r++){const samples=[strands[0].samples[r],strands[1].samples[r]],tangent=v3.norm(v3.add(samples[0].t,samples[1].t)),project=a=>v3.sub(a,v3.scale(tangent,v3.dot(a,tangent)));let u=project(deltas[r]);if(v3.len(u)<1e-5)u=project(seed);if(v3.len(u)<1e-5)u=project(samples[0].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u)),preferred=v3.norm(v3.add(samples[0].z,samples[1].z));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({u,v});previousU=u;previousV=v;}
  const sections=Array.from({length:axial},(_,r)=>[projectedSection(strands[0].samples[r],strands[0].profile,frames[r].u,frames[r].v),projectedSection(strands[1].samples[r],strands[1].profile,frames[r].u,frames[r].v)]),overlaps=sections.map(row=>Math.min(row[0].max,row[1].max)-Math.max(row[0].min,row[1].min)),overlapRuns=[];let runStart=-1,lastOverlap=0;for(let row=0;row<axial;row++){if(overlaps[row]>=0){lastOverlap=row;if(runStart<0)runStart=row;}else if(runStart>=0){overlapRuns.push({start:runStart,end:row-1});runStart=-1;}}if(runStart>=0)overlapRuns.push({start:runStart,end:axial-1});const tipSeparation=Number.isFinite(Number(options.tipSeparation))?clamp(Number(options.tipSeparation)):1,contactSelection=contactRunSelection(overlapRuns,0,tipSeparation),mainRun=contactSelection.primary,mainEnd=mainRun?mainRun.end:lastOverlap,effectiveTipSeparation=contactSelection.effective;let joint=Math.round(lastOverlap+(mainEnd-lastOverlap)*effectiveTipSeparation);joint=Math.max(1,Math.min(axial-3,joint+(Number(options.junctionRowBias)||0)));
  const vertices=[],pointIndex=p=>{const i=vertices.length;vertices.push(p);return i;},sharedFront=[],sharedBack=[],stride=Math.max(1,Math.min(3,Math.round(Number(options.loopPruneStride)||1))),keepShared=row=>stride===1||row<=1||row>=joint-1||row%stride===0,keepBranch=row=>stride===1||row<=joint+1||row>=axial-2||(row-joint)%stride===0,sharedRows=Array.from({length:joint+1},(_,row)=>row).filter(keepShared),branchRows=Array.from({length:axial-joint-1},(_,offset)=>joint+1+offset).filter(keepBranch),prunedRows=(joint+1-sharedRows.length)+(axial-joint-1-branchRows.length)*2,branchOrder=[0,1].sort((a,b)=>(sections[joint][a].min+sections[joint][a].max)-(sections[joint][b].min+sections[joint][b].max));
  const seamFractionAt=r=>{const rowSections=sections[r],leftSection=rowSections[branchOrder[0]],rightSection=rowSections[branchOrder[1]],left=Math.min(leftSection.min,rightSection.min),right=Math.max(leftSection.max,rightSection.max),overlapMin=Math.max(leftSection.min,rightSection.min),overlapMax=Math.min(leftSection.max,rightSection.max),leftWidth=Math.max(EPS,leftSection.max-leftSection.min),rightWidth=Math.max(EPS,rightSection.max-rightSection.min),ownership=leftWidth/(leftWidth+rightWidth),seam=overlapMin<=overlapMax?overlapMin+(overlapMax-overlapMin)*ownership:(leftSection.max+rightSection.min)*.5;return clamp((seam-left)/Math.max(right-left,EPS));},seamFractions=sharedRows.map(seamFractionAt).sort((a,b)=>a-b),stableSeamFraction=seamFractions[Math.floor(seamFractions.length/2)];
  const commonRow=(r,front)=>{const frame=frames[r],rowSections=sections[r],leftIndex=branchOrder[0],rightIndex=branchOrder[1],leftSection=rowSections[leftIndex],rightSection=rowSections[rightIndex],left=Math.min(leftSection.min,rightSection.min),right=Math.max(leftSection.max,rightSection.max),seam=left+(right-left)*stableSeamFraction,anchor=v3.scale(v3.add(strands[leftIndex].samples[r].c,strands[rightIndex].samples[r].c),.5),targets=[],result=[];for(let col=0;col<columns;col++)targets.push(left+(seam-left)*col/(columns-1));for(let col=1;col<columns;col++)targets.push(seam+(right-seam)*col/(columns-1));for(let col=0;col<sharedColumns;col++){const target=targets[col],heights=[];for(const section of rowSections)if(target>=section.min-1e-7&&target<=section.max+1e-7){const e=profileEnvelope(section.points,target);heights.push(front?e.front:e.back);}const height=heights.length?(front?Math.max(...heights):Math.min(...heights)):v3.dot(anchor,frame.v);result.push(pointIndex(v3.add(anchor,v3.add(v3.scale(frame.u,target-v3.dot(anchor,frame.u)),v3.scale(frame.v,height-v3.dot(anchor,frame.v))))));}return result;};
  for(const r of sharedRows){sharedFront.push(commonRow(r,true));sharedBack.push(commonRow(r,false));}
  const sharedLast=sharedFront.length-1,branches=branchOrder.map((sourceIndex,position)=>{const jointSample=strands[sourceIndex].samples[joint],xSign=v3.dot(jointSample.x,frames[joint].u)<0?-1:1,zSign=v3.dot(jointSample.z,frames[joint].v)<0?-1:1;return {sourceIndex,position,xSign,zSign,front:[position===0?sharedFront[sharedLast].slice(0,columns):sharedFront[sharedLast].slice(columns-1)],back:[position===0?sharedBack[sharedLast].slice(0,columns):sharedBack[sharedLast].slice(columns-1)]};});
  for(const branch of branches)for(const r of branchRows){const s=branch.sourceIndex,sample=strands[s].samples[r],transition=options.preserveTailFrames===false?0:clamp((r-joint)/3),localX=v3.scale(sample.x,branch.xSign),localZ=v3.scale(sample.z,branch.zSign),xAxis=v3.norm(v3.mix(frames[r].u,localX,transition)),rawZ=v3.norm(v3.mix(frames[r].v,localZ,transition)),zAxis=v3.norm(v3.sub(rawZ,v3.scale(xAxis,v3.dot(rawZ,xAxis)))),section=projectedSection(sample,strands[s].profile,xAxis,zAxis),front=[],back=[];for(let col=0;col<columns;col++){const target=section.min+(section.max-section.min)*col/(columns-1),e=profileEnvelope(section.points,target),make=h=>v3.add(sample.c,v3.add(v3.scale(xAxis,target-v3.dot(sample.c,xAxis)),v3.scale(zAxis,h-v3.dot(sample.c,zAxis))));front.push(pointIndex(make(e.front)));back.push(pointIndex(make(e.back)));}branch.front.push(front);branch.back.push(back);}
  sharedFront.forEach((row,i)=>{sharedBack[i][0]=row[0];sharedBack[i][sharedColumns-1]=row[sharedColumns-1];});branches[0].front.forEach((row,i)=>{branches[0].back[i][0]=row[0];});branches[1].front.forEach((row,i)=>{branches[1].back[i][columns-1]=row[columns-1];});
  if(options.semanticWeldOnly){
    const allRows=[sharedFront,sharedBack,...branches.flatMap(branch=>[branch.front,branch.back])],replaceIndex=(remove,keep)=>{if(remove===keep)return;for(const rows of allRows)for(const row of rows)for(let column=0;column<row.length;column++)if(row[column]===remove)row[column]=keep;},sameWeldPosition=(first,second)=>vertices[first].every((value,axis)=>Math.round(value*1e8)===Math.round(vertices[second][axis]*1e8)),collapseBranchSilhouettes=(front,back)=>{for(let row=0;row<Math.min(front.length,back.length);row++){const last=Math.min(front[row].length,back[row].length)-1;for(const column of [0,last]){const frontIndex=front[row][column],backIndex=back[row][column];if(frontIndex!==backIndex&&sameWeldPosition(frontIndex,backIndex))replaceIndex(backIndex,frontIndex);}}};
    // The shared root is a true end silhouette, just like each branch tip.
    // Collapse only exact corresponding samples on that one row. Applying the
    // same rule to interior shared rows can bridge a narrow gap and create an
    // edge with four incident faces, which is why the scope is deliberately
    // limited to the root cap.
    for(let column=0;column<Math.min(sharedFront[0].length,sharedBack[0].length);column++){const frontIndex=sharedFront[0][column],backIndex=sharedBack[0][column];if(frontIndex!==backIndex&&sameWeldPosition(frontIndex,backIndex))replaceIndex(backIndex,frontIndex);}
    // Only branch perimeter endpoints are true closed-profile silhouettes. An
    // equal front/back sample inside the shared union can instead mark a narrow
    // inter-strand gap; collapsing that would give one edge four incident faces.
    for(const branch of branches)collapseBranchSilhouettes(branch.front,branch.back);
  }
  const relaxGrid=(rows,strength,passes=2,lockTip=false)=>{if(strength<=0||rows.length<3||rows[0].length<3)return;for(let pass=0;pass<passes;pass++){const updates=[];for(let r=1;r<rows.length-1;r++){const rowT=r/(rows.length-1),localStrength=strength*(lockTip?(1-rowT)*(1-rowT):1);for(let c=1;c<rows[r].length-1;c++){const current=vertices[rows[r][c]],along=v3.scale(v3.add(vertices[rows[r-1][c]],vertices[rows[r+1][c]]),.5),across=v3.scale(v3.add(vertices[rows[r][c-1]],vertices[rows[r][c+1]]),.5);updates.push([rows[r][c],v3.mix(v3.mix(current,along,.32*localStrength),across,.12*localStrength)]);}}for(const [i,p] of updates)vertices[i]=p;}};
  const strength=clamp(flowSmooth);relaxGrid(sharedFront,strength);relaxGrid(sharedBack,strength);for(const b of branches){relaxGrid(b.front,strength,2,true);relaxGrid(b.back,strength,2,true);}const crotchFront=branches[0].front[0][columns-1],crotchBack=branches[0].back[0][columns-1];for(const rows of [sharedBack,...branches.map(branch=>branch.back)])for(const row of rows)for(let column=0;column<row.length;column++)if(row[column]===crotchBack)row[column]=crotchFront;
  const faces=[],clean=(f,reverse=false)=>{const q=[];for(const i of f)if(q[q.length-1]!==i)q.push(i);if(q.length>1&&q[0]===q[q.length-1])q.pop();if(new Set(q).size>=3)faces.push(reverse?q.reverse():q);},connect=(rows,reverse=false)=>{for(let r=0;r<rows.length-1;r++)for(let c=0;c<rows[r].length-1;c++)clean([rows[r][c],rows[r+1][c],rows[r+1][c+1],rows[r][c+1]],reverse);},side=(front,back,col,reverse=false)=>{for(let r=0;r<front.length-1;r++)clean([front[r][col],back[r][col],back[r+1][col],front[r+1][col]],reverse);},cap=(front,back,reverse=false)=>{for(let c=0;c<front.length-1;c++){const a=front[c],b=front[c+1],cc=back[c+1],d=back[c],unique=[...new Set([a,b,cc,d])];if(unique.length===3)clean(unique,reverse);else if(unique.length===4){const ac=v3.len(v3.sub(vertices[a],vertices[cc])),bd=v3.len(v3.sub(vertices[b],vertices[d]));if(ac<=bd){clean([a,b,cc],reverse);clean([a,cc,d],reverse);}else{clean([a,b,d],reverse);clean([b,cc,d],reverse);}}}};
  const tipFan=(front,back,tip)=>{const pole=pointIndex(tip),last=front.length-1,perimeter=[...front[last],...back[last].slice().reverse()].filter((index,position,array)=>position===0||index!==array[position-1]);if(perimeter.length>1&&perimeter[0]===perimeter[perimeter.length-1])perimeter.pop();for(let i=0;i<perimeter.length;i++)clean([perimeter[i],pole,perimeter[(i+1)%perimeter.length]]);};
  connect(sharedFront);connect(sharedBack,true);cap(sharedFront[0],sharedBack[0],true);for(const branch of branches){const front=branch.front.slice(0,-1),back=branch.back.slice(0,-1);connect(front);connect(back,true);side(front,back,branch.position===0?columns-1:0,branch.position===1);tipFan(front,back,strands[branch.sourceIndex].samples[axial-1].c);}
  const used=[...new Set(faces.flat())].sort((a,b)=>a-b),remap=new Map(used.map((old,index)=>[old,index])),compacted=used.map(index=>vertices[index]);vertices.splice(0,vertices.length,...compacted);for(const face of faces)for(let i=0;i<face.length;i++)face[i]=remap.get(face[i]);orientFacesOutward(vertices,faces);const triangles=[];for(const f of faces)for(let i=1;i<f.length-1;i++)triangles.push([f[0],f[i],f[i+1]]);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
  return {vertices,faces:triangles,objFaces:faces,bounds:{lo,hi},preservedStrands:0,remeshedGroups:1,jointRow:joint,axialLoops:axial,topologyMutation:options.topologyMutation||'baseline',prunedRows,tipPoles:2,crotchPoles:1,crotchJoinMode:'collapsed-crotch-pole',branchOrder,overlapRuns,tipSeparation,effectiveTipSeparation,detachedTipContact:contactSelection.hasDetachedTipContact,preservedTailFrames:options.preserveTailFrames!==false};
}

function multiBranchedCurveMesh(sourceSweeps,axialLoops=16,flowSmooth=.55){
  const axial=Math.max(8,Math.min(80,Math.round(axialLoops))),radial=Math.max(8,Math.min(24,Math.max(...sourceSweeps.map(s=>s.profile.length)))),columns=Math.max(3,Math.min(16,Math.round(radial/2)+1)),strandCount=sourceSweeps.length,sharedColumns=strandCount*(columns-1)+1;
  const strands=sourceSweeps.map(s=>({samples:Array.from({length:axial},(_,i)=>sweepFrameAt(s,i/(axial-1))),profile:resampleClosedProfile(s.profile,radial)}));
  let seed=[1,0,0],seedLength=-1;for(let a=0;a<strandCount;a++)for(let b=a+1;b<strandCount;b++){const d=v3.sub(strands[b].samples[axial-1].c,strands[a].samples[axial-1].c),l=v3.dot(d,d);if(l>seedLength){seed=d;seedLength=l;}}
  const frames=[];let previousU,previousV;for(let r=0;r<axial;r++){let tangent=[0,0,0],preferred=[0,0,0];for(const strand of strands){tangent=v3.add(tangent,strand.samples[r].t);preferred=v3.add(preferred,strand.samples[r].z);}tangent=v3.norm(tangent);const project=a=>v3.sub(a,v3.scale(tangent,v3.dot(a,tangent)));let u=project(seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[r].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({u,v});previousU=u;previousV=v;}
  const order=Array.from({length:strandCount},(_,i)=>i).sort((a,b)=>{let pa=0,pb=0;for(let r=Math.floor(axial/3);r<axial;r++){pa+=v3.dot(strands[a].samples[r].c,frames[r].u);pb+=v3.dot(strands[b].samples[r].c,frames[r].u);}return pa-pb;}),sections=Array.from({length:axial},(_,r)=>strands.map(s=>projectedSection(s.samples[r],s.profile,frames[r].u,frames[r].v))),groups=order.map(index=>[index]);
  const interval=(r,group)=>({min:Math.min(...group.map(i=>sections[r][i].min)),max:Math.max(...group.map(i=>sections[r][i].max))}),connected=sections.map((_,r)=>groups.length<2||groups.slice(1).some((group,i)=>interval(r,groups[i]).max>=interval(r,group).min));let joint=0;while(joint+1<axial&&connected[joint+1])joint++;joint=Math.max(1,Math.min(axial-3,joint));
  const vertices=[],pointIndex=p=>{const i=vertices.length;vertices.push(p);return i;},unionRow=(r,front,members,count)=>{const frame=frames[r],active=members.map(i=>sections[r][i]),left=Math.min(...active.map(s=>s.min)),right=Math.max(...active.map(s=>s.max)),result=[];for(let c=0;c<count;c++){const target=left+(right-left)*c/(count-1),heights=[];for(const section of active)if(target>=section.min-1e-7&&target<=section.max+1e-7){const e=profileEnvelope(section.points,target);heights.push(front?e.front:e.back);}const nearest=members.reduce((best,i)=>Math.abs(v3.dot(strands[i].samples[r].c,frame.u)-target)<Math.abs(v3.dot(strands[best].samples[r].c,frame.u)-target)?i:best,members[0]),base=strands[nearest].samples[r].c,height=heights.length?(front?Math.max(...heights):Math.min(...heights)):v3.dot(base,frame.v);result.push(pointIndex(v3.add(base,v3.add(v3.scale(frame.u,target-v3.dot(base,frame.u)),v3.scale(frame.v,height-v3.dot(base,frame.v))))));}return result;},sharedFront=[],sharedBack=[];
  for(let r=0;r<=joint;r++){sharedFront.push(unionRow(r,true,order,sharedColumns));sharedBack.push(unionRow(r,false,order,sharedColumns));}
  let offset=0;const branches=groups.map((members,position)=>{const width=members.length*(columns-1)+1,b={members,position,front:[sharedFront[joint].slice(offset,offset+width)],back:[sharedBack[joint].slice(offset,offset+width)]};offset+=width-1;return b;});for(const branch of branches){const width=branch.members.length*(columns-1)+1;for(let r=joint+1;r<axial;r++){branch.front.push(unionRow(r,true,branch.members,width));branch.back.push(unionRow(r,false,branch.members,width));}}
  sharedFront.forEach((row,i)=>{sharedBack[i][0]=row[0];sharedBack[i][sharedColumns-1]=row[sharedColumns-1];});branches[0].front.forEach((row,i)=>{branches[0].back[i][0]=row[0];});const lastBranch=branches[branches.length-1];lastBranch.front.forEach((row,i)=>{lastBranch.back[i][row.length-1]=row[row.length-1];});
  const relaxGrid=(rows,strength,passes=2)=>{if(strength<=0||rows.length<3||rows[0].length<3)return;for(let pass=0;pass<passes;pass++){const updates=[];for(let r=1;r<rows.length-1;r++)for(let c=1;c<rows[r].length-1;c++){const current=vertices[rows[r][c]],along=v3.scale(v3.add(vertices[rows[r-1][c]],vertices[rows[r+1][c]]),.5),across=v3.scale(v3.add(vertices[rows[r][c-1]],vertices[rows[r][c+1]]),.5);updates.push([rows[r][c],v3.mix(v3.mix(current,along,.32*flowSmooth),across,.12*flowSmooth)]);}for(const [i,p] of updates)vertices[i]=p;}};relaxGrid(sharedFront,flowSmooth);relaxGrid(sharedBack,flowSmooth);for(const branch of branches){relaxGrid(branch.front,flowSmooth);relaxGrid(branch.back,flowSmooth);}
  const faces=[],clean=(f,reverse=false)=>{const q=[];for(const i of f)if(q[q.length-1]!==i)q.push(i);if(q.length>1&&q[0]===q[q.length-1])q.pop();if(new Set(q).size>=3)faces.push(reverse?q.reverse():q);},connect=(rows,reverse=false)=>{for(let r=0;r<rows.length-1;r++)for(let c=0;c<rows[r].length-1;c++)clean([rows[r][c],rows[r+1][c],rows[r+1][c+1],rows[r][c+1]],reverse);},side=(front,back,col,reverse=false)=>{for(let r=0;r<front.length-1;r++)clean([front[r][col],back[r][col],back[r+1][col],front[r+1][col]],reverse);},cap=(front,back,reverse=false)=>{for(let c=0;c<front.length-1;c++){const a=front[c],b=front[c+1],cc=back[c+1],d=back[c],unique=[...new Set([a,b,cc,d])];if(unique.length===3)clean(unique,reverse);else if(unique.length===4){const ac=v3.len(v3.sub(vertices[a],vertices[cc])),bd=v3.len(v3.sub(vertices[b],vertices[d]));if(ac<=bd){clean([a,b,cc],reverse);clean([a,cc,d],reverse);}else{clean([a,b,d],reverse);clean([b,cc,d],reverse);}}}};
  connect(sharedFront);connect(sharedBack,true);cap(sharedFront[0],sharedBack[0],true);for(const branch of branches){const last=branch.front[0].length-1;connect(branch.front);connect(branch.back,true);if(branch.position>0)side(branch.front,branch.back,0,true);if(branch.position<branches.length-1)side(branch.front,branch.back,last);cap(branch.front[branch.front.length-1],branch.back[branch.back.length-1]);}
  const triangles=[];for(const f of faces)for(let i=1;i<f.length-1;i++)triangles.push([f[0],f[i],f[i+1]]);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
  return {vertices,faces:triangles,objFaces:faces,bounds:{lo,hi},preservedStrands:0,remeshedGroups:1,jointRow:joint,axialLoops:axial,branchCount:branches.length,topologyMode:'single-junction-loop',junctionLoops:1,tipPoles:branches.length};
}

function convexProfilesOverlap(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<EPS)continue;
    const axis=[-dy/length,dx/length],project=points=>{const values=points.map(point=>point[0]*axis[0]+point[1]*axis[1]);return {min:Math.min(...values),max:Math.max(...values)};},pa=project(a),pb=project(b);
    if(Math.min(pa.max,pb.max)-Math.max(pa.min,pb.min)<-1e-7)return false;
  }
  return true;
}

function hierarchicalCurveMesh(sourceSweeps,axialLoops=16,flowSmooth=.55,options={}){
  const axial=Math.max(10,Math.min(80,Math.round(axialLoops))),radial=Math.max(8,Math.min(24,Math.max(...sourceSweeps.map(s=>s.profile.length)))),columns=Math.max(3,Math.min(16,Math.round(radial/2)+1)),strandCount=sourceSweeps.length;
  const strands=sourceSweeps.map(s=>({samples:Array.from({length:axial},(_,i)=>sweepFrameAt(s,i/(axial-1))),profile:resampleClosedProfile(s.profile,radial)}));
  let seed=[1,0,0],seedLength=-1;for(let a=0;a<strandCount;a++)for(let b=a+1;b<strandCount;b++)for(let r=0;r<axial;r++){const d=v3.sub(strands[b].samples[r].c,strands[a].samples[r].c),length=v3.dot(d,d);if(length>seedLength){seed=d;seedLength=length;}}
  const frames=[];let previousU,previousV;for(let r=0;r<axial;r++){let tangent=[0,0,0],preferred=[0,0,0];for(const strand of strands){tangent=v3.add(tangent,strand.samples[r].t);preferred=v3.add(preferred,strand.samples[r].z);}tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[r].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({u,v});previousU=u;previousV=v;}
  const sections=Array.from({length:axial},(_,r)=>strands.map(s=>projectedSection(s.samples[r],s.profile,frames[r].u,frames[r].v))),contactPaddingRatio=Math.max(0,Math.min(.75,Number(options.contactPaddingRatio)||0)),sectionsTouch=(first,second)=>{if(convexProfilesOverlap(first.points,second.points))return true;const gap=Math.max(0,Math.max(first.min,second.min)-Math.min(first.max,second.max)),scale=((first.max-first.min)+(second.max-second.min))*.5;return gap<=scale*contactPaddingRatio;};
  // The original atlas intentionally uses one transported frame field for the
  // whole overlap group. Quality Flow can opt into a local field per recursive
  // node instead. This keeps a child chart aligned to the curves it actually
  // represents, rather than letting distant strands rotate or flatten it.
  const nodeGeometryCache=new Map(),nodeGeometry=members=>{
    if(!options.localNodeFrames)return {frames,sections};
    const sorted=[...members].sort((a,b)=>a-b),key=sorted.join(',');if(nodeGeometryCache.has(key))return nodeGeometryCache.get(key);
    let nodeSeed=frames[0].u,seedLength=-1;for(let first=0;first<sorted.length;first++)for(let second=first+1;second<sorted.length;second++)for(let row=0;row<axial;row++){const delta=v3.sub(strands[sorted[second]].samples[row].c,strands[sorted[first]].samples[row].c),length=v3.dot(delta,delta);if(length>seedLength){seedLength=length;nodeSeed=delta;}}
    const localFrames=[];let previousLocalU,previousLocalV;for(let row=0;row<axial;row++){
      let tangent=[0,0,0],preferred=[0,0,0],separation=nodeSeed,rowLength=-1;for(const member of sorted){const sample=strands[member].samples[row];tangent=v3.add(tangent,sample.t);preferred=v3.add(preferred,sample.z);}for(let first=0;first<sorted.length;first++)for(let second=first+1;second<sorted.length;second++){const delta=v3.sub(strands[sorted[second]].samples[row].c,strands[sorted[first]].samples[row].c),length=v3.dot(delta,delta);if(length>rowLength){rowLength=length;separation=delta;}}
      tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(sorted.length>1?separation:strands[sorted[0]].samples[row].x);if(v3.len(u)<1e-5)u=project(nodeSeed);if(v3.len(u)<1e-5)u=project(frames[row].u);u=v3.norm(u);if((previousLocalU&&v3.dot(u,previousLocalU)<0)||(!previousLocalU&&v3.dot(u,frames[row].u)<0))u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousLocalV&&v3.dot(v,previousLocalV)<0)||(!previousLocalV&&v3.dot(v,frames[row].v)<0)||(!previousLocalV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);localFrames.push({u,v});previousLocalU=u;previousLocalV=v;
    }
    const localSections=Array.from({length:axial},(_,row)=>{const values=[];for(const member of sorted)values[member]=projectedSection(strands[member].samples[row],strands[member].profile,localFrames[row].u,localFrames[row].v);return values;}),geometry={frames:localFrames,sections:localSections};nodeGeometryCache.set(key,geometry);return geometry;
  };
  const localPairSection=(members,row)=>{const [firstIndex,secondIndex]=[...members].sort((a,b)=>orderPosition?.get(a)-orderPosition?.get(b)),first=strands[firstIndex].samples[row],second=strands[secondIndex].samples[row],tangent=v3.norm(v3.add(first.t,second.t)),project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(v3.sub(second.c,first.c));if(v3.len(u)<1e-5)u=project(frames[row].u);u=v3.norm(u);if(v3.dot(u,frames[row].u)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if(v3.dot(v,frames[row].v)<0)v=v3.scale(v,-1);return {u,v,firstIndex,secondIndex,sections:[projectedSection(first,strands[firstIndex].profile,u,v),projectedSection(second,strands[secondIndex].profile,u,v)]};};
  const order=Array.from({length:strandCount},(_,i)=>i).sort((a,b)=>{let pa=0,pb=0;for(let r=Math.floor(axial/3);r<axial;r++){pa+=v3.dot(strands[a].samples[r].c,frames[r].u);pb+=v3.dot(strands[b].samples[r].c,frames[r].u);}return pa-pb;}),orderPosition=new Map(order.map((member,index)=>[member,index]));
  const partition=(members,row)=>{const remaining=new Set(members),groups=[];while(remaining.size){const first=remaining.values().next().value,group=[],queue=[first];remaining.delete(first);while(queue.length){const member=queue.pop();group.push(member);for(const candidate of [...remaining])if(convexProfilesOverlap(sections[row][member].points,sections[row][candidate].points)){remaining.delete(candidate);queue.push(candidate);}}group.sort((a,b)=>orderPosition.get(a)-orderPosition.get(b));groups.push(group);}groups.sort((a,b)=>{const center=group=>group.reduce((sum,i)=>sum+v3.dot(strands[i].samples[row].c,frames[row].u),0)/group.length;return center(a)-center(b);});return groups;};
  const signature=groups=>groups.map(group=>[...group].sort((a,b)=>a-b).join(',')).sort().join('|'),widthFor=members=>members.length*(columns-1)+1,vertices=[],vertexSides=[],pointIndex=(p,side='neutral')=>{const i=vertices.length;vertices.push(p);vertexSides.push(side);return i;};
  const anchoredRow=(row,front,members)=>{const frame=frames[row],ordered=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),active=ordered.map(i=>sections[row][i]),left=Math.min(...active.map(s=>s.min)),right=Math.max(...active.map(s=>s.max)),centers=ordered.map(i=>v3.dot(strands[i].samples[row].c,frame.u)),boundaries=[left];for(let i=0;i<centers.length-1;i++)boundaries.push(clamp((centers[i]+centers[i+1])*.5,boundaries[i]+1e-7,right));boundaries.push(right);const segments=columns-1,leftSteps=Math.floor(segments/2),rightSteps=segments-leftSteps,targets=[];ordered.forEach((_,member)=>{const center=clamp(centers[member],boundaries[member],boundaries[member+1]);for(let step=member?1:0;step<=leftSteps;step++)targets.push(boundaries[member]+(center-boundaries[member])*step/Math.max(leftSteps,1));for(let step=1;step<=rightSteps;step++)targets.push(center+(boundaries[member+1]-center)*step/Math.max(rightSteps,1));});const anchor=v3.scale(ordered.reduce((sum,i)=>v3.add(sum,strands[i].samples[row].c),[0,0,0]),1/ordered.length),result=[];for(let column=0;column<widthFor(members);column++){const target=Number.isFinite(targets[column])?targets[column]:left+(right-left)*column/(widthFor(members)-1),heights=[];for(const section of active)if(target>=section.min-1e-7&&target<=section.max+1e-7){const envelope=profileEnvelope(section.points,target);heights.push(front?envelope.front:envelope.back);}const height=heights.length?(front?Math.max(...heights):Math.min(...heights)):v3.dot(anchor,frame.v);result.push(pointIndex(v3.add(anchor,v3.add(v3.scale(frame.u,target-v3.dot(anchor,frame.u)),v3.scale(frame.v,height-v3.dot(anchor,frame.v)))),front?'front':'back'));}return result;};
  const forkEnvelopeRow=(row,front,members,groups,geometry=nodeGeometry(members))=>{
    const nodeFrames=geometry.frames,nodeSections=geometry.sections,ordered=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),frame=nodeFrames[row],active=ordered.map(member=>nodeSections[row][member]),left=Math.min(...active.map(section=>section.min)),right=Math.max(...active.map(section=>section.max)),forkGroups=groups?.length?groups:[ordered],groupInterval=group=>({min:Math.min(...group.map(member=>nodeSections[row][member].min)),max:Math.max(...group.map(member=>nodeSections[row][member].max))}),intervals=forkGroups.map(groupInterval),boundaries=[left];
    for(let group=0;group<intervals.length-1;group++)boundaries.push(clamp((intervals[group].max+intervals[group+1].min)*.5,boundaries[boundaries.length-1]+EPS,right-EPS));
    boundaries.push(right);
    const targets=[];for(let group=0;group<forkGroups.length;group++){const count=widthFor(forkGroups[group]);for(let column=group?1:0;column<count;column++)targets.push(boundaries[group]+(boundaries[group+1]-boundaries[group])*column/Math.max(1,count-1));}
    const groupCenter=group=>v3.scale(group.reduce((sum,member)=>v3.add(sum,strands[member].samples[row].c),[0,0,0]),1/Math.max(1,group.length)),first=groupCenter(forkGroups[0]),last=groupCenter(forkGroups[forkGroups.length-1]),result=[];
    for(let column=0;column<widthFor(members);column++){
      const target=targets[column],mix=clamp((target-left)/Math.max(right-left,EPS)),candidates=[];
      for(const member of ordered){const section=nodeSections[row][member];if(target>=section.min-1e-7&&target<=section.max+1e-7){const envelope=profileEnvelope(section.points,target);candidates.push({member,height:front?envelope.front:envelope.back});}}
      const winner=candidates.length?candidates.reduce((best,candidate)=>front?(candidate.height>best.height?candidate:best):(candidate.height<best.height?candidate:best)):null,isSilhouette=column===0||column===widthFor(members)-1,base=isSilhouette&&winner?strands[winner.member].samples[row].c:v3.mix(first,last,mix),height=winner?winner.height:v3.dot(base,frame.v);
      result.push(pointIndex(v3.add(base,v3.add(v3.scale(frame.u,target-v3.dot(base,frame.u)),v3.scale(frame.v,height-v3.dot(base,frame.v)))),front?'front':'back'));
    }
    return result;
  };
  const tailAnchoredRow=(row,front,member,start,geometry=nodeGeometry([member]))=>{const nodeFrames=geometry.frames,sample=strands[member].samples[row],startSample=strands[member].samples[Math.max(0,Math.min(axial-1,start))],xSign=v3.dot(startSample.x,nodeFrames[start].u)<0?-1:1,zSign=v3.dot(startSample.z,nodeFrames[start].v)<0?-1:1,transition=options.preserveTailFrames===false?0:clamp((row-start)/3),localX=v3.scale(sample.x,xSign),localZ=v3.scale(sample.z,zSign),project=axis=>v3.sub(axis,v3.scale(sample.t,v3.dot(axis,sample.t))),xAxis=v3.norm(project(v3.mix(nodeFrames[row].u,localX,transition))),rawZ=v3.norm(project(v3.mix(nodeFrames[row].v,localZ,transition))),zAxis=v3.norm(v3.sub(rawZ,v3.scale(xAxis,v3.dot(rawZ,xAxis)))),section=projectedSection(sample,strands[member].profile,xAxis,zAxis),result=[];for(let column=0;column<columns;column++){const target=section.min+(section.max-section.min)*column/(columns-1),envelope=profileEnvelope(section.points,target),height=front?envelope.front:envelope.back;result.push(pointIndex(v3.add(sample.c,v3.add(v3.scale(xAxis,target-v3.dot(sample.c,xAxis)),v3.scale(zAxis,height-v3.dot(sample.c,zAxis)))),front?'front':'back'));}return result;};
  let prunedRows=0;
  const nodes=[],terminalSplit=(members,start)=>{
    const sorted=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),geometry=nodeGeometry(sorted),nodeSections=geometry.sections;let cut=Math.max(1,Math.min(sorted.length-1,Math.floor(sorted.length/2)));
    if(options.branchGrouping==='progressive'||options.branchGrouping==='progressive-left')cut=1;
    else if(options.branchGrouping==='progressive-right')cut=sorted.length-1;
    else if(options.branchGrouping==='widest-gap'){
      let best=-Infinity;
      for(let candidate=1;candidate<sorted.length;candidate++){
        let score=0,samples=0;
        for(let row=Math.max(1,start+1);row<axial-1;row++){
          const left=Math.max(...sorted.slice(0,candidate).map(member=>nodeSections[row][member].max)),right=Math.min(...sorted.slice(candidate).map(member=>nodeSections[row][member].min)),span=Math.max(EPS,Math.max(...sorted.map(member=>nodeSections[row][member].max))-Math.min(...sorted.map(member=>nodeSections[row][member].min)));
          score+=(right-left)/span;samples++;
        }
        score/=Math.max(1,samples);if(score>best){best=score;cut=candidate;}
      }
    }
    if(sorted.length>2&&!options.branchGrouping){const separationRows=[],allAdjacentTouch=sorted.slice(0,-1).every((member,index)=>{let seen=false,last=start;for(let row=start;row<axial;row++)if(convexProfilesOverlap(nodeSections[row][member].points,nodeSections[row][sorted[index+1]].points)){seen=true;last=row;}separationRows.push(last);return seen;}),coincidenceTolerance=Math.max(2,Math.round((axial-start)*.36));if(allAdjacentTouch&&Math.max(...separationRows)-Math.min(...separationRows)<=coincidenceTolerance)return sorted.map(member=>[member]);}
    return [sorted.slice(0,cut),sorted.slice(cut)];
  };
  const requestedTipSeparation=Number.isFinite(Number(options.tipSeparation))?clamp(Number(options.tipSeparation)):0;
  const remainingBinaryDepth=(members,start)=>{if(members.length<=1)return 0;const groups=terminalSplit(members,start);if(groups.length<2||groups.some(group=>group.length===members.length))return 0;return 1+Math.max(...groups.map(group=>remainingBinaryDepth(group,start)));};
  const buildNode=(members,start,initialFront,initialBack)=>{
    const geometry=nodeGeometry(members),nodeSections=geometry.sections,minimum=start+Math.max(2,Math.min(5,Math.round(Number(options.minimumJunctionRows)||2))),junctionLead=Math.max(2,Math.round(axial*clamp(Number(options.junctionLeadFactor)||.14,.06,.3))),junctionBias=Math.round(Number(options.junctionRowBias)||0);let split=-1,childGroups=[],crotch=-1;
    const nodeOverlapRuns=[];let effectiveTipSeparation=requestedTipSeparation,detachedTipContact=false;if(members.length>1){childGroups=terminalSplit(members,start);const groupsTouch=(first,second,row)=>first.some(left=>second.some(right=>sectionsTouch(nodeSections[row][left],nodeSections[row][right]))),connected=row=>{if(members.length===2){const [first,second]=members.map(member=>nodeSections[row][member]),gap=Math.max(0,Math.max(first.min,second.min)-Math.min(first.max,second.max)),scale=((first.max-first.min)+(second.max-second.min))*.5;return gap<=scale*contactPaddingRatio;}for(let group=0;group<childGroups.length-1;group++)if(!groupsTouch(childGroups[group],childGroups[group+1],row))return false;return true;};let runStart=-1,lastConnected=start;for(let row=start;row<axial;row++){if(connected(row)){lastConnected=row;if(runStart<0)runStart=row;}else if(runStart>=0){nodeOverlapRuns.push({start:runStart,end:row-1});runStart=-1;}}if(runStart>=0)nodeOverlapRuns.push({start:runStart,end:axial-1});const contactSelection=contactRunSelection(nodeOverlapRuns,start,requestedTipSeparation),mainRun=contactSelection.primary,mainEnd=mainRun?mainRun.end:lastConnected;effectiveTipSeparation=contactSelection.effective;detachedTipContact=contactSelection.hasDetachedTipContact;const appliedLead=Math.round(junctionLead*effectiveTipSeparation),multiwayMinimum=childGroups.length>2?Math.max(minimum,start+Math.round((axial-start)*.5*(1-effectiveTipSeparation))):minimum;crotch=Math.round(lastConnected+(mainEnd-lastConnected)*effectiveTipSeparation);const desired=Math.max(detachedTipContact?mainEnd+1:-Infinity,crotch+1-appliedLead+junctionBias);if(options.qualityBinaryEvents){const childDepth=Math.max(0,...childGroups.map(group=>remainingBinaryDepth(group,start))),latestSplit=axial-1-childDepth;split=multiwayMinimum<=latestSplit?Math.min(latestSplit,Math.max(multiwayMinimum,desired)):-1;}else split=Math.max(multiwayMinimum,Math.min(axial-2,desired));}
    const rowFor=(row,front)=>members.length===1?tailAnchoredRow(row,front,members[0],start,geometry):forkEnvelopeRow(row,front,members,childGroups,geometry),end=split<0?axial-1:split-1,front=[initialFront||rowFor(start,true)],back=[initialBack||rowFor(start,false)],stride=Math.max(1,Math.min(3,Math.round(Number(options.loopPruneStride)||1)));for(let row=start+1;row<=end;row++){const protectedRow=row===start+1||row>=end-1,keep=stride===1||protectedRow||(row-start)%stride===0;if(!keep){prunedRows++;continue;}front.push(rowFor(row,true));back.push(rowFor(row,false));}
    const sorted=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),node={members:sorted,start,end,crotch,overlapRuns:nodeOverlapRuns,effectiveTipSeparation,detachedTipContact,front,back,children:[],geometry,outerLeft:sorted[0]===order[0],outerRight:sorted[sorted.length-1]===order[order.length-1]};nodes.push(node);
    if(split>=0){let offset=0;for(const group of childGroups){const sortedGroup=[...group].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),width=widthFor(sortedGroup),childFront=front[front.length-1].slice(offset,offset+width),childBack=back[back.length-1].slice(offset,offset+width);node.children.push(buildNode(sortedGroup,end,childFront,childBack));offset+=width-1;}}
    return node;
  };
  const root=buildNode(order,0);for(const node of nodes){if(node.outerLeft)node.front.forEach((row,i)=>{node.back[i][0]=row[0];});if(node.outerRight)node.front.forEach((row,i)=>{const last=row.length-1;node.back[i][last]=row[last];});}
  let insertedAlignmentLoops=0,removedAlignmentLoops=0,alignmentTargetSpacing=0;if(options.adaptiveLoopAlignment!==false){const rowCenter=(front,back)=>{const indices=[...front,...back],unique=[...new Set(indices)];return v3.scale(unique.reduce((sum,index)=>v3.add(sum,vertices[index]),[0,0,0]),1/Math.max(1,unique.length));},gap=(node,index)=>v3.len(v3.sub(rowCenter(node.front[index],node.back[index]),rowCenter(node.front[index+1],node.back[index+1]))),allGaps=[];for(const node of nodes)for(let row=0;row<node.front.length-1;row++){const distance=gap(node,row);if(distance>EPS)allGaps.push(distance);}allGaps.sort((a,b)=>a-b);alignmentTargetSpacing=allGaps.length?allGaps[Math.floor(allGaps.length/2)]:0;if(alignmentTargetSpacing>EPS){for(const node of nodes){for(let row=node.front.length-3;row>=2;row--){const before=gap(node,row-1),after=gap(node,row);if(before+after<alignmentTargetSpacing*.9){node.front.splice(row,1);node.back.splice(row,1);removedAlignmentLoops++;}}for(let row=node.front.length-2;row>=0;row--){const distance=gap(node,row),insertions=Math.min(2,Math.max(0,Math.ceil(distance/(alignmentTargetSpacing*1.28))-1));if(!insertions)continue;const frontRows=[],backRows=[];for(let step=1;step<=insertions;step++){const amount=step/(insertions+1),make=(first,second,side)=>first.map((index,column)=>pointIndex(v3.mix(vertices[index],vertices[second[column]],amount),side)),frontRow=make(node.front[row],node.front[row+1],'front'),backRow=make(node.back[row],node.back[row+1],'back');if(node.outerLeft)backRow[0]=frontRow[0];if(node.outerRight)backRow[backRow.length-1]=frontRow[frontRow.length-1];frontRows.push(frontRow);backRows.push(backRow);}node.front.splice(row+1,0,...frontRows);node.back.splice(row+1,0,...backRows);insertedAlignmentLoops+=insertions;}}}}
  const relaxGrid=(rows,strength,passes=2,lockTip=false)=>{if(strength<=0||rows.length<3||rows[0].length<3)return;for(let pass=0;pass<passes;pass++){const updates=[];for(let r=1;r<rows.length-1;r++){const rowT=r/(rows.length-1),localStrength=strength*(lockTip?(1-rowT)*(1-rowT):1);for(let c=1;c<rows[r].length-1;c++){const current=vertices[rows[r][c]],along=v3.scale(v3.add(vertices[rows[r-1][c]],vertices[rows[r+1][c]]),.5),across=v3.scale(v3.add(vertices[rows[r][c-1]],vertices[rows[r][c+1]]),.5);updates.push([rows[r][c],v3.mix(v3.mix(current,along,.28*localStrength),across,.1*localStrength)]);}}for(const [i,p] of updates)vertices[i]=p;}};const strength=clamp(flowSmooth);for(const node of nodes){const lockTip=!node.children.length&&node.members.length===1;relaxGrid(node.front,strength,2,lockTip);relaxGrid(node.back,strength,2,lockTip);}
  const reducedForkRails=0;
  const replaceIndex=(remove,keep)=>{if(remove===keep)return;for(const candidate of nodes)for(const rows of [candidate.front,candidate.back])for(const row of rows)for(let column=0;column<row.length;column++)if(row[column]===remove)row[column]=keep;};let crotchPoles=0,crotchSeamEdges=0;
  for(const node of nodes)if(node.children.length>1)for(let child=0;child<node.children.length-1;child++){
    const left=node.children[child],right=node.children[child+1],leftFront=left.front[0][left.front[0].length-1],leftBack=left.back[0][left.back[0].length-1],rightFront=right.front[0][0],rightBack=right.back[0][0],span=branch=>{const active=branch.members.map(member=>sections[node.end][member]);return Math.max(...active.map(section=>section.max))-Math.min(...active.map(section=>section.min));},keepLeft=span(left)>=span(right),frontKeep=keepLeft?leftFront:rightFront,backKeep=keepLeft?leftBack:rightBack;
    replaceIndex(leftFront,frontKeep);replaceIndex(rightFront,frontKeep);replaceIndex(leftBack,backKeep);replaceIndex(rightBack,backKeep);crotchSeamEdges++;
  }
  let crotchWelds=0;const crotchWeldRows=Math.max(0,Math.min(2,Math.round(Number.isFinite(Number(options.crotchWeldRows))?Number(options.crotchWeldRows):1))),weldPair=(leftRow,rightRow)=>{const leftIndex=leftRow[leftRow.length-1],rightIndex=rightRow[0],midpoint=v3.scale(v3.add(vertices[leftIndex],vertices[rightIndex]),.5);vertices[leftIndex]=midpoint;vertices[rightIndex]=midpoint;rightRow[0]=leftIndex;};
  for(const node of nodes)if(node.children.length>1)for(let child=0;child<node.children.length-1;child++){const left=node.children[child],right=node.children[child+1],available=Math.min(crotchWeldRows,left.front.length-1,right.front.length-1);for(let row=1;row<=available;row++){weldPair(left.front[row],right.front[row]);weldPair(left.back[row],right.back[row]);crotchWelds++;}left.crotchWeldRows=Math.max(left.crotchWeldRows||0,available);right.crotchWeldRows=Math.max(right.crotchWeldRows||0,available);}
  // Semantic welding deliberately keeps unrelated front and back vertices apart.
  // A row sample whose front/back envelope has actually collapsed is different:
  // both indices describe the same parametric silhouette point and must be one
  // vertex. Leaving the duplicate indices in place creates zero-area cap faces
  // and later makes the boundary-repair fan collapse onto one of its vertices.
  // Reuse only corresponding row/column samples at the exact weld precision, so
  // this cannot bridge nearby but unrelated sheets.
  if(options.semanticWeldOnly){
    const sameWeldPosition=(first,second)=>vertices[first].every((value,axis)=>Math.round(value*1e8)===Math.round(vertices[second][axis]*1e8));
    for(const node of nodes)for(let row=0;row<Math.min(node.front.length,node.back.length);row++)for(let column=0;column<Math.min(node.front[row].length,node.back[row].length);column++){
      const frontIndex=node.front[row][column],backIndex=node.back[row][column];if(frontIndex!==backIndex&&sameWeldPosition(frontIndex,backIndex))replaceIndex(backIndex,frontIndex);
    }
  }
  const faces=[],clean=(face,reverse=false)=>{const result=[];for(const i of face)if(result[result.length-1]!==i)result.push(i);if(result.length>1&&result[0]===result[result.length-1])result.pop();if(new Set(result).size>=3)faces.push(reverse?result.reverse():result);},connect=(rows,reverse=false)=>{for(let r=0;r<rows.length-1;r++)for(let c=0;c<rows[r].length-1;c++)clean([rows[r][c],rows[r+1][c],rows[r+1][c+1],rows[r][c+1]],reverse);},side=(front,back,column,reverse=false,startRow=0)=>{for(let r=startRow;r<front.length-1;r++)clean([front[r][column],back[r][column],back[r+1][column],front[r+1][column]],reverse);},cap=(front,back,reverse=false)=>{for(let c=0;c<front.length-1;c++){const a=front[c],b=front[c+1],cc=back[c+1],d=back[c],unique=[...new Set([a,b,cc,d])];if(unique.length===3)clean(unique,reverse);else if(unique.length===4){const ac=v3.len(v3.sub(vertices[a],vertices[cc])),bd=v3.len(v3.sub(vertices[b],vertices[d]));if(ac<=bd){clean([a,b,cc],reverse);clean([a,cc,d],reverse);}else{clean([a,b,d],reverse);clean([b,cc,d],reverse);}}}};
  const tipFan=(front,back,tip)=>{const pole=pointIndex(tip,'tip'),previous=front.length-2,perimeter=[...front[previous],...back[previous].slice().reverse()].filter((i,p,all)=>p===0||i!==all[p-1]);if(perimeter.length>1&&perimeter[0]===perimeter[perimeter.length-1])perimeter.pop();for(let i=0;i<perimeter.length;i++)clean([perimeter[i],pole,perimeter[(i+1)%perimeter.length]]);};
  for(const node of nodes){
    const leaf=!node.children.length,singleTip=leaf&&node.members.length===1&&node.front.length>1,front=singleTip?node.front.slice(0,-1):node.front,back=singleTip?node.back.slice(0,-1):node.back;
    connect(front);connect(back,true);const last=front[0].length-1,sideStart=node.crotchWeldRows||0;if(!node.outerLeft)side(front,back,0,true,sideStart);if(!node.outerRight)side(front,back,last,false,sideStart);if(node.children.length>1)for(let child=0;child<node.children.length-1;child++){const leftChild=node.children[child],rightChild=node.children[child+1],leftFront=leftChild.front[0][leftChild.front[0].length-1],leftBack=leftChild.back[0][leftChild.back[0].length-1],rightFront=rightChild.front[0][0],rightBack=rightChild.back[0][0];clean([leftBack,leftFront,rightFront,rightBack]);}
    if(singleTip)tipFan(node.front,node.back,strands[node.members[0]].samples[axial-1].c);else if(leaf)cap(front[front.length-1],back[back.length-1]);
  }cap(root.front[0],root.back[0],true);
  {
    const preWeldVertices=vertices.map(point=>[...point]),preWeldFaces=faces.map(face=>[...face]),positionMap=new Map(),welded=[],weldRemap=[];
    vertices.forEach((point,index)=>{const semantic=options.semanticWeldOnly?(vertexSides[index]||'neutral'):'any',key=`${semantic}:${point.map(value=>Math.round(value*1e8)).join(',')}`,known=positionMap.get(key);if(known===undefined){positionMap.set(key,welded.length);weldRemap[index]=welded.length;welded.push(point);}else weldRemap[index]=known;});
    const cleaned=[];for(const face of faces){const next=face.map(i=>weldRemap[i]).filter((i,p,all)=>p===0||i!==all[p-1]);if(next.length>1&&next[0]===next[next.length-1])next.pop();if(new Set(next).size>=3)cleaned.push(next);}faces.splice(0,faces.length,...cleaned);
    const edgeUse=new Map();for(const face of faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=a<b?`${a},${b}`:`${b},${a}`;edgeUse.set(key,(edgeUse.get(key)||0)+1);}const weldIsManifold=[...edgeUse.values()].every(count=>count===2);
    if(!weldIsManifold){vertices.splice(0,vertices.length,...preWeldVertices);faces.splice(0,faces.length,...preWeldFaces);}else vertices.splice(0,vertices.length,...welded);
  }
  const used=[...new Set(faces.flat())].sort((a,b)=>a-b),remap=new Map(used.map((old,index)=>[old,index])),compacted=used.map(i=>vertices[i]);vertices.splice(0,vertices.length,...compacted);for(const face of faces)for(let i=0;i<face.length;i++)face[i]=remap.get(face[i]);
  const edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;if(options.allowBoundaryRepair!==false){const boundaryUses=new Map();for(const face of faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=edgeKey(a,b);if(!boundaryUses.has(key))boundaryUses.set(key,[]);boundaryUses.get(key).push([a,b]);}const boundaryAdj=new Map(),unusedBoundary=new Set();for(const [key,list] of boundaryUses)if(list.length===1){const [a,b]=list[0];unusedBoundary.add(key);if(!boundaryAdj.has(a))boundaryAdj.set(a,[]);if(!boundaryAdj.has(b))boundaryAdj.set(b,[]);boundaryAdj.get(a).push(b);boundaryAdj.get(b).push(a);}while(unusedBoundary.size){const first=unusedBoundary.values().next().value,[start,nextStart]=first.split(',').map(Number),loop=[start];let previous=start,current=nextStart;unusedBoundary.delete(first);while(current!==start&&loop.length<=boundaryAdj.size+1){loop.push(current);const next=(boundaryAdj.get(current)||[]).find(value=>value!==previous&&unusedBoundary.has(edgeKey(current,value)));if(next===undefined)break;unusedBoundary.delete(edgeKey(current,next));previous=current;current=next;}if(current!==start||loop.length<3)continue;const center=v3.scale(loop.reduce((sum,index)=>v3.add(sum,vertices[index]),[0,0,0]),1/loop.length),centerIndex=vertices.length;vertices.push(center);for(let i=0;i<loop.length;i++)faces.push([loop[(i+1)%loop.length],loop[i],centerIndex]);}}
  {
    const edgeFaces=new Map(),adjacency=Array.from({length:faces.length},()=>[]);
    for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const face=faces[faceIndex];for(let edge=0;edge<face.length;edge++){const from=face[edge],to=face[(edge+1)%face.length],key=edgeKey(from,to);if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push({faceIndex,from,to});}}
    for(const uses of edgeFaces.values())if(uses.length===2){const [first,second]=uses,sameDirection=first.from===second.from;adjacency[first.faceIndex].push([second.faceIndex,sameDirection]);adjacency[second.faceIndex].push([first.faceIndex,sameDirection]);}
    const flip=Array(faces.length).fill(undefined),components=[];
    for(let start=0;start<faces.length;start++)if(flip[start]===undefined){const component=[],queue=[start];flip[start]=false;while(queue.length){const current=queue.pop();component.push(current);for(const [neighbor,sameDirection] of adjacency[current]){const required=flip[current]!==sameDirection;if(flip[neighbor]===undefined){flip[neighbor]=required;queue.push(neighbor);}}}components.push(component);}
    for(let faceIndex=0;faceIndex<faces.length;faceIndex++)if(flip[faceIndex])faces[faceIndex].reverse();
    for(const component of components){let volume=0;for(const faceIndex of component){const face=faces[faceIndex],origin=vertices[face[0]];for(let index=1;index<face.length-1;index++)volume+=v3.dot(origin,v3.cross(vertices[face[index]],vertices[face[index+1]]))/6;}if(volume<0)for(const faceIndex of component)faces[faceIndex].reverse();}
  }
  const triangles=[];for(const face of faces)for(let i=1;i<face.length-1;i++)triangles.push([face[0],face[i],face[i+1]]);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}const splitRows=nodes.filter(node=>node.children.length).map(node=>({members:node.members,row:node.end,children:node.children.map(child=>child.members),overlapRuns:node.overlapRuns,effectiveTipSeparation:node.effectiveTipSeparation,detachedTipContact:node.detachedTipContact}));
  const forkPanels=nodes.filter(node=>node.children.length).length;return {vertices,faces:triangles,objFaces:faces,bounds:{lo,hi},preservedStrands:0,remeshedGroups:1,axialLoops:axial,branchCount:nodes.filter(node=>!node.children.length).length,splitRows,topologyMode:'balanced-fork-layout',tipPoles:nodes.filter(node=>!node.children.length&&node.members.length===1).length,forkPanels,crotchWelds,crotchPoles,crotchSeamEdges,reducedForkRails,sourceLoopForks:forkPanels,crotchJoinMode:'two-sided-crotch-edge',topologyMutation:options.topologyMutation||'baseline',localNodeFrames:Boolean(options.localNodeFrames),prunedRows,insertedAlignmentLoops,removedAlignmentLoops,alignmentTargetSpacing,tipSeparation:requestedTipSeparation,preservedTailFrames:options.preserveTailFrames!==false};
}

function interTipForkPanelMesh(sourceSweeps,axialLoops=16){
  const axial=Math.max(10,Math.min(80,Math.round(axialLoops))),radial=Math.max(8,Math.min(24,Math.max(...sourceSweeps.map(s=>s.profile.length)))),across=Math.max(3,Math.min(8,Math.round(radial/3))),strands=sourceSweeps.map(s=>({samples:Array.from({length:axial},(_,i)=>sweepFrameAt(s,i/(axial-1))),profile:resampleClosedProfile(s.profile,radial)}));
  let seed=[1,0,0],seedLength=-1;for(let a=0;a<strands.length;a++)for(let b=a+1;b<strands.length;b++)for(let row=0;row<axial;row++){const delta=v3.sub(strands[b].samples[row].c,strands[a].samples[row].c),length=v3.dot(delta,delta);if(length>seedLength){seed=delta;seedLength=length;}}
  const frames=[];let previousU,previousV;for(let row=0;row<axial;row++){let tangent=[0,0,0],preferred=[0,0,0];for(const strand of strands){tangent=v3.add(tangent,strand.samples[row].t);preferred=v3.add(preferred,strand.samples[row].z);}tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[row].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({u,v});previousU=u;previousV=v;}
  const sections=Array.from({length:axial},(_,row)=>strands.map(strand=>projectedSection(strand.samples[row],strand.profile,frames[row].u,frames[row].v))),order=Array.from({length:strands.length},(_,i)=>i).sort((a,b)=>{let pa=0,pb=0;for(let row=Math.floor(axial/3);row<axial;row++){pa+=v3.dot(strands[a].samples[row].c,frames[row].u);pb+=v3.dot(strands[b].samples[row].c,frames[row].u);}return pa-pb;});
  const overlaps=(a,b,row)=>convexProfilesOverlap(sections[row][a].points,sections[row][b].points),crotches=[];for(let pair=0;pair<order.length-1;pair++){let lastOverlap=1,seen=false;for(let row=1;row<axial-1;row++){if(overlaps(order[pair],order[pair+1],row)){lastOverlap=row;seen=true;}else if(seen)break;}crotches.push(Math.max(2,Math.min(axial-2,lastOverlap+1)));}
  const gapStarts=crotches.map(row=>Math.max(.12,row/(axial-1)-.28)),tipStart=position=>position===0?gapStarts[0]:position===order.length-1?gapStarts[gapStarts.length-1]:Math.min(gapStarts[position-1],gapStarts[position]),railDefs=[{kind:'outerLeft',tEnd:1,startT:0},{kind:'tip',member:order[0],tEnd:1,startT:tipStart(0)}];for(let pair=0;pair<order.length-1;pair++){railDefs.push({kind:'crotch',left:order[pair],right:order[pair+1],tEnd:crotches[pair]/(axial-1),startT:gapStarts[pair]},{kind:'tip',member:order[pair+1],tEnd:1,startT:tipStart(pair+1)});}railDefs.push({kind:'outerRight',tEnd:1,startT:0});
  const targetAt=(definition,row)=>{const all=sections[row];if(definition.kind==='outerLeft')return Math.min(...all.map(section=>section.min));if(definition.kind==='outerRight')return Math.max(...all.map(section=>section.max));if(definition.kind==='tip')return v3.dot(strands[definition.member].samples[row].c,frames[row].u);return (v3.dot(strands[definition.left].samples[row].c,frames[row].u)+v3.dot(strands[definition.right].samples[row].c,frames[row].u))*.5;};
  const pointAtRowTarget=(row,target,front)=>{const frame=frames[row],active=sections[row].filter(section=>target>=section.min-1e-7&&target<=section.max+1e-7),nearest=sections[row].reduce((best,section)=>Math.min(Math.abs(target-section.min),Math.abs(target-section.max))<Math.min(Math.abs(target-best.min),Math.abs(target-best.max))?section:best,sections[row][0]),usable=active.length?active:[nearest],heights=usable.map(section=>{const envelope=profileEnvelope(section.points,clamp(target,section.min,section.max));return front?envelope.front:envelope.back;}),height=front?Math.max(...heights):Math.min(...heights),anchor=v3.scale(strands.reduce((sum,strand)=>v3.add(sum,strand.samples[row].c),[0,0,0]),1/strands.length);return v3.add(anchor,v3.add(v3.scale(frame.u,target-v3.dot(anchor,frame.u)),v3.scale(frame.v,height-v3.dot(anchor,frame.v))));},rawTargetAtT=(definition,t)=>{const q=clamp(t)*(axial-1),a=Math.floor(q),b=Math.min(axial-1,a+1);return targetAt(definition,a)+(targetAt(definition,b)-targetAt(definition,a))*(q-a);},centerTargetAtT=t=>{const q=clamp(t)*(axial-1),a=Math.floor(q),b=Math.min(axial-1,a+1),center=row=>order.reduce((sum,member)=>sum+v3.dot(strands[member].samples[row].c,frames[row].u),0)/order.length;return center(a)+(center(b)-center(a))*(q-a);},targetAtT=(definition,t)=>{const raw=rawTargetAtT(definition,t);if(definition.kind==='outerLeft'||definition.kind==='outerRight')return raw;const center=centerTargetAtT(t),amount=clamp((t-definition.startT)/Math.max(definition.tEnd-definition.startT,EPS)),smooth=amount*amount*(3-2*amount);return center+(raw-center)*smooth;},surfaceAtTU=(t,target,front)=>{const q=clamp(t)*(axial-1),a=Math.floor(q),b=Math.min(axial-1,a+1);return v3.mix(pointAtRowTarget(a,target,front),pointAtRowTarget(b,target,front),q-a);},surfaceAt=(definition,s,front)=>{const t=clamp(s*definition.tEnd);if(definition.kind==='tip'&&t>=1-EPS)return strands[definition.member].samples[axial-1].c;return surfaceAtTU(t,targetAtT(definition,t),front);};
  const root={t:0,u:centerTargetAtT(0)},tips=order.map(member=>({t:1,u:rawTargetAtT({kind:'tip',member},1),tipMember:member})),crotchControls=crotches.map((row,pair)=>({t:row/(axial-1),u:rawTargetAtT({kind:'crotch',left:order[pair],right:order[pair+1]},row/(axial-1))})),junctions=gapStarts.map((t,pair)=>({t,u:rawTargetAtT({kind:'crotch',left:order[pair],right:order[pair+1]},t)})),patches=[];
  patches.push([root,tips[0],junctions[0]]);for(let gap=0;gap<junctions.length;gap++){patches.push([junctions[gap],tips[gap],crotchControls[gap]],[junctions[gap],crotchControls[gap],tips[gap+1]]);if(gap<junctions.length-1)patches.push([junctions[gap],tips[gap+1],junctions[gap+1]],[root,junctions[gap],junctions[gap+1]]);}patches.push([root,junctions[junctions.length-1],tips[tips.length-1]]);
  const vertices=[],triangles=[],objFaces=[],vertexMap=new Map(),mapped=(control,front)=>control.tipMember!==undefined&&control.t>=1-EPS?strands[control.tipMember].samples[axial-1].c:surfaceAtTU(control.t,control.u,front),indexFor=(control,front)=>{const key=`${front?'f':'b'}:${Math.round(control.t*1e8)}:${Math.round(control.u*1e8)}`;if(vertexMap.has(key))return vertexMap.get(key);const index=vertices.length;vertices.push(mapped(control,front));vertexMap.set(key,index);return index;},subdiv=Math.max(3,Math.min(8,across));
  const addPatch=(corners,front)=>{const grid=[],local=[];for(let i=0;i<=subdiv;i++){const row=[];for(let j=0;j<=subdiv-i;j++){const b=i/subdiv,c=j/subdiv,a=1-b-c,control={t:corners[0].t*a+corners[1].t*b+corners[2].t*c,u:corners[0].u*a+corners[1].u*b+corners[2].u*c};if(b>1-EPS&&corners[1].tipMember!==undefined)control.tipMember=corners[1].tipMember;if(c>1-EPS&&corners[2].tipMember!==undefined)control.tipMember=corners[2].tipMember;if(a>1-EPS&&corners[0].tipMember!==undefined)control.tipMember=corners[0].tipMember;row.push(indexFor(control,front));}grid.push(row);}for(let i=0;i<subdiv;i++)for(let j=0;j<subdiv-i;j++){const first=front?[grid[i][j],grid[i+1][j],grid[i][j+1]]:[grid[i][j],grid[i][j+1],grid[i+1][j]];triangles.push(first);local.push(first);if(j<subdiv-i-1){const second=front?[grid[i+1][j],grid[i+1][j+1],grid[i][j+1]]:[grid[i+1][j],grid[i][j+1],grid[i+1][j+1]];triangles.push(second);local.push(second);}}const paired=pairTriangles({vertices,faces:local});objFaces.push(...paired.objFaces);};for(const patch of patches){addPatch(patch,true);addPatch(patch,false);}
  const boundary=[root];for(let i=0;i<tips.length;i++){boundary.push(tips[i]);if(i<crotchControls.length)boundary.push(crotchControls[i]);}const sideSteps=subdiv;for(let segment=0;segment<boundary.length;segment++){const a=boundary[segment],b=boundary[(segment+1)%boundary.length];for(let step=0;step<sideSteps;step++){const p=step/sideSteps,q=(step+1)/sideSteps,at=amount=>({t:a.t+(b.t-a.t)*amount,u:a.u+(b.u-a.u)*amount,tipMember:amount< EPS?a.tipMember:amount>1-EPS?b.tipMember:undefined}),fa=indexFor(at(p),true),fb=indexFor(at(p),false),na=indexFor(at(q),true),nb=indexFor(at(q),false),quad=[fa,fb,nb,na];objFaces.push(quad);triangles.push([quad[0],quad[1],quad[2]],[quad[0],quad[2],quad[3]]);}}
  const positionMap=new Map(),welded=[],remap=[];vertices.forEach((vertex,index)=>{const key=vertex.map(value=>Math.round(value*1e8)).join(','),known=positionMap.get(key);if(known===undefined){positionMap.set(key,welded.length);remap[index]=welded.length;welded.push(vertex);}else remap[index]=known;});const cleanFace=face=>{const next=face.map(index=>remap[index]).filter((index,position,array)=>position===0||index!==array[position-1]);if(next.length>1&&next[0]===next[next.length-1])next.pop();return new Set(next).size>=3?next:null;},cleanTriangles=triangles.map(cleanFace).filter(Boolean),cleanObj=objFaces.map(cleanFace).filter(Boolean),mesh={vertices:welded,faces:cleanTriangles,objFaces:cleanObj};let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const vertex of mesh.vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],vertex[axis]);hi[axis]=Math.max(hi[axis],vertex[axis]);}
  Object.assign(mesh,{bounds:{lo,hi},preservedStrands:0,remeshedGroups:1,axialLoops:axial,branchCount:order.length,topologyMode:'inter-tip-fork-panels',tipPoles:order.length,forkPanels:(order.length-1)*2,crotchRows:crotches});return mesh;
}

const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];

const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];

function polygoniseTet(ids,ps,vs,grad,out){
  const ins=ids.filter(i=>vs[i]<0),outs=ids.filter(i=>vs[i]>=0);if(!ins.length||!outs.length)return;
  const cut=(i,j)=>{const t=vs[i]/(vs[i]-vs[j]+EPS);return v3.mix(ps[i],ps[j],clamp(t));};
  const tri=(a,b,c)=>{const n=v3.cross(v3.sub(b,a),v3.sub(c,a));if(v3.dot(n,grad)<0)out.push(a,c,b);else out.push(a,b,c);};
  if(ins.length===1){const a=ins[0];tri(cut(a,outs[0]),cut(a,outs[1]),cut(a,outs[2]));}
  else if(ins.length===3){const a=outs[0];tri(cut(a,ins[0]),cut(a,ins[2]),cut(a,ins[1]));}
  else {const a=ins[0],b=ins[1],c=outs[0],d=outs[1],ac=cut(a,c),ad=cut(a,d),bc=cut(b,c),bd=cut(b,d);tri(ac,ad,bc);tri(ad,bd,bc);}
}

function weld(flat,cell){
  const map=new Map(),vertices=[],faces=[],q=1/(cell*1e-4);
  for(let i=0;i<flat.length;i+=3){const face=[];for(let j=0;j<3;j++){const p=flat[i+j],key=`${Math.round(p[0]*q)},${Math.round(p[1]*q)},${Math.round(p[2]*q)}`;let id=map.get(key);if(id===undefined){id=vertices.length;map.set(key,id);vertices.push(p);}face.push(id);}if(new Set(face).size===3)faces.push(face);}
  return {vertices,faces};
}

function smoothMesh(mesh,passes){
  if(!passes)return mesh;const near=Array.from({length:mesh.vertices.length},()=>new Set());for(const f of mesh.faces){near[f[0]].add(f[1]).add(f[2]);near[f[1]].add(f[0]).add(f[2]);near[f[2]].add(f[0]).add(f[1]);}
  for(let p=0;p<passes;p++){const old=mesh.vertices,neu=old.map((v,i)=>{if(!near[i].size)return v;let avg=[0,0,0];for(const j of near[i])avg=v3.add(avg,old[j]);avg=v3.scale(avg,1/near[i].size);return v3.mix(v,avg,.28);});mesh.vertices=neu;}return mesh;
}

function pairTriangles(mesh){
  const edges=new Map(),paired=new Uint8Array(mesh.faces.length),candidates=[];
  const key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  mesh.faces.forEach((f,fi)=>{for(let i=0;i<3;i++){const k=key(f[i],f[(i+1)%3]);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(fi);}});
  for(const [shared,fs] of edges)if(fs.length===2){const f0=mesh.faces[fs[0]],f1=mesh.faces[fs[1]],all=[...new Set([...f0,...f1])];if(all.length!==4)continue;const n0=v3.norm(v3.cross(v3.sub(mesh.vertices[f0[1]],mesh.vertices[f0[0]]),v3.sub(mesh.vertices[f0[2]],mesh.vertices[f0[0]]))),n1=v3.norm(v3.cross(v3.sub(mesh.vertices[f1[1]],mesh.vertices[f1[0]]),v3.sub(mesh.vertices[f1[2]],mesh.vertices[f1[0]])));candidates.push({fs,shared,score:Math.abs(v3.dot(n0,n1))});}
  candidates.sort((a,b)=>b.score-a.score);const objFaces=[];
  for(const c of candidates){const [fa,fb]=c.fs;if(paired[fa]||paired[fb]||c.score<.72)continue;const counts=new Map(),boundary=[];for(const fi of [fa,fb]){const f=mesh.faces[fi];for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],k=key(a,b);counts.set(k,(counts.get(k)||0)+1);}}
    for(const fi of [fa,fb]){const f=mesh.faces[fi];for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3];if(counts.get(key(a,b))===1)boundary.push([a,b]);}}
    const adj=new Map();for(const [a,b] of boundary){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}const q=[boundary[0][0]];let prev=-1,cur=q[0];while(q.length<4){const next=(adj.get(cur)||[]).find(v=>v!==prev&&!q.includes(v));if(next===undefined)break;q.push(next);prev=cur;cur=next;}if(q.length===4){objFaces.push(q);paired[fa]=paired[fb]=1;}
  }
  mesh.faces.forEach((f,i)=>{if(!paired[i])objFaces.push(f);});mesh.objFaces=objFaces;return mesh;
}

async function remeshGroup(sweeps,resolution,smoothPasses,onProgress){
  const {lo,hi}=boundsOf(sweeps),span=v3.sub(hi,lo),cell=Math.max(...span)/resolution,nx=Math.ceil(span[0]/cell)+1,ny=Math.ceil(span[1]/cell)+1,nz=Math.ceil(span[2]/cell)+1;
  const field=new Float32Array(nx*ny*nz),idx=(x,y,z)=>x+nx*(y+ny*z);
  for(let z=0;z<nz;z++){for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const p=[lo[0]+x*cell,lo[1]+y*cell,lo[2]+z*cell];let d=Infinity;for(const s of sweeps)d=Math.min(d,sweepDistance(p,s));field[idx(x,y,z)]=d;}if(z%3===0){onProgress(.72*z/(nz-1),'Sampling union');await new Promise(requestAnimationFrame);}}
  const flat=[];
  for(let z=0;z<nz-1;z++){for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){const ps=corner.map(c=>[lo[0]+(x+c[0])*cell,lo[1]+(y+c[1])*cell,lo[2]+(z+c[2])*cell]),vs=corner.map(c=>field[idx(x+c[0],y+c[1],z+c[2])]);if(vs.every(v=>v>=0)||vs.every(v=>v<0))continue;const grad=[(vs[1]+vs[2]+vs[5]+vs[6]-vs[0]-vs[3]-vs[4]-vs[7]),(vs[2]+vs[3]+vs[6]+vs[7]-vs[0]-vs[1]-vs[4]-vs[5]),(vs[4]+vs[5]+vs[6]+vs[7]-vs[0]-vs[1]-vs[2]-vs[3])];for(const tet of tetrahedra)polygoniseTet(tet,ps,vs,grad,flat);}if(z%5===0){onProgress(.72+.22*z/(nz-2),'Extracting closed surface');await new Promise(requestAnimationFrame);}}
  onProgress(.98,'Cleaning junction');const mesh=smoothMesh(weld(flat,cell),smoothPasses);mesh.bounds={lo,hi};mesh.objFaces=mesh.faces;mesh.preservedStrands=0;mesh.remeshedGroups=1;onProgress(1,'Ready');return mesh;
}

async function unionSweeps(sweeps,resolution=64,smoothPasses=2,onProgress=()=>{},options={}){
  const topologyStrategy=options.topologyStrategy||'balanced';
  const groups=overlapGroups(sweeps),meshes=[];
  for(let i=0;i<groups.length;i++){
    const group=groups[i],start=i/groups.length,share=1/groups.length;
    if(group.length===1){onProgress(start,`Preserving strand ${i+1}/${groups.length}`);meshes.push(sourceSweepMesh(group[0]));}
    else if(topologyStrategy==='voxel'){onProgress(start+.1*share,'Building implicit union control');meshes.push(await remeshGroup(group,Math.max(24,resolution*2),smoothPasses,onProgress));}
    else if(group.length===2){onProgress(start+.2*share,'Building shared curve grid');await new Promise(requestAnimationFrame);meshes.push(branchedCurveMesh(group,resolution,smoothPasses,options));onProgress(start+share,'Curve topology ready');}
    else if(topologyStrategy==='single-junction'){onProgress(start+.2*share,`Building one ${group.length}-way junction`);await new Promise(requestAnimationFrame);meshes.push(multiBranchedCurveMesh(group,resolution,smoothPasses));onProgress(start+share,'Single junction layout ready');}
    else if(topologyStrategy==='inter-tip'){onProgress(start+.2*share,`Building inter-tip fork panels`);await new Promise(requestAnimationFrame);meshes.push(interTipForkPanelMesh(group,resolution));onProgress(start+share,'Inter-tip panel layout ready');}
    else{onProgress(start+.2*share,`Building ${group.length}-strand fork layout`);await new Promise(requestAnimationFrame);meshes.push(hierarchicalCurveMesh(group,resolution,smoothPasses,options));onProgress(start+share,'Balanced fork layout ready');}
  }
  let result=combineMeshes(meshes);result.generationStrategy=topologyStrategy;if(sweeps.length>8)result.regionalCharts=groups.length;if(Number(options.collisionCleanupPasses)>0){onProgress(.98,'Resolving junction intersections');result=untangleMesh(result,options.collisionCleanupPasses,options.collisionCleanupStrength);}onProgress(1,'Ready');return result;
}

function validateTopology(mesh){
  const faces=mesh.objFaces||mesh.faces||[],edgeUses=new Map(),vertexFaces=Array.from({length:mesh.vertices.length},()=>[]),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  faces.forEach((face,faceIndex)=>{for(const vertex of face)if(vertexFaces[vertex])vertexFaces[vertex].push(faceIndex);for(let i=0;i<face.length;i++){const edge=key(face[i],face[(i+1)%face.length]);edgeUses.set(edge,(edgeUses.get(edge)||0)+1);}});
  let boundaryEdges=0,nonManifoldEdges=0;for(const count of edgeUses.values()){if(count===1)boundaryEdges++;else if(count!==2)nonManifoldEdges++;}
  const edgeFaces=new Map();faces.forEach((face,faceIndex)=>{for(let i=0;i<face.length;i++){const edge=key(face[i],face[(i+1)%face.length]);if(!edgeFaces.has(edge))edgeFaces.set(edge,[]);edgeFaces.get(edge).push(faceIndex);}});const adjacent=Array.from({length:faces.length},()=>[]);for(const list of edgeFaces.values())for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){adjacent[list[a]].push(list[b]);adjacent[list[b]].push(list[a]);}let components=0;const seen=new Set();for(let start=0;start<faces.length;start++)if(!seen.has(start)){components++;const stack=[start];seen.add(start);while(stack.length){const face=stack.pop();for(const next of adjacent[face])if(!seen.has(next)){seen.add(next);stack.push(next);}}}
  const watertight=faces.length>0&&boundaryEdges===0&&nonManifoldEdges===0,eulerCharacteristic=mesh.vertices.length-edgeUses.size+faces.length,totalGenus=watertight?Math.max(0,(2*components-eulerCharacteristic)/2):null;return {vertices:mesh.vertices.length,edges:edgeUses.size,faces:faces.length,quads:faces.filter(face=>face.length===4).length,triangles:faces.filter(face=>face.length===3).length,ngons:faces.filter(face=>face.length>4).length,boundaryEdges,nonManifoldEdges,components,eulerCharacteristic,totalGenus,watertight};
}

function detectPenetrations(mesh,maxCandidatePairs=250000,collectPairs=false){
  const sourceFaces=mesh.objFaces||mesh.faces||[],vertices=mesh.vertices||[],triangles=[];
  for(const face of sourceFaces)for(let index=1;index<face.length-1;index++)triangles.push([face[0],face[index],face[index+1]]);
  if(triangles.length<2)return {trianglePairs:0,candidatesTested:0,truncated:false};
  const bounds=mesh.bounds||(()=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}return {lo,hi};})(),diagonal=Math.max(v3.len(v3.sub(bounds.hi,bounds.lo)),EPS),division=Math.max(10,Math.min(42,Math.round(Math.cbrt(triangles.length)*1.35))),cell=diagonal/division,grid=new Map(),triangleBounds=[];
  for(let triangleIndex=0;triangleIndex<triangles.length;triangleIndex++){
    const points=triangles[triangleIndex].map(index=>vertices[index]),lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.min(...points.map(p=>p[2]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),Math.max(...points.map(p=>p[2]))];triangleBounds.push({lo,hi});
    const first=lo.map((value,axis)=>Math.floor((value-bounds.lo[axis])/cell)),last=hi.map((value,axis)=>Math.floor((value-bounds.lo[axis])/cell));
    for(let x=first[0];x<=last[0];x++)for(let y=first[1];y<=last[1];y++)for(let z=first[2];z<=last[2];z++){const key=`${x},${y},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(triangleIndex);}
  }
  const pairs=new Set();let truncated=false;
  outer:for(const members of grid.values())for(let a=0;a<members.length;a++)for(let b=a+1;b<members.length;b++){const i=members[a],j=members[b],key=i<j?`${i},${j}`:`${j},${i}`;pairs.add(key);if(pairs.size>=maxCandidatePairs){truncated=true;break outer;}}
  const segmentTriangle=(start,end,a,b,c)=>{const direction=v3.sub(end,start),edge1=v3.sub(b,a),edge2=v3.sub(c,a),h=v3.cross(direction,edge2),det=v3.dot(edge1,h),epsilon=1e-8;if(Math.abs(det)<epsilon)return false;const inverse=1/det,s=v3.sub(start,a),u=inverse*v3.dot(s,h);if(u<=epsilon||u>=1-epsilon)return false;const q=v3.cross(s,edge1),v=inverse*v3.dot(direction,q);if(v<=epsilon||u+v>=1-epsilon)return false;const t=inverse*v3.dot(edge2,q);return t>epsilon&&t<1-epsilon;},boundsOverlap=(a,b)=>a.lo[0]<=b.hi[0]&&a.hi[0]>=b.lo[0]&&a.lo[1]<=b.hi[1]&&a.hi[1]>=b.lo[1]&&a.lo[2]<=b.hi[2]&&a.hi[2]>=b.lo[2],intersects=(first,second)=>{const a=first.map(index=>vertices[index]),b=second.map(index=>vertices[index]);for(let edge=0;edge<3;edge++)if(segmentTriangle(a[edge],a[(edge+1)%3],b[0],b[1],b[2])||segmentTriangle(b[edge],b[(edge+1)%3],a[0],a[1],a[2]))return true;return false;};
  let trianglePairs=0,candidatesTested=0;const intersections=[];for(const pair of pairs){const [firstIndex,secondIndex]=pair.split(',').map(Number),first=triangles[firstIndex],second=triangles[secondIndex];if(first.some(index=>second.includes(index))||!boundsOverlap(triangleBounds[firstIndex],triangleBounds[secondIndex]))continue;candidatesTested++;if(intersects(first,second)){trianglePairs++;if(collectPairs)intersections.push([first,second]);}}
  return {trianglePairs,candidatesTested,truncated,...(collectPairs?{intersections}:{})};
}

function untangleMesh(mesh,passes=12,strength=.003){
  const result={...mesh,vertices:mesh.vertices.map(point=>[...point]),faces:(mesh.faces||[]).map(face=>[...face]),objFaces:(mesh.objFaces||mesh.faces||[]).map(face=>[...face])},start=detectPenetrations(result).trianglePairs;if(!start)return result;
  const diagonal=Math.max(EPS,v3.len(v3.sub(result.bounds.hi,result.bounds.lo))),step=diagonal*Math.max(.0002,Math.min(.004,Number(strength)||.003));let bestVertices=result.vertices.map(point=>[...point]),bestCount=start;
  for(let pass=0;pass<Math.max(1,Math.min(16,Math.round(passes)));pass++){
    const scan=detectPenetrations(result,250000,true);if(!scan.trianglePairs)break;const offsets=Array.from({length:result.vertices.length},()=>[0,0,0]),weights=new Uint16Array(result.vertices.length);
    for(const [first,second] of scan.intersections){const centroid=triangle=>v3.scale(triangle.reduce((sum,index)=>v3.add(sum,result.vertices[index]),[0,0,0]),1/3),a=centroid(first),b=centroid(second);let direction=v3.sub(b,a);if(v3.len(direction)<EPS){const p=first.map(index=>result.vertices[index]);direction=v3.cross(v3.sub(p[1],p[0]),v3.sub(p[2],p[0]));}direction=v3.norm(direction);for(const index of first){offsets[index]=v3.sub(offsets[index],direction);weights[index]++;}for(const index of second){offsets[index]=v3.add(offsets[index],direction);weights[index]++;}}
    result.vertices=result.vertices.map((point,index)=>weights[index]?v3.add(point,v3.scale(v3.norm(offsets[index]),step*(1-pass/(passes*2)))):point);const next=detectPenetrations(result).trianglePairs,valid=validateTopology(result);if(valid.boundaryEdges||valid.nonManifoldEdges||valid.ngons)break;if(next<bestCount){bestCount=next;bestVertices=result.vertices.map(point=>[...point]);}else if(pass>2)break;
  }
  result.vertices=bestVertices;let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of result.vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}result.bounds={lo,hi};result.penetrationsBeforeCleanup=start;result.penetrationsAfterCleanup=bestCount;result.collisionCleanupApplied=bestCount<start;return result;
}

return unionSweeps;
}
export const curveUnionV1 = createCurveUnionRuntime();
