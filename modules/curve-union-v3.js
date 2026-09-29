// Imported Curve Union 3.0 dependency closure; do not hand-edit.
// core.js: 97e014827051ece0e1172518498ae59576de2a86c8cff4080c7b54928014db8f
// curve-union-v2.js: 7ffd6ce4239cbd156ca20add65ac3fb380a2de1434af7fb0da1495c4bdf041ad
// curve-union-v3.js: 2532136e7fabb4d4ac809c9cdd6221c6ac657ef254de073c8e763cd0dfcffeda
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

function qualityContactSurface(sweep){
  // Contact probes deliberately use every authored frame, including tiny
  // terminal rings. The output-preservation mesh is allowed to prune those
  // rings for clean caps, but doing so must not change contact classification.
  const mesh=sourceSweepMesh(sweep),radial=sweep.profile.length,rows=sweep.frames.length,radii=sweep.frames.map(frame=>Math.max(frame.width,frame.depth)).sort((a,b)=>a-b),radius=radii[Math.floor(radii.length/2)]||EPS;let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of mesh.vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}mesh.bounds={lo,hi};
  return {mesh,radial,rows,radius,sweep};
}

function qualityBoundsGap(first,second){
  let squared=0;for(let axis=0;axis<3;axis++){const gap=Math.max(0,first.lo[axis]-second.hi[axis],second.lo[axis]-first.hi[axis]);squared+=gap*gap;}return Math.sqrt(squared);
}

function qualitySurfaceClearance(source,targetSweep,scale){
  const rows=[],columnStride=Math.max(1,Math.floor(source.radial/12));let minimum=Infinity;
  for(let row=0;row<source.rows;row++){
    let rowMinimum=sweepDistance(source.mesh.vertices[row*source.radial],targetSweep);
    for(let column=columnStride;column<source.radial;column+=columnStride)rowMinimum=Math.min(rowMinimum,sweepDistance(source.mesh.vertices[row*source.radial+column],targetSweep));
    // A strand fully nested inside a broader one has no surface crossing, but
    // its centre is still inside the other volume and must join the component.
    rowMinimum=Math.min(rowMinimum,sweepDistance(source.sweep.frames[row].c,targetSweep));
    const normalized=rowMinimum/Math.max(scale,EPS);rows.push(normalized);minimum=Math.min(minimum,normalized);
  }
  return {minimum,rows};
}

function qualityCrossSurfaceCount(first,second){
  const split=first.mesh.vertices.length,combined=combineMeshes([first.mesh,second.mesh]),scan=detectPenetrations(combined,75000,true);let count=0;
  for(const [a,b] of scan.intersections||[]){const aFirst=a.every(index=>index<split),aSecond=a.every(index=>index>=split),bFirst=b.every(index=>index<split),bSecond=b.every(index=>index>=split);if((aFirst&&bSecond)||(aSecond&&bFirst))count++;}
  return count;
}

function qualitySweepInteraction(a,b,mergeDistance=0,surfaceA=null,surfaceB=null){
  const samples=25,clearances=[],contacts=[];let minimum=Infinity,deepest=0;
  for(let index=0;index<samples;index++){
    const first=sweepFrameAt(a,index/(samples-1));let best=Infinity,bestDepth=0;
    for(let other=0;other<samples;other++){
      const second=sweepFrameAt(b,other/(samples-1)),reach=Math.max(first.width,first.depth)+Math.max(second.width,second.depth),clearance=(v3.len(v3.sub(first.c,second.c))-reach*.92)/Math.max(reach,EPS);
      if(clearance<best){best=clearance;bestDepth=Math.max(0,-clearance);}
    }
    clearances.push(best);contacts.push(best<=mergeDistance);minimum=Math.min(minimum,best);deepest=Math.max(deepest,bestDepth);
  }
  const firstSurface=surfaceA||qualityContactSurface(a),secondSurface=surfaceB||qualityContactSurface(b),scale=Math.max(firstSurface.radius+secondSurface.radius,EPS),boundsGap=qualityBoundsGap(firstSurface.mesh.bounds,secondSurface.mesh.bounds),probeLimit=(Math.max(0,mergeDistance)+.04)*scale;
  let surfaceMinimum=boundsGap/scale,sourceCrossings=0,surfaceRows=[];
  if(boundsGap<=probeLimit){
    const forward=qualitySurfaceClearance(firstSurface,b,scale),backward=qualitySurfaceClearance(secondSurface,a,scale);surfaceMinimum=Math.min(forward.minimum,backward.minimum);surfaceRows=[...forward.rows,...backward.rows];
    // Signed probes catch ordinary overlap and full containment. A triangle
    // crossing can still occur without a sampled vertex entering either solid,
    // so use the exact cross-mesh scan only for the narrow ambiguous band.
    if(surfaceMinimum<=Math.max(.03,mergeDistance+.01))sourceCrossings=qualityCrossSurfaceCount(firstSurface,secondSurface);
  }
  const runStats=threshold=>{let longestRun=0,run=0,contactSamples=0;for(const clearance of surfaceRows){if(clearance<=threshold){run++;contactSamples++;longestRun=Math.max(longestRun,run);}else run=0;}return {longestRun,contactSamples};},actualStats=runStats(-1e-4),nearStats=surfaceRows.length?runStats(Math.max(0,mergeDistance)):(()=>{let longestRun=0,run=0,contactSamples=0;for(const contact of contacts){if(contact){run++;contactSamples++;longestRun=Math.max(longestRun,run);}else run=0;}return {longestRun,contactSamples};})();
  // A one-row crown/root graze is not enough evidence for an automatic union:
  // it produces a very short fork with worse topology than preserving both
  // authored sweeps. A clear surface crossing or persistent buried run is.
  const persistentOverlap=actualStats.longestRun>=2||actualStats.contactSamples>=3,actualOverlap=persistentOverlap||sourceCrossings>0,shallowContact=surfaceMinimum<=1e-4&&!actualOverlap,nearPersistent=nearStats.longestRun>=2||nearStats.contactSamples>=3,connected=actualOverlap||(mergeDistance>0&&surfaceMinimum<=mergeDistance&&(nearPersistent||shallowContact));
  return {connected,actualOverlap,shallowContact,minimumClearance:minimum,surfaceClearance:surfaceMinimum,boundsGap:boundsGap/scale,sourceCrossings,deepestOverlap:Math.max(deepest,Math.max(0,-surfaceMinimum)),longestRun:nearStats.longestRun,contactSamples:nearStats.contactSamples};
}

function qualityOverlapGroups(sweeps,mergeDistance=0){
  const parent=sweeps.map((_,index)=>index),find=index=>parent[index]===index?index:(parent[index]=find(parent[index])),join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;},edges=[],surfaces=sweeps.map(qualityContactSurface);
  for(let first=0;first<sweeps.length;first++)for(let second=first+1;second<sweeps.length;second++){const interaction=qualitySweepInteraction(sweeps[first],sweeps[second],mergeDistance,surfaces[first],surfaces[second]);if(interaction.connected){join(first,second);edges.push({first,second,...interaction});}}
  const grouped=new Map();for(let index=0;index<sweeps.length;index++){const root=find(index);if(!grouped.has(root))grouped.set(root,[]);grouped.get(root).push(index);}
  return {groups:[...grouped.values()].map(indices=>indices.map(index=>sweeps[index])),groupIndices:[...grouped.values()].map(indices=>[...indices]),edges};
}

function combineMeshes(meshes){
  const out={vertices:[],faces:[],objFaces:[],preservedStrands:0,remeshedGroups:0};
  for(const m of meshes){const o=out.vertices.length;out.vertices.push(...m.vertices);out.faces.push(...m.faces.map(f=>f.map(i=>i+o)));out.objFaces.push(...(m.objFaces||m.faces).map(f=>f.map(i=>i+o)));out.preservedStrands+=m.preservedStrands||0;out.remeshedGroups+=m.remeshedGroups||0;}
  const atlasMeshes=meshes.filter(mesh=>['tip-anchored-rail-atlas','inter-tip-fork-panels','balanced-fork-layout','single-junction-loop'].includes(mesh.topologyMode));if(atlasMeshes.length){out.topologyMode=atlasMeshes.some(mesh=>mesh.topologyMode==='single-junction-loop')?'single-junction-loop':atlasMeshes.some(mesh=>mesh.topologyMode==='balanced-fork-layout')?'balanced-fork-layout':atlasMeshes.some(mesh=>mesh.topologyMode==='inter-tip-fork-panels')?'inter-tip-fork-panels':'tip-anchored-rail-atlas';out.tipPoles=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.tipPoles||0),0);out.forkPanels=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.forkPanels||0),0);out.crotchWelds=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchWelds||0),0);out.crotchPoles=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchPoles||0),0);out.crotchSeamEdges=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.crotchSeamEdges||0),0);out.reducedForkRails=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.reducedForkRails||0),0);out.sourceLoopForks=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.sourceLoopForks||0),0);out.crotchJoinMode=atlasMeshes.some(mesh=>mesh.crotchJoinMode==='two-sided-crotch-edge')?'two-sided-crotch-edge':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='collapsed-crotch-pole')?'collapsed-crotch-pole':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='reduced-rail-split')?'reduced-rail-split':atlasMeshes.some(mesh=>mesh.crotchJoinMode==='split-bridge')?'split-bridge':out.forkPanels&&out.sourceLoopForks===out.forkPanels?'source-loop-zipper':out.crotchWelds?'mixed':'none';out.junctionLoops=atlasMeshes.reduce((sum,mesh)=>sum+(mesh.junctionLoops||0),0);out.splitRows=atlasMeshes.flatMap(mesh=>mesh.splitRows||[]);}out.prunedRows=meshes.reduce((sum,mesh)=>sum+(mesh.prunedRows||0),0);out.topologyMutations=[...new Set(meshes.map(mesh=>mesh.topologyMutation).filter(Boolean))];
  out.jointRows=meshes.map(mesh=>mesh.jointRow).filter(Number.isFinite);out.overlapRuns=meshes.flatMap(mesh=>mesh.overlapRuns||[]);out.effectiveTipSeparations=meshes.map(mesh=>mesh.effectiveTipSeparation).filter(Number.isFinite);out.detachedTipContacts=meshes.filter(mesh=>mesh.detachedTipContact).length;out.insertedAlignmentLoops=meshes.reduce((sum,mesh)=>sum+(mesh.insertedAlignmentLoops||0),0);out.removedAlignmentLoops=meshes.reduce((sum,mesh)=>sum+(mesh.removedAlignmentLoops||0),0);out.alignmentTargetSpacing=meshes.map(mesh=>mesh.alignmentTargetSpacing).filter(Number.isFinite);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of out.vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}out.bounds={lo,hi};return out;
}

function buildSourceMesh(sweeps){return combineMeshes(sweeps.map(sourceSweepMesh));}

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

function sweepSegmentFraction(sweep,index,amount){
  const a=sweep.frames[index],b=sweep.frames[index+1];
  return a.arcFraction===undefined?(index+amount)/(sweep.frames.length-1):a.arcFraction+(b.arcFraction-a.arcFraction)*amount;
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

function convexProfilesOverlap(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<EPS)continue;
    const axis=[-dy/length,dx/length],project=points=>{const values=points.map(point=>point[0]*axis[0]+point[1]*axis[1]);return {min:Math.min(...values),max:Math.max(...values)};},pa=project(a),pb=project(b);
    if(Math.min(pa.max,pb.max)-Math.max(pa.min,pb.min)<-1e-7)return false;
  }
  return true;
}

function rebuildEditedMesh(mesh,vertices,objFaces,operator){
  // Rendering consumes faces, while export/audits consume objFaces. Rebuild
  // both together: never inherit or append to the source's triangle buffer.
  const result={...mesh,vertices:vertices.map(point=>[...point]),objFaces:objFaces.map(face=>[...face]),faces:[],topologyMutation:operator};for(const face of result.objFaces)for(let index=1;index<face.length-1;index++)result.faces.push([face[0],face[index],face[index+1]]);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of result.vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}result.bounds={lo,hi};return result;
}

function quadDiagonalQuality(vertices,face,alternate=false){
  const points=face.map(index=>vertices[index]),normal=(a,b,c)=>v3.norm(v3.cross(v3.sub(b,a),v3.sub(c,a)));if(alternate){const first=normal(points[0],points[1],points[3]),second=normal(points[1],points[2],points[3]);return v3.dot(first,second);}const first=normal(points[0],points[1],points[2]),second=normal(points[0],points[2],points[3]);return v3.dot(first,second);
}

function repairFoldedQuads(mesh,threshold=.15){
  const faces=mesh.objFaces||mesh.faces||[],output=[];let detected=0,reoriented=0,triangulated=0;for(const face of faces){if(face.length!==4){output.push([...face]);continue;}const direct=quadDiagonalQuality(mesh.vertices,face,false);if(direct>=threshold){output.push([...face]);continue;}detected++;const alternate=quadDiagonalQuality(mesh.vertices,face,true);if(alternate>=threshold){output.push([face[1],face[2],face[3],face[0]]);reoriented++;}else if(alternate>direct){output.push([face[0],face[1],face[3]],[face[1],face[2],face[3]]);triangulated++;}else{output.push([face[0],face[1],face[2]],[face[0],face[2],face[3]]);triangulated++;}}
  if(!detected)return mesh;const result=rebuildEditedMesh(mesh,mesh.vertices,output,`${mesh.topologyMutation||'generated'}+fold-repair`);result.foldedQuadsDetected=Number(mesh.foldedQuadsDetected||0)+detected;result.quadDiagonalsReoriented=Number(mesh.quadDiagonalsReoriented||0)+reoriented;result.foldedQuadsTriangulated=Number(mesh.foldedQuadsTriangulated||0)+triangulated;return result;
}

function facePairBoundary(first,second){
  const counts=new Map(),directed=[];for(const face of [first,second])for(let index=0;index<face.length;index++){const a=face[index],b=face[(index+1)%face.length],key=a<b?`${a},${b}`:`${b},${a}`;counts.set(key,(counts.get(key)||0)+1);directed.push({a,b,key});}const boundary=directed.filter(edge=>counts.get(edge.key)===1),next=new Map(boundary.map(edge=>[edge.a,edge.b]));if(boundary.length!==first.length+second.length-2||next.size!==boundary.length)return null;const cycle=[boundary[0].a];let current=boundary[0].b;while(current!==cycle[0]&&cycle.length<=boundary.length){cycle.push(current);current=next.get(current);}return current===cycle[0]&&cycle.length===boundary.length?cycle:null;
}

function quadRotationMutations(mesh,limit=8){
  const faces=mesh.objFaces||mesh.faces||[],uses=new Map(),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const face=faces[faceIndex];if(face.length!==4)continue;for(let edge=0;edge<4;edge++){const a=face[edge],b=face[(edge+1)%4],edgeKey=key(a,b);if(!uses.has(edgeKey))uses.set(edgeKey,[]);uses.get(edgeKey).push(faceIndex);}}const candidates=[];for(const [edgeKey,pair] of uses)if(pair.length===2){const cycle=facePairBoundary(faces[pair[0]],faces[pair[1]]);if(!cycle||cycle.length!==6)continue;const [a,b]=edgeKey.split(',').map(Number),sharedLength=v3.len(v3.sub(mesh.vertices[a],mesh.vertices[b])),boundaryLengths=cycle.map((vertex,index)=>v3.len(v3.sub(mesh.vertices[vertex],mesh.vertices[cycle[(index+1)%6]]))),median=[...boundaryLengths].sort((x,y)=>x-y)[3]||1;candidates.push({pair,cycle,priority:sharedLength/median});}candidates.sort((a,b)=>b.priority-a.priority);const results=[];for(const candidate of candidates.slice(0,limit)){for(let offset=0;offset<3;offset++){const first=candidate.cycle[offset],opposite=candidate.cycle[offset+3],existing=faces[candidate.pair[0]].includes(first)&&faces[candidate.pair[0]].includes(opposite);if(existing)continue;const firstFace=[candidate.cycle[offset],candidate.cycle[(offset+1)%6],candidate.cycle[(offset+2)%6],candidate.cycle[(offset+3)%6]],secondFace=[candidate.cycle[(offset+3)%6],candidate.cycle[(offset+4)%6],candidate.cycle[(offset+5)%6],candidate.cycle[offset]],output=faces.map(face=>[...face]);output[candidate.pair[0]]=firstFace;output[candidate.pair[1]]=secondFace;results.push(rebuildEditedMesh(mesh,mesh.vertices,output,`quad-edge-rotate-${candidate.pair[0]}-${candidate.pair[1]}`));}}return results;
}

function sectionContourMesh(sourceSweeps,axialLoops=24,options={}){
  const axial=Math.max(14,Math.min(52,Math.round(axialLoops))),ringCount=Math.max(8,Math.min(28,Math.round(Number(options.sectionRingCount)||16))),profileCount=Math.max(10,Math.min(24,Math.max(...sourceSweeps.map(sweep=>sweep.profile.length)))),sourceBounds=boundsOf(sourceSweeps),diagonal=Math.max(EPS,v3.len(v3.sub(sourceBounds.hi,sourceBounds.lo))),planarTolerance=Math.max(diagonal*2e-7,1e-8);
  // Keep the final ring just before the authored pole.  AHS profiles normally
  // taper to zero at t=1, where a planar contour is undefined; the last fan is
  // routed to the exact contributing AHS tip positions below.
  const stationExponent=Math.max(.5,Math.min(3,Number(options.sectionParameterExponent)||1)),rowParameters=Array.from({length:axial},(_,row)=>Math.pow(row/axial,stationExponent)),strands=sourceSweeps.map(sweep=>({samples:rowParameters.map(parameter=>sweepFrameAt(sweep,parameter)),profile:resampleClosedProfile(sweep.profile,profileCount)}));
  let seed=[1,0,0],seedLength=-1;for(let first=0;first<strands.length;first++)for(let second=first+1;second<strands.length;second++)for(let row=0;row<axial;row++){const delta=v3.sub(strands[second].samples[row].c,strands[first].samples[row].c),length=v3.dot(delta,delta);if(length>seedLength){seed=delta;seedLength=length;}}
  const frames=[];let previousU,previousV;for(let row=0;row<axial;row++){let tangent=[0,0,0],preferred=[0,0,0],anchor=[0,0,0];for(const strand of strands){const sample=strand.samples[row];tangent=v3.add(tangent,sample.t);preferred=v3.add(preferred,sample.z);anchor=v3.add(anchor,sample.c);}anchor=v3.scale(anchor,1/strands.length);tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(previousU||seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[row].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({anchor,t:tangent,u,v});previousU=u;previousV=v;}
  if(options.planeAlignedStations===true){
    // A shared normalized curve parameter is not a shared geometric section:
    // strands of different length can have same-t profiles separated far along
    // the bundle tangent, yet their 2-D projections overlap.  That was the
    // source of false crown bridges.  Re-sample every strand where its centre
    // curve actually crosses the transported section plane.
    const solvePlaneParameter=(sweep,base,frame)=>{const signed=t=>v3.dot(v3.sub(sweepFrameAt(sweep,t).c,frame.anchor),frame.t),samples=32,candidates=[];let previousT=0,previousValue=signed(0),best={t:0,value:Math.abs(previousValue)};for(let sample=1;sample<=samples;sample++){const t=sample/samples,value=signed(t),absolute=Math.abs(value);if(absolute<best.value)best={t,value:absolute};if((previousValue<=0&&value>=0)||(previousValue>=0&&value<=0)){let lo=previousT,hi=t,loValue=previousValue;for(let pass=0;pass<18;pass++){const middle=(lo+hi)*.5,middleValue=signed(middle);if((loValue<=0&&middleValue>=0)||(loValue>=0&&middleValue<=0))hi=middle;else{lo=middle;loValue=middleValue;}}candidates.push((lo+hi)*.5);}previousT=t;previousValue=value;}if(candidates.length)return candidates.reduce((chosen,t)=>Math.abs(t-base)<Math.abs(chosen-base)?t:chosen,candidates[0]);return best.t;};
    for(let row=0;row<axial;row++){const base=rowParameters[row],frame=frames[row];for(let source=0;source<sourceSweeps.length;source++)strands[source].samples[row]=sweepFrameAt(sourceSweeps[source],solvePlaneParameter(sourceSweeps[source],base,frame));}
    previousU=undefined;previousV=undefined;for(let row=0;row<axial;row++){let tangent=[0,0,0],preferred=[0,0,0],anchor=[0,0,0];for(const strand of strands){const sample=strand.samples[row];tangent=v3.add(tangent,sample.t);preferred=v3.add(preferred,sample.z);anchor=v3.add(anchor,sample.c);}anchor=v3.scale(anchor,1/strands.length);tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(previousU||seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[row].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames[row]={anchor,t:tangent,u,v};previousU=u;previousV=v;}
  }
  const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0],sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],pointInPolygon=(point,polygon)=>{let inside=false;for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){const a=polygon[previous].p,b=polygon[index].p;if(((a[1]>point[1])!==(b[1]>point[1]))&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1]+EPS)+a[0])inside=!inside;}return inside;};
  // Explicit world-space stations are used only by the late-entry v2 path.
  // Missing strands have no polygon here; never clamp them to a remote root.
  if(options.sectionStations){if(options.sectionStations.length!==axial)throw new Error('Section station count mismatch');for(let row=0;row<axial;row++)frames[row]=options.sectionStations[row].frame;}
  const sectionPolygons=(row)=>{if(options.sectionStations)return options.sectionStations[row].polygons;const frame=frames[row];return strands.map((strand,source)=>{const sample=strand.samples[row],vertices=strand.profile.map(profile=>{const world=sweepPoint(sample,profile);return {p:[v3.dot(world,frame.u),v3.dot(world,frame.v)],world};});return {source,vertices};});};
  const unionContours=(polygons,frame)=>{
    const insideUnion=point=>polygons.some(polygon=>pointInPolygon(point,polygon.vertices)),segments=[],intersectionParameters=(a,b,c,d)=>{const r=sub2(b,a),s=sub2(d,c),den=cross2(r,s),values=[];if(Math.abs(den)>planarTolerance*planarTolerance){const q=sub2(c,a),t=cross2(q,s)/den,u=cross2(q,r)/den;if(t>planarTolerance&&t<1-planarTolerance&&u>-planarTolerance&&u<1+planarTolerance)values.push(t);}else if(Math.abs(cross2(sub2(c,a),r))<=planarTolerance*Math.max(1,Math.hypot(r[0],r[1]))){const length=r[0]*r[0]+r[1]*r[1];if(length>EPS)for(const point of [c,d]){const t=((point[0]-a[0])*r[0]+(point[1]-a[1])*r[1])/length;if(t>planarTolerance&&t<1-planarTolerance)values.push(t);}}return values;};
    for(const polygon of polygons)for(let edge=0;edge<polygon.vertices.length;edge++){const a=polygon.vertices[edge],b=polygon.vertices[(edge+1)%polygon.vertices.length],parameters=[0,1];for(const other of polygons)if(other!==polygon)for(let otherEdge=0;otherEdge<other.vertices.length;otherEdge++)parameters.push(...intersectionParameters(a.p,b.p,other.vertices[otherEdge].p,other.vertices[(otherEdge+1)%other.vertices.length].p));parameters.sort((x,y)=>x-y);const unique=parameters.filter((value,index)=>!index||value-parameters[index-1]>1e-7);for(let part=0;part<unique.length-1;part++){const first=unique[part],last=unique[part+1];if(last-first<1e-7)continue;const pa=mix2(a.p,b.p,first),pb=mix2(a.p,b.p,last),middle=mix2(pa,pb,.5),direction=sub2(pb,pa),length=Math.hypot(direction[0],direction[1]);if(length<planarTolerance)continue;const offset=Math.max(planarTolerance*5,length*2e-5),normal=[-direction[1]/length*offset,direction[0]/length*offset],left=insideUnion([middle[0]+normal[0],middle[1]+normal[1]]),right=insideUnion([middle[0]-normal[0],middle[1]-normal[1]]);if(left===right)continue;const wa=v3.mix(a.world,b.world,first),wb=v3.mix(a.world,b.world,last);segments.push(left?{a:pa,b:pb,wa,wb,source:polygon.source}:{a:pb,b:pa,wa:wb,wb:wa,source:polygon.source});}}
    const scale=1/planarTolerance,key=point=>`${Math.round(point[0]*scale)},${Math.round(point[1]*scale)}`,nodes=new Map(),edgeMap=new Map();for(const segment of segments){const a=key(segment.a),b=key(segment.b);if(a===b)continue;for(const [nodeKey,p,world] of [[a,segment.a,segment.wa],[b,segment.b,segment.wb]]){if(!nodes.has(nodeKey))nodes.set(nodeKey,{p:[0,0],world:[0,0,0],count:0});const node=nodes.get(nodeKey);node.p[0]+=p[0];node.p[1]+=p[1];node.world=v3.add(node.world,world);node.count++;}const edgeKey=`${a}>${b}`;if(!edgeMap.has(edgeKey))edgeMap.set(edgeKey,{a,b,source:segment.source});}
    for(const node of nodes.values()){node.p=node.p.map(value=>value/node.count);node.world=v3.scale(node.world,1/node.count);}const edges=[...edgeMap.values()],outgoing=new Map();edges.forEach((edge,index)=>{if(!outgoing.has(edge.a))outgoing.set(edge.a,[]);outgoing.get(edge.a).push(index);});const unused=new Set(edges.map((_,index)=>index)),contours=[];
    while(unused.size){const startEdge=unused.values().next().value,start=edges[startEdge].a,keys=[start],owners=[],sources=new Set();let edgeIndex=startEdge,current=start,guard=0;while(guard++<=edges.length+2){const edge=edges[edgeIndex];if(!unused.has(edgeIndex))break;unused.delete(edgeIndex);owners.push(edge.source);sources.add(edge.source);current=edge.b;if(current===start)break;keys.push(current);const choices=(outgoing.get(current)||[]).filter(index=>unused.has(index));if(!choices.length)break;if(choices.length===1){edgeIndex=choices[0];continue;}const previous=nodes.get(edge.a).p,at=nodes.get(current).p,incoming=sub2(at,previous);edgeIndex=choices.reduce((best,index)=>{const toward=sub2(nodes.get(edges[index].b).p,at),score=(incoming[0]*toward[0]+incoming[1]*toward[1])/(Math.hypot(...incoming)*Math.hypot(...toward)+EPS);return !best||score>best.score?{index,score}:best;},null).index;}if(current!==start||keys.length<3)continue;let points=keys.map(nodeKey=>({p:[...nodes.get(nodeKey).p],world:[...nodes.get(nodeKey).world]}));const area=points.reduce((sum,point,index)=>sum+cross2(point.p,points[(index+1)%points.length].p),0)*.5,perimeter=points.reduce((sum,point,index)=>sum+Math.hypot(...sub2(points[(index+1)%points.length].p,point.p)),0);if(Math.abs(area)<diagonal*diagonal*1e-10||perimeter<diagonal*1e-4)continue;const rawRing=points.map(point=>[...point.world]),rawOwners=[...owners],lengths=[],total=points.reduce((sum,point,index)=>{const length=Math.hypot(...sub2(points[(index+1)%points.length].p,point.p));lengths.push(length);return sum+length;},0),ring=[],ringOwners=[];let edge=0,edgeStart=0;for(let sample=0;sample<ringCount;sample++){const target=total*sample/ringCount;while(edge<points.length-1&&edgeStart+lengths[edge]<target){edgeStart+=lengths[edge];edge++;}const amount=(target-edgeStart)/Math.max(lengths[edge],EPS),next=points[(edge+1)%points.length],planePoint=mix2(points[edge].p,next.p,amount);ring.push(options.planarSectionRows===true?v3.add(frame.anchor,v3.add(v3.scale(frame.u,planePoint[0]-v3.dot(frame.anchor,frame.u)),v3.scale(frame.v,planePoint[1]-v3.dot(frame.anchor,frame.v)))):v3.mix(points[edge].world,next.world,amount));ringOwners.push(owners[edge]??owners[owners.length-1]);}contours.push({ring,owners:ringOwners,rawRing,rawOwners,sources,area,center:v3.scale(ring.reduce((sum,point)=>v3.add(sum,point),[0,0,0]),1/ring.length)});}return contours;
  };
  const contourRows=Array.from({length:axial},(_,row)=>unionContours(sectionPolygons(row),frames[row])),adaptiveEventStats=[],stableOwnerStats=[],profileContactLayoutStats=[];let profileContactEventStats=null;
  // A near-tip section may shrink below the contour tolerance. Only the
  // physical-section path may omit trailing empty stations; its last real
  // contour is still capped at the original source tip below.
  if(options.sectionStations)while(contourRows.length>1&&!contourRows[contourRows.length-1].length){contourRows.pop();frames.pop();}
  if(options.adaptiveEventStations&&sourceSweeps.length===2){
    const frameFromSamples=(samples,guide)=>{let tangent=[0,0,0],preferred=[0,0,0],anchor=[0,0,0];for(const sample of samples){tangent=v3.add(tangent,sample.t);preferred=v3.add(preferred,sample.z);anchor=v3.add(anchor,sample.c);}anchor=v3.scale(anchor,1/samples.length);tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=v3.norm(project(guide?.u||samples[0].x));if(v3.len(u)<1e-5)u=v3.norm(project(seed));let v=v3.norm(v3.cross(tangent,u));if(guide?.v&&v3.dot(v,guide.v)<0)v=v3.scale(v,-1);else if(!guide?.v&&v3.dot(v,preferred)<0)v=v3.scale(v,-1);return {anchor,t:tangent,u,v};};
    const localPlaneRoot=(sweep,parameter,lo,hi,frame)=>{const signed=value=>v3.dot(v3.sub(sweepFrameAt(sweep,value).c,frame.anchor),frame.t),steps=28,roots=[];let previous=lo,previousValue=signed(lo);for(let step=1;step<=steps;step++){const current=lo+(hi-lo)*step/steps,currentValue=signed(current);if((previousValue<=0&&currentValue>=0)||(previousValue>=0&&currentValue<=0)){let lower=previous,upper=current,lowerValue=previousValue;for(let pass=0;pass<16;pass++){const middle=(lower+upper)*.5,middleValue=signed(middle);if((lowerValue<=0&&middleValue>=0)||(lowerValue>=0&&middleValue<=0))upper=middle;else{lower=middle;lowerValue=middleValue;}}roots.push((lower+upper)*.5);}previous=current;previousValue=currentValue;}return roots.length?roots.reduce((best,value)=>Math.abs(value-parameter)<Math.abs(best-parameter)?value:best,roots[0]):parameter;};
    const stationAt=(parameter,lo,hi,guide)=>{let samples=sourceSweeps.map(sweep=>sweepFrameAt(sweep,parameter)),frame=frameFromSamples(samples,guide);if(options.planeAlignedStations!==false){samples=sourceSweeps.map(sweep=>sweepFrameAt(sweep,localPlaneRoot(sweep,parameter,lo,hi,frame)));frame=frameFromSamples(samples,guide);}const polygons=samples.map((sample,source)=>{const vertices=strands[source].profile.map(profile=>{const world=sweepPoint(sample,profile);return {p:[v3.dot(world,frame.u),v3.dot(world,frame.v)],world};});return {source,vertices};});return {parameter,samples,frame,contours:unionContours(polygons,frame)};};
    const additions=[];for(let row=0;row<contourRows.length-1;row++){const firstCount=contourRows[row].length,secondCount=contourRows[row+1].length;if(!((firstCount===1&&secondCount===2)||(firstCount===2&&secondCount===1)))continue;const parameterA=rowParameters[row],parameterB=rowParameters[row+1],guide={u:v3.norm(v3.add(frames[row].u,frames[row+1].u)),v:v3.norm(v3.add(frames[row].v,frames[row+1].v))};let low={parameter:parameterA,count:firstCount},high={parameter:parameterB,count:secondCount};for(let pass=0;pass<14;pass++){const parameter=(low.parameter+high.parameter)*.5,station=stationAt(parameter,parameterA,parameterB,guide),count=station.contours.length;if(count===firstCount)low={parameter,count};else if(count===secondCount)high={parameter,count};else break;}const event=(low.parameter+high.parameter)*.5,span=parameterB-parameterA;let before,after;for(const factor of [.06,.04,.025,.015,.008,.003]){const candidateBefore=stationAt(Math.max(parameterA+span*1e-4,event-span*factor),parameterA,parameterB,guide),candidateAfter=stationAt(Math.min(parameterB-span*1e-4,event+span*factor),parameterA,parameterB,guide);if(candidateBefore.contours.length===firstCount&&candidateAfter.contours.length===secondCount){before=candidateBefore;after=candidateAfter;break;}}if(!before||!after){before=stationAt(low.parameter,parameterA,parameterB,guide);after=stationAt(high.parameter,parameterA,parameterB,guide);}additions.push({row,before,after,firstCount,secondCount,event});}
    for(let addition=additions.length-1;addition>=0;addition--){const {row,before,after,firstCount,secondCount,event}=additions[addition],stations=[before,after];rowParameters.splice(row+1,0,...stations.map(station=>station.parameter));frames.splice(row+1,0,...stations.map(station=>station.frame));for(let source=0;source<strands.length;source++)strands[source].samples.splice(row+1,0,...stations.map(station=>station.samples[source]));contourRows.splice(row+1,0,...stations.map(station=>station.contours));adaptiveEventStats.unshift({row,rowBefore:row+1,rowAfter:row+2,firstCount,secondCount,event,before:before.parameter,after:after.parameter});}
  }
  const collapsedRow=contourRows.findIndex(row=>!row.length);if(collapsedRow>=0)throw new Error(`Profile contour union collapsed at row ${collapsedRow+1}/${contourRows.length}.`);if(options.contoursOnly)return {sectionContourCounts:contourRows.map(row=>row.length),sectionContourSources:contourRows.map(row=>row.map(contour=>[...contour.sources].sort((a,b)=>a-b))),adaptiveSectionEventStations:adaptiveEventStats};
  if(options.stableOwnerCorrespondence){
    if(sourceSweeps.length!==2||ringCount%2)throw new Error('Stable owner correspondence currently requires two strands and an even section ring count.');
    const resampleOpen=(points,edges)=>{const lengths=[0];for(let index=1;index<points.length;index++)lengths.push(lengths[index-1]+v3.len(v3.sub(points[index],points[index-1])));const total=lengths[lengths.length-1];if(total<EPS)return Array.from({length:edges+1},()=>[...points[0]]);let edge=1;return Array.from({length:edges+1},(_,sample)=>{const target=total*sample/edges;while(edge<points.length-1&&lengths[edge]<target)edge++;const previous=edge-1,amount=(target-lengths[previous])/Math.max(lengths[edge]-lengths[previous],EPS);return v3.mix(points[previous],points[edge],amount);});},sourceRing=(source,row)=>{const strand=strands[source],sample=strand.samples[row],profile=resampleClosedProfile(strand.profile,ringCount);return profile.map(shape=>sweepPoint(sample,shape));},canonicalRuns=(contour,row)=>{const sourceRing=contour.rawRing?.length===contour.rawOwners?.length?contour.rawRing:contour.ring,sourceOwners=contour.rawRing?.length===contour.rawOwners?.length?contour.rawOwners:contour.owners,transitions=[];for(let index=0;index<sourceOwners.length;index++)if(sourceOwners[index]!==sourceOwners[(index+sourceOwners.length-1)%sourceOwners.length])transitions.push(index);if(transitions.length<2||transitions.length%2)throw new Error(`Stable owner contour at row ${row+1} has ${transitions.length} ownership transitions.`);const starts=transitions.filter(index=>sourceOwners[index]===0);if(!starts.length)throw new Error(`Stable owner contour at row ${row+1} has no source-1 arc.`);const start=starts.reduce((best,index)=>v3.dot(sourceRing[index],frames[row].v)>v3.dot(sourceRing[best],frames[row].v)?index:best,starts[0]),ring=Array.from({length:sourceRing.length},(_,index)=>sourceRing[(start+index)%sourceRing.length]),owners=Array.from({length:sourceOwners.length},(_,index)=>sourceOwners[(start+index)%sourceOwners.length]),runStarts=[0];for(let index=1;index<owners.length;index++)if(owners[index]!==owners[index-1])runStarts.push(index);const runs=runStarts.map((runStart,index)=>{const end=index+1<runStarts.length?runStarts[index+1]:ring.length,points=end<ring.length?ring.slice(runStart,end+1):[...ring.slice(runStart),ring[0]];return {owner:owners[runStart],points,edgeCount:end-runStart};});return {runs,start,transitionCount:transitions.length};};
    const allocateRuns=runs=>{if(runs.length>ringCount/2)throw new Error(`${runs.length} exposed source arcs cannot fit a ${ringCount}-edge contour.`);const lengths=runs.map(run=>{let length=0;for(let index=1;index<run.points.length;index++)length+=v3.len(v3.sub(run.points[index],run.points[index-1]));return length;}),total=lengths.reduce((sum,length)=>sum+length,0),ideal=lengths.map(length=>ringCount*length/Math.max(EPS,total)),allocations=ideal.map(value=>Math.max(1,Math.floor(value)));while(allocations.reduce((sum,value)=>sum+value,0)<ringCount){let best=0,bestRemainder=-Infinity;for(let index=0;index<allocations.length;index++){const remainder=ideal[index]-allocations[index];if(remainder>bestRemainder){bestRemainder=remainder;best=index;}}allocations[best]++;}while(allocations.reduce((sum,value)=>sum+value,0)>ringCount){let best=-1,bestExcess=Infinity;for(let index=0;index<allocations.length;index++)if(allocations[index]>1){const excess=ideal[index]-allocations[index];if(excess<bestExcess){bestExcess=excess;best=index;}}if(best<0)break;allocations[best]--;}return allocations;};
    const allocateOwnerDensityRuns=runs=>{const lengths=runs.map(run=>{let length=0;for(let index=1;index<run.points.length;index++)length+=v3.len(v3.sub(run.points[index],run.points[index-1]));return length;}),allocations=Array(runs.length).fill(1),targetPerOwner=Math.max(2,ringCount-2);for(const owner of [...new Set(runs.map(run=>run.owner))]){const indices=runs.map((run,index)=>run.owner===owner?index:-1).filter(index=>index>=0),total=indices.reduce((sum,index)=>sum+lengths[index],0),ideal=indices.map(index=>targetPerOwner*lengths[index]/Math.max(EPS,total));for(let item=0;item<indices.length;item++)allocations[indices[item]]=Math.max(1,Math.floor(ideal[item]));while(indices.reduce((sum,index)=>sum+allocations[index],0)<targetPerOwner){let best=0,bestRemainder=-Infinity;for(let item=0;item<indices.length;item++){const remainder=ideal[item]-allocations[indices[item]];if(remainder>bestRemainder){bestRemainder=remainder;best=item;}}allocations[indices[best]]++;}while(indices.reduce((sum,index)=>sum+allocations[index],0)>targetPerOwner){let best=-1,bestExcess=Infinity;for(let item=0;item<indices.length;item++){const index=indices[item];if(allocations[index]<=1)continue;const excess=ideal[item]-allocations[index];if(excess<bestExcess){bestExcess=excess;best=item;}}if(best<0)break;allocations[indices[best]]--;}}return allocations;};
    const profileContactTransport=Boolean(options.profileContactEndpointTransport),runAllocations=options.profileContactSourceDensity?allocateOwnerDensityRuns:allocateRuns,mod=(value,count)=>((value%count)+count)%count;
    const profilePoint=(source,row,parameter)=>{const strand=strands[source],count=strand.profile.length,wrapped=mod(parameter,count),index=Math.floor(wrapped)%count,next=(index+1)%count,amount=wrapped-Math.floor(wrapped),shape=[strand.profile[index][0]+(strand.profile[next][0]-strand.profile[index][0])*amount,strand.profile[index][1]+(strand.profile[next][1]-strand.profile[index][1])*amount],sample=strand.samples[row];return sweepPoint(sample,shape);};
    const closestProfileParameter=(source,row,point)=>{const count=strands[source].profile.length;let best={parameter:0,distance:Infinity};for(let edge=0;edge<count;edge++){const first=profilePoint(source,row,edge),second=profilePoint(source,row,edge+1),axis=v3.sub(second,first),amount=clamp(v3.dot(v3.sub(point,first),axis)/(v3.dot(axis,axis)+EPS)),candidate=v3.mix(first,second,amount),distance=v3.dot(v3.sub(candidate,point),v3.sub(candidate,point));if(distance<best.distance)best={parameter:edge+amount,distance};}return best.parameter;};
    const arcParameters=(source,start,end,direction,edges)=>{const count=strands[source].profile.length,distance=direction>0?mod(end-start,count):mod(start-end,count);return Array.from({length:edges+1},(_,edge)=>mod(start+direction*distance*edge/edges,count));},arcFitCost=(source,row,start,end,direction,points)=>{const samples=arcParameters(source,start,end,direction,48).map(parameter=>profilePoint(source,row,parameter));return points.reduce((sum,point)=>sum+samples.reduce((best,sample)=>Math.min(best,v3.dot(v3.sub(sample,point),v3.sub(sample,point))),Infinity),0)/Math.max(1,points.length);},profileArcLength=(source,row,start,end,direction)=>{const points=arcParameters(source,start,end,direction,96).map(parameter=>profilePoint(source,row,parameter));let length=0;for(let index=1;index<points.length;index++)length+=v3.len(v3.sub(points[index],points[index-1]));return length;},profilePerimeter=(source,row)=>{const count=strands[source].profile.length;let length=0;for(let edge=0;edge<count;edge++)length+=v3.len(v3.sub(profilePoint(source,row,edge+1),profilePoint(source,row,edge)));return length;};
    const profileContactLayouts=[];
    if(profileContactTransport)for(let eventRow=0;eventRow<contourRows.length-1;eventRow++){
      const first=contourRows[eventRow],second=contourRows[eventRow+1];if(!((first.length===1&&second.length===2)||(first.length===2&&second.length===1)))continue;
      const sharedRow=first.length===1?eventRow:eventRow+1,shared=contourRows[sharedRow][0];if(shared.sources.size!==2)continue;const canonical=canonicalRuns(shared,sharedRow),allocations=runAllocations(canonical.runs),layouts=[];
      for(let runIndex=0;runIndex<canonical.runs.length;runIndex++){const run=canonical.runs[runIndex],source=run.owner;if(layouts[source])continue;const start=closestProfileParameter(source,sharedRow,run.points[0]),end=closestProfileParameter(source,sharedRow,run.points[run.points.length-1]),forwardCost=arcFitCost(source,sharedRow,start,end,1,run.points),backwardCost=arcFitCost(source,sharedRow,start,end,-1,run.points),direction=forwardCost<=backwardCost?1:-1,outerLength=profileArcLength(source,sharedRow,start,end,direction),outerFraction=outerLength/Math.max(EPS,profilePerimeter(source,sharedRow)),outerEdges=Math.max(2,Math.min(ringCount-2,Math.round(ringCount*outerFraction)));layouts[source]={source,start,end,direction,parentEdges:allocations[runIndex],outerEdges,innerEdges:ringCount-outerEdges,outerFraction,fitCost:Math.min(forwardCost,backwardCost),sharedRow,eventRow:eventRow+.5};}
      if(layouts[0]&&layouts[1])profileContactLayouts.push({eventRow:eventRow+.5,sharedRow,layouts});
    }
    // A nearly tangent pair can flicker 2 -> 1 -> 2 for one or two sampled
    // sections even though it is one continuous geometric contact region.
    // Count events on a de-noised ownership signal, but retain every raw
    // layout: the local stitcher still gets the closest exact profile
    // endpoints at each real section transition.
    const contactState=row=>row.length===1&&row[0].sources.size===2?1:row.length===2&&row.every(contour=>contour.sources.size===1)?2:0,rawContactStates=contourRows.map(contactState),stableContactStates=[...rawContactStates],transientRowLimit=Math.max(1,Math.min(3,Math.round(contourRows.length*.1)));
    for(let pass=0;pass<3;pass++){const runs=[];for(let start=0;start<stableContactStates.length;){let end=start+1;while(end<stableContactStates.length&&stableContactStates[end]===stableContactStates[start])end++;runs.push({start,end,state:stableContactStates[start]});start=end;}let changed=false;for(let run=1;run<runs.length-1;run++){const current=runs[run],before=runs[run-1],after=runs[run+1];if(current.state&&before.state&&before.state===after.state&&current.end-current.start<=transientRowLimit){for(let row=current.start;row<current.end;row++)stableContactStates[row]=before.state;changed=true;}}if(!changed)break;}
    const transitionRows=states=>{const result=[];for(let row=0;row<states.length-1;row++)if(states[row]&&states[row+1]&&states[row]!==states[row+1])result.push(row+.5);return result;},rawEventRows=profileContactLayouts.map(event=>event.eventRow),stableEventRows=transitionRows(stableContactStates),suppressedEventRows=rawEventRows.filter(eventRow=>!stableEventRows.some(stableRow=>Math.abs(stableRow-eventRow)<1e-6));profileContactEventStats={rawEventRows,stableEventRows,suppressedEventRows,transientRowLimit,rawStates:rawContactStates,stableStates:stableContactStates};
    if(profileContactTransport&&options.profileContactRequireSingleEvent&&stableEventRows.length!==1)throw new Error(`Profile-contact transport requires one stable two-source event; found ${stableEventRows.length} (${rawEventRows.length} raw transition${rawEventRows.length===1?'':'s'}).`);
    const layoutFor=(source,row)=>{const candidates=profileContactLayouts.filter(event=>event.layouts[source]);if(!candidates.length)return null;return candidates.reduce((best,event)=>Math.abs(event.eventRow-row)<Math.abs(best.eventRow-row)?event:best,candidates[0]).layouts[source];},transportedSourceRing=(source,row)=>{const layout=layoutFor(source,row);if(!layout)return sourceRing(source,row);const outer=arcParameters(source,layout.start,layout.end,layout.direction,layout.outerEdges).map(parameter=>profilePoint(source,row,parameter)),inner=arcParameters(source,layout.end,layout.start,layout.direction,layout.innerEdges).map(parameter=>profilePoint(source,row,parameter));return [...outer.slice(0,-1),...inner.slice(0,-1)];};
    profileContactLayoutStats.push(...profileContactLayouts.map(event=>({eventRow:event.eventRow,sharedRow:event.sharedRow,layouts:event.layouts.map(layout=>layout&&{source:layout.source,start:layout.start,end:layout.end,direction:layout.direction,parentEdges:layout.parentEdges,outerEdges:layout.outerEdges,innerEdges:layout.innerEdges,outerFraction:layout.outerFraction,fitCost:layout.fitCost})})));
    for(let row=0;row<contourRows.length;row++)for(const contour of contourRows[row]){
      if(contour.sources.size===1){const source=[...contour.sources][0],layout=layoutFor(source,row);contour.ring=transportedSourceRing(source,row);contour.owners=Array(contour.ring.length).fill(source);contour.profileContactLayout=layout?{...layout}:null;contour.center=v3.scale(contour.ring.reduce((sum,point)=>v3.add(sum,point),[0,0,0]),1/contour.ring.length);continue;}
      if(contour.sources.size!==2)throw new Error(`Stable owner contour at row ${row+1} has ${contour.sources.size} source owners.`);
      const canonical=canonicalRuns(contour,row),runs=canonical.runs,allocations=runAllocations(runs),sampled=runs.map((run,index)=>resampleOpen(run.points,allocations[index]));contour.ring=sampled.flatMap(points=>points.slice(0,-1));contour.owners=runs.flatMap((run,index)=>Array(allocations[index]).fill(run.owner));contour.center=v3.scale(contour.ring.reduce((sum,point)=>v3.add(sum,point),[0,0,0]),1/contour.ring.length);stableOwnerStats.push({row,transitionCount:canonical.transitionCount,owners:runs.map(run=>run.owner),allocations,start:canonical.start});
    }
  }
  if(options.sectionPrepareContours)options.sectionPrepareContours(contourRows,frames);
  const vertices=[],rows=contourRows.map(row=>row.map(contour=>({...contour,indices:contour.ring.map(point=>vertices.push(point)-1)}))),objFaces=[],junctionStats=[],clean=face=>{const compact=[];for(const vertex of face)if(compact[compact.length-1]!==vertex)compact.push(vertex);if(compact.length>1&&compact[0]===compact[compact.length-1])compact.pop();if(new Set(compact).size>=3)objFaces.push(compact);};
  // Union contours are emitted with a consistent boundary orientation.  A
  // nearest-distance match is therefore allowed to rotate the phase, but not
  // reverse it: a reversed row creates a locally valid-looking zipper whose
  // rails cross through the volume (the multi-strand crown failure).
  const rotateToClosest=(a,b)=>{let best=b,bestCost=Infinity;for(let shift=0;shift<b.length;shift++){const candidate=Array.from({length:b.length},(_,index)=>b[(shift+index)%b.length]);let cost=0;for(let sample=0;sample<Math.max(a.length,b.length);sample++){const first=vertices[a[Math.floor(sample*a.length/Math.max(a.length,b.length))%a.length]],second=vertices[candidate[Math.floor(sample*b.length/Math.max(a.length,b.length))%b.length]];cost+=v3.dot(v3.sub(first,second),v3.sub(first,second));}if(cost<bestCost){bestCost=cost;best=candidate;}}return best;};
  const stitch=(a,b,preservePhase=false)=>{b=preservePhase?b:rotateToClosest(a,b);const n=a.length,m=b.length;let first=0,second=0;while(first<n||second<m){const nextFirst=(first+1)/n,nextSecond=(second+1)/m,a0=a[first%n],b0=b[second%m];if(first<n&&second<m&&Math.abs(nextFirst-nextSecond)<.035){clean([a0,a[(first+1)%n],b[(second+1)%m],b0]);first++;second++;}else if(first<n&&(second>=m||nextFirst<nextSecond)){clean([a0,a[(first+1)%n],b0]);first++;}else{clean([a0,b[(second+1)%m],b0]);second++;}}};
  const stitchOpen=(a,b)=>{if(a.length<2||b.length<2)return;const direct=v3.dot(v3.sub(vertices[a[0]],vertices[b[0]]),v3.sub(vertices[a[0]],vertices[b[0]]))+v3.dot(v3.sub(vertices[a[a.length-1]],vertices[b[b.length-1]]),v3.sub(vertices[a[a.length-1]],vertices[b[b.length-1]])),reverse=v3.dot(v3.sub(vertices[a[0]],vertices[b[b.length-1]]),v3.sub(vertices[a[0]],vertices[b[b.length-1]]))+v3.dot(v3.sub(vertices[a[a.length-1]],vertices[b[0]]),v3.sub(vertices[a[a.length-1]],vertices[b[0]]));if(reverse<direct)b=[...b].reverse();const n=a.length-1,m=b.length-1;let first=0,second=0;while(first<n||second<m){const nextFirst=(first+1)/n,nextSecond=(second+1)/m,a0=a[first],b0=b[second];if(first<n&&second<m&&Math.abs(nextFirst-nextSecond)<.08){clean([a0,a[first+1],b[second+1],b0]);first++;second++;}else if(first<n&&(second>=m||nextFirst<nextSecond)){clean([a0,a[first+1],b0]);first++;}else{clean([a0,b[second+1],b0]);second++;}}};
  // When all three rings have the same even count, a half-ring partition is
  // the only count assignment that makes the two outer strips and the shared
  // inner strip quad-for-quad.  Search every cyclic phase and child assignment
  // geometrically; the exact section rings themselves are never moved.
  const profileContactBinaryJunction=(parentContour,children)=>{
    if(!options.profileContactEndpointTransport||children.length!==2)return false;
    const directedArc=(loop,start,end)=>{const result=[loop[start]];let index=start,guard=0;while(index!==end&&guard++<=loop.length){index=(index+1)%loop.length;result.push(loop[index]);}return result;},labels=parentContour.owners.map(owner=>children.findIndex(child=>child.sources.has(owner))),transitions=[];
    for(let index=0;index<labels.length;index++)if(labels[index]!==labels[(index+labels.length-1)%labels.length])transitions.push(index);if(transitions.length!==2||labels.some(label=>label<0))return false;
    const parentArcs=[directedArc(parentContour.indices,transitions[0],transitions[1]),directedArc(parentContour.indices,transitions[1],transitions[0])],arcLabels=[labels[transitions[0]],labels[transitions[1]]],innerPaths=[],childStats=[];
    for(let arcIndex=0;arcIndex<2;arcIndex++){const childIndex=arcLabels[arcIndex],child=children[childIndex],layout=child.profileContactLayout;if(!layout)return false;const outerEdges=Math.max(1,Math.min(child.indices.length-1,layout.outerEdges)),outer=Array.from({length:outerEdges+1},(_,index)=>child.indices[index]),inner=[...child.indices.slice(outerEdges),child.indices[0]];stitchOpen(parentArcs[arcIndex],outer);innerPaths[childIndex]=inner;childStats.push({childIndex,parentEdges:parentArcs[arcIndex].length-1,outerEdges,innerEdges:inner.length-1,start:layout.start,end:layout.end,direction:layout.direction});}
    const seamStart=parentArcs[0][0],seamEnd=parentArcs[0][parentArcs[0].length-1],distance=(a,b)=>v3.dot(v3.sub(vertices[a],vertices[b]),v3.sub(vertices[a],vertices[b]));for(const path of innerPaths)if(distance(path[path.length-1],seamStart)<distance(path[0],seamStart))path.reverse();const direct=distance(innerPaths[0][0],innerPaths[1][0])+distance(innerPaths[0][innerPaths[0].length-1],innerPaths[1][innerPaths[1].length-1]),reverse=distance(innerPaths[0][0],innerPaths[1][innerPaths[1].length-1])+distance(innerPaths[0][innerPaths[0].length-1],innerPaths[1][0]);if(reverse<direct)innerPaths[1].reverse();stitchOpen(innerPaths[0],innerPaths[1]);clean([seamStart,innerPaths[0][0],innerPaths[1][0]]);clean([seamEnd,innerPaths[1][innerPaths[1].length-1],innerPaths[0][innerPaths[0].length-1]]);junctionStats.push({accepted:true,matched:true,profileContactAnchored:true,parentArcLengths:parentArcs.map(arc=>arc.length),children:childStats});return true;
  };
  const matchedBinaryJunction=(parentContour,children)=>{
    if(children.length!==2||parentContour.indices.length%2||children.some(child=>child.indices.length!==parentContour.indices.length))return false;
    const count=parentContour.indices.length,half=count/2,directedArc=(loop,start,edges,direction=1)=>Array.from({length:edges+1},(_,offset)=>loop[(start+direction*offset+loop.length*edges)%loop.length]),pointToLoop=(index,loop)=>loop.reduce((best,other)=>Math.min(best,v3.dot(v3.sub(vertices[index],vertices[other]),v3.sub(vertices[index],vertices[other]))),Infinity),arcToLoop=(arc,loop)=>arc.reduce((sum,index)=>sum+pointToLoop(index,loop),0)/arc.length;
    let partition;for(let start=0;start<count;start++){const arcs=[directedArc(parentContour.indices,start,half),directedArc(parentContour.indices,start+half,half)];for(let firstChild=0;firstChild<2;firstChild++){const cost=arcToLoop(arcs[0],children[firstChild].indices)+arcToLoop(arcs[1],children[1-firstChild].indices);if(!partition||cost<partition.cost)partition={cost,arcs,childOrder:[firstChild,1-firstChild]};}}
    const innerPaths=[];for(let arcIndex=0;arcIndex<2;arcIndex++){const parentArc=partition.arcs[arcIndex],childIndex=partition.childOrder[arcIndex],loop=children[childIndex].indices;let match;for(let start=0;start<count;start++)for(const direction of [1,-1]){const outer=directedArc(loop,start,half,direction),cost=outer.reduce((sum,index,position)=>sum+v3.dot(v3.sub(vertices[index],vertices[parentArc[position]]),v3.sub(vertices[index],vertices[parentArc[position]])),0);if(!match||cost<match.cost){const end=(start+direction*half+count*half)%count;match={cost,outer,inner:directedArc(loop,end,half,direction)};}}stitchOpen(parentArc,match.outer);innerPaths[childIndex]=match.inner;}
    const seamStart=partition.arcs[0][0],seamEnd=partition.arcs[0][partition.arcs[0].length-1],distance=(a,b)=>v3.dot(v3.sub(vertices[a],vertices[b]),v3.sub(vertices[a],vertices[b]));for(const path of innerPaths)if(distance(path[path.length-1],seamStart)<distance(path[0],seamStart))path.reverse();const direct=distance(innerPaths[0][0],innerPaths[1][0])+distance(innerPaths[0][innerPaths[0].length-1],innerPaths[1][innerPaths[1].length-1]),reverse=distance(innerPaths[0][0],innerPaths[1][innerPaths[1].length-1])+distance(innerPaths[0][innerPaths[0].length-1],innerPaths[1][0]);if(reverse<direct)innerPaths[1].reverse();stitchOpen(innerPaths[0],innerPaths[1]);clean([seamStart,innerPaths[0][0],innerPaths[1][0]]);clean([seamEnd,innerPaths[1][innerPaths[1].length-1],innerPaths[0][innerPaths[0].length-1]]);junctionStats.push({accepted:true,matched:true,parentArcLengths:[half+1,half+1],childOrder:[...partition.childOrder]});return true;
  };
  const cyclicArc=(loop,start,end)=>{const result=[loop[start]];let index=start,guard=0;while(index!==end&&guard++<=loop.length){index=(index+1)%loop.length;result.push(loop[index]);}return result;};
  const binaryJunction=(parentContour,children,forceGeometric=false)=>{
    if(children.length!==2)return false;
    if(options.sectionJunctionBuilder){const patch=options.sectionJunctionBuilder(parentContour,children,vertices);if(patch){for(const face of patch)clean(face);return true;}}
    if(profileContactBinaryJunction(parentContour,children))return true;
    if(options.matchedEventPatch&&matchedBinaryJunction(parentContour,children))return true;
    const fallback=index=>{let best=0,distance=Infinity;for(let child=0;child<children.length;child++){const value=v3.dot(v3.sub(vertices[parentContour.indices[index]],children[child].center),v3.sub(vertices[parentContour.indices[index]],children[child].center));if(value<distance){distance=value;best=child;}}return best;};
    const ownerLabels=parentContour.owners.map(owner=>children.findIndex(child=>child.sources.has(owner))),labels=forceGeometric||options.geometricEventPartition?parentContour.indices.map((_,index)=>fallback(index)):ownerLabels.map((label,index)=>label<0?fallback(index):label),transitions=[];
    for(let index=0;index<labels.length;index++)if(labels[index]!==labels[(index+labels.length-1)%labels.length])transitions.push(index);
    if(transitions.length!==2){junctionStats.push({accepted:false,transitions:transitions.length,labels:[...labels]});return false;}
    const firstTransition=transitions[0],secondTransition=transitions[1],parentArcs=[cyclicArc(parentContour.indices,firstTransition,secondTransition),cyclicArc(parentContour.indices,secondTransition,firstTransition)],arcLabels=[labels[firstTransition],labels[secondTransition]],used=new Set(),stat={accepted:true,transitions:[...transitions],labels:[...labels],parentArcLengths:parentArcs.map(arc=>arc.length),children:[]};
    for(let arc=0;arc<2;arc++){let childIndex=arcLabels[arc];if(used.has(childIndex))childIndex=1-childIndex;used.add(childIndex);const child=children[childIndex],parentArc=parentArcs[arc],loop=child.indices,nearest=point=>loop.reduce((best,index,position)=>{const distance=v3.dot(v3.sub(vertices[index],vertices[point]),v3.sub(vertices[index],vertices[point]));return !best||distance<best.distance?{position,distance}:best;},null).position,start=nearest(parentArc[0]),rawEnd=nearest(parentArc[parentArc.length-1]),end=start===rawEnd?(rawEnd+Math.floor(loop.length/2))%loop.length:rawEnd,paths=[cyclicArc(loop,start,end),cyclicArc(loop,end,start).reverse()],pathDistance=path=>path.reduce((sum,index)=>sum+parentArc.reduce((best,parentIndex)=>Math.min(best,v3.len(v3.sub(vertices[index],vertices[parentIndex]))),Infinity),0)/path.length,outer=pathDistance(paths[0])<=pathDistance(paths[1])?paths[0]:paths[1],inner=outer===paths[0]?paths[1]:paths[0];stat.children.push({childIndex,start,end,outer:outer.length,inner:inner.length});child._qualityOuter=outer;child._qualityInner=inner;child._qualityParentArc=parentArc;stitchOpen(parentArc,outer);}
    const seamStart=parentArcs[0][0],seamEnd=parentArcs[0][parentArcs[0].length-1],distance=(a,b)=>v3.dot(v3.sub(vertices[a],vertices[b]),v3.sub(vertices[a],vertices[b]));
    for(const child of children)if(distance(child._qualityInner[child._qualityInner.length-1],seamStart)<distance(child._qualityInner[0],seamStart))child._qualityInner.reverse();
    const first=children[0],second=children[1];stitchOpen(first._qualityInner,second._qualityInner);clean([seamStart,first._qualityInner[0],second._qualityInner[0]]);clean([seamEnd,second._qualityInner[second._qualityInner.length-1],first._qualityInner[first._qualityInner.length-1]]);
    for(const child of children){delete child._qualityOuter;delete child._qualityInner;delete child._qualityParentArc;}junctionStats.push(stat);return true;
  };
  const compositeBoundary=loops=>{let composite=[...loops[0]];for(const loop of loops.slice(1)){let best={distance:Infinity,a:0,b:0};for(let a=0;a<composite.length;a++)for(let b=0;b<loop.length;b++){const distance=v3.dot(v3.sub(vertices[composite[a]],vertices[loop[b]]),v3.sub(vertices[composite[a]],vertices[loop[b]]));if(distance<best.distance)best={distance,a,b};}const rotated=Array.from({length:loop.length},(_,index)=>loop[(best.b+index)%loop.length]),anchor=composite[best.a];composite=[...composite.slice(0,best.a+1),rotated[0],...rotated.slice(1),rotated[0],anchor,...composite.slice(best.a+1)];}return composite;};
  const patch=(outer,innerLoops)=>stitch(outer,compositeBoundary(innerLoops)),cap=(loop,target)=>{const center=target||v3.scale(loop.reduce((sum,index)=>v3.add(sum,vertices[index]),[0,0,0]),1/loop.length),pole=vertices.push(center)-1;for(let index=0;index<loop.length;index++)clean([loop[(index+1)%loop.length],loop[index],pole]);},eventCollar=(loopSets,row)=>{const frameA=frames[row],frameB=frames[row+1],t=v3.norm(v3.add(frameA.t,frameB.t)),anchor=v3.mix(frameA.anchor,frameB.anchor,.5),project=axis=>v3.sub(axis,v3.scale(t,v3.dot(axis,t)));let u=v3.norm(project(v3.add(frameA.u,frameB.u)));if(v3.len(u)<1e-5)u=frameA.u;let v=v3.norm(v3.cross(t,u));if(v3.dot(v,v3.add(frameA.v,frameB.v))<0)v=v3.scale(v,-1);const points=loopSets.flat().flatMap(loop=>loop.map(index=>{const point=vertices[index];return [v3.dot(point,u),v3.dot(point,v)];})).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(origin,a,b)=>(a[0]-origin[0])*(b[1]-origin[1])-(a[1]-origin[1])*(b[0]-origin[0]),lower=[],upper=[];for(const point of points){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],point)<=0)lower.pop();lower.push(point);}for(let index=points.length-1;index>=0;index--){const point=points[index];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],point)<=0)upper.pop();upper.push(point);}lower.pop();upper.pop();const hull=lower.concat(upper);if(hull.length<3)throw new Error(`Contour event collar collapsed at row ${row+1}.`);const lengths=[],total=hull.reduce((sum,point,index)=>{const length=Math.hypot(...sub2(hull[(index+1)%hull.length],point));lengths.push(length);return sum+length;},0),indices=[];let edge=0,edgeStart=0;for(let sample=0;sample<ringCount;sample++){const target=total*sample/ringCount;while(edge<hull.length-1&&edgeStart+lengths[edge]<target){edgeStart+=lengths[edge];edge++;}const amount=(target-edgeStart)/Math.max(lengths[edge],EPS),point=mix2(hull[edge],hull[(edge+1)%hull.length],amount),world=v3.add(anchor,v3.add(v3.scale(u,point[0]-v3.dot(anchor,u)),v3.scale(v,point[1]-v3.dot(anchor,v))));indices.push(vertices.push(world)-1);}return indices;};
  const closestContourPair=contours=>{let best=[0,1],bestDistance=Infinity;for(let first=0;first<contours.length;first++)for(let second=first+1;second<contours.length;second++){const distance=v3.dot(v3.sub(contours[first].center,contours[second].center),v3.sub(contours[first].center,contours[second].center));if(distance<bestDistance){bestDistance=distance;best=[first,second];}}return best;};
  const syntheticBinaryParent=(children,row)=>{const indices=eventCollar([children.map(child=>child.indices)],row),sources=new Set(children.flatMap(child=>[...child.sources])),center=v3.scale(indices.reduce((sum,index)=>v3.add(sum,vertices[index]),[0,0,0]),1/indices.length),owners=indices.map(index=>children.reduce((best,child)=>{const distance=v3.dot(v3.sub(vertices[index],child.center),v3.sub(vertices[index],child.center));return !best||distance<best.distance?{source:[...child.sources][0],distance}:best;},null).source);return {indices,sources,center,owners};};
  const serializeThreeWay=(parentContour,children,row)=>{if(children.length!==3)return false;const [first,second]=closestContourPair(children),pair=[children[first],children[second]],remaining=children.find((_,index)=>index!==first&&index!==second),middle=syntheticBinaryParent(pair,row);return binaryJunction(middle,pair,true)&&binaryJunction(parentContour,[middle,remaining],true);};
  const triangulateJunction=(outer,holes,row)=>{
    const frameA=frames[row],frameB=frames[row+1],normal=v3.norm(v3.add(frameA.t,frameB.t)),u=v3.norm(v3.add(frameA.u,frameB.u)),v=v3.norm(v3.cross(normal,u)),project=index=>[v3.dot(vertices[index],u),v3.dot(vertices[index],v)],area=sequence=>sequence.reduce((sum,item,index)=>sum+cross2(item.p,sequence[(index+1)%sequence.length].p),0)*.5;
    let sequence=outer.map(index=>({index,p:project(index)}));if(area(sequence)<0)sequence.reverse();const outerSet=new Set(outer),usedOuter=new Set(),orderedHoles=holes.map(loop=>{let items=loop.map(index=>({index,p:project(index)}));if(area(items)>0)items.reverse();return items;}).sort((a,b)=>Math.max(...b.map(item=>item.p[0]))-Math.max(...a.map(item=>item.p[0])));
    for(const hole of orderedHoles){let holeStart=0;for(let index=1;index<hole.length;index++)if(hole[index].p[0]>hole[holeStart].p[0]||(hole[index].p[0]===hole[holeStart].p[0]&&hole[index].p[1]<hole[holeStart].p[1]))holeStart=index;let outerStart=0,best=Infinity;for(let index=0;index<sequence.length;index++){if(!outerSet.has(sequence[index].index)||usedOuter.has(sequence[index].index))continue;const dx=sequence[index].p[0]-hole[holeStart].p[0],dy=sequence[index].p[1]-hole[holeStart].p[1],distance=dx*dx+dy*dy;if(distance<best){best=distance;outerStart=index;}}usedOuter.add(sequence[outerStart].index);const rotated=Array.from({length:hole.length},(_,index)=>hole[(holeStart+index)%hole.length]),outerItem=sequence[outerStart],holeItem=rotated[0],bridge=sub2(holeItem.p,outerItem.p),bridgeLength=Math.max(EPS,Math.hypot(...bridge)),bridgeOffset=Math.max(planarTolerance*10,diagonal*2e-5),offset=[-bridge[1]/bridgeLength*bridgeOffset,bridge[0]/bridgeLength*bridgeOffset],shift=(item,amount)=>({index:item.index,p:[item.p[0]+offset[0]*amount,item.p[1]+offset[1]*amount]});sequence=[...sequence.slice(0,outerStart+1),shift(holeItem,1),...rotated.slice(1).map(item=>({...item,p:[...item.p]})),shift(holeItem,-1),shift(outerItem,-1),...sequence.slice(outerStart+1)];}
    const samePoint=(a,b)=>Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1])<planarTolerance,pointInTriangle=(point,a,b,c)=>{const first=cross2(sub2(b,a),sub2(point,a)),second=cross2(sub2(c,b),sub2(point,b)),third=cross2(sub2(a,c),sub2(point,c));return first>=-planarTolerance&&second>=-planarTolerance&&third>=-planarTolerance;},segmentsCross=(a,b,c,d)=>{const ab=sub2(b,a),cd=sub2(d,c),den=cross2(ab,cd);if(Math.abs(den)<=planarTolerance)return false;const delta=sub2(c,a),first=cross2(delta,cd)/den,second=cross2(delta,ab)/den;return first>planarTolerance&&first<1-planarTolerance&&second>planarTolerance&&second<1-planarTolerance;};let guard=0;
    while(sequence.length>3&&guard++<10000){let clipped=false;for(let index=0;index<sequence.length;index++){const previous=sequence[(index+sequence.length-1)%sequence.length],current=sequence[index],next=sequence[(index+1)%sequence.length],turn=cross2(sub2(current.p,previous.p),sub2(next.p,current.p));if(turn<=planarTolerance)continue;let blocked=false;for(let edge=0;edge<sequence.length;edge++){const a=sequence[edge],b=sequence[(edge+1)%sequence.length];if(a===previous||a===next||b===previous||b===next||samePoint(a,previous)||samePoint(a,next)||samePoint(b,previous)||samePoint(b,next))continue;if(segmentsCross(previous.p,next.p,a.p,b.p)){blocked=true;break;}}if(blocked)continue;for(let other=0;other<sequence.length;other++){if(other===index||other===(index+1)%sequence.length||other===(index+sequence.length-1)%sequence.length)continue;const point=sequence[other];if(samePoint(point,previous)||samePoint(point,current)||samePoint(point,next))continue;if(pointInTriangle(point.p,previous.p,current.p,next.p)){blocked=true;break;}}if(blocked)continue;clean([previous.index,current.index,next.index]);sequence.splice(index,1);clipped=true;break;}if(!clipped){if(area(sequence)<-planarTolerance){sequence.reverse();continue;}let removed=false;for(let index=0;index<sequence.length;index++){const previous=sequence[(index+sequence.length-1)%sequence.length],current=sequence[index],next=sequence[(index+1)%sequence.length];if(Math.abs(cross2(sub2(current.p,previous.p),sub2(next.p,current.p)))<=planarTolerance&&!samePoint(previous,next)){sequence.splice(index,1);removed=true;break;}}if(!removed)throw new Error(`Could not triangulate contour junction at row ${row+1} (${sequence.length} vertices, area ${area(sequence)}).`);}}
    if(sequence.length===3)clean(sequence.map(item=>item.index));
  };
  let mergeEvents=0,splitEvents=0;
  for(let row=0;row<rows.length-1;row++){
    const first=rows[row],second=rows[row+1],nodeCount=first.length+second.length,parent=Array.from({length:nodeCount},(_,index)=>index),find=index=>parent[index]===index?index:(parent[index]=find(parent[index])),join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;},relations=[];
    for(let a=0;a<first.length;a++)for(let b=0;b<second.length;b++){const related=[...first[a].sources].some(source=>second[b].sources.has(source));if(related){join(a,first.length+b);relations.push([a,b]);}}
    if(!options.preserveContourDeaths){
      for(let a=0;a<first.length;a++)if(!relations.some(pair=>pair[0]===a)){let nearest=0,best=Infinity;for(let b=0;b<second.length;b++){const distance=v3.dot(v3.sub(first[a].center,second[b].center),v3.sub(first[a].center,second[b].center));if(distance<best){best=distance;nearest=b;}}join(a,first.length+nearest);relations.push([a,nearest]);}
      for(let b=0;b<second.length;b++)if(!relations.some(pair=>pair[1]===b)){let nearest=0,best=Infinity;for(let a=0;a<first.length;a++){const distance=v3.dot(v3.sub(first[a].center,second[b].center),v3.sub(first[a].center,second[b].center));if(distance<best){best=distance;nearest=a;}}join(nearest,first.length+b);relations.push([nearest,b]);}
    }
    const components=new Map();for(let index=0;index<nodeCount;index++){const root=find(index);if(!components.has(root))components.set(root,{first:[],second:[]});(index<first.length?components.get(root).first:components.get(root).second).push(index<first.length?index:index-first.length);}
    for(const component of components.values()){
      const firstContours=component.first.map(index=>first[index]),secondContours=component.second.map(index=>second[index]),firstLoops=firstContours.map(contour=>contour.indices),secondLoops=secondContours.map(contour=>contour.indices);
      if(firstLoops.length&&!secondLoops.length){for(const contour of firstContours){const sources=[...contour.sources],target=sources.length?v3.scale(sources.reduce((sum,source)=>v3.add(sum,sourceSweeps[source].frames[sourceSweeps[source].frames.length-1].c),[0,0,0]),1/sources.length):undefined;cap(contour.indices,target);}continue;}
      if(secondLoops.length&&!firstLoops.length){for(const contour of secondContours){const sources=[...contour.sources],target=sources.length?v3.scale(sources.reduce((sum,source)=>v3.add(sum,sourceSweeps[source].frames[0].c),[0,0,0]),1/sources.length):undefined;cap(contour.indices,target);}continue;}
      if(firstLoops.length===1&&secondLoops.length===1){stitch(firstLoops[0],secondLoops[0],Boolean(options.sectionPreservePhase&&firstContours[0].phaseTrack===secondContours[0].phaseTrack));continue;}
      if(!options.planarEventPatches&&firstLoops.length===2&&secondLoops.length===1&&binaryJunction(secondContours[0],firstContours)){mergeEvents++;continue;}
      if(!options.planarEventPatches&&firstLoops.length===1&&secondLoops.length===2&&binaryJunction(firstContours[0],secondContours)){splitEvents++;continue;}
      if(!options.planarEventPatches&&firstLoops.length===3&&secondLoops.length===1&&serializeThreeWay(secondContours[0],firstContours,row)){mergeEvents+=2;continue;}
      if(!options.planarEventPatches&&firstLoops.length===1&&secondLoops.length===3&&serializeThreeWay(firstContours[0],secondContours,row)){splitEvents+=2;continue;}
      const collar=eventCollar([firstLoops,secondLoops],row);if(firstLoops.length===1)stitch(firstLoops[0],collar);else{triangulateJunction(collar,firstLoops,row);mergeEvents++;}if(secondLoops.length===1)stitch(collar,secondLoops[0]);else{triangulateJunction(collar,secondLoops,row);splitEvents++;}
    }
  }
  if(options.sectionFinalizeContours)options.sectionFinalizeContours(rows,vertices);
  for(const contour of rows[0])cap(contour.indices);for(const contour of rows[rows.length-1]){const sources=[...contour.sources],target=sources.length?v3.scale(sources.reduce((sum,source)=>v3.add(sum,sourceSweeps[source].frames[sourceSweeps[source].frames.length-1].c),[0,0,0]),1/sources.length):undefined;cap(contour.indices,target);}orientFacesOutward(vertices,objFaces);const faces=[];for(const face of objFaces)for(let index=1;index<face.length-1;index++)faces.push([face[0],face[index],face[index+1]]);let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}return {vertices,faces,objFaces,bounds:{lo,hi},topologyMode:'transported-section-contours',generationStrategy:'transported-section-contours',axialLoops:axial,sectionRingCount:ringCount,sectionContourCounts:rows.map(row=>row.length),sectionContourSources:rows.map(row=>row.map(contour=>[...contour.sources].sort((a,b)=>a-b))),sectionJunctionStats:junctionStats,sectionStableOwnerStats:stableOwnerStats,profileContactLayoutStats,profileContactEventStats,adaptiveSectionEventStations:adaptiveEventStats,sectionMergeEvents:mergeEvents,sectionSplitEvents:splitEvents,preservedStrands:0,remeshedGroups:1,simplifiedInternalGaps:false};
}

function profileContactSectionContourPairMesh(sourceSweeps,axialLoops=20,options={}){
  if(sourceSweeps.length!==2)throw new Error('Profile-contact section contours require exactly two strands.');
  const requested=Math.round(Number(options.sectionRingCount)||14),ringCount=Math.max(8,Math.min(20,requested+(requested%2))),mesh=sectionContourMesh(sourceSweeps,axialLoops,{...options,sectionRingCount:ringCount,planeAlignedStations:true,stableOwnerCorrespondence:true,adaptiveEventStations:false,geometricEventPartition:false,matchedEventPatch:false,preserveContourDeaths:true,profileContactEndpointTransport:true,profileContactRequireSingleEvent:true,profileContactSourceDensity:Boolean(options.profileContactSourceDensity)});
  if(mesh.profileContactEventStats?.stableEventRows?.length!==1||!mesh.sectionJunctionStats?.some(stat=>stat.profileContactAnchored))throw new Error('No stable profile-contact saddle was constructed.');
  const audit=strictQualityAudit(mesh);mesh.profileContactAudit=audit;if(!audit.hardValid&&!options.allowUnsafeDiagnostic){const error=new Error(`Profile-contact candidate failed its strict surface gate (${audit.validation.boundaryEdges} boundary, ${audit.validation.nonManifoldEdges} non-manifold, ${audit.validation.ngons} ngons, ${audit.penetrations.trianglePairs} penetrating pairs).`);error.candidateMesh=mesh;throw error;}
  mesh.topologyMode=options.profileContactSourceDensity?'profile-contact-section-pair-dense':'profile-contact-section-pair';mesh.generationStrategy=options.profileContactSourceDensity?'profile-contact-transport-dense':'profile-contact-transport';mesh.topologyMutation='continuous-profile-endpoints-and-transported-arcs';mesh.profileContactEndpointTransport=true;mesh.profileContactSourceDensity=Boolean(options.profileContactSourceDensity);return mesh;
}

function strictQualityAudit(mesh,expectedComponents=1){
  const validation=validateTopology(mesh),penetrations=detectPenetrations(mesh),faces=mesh.objFaces||mesh.faces||[],vertices=mesh.vertices||[],diagonal=Math.max(EPS,v3.len(v3.sub(mesh.bounds?.hi||[1,1,1],mesh.bounds?.lo||[0,0,0]))),areaEpsilon=diagonal*diagonal*1e-12,canonical=new Set(),vertexFaces=Array.from({length:vertices.length},()=>[]),edgeDirections=new Map();let repeatedIndices=0,duplicateFaces=0,zeroAreaFaces=0,sliverTriangles=0,inconsistentWindingEdges=0,foldedQuads=0,worstQuadNormalDot=1;
  const edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,triangleArea=(a,b,c)=>v3.len(v3.cross(v3.sub(b,a),v3.sub(c,a)))*.5,triangleAspect=(a,b,c)=>{const lengths=[v3.len(v3.sub(a,b)),v3.len(v3.sub(b,c)),v3.len(v3.sub(c,a))],area=triangleArea(a,b,c);return Math.max(...lengths)**2*Math.sqrt(3)/Math.max(4*area,EPS);};
  faces.forEach((face,faceIndex)=>{if(new Set(face).size!==face.length)repeatedIndices++;const key=[...face].sort((a,b)=>a-b).join(',');if(canonical.has(key))duplicateFaces++;else canonical.add(key);for(const vertex of face)if(vertexFaces[vertex])vertexFaces[vertex].push(faceIndex);for(let edge=0;edge<face.length;edge++){const a=face[edge],b=face[(edge+1)%face.length],key=edgeKey(a,b);if(!edgeDirections.has(key))edgeDirections.set(key,[]);edgeDirections.get(key).push(a<b?1:-1);}let faceArea=0;for(let index=1;index<face.length-1;index++){const a=vertices[face[0]],b=vertices[face[index]],c=vertices[face[index+1]],area=triangleArea(a,b,c);faceArea+=area;if(area>areaEpsilon&&triangleAspect(a,b,c)>8)sliverTriangles++;}if(face.length===4){const quality=quadDiagonalQuality(vertices,face,false);worstQuadNormalDot=Math.min(worstQuadNormalDot,quality);if(quality<.15)foldedQuads++;}if(faceArea<=areaEpsilon)zeroAreaFaces++;});
  for(const directions of edgeDirections.values())if(directions.length===2&&directions[0]===directions[1])inconsistentWindingEdges++;
  let bowTieVertices=0;for(let vertex=0;vertex<vertexFaces.length;vertex++){const incident=vertexFaces[vertex];if(incident.length<2)continue;const remaining=new Set(incident),stack=[incident[0]];remaining.delete(incident[0]);while(stack.length){const faceIndex=stack.pop(),face=faces[faceIndex];for(const candidate of [...remaining]){const other=faces[candidate];if(face.some(index=>index!==vertex&&other.includes(index))){remaining.delete(candidate);stack.push(candidate);}}}if(remaining.size)bowTieVertices++;}
  const used=new Set(faces.flat()),unusedVertices=Math.max(0,vertices.length-used.size),hardValid=validation.watertight&&validation.ngons===0&&validation.boundaryEdges===0&&validation.nonManifoldEdges===0&&validation.components===expectedComponents&&!repeatedIndices&&!duplicateFaces&&!zeroAreaFaces&&!bowTieVertices&&!inconsistentWindingEdges&&!unusedVertices&&!penetrations.truncated&&penetrations.trianglePairs===0;
  return {validation,penetrations,expectedComponents,repeatedIndices,duplicateFaces,zeroAreaFaces,sliverTriangles,foldedQuads,worstQuadNormalDot,bowTieVertices,inconsistentWindingEdges,unusedVertices,hardValid};
}

function qualityGeometryAcceptable(grade){
  const metrics=grade?.metrics||{},shape=grade?.scores?.shape||0,coverage=Number(metrics.hardReferenceCoverage??metrics.referenceCoverage??0),volume=Number(metrics.boundsVolumeRatio||0);
  return shape>=60&&coverage>=50&&volume>=.55&&volume<=1.45;
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

function artistMeshDiagnostics(mesh,sweeps,adjacency,tipPoleVertices=[]){
  const vertices=mesh.vertices||[],faces=mesh.objFaces||mesh.faces||[],edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,clamp01=value=>Math.max(0,Math.min(1,value)),median=values=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])*.5;},percentile=(values,fraction)=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),position=clamp01(fraction)*(sorted.length-1),lower=Math.floor(position),upper=Math.ceil(position),mix=position-lower;return sorted[lower]+(sorted[upper]-sorted[lower])*mix;},triangleArea=(a,b,c)=>v3.len(v3.cross(v3.sub(b,a),v3.sub(c,a)))*.5;
  const defaults={alignmentScore:100,spacingScore:100,densityRegularityScore:100,localSpacingDeviationP90:0,transitionStretchScore:100,transitionStretchP95:1,transitionStretchMax:1,transitionOppositeStretchP95:1,transitionOppositeStretchMax:1,transitionFaceAspectP95:1,transitionFaceAspectMax:1,railKinkScore:100,railKinkP95Degrees:0,railKinkMaxDegrees:0,railKinkSamples:0,spiralEdges:0,sampledFlowEdges:0,tipPoleEdgesExcluded:0,longitudinalTrackCount:0,longitudinalMonotonicityScore:100,transverseTrackCount:0,transverseAxialDriftScore:100,illegalTrackTerminations:0,trackTerminationScore:100,trackFlowScore:100,ambiguousOwnershipVertices:0,contactLocalityScore:100,gapBridgeVertices:0,gapBridgeFaces:0,sharedOwnershipFaces:0,bodyTriangleCount:0,bodyTriangleAreaRatio:0,dissolvableTrianglePairs:0,triangleLocalityScore:100,unnecessaryTriangleCount:0,_assignments:[],_nearJunction:new Set(),_edgeRecords:[]};
  if(!vertices.length||!Array.isArray(sweeps)||!sweeps.length)return defaults;
  const bounds=mesh.bounds||(()=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of vertices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}return {lo,hi};})(),diagonal=Math.max(EPS,v3.len(v3.sub(bounds.hi,bounds.lo)));
  const projectToSweep=(point,sweep,source)=>{const frames=sweep.frames||[];if(!frames.length)return {source,u:0,tangent:[0,1,0],radius:diagonal,score:Infinity,center:[0,0,0]};if(frames.length===1){const frame=frames[0],offset=v3.sub(point,frame.c),[nx,nz]=sweepProfileCoordinates(frame,point);return {source,u:0,tangent:frame.t,radius:Math.max(frame.width,frame.depth),score:Math.abs(polySignedDistance(nx,nz,sweep.profile)),center:frame.c};}let best={source,u:0,tangent:frames[0].t,radius:Math.max(frames[0].width,frames[0].depth),score:Infinity,center:frames[0].c};for(let segment=0;segment<frames.length-1;segment++){const first=frames[segment],second=frames[segment+1],axis=v3.sub(second.c,first.c),raw=v3.dot(v3.sub(point,first.c),axis)/(v3.dot(axis,axis)+EPS),amount=clamp(raw),center=v3.mix(first.c,second.c,amount),x=v3.norm(v3.mix(first.x,second.x,amount)),z=v3.norm(v3.mix(first.z,second.z,amount)),width=first.width+(second.width-first.width)*amount,depth=first.depth+(second.depth-first.depth)*amount,offset=v3.sub(point,center),[nx,nz]=sweepProfileCoordinates(interpolateSweepFrame(first,second,amount),point),outside=Math.max(0,-raw,raw-1),score=Math.abs(polySignedDistance(nx,nz,sweep.profile))+outside*.5;if(score<best.score)best={source,u:sweepSegmentFraction(sweep,segment,amount),tangent:v3.norm(v3.mix(first.t,second.t,amount)),radius:Math.max(width,depth),score,center};}return best;};
  const assignments=vertices.map(point=>{const projections=sweeps.map((sweep,source)=>projectToSweep(point,sweep,source)).sort((a,b)=>a.score-b.score),first=projections[0],second=projections[1],ambiguous=Boolean(second&&second.score<.5&&second.score-first.score<.2);return {...first,second,ambiguous,tip:first.u<=.07||first.u>=.93};}),nearJunction=new Set();for(let vertex=0;vertex<assignments.length;vertex++)if(assignments[vertex].ambiguous){nearJunction.add(vertex);for(const neighbor of adjacency[vertex]||[])nearJunction.add(neighbor);}for(const vertex of [...nearJunction])for(const neighbor of adjacency[vertex]||[])nearJunction.add(neighbor);
  const edgeFaces=new Map(),edgeRecords=[];for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const face=faces[faceIndex];for(let edge=0;edge<face.length;edge++){const a=face[edge],b=face[(edge+1)%face.length],key=edgeKey(a,b);if(!edgeFaces.has(key))edgeFaces.set(key,{a,b,faces:[]});edgeFaces.get(key).faces.push(faceIndex);}}let alignment=0,sampledFlowEdges=0,spiralEdges=0,tipPoleEdgesExcluded=0;const alongLengths=[],acrossLengths=[],incidentRecords=Array.from({length:vertices.length},()=>[]),tipSet=tipPoleVertices instanceof Set?tipPoleVertices:new Set(tipPoleVertices);
  for(const record of edgeFaces.values()){const {a,b}=record,first=assignments[a],second=assignments[b],delta=v3.sub(vertices[b],vertices[a]),length=v3.len(delta);if(length<EPS)continue;if(tipSet.has(a)||tipSet.has(b)){tipPoleEdgesExcluded++;continue;}const owner=first.source===second.source?first.source:-1,tangent=owner>=0?v3.norm(v3.add(first.tangent,second.tangent)):[0,1,0],dot=owner>=0?Math.abs(v3.dot(v3.scale(delta,1/length),tangent)):.5,kind=dot>=.68?'along':dot<=.32?'across':'diagonal',junction=owner<0||first.ambiguous||second.ambiguous,info={...record,key:edgeKey(a,b),owner,dot,kind,junction,length};edgeRecords.push(info);incidentRecords[a].push(info);incidentRecords[b].push(info);if(owner<0)continue;const axisFit=Math.max(dot,1-dot);alignment+=Math.max(0,(axisFit-.5)*2);sampledFlowEdges++;if(kind==='along')alongLengths.push(length);else if(kind==='across')acrossLengths.push(length);else spiralEdges++;}
  const spacingScoreFor=values=>{if(values.length<3)return 100;const center=median(values),deviation=median(values.map(value=>Math.abs(Math.log(Math.max(value,EPS)/Math.max(center,EPS)))));return 100*Math.exp(-2.5*deviation);},alignmentScore=sampledFlowEdges?100*alignment/sampledFlowEdges:100,spacingScore=(spacingScoreFor(alongLengths)+spacingScoreFor(acrossLengths))*.5,localSpacingDeviations=[];
  for(const record of edgeRecords)if(record.owner>=0&&record.kind==='along'&&!record.junction&&!assignments[record.a].tip&&!assignments[record.b].tip){const neighbors=[...incidentRecords[record.a],...incidentRecords[record.b]].filter(other=>other!==record&&other.owner===record.owner&&other.kind==='along'&&!other.junction&&!assignments[other.a].tip&&!assignments[other.b].tip).map(other=>other.length);if(neighbors.length>=2){const local=median(neighbors);localSpacingDeviations.push(Math.abs(Math.log(Math.max(record.length,EPS)/Math.max(local,EPS))));}}const localSpacingDeviationP90=percentile(localSpacingDeviations,.9),densityRegularityScore=100*Math.exp(-1.8*localSpacingDeviationP90);
  const trackComponents=kind=>{const eligible=edgeRecords.filter(record=>record.owner>=0&&record.kind===kind&&!record.junction),visited=new Set(),components=[];for(const seed of eligible){if(visited.has(seed.key))continue;const stack=[seed],records=[],owner=seed.owner;visited.add(seed.key);while(stack.length){const current=stack.pop();records.push(current);for(const vertex of [current.a,current.b])for(const next of incidentRecords[vertex])if(next.owner===owner&&next.kind===kind&&!next.junction&&!visited.has(next.key)){visited.add(next.key);stack.push(next);}}components.push({owner,records});}return components;},legalTermination=vertex=>{const assignment=assignments[vertex],extraordinary=(adjacency[vertex]?.size||0)!==4||[...(adjacency[vertex]||[])].some(neighbor=>(adjacency[neighbor]?.size||0)!==4);return assignment.tip||assignment.u<=.08||assignment.u>=.92||nearJunction.has(vertex)||extraordinary;},orderedTrack=component=>{const degree=new Map(),byVertex=new Map();for(const record of component.records)for(const vertex of [record.a,record.b]){degree.set(vertex,(degree.get(vertex)||0)+1);if(!byVertex.has(vertex))byVertex.set(vertex,[]);byVertex.get(vertex).push(record);}const endpoints=[...degree].filter(([,value])=>value===1).map(([vertex])=>vertex),branches=[...degree].filter(([,value])=>value>2).length,start=endpoints[0]??component.records[0]?.a,used=new Set(),verticesInOrder=start===undefined?[]:[start];let current=start;while(current!==undefined){const next=(byVertex.get(current)||[]).find(record=>!used.has(record.key));if(!next)break;used.add(next.key);current=next.a===current?next.b:next.a;verticesInOrder.push(current);if(used.size>component.records.length)break;}return {degree,endpoints,branches,verticesInOrder,complete:used.size===component.records.length};};
  const alongComponents=trackComponents('along'),monotonicities=[];let illegalTrackTerminations=0,longitudinalTrackCount=0;for(const component of alongComponents){if(component.records.length<2)continue;const ordered=orderedTrack(component);longitudinalTrackCount++;for(const endpoint of ordered.endpoints)if(!legalTermination(endpoint))illegalTrackTerminations++;if(ordered.branches||!ordered.complete||ordered.verticesInOrder.length<3){monotonicities.push(.35);continue;}const parameters=ordered.verticesInOrder.map(vertex=>assignments[vertex].u),variation=parameters.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-parameters[index]),0),span=Math.abs(parameters[parameters.length-1]-parameters[0]),rowStep=1/Math.max(2,(sweeps[component.owner].frames||[]).length-1);monotonicities.push(variation>rowStep*.4?clamp01(span/variation):1);}
  const acrossComponents=trackComponents('across'),driftScores=[];let transverseTrackCount=0;for(const component of acrossComponents){if(component.records.length<3)continue;const ordered=orderedTrack(component),parameters=[...ordered.degree.keys()].map(vertex=>assignments[vertex].u),rowStep=1/Math.max(2,(sweeps[component.owner].frames||[]).length-1),drift=(percentile(parameters,.9)-percentile(parameters,.1))/Math.max(rowStep,EPS),branchFactor=ordered.branches||!ordered.complete?.65:1;transverseTrackCount++;for(const endpoint of ordered.endpoints)if(!legalTermination(endpoint))illegalTrackTerminations++;driftScores.push(Math.exp(-1.35*Math.max(0,drift-.65))*branchFactor);}
  const robustScore=values=>values.length?100*(.7*(values.reduce((sum,value)=>sum+value,0)/values.length)+.3*percentile(values,.1)):100,longitudinalMonotonicityScore=robustScore(monotonicities),transverseAxialDriftScore=robustScore(driftScores),trackCount=Math.max(1,longitudinalTrackCount+transverseTrackCount),trackTerminationScore=100*Math.exp(-2.2*illegalTrackTerminations/trackCount),trackFlowScore=.47*longitudinalMonotonicityScore+.36*transverseAxialDriftScore+.17*trackTerminationScore;
  const frameIndices=frames=>{const count=Math.min(24,frames.length),indices=[];for(let index=0;index<count;index++)indices.push(Math.round(index*(frames.length-1)/Math.max(1,count-1)));return [...new Set(indices)];},contactCache=new Map(),pairKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,contactFor=(a,b)=>{const key=pairKey(a,b);if(contactCache.has(key))return contactCache.get(key);const first=sweeps[a],second=sweeps[b],samples=[];const scan=(source,target,reverse=false)=>{const sourceIndices=frameIndices(source.frames||[]),targetIndices=frameIndices(target.frames||[]);for(const sourceIndex of sourceIndices){const sourceFrame=source.frames[sourceIndex];let best={clearance:Infinity,targetIndex:0};for(const targetIndex of targetIndices){const targetFrame=target.frames[targetIndex],reach=Math.max(sourceFrame.width,sourceFrame.depth)+Math.max(targetFrame.width,targetFrame.depth),clearance=v3.len(v3.sub(sourceFrame.c,targetFrame.c))/Math.max(reach,EPS)-1;if(clearance<best.clearance)best={clearance,targetIndex};}if(best.clearance<=.1){const firstU=sourceIndex/Math.max(1,source.frames.length-1),secondU=best.targetIndex/Math.max(1,target.frames.length-1);samples.push(reverse?{a:secondU,b:firstU}:{a:firstU,b:secondU});}}};scan(first,second);scan(second,first,true);const value={samples,aStep:1/Math.max(2,first.frames.length-1),bStep:1/Math.max(2,second.frames.length-1)};contactCache.set(key,value);return value;},contactIsLocal=(a,b,projectionA,projectionB)=>{if(a===b)return true;let first=a,second=b,pa=projectionA,pb=projectionB;if(first>second){[first,second]=[second,first];[pa,pb]=[pb,pa];}const contact=contactFor(first,second),aTolerance=Math.max(.08,contact.aStep*2.5),bTolerance=Math.max(.08,contact.bStep*2.5);return contact.samples.some(sample=>Math.abs(pa.u-sample.a)<=aTolerance&&Math.abs(pb.u-sample.b)<=bTolerance);};
  let gapBridgeVertices=0,ambiguousOwnershipVertices=0;for(const assignment of assignments)if(assignment.ambiguous&&assignment.second){ambiguousOwnershipVertices++;if(!contactIsLocal(assignment.source,assignment.second.source,assignment,assignment.second))gapBridgeVertices++;}let gapBridgeFaces=0,sharedOwnershipFaces=0;for(const face of faces){const owners=[...new Set(face.map(vertex=>assignments[vertex].source))];if(owners.length<2)continue;sharedOwnershipFaces++;const center=v3.scale(face.reduce((sum,vertex)=>v3.add(sum,vertices[vertex]),[0,0,0]),1/face.length);let invalid=false;for(let first=0;first<owners.length&&!invalid;first++)for(let second=first+1;second<owners.length;second++){const a=owners[first],b=owners[second],pa=projectToSweep(center,sweeps[a],a),pb=projectToSweep(center,sweeps[b],b);if(!contactIsLocal(a,b,pa,pb)){invalid=true;break;}}if(invalid)gapBridgeFaces++;}const bridgeRate=gapBridgeFaces/Math.max(1,sharedOwnershipFaces)+.35*gapBridgeVertices/Math.max(1,ambiguousOwnershipVertices),contactLocalityScore=100*Math.exp(-4*bridgeRate);
  const faceAreas=faces.map(face=>{let area=0;for(let index=1;index<face.length-1;index++)area+=triangleArea(vertices[face[0]],vertices[face[index]],vertices[face[index+1]]);return area;}),totalArea=Math.max(EPS,faceAreas.reduce((sum,area)=>sum+area,0)),triangleAllowed=faces.map(face=>face.length===3&&face.some(vertex=>assignments[vertex].tip||nearJunction.has(vertex))),bodyTriangles=[];for(let faceIndex=0;faceIndex<faces.length;faceIndex++)if(faces[faceIndex].length===3&&!triangleAllowed[faceIndex])bodyTriangles.push(faceIndex);const bodyTriangleArea=bodyTriangles.reduce((sum,index)=>sum+faceAreas[index],0);let dissolvableTrianglePairs=0;for(const record of edgeFaces.values())if(record.faces.length===2){const firstIndex=record.faces[0],secondIndex=record.faces[1],first=faces[firstIndex],second=faces[secondIndex];if(first.length!==3||second.length!==3||triangleAllowed[firstIndex]||triangleAllowed[secondIndex])continue;const unique=[...new Set([...first,...second])];if(unique.length!==4)continue;const firstNormal=v3.norm(v3.cross(v3.sub(vertices[first[1]],vertices[first[0]]),v3.sub(vertices[first[2]],vertices[first[0]]))),secondNormal=v3.norm(v3.cross(v3.sub(vertices[second[1]],vertices[second[0]]),v3.sub(vertices[second[2]],vertices[second[0]])));if(Math.abs(v3.dot(firstNormal,secondNormal))>=.96)dissolvableTrianglePairs++;}const bodyTriangleAreaRatio=bodyTriangleArea/totalArea,triangleLocalityScore=100*Math.exp(-6*bodyTriangleAreaRatio-3*dissolvableTrianglePairs/Math.max(1,faces.length)),unnecessaryTriangleCount=bodyTriangles.length+dissolvableTrianglePairs;
  // Global medians can make one catastrophic row jump disappear inside an
  // otherwise regular mesh.  Follow opposite quad edges and the straightest
  // continuation at each endpoint, then grade the P95 and robust maximum of
  // their local length ratios. Junction edges participate. The cap pole and
  // its authored first ring do not: those faces intentionally collapse into
  // a point and are already judged by the tip/pole rules. This geometric mask
  // applies only to stretch sampling; rail-kink sampling remains unchanged.
  const transitionEdges=[...edgeFaces.values()].map(record=>{const delta=v3.sub(vertices[record.b],vertices[record.a]),length=v3.len(delta);return {...record,key:edgeKey(record.a,record.b),length,direction:length>EPS?v3.scale(delta,1/length):[0,0,0]};}).filter(record=>record.length>EPS),transitionByKey=new Map(transitionEdges.map(record=>[record.key,record])),transitionIncident=Array.from({length:vertices.length},()=>[]);for(const record of transitionEdges){transitionIncident[record.a].push(record);transitionIncident[record.b].push(record);}const transitionMedian=median(transitionEdges.map(record=>record.length)),transitionFloor=transitionMedian*.1,transitionTipNeighborhood=new Set(tipSet);for(const pole of tipSet)for(const neighbor of adjacency[pole]||[])transitionTipNeighborhood.add(neighbor);const stretchEdges=transitionEdges.filter(record=>!transitionTipNeighborhood.has(record.a)&&!transitionTipNeighborhood.has(record.b)),stretchByKey=new Map(stretchEdges.map(record=>[record.key,record])),stretchIncident=Array.from({length:vertices.length},()=>[]),oppositeEdges=new Map();for(const record of stretchEdges){stretchIncident[record.a].push(record);stretchIncident[record.b].push(record);}for(const face of faces)if(face.length===4&&!face.some(vertex=>transitionTipNeighborhood.has(vertex))){const keys=face.map((vertex,index)=>edgeKey(vertex,face[(index+1)%4]));for(let index=0;index<4;index++){if(!oppositeEdges.has(keys[index]))oppositeEdges.set(keys[index],new Set());oppositeEdges.get(keys[index]).add(keys[(index+2)%4]);}}
  const transitionRatios=[];for(const record of stretchEdges){const comparable=[];for(const key of oppositeEdges.get(record.key)||[]){const candidate=stretchByKey.get(key);if(candidate)comparable.push(candidate.length);}for(const endpoint of [record.a,record.b]){const continuation=stretchIncident[endpoint].filter(candidate=>candidate!==record).map(candidate=>{const other=candidate.a===endpoint?candidate.b:candidate.a,outward=v3.norm(v3.sub(vertices[other],vertices[endpoint]));return {candidate,straightness:Math.abs(v3.dot(record.direction,outward))};}).filter(item=>item.straightness>=.72).sort((first,second)=>second.straightness-first.straightness)[0];if(continuation)comparable.push(continuation.candidate.length);}if(!comparable.length)continue;const local=median(comparable);if(local<transitionFloor||record.length<transitionFloor)continue;transitionRatios.push(Math.max(record.length/local,local/record.length));}
  const regularFaceEdges=faces.filter(face=>!face.some(vertex=>transitionTipNeighborhood.has(vertex))).map(face=>face.map((vertex,index)=>v3.len(v3.sub(vertices[face[(index+1)%face.length]],vertices[vertex])))).filter(lengths=>lengths.length>=3&&Math.min(...lengths)>=transitionFloor),faceAspects=regularFaceEdges.map(lengths=>Math.max(...lengths)/Math.min(...lengths)),oppositeRatios=regularFaceEdges.filter(lengths=>lengths.length===4).map(lengths=>Math.max(lengths[0]/lengths[2],lengths[2]/lengths[0],lengths[1]/lengths[3],lengths[3]/lengths[1])),transitionStretchP95=percentile(transitionRatios,.95),transitionStretchMax=percentile(transitionRatios,.995),transitionOppositeStretchP95=percentile(oppositeRatios,.95),transitionOppositeStretchMax=percentile(oppositeRatios,.995),transitionFaceAspectP95=percentile(faceAspects,.95),transitionFaceAspectMax=percentile(faceAspects,.995),transitionPenalty=.3*Math.max(0,Math.log(transitionStretchP95/1.25))+.35*Math.max(0,Math.log(transitionStretchMax/2))+.1*Math.max(0,Math.log(transitionOppositeStretchP95/2.1))+.1*Math.max(0,Math.log(transitionOppositeStretchMax/2.5))+.15*Math.max(0,Math.log(transitionFaceAspectMax/15)),transitionStretchScore=100*Math.exp(-2.2*transitionPenalty);
  const diagnosticByKey=new Map(edgeRecords.map(record=>[record.key,record])),eligibleRail=record=>{const diagnostic=diagnosticByKey.get(record.key);if(!diagnostic)return false;if(diagnostic.kind==='along')return true;if(!diagnostic.junction)return false;const tangentFit=Math.max(Math.abs(v3.dot(record.direction,assignments[record.a].tangent)),Math.abs(v3.dot(record.direction,assignments[record.b].tangent)));return tangentFit>=.52;},railTurns=[];for(let vertex=0;vertex<transitionIncident.length;vertex++){const candidates=transitionIncident[vertex].filter(record=>record.length>=transitionFloor&&eligibleRail(record));if(candidates.length<2)continue;const pairs=[];for(let first=0;first<candidates.length;first++)for(let second=first+1;second<candidates.length;second++){const a=candidates[first],b=candidates[second],sharedFace=a.faces.some(face=>b.faces.includes(face)),awayA=a.a===vertex?a.direction:v3.scale(a.direction,-1),awayB=b.a===vertex?b.direction:v3.scale(b.direction,-1),straightness=Math.max(-1,Math.min(1,-v3.dot(awayA,awayB))),turn=Math.acos(straightness)*180/Math.PI;pairs.push({first,second,turn,sharedFace});}const preferred=pairs.some(pair=>!pair.sharedFace)?pairs.filter(pair=>!pair.sharedFace):pairs;const used=new Set();for(const pair of preferred.sort((first,second)=>first.turn-second.turn))if(!used.has(pair.first)&&!used.has(pair.second)){railTurns.push(pair.turn);used.add(pair.first);used.add(pair.second);}}
  const railKinkP95Degrees=percentile(railTurns,.95),railKinkMaxDegrees=percentile(railTurns,.995),railKinkPenalty=.55*Math.max(0,(railKinkP95Degrees-18)/18)+.45*Math.max(0,(railKinkMaxDegrees-35)/35),railKinkScore=100*Math.exp(-1.8*railKinkPenalty),railKinkSamples=railTurns.length;
  return {alignmentScore,spacingScore,densityRegularityScore,localSpacingDeviationP90,transitionStretchScore,transitionStretchP95,transitionStretchMax,transitionOppositeStretchP95,transitionOppositeStretchMax,transitionFaceAspectP95,transitionFaceAspectMax,railKinkScore,railKinkP95Degrees,railKinkMaxDegrees,railKinkSamples,spiralEdges,sampledFlowEdges,tipPoleEdgesExcluded,longitudinalTrackCount,longitudinalMonotonicityScore,transverseTrackCount,transverseAxialDriftScore,illegalTrackTerminations,trackTerminationScore,trackFlowScore,ambiguousOwnershipVertices,contactLocalityScore,gapBridgeVertices,gapBridgeFaces,sharedOwnershipFaces,bodyTriangleCount:bodyTriangles.length,bodyTriangleAreaRatio,dissolvableTrianglePairs,triangleLocalityScore,unnecessaryTriangleCount,_assignments:assignments,_nearJunction:nearJunction,_edgeRecords:edgeRecords};
}

function sourceRegionalCoverage(mesh,sweeps,threshold,acceleration=null){
  if(!mesh?.vertices?.length||!Array.isArray(sweeps)||!sweeps.length||!(threshold>0))return {minimumSourceCoverage:100,minimumAxialCoverage:100,meanSourceCoverage:100,coverageRegionCount:0,failedCoverageRegions:0};
  const vertices=mesh.vertices,faces=mesh.objFaces||mesh.faces||[],triangles=[];for(const face of faces)for(let index=1;index<face.length-1;index++)triangles.push([face[0],face[index],face[index+1]]);if(!triangles.length)return {minimumSourceCoverage:0,minimumAxialCoverage:0,meanSourceCoverage:0,coverageRegionCount:0,failedCoverageRegions:0};
  const pointTriangleDistance=(point,a,b,c)=>{const ab=v3.sub(b,a),ac=v3.sub(c,a),ap=v3.sub(point,a),d1=v3.dot(ab,ap),d2=v3.dot(ac,ap);if(d1<=0&&d2<=0)return v3.len(ap);const bp=v3.sub(point,b),d3=v3.dot(ab,bp),d4=v3.dot(ac,bp);if(d3>=0&&d4<=d3)return v3.len(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const amount=d1/(d1-d3);return v3.len(v3.sub(point,v3.add(a,v3.scale(ab,amount))));}const cp=v3.sub(point,c),d5=v3.dot(ab,cp),d6=v3.dot(ac,cp);if(d6>=0&&d5<=d6)return v3.len(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const amount=d2/(d2-d6);return v3.len(v3.sub(point,v3.add(a,v3.scale(ac,amount))));}const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const amount=(d4-d3)/((d4-d3)+(d5-d6));return v3.len(v3.sub(point,v3.add(b,v3.scale(v3.sub(c,b),amount))));}const normal=v3.norm(v3.cross(ab,ac));return Math.abs(v3.dot(ap,normal));},preparedDistance=acceleration?.distanceQuery?.(vertices,triangles,pointTriangleDistance),distanceToMesh=point=>{if(preparedDistance){const best=preparedDistance(point);return Number.isFinite(best)?best:diagonal;}let best=Infinity;for(const triangle of triangles){const distance=pointTriangleDistance(point,vertices[triangle[0]],vertices[triangle[1]],vertices[triangle[2]]);if(Number.isFinite(distance))best=Math.min(best,distance);}return Number.isFinite(best)?best:diagonal;};
  const bounds=mesh.bounds||boundsOf(sweeps),diagonal=Math.max(EPS,v3.len(v3.sub(bounds.hi,bounds.lo))),burialTolerance=diagonal*.01,axialRegions=5,sourceScores=[],regionScores=[];
  for(let source=0;source<sweeps.length;source++){const sweep=sweeps[source],axialSamples=Math.max(3,Math.min(9,sweep.frames.length)),profileSamples=Math.max(4,Math.min(8,sweep.profile.length)),sourcePoints=[],regions=Array.from({length:axialRegions},()=>[]);for(let axial=0;axial<axialSamples;axial++){const frameIndex=Math.round(axial*(sweep.frames.length-1)/Math.max(1,axialSamples-1)),t=frameIndex/Math.max(1,sweep.frames.length-1),frame=sweep.frames[frameIndex],region=Math.min(axialRegions-1,Math.floor(t*axialRegions));for(let radial=0;radial<profileSamples;radial++){const profile=sweep.profile[Math.round(radial*sweep.profile.length/profileSamples)%sweep.profile.length],point=sweepPoint(frame,profile);if(sweeps.some((other,index)=>index!==source&&sweepDistance(point,other)<-burialTolerance))continue;sourcePoints.push(point);regions[region].push(point);}}const coverage=points=>points.length?points.filter(point=>distanceToMesh(point)<=threshold).length/points.length:1;if(sourcePoints.length)sourceScores.push(coverage(sourcePoints));for(const points of regions)if(points.length>=3)regionScores.push(coverage(points));}
  const minimumSourceCoverage=100*(sourceScores.length?Math.min(...sourceScores):1),minimumAxialCoverage=100*(regionScores.length?Math.min(...regionScores):1),meanSourceCoverage=100*(sourceScores.length?sourceScores.reduce((sum,value)=>sum+value,0)/sourceScores.length:1),failedCoverageRegions=regionScores.filter(value=>value<.65).length;return {minimumSourceCoverage,minimumAxialCoverage,meanSourceCoverage,coverageRegionCount:regionScores.length,failedCoverageRegions};
}

function gradeMesh(mesh,referenceMesh=null,sweeps=[],acceleration=null){
  const validation=validateTopology(mesh),penetrations=detectPenetrations(mesh),faces=mesh.objFaces||mesh.faces||[],vertices=mesh.vertices||[],edgeMap=new Map(),adjacency=Array.from({length:vertices.length},()=>new Set()),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  for(const face of faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],edge=key(a,b);if(!edgeMap.has(edge))edgeMap.set(edge,[a,b]);adjacency[a]?.add(b);adjacency[b]?.add(a);}
  const triangleIncidents=new Uint16Array(vertices.length),quadIncidents=new Uint16Array(vertices.length);for(const face of faces)for(const vertex of face){if(face.length===3)triangleIncidents[vertex]++;else if(face.length===4)quadIncidents[vertex]++;}const tipPoleVertices=new Set();for(let vertex=0;vertex<vertices.length;vertex++)if(triangleIncidents[vertex]>=5&&quadIncidents[vertex]===0&&adjacency[vertex].size>6)tipPoleVertices.add(vertex);const edges=[...edgeMap.values()],round=value=>Math.max(0,Math.min(100,Math.round(value))),boundsOfVertices=points=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const point of points)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);}return {lo,hi};},bounds=mesh.bounds||boundsOfVertices(vertices);
  const polygonDenominator=Math.max(1,faces.length);let polygonScore=round(100*(validation.quads+.55*validation.triangles)/polygonDenominator*(1-validation.ngons/polygonDenominator));
  const expectedComponents=Math.max(1,Math.round(Number(mesh.expectedComponents)||1)),componentError=Math.abs(validation.components-expectedComponents);let validityScore=100;if(validation.nonManifoldEdges)validityScore-=70;if(validation.boundaryEdges)validityScore-=45;if(penetrations.trianglePairs)validityScore-=penetrations.trianglePairs<=3?penetrations.trianglePairs*4:Math.min(75,35+penetrations.trianglePairs*2);if(componentError)validityScore-=Math.min(35,componentError*6);if(validation.ngons)validityScore-=Math.min(35,validation.ngons*4);validityScore=round(validityScore);
  let shapeScore=100,shapeMetrics={available:false};
  let referenceCoverage=1,coverageThreshold=0;
  if(referenceMesh?.vertices?.length){
    const referenceBounds=referenceMesh.bounds||boundsOfVertices(referenceMesh.vertices),extent=box=>v3.sub(box.hi,box.lo),a=extent(bounds),b=extent(referenceBounds),diagonal=Math.max(v3.len(b),EPS),boxVolume=values=>Math.max(EPS,values[0]*values[1]*values[2]),volumeRatio=boxVolume(a)/boxVolume(b),boundsRetention=Math.exp(-1.8*Math.abs(Math.log(Math.max(volumeRatio,EPS))));
    const surfaceSamples=(sourceVertices,sourceFaces,limit=900)=>{const points=[...sourceVertices];for(const face of sourceFaces||[])if(face.length>=3)points.push(v3.scale(face.reduce((sum,index)=>v3.add(sum,sourceVertices[index]),[0,0,0]),1/face.length));const stride=Math.max(1,Math.ceil(points.length/limit)),out=[];for(let i=0;i<points.length;i+=stride)out.push(points[i]);return out;},triangulate=sourceFaces=>{const triangles=[];for(const face of sourceFaces||[])for(let index=1;index<face.length-1;index++)triangles.push([face[0],face[index],face[index+1]]);return triangles;},pointTriangleDistance=(point,a,b,c)=>{const ab=v3.sub(b,a),ac=v3.sub(c,a),ap=v3.sub(point,a),d1=v3.dot(ab,ap),d2=v3.dot(ac,ap);if(d1<=0&&d2<=0)return v3.len(ap);const bp=v3.sub(point,b),d3=v3.dot(ab,bp),d4=v3.dot(ac,bp);if(d3>=0&&d4<=d3)return v3.len(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return v3.len(v3.sub(point,v3.add(a,v3.scale(ab,t))));}const cp=v3.sub(point,c),d5=v3.dot(ab,cp),d6=v3.dot(ac,cp);if(d6>=0&&d5<=d6)return v3.len(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return v3.len(v3.sub(point,v3.add(a,v3.scale(ac,t))));}const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));return v3.len(v3.sub(point,v3.add(b,v3.scale(v3.sub(c,b),t))));}const normal=v3.norm(v3.cross(ab,ac));return Math.abs(v3.dot(ap,normal));},meshDistances=(points,targetVertices,targetTriangles)=>{if(acceleration?.distanceQuery){const query=acceleration.distanceQuery(targetVertices,targetTriangles,pointTriangleDistance);return points.map(point=>{const best=query(point);return Number.isFinite(best)?best:0;});}return points.map(point=>{let best=Infinity;for(const triangle of targetTriangles){const distance=pointTriangleDistance(point,targetVertices[triangle[0]],targetVertices[triangle[1]],targetVertices[triangle[2]]);if(Number.isFinite(distance))best=Math.min(best,distance);}return Number.isFinite(best)?best:0;});},referenceFaces=referenceMesh.objFaces||referenceMesh.faces||[],referenceTriangles=triangulate(referenceFaces),candidateTriangles=triangulate(faces),referenceEdges=[];for(const face of referenceFaces)for(let index=0;index<face.length;index++)referenceEdges.push(v3.len(v3.sub(referenceMesh.vertices[face[index]],referenceMesh.vertices[face[(index+1)%face.length]])));const sortedReferenceEdges=referenceEdges.filter(value=>value>EPS).sort((a,b)=>a-b),referenceEdgeMedian=sortedReferenceEdges.length?sortedReferenceEdges[Math.floor(sortedReferenceEdges.length/2)]:0;coverageThreshold=Math.max(diagonal*.006,referenceEdgeMedian*.18);let referenceSample;if(Array.isArray(sweeps)&&sweeps.length){const exposed=[],allSourceSamples=[];for(let source=0;source<sweeps.length;source++){const sourceMesh=sourceSweepMesh(sweeps[source]),samples=surfaceSamples(sourceMesh.vertices,sourceMesh.objFaces,500),burialTolerance=diagonal*.01;allSourceSamples.push(...samples);for(const point of samples)if(!sweeps.some((sweep,index)=>index!==source&&sweepDistance(point,sweep)<-burialTolerance))exposed.push(point);}const selected=exposed.length>=Math.max(20,allSourceSamples.length*.08)?exposed:allSourceSamples,stride=Math.max(1,Math.ceil(selected.length/1100));referenceSample=selected.filter((_,index)=>index%stride===0);}else referenceSample=surfaceSamples(referenceMesh.vertices,referenceFaces);const candidateSample=surfaceSamples(vertices,faces),forwardDistances=meshDistances(referenceSample,vertices,candidateTriangles),backwardDistances=meshDistances(candidateSample,referenceMesh.vertices,referenceTriangles),rms=distances=>Math.sqrt(distances.reduce((sum,distance)=>sum+distance*distance,0)/Math.max(1,distances.length)),forward=rms(forwardDistances),backward=rms(backwardDistances),normalizedChamfer=(forward+backward)/(2*diagonal),surfaceRetention=Math.exp(-9*normalizedChamfer),covered=forwardDistances.filter(distance=>distance<=coverageThreshold).length/Math.max(1,forwardDistances.length),softCoverage=forwardDistances.reduce((sum,distance)=>sum+Math.exp(-Math.pow(distance/Math.max(coverageThreshold,EPS),2)),0)/Math.max(1,forwardDistances.length);
    referenceCoverage=.72*covered+.28*softCoverage;shapeScore=round(100*(.12*boundsRetention+.28*surfaceRetention+.6*referenceCoverage));shapeMetrics={available:true,boundsVolumeRatio:volumeRatio,normalizedChamfer,referenceToResultRms:forward,resultToReferenceRms:backward,referenceCoverage:round(referenceCoverage*100),hardReferenceCoverage:round(covered*100),coverageThreshold};
  }
  if(shapeMetrics.available&&Array.isArray(sweeps)&&sweeps.length){const regionalCoverage=sourceRegionalCoverage(mesh,sweeps,coverageThreshold,acceleration);Object.assign(shapeMetrics,regionalCoverage);shapeScore=round(.7*shapeScore+.2*regionalCoverage.minimumSourceCoverage+.1*regionalCoverage.minimumAxialCoverage);}
  const faceArea=(points,sourceFaces)=>sourceFaces.reduce((sum,face)=>{let area=0;for(let index=1;index<face.length-1;index++)area+=v3.len(v3.cross(v3.sub(points[face[index]],points[face[0]]),v3.sub(points[face[index+1]],points[face[0]])))*.5;return sum+area;},0),referenceFaces=referenceMesh?.objFaces||referenceMesh?.faces||[],candidateArea=faceArea(vertices,faces),referenceArea=referenceMesh?.vertices?.length?faceArea(referenceMesh.vertices,referenceFaces):0,faceDensityRatio=referenceArea>EPS&&candidateArea>EPS?(faces.length/candidateArea)/(Math.max(1,referenceFaces.length)/referenceArea):1;if(shapeMetrics.available)shapeMetrics.faceDensityRatio=faceDensityRatio;
  const edgeLengths=edges.map(([a,b])=>v3.len(v3.sub(vertices[b],vertices[a]))).filter(value=>value>EPS),median=values=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])*.5;},spacingScoreFor=values=>{if(values.length<3)return 100;const center=median(values),deviation=median(values.map(value=>Math.abs(Math.log(Math.max(value,EPS)/Math.max(center,EPS)))));return 100*Math.exp(-2.5*deviation);},diagnostics=artistMeshDiagnostics(mesh,sweeps,adjacency,tipPoleVertices),{_assignments:assignments,_nearJunction:nearJunction,_edgeRecords:diagnosticEdges,...artistMetrics}=diagnostics,alignmentScore=diagnostics.alignmentScore,spacingScore=diagnostics.spacingScore,spiralEdges=diagnostics.spiralEdges,sampledFlowEdges=diagnostics.sampledFlowEdges,tipPoleEdgesExcluded=diagnostics.tipPoleEdgesExcluded;
  const baseFlowScore=round(.34*alignmentScore+.12*spacingScore+.27*diagnostics.longitudinalMonotonicityScore+.18*diagnostics.transverseAxialDriftScore+.09*diagnostics.trackTerminationScore),valences=adjacency.map(neighbors=>neighbors.size),badValence=valences.filter(value=>value<3||value>6).length,controlledPoles=valences.filter(value=>value===3||value===5).length,forkPanels=Math.max(0,Number(mesh.forkPanels)||0),sourceLoopCoverage=forkPanels?clamp((Number(mesh.sourceLoopForks)||0)/forkPanels):1;
  let spikeVertices=0;for(let vertex=0;vertex<adjacency.length;vertex++){const neighbors=[...adjacency[vertex]],lengths=neighbors.map(next=>v3.len(v3.sub(vertices[vertex],vertices[next]))).filter(value=>value>EPS);if(valences[vertex]<=4&&lengths.length>=3){const centroid=v3.scale(neighbors.reduce((sum,next)=>v3.add(sum,vertices[next]),[0,0,0]),1/neighbors.length),mean=lengths.reduce((sum,value)=>sum+value,0)/lengths.length;if(v3.len(v3.sub(vertices[vertex],centroid))/Math.max(mean,EPS)>1.15)spikeVertices++;}}
  const requiresJunction=Array.isArray(sweeps)&&sweeps.length>validation.components;let seamQuality=requiresJunction?.45:1,seamVertices=0,seamSpacingScore=100,seamGraphQuality=100,seamTrackFlowScore=100,seamPoleRatio=0,seamTriangleExcess=0,seamBranchVertices=0,seamComponents=0,seamSet=new Set();
  if(Array.isArray(sweeps)&&sweeps.length>1&&vertices.length){const diagonal=Math.max(EPS,v3.len(v3.sub(bounds.hi,bounds.lo))),nearThreshold=Math.max(diagonal*.0015,median(edgeLengths)*.08);for(let vertex=0;vertex<vertices.length;vertex++){const assignment=assignments[vertex],ownershipBoundary=assignment?.ambiguous&&[...(adjacency[vertex]||[])].some(neighbor=>!assignments[neighbor]?.ambiguous||assignments[neighbor]?.source!==assignment.source);if(ownershipBoundary)seamSet.add(vertex);const distances=sweeps.map(sweep=>Math.abs(sweepDistance(vertices[vertex],sweep))).sort((a,b)=>a-b);if(distances.length>1&&distances[1]<=nearThreshold)seamSet.add(vertex);}seamVertices=seamSet.size;if(seamVertices>=3){const seamEdges=edges.filter(([a,b])=>seamSet.has(a)&&seamSet.has(b)),seamAdjacency=new Map(),seamDegrees=new Uint8Array(vertices.length);for(const vertex of seamSet)seamAdjacency.set(vertex,[]);for(const [a,b] of seamEdges){seamDegrees[a]++;seamDegrees[b]++;seamAdjacency.get(a)?.push(b);seamAdjacency.get(b)?.push(a);}seamSpacingScore=spacingScoreFor(seamEdges.map(([a,b])=>v3.len(v3.sub(vertices[a],vertices[b]))));let badPoles=0;for(const vertex of seamSet){const valence=valences[vertex];if(valence<3||valence>6)badPoles++;seamTriangleExcess+=Math.max(0,triangleIncidents[vertex]-4);}seamPoleRatio=badPoles/seamVertices;const remaining=new Set(seamSet);while(remaining.size){seamComponents++;const start=remaining.values().next().value,stack=[start];let endpoints=0,branches=0,isolated=0;remaining.delete(start);while(stack.length){const vertex=stack.pop(),degree=seamDegrees[vertex];if(degree===0)isolated++;else if(degree===1)endpoints++;else if(degree>2)branches++;for(const next of seamAdjacency.get(vertex)||[])if(remaining.delete(next))stack.push(next);}seamBranchVertices+=branches+isolated+Math.max(0,endpoints-2);}seamGraphQuality=100*clamp(1-seamBranchVertices/Math.max(1,seamVertices));seamTrackFlowScore=round(.6*seamSpacingScore+.4*seamGraphQuality);const triangleQuality=Math.exp(-seamTriangleExcess/Math.max(2,seamVertices*.5));seamQuality=clamp(.3*seamSpacingScore/100+.25*(1-seamPoleRatio)+.3*seamGraphQuality/100+.15*triangleQuality);}}
  // Flow primarily describes the authored outer/source rails. Junction seam
  // quality already owns its own score and artist gate; mixing it heavily into
  // Flow penalizes the same local saddle twice and can make a straight-railed
  // pair-of-pants chart lose to a visibly terraced shell.
  const flowScore=requiresJunction?round(.85*baseFlowScore+.15*seamTrackFlowScore):baseFlowScore;
  const junctionVertices=new Set(seamSet);for(const vertex of seamSet)for(const neighbor of adjacency[vertex]||[])junctionVertices.add(neighbor);let badJunctionValence=0,bodyPoleVertices=0;for(let vertex=0;vertex<valences.length;vertex++){if(junctionVertices.has(vertex)){if(valences[vertex]<3||valences[vertex]>6)badJunctionValence++;}else if(!tipPoleVertices.has(vertex)&&valences[vertex]!==4)bodyPoleVertices++;}const junctionValenceQuality=1-badJunctionValence/Math.max(1,junctionVertices.size),bodyPoleQuality=Math.exp(-bodyPoleVertices/Math.max(3,(sweeps?.length||1)*3)),spikeQuality=1-spikeVertices/Math.max(1,vertices.length),junctionScore=round(100*(.34*seamQuality+.18*junctionValenceQuality+.18*bodyPoleQuality+.12*spikeQuality+.18*diagnostics.contactLocalityScore/100));
  const rawPolygonScore=polygonScore;polygonScore=round(.35*rawPolygonScore+.4*diagnostics.triangleLocalityScore+.25*diagnostics.densityRegularityScore);const scores={shape:shapeScore,flow:flowScore,junctions:junctionScore,polygons:polygonScore,validity:validityScore},weights={shape:.3,flow:.25,junctions:.2,polygons:.15,validity:.1};let total=round(Object.keys(weights).reduce((sum,name)=>sum+scores[name]*weights[name],0));
  const hardCoverage=Number(shapeMetrics.hardReferenceCoverage??100),minimumSourceCoverage=Number(shapeMetrics.minimumSourceCoverage??100),minimumAxialCoverage=Number(shapeMetrics.minimumAxialCoverage??100);if(validation.nonManifoldEdges)total=Math.min(total,39);if(penetrations.trianglePairs>10)total=Math.min(total,29);else if(penetrations.trianglePairs>3)total=Math.min(total,69);if(validation.boundaryEdges)total=Math.min(total,49);if(validation.ngons)total=Math.min(total,59);if(shapeMetrics.available){const shapeTail=Math.min(hardCoverage,minimumSourceCoverage,minimumAxialCoverage);if(shapeTail<30)total=Math.min(total,29);else if(shapeTail<40)total=Math.min(total,49);else if(shapeTail<45)total=Math.min(total,69);else if(shapeTail<50)total=Math.min(total,84);}if(requiresJunction&&diagnostics.gapBridgeFaces)total=Math.min(total,69);
  const grade=total>=90?'A':total>=80?'B':total>=70?'C':total>=60?'D':total>=50?'E':'F',issues=[],spiralWarningThreshold=Math.max(8,Math.round(sampledFlowEdges*.08)),allowedTrackTerminations=Math.max(1,Math.round((diagnostics.longitudinalTrackCount+diagnostics.transverseTrackCount)*.04)),topologyArtistReady=!validation.nonManifoldEdges&&!validation.boundaryEdges&&!validation.ngons&&!componentError&&!penetrations.trianglePairs,shapeArtistReady=!shapeMetrics.available||(shapeScore>=74&&hardCoverage>=75&&minimumSourceCoverage>=60&&minimumAxialCoverage>=45),flowArtistReady=flowScore>=70&&diagnostics.longitudinalMonotonicityScore>=68&&diagnostics.transverseAxialDriftScore>=60&&diagnostics.illegalTrackTerminations<=allowedTrackTerminations&&diagnostics.transitionStretchScore>=60&&diagnostics.railKinkScore>=60,junctionArtistReady=!requiresJunction||(seamQuality>=.65&&diagnostics.contactLocalityScore>=85&&!diagnostics.gapBridgeFaces),densityArtistReady=diagnostics.densityRegularityScore>=55&&faceDensityRatio<=1.75,triangleArtistReady=diagnostics.triangleLocalityScore>=72,artistQualityTarget=topologyArtistReady&&shapeArtistReady&&flowArtistReady&&junctionArtistReady&&densityArtistReady&&triangleArtistReady,artistTopologyTarget=artistQualityTarget;
  if(validation.nonManifoldEdges)issues.push(`${validation.nonManifoldEdges} non-manifold edge${validation.nonManifoldEdges===1?'':'s'}`);if(penetrations.trianglePairs)issues.push(`${penetrations.trianglePairs} penetrating triangle pair${penetrations.trianglePairs===1?'':'s'}${penetrations.truncated?' (partial scan)':''}`);if(validation.boundaryEdges)issues.push(`${validation.boundaryEdges} open boundary edge${validation.boundaryEdges===1?'':'s'}`);if(validation.ngons)issues.push(`${validation.ngons} ngon${validation.ngons===1?'':'s'}`);if(componentError)issues.push(`${validation.components}/${expectedComponents} connected components`);if(shapeMetrics.available&&hardCoverage<75)issues.push(`Only ${hardCoverage}% of the source sweep surface is represented`);if(shapeMetrics.available&&(minimumSourceCoverage<60||minimumAxialCoverage<45))issues.push(`Local silhouette coverage falls to ${round(minimumSourceCoverage)}% on a strand and ${round(minimumAxialCoverage)}% in an axial region`);if(requiresJunction&&seamQuality<.65)issues.push(`Messy junction seam (${round(seamQuality*100)}% regularity, ${seamBranchVertices} irregular seam vertices)`);if(diagnostics.gapBridgeFaces)issues.push(`${diagnostics.gapBridgeFaces} shared face${diagnostics.gapBridgeFaces===1?'':'s'} bridge source strands outside measured contact runs`);if(diagnostics.illegalTrackTerminations>allowedTrackTerminations)issues.push(`${diagnostics.illegalTrackTerminations} flow track termination${diagnostics.illegalTrackTerminations===1?'':'s'} away from a tip or junction`);if(diagnostics.longitudinalMonotonicityScore<68||diagnostics.transverseAxialDriftScore<60)issues.push(`Loop continuity is weak (${round(diagnostics.longitudinalMonotonicityScore)}% rail monotonicity, ${round(diagnostics.transverseAxialDriftScore)}% cross-loop stability)`);if(diagnostics.densityRegularityScore<55||faceDensityRatio>1.75)issues.push(`Uneven or excessive polygon density (${round(diagnostics.densityRegularityScore)}% regularity, ${faceDensityRatio.toFixed(2)}x source density)`);if(diagnostics.unnecessaryTriangleCount)issues.push(`${diagnostics.unnecessaryTriangleCount} unnecessary body triangle${diagnostics.unnecessaryTriangleCount===1?'':'s'}`);if(spiralEdges>spiralWarningThreshold)issues.push(`${spiralEdges} sampled diagonal/spiral-flow edges`);if(spikeVertices)issues.push(`${spikeVertices} possible spike vertices`);
  if(diagnostics.transitionStretchScore<60)issues.push(`Abrupt local row stretching (${round(diagnostics.transitionStretchScore)}% transition quality, ${diagnostics.transitionStretchP95.toFixed(2)}x P95 and ${diagnostics.transitionStretchMax.toFixed(2)}x worst local stretch)`);
  if(diagnostics.railKinkScore<60)issues.push(`Abrupt rail bends (${round(diagnostics.railKinkScore)}% smoothness, ${round(diagnostics.railKinkP95Degrees)}° P95 and ${round(diagnostics.railKinkMaxDegrees)}° worst turn)`);
  return {schema:'ahs-topology-grade-v4',total,grade,scores,weights,validation,artistQualityTarget,artistTopologyTarget,metrics:{...shapeMetrics,...artistMetrics,faceDensityRatio,rawPolygonScore,alignmentScore:round(alignmentScore),spacingScore:round(spacingScore),baseFlowScore,seamTrackFlowScore,allowedTrackTerminations,spiralEdges,spiralWarningThreshold,sampledFlowEdges,tipPoleEdgesExcluded,controlledPoles,sourceLoopCoverage:round(sourceLoopCoverage*100),seamQuality:round(seamQuality*100),seamVertices,seamComponents,seamSpacingScore:round(seamSpacingScore),seamGraphQuality:round(seamGraphQuality),seamPoleRatio:round(seamPoleRatio*100),seamTriangleExcess,seamBranchVertices,badValenceVertices:badValence,badJunctionValence,bodyPoleVertices,spikeVertices,penetratingTrianglePairs:penetrations.trianglePairs,penetrationCandidatesTested:penetrations.candidatesTested,penetrationScanTruncated:penetrations.truncated},artistGates:{topology:topologyArtistReady,shape:shapeArtistReady,flow:flowArtistReady,junction:junctionArtistReady,density:densityArtistReady,triangles:triangleArtistReady},issues};
}

function curveUnionV2OwnedSection(polygons,ordered,segments){
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const inside=(p,poly)=>{let sign=0;for(let i=0;i<poly.length;i++){const d=cross(sub(poly[(i+1)%poly.length],poly[i]),sub(p,poly[i]));if(Math.abs(d)<1e-10)continue;if(sign&&Math.sign(d)!==sign)return false;sign=Math.sign(d);}return true;};
  const edges=[];
  for(const poly of polygons)for(let i=0;i<poly.points.length;i++){
    const a=poly.points[i],b=poly.points[(i+1)%poly.points.length],d=sub(b,a),cuts=[0,1];
    for(const other of polygons)if(other!==poly)for(let j=0;j<other.points.length;j++){
      const c=other.points[j],e=sub(other.points[(j+1)%other.points.length],c),den=cross(d,e);if(Math.abs(den)<1e-12)continue;
      const t=cross(sub(c,a),e)/den,u=cross(sub(c,a),d)/den;if(t>1e-7&&t<1-1e-7&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((a,b)=>a-b);
    for(let j=1;j<cuts.length;j++){
      const lo=cuts[j-1],hi=cuts[j],mid=a.map((v,k)=>v+d[k]*(lo+hi)*.5);
      if(hi-lo<1e-7||polygons.some(other=>other!==poly&&inside(mid,other.points)))continue;
      const at=t=>({p:a.map((v,k)=>v+d[k]*t),world:v3.mix(poly.world[i],poly.world[(i+1)%poly.points.length],t)});
      edges.push({a:at(lo),b:at(hi),owner:poly.owner});
    }
  }
  const nodes=[],node=p=>{let i=nodes.findIndex(n=>Math.hypot(...sub(n.p,p.p))<1e-7);if(i<0){i=nodes.length;nodes.push({...p,links:[]});}else nodes[i].world=v3.mix(nodes[i].world,p.world,.5);return i;};
  for(const e of edges){e.i=node(e.a);e.j=node(e.b);nodes[e.i].links.push(e);nodes[e.j].links.push(e);}
  if(!nodes.length||nodes.some(n=>n.links.length!==2))return null;
  const left=nodes.reduce((b,n,i)=>n.p[0]<nodes[b].p[0]?i:b,0),right=nodes.reduce((b,n,i)=>n.p[0]>nodes[b].p[0]?i:b,0);
  const paths=nodes[left].links.map(first=>{const result=[];let at=left,edge=first;for(let guard=0;guard<=edges.length;guard++){const next=edge.i===at?edge.j:edge.i;result.push({a:at,b:next,owner:edge.owner});if(next===right)return result;const nextEdge=nodes[next].links.find(e=>e!==edge);at=next;edge=nextEdge;}return null;});
  if(paths.some(p=>!p))return null;
  const height=path=>path.reduce((sum,e)=>sum+nodes[e.a].p[1]+nodes[e.b].p[1],0)/path.length;
  if(height(paths[0])<height(paths[1]))paths.reverse();
  const sample=path=>{
    const runs=[];for(const edge of path){if(runs.at(-1)?.owner!==edge.owner)runs.push({owner:edge.owner,ids:[edge.a]});runs.at(-1).ids.push(edge.b);}
    if(runs.length!==ordered.length||runs.some((r,i)=>r.owner!==ordered[i]))return null;
    const result=[];
    for(const run of runs){const p=run.ids.map(i=>nodes[i].world),lengths=[0];for(let i=1;i<p.length;i++)lengths.push(lengths.at(-1)+v3.len(v3.sub(p[i],p[i-1])));const total=lengths.at(-1);
      for(let i=result.length?1:0;i<=segments;i++){const s=total*i/segments;let e=1;while(e<p.length-1&&lengths[e]<s)e++;result.push(v3.mix(p[e-1],p[e],(s-lengths[e-1])/Math.max(1e-12,lengths[e]-lengths[e-1])));}
    }return result;
  };
  const front=sample(paths[0]),back=sample(paths[1]);return front&&back?{front,back}:null;
}

function curveUnionV2FitJunctionRails(nodes,vertices,strength=1){
  const original=vertices.map(p=>[...p]),pinned=new Set(),active=new Set(),rows=[];
  for(const node of nodes){
    for(const side of ['front','back']){
      const grid=node[side];
      for(const row of grid){pinned.add(row[0]);pinned.add(row.at(-1));}
      if(node.start===0)for(const i of grid[0])pinned.add(i);
      if(!node.children.length)for(const row of grid.slice(-2))for(const i of row)pinned.add(i);
      for(let r=1;r<grid.length-1;r++)for(let c=1;c<grid[r].length-1;c++)rows.push({ids:[grid[r][c],grid[r-1][c],grid[r+1][c]],weights:[1,-.5,-.5],weight:3});
      for(const row of grid)for(let c=1;c<row.length-1;c++)rows.push({ids:[row[c],row[c-1],row[c+1]],weights:[1,-.5,-.5],weight:1});
    }
    if(!node.children.length)continue;
    let offset=0;
    for(const child of node.children){
      const width=child.front[0].length;
      for(const side of ['front','back'])for(let c=1;c<width-1;c++){
        const track=[...node[side].slice(-4).map(row=>row[offset+c]),...child[side].slice(1,5).map(row=>row[c])];
        for(let k=1;k<track.length-1;k++){
          active.add(track[k]);
          const a=v3.len(v3.sub(original[track[k]],original[track[k-1]])),b=v3.len(v3.sub(original[track[k+1]],original[track[k]]));
          rows.push({ids:[track[k],track[k-1],track[k+1]],weights:[1,-b/Math.max(EPS,a+b),-a/Math.max(EPS,a+b)],weight:5});
        }
      }
      offset+=width-1;
    }
    // Interior source interfaces may move upstream, but child chart boundary
    // rows stay pinned to prevent rounding or closing the measured opening.
    for(const side of ['front','back'])for(const row of node[side].slice(-4,-1))for(let c=1;c<row.length-1;c++)active.add(row[c]);
  }
  const ids=[...active].filter(i=>!pinned.has(i)),map=new Map(ids.map((id,i)=>[id,i]));
  if(!ids.length)return {vertices:0};
  const terms=rows.map(row=>({...row,variables:row.ids.map((id,k)=>[map.get(id),row.weights[k]]).filter(([i])=>i!==undefined)})).filter(row=>row.variables.length);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),multiply=x=>{const y=x.map(v=>v*.65);for(const row of terms){const d=row.variables.reduce((s,[i,w])=>s+x[i]*w,0);for(const [i,w]of row.variables)y[i]+=row.weight*w*d;}return y;},solutions=[];
  for(let axis=0;axis<3;axis++){
    const rhs=ids.map(()=>0);for(const row of terms){const d=row.ids.reduce((s,id,k)=>s+original[id][axis]*row.weights[k],0);for(const [i,w]of row.variables)rhs[i]-=row.weight*w*d;}
    const x=ids.map(()=>0);let residual=[...rhs],direction=[...rhs],norm=dot(residual,residual);
    for(let iteration=0;iteration<80&&norm>1e-18;iteration++){const ad=multiply(direction),den=dot(direction,ad);if(den<1e-24)break;const alpha=norm/den;for(let i=0;i<x.length;i++){x[i]+=alpha*direction[i];residual[i]-=alpha*ad[i];}const next=dot(residual,residual),beta=next/norm;direction=residual.map((v,i)=>v+beta*direction[i]);norm=next;}
    solutions.push(x);
  }
  const low=[0,1,2].map(k=>Math.min(...original.map(p=>p[k]))),high=[0,1,2].map(k=>Math.max(...original.map(p=>p[k]))),limit=v3.len(v3.sub(high,low))*.04;
  let maxDisplacement=0;
  for(let j=0;j<ids.length;j++){const id=ids[j];let delta=solutions.map(a=>a[j]*strength),length=v3.len(delta);if(length>limit)delta=v3.scale(delta,limit/length);vertices[id]=v3.add(original[id],delta);maxDisplacement=Math.max(maxDisplacement,v3.len(delta));}
  return {vertices:ids.length,maxDisplacement};
}

function curveUnionV2FitRowPhase(nodes,vertices,strength=.25){
  const original=vertices.map(p=>[...p]),pinned=new Set(),directions=new Map(),limits=new Map(),constraints=[];
  for(const node of nodes)for(const side of ['front','back']){
    const grid=node[side];
    for(const row of grid){pinned.add(row[0]);pinned.add(row.at(-1));}
    if(node.start===0)for(const i of grid[0])pinned.add(i);
    if(!node.children.length)for(const row of grid.slice(-2))for(const i of row)pinned.add(i);
    for(let r=1;r<grid.length-1;r++)for(let c=1;c<grid[r].length-1;c++){
      const id=grid[r][c],prev=grid[r-1][c],next=grid[r+1][c];
      const direction=v3.norm(v3.sub(original[next],original[prev]));
      directions.set(id,direction);
      limits.set(id,.2*Math.min(v3.len(v3.sub(original[id],original[prev])),v3.len(v3.sub(original[next],original[id]))));
      constraints.push({ids:[id,grid[r][c-1],grid[r][c+1]],weights:[1,-.5,-.5],direction});
    }
  }
  const ids=[...directions.keys()].filter(i=>!pinned.has(i)),index=new Map(ids.map((id,i)=>[id,i]));
  if(!ids.length)return {vertices:0,maxDisplacement:0};
  const terms=constraints.map(row=>({...row,variables:row.ids.map((id,k)=>[index.get(id),row.weights[k]*v3.dot(directions.get(id)||row.direction,row.direction)]).filter(([i])=>i!==undefined)})).filter(t=>t.variables.length);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const multiply=x=>{const y=x.map(v=>v*.15);for(const t of terms){const d=t.variables.reduce((s,[i,w])=>s+w*x[i],0);for(const [i,w]of t.variables)y[i]+=w*d;}return y;};
  // Differences, rather than absolute world coordinates, keep the solve
  // translation invariant even when a model is far from the origin.
  const residual=(t,points)=>t.weights.reduce((sum,w,k)=>sum+w*v3.dot(v3.sub(points[t.ids[k]],points[t.ids[0]]),t.direction),0);
  const rhs=ids.map(()=>0);for(const t of terms){const d=residual(t,original);for(const [i,w]of t.variables)rhs[i]-=w*d;}
  const x=ids.map(()=>0);let r=[...rhs],p=[...rhs],norm=dot(r,r);
  const tolerance=norm*1e-12;
  for(let k=0;k<80&&norm>tolerance;k++){
    const ap=multiply(p),den=dot(p,ap);if(!(den>0))break;
    const alpha=norm/den;for(let i=0;i<x.length;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];}
    const next=dot(r,r);p=r.map((v,i)=>v+next/norm*p[i]);norm=next;
  }
  let maxDisplacement=0;
  for(let j=0;j<ids.length;j++){
    const id=ids[j],displacement=clamp(x[j]*clamp(strength),-limits.get(id),limits.get(id));
    vertices[id]=v3.add(original[id],v3.scale(directions.get(id),displacement));
    maxDisplacement=Math.max(maxDisplacement,Math.abs(displacement));
  }
  const rms=points=>Math.sqrt(terms.reduce((sum,t)=>sum+residual(t,points)**2,0)/Math.max(1,terms.length));
  return {vertices:ids.length,maxDisplacement,strength,beforeRms:rms(original),afterRms:rms(vertices)};
}

function curveUnionV2Atlas(sourceSweeps,axialLoops=16,flowSmooth=.55,options={}){
  options={branchGrouping:'balanced',...options,semanticWeldOnly:true,allowBoundaryRepair:false,qualityBinaryEvents:true,crotchWeldRows:0,preserveTailFrames:true};
  const axial=Math.max(10,Math.min(80,Math.round(axialLoops))),radial=Math.max(8,Math.min(24,Math.max(...sourceSweeps.map(s=>s.profile.length)))),columns=Math.max(3,Math.min(16,Math.round(radial/2)+1)),strandCount=sourceSweeps.length;
  const strands=sourceSweeps.map(s=>({samples:Array.from({length:axial},(_,i)=>sweepFrameAt(s,i/(axial-1))),profile:resampleClosedProfile(s.profile,radial)}));
  let seed=[1,0,0],seedLength=-1;for(let a=0;a<strandCount;a++)for(let b=a+1;b<strandCount;b++)for(let r=0;r<axial;r++){const d=v3.sub(strands[b].samples[r].c,strands[a].samples[r].c),length=v3.dot(d,d);if(length>seedLength){seed=d;seedLength=length;}}
  const frames=[];let previousU,previousV;for(let r=0;r<axial;r++){let tangent=[0,0,0],preferred=[0,0,0];for(const strand of strands){tangent=v3.add(tangent,strand.samples[r].t);preferred=v3.add(preferred,strand.samples[r].z);}tangent=v3.norm(tangent);const project=axis=>v3.sub(axis,v3.scale(tangent,v3.dot(axis,tangent)));let u=project(seed);if(v3.len(u)<1e-5)u=project(strands[0].samples[r].x);u=v3.norm(u);if(previousU&&v3.dot(u,previousU)<0)u=v3.scale(u,-1);let v=v3.norm(v3.cross(tangent,u));if((previousV&&v3.dot(v,previousV)<0)||(!previousV&&v3.dot(v,preferred)<0))v=v3.scale(v,-1);frames.push({u,v});previousU=u;previousV=v;}
  const sections=Array.from({length:axial},(_,r)=>strands.map(s=>projectedSection(s.samples[r],s.profile,frames[r].u,frames[r].v))),contactPaddingRatio=Math.max(0,Math.min(.75,Number(options.contactPaddingRatio)||0)),sectionsTouch=(first,second)=>{if(convexProfilesOverlap(first.points,second.points))return true;const gap=Math.max(0,Math.max(first.min,second.min)-Math.min(first.max,second.max)),scale=((first.max-first.min)+(second.max-second.min))*.5;return contactPaddingRatio>0&&profilePolygonDistance(first.points,second.points)<=scale*contactPaddingRatio;};
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
    if(options.sourceOwnedJunctions){
      const ordered=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),frame=geometry.frames[row];
      const polygons=ordered.map(owner=>{const s=strands[owner],sample=s.samples[row],world=s.profile.map(p=>sweepPoint(sample,p));return {owner,world,points:world.map(p=>[v3.dot(p,frame.u),v3.dot(p,frame.v)])};});
      const section=curveUnionV2OwnedSection(polygons,ordered,columns-1);
      if(section)return section[front?'front':'back'].map(p=>pointIndex(p,front?'front':'back'));
    }
    const nodeFrames=geometry.frames,nodeSections=geometry.sections,ordered=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),frame=nodeFrames[row],active=ordered.map(member=>nodeSections[row][member]),left=Math.min(...active.map(section=>section.min)),right=Math.max(...active.map(section=>section.max)),forkGroups=ordered.map(member=>[member]),groupInterval=group=>({min:Math.min(...group.map(member=>nodeSections[row][member].min)),max:Math.max(...group.map(member=>nodeSections[row][member].max))}),intervals=forkGroups.map(groupInterval),boundaries=[left];
    for(let group=0;group<intervals.length-1;group++)boundaries.push(clamp((intervals[group].max+intervals[group+1].min)*.5,boundaries[boundaries.length-1]+EPS,right-EPS));
    boundaries.push(right);
    const targets=[];for(let group=0;group<forkGroups.length;group++){const count=widthFor(forkGroups[group]);for(let column=group?1:0;column<count;column++)targets.push(boundaries[group]+(boundaries[group+1]-boundaries[group])*column/Math.max(1,count-1));}
    const groupCenter=group=>v3.scale(group.reduce((sum,member)=>v3.add(sum,strands[member].samples[row].c),[0,0,0]),1/Math.max(1,group.length)),first=groupCenter(forkGroups[0]),last=groupCenter(forkGroups[forkGroups.length-1]),result=[];
    for(let column=0;column<widthFor(members);column++){
      const target=targets[column],mix=clamp((target-left)/Math.max(right-left,EPS)),candidates=[];
      for(const member of ordered){const section=nodeSections[row][member];if(target>=section.min-1e-7&&target<=section.max+1e-7){const envelope=profileEnvelope(section.points,target);candidates.push({member,height:front?envelope.front:envelope.back});}}
      // A permitted air gap needs a surface bridge, not coincident front/back
      // vertices at the profile centre. Sample just inside the facing surfaces
      // to retain thickness; the extent is bounded by the contact tolerance.
      if(!candidates.length&&contactPaddingRatio>0){
        const before=ordered.filter(member=>nodeSections[row][member].max<target).sort((a,b)=>nodeSections[row][b].max-nodeSections[row][a].max)[0];
        const after=ordered.filter(member=>nodeSections[row][member].min>target).sort((a,b)=>nodeSections[row][a].min-nodeSections[row][b].min)[0];
        if(before!==undefined&&after!==undefined){
          const a=nodeSections[row][before],b=nodeSections[row][after],gap=b.min-a.max,scale=((a.max-a.min)+(b.max-b.min))*.5;
          if(gap<=scale*contactPaddingRatio&&sectionsTouch(a,b)){
            const inset=Math.min(scale*.1,Math.max(gap,scale*.02)),ea=profileEnvelope(a.points,Math.max(a.min,a.max-inset)),eb=profileEnvelope(b.points,Math.min(b.max,b.min+inset)),blend=clamp((target-a.max)/Math.max(gap,EPS));
            candidates.push({member:blend<.5?before:after,height:(front?ea.front:ea.back)*(1-blend)+(front?eb.front:eb.back)*blend});
          }
        }
      }
      const winner=candidates.length?candidates.reduce((best,candidate)=>front?(candidate.height>best.height?candidate:best):(candidate.height<best.height?candidate:best)):null,isSilhouette=column===0||column===widthFor(members)-1,sourceBase=winner?strands[winner.member].samples[row].c:v3.mix(first,last,mix),base=options.branchLedJunctions&&!isSilhouette?v3.mix(first,last,mix):sourceBase,height=winner?winner.height:v3.dot(base,frame.v);
      result.push(pointIndex(v3.add(base,v3.add(v3.scale(frame.u,target-v3.dot(base,frame.u)),v3.scale(frame.v,height-v3.dot(base,frame.v)))),front?'front':'back'));
    }
    return result;
  };
  // Freeze each rail's position on the authored profile at the start of a
  // branch. Re-evaluating the projected envelope in a rotating frame on every
  // row changes which profile edge a column belongs to and creates spiral rails.
  const tailRailCache=new Map(),tailSeedRows=new Map();
  const tailAnchoredRow=(row,front,member,start,geometry=nodeGeometry([member]))=>{
    const key=member+':'+start;let rails=tailRailCache.get(key);
    if(!rails){
      const sample=strands[member].samples[start],profile=resampleClosedProfile(strands[member].profile,2*(columns-1));
      const world=p=>sweepPoint(sample,p);
      const seed=tailSeedRows.get(key),frame=geometry.frames[start];let bestCost=Infinity;
      for(const direction of [1,-1])for(let shift=0;shift<profile.length;shift++){
        const ring=profile.map((_,i)=>profile[(shift+direction*i+profile.length*2)%profile.length]),f=ring.slice(0,columns),b=[ring[0],...ring.slice(columns).reverse(),ring[columns-1]];
        let cost=0;
        for(const [side,points] of [['front',f],['back',b]])for(let i=0;i<columns;i++){
          const p=world(points[i]);
          if(seed){
            const origin=vertices[seed[side][i]],delta=v3.sub(p,origin);
            cost+=v3.dot(delta,delta);
            const next=strands[member].samples[Math.min(axial-1,start+1)],shape=points[i];
            const nextPoint=sweepPoint(next,shape);
            const outgoing=v3.sub(nextPoint,origin),length=v3.len(outgoing);
            const previous=seed[side+'Previous']?.[i];
            const incoming=previous===undefined?sample.t:v3.norm(v3.sub(origin,vertices[previous]));
            const desired=v3.norm(v3.add(incoming,sample.t));
            const along=v3.dot(outgoing,desired),sideways=v3.sub(outgoing,v3.scale(desired,along));
            // A nearby vertex on the wrong profile phase is not a good match.
            // Penalize lateral jumps, reversal, and changes in strip direction.
            cost+=4*v3.dot(sideways,sideways)+8*Math.min(0,along)**2;
            if(i){const prior=world(points[i-1]),oldEdge=v3.sub(origin,vertices[seed[side][i-1]]),newEdge=v3.sub(p,prior);
              cost+=Math.min(v3.dot(oldEdge,oldEdge),v3.dot(newEdge,newEdge))*(1-v3.dot(v3.norm(oldEdge),v3.norm(newEdge)))*2;
            }
          }
          else {const x=v3.dot(p,frame.u),z=v3.dot(p,frame.v);cost+=(i-(columns-1)*.5)*-x+(side==='front'?-z:z);}
        }
        if(cost<bestCost){bestCost=cost;rails={front:f,back:b};}
      }
      if(seed&&options.branchTransition!==false){
        // Fit inherited spacing onto the chosen profile, then release it over
        // several rows. Work in ordered profile coordinates, not world-space
        // smoothing, so rails stay on the authored surface and cannot cross.
        const ring=[...rails.front,...rails.back.slice(1,-1).reverse()],n=ring.length;
        const seedRing=[...seed.front,...seed.back.slice(1,-1).reverse()];
        const parameters=seedRing.map((index,i)=>{
          const point=vertices[index];let best=Infinity,q=i;
          for(let edge=0;edge<n;edge++){
            const a=world(ring[edge]),b=world(ring[(edge+1)%n]),d=v3.sub(b,a),t=clamp(v3.dot(v3.sub(point,a),d)/Math.max(EPS,v3.dot(d,d)));
            const error=v3.len(v3.sub(point,v3.mix(a,b,t)));
            if(error<best){best=error;q=edge+t;}
          }
          q+=Math.round((i-q)/n)*n;return clamp(q,i-.8,i+.8);
        });
        parameters[0]=0;parameters[columns-1]=columns-1;
        for(let i=1;i<n;i++)parameters[i]=Math.max(parameters[i],parameters[i-1]+.2);
        for(let i=n-1;i>=0;i--)parameters[i]=Math.min(parameters[i],(i===n-1?n:parameters[i+1])-.2);
        rails.transition={ring,parameters};
      }
      tailRailCache.set(key,rails);
    }
    const sample=strands[member].samples[row];
    let points=rails[front?'front':'back'];
    if(rails.transition){
      const {ring,parameters}=rails.transition,n=ring.length,t=clamp((row-start)/Math.min(4,Math.max(1,axial-1-start))),release=t*t*(3-2*t);
      const at=i=>{const q=parameters[i]*(1-release)+i*release,wrapped=(q%n+n)%n,edge=Math.floor(wrapped);return ring[edge].map((v,axis)=>v+(ring[(edge+1)%n][axis]-v)*(wrapped-edge));};
      points=front?Array.from({length:columns},(_,i)=>at(i)):[at(0),...Array.from({length:columns-2},(_,i)=>at(n-1-i)),at(columns-1)];
    }
    return points.map(p=>pointIndex(sweepPoint(sample,p),front?'front':'back'));
  };
  let prunedRows=0;
  const contactPlans=new Map();
  const contactSplitPlan=(members,start)=>{
    const sorted=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),key=sorted.join(',')+':'+start;
    if(contactPlans.has(key))return contactPlans.get(key);
    let best=null;
    for(let cut=1;cut<sorted.length;cut++){
      const left=sorted.slice(0,cut),right=sorted.slice(cut),touches=row=>{const pair=localPairSection([left.at(-1),right[0]],row).sections;return sectionsTouch(pair[0],pair[1]);};
      let seen=false;
      for(let row=start;row<axial;row++){
        const contact=touches(row);if(contact){seen=true;continue;}
        // A later re-contact must not authorize a bridge over an earlier open
        // interval. Separate at the first sustained loss of local contact.
        if(seen&&(row===axial-1||!touches(row+1))){
          const plan={groups:[left,right],end:row-1};
          if(!best||plan.end<best.end||(plan.end===best.end&&Math.abs(left.length-right.length)<Math.abs(best.groups[0].length-best.groups[1].length)))best=plan;
          break;
        }
      }
    }
    contactPlans.set(key,best);return best;
  };
  const nodes=[],terminalSplit=(members,start)=>{
    if(options.localContactBoundaries!==false){const plan=contactSplitPlan(members,start);if(plan)return plan.groups;}
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
  const buildNode=(members,start,initialFront,initialBack,frontPrevious,backPrevious)=>{
    if(members.length===1&&initialFront&&initialBack)tailSeedRows.set(members[0]+':'+start,{front:initialFront,back:initialBack,frontPrevious,backPrevious});
    const geometry=nodeGeometry(members),nodeSections=geometry.sections,minimum=start+Math.max(2,Math.min(5,Math.round(Number(options.minimumJunctionRows)||2))),junctionLead=Math.max(2,Math.round(axial*clamp(Number(options.junctionLeadFactor)||.14,.06,.3))),junctionBias=Math.round(Number(options.junctionRowBias)||0);let split=-1,childGroups=[],crotch=-1;
    const nodeOverlapRuns=[];let effectiveTipSeparation=requestedTipSeparation,detachedTipContact=false;if(members.length>1){childGroups=terminalSplit(members,start);const groupsTouch=(first,second,row)=>first.some(left=>second.some(right=>sectionsTouch(nodeSections[row][left],nodeSections[row][right]))),connected=row=>{if(members.length===2)return sectionsTouch(nodeSections[row][members[0]],nodeSections[row][members[1]]);for(let group=0;group<childGroups.length-1;group++)if(!groupsTouch(childGroups[group],childGroups[group+1],row))return false;return true;};let runStart=-1,lastConnected=start;for(let row=start;row<axial;row++){if(connected(row)){lastConnected=row;if(runStart<0)runStart=row;}else if(runStart>=0){nodeOverlapRuns.push({start:runStart,end:row-1});runStart=-1;}}if(runStart>=0)nodeOverlapRuns.push({start:runStart,end:axial-1});const contactSelection=contactRunSelection(nodeOverlapRuns,start,Math.max(.001,requestedTipSeparation)),mainRun=contactSelection.primary,mainEnd=mainRun?mainRun.end:lastConnected;effectiveTipSeparation=contactSelection.effective;detachedTipContact=contactSelection.hasDetachedTipContact;const appliedLead=Math.round(junctionLead*effectiveTipSeparation),multiwayMinimum=childGroups.length>2?Math.max(minimum,start+Math.round((axial-start)*.5*(1-effectiveTipSeparation))):minimum;crotch=Math.round(lastConnected+(mainEnd-lastConnected)*effectiveTipSeparation);const desired=Math.max(detachedTipContact?mainEnd+1:-Infinity,crotch+1-appliedLead+junctionBias);if(options.qualityBinaryEvents){const childDepth=Math.max(0,...childGroups.map(group=>remainingBinaryDepth(group,start))),latestSplit=axial-1-childDepth;split=multiwayMinimum<=latestSplit?Math.min(latestSplit,Math.max(multiwayMinimum,desired)):-1;}else split=Math.max(multiwayMinimum,Math.min(axial-2,desired));}
    if(options.localContactBoundaries!==false&&members.length>1){
      const plan=contactSplitPlan(members,start);
      if(plan){childGroups=plan.groups;split=Math.min(split<0?axial:split,Math.max(start+1,plan.end+1));}
    }
    if(options.sourceOwnedJunctions&&members.length>1&&split>start+2){
      const ordered=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b));
      const valid=row=>{const frame=geometry.frames[row],polygons=ordered.map(owner=>{const s=strands[owner],sample=s.samples[row],world=s.profile.map(p=>sweepPoint(sample,p));return {owner,world,points:world.map(p=>[v3.dot(p,frame.u),v3.dot(p,frame.v)])};});return curveUnionV2OwnedSection(polygons,ordered,columns-1);};
      while(split>start+2&&!valid(split-1))split--;
    }
    const rowFor=(row,front)=>members.length===1?tailAnchoredRow(row,front,members[0],start,geometry):forkEnvelopeRow(row,front,members,childGroups,geometry),end=split<0?axial-1:split-1,front=[initialFront||rowFor(start,true)],back=[initialBack||rowFor(start,false)],stride=Math.max(1,Math.min(3,Math.round(Number(options.loopPruneStride)||1)));for(let row=start+1;row<=end;row++){const protectedRow=row===start+1||row>=end-1,keep=stride===1||protectedRow||(row-start)%stride===0;if(!keep){prunedRows++;continue;}front.push(rowFor(row,true));back.push(rowFor(row,false));}
    const sorted=[...members].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),node={members:sorted,start,end,crotch,overlapRuns:nodeOverlapRuns,effectiveTipSeparation,detachedTipContact,front,back,children:[],geometry,outerLeft:sorted[0]===order[0],outerRight:sorted[sorted.length-1]===order[order.length-1]};nodes.push(node);
    if(split>=0){let offset=0;for(const group of childGroups){const sortedGroup=[...group].sort((a,b)=>orderPosition.get(a)-orderPosition.get(b)),width=widthFor(sortedGroup),childFront=front[front.length-1].slice(offset,offset+width),childBack=back[back.length-1].slice(offset,offset+width);node.children.push(buildNode(sortedGroup,end,childFront,childBack,front[Math.max(0,front.length-2)].slice(offset,offset+width),back[Math.max(0,back.length-2)].slice(offset,offset+width)));offset+=width-1;}}
    return node;
  };
  const root=buildNode(order,0);
  if(options.sourceOwnedJunctions&&options.ownedJunctionFlow){
    // Fair continuous source-owned rails on both sides of each split. The
    // shared opening edges and outer rails remain fixed; no cross-side welds.
    const stencils=new Map();
    for(const node of nodes)if(node.children.length){
      let offset=0;
      for(const child of node.children){
        const width=widthFor(child.members);
        for(const side of ['front','back'])for(let c=1;c<width-1;c++){
          if(c%(columns-1)===0)continue;
          const track=[...node[side].slice(-4).map(row=>row[offset+c]),...child[side].slice(1,4).map(row=>row[c])];
          for(let k=1;k<track.length-1;k++)stencils.set(track[k],{before:track[k-1],after:track[k+1]});
        }
        offset+=width-1;
      }
    }
    const anchors=vertices.map(p=>[...p]);
    for(let pass=0;pass<8;pass++){
      const previous=vertices.map(p=>[...p]);
      for(const [index,{before,after}] of stencils){
        const midpoint=v3.mix(previous[before],previous[after],.5),target=v3.mix(midpoint,anchors[index],.2);
        vertices[index]=v3.mix(previous[index],target,.5);
      }
    }
    const strength=typeof options.ownedJunctionFlow==='number'?clamp(options.ownedJunctionFlow):1;
    for(const index of stencils.keys())vertices[index]=v3.mix(anchors[index],vertices[index],strength);
  }
  const junctionRailFit=options.sourceOwnedJunctions&&options.junctionRailFit?curveUnionV2FitJunctionRails(nodes,vertices,Number(options.junctionRailFit)):null;
  if(junctionRailFit&&options.junctionRowPhase)junctionRailFit.rowPhase=curveUnionV2FitRowPhase(nodes,vertices,Number(options.junctionRowPhase));
  if(options.branchLedJunctions){
    // Work upstream from the natural child rails. The shared opening rails and
    // outer silhouette remain anchors; only the interior junction strips move.
    // Shared indices carry the fitted final parent row into each child exactly.
    for(const node of [...nodes].reverse())if(node.children.length){
      let offset=0;
      for(const child of node.children){
        const width=widthFor(child.members),last=node.front.length-1;
        for(const side of ['front','back']){
          let targets;
          if(child.members.length===1){
            const member=child.members[0],sample=strands[member].samples[child.start],rails=tailRailCache.get(member+':'+child.start);
            if(!rails)continue;
            targets=rails[side].map(p=>sweepPoint(sample,p));
          }else targets=forkEnvelopeRow(child.start,side==='front',child.members,child.children.map(c=>c.members),child.geometry).map(i=>vertices[i]);
          for(let c=1;c<width-1;c++){
            const column=offset+c,origin=vertices[node[side][last][column]],delta=v3.sub(targets[c],origin);
            for(let back=0;back<Math.min(3,last);back++){
              const row=last-back,index=node[side][row][column],weight=[.35,.22,.08][back];
              vertices[index]=v3.add(vertices[index],v3.scale(delta,weight));
            }
          }
        }offset+=width-1;
      }
    }
  }
  for(const node of nodes){if(node.outerLeft)node.front.forEach((row,i)=>{node.back[i][0]=row[0];});if(node.outerRight)node.front.forEach((row,i)=>{const last=row.length-1;node.back[i][last]=row[last];});}
  // Reduce genuinely crowded interior rails over contiguous shared-body runs.
  // Keep silhouette and source-interface columns fixed. Repeated adjacent
  // indices turn the ends of a removed rail into triangles in connect(), while
  // the remainder stays quads. Never weld a front vertex to a back vertex.
  let reducedRailVertices=0,railTerminationRuns=0;
  if(options.adaptiveRailReduction!==false){
    const replacements=new Map(),stride=columns-1;
    for(const member of order)for(let local=1;local<stride-1;local+=2){
      let run=[];const seen=new Set();
      const flush=()=>{if(run.length>=3){for(const record of run)for(const [remove,keep] of record){replacements.set(remove,keep);reducedRailVertices++;}railTerminationRuns++;}run=[];};
      // A rail belongs to a source, not a tree node: carry the decision through
      // nested junctions, including the shared boundary row on both charts.
      for(const node of nodes.filter(n=>n.members.length>1&&n.members.includes(member)).sort((a,b)=>a.start-b.start)){
        const column=node.members.indexOf(member)*stride+local;
        for(let r=0;r<node.front.length;r++){
          const record=[node.front,node.back].map(side=>[side[r][column],side[r][column+1]]);
          if(seen.has(record[0][0]))continue;seen.add(record[0][0]);
          let perimeter=0;for(const side of [node.front,node.back])for(let c=1;c<side[r].length;c++)perimeter+=v3.len(v3.sub(vertices[side[r][c]],vertices[side[r][c-1]]));
          const target=perimeter/(2*(node.front[r].length-1)),distance=Math.max(...record.map(([a,b])=>v3.len(v3.sub(vertices[a],vertices[b]))));
          if(distance<target*.5)run.push(record);else flush();
        }
      }flush();
    }
    for(const node of nodes)for(const side of [node.front,node.back])for(const row of side)for(let c=0;c<row.length;c++)if(replacements.has(row[c]))row[c]=replacements.get(row[c]);
  }
  let insertedAlignmentLoops=0,removedAlignmentLoops=0,alignmentTargetSpacing=0;if(options.adaptiveLoopAlignment!==false){const rowCenter=(front,back)=>{const indices=[...front,...back],unique=[...new Set(indices)];return v3.scale(unique.reduce((sum,index)=>v3.add(sum,vertices[index]),[0,0,0]),1/Math.max(1,unique.length));},gap=(node,index)=>v3.len(v3.sub(rowCenter(node.front[index],node.back[index]),rowCenter(node.front[index+1],node.back[index+1]))),allGaps=[];for(const node of nodes)for(let row=0;row<node.front.length-1;row++){const distance=gap(node,row);if(distance>EPS)allGaps.push(distance);}allGaps.sort((a,b)=>a-b);alignmentTargetSpacing=allGaps.length?allGaps[Math.floor(allGaps.length/2)]:0;if(alignmentTargetSpacing>EPS){for(const node of nodes){for(let row=node.front.length-3;row>=2;row--){const before=gap(node,row-1),after=gap(node,row);if(before+after<alignmentTargetSpacing*.9){node.front.splice(row,1);node.back.splice(row,1);removedAlignmentLoops++;}}for(let row=node.front.length-2;row>=0;row--){const distance=gap(node,row),insertions=Math.min(2,Math.max(0,Math.ceil(distance/(alignmentTargetSpacing*1.28))-1));if(!insertions)continue;const frontRows=[],backRows=[];for(let step=1;step<=insertions;step++){const amount=step/(insertions+1),make=(first,second,side)=>first.map((index,column)=>pointIndex(v3.mix(vertices[index],vertices[second[column]],amount),side)),frontRow=make(node.front[row],node.front[row+1],'front'),backRow=make(node.back[row],node.back[row+1],'back');if(node.outerLeft)backRow[0]=frontRow[0];if(node.outerRight)backRow[backRow.length-1]=frontRow[frontRow.length-1];frontRows.push(frontRow);backRows.push(backRow);}node.front.splice(row+1,0,...frontRows);node.back.splice(row+1,0,...backRows);insertedAlignmentLoops+=insertions;}}}}
  const relaxGrid=(rows,strength,passes=2,lockTip=false)=>{if(strength<=0||rows.length<3||rows[0].length<3)return;for(let pass=0;pass<passes;pass++){const updates=[];for(let r=1;r<rows.length-1;r++){const rowT=r/(rows.length-1),localStrength=strength*(lockTip?(1-rowT)*(1-rowT):1);for(let c=1;c<rows[r].length-1;c++){const current=vertices[rows[r][c]],along=v3.scale(v3.add(vertices[rows[r-1][c]],vertices[rows[r+1][c]]),.5),across=v3.scale(v3.add(vertices[rows[r][c-1]],vertices[rows[r][c+1]]),.5);updates.push([rows[r][c],v3.mix(v3.mix(current,along,.28*localStrength),across,.1*localStrength)]);}}for(const [i,p] of updates)vertices[i]=p;}};const strength=0;for(const node of nodes){const lockTip=!node.children.length&&node.members.length===1;relaxGrid(node.front,strength,2,lockTip);relaxGrid(node.back,strength,2,lockTip);}
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
  // Preserve semantic opening/silhouette rails through welding and compaction.
  // Position keys avoid retaining obsolete pre-weld vertex indices.
  const protectedPoints=new Map(),protect=i=>{const p=vertices[i];protectedPoints.set(p.map(x=>Math.round(x*1e8)).join(','),[...p]);};
  // Carry semantic junction neighborhoods through index welding as positions.
  // Both sides and either child edge use the same oriented three-column patch.
  const junctionFlowNeighborhoods=[];
  if(junctionRailFit)for(const parent of nodes)if(parent.children.length>1&&parent.front.length>1){
    for(const child of parent.children)for(const side of ['front','back'])for(const direction of [1,-1]){
      const rows=child[side],upper=parent[side].at(-2),shared=parent[side].at(-1);
      if(rows.length<2||rows[0].length<4)continue;
      const edge=direction===1?0:rows[0].length-1,start=shared.indexOf(rows[0][edge]);
      if(start<=0||start>=shared.length-1||start+direction*3<0||start+direction*3>=upper.length)continue;
      const a=Array.from({length:4},(_,j)=>upper[start+direction*j]),b=Array.from({length:4},(_,j)=>rows[0][edge+direction*j]),c=Array.from({length:4},(_,j)=>rows[1][edge+direction*j]);
      junctionFlowNeighborhoods.push({a:a.map(i=>[...vertices[i]]),b:b.map(i=>[...vertices[i]]),c:c.map(i=>[...vertices[i]])});
    }
  }
  if(junctionRailFit)for(const node of nodes)for(const side of ['front','back']){
    for(const row of node[side]){protect(row[0]);protect(row.at(-1));}
    if(node.start===0)for(const i of node[side][0])protect(i);
    if(!node.children.length)for(const row of node[side].slice(-2))for(const i of row)protect(i);
  }
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
  const contactBoundaryAudit=nodes.filter(n=>n.members.length>1).map(n=>({members:n.members,sharedThrough:n.end,contactEnd:contactSplitPlan(n.members,n.start)?.end??null}));
  const contactBoundaryViolations=contactBoundaryAudit.filter(n=>n.contactEnd!==null&&n.sharedThrough>n.contactEnd).length;
  const forkPanels=nodes.filter(node=>node.children.length).length;return {vertices,faces:triangles,objFaces:faces,bounds:{lo,hi},preservedStrands:0,remeshedGroups:1,axialLoops:axial,branchCount:nodes.filter(node=>!node.children.length).length,splitRows,contactBoundaryAudit,contactBoundaryViolations,topologyMode:'balanced-fork-layout',tipPoles:nodes.filter(node=>!node.children.length&&node.members.length===1).length,forkPanels,junctionRailFit,junctionFlowNeighborhoods,junctionProtectedPositions:[...protectedPoints.values()],crotchWelds,crotchPoles,crotchSeamEdges,reducedForkRails,reducedRailVertices,railTerminationRuns,sourceLoopForks:forkPanels,crotchJoinMode:'two-sided-crotch-edge',topologyMutation:options.topologyMutation||'baseline',localNodeFrames:Boolean(options.localNodeFrames),prunedRows,insertedAlignmentLoops,removedAlignmentLoops,alignmentTargetSpacing,tipSeparation:requestedTipSeparation,preservedTailFrames:options.preserveTailFrames!==false};
}

function profilePolygonDistance(first,second){
  const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/Math.max(EPS,dx*dx+dy*dy));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  let distance=Infinity;
  for(const [a,b] of [[first,second],[second,first]])for(const p of a)for(let i=0;i<b.length;i++)distance=Math.min(distance,pointSegment(p,b[i],b[(i+1)%b.length]));
  return distance;
}

function curveUnionV2Resample(sweep,count){
  const cumulative=[0];for(let i=1;i<sweep.frames.length;i++)cumulative.push(cumulative[i-1]+v3.len(v3.sub(sweep.frames[i].c,sweep.frames[i-1].c)));
  const length=cumulative[cumulative.length-1];if(length<EPS)return sweep;
  const frames=Array.from({length:count},(_,row)=>{const distance=length*row/(count-1);let edge=0;while(edge<cumulative.length-2&&cumulative[edge+1]<distance)edge++;
    const amount=(distance-cumulative[edge])/Math.max(EPS,cumulative[edge+1]-cumulative[edge]),sample=interpolateSweepFrame(sweep.frames[edge],sweep.frames[edge+1],amount);
    // Resampled frames are station-indexed; original AHS rings are arc-indexed.
    delete sample.arcFraction;
    sample.x=v3.norm(v3.sub(sample.x,v3.scale(sample.t,v3.dot(sample.x,sample.t))));
    const z=v3.norm(v3.cross(sample.t,sample.x));sample.z=v3.dot(z,sample.z)<0?v3.scale(z,-1):z;return sample;});
  return {...sweep,frames};
}

function curveUnionV2AlignStations(sweeps){
  const count=sweeps[0].frames.length,step=1/(count-1),parameters=sweeps.map(()=>Array.from({length:count},(_,r)=>r*step));
  for(let pass=0;pass<4;pass++){
    const proposed=parameters.map(row=>[...row]);
    for(let r=1;r<count-1;r++){
      const frames=sweeps.map((s,i)=>sweepFrameAt(s,parameters[i][r])),center=v3.scale(frames.reduce((p,f)=>v3.add(p,f.c),[0,0,0]),1/frames.length),tangent=v3.norm(frames.reduce((p,f)=>v3.add(p,f.t),[0,0,0]));
      for(let i=0;i<sweeps.length;i++){
        const sweep=sweeps[i],lo=Math.max(0,(r-1.25)*step),hi=Math.min(1,(r+1.25)*step);let best=parameters[i][r],error=Infinity;
        for(let edge=Math.max(0,r-2);edge<=Math.min(count-2,r+1);edge++){
          const a=sweep.frames[edge].c,b=sweep.frames[edge+1].c,denominator=v3.dot(v3.sub(b,a),tangent);
          if(Math.abs(denominator)<EPS)continue;
          const q=clamp((edge+clamp(v3.dot(v3.sub(center,a),tangent)/denominator))*step,lo,hi),frame=sweepFrameAt(sweep,q),distance=Math.abs(v3.dot(v3.sub(frame.c,center),tangent));
          if(distance<error){error=distance;best=q;}
        }
        proposed[i][r]=parameters[i][r]*.35+best*.65;
      }
    }
    for(let i=0;i<sweeps.length;i++){
      for(let r=1;r<count-1;r++)parameters[i][r]=proposed[i][r]*.6+(proposed[i][r-1]+proposed[i][r+1])*.2;
      for(let r=1;r<count-1;r++)parameters[i][r]=Math.max(parameters[i][r],parameters[i][r-1]+step*.35);
      for(let r=count-2;r>0;r--)parameters[i][r]=Math.min(parameters[i][r],parameters[i][r+1]-step*.35);
    }
  }
  return sweeps.map((s,i)=>({...s,frames:parameters[i].map((t,r)=>r===0||r===count-1?s.frames[r]:sweepFrameAt(s,t))}));
}

function curveUnionV2FairRails(mesh,sweeps,strength,coupled=true){
  const faces=mesh.objFaces||mesh.faces,original=mesh.vertices,vertices=original.map(p=>[...p]),neighbors=vertices.map(()=>new Set()),incident=vertices.map(()=>[]);
  for(const face of faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length];neighbors[a].add(b);neighbors[b].add(a);incident[a].push(face);}
  const stencils=[];
  for(let i=0;i<vertices.length;i++){
    if(neighbors[i].size!==4||incident[i].some(f=>f.length!==4))continue;
    let nearest=null,distance=Infinity;
    for(const sweep of sweeps)for(let r=0;r<sweep.frames.length;r++){const f=sweep.frames[r],d=v3.len(v3.sub(original[i],f.c));if(d<distance){distance=d;nearest={f,end:r<=(coupled?0:1)||r>=sweep.frames.length-2};}}
    if(!nearest||nearest.end)continue;
    const t=v3.norm(nearest.f.t),adj=[...neighbors[i]],axial=adj.filter(j=>Math.abs(v3.dot(v3.norm(v3.sub(original[j],original[i])),t))>.6),cross=adj.filter(j=>!axial.includes(j));
    if(axial.length!==2||cross.length!==2||v3.dot(v3.sub(original[axial[0]],original[i]),t)*v3.dot(v3.sub(original[axial[1]],original[i]),t)>=0)continue;
    // Preserve sharp side walls / slit boundaries, rather than rounding a seam.
    const normals=incident[i].map(f=>v3.norm(v3.cross(v3.sub(original[f[1]],original[f[0]]),v3.sub(original[f[2]],original[f[0]]))));
    const sharp=normals.some(a=>normals.some(b=>v3.dot(a,b)<.5));
    if(sharp&&!coupled)continue;
    const limit=Math.min(Math.max(nearest.f.width,nearest.f.depth)*.06,...adj.map(j=>v3.len(v3.sub(original[j],original[i]))*.35));
    const normal=v3.norm(normals.reduce((sum,n)=>v3.add(sum,n),[0,0,0]));
    stencils.push({i,axial,cross,t,normal,limit,sharp});
  }
  const energy=points=>stencils.reduce((sum,{i,axial,cross})=>{
    const [a,b]=axial.map(j=>points[j]),u=v3.norm(v3.sub(a,points[i])),v=v3.norm(v3.sub(points[i],b));
    const [x,y]=cross.map(j=>v3.len(v3.sub(points[j],points[i])));
    return sum+(1-v3.dot(u,v))+((x-y)/Math.max(EPS,x+y))**2;
  },0)/Math.max(1,stencils.length);
  if(coupled){
    // One sparse least-squares system for the connected rails, rather than
    // independent Jacobi nudges. Rail curvature and transverse spacing share
    // unknowns, so changing one strip influences its neighbors. Non-regular
    // vertices (fork poles, tips, cap boundaries) are fixed constraints.
    const indices=new Map(stencils.map((s,j)=>[s.i,j])),rows=[];
    for(const s of stencils){
      const [a,b]=s.axial,da=v3.len(v3.sub(original[a],original[s.i])),db=v3.len(v3.sub(original[b],original[s.i]));
      rows.push({terms:[[s.i,1],[a,-db/Math.max(EPS,da+db)],[b,-da/Math.max(EPS,da+db)]],weight:12*strength});
      if(!s.sharp)rows.push({terms:[[s.i,1],[s.cross[0],-.5],[s.cross[1],-.5]],weight:.35*strength});
    }
    const constraints=rows.map(row=>({...row,variables:row.terms.filter(([id])=>indices.has(id)).map(([id,w])=>[indices.get(id),w])})),n=stencils.length;
    const multiply=x=>{const y=x.map(v=>v*.35);for(const row of constraints){let value=0;for(const [j,w] of row.variables)value+=x[j]*w;for(const [j,w] of row.variables)y[j]+=row.weight*w*value;}return y;},dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),solutions=[];
    for(let axis=0;axis<3;axis++){
      const rhs=Array(n).fill(0);for(const row of constraints){const residual=row.terms.reduce((sum,[id,w])=>sum+original[id][axis]*w,0);for(const [j,w] of row.variables)rhs[j]-=row.weight*w*residual;}
      const x=Array(n).fill(0);let residual=[...rhs],direction=[...rhs],squared=dot(residual,residual);
      for(let iteration=0;iteration<80&&squared>1e-18;iteration++){
        const ad=multiply(direction),denominator=dot(direction,ad);if(denominator<=1e-20)break;
        const alpha=squared/denominator;for(let j=0;j<n;j++){x[j]+=alpha*direction[j];residual[j]-=alpha*ad[j];}
        const next=dot(residual,residual),beta=next/squared;direction=residual.map((v,j)=>v+beta*direction[j]);squared=next;
      }solutions.push(x);
    }
    for(let j=0;j<n;j++){
      const {i,t,normal,limit,sharp}=stencils[j],raw=solutions.map(axis=>axis[j]),lateral=v3.sub(raw,v3.scale(t,v3.dot(raw,t))),delta=sharp?lateral:v3.sub(lateral,v3.scale(normal,v3.dot(lateral,normal)*.75)),length=v3.len(delta);
      vertices[i]=v3.add(original[i],length>limit?v3.scale(delta,limit/length):delta);
    }
  }else for(let pass=0;pass<4;pass++){
    const old=vertices.map(p=>[...p]);
    for(const {i,axial,cross,t,normal,limit} of stencils){
      const before=old[axial[0]],after=old[axial[1]],a=v3.len(v3.sub(old[i],before)),b=v3.len(v3.sub(old[i],after)),along=v3.mix(before,after,a/Math.max(EPS,a+b)),across=v3.scale(v3.add(old[cross[0]],old[cross[1]]),.5);
      const raw=v3.add(v3.scale(v3.sub(along,old[i]),.55),v3.scale(v3.sub(across,old[i]),.45)),lateral=v3.sub(raw,v3.scale(t,v3.dot(raw,t))),surfaceBiased=v3.sub(lateral,v3.scale(normal,v3.dot(lateral,normal)*.85)),target=v3.add(old[i],v3.scale(surfaceBiased,strength)),delta=v3.sub(target,original[i]),length=v3.len(delta);
      vertices[i]=v3.add(original[i],length>limit?v3.scale(delta,limit/length):delta);
    }
  }
  const result=rebuildEditedMesh(mesh,vertices,faces,'curve-v2-flow-first');
  const volume=points=>Math.abs(faces.reduce((sum,f)=>{for(let j=1;j<f.length-1;j++)sum+=v3.dot(points[f[0]],v3.cross(points[f[j]],points[f[j+1]]))/6;return sum;},0));
  result.railFairing={before:energy(original),after:energy(vertices),vertices:stencils.length,volumeRatio:volume(vertices)/Math.max(EPS,volume(original)),method:coupled?'coupled-rails':'local'};return result;
}

function curveUnionV2JunctionFlowCandidates(mesh){
  const key=p=>p.map(x=>Math.round(x*1e8)).join(','),lookup=new Map();
  mesh.vertices.forEach((p,i)=>{const k=key(p);lookup.set(k,lookup.has(k)?null:i);});
  const protectedKeys=new Set((mesh.junctionProtectedPositions||[]).map(key));
  const signature=f=>[...f].sort((a,b)=>a-b).join(','),faces=mesh.objFaces,faceMap=new Map(faces.map((f,i)=>[signature(f),i]));
  const incident=mesh.vertices.map(()=>[]);faces.forEach((f,i)=>f.forEach(v=>incident[v].push(i)));
  const results=[];
  for(const region of (mesh.junctionFlowNeighborhoods||[]).slice(0,32)){
    const [a,b,c]=['a','b','c'].map(name=>region[name].map(p=>lookup.get(key(p))));
    if([...a,...b,...c].some(i=>i===undefined||i===null)||new Set([...a,...b,...c.slice(1)]).size!==11)continue;
    if([b[1],b[2]].some(i=>protectedKeys.has(key(mesh.vertices[i]))))continue;
    const old=[[a[0],b[0],b[1]],[a[0],b[1],a[1]],[a[1],b[1],b[2],a[2]],[a[2],b[2],b[3],a[3]],
      [b[0],c[1],b[1]],[b[1],c[1],c[2],b[2]],[b[2],c[2],c[3],b[3]]];
    const ids=old.map(f=>faceMap.get(signature(f)));if(ids.some(i=>i===undefined))continue;
    const removed=new Set(ids);if([b[1],b[2]].some(v=>incident[v].some(i=>!removed.has(i))))continue;
    const original=mesh.vertices,points=original.map(p=>[...p]);
    points[b[0]]=v3.mix(original[b[0]],v3.mix(original[a[0]],original[c[1]],.45),.75);
    points[b[1]]=v3.mix(v3.mix(original[a[1]],original[c[2]],.5),v3.mix(points[b[0]],original[b[3]],1/3),.55);
    points[b[2]]=v3.mix(v3.mix(original[a[2]],original[c[2]],.5),v3.mix(points[b[0]],original[b[3]],2/3),.55);
    const moved=[b[0],b[1],b[2]],scale=Math.min(v3.len(v3.sub(original[a[0]],original[b[0]])),v3.len(v3.sub(original[c[1]],original[b[0]])));
    if(moved.some(i=>v3.len(v3.sub(points[i],original[i]))>scale*.6))continue;
    const turn=(p,x,y,z)=>1-v3.dot(v3.norm(v3.sub(p[y],p[x])),v3.norm(v3.sub(p[z],p[y])));
    const energy=p=>turn(p,a[1],b[1],c[2])+turn(p,a[2],b[2],c[2]);
    if(energy(points)>=energy(original)*.8)continue;
    let patch=[[a[0],b[0],b[1],a[1]],[a[1],b[1],b[2],a[2]],[a[2],b[2],b[3],a[3]],
      [b[0],c[1],c[2],b[1]],[b[1],c[2],b[2]],[b[2],c[2],c[3],b[3]]];
    // Match the unchanged boundary edge winding on back/mirrored neighborhoods.
    const anchor=faces[ids[2]],forward=anchor.some((v,j)=>v===a[1]&&anchor[(j+1)%anchor.length]===b[1]);
    if(!forward)patch=patch.map(f=>f.slice().reverse());
    const affected=[...new Set(moved.flatMap(v=>incident[v]))].filter(i=>!removed.has(i)).map(i=>faces[i]).concat(patch);
    let valid=true,minAngle=180;
    for(const f of affected){
      if(f.length===4&&quadDiagonalQuality(points,f,false)<.5){valid=false;break;}
      for(let j=0;j<f.length;j++){
        const p=points[f[j]],angle=Math.acos(clamp(v3.dot(v3.norm(v3.sub(points[f[(j+1)%f.length]],p)),v3.norm(v3.sub(points[f[(j+f.length-1)%f.length]],p))),-1,1))*180/Math.PI;
        minAngle=Math.min(minAngle,angle);if(angle<10||angle>170)valid=false;
      }
    }
    if(!valid)continue;
    const objFaces=faces.filter((_,i)=>!removed.has(i)).map(f=>f.slice()).concat(patch);
    const result={...mesh,vertices:points,objFaces,faces:objFaces.flatMap(f=>f.slice(1,-1).map((v,j)=>[f[0],v,f[j+2]]))};
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[j]);hi[j]=Math.max(hi[j],p[j]);}result.bounds={lo,hi};
    result.junctionProtectedPositions=(mesh.junctionProtectedPositions||[]).map(p=>key(p)===key(original[b[0]])?[...points[b[0]]]:[...p]);
    result.junctionFlowTemplate={movedVertices:3,movedPositions:moved.map(i=>({before:[...original[i]],after:[...points[i]]})),supportBefore:[...original[b[0]]],supportAfter:[...points[b[0]]],openingPosition:[...original[c[0]]],beforeRailEnergy:energy(original),afterRailEnergy:energy(points),minAngle};
    results.push(result);if(results.length===6)break;
  }
  return results;
}

function curveUnionV2JunctionPatchCandidates(mesh,sweeps){
  if(!mesh.junctionProtectedPositions?.length)return [];
  const vertices=mesh.vertices,faces=mesh.objFaces,adj=vertices.map(()=>new Set()),incident=vertices.map(()=>[]),uses=new Map();
  const positionKey=p=>p.map(x=>Math.round(x*1e8)).join(','),protectedKeys=new Set(mesh.junctionProtectedPositions.map(positionKey));
  const protectedVertices=new Set(vertices.map((p,i)=>protectedKeys.has(positionKey(p))?i:-1).filter(i=>i>=0));
  const key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  faces.forEach((f,i)=>f.forEach((a,j)=>{incident[a].push(i);const b=f[(j+1)%f.length],k=key(a,b);adj[a].add(b);adj[b].add(a);if(!uses.has(k))uses.set(k,[]);uses.get(k).push(i);}));
  const diagnostics=artistMeshDiagnostics(mesh,sweeps,adj),assigned=diagnostics._assignments;
  const quality=f=>{
    const p=f.map(i=>vertices[i]),angles=p.map((x,i)=>Math.acos(clamp(v3.dot(v3.norm(v3.sub(p[(i+1)%p.length],x)),v3.norm(v3.sub(p[(i+p.length-1)%p.length],x))),-1,1))*180/Math.PI);
    const edges=p.map((x,i)=>v3.len(v3.sub(x,p[(i+1)%p.length]))),normal=v3.norm(p.slice(1,-1).reduce((sum,x,i)=>v3.add(sum,v3.cross(v3.sub(x,p[0]),v3.sub(p[i+2],p[0]))),[0,0,0]));
    const warp=f.length===4?quadDiagonalQuality(vertices,f,false):1,min=Math.min(...angles),max=Math.max(...angles),aspect=Math.max(...edges)/Math.max(EPS,Math.min(...edges));
    return {min,max,warp,normal,cost:5*(Math.max(0,40-min)/40)**2+2*(1-warp)**2+.1*Math.log(aspect)**2};
  };
  const faceQuality=faces.map(quality),memo=new Map();
  // Enumerate combinatorial polygon partitions, not geometric triangulations.
  // Nine boundary vertices is the hard upper bound on this local search.
  const partitions=loop=>{
    if(loop.length===2)return [[]];if(loop.length<2)return [];
    const result=[];
    for(const size of [3,4]){
      const choose=(selected,next)=>{
        if(selected.length===size-2){
          const cuts=[0,...selected,loop.length-1],face=cuts.map(i=>loop[i]);let combinations=[[]];
          for(let i=0;i<cuts.length-1;i++){const sub=partitions(loop.slice(cuts[i],cuts[i+1]+1));combinations=combinations.flatMap(a=>sub.map(b=>[...a,...b]));}
          for(const rest of combinations)result.push([face,...rest]);return;
        }
        for(let i=next;i<loop.length-1;i++)choose([...selected,i],i+1);
      };choose([],1);
    }return result;
  };
  const seeds=incident.map((list,id)=>({id,skinny:list.filter(i=>faces[i].length===3&&faceQuality[i].min<20).length}))
    .filter(s=>s.skinny>=2&&adj[s.id].size<=5&&assigned[s.id].u>=.12&&assigned[s.id].u<=.85&&diagnostics._nearJunction.has(s.id))
    .sort((a,b)=>b.skinny-a.skinny||a.id-b.id).slice(0,32);
  const removalSets=new Map();for(const {id}of seeds){removalSets.set(String(id),[id]);for(const j of [...adj[id]].sort((a,b)=>a-b))if(adj[j].size<=5){const ids=[id,j].sort((a,b)=>a-b);removalSets.set(ids.join(','),ids);}}
  const candidates=[];
  for(const remove of removalSets.values()){
    if(remove.some(i=>protectedVertices.has(i)||assigned[i].u<.12||assigned[i].u>.85))continue;
    const pair=[...new Set(remove.flatMap(i=>incident[i]))].sort((a,b)=>a-b),pairSet=new Set(pair);
    if(pair.length<3||pair.length>8)continue;
    const edges=new Map();for(const i of pair)for(let j=0;j<faces[i].length;j++){const a=faces[i][j],b=faces[i][(j+1)%faces[i].length],k=key(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);}
    const boundary=[...edges.values()].filter(x=>x.length===1).map(x=>x[0]);
    if(boundary.length<5||boundary.length>9||boundary.some(e=>remove.some(v=>e.includes(v))))continue;
    const next=new Map(boundary),cycle=[boundary[0][0]];let at=next.get(cycle[0]);
    while(at!==cycle[0]&&cycle.length<=boundary.length){cycle.push(at);at=next.get(at);}
    if(at!==cycle[0]||cycle.length!==boundary.length||new Set(cycle).size!==cycle.length)continue;
    const old=pair.map(i=>faces[i]),q=pair.map(i=>faceQuality[i]),oldTriangles=old.filter(f=>f.length===3).length,oldQuads=old.filter(f=>f.length===4).length;
    if(!memo.has(cycle.length))memo.set(cycle.length,partitions(Array.from({length:cycle.length},(_,i)=>i)));
    for(const pattern of memo.get(cycle.length)){
      if(pattern.filter(f=>f.length===3).length>oldTriangles-2||pattern.filter(f=>f.length===4).length<oldQuads-remove.length+1)continue;
      const proposed=pattern.map(f=>f.map(i=>cycle[i])).map(f=>f.length===4&&quadDiagonalQuality(vertices,f,true)>quadDiagonalQuality(vertices,f,false)?[...f.slice(1),f[0]]:f);
      const n=proposed.map(quality),beforeMin=Math.min(...q.map(x=>x.min)),afterMin=Math.min(...n.map(x=>x.min));
      if(afterMin<20||afterMin<beforeMin+5||n.some(x=>x.max>165||x.warp<Math.cos(35*Math.PI/180)))continue;
      const mean=v3.norm(q.reduce((s,x)=>v3.add(s,x.normal),[0,0,0]));if(n.some(x=>v3.dot(x.normal,mean)<.3))continue;
      const nextAdj=new Map(cycle.map(i=>[i,new Set([...adj[i]].filter(j=>!remove.includes(j)&&uses.get(key(i,j)).some(f=>!pairSet.has(f))))]));
      for(const f of proposed)for(let e=0;e<f.length;e++){nextAdj.get(f[e]).add(f[(e+1)%f.length]);nextAdj.get(f[(e+1)%f.length]).add(f[e]);}
      if(cycle.some(i=>nextAdj.get(i).size<3||nextAdj.get(i).size>Math.max(5,adj[i].size)))continue;
      if(cycle.some(i=>protectedVertices.has(i)&&[...adj[i]].some(j=>protectedVertices.has(j)&&!nextAdj.get(i).has(j))))continue;
      const gain=q.reduce((s,x)=>s+x.cost,0)-n.reduce((s,x)=>s+x.cost,0);if(gain<.5)continue;
      candidates.push({remove,pair,pairSet,proposed,gain,beforeMin,afterMin});
    }
  }
  candidates.sort((a,b)=>b.gain-a.gain||a.remove[0]-b.remove[0]);
  const seen=new Set(),results=[];
  for(const c of candidates){
    const signature=JSON.stringify(c.proposed.map(f=>[...f].sort((a,b)=>a-b)).sort());if(seen.has(signature))continue;seen.add(signature);
    const points=vertices.filter((p,i)=>!c.remove.includes(i)).map(p=>[...p]);
    const objFaces=faces.filter((f,i)=>!c.pairSet.has(i)).concat(c.proposed).map(f=>f.map(i=>i-c.remove.filter(v=>v<i).length));
    // Own both face arrays: a local candidate must never mutate the baseline.
    const result={...mesh,vertices:points,objFaces,faces:objFaces.flatMap(f=>f.slice(1,-1).map((v,j)=>[f[0],v,f[j+2]]))};
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],p[axis]);hi[axis]=Math.max(hi[axis],p[axis]);}result.bounds={lo,hi};
    result.junctionPatch={removedVertices:c.remove.length,removedPositions:c.remove.map(i=>[...vertices[i]]),replacementFaces:c.proposed.map(f=>f.map(i=>[...vertices[i]])),beforeFaces:c.pair.length,afterFaces:c.proposed.length,beforeMinAngle:c.beforeMin,afterMinAngle:c.afterMin};
    results.push(result);if(results.length>=6)break;
  }
  return results;
}

function curveUnionV2StaggerJunctionPoles(mesh){
  if(!mesh.junctionPatch?.replacementFaces)return [];
  const pk=p=>p.map(x=>Math.round(x*1e8)).join(','),fk=f=>f.map(pk).sort().join('|'),vertices=mesh.vertices,faces=mesh.objFaces;
  const signatures=new Set(mesh.junctionPatch.replacementFaces.map(fk));
  const local=faces.map((f,i)=>signatures.has(fk(f.map(v=>vertices[v])))?i:-1).filter(i=>i>=0);
  if(local.length>6)return [];
  const key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,protectedKeys=new Set((mesh.junctionProtectedPositions||[]).map(pk)),protectedIds=new Set(vertices.map((p,i)=>protectedKeys.has(pk(p))?i:-1).filter(i=>i>=0));
  const adj=vertices.map(()=>new Set());for(const f of faces)for(let j=0;j<f.length;j++){adj[f[j]].add(f[(j+1)%f.length]);adj[f[(j+1)%f.length]].add(f[j]);}
  const quality=f=>{
    const p=f.map(i=>vertices[i]),angles=p.map((v,j)=>Math.acos(clamp(v3.dot(v3.norm(v3.sub(p[(j+1)%p.length],v)),v3.norm(v3.sub(p[(j+p.length-1)%p.length],v))),-1,1))*180/Math.PI);
    const warp=f.length===4?quadDiagonalQuality(vertices,f,false):1;
    return {min:Math.min(...angles),max:Math.max(...angles),warp,cost:angles.reduce((s,a)=>s+Math.cos(a*Math.PI/180)**2,0)+15*(1-warp)**2};
  };
  // Only seven boundary vertices, two quads and one triangle. This constant
  // combinatorial search replaces the much larger offline edge-rotation beam.
  const partitions=loop=>{
    if(loop.length===2)return [[]];if(loop.length<3)return [];
    const result=[];for(const size of [3,4]){
      const choose=(inside,next)=>{if(inside.length===size-2){const cuts=[0,...inside,loop.length-1];let rest=[[]];for(let j=0;j<cuts.length-1;j++)rest=rest.flatMap(a=>partitions(loop.slice(cuts[j],cuts[j+1]+1)).map(b=>a.concat(b)));for(const r of rest)result.push([cuts.map(j=>loop[j]),...r]);return;}
        for(let j=next;j<loop.length-1;j++)choose([...inside,j],j+1);};choose([],1);
    }return result;
  };
  const patterns=partitions([0,1,2,3,4,5,6]).filter(p=>p.length===3&&p.filter(f=>f.length===4).length===2),candidates=[];
  for(const triangle of local.filter(i=>faces[i].length===3))for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){
    const ids=[triangle,local[i],local[j]];if(local[i]===triangle||local[j]===triangle||faces[local[i]].length!==4||faces[local[j]].length!==4)continue;
    const edgeUses=new Map();for(const id of ids){const f=faces[id];for(let e=0;e<f.length;e++){const a=f[e],b=f[(e+1)%f.length],k=key(a,b);if(!edgeUses.has(k))edgeUses.set(k,[]);edgeUses.get(k).push([a,b]);}}
    const boundary=[...edgeUses.values()].filter(e=>e.length===1).map(e=>e[0]);if(boundary.length!==7)continue;
    const next=new Map(boundary),cycle=[boundary[0][0]];let at=next.get(cycle[0]);while(at!==cycle[0]&&cycle.length<=7){cycle.push(at);at=next.get(at);}if(at!==cycle[0]||cycle.length!==7||new Set(cycle).size!==7)continue;
    const before=ids.map(id=>quality(faces[id])),beforeMin=Math.min(...before.map(q=>q.min)),beforeWarp=Math.min(...before.map(q=>q.warp)),beforeCost=before.reduce((s,q)=>s+q.cost,0);
    for(const pattern of patterns){
      const proposed=pattern.map(f=>f.map(i=>cycle[i])).map(f=>f.length===4&&quadDiagonalQuality(vertices,f,true)>quadDiagonalQuality(vertices,f,false)?f.slice(1).concat(f[0]):f),after=proposed.map(quality),min=Math.min(...after.map(q=>q.min)),cost=after.reduce((s,q)=>s+q.cost,0);
      if(min<20||min<beforeMin+3||after.some(q=>q.max>Math.max(...before.map(q=>q.max))||q.warp<beforeWarp)||cost>beforeCost*.85)continue;
      const oldEdges=new Set([...edgeUses.keys()]),newEdges=new Set(proposed.flatMap(f=>f.map((a,j)=>key(a,f[(j+1)%f.length]))));
      if([...oldEdges].some(k=>{const [a,b]=k.split(',').map(Number);return protectedIds.has(a)&&protectedIds.has(b)&&!newEdges.has(k);}))continue;
      const degrees=new Map(cycle.map(i=>[i,adj[i].size]));for(const k of oldEdges)if(!newEdges.has(k)){const [a,b]=k.split(',').map(Number);degrees.set(a,degrees.get(a)-1);degrees.set(b,degrees.get(b)-1);}
      for(const k of newEdges)if(!oldEdges.has(k)){const [a,b]=k.split(',').map(Number);degrees.set(a,degrees.get(a)+1);degrees.set(b,degrees.get(b)+1);}
      if(cycle.some(i=>degrees.get(i)<3||degrees.get(i)>Math.max(5,adj[i].size)))continue;
      const objFaces=faces.map(f=>f.slice());ids.forEach((id,j)=>objFaces[id]=proposed[j]);
      const result={...mesh,vertices:vertices.map(p=>[...p]),objFaces,faces:objFaces.flatMap(f=>f.slice(1,-1).map((v,j)=>[f[0],v,f[j+2]]))};
      result.junctionPoleRouting={faces:3,movedVertices:0,beforeMinAngle:beforeMin,afterMinAngle:min,beforeWorstWarp:Math.acos(clamp(beforeWarp,-1,1))*180/Math.PI,afterWorstWarp:Math.acos(clamp(Math.min(...after.map(q=>q.warp)),-1,1))*180/Math.PI,gain:beforeCost-cost};
      candidates.push(result);
    }
  }
  candidates.sort((a,b)=>b.junctionPoleRouting.gain-a.junctionPoleRouting.gain);
  const seen=new Set();return candidates.filter(m=>{const sig=JSON.stringify(m.objFaces.map(f=>f.slice().sort((a,b)=>a-b)).sort());if(seen.has(sig))return false;seen.add(sig);return true;}).slice(0,4);
}

function curveUnionV2DissolveTriangles(mesh,sweeps=[]){
  const faces=mesh.objFaces||mesh.faces,points=mesh.vertices,uses=new Map(),triangleCount=new Uint16Array(points.length),candidates=[];
  for(let f=0;f<faces.length;f++){
    const face=faces[f];if(face.length===3)for(const v of face)triangleCount[v]++;
    for(let e=0;e<face.length;e++){const a=face[e],b=face[(e+1)%face.length],key=a<b?`${a},${b}`:`${b},${a}`;if(!uses.has(key))uses.set(key,[]);uses.get(key).push(f);}
  }
  const tips=sweeps.map(s=>s.frames.at(-1).c);
  for(const [edge,pair] of uses){
    if(pair.length!==2||pair.some(f=>faces[f].length!==3))continue;
    let cycle=facePairBoundary(faces[pair[0]],faces[pair[1]]);
    if(!cycle||cycle.length!==4||cycle.some(v=>triangleCount[v]>=5||tips.some(t=>v3.len(v3.sub(points[v],t))<EPS)))continue;
    // Retain the original diagonal for rendering/export triangulation, so this
    // operation changes polygon topology without changing the surface shape.
    const [a,b]=edge.split(',').map(Number),offset=cycle.indexOf(a);cycle=cycle.slice(offset).concat(cycle.slice(0,offset));
    if(cycle[2]!==b)continue;
    const p=cycle.map(v=>points[v]),normal=v3.norm(v3.cross(v3.sub(p[1],p[0]),v3.sub(p[2],p[0])));
    const turns=p.map((v,i)=>v3.cross(v3.sub(p[(i+1)%4],v),v3.sub(p[(i+2)%4],p[(i+1)%4])));
    if(turns.some(n=>v3.len(n)<EPS||v3.dot(v3.norm(n),normal)<.75))continue;
    const angles=p.map((v,i)=>Math.acos(clamp(v3.dot(v3.norm(v3.sub(p[(i+3)%4],v)),v3.norm(v3.sub(p[(i+1)%4],v))),-1,1))*180/Math.PI);
    if(Math.min(...angles)<12||Math.max(...angles)>168)continue;
    const lengths=p.map((v,i)=>v3.len(v3.sub(v,p[(i+1)%4])));
    if(Math.max(...lengths)>8*Math.min(...lengths))continue;
    candidates.push({pair,cycle,quality:Math.min(...angles)});
  }
  candidates.sort((a,b)=>b.quality-a.quality||a.pair[0]-b.pair[0]);
  const removed=new Set(),quads=[];
  for(const {pair,cycle} of candidates)if(pair.every(f=>!removed.has(f))){pair.forEach(f=>removed.add(f));quads.push(cycle);}
  if(!quads.length)return mesh;
  const result=rebuildEditedMesh(mesh,points,[...faces.filter((_,i)=>!removed.has(i)),...quads],'curve-v2-dissolve-triangle-pairs');
  result.dissolvedTrianglePairs=quads.length;return result;
}

function curveUnionV2DistanceQuery(vertices,triangles,distance){
  const unsafe=[],entries=[];
  for(const triangle of triangles){
    const [a,b,c]=triangle.map(i=>vertices[i]),ab=v3.sub(b,a),ac=v3.sub(c,a),bc=v3.sub(c,b);
    const area=v3.len(v3.cross(ab,ac)),scale=Math.max(v3.len(ab),v3.len(ac),v3.len(bc));
    if(!Number.isFinite(scale)||!Number.isFinite(area)||area<=Math.max(EPS,scale*scale*1e-8)){unsafe.push(triangle);continue;}
    const pad=Math.max(1,...a.map(Math.abs),...b.map(Math.abs),...c.map(Math.abs),scale)*1e-8;
    const lo=a.map((v,k)=>Math.min(v,b[k],c[k])-pad),hi=a.map((v,k)=>Math.max(v,b[k],c[k])+pad);
    entries.push({triangle,lo,hi});
  }
  const build=items=>{
    if(!items.length)return null;
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const item of items)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],item.lo[k]);hi[k]=Math.max(hi[k],item.hi[k]);}
    if(items.length<=8)return {lo,hi,items};
    let axis=0;for(let k=1;k<3;k++)if(hi[k]-lo[k]>hi[axis]-lo[axis])axis=k;
    items.sort((a,b)=>(a.lo[axis]+a.hi[axis])-(b.lo[axis]+b.hi[axis]));
    const middle=items.length>>1;return {lo,hi,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
  };
  const root=build(entries);
  // The maximum axis distance is a conservative bound without sqrt/rounding up.
  const lower=(point,node)=>Math.max(0,node.lo[0]-point[0],point[0]-node.hi[0],node.lo[1]-point[1],point[1]-node.hi[1],node.lo[2]-point[2],point[2]-node.hi[2]);
  return point=>{
    let best=Infinity;
    const test=triangle=>{const value=distance(point,vertices[triangle[0]],vertices[triangle[1]],vertices[triangle[2]]);if(Number.isFinite(value))best=Math.min(best,value);};
    for(const triangle of unsafe)test(triangle);
    const visit=node=>{
      if(!node||lower(point,node)>best)return;
      if(node.items){for(const item of node.items)if(lower(point,item)<=best)test(item.triangle);return;}
      if(lower(point,node.left)<=lower(point,node.right)){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
    };
    visit(root);return best;
  };
}

function curveUnionV2GradeMesh(mesh,reference,sweeps){
  return gradeMesh(mesh,reference,sweeps,{distanceQuery:curveUnionV2DistanceQuery});
}

function curveUnionV2AuditMesh(mesh,components){return strictQualityAudit(mesh,components);}

function curveUnionV2RecoverVolume(mesh,sweeps,strength,audit,grade,evaluate=curveUnionV2GradeMesh,validate=curveUnionV2AuditMesh){
  strength=clamp(Number(strength)||0,0,2);
  if(!strength)return {mesh,audit,grade};
  const stronger=strength>1,fallback=stronger?curveUnionV2RecoverVolume(mesh,sweeps,1,audit,grade,evaluate,validate):null;
  const report={strength,accepted:false,movedVertices:0,reason:'No safe surface-fit improvement'};
  const unchanged=()=>fallback?{...fallback,report:{...fallback.report,strength,limitedToLegacy:true}}:{mesh,audit,grade,report};
  if(!audit.hardValid||audit.foldedQuads){report.reason='Recovery requires valid, unfolded geometry';return unchanged();}
  const vertices=mesh.vertices,faces=mesh.objFaces||mesh.faces,adjacency=vertices.map(()=>new Set()),normals=vertices.map(()=>[0,0,0]),fixed=new Set(),edges=new Map();
  const key=p=>p.map(x=>Math.round(x*1e8)).join(','),protectedKeys=new Set((mesh.junctionProtectedPositions||[]).map(key));
  for(let i=0;i<vertices.length;i++)if(protectedKeys.has(key(vertices[i])))fixed.add(i);
  for(const face of faces){
    if(face.length!==4)for(const i of face)fixed.add(i);
    for(let j=0;j<face.length;j++){const a=face[j],b=face[(j+1)%face.length],k=a<b?`${a},${b}`:`${b},${a}`;adjacency[a].add(b);adjacency[b].add(a);if(!edges.has(k))edges.set(k,{a,b,count:0});edges.get(k).count++;}
    let normal=[0,0,0];for(let j=1;j<face.length-1;j++)normal=v3.add(normal,v3.cross(v3.sub(vertices[face[j]],vertices[face[0]]),v3.sub(vertices[face[j+1]],vertices[face[0]])));
    for(const i of face)normals[i]=v3.add(normals[i],normal);
  }
  for(const {a,b,count} of edges.values())if(count!==2){fixed.add(a);fixed.add(b);}
  for(let i=0;i<vertices.length;i++){if(adjacency[i].size!==4||v3.len(normals[i])<=EPS)fixed.add(i);normals[i]=v3.norm(normals[i]);}
  // A fixed collar around poles, tips, roots and protected junction boundaries.
  for(const i of [...fixed])for(const j of adjacency[i])fixed.add(j);
  const diagonal=Math.max(EPS,v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo))),source=buildSourceMesh(sweeps),triangles=[];
  for(let owner=0;owner<sweeps.length;owner++){const s=sourceSweepMesh(sweeps[owner]);for(const f of s.objFaces)for(let j=1;j<f.length-1;j++){
    const a=s.vertices[f[0]],b=s.vertices[f[j]],c=s.vertices[f[j+1]],ab=v3.sub(b,a),ac=v3.sub(c,a);
    if(v3.len(v3.cross(ab,ac))>EPS)triangles.push({owner,a,ab,ac,lo:a.map((x,k)=>Math.min(x,b[k],c[k])),hi:a.map((x,k)=>Math.max(x,b[k],c[k]))});
  }}
  const caps=vertices.map((p,i)=>Math.min(diagonal*.008,...[...adjacency[i]].map(j=>v3.len(v3.sub(vertices[j],p))*.18))),targets=new Float64Array(vertices.length),matched=new Set();
  for(let i=0;i<vertices.length;i++){
    if(fixed.has(i)||caps[i]<=EPS)continue;
    const p=vertices[i],n=normals[i],cap=caps[i]*(stronger?strength:1),searchCap=stronger?cap*(1+2*(strength-1)):cap;let best=Infinity;
    for(const t of triangles){
      if(p.some((x,k)=>x+searchCap<t.lo[k]||x-searchCap>t.hi[k]))continue;
      const h=v3.cross(n,t.ac),det=v3.dot(t.ab,h);if(Math.abs(det)<=EPS)continue;
      const s=v3.sub(p,t.a),u=v3.dot(s,h)/det;if(u<0||u>1)continue;
      const q=v3.cross(s,t.ab),v=v3.dot(n,q)/det;if(v<0||u+v>1)continue;
      const distance=v3.dot(t.ac,q)/det;if(Math.abs(distance)>searchCap||Math.abs(distance)>=Math.abs(best))continue;
      const hit=v3.add(p,v3.scale(n,distance));
      // Internal source faces must not pull a union surface into buried seams.
      if(sweeps.some((other,owner)=>owner!==t.owner&&sweepDistance(hit,other)<-diagonal*1e-5))continue;
      best=distance;
    }
    if(Number.isFinite(best)){targets[i]=stronger?clamp(best,-cap,cap):best;matched.add(i);}
  }
  let offsets=Float64Array.from(targets);
  for(let pass=0;pass<3;pass++){const next=Float64Array.from(offsets);for(const i of matched){let sum=0,count=0;for(const j of adjacency[i])if(v3.dot(normals[i],normals[j])>.5){sum+=offsets[j];count++;}const value=count?.6*targets[i]+.4*sum/count:targets[i];next[i]=Math.max(Math.min(0,targets[i]),Math.min(Math.max(0,targets[i]),value));}offsets=next;}
  const originalNormals=faces.map(f=>v3.cross(v3.sub(vertices[f[1]],vertices[f[0]]),v3.sub(vertices[f[2]],vertices[f[0]])));
  if(stronger){
    // A tight corner should limit its own neighborhood, not halve recovery on
    // the entire strand. Attenuate only offending regions, then run all of the
    // usual global guards below. Fixed anchors always retain zero displacement.
    for(let pass=0;pass<10;pass++){
      const points=vertices.map((p,i)=>v3.add(p,v3.scale(normals[i],offsets[i]))),limited=new Set();
      for(const {a,b} of edges.values()){const before=v3.len(v3.sub(vertices[a],vertices[b])),after=v3.len(v3.sub(points[a],points[b]));if(Math.abs(after-before)>before*.075){limited.add(a);limited.add(b);}}
      for(let i=0;i<faces.length;i++){const f=faces[i];if(v3.dot(originalNormals[i],v3.cross(v3.sub(points[f[1]],points[f[0]]),v3.sub(points[f[2]],points[f[0]])))<=0||f.length===4&&quadDiagonalQuality(points,f)<quadDiagonalQuality(vertices,f)-.024)for(const j of f)limited.add(j);}
      if(!limited.size)break;
      const near=new Set();for(const i of limited)for(const j of adjacency[i])if(!limited.has(j))near.add(j);
      for(const i of limited)offsets[i]*=.6;for(const i of near)offsets[i]*=.85;
    }
  }
  for(const factor of [1,.5,.25]){
    const points=vertices.map((p,i)=>offsets[i]===0?[...p]:v3.add(p,v3.scale(normals[i],offsets[i]*(stronger?1:strength)*factor)));
    let moved=0,maxMove=0;for(let i=0;i<points.length;i++){const d=v3.len(v3.sub(points[i],vertices[i]));if(d>diagonal*1e-10)moved++;maxMove=Math.max(maxMove,d);}if(!moved)break;
    // Local guards supplement the aggregate critic: no flipped faces, no new
    // strongly warped quads, and no more than 8% edge-length change anywhere.
    if([...edges.values()].some(({a,b})=>{const before=v3.len(v3.sub(vertices[a],vertices[b])),after=v3.len(v3.sub(points[a],points[b]));return Math.abs(after-before)>before*.08;}))continue;
    if(faces.some((f,i)=>v3.dot(originalNormals[i],v3.cross(v3.sub(points[f[1]],points[f[0]]),v3.sub(points[f[2]],points[f[0]])))<=0||f.length===4&&quadDiagonalQuality(points,f)<quadDiagonalQuality(vertices,f)-.025))continue;
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
    const candidate={...mesh,vertices:points,bounds:{lo,hi}},nextAudit=validate(candidate,audit.expectedComponents);
    if(!nextAudit.hardValid||nextAudit.foldedQuads>audit.foldedQuads)continue;
    const nextGrade=evaluate(candidate,source,sweeps),a=grade.metrics,b=nextGrade.metrics;
    if(fallback&&!(b.normalizedChamfer<fallback.grade.metrics.normalizedChamfer-1e-10))continue;
    if(a.railKinkMaxDegrees<=60&&a.railKinkP95Degrees<=25&&(b.railKinkMaxDegrees>60||b.railKinkP95Degrees>25))continue;
    if(!(b.normalizedChamfer<a.normalizedChamfer-1e-10)||nextGrade.scores.shape<grade.scores.shape||b.hardReferenceCoverage<a.hardReferenceCoverage||b.minimumAxialCoverage<a.minimumAxialCoverage||b.minimumSourceCoverage<a.minimumSourceCoverage||b.gapBridgeFaces>a.gapBridgeFaces||b.railKinkP95Degrees>a.railKinkP95Degrees+.5||b.railKinkMaxDegrees>a.railKinkMaxDegrees+1||b.densityRegularityScore<a.densityRegularityScore-1||nextGrade.scores.flow<grade.scores.flow-1)continue;
    Object.assign(report,{accepted:true,movedVertices:moved,maxDisplacement:maxMove,appliedStrength:strength*factor,reason:'Guarded surface fit accepted',beforeChamfer:a.normalizedChamfer,afterChamfer:b.normalizedChamfer});
    return {mesh:candidate,audit:nextAudit,grade:nextGrade,report};
  }
  return unchanged();
}

function curveV2LateEntryPlan(sweeps){
  if(sweeps.length<2||sweeps.length>8||sweeps.some(s=>s.frames.length<2))return null;
  const lengths=sweeps.map(s=>s.frames.slice(1).reduce((sum,f,i)=>sum+v3.len(v3.sub(f.c,s.frames[i].c)),0));
  let guide=0;for(let i=1;i<sweeps.length;i++)if(lengths[i]>lengths[guide])guide=i;
  const host=sweeps[guide],entries=[];
  for(let source=0;source<sweeps.length;source++)if(source!==guide){
    const p=sweeps[source].frames[0].c;let best={distance:Infinity};
    for(let i=0;i<host.frames.length-1;i++){const a=host.frames[i].c,b=host.frames[i+1].c,d=v3.sub(b,a),t=clamp(v3.dot(v3.sub(p,a),d)/Math.max(EPS,v3.dot(d,d))),distance=v3.len(v3.sub(p,v3.mix(a,b,t)));if(distance<best.distance)best={distance,parameter:sweepSegmentFraction(host,i,t)};}
    if(best.parameter>.25&&best.parameter<.9&&lengths[source]<lengths[guide]*.65&&qualitySweepInteraction(host,sweeps[source],0).actualOverlap)entries.push({source,...best});
  }
  return entries.length?{guide,entries}:null;
}

function curveV2LateEntryStations(sweeps,plan,count){
  const sourceMeshes=sweeps.map(sourceSweepMesh),bounds=boundsOf(sweeps),diagonal=v3.len(v3.sub(bounds.hi,bounds.lo)),tol=Math.max(1e-9,diagonal*1e-7),stations=[];
  for(let row=0;row<count;row++){
    const parameter=.001+(1-.001)*row/count,sample=sweepFrameAt(sweeps[plan.guide],parameter),frame={anchor:sample.c,t:sample.t,u:sample.x,v:sample.z},polygons=[];
    for(let source=0;source<sweeps.length;source++){
      const mesh=sourceMeshes[source],nodes=[],map=new Map(),edges=new Set(),key=p=>p.map(x=>Math.round(x/tol)).join(','),add=p=>{const k=key(p);if(map.has(k))return map.get(k);const i=nodes.length;nodes.push({p,neighbors:[]});map.set(k,i);return i;};
      for(const face of mesh.faces){const ps=face.map(i=>mesh.vertices[i]),ds=ps.map(p=>v3.dot(v3.sub(p,frame.anchor),frame.t)),hits=[];for(let i=0;i<3;i++){const j=(i+1)%3;if((ds[i]<0)!==(ds[j]<0))hits.push(v3.mix(ps[i],ps[j],ds[i]/(ds[i]-ds[j])));}if(hits.length===2){const a=add(hits[0]),b=add(hits[1]),k=a<b?`${a},${b}`:`${b},${a}`;if(a!==b&&!edges.has(k)){edges.add(k);nodes[a].neighbors.push(b);nodes[b].neighbors.push(a);}}}
      if(nodes.some(n=>n.neighbors.length!==2))throw new Error('Ambiguous late-entry cross-section');
      const unused=new Set(nodes.map((_,i)=>i));while(unused.size){const start=unused.values().next().value,ring=[];let prev=-1,current=start;do{if(!unused.delete(current))throw new Error('Non-simple late-entry cross-section');ring.push(nodes[current].p);const next=nodes[current].neighbors.find(i=>i!==prev);prev=current;current=next;}while(current!==start);
        // Curved guides can have a plane cut a distant part of the same hair.
        // Reject that remote sheet rather than connecting it to this station.
        const center=v3.scale(ring.reduce((a,p)=>v3.add(a,p),[0,0,0]),1/ring.length),host=sweeps[plan.guide];let nearest=0,best=Infinity;
        for(let i=0;i<host.frames.length-1;i++){const a=host.frames[i].c,d=v3.sub(host.frames[i+1].c,a),t=clamp(v3.dot(v3.sub(center,a),d)/Math.max(EPS,v3.dot(d,d))),distance=v3.len(v3.sub(center,v3.add(a,v3.scale(d,t))));if(distance<best){best=distance;nearest=sweepSegmentFraction(host,i,t);}}
        if(Math.abs(nearest-parameter)>.18)continue;
        polygons.push({source,vertices:ring.map(world=>({world,p:[v3.dot(world,frame.u),v3.dot(world,frame.v)]}))});
      }
    }
    stations.push({frame,polygons,parameter});
  }
  return stations;
}

function curveV2LateEntryJunction(parent,children,vertices){
  const n=parent.indices.length,half=n/2;
  if(n%2||children.some(c=>c.indices.length!==n))return null;
  const arc=(loop,start,direction=1)=>Array.from({length:half+1},(_,i)=>loop[(start+direction*i+n*2)%n]);
  const distance=(a,b)=>v3.dot(v3.sub(vertices[a],vertices[b]),v3.sub(vertices[a],vertices[b]));
  const strip=(a,b)=>Array.from({length:half},(_,i)=>[a[i],a[i+1],b[i+1],b[i]]),candidates=[];
  for(let start=0;start<n;start++){
    const arcs=[arc(parent.indices,start),arc(parent.indices,(start+half)%n)];
    const matches=children.map((child,k)=>{
      const result=[];
      for(let phase=0;phase<n;phase++)for(const direction of [1,-1]){
        const outer=arc(child.indices,phase,direction),inner=arc(child.indices,phase,-direction);
        // Both paths run from this parent arc's start to its end.
        result.push({outer,inner,cost:outer.reduce((s,v,i)=>s+distance(v,arcs[k][i]),0)});
      }
      return result.sort((a,b)=>a.cost-b.cost).slice(0,4);
    });
    for(const a of matches[0])for(const b of matches[1]){
      const innerB=[...b.inner].reverse(),faces=[...strip(arcs[0],a.outer),...strip(arcs[1],b.outer),...strip(a.inner,innerB),[arcs[0][0],a.inner[0],innerB[0]],[arcs[1][0],innerB[half],a.inner[half]]];
      const cost=a.cost+b.cost+a.inner.reduce((s,v,i)=>s+distance(v,innerB[i]),0);
      candidates.push({faces,cost});
    }
  }
  candidates.sort((a,b)=>a.cost-b.cost);
  // Preserve the original all-quad choice whenever one is valid. At a tight
  // split, the fixed section samples can make every quad correspondence fold.
  // Try explicit triangles only then, and test that exact triangulation before
  // returning it. Returning null immediately would invoke the generic matcher,
  // which does not check its inner seam for crossings. The full mesh still has
  // to pass the caller's manifold, intersection and source-coverage gates.
  for(const triangulate of [false,true])for(const candidate of candidates){
    const folded=f=>f.length===4&&quadDiagonalQuality(vertices,f,false)<=0;
    if(!triangulate&&candidate.faces.some(folded))continue;
    const faces=triangulate?candidate.faces.flatMap(f=>folded(f)?[[f[0],f[1],f[2]],[f[0],f[2],f[3]]]:[f]):candidate.faces;
    const used=[...new Set(faces.flat())],map=new Map(used.map((v,i)=>[v,i])),points=used.map(i=>vertices[i]),lo=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...points.map(p=>p[a])));
    const mesh={vertices:points,objFaces:faces.map(f=>f.map(i=>map.get(i))),bounds:{lo,hi}},scan=detectPenetrations(mesh);
    if(!scan.truncated&&!scan.trianglePairs)return faces;
  }
  return null;
}

function curveV2LateEntryPrepareContours(rows,frames,sweeps,options={}){
  const tracks=[],signature=c=>[...c.sources].sort((a,b)=>a-b).join(','),perimeter=ring=>ring.reduce((sum,p,i)=>sum+v3.len(v3.sub(p,ring[(i+1)%ring.length])),0);
  for(let row=0;row<rows.length;row++)for(const contour of rows[row]){
    const key=signature(contour),related=(a,b)=>[...a.sources].some(s=>b.sources.has(s)),candidates=row?rows[row-1].filter(c=>related(c,contour)):[],previous=candidates.length===1&&rows[row].filter(c=>related(candidates[0],c)).length===1?candidates:[];
    const track=previous.length===1?tracks[previous[0].phaseTrack]:{id:tracks.length,key,contours:[],rows:[]};
    if(!previous.length||previous.length>1)tracks.push(track);
    contour.phaseTrack=track.id;contour.sectionRow=row;track.contours.push(contour);track.rows.push(row);
  }
  const quantile=(xs,q)=>[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*q)];
  const size=tracks.map(t=>quantile(t.contours.map(c=>perimeter(c.rawRing)),.65)),spacing=Math.max(...size)/16;
  tracks.forEach((t,i)=>t.count=Math.max(8,Math.min(24,2*Math.round(size[i]/spacing/2))));
  if(options.profileBudget){const spacing=Math.max(...size)/options.profileBudget;tracks.forEach((t,i)=>t.count=Math.max(options.minimumCount||12,Math.min(options.profileBudget,2*Math.round(size[i]/spacing/2))));}
  const sourceBudgets=new Map();for(const t of tracks)if(!t.key.includes(','))sourceBudgets.set(t.key,Math.max(sourceBudgets.get(t.key)||0,t.count));
  for(const t of tracks)if(sourceBudgets.has(t.key))t.count=sourceBudgets.get(t.key);
  // A quad pair-of-pants requires Np=a+b, N0=a+s, N1=b+s.
  // Reserve four inner edges (two for the profile-preserving layout) and at
  // least two outer edges; use even counts so the
  // solution is integral. Shared tracks get the same budget at both ends.
  for(let pass=0;pass<8;pass++)for(let r=0;r<rows.length-1;r++)for(const [parents,children] of [[rows[r],rows[r+1]],[rows[r+1],rows[r]]])for(const p of parents){
    const cs=children.filter(c=>[...c.sources].some(s=>p.sources.has(s)));
    if(cs.length!==2||parents.some(q=>q!==p&&cs.some(c=>[...c.sources].some(s=>q.sources.has(s)))))continue;
    const pt=tracks[p.phaseTrack],a=tracks[cs[0].phaseTrack].count,b=tracks[cs[1].phaseTrack].count;
    pt.count=Math.max(Math.max(a,b),Math.abs(a-b)+4,Math.min(a+b-(options.profileBudget?4:8),pt.count));
  }
  if(options.fixedCount)for(const track of tracks)track.count=options.fixedCount;
  const nearest=(p,ring)=>{let best={distance:Infinity};let offset=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],d=v3.sub(b,a),length=v3.len(d),u=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,length*length)),point=v3.mix(a,b,u),distance=v3.len(v3.sub(p,point));if(distance<best.distance)best={distance,offset:offset+length*u};offset+=length;}return best;};
  const railHit=(source,profile,frame,center)=>{const s=sweeps[source],shape=s.profile[profile],points=s.frames.map(f=>sweepPoint(f,shape));let best;
    for(let i=0;i<points.length-1;i++){const a=v3.dot(v3.sub(points[i],frame.anchor),frame.t),b=v3.dot(v3.sub(points[i+1],frame.anchor),frame.t);if((a<0)===(b<0))continue;const p=v3.mix(points[i],points[i+1],a/(a-b)),distance=v3.len(v3.sub(p,center));if(!best||distance<best.distance)best={p,distance};}return best?.p;
  };
  for(const track of tracks){
    let anchor;
    for(const source of track.contours[0].sources)for(let profile=0;profile<sweeps[source].profile.length;profile++){
      let cost=0,hits=[];for(let i=0;i<track.rows.length;i++){const c=track.contours[i],point=railHit(source,profile,frames[track.rows[i]],c.center);if(!point){cost=Infinity;break;}const hit=nearest(point,c.rawRing);cost+=hit.distance/perimeter(c.rawRing);hits.push(hit);}
      // Equivalent exposed rails need a profile-space tie break, not floating
      // point noise in world-space distance. Prefer the +X/+Z shoulder.
      const shape=sweeps[source].profile[profile],landmark=shape[0]+shape[1];
      if(!anchor||cost<anchor.cost-1e-7||(Math.abs(cost-anchor.cost)<=1e-7&&landmark>anchor.landmark+1e-9))anchor={source,profile,cost,hits,landmark};
    }
    track.anchor={source:anchor.source,profile:anchor.profile,cost:anchor.cost};
    // Follow persistent exposed profile corners, not the arbitrary first edge
    // of each triangulated plane cut. Assign a corner to one lane for the
    // entire track; do not let lane identities switch from row to row.
    const landmarks=new Map();
    if(options.preserveFeatures&&Number.isFinite(anchor.cost)){
      const candidates=[];
      for(const source of track.contours[0].sources)for(let profile=0;profile<sweeps[source].profile.length;profile++){
        const shape=sweeps[source].profile,p=shape[profile],a=shape[(profile+shape.length-1)%shape.length],b=shape[(profile+1)%shape.length],u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]],turn=Math.acos(clamp((u[0]*v[0]+u[1]*v[1])/Math.max(1e-20,Math.hypot(...u)*Math.hypot(...v)),-1,1));
        if(turn<.25)continue;
        const offsets=[];let valid=true;
        for(let i=0;i<track.rows.length;i++){
          const c=track.contours[i],point=railHit(source,profile,frames[track.rows[i]],c.center),total=perimeter(c.rawRing);
          if(!point){valid=false;break;}const hit=nearest(point,c.rawRing);
          if(hit.distance>total*1e-5){valid=false;break;}
          offsets.push(((hit.offset-anchor.hits[i].offset)/total+1)%1);
        }
        if(!valid)continue;
        const mean=offsets.reduce((s,t)=>s+t,0)/offsets.length,lane=Math.round(mean*track.count)%track.count;
        if(!lane||offsets.some(t=>Math.abs(t-lane/track.count)>.4/track.count))continue;
        candidates.push({source,profile,lane,offsets,turn});
      }
      candidates.sort((a,b)=>b.turn-a.turn||a.source-b.source||a.profile-b.profile);
      for(const candidate of candidates)if(!landmarks.has(candidate.lane))landmarks.set(candidate.lane,candidate);
    }
    track.landmarks=[...landmarks.values()].map(({source,profile,lane})=>({source,profile,lane}));
    for(let i=0;i<track.contours.length;i++){
      const c=track.contours[i],raw=c.rawRing,lengths=raw.map((p,j)=>v3.len(v3.sub(p,raw[(j+1)%raw.length]))),total=lengths.reduce((a,b)=>a+b,0),offset=Number.isFinite(anchor.cost)?anchor.hits[i].offset:0;
      const ring=[],owners=[];for(let j=0;j<track.count;j++){let target=(offset+(landmarks.get(j)?.offsets[i]??j/track.count)*total)%total,edge=0;while(edge<raw.length-1&&target>lengths[edge])target-=lengths[edge++];ring.push(v3.mix(raw[edge],raw[(edge+1)%raw.length],target/Math.max(1e-20,lengths[edge])));owners.push(c.rawOwners[edge]);}
      c.ring=ring;c.owners=owners;c.center=v3.scale(ring.reduce((a,p)=>v3.add(a,p),[0,0,0]),1/ring.length);
    }
  }
  return tracks.map(t=>({sources:t.key,rows:t.rows,count:t.count,anchor:t.anchor,landmarks:t.landmarks}));
}

function curveV2LateEntryJunctionAdaptive(parent,children,vertices,options={}){
  if(!options.preserveRings){const anchored=curveV2LateEntryAnchoredJunction(parent,children,vertices);if(anchored)return anchored;}
  const np=parent.indices.length,ns=children.map(c=>c.indices.length),inner=(ns[0]+ns[1]-np)/2,outer=ns.map(n=>n-inner);
  if(!Number.isInteger(inner)||inner<1||outer.some(n=>n<1))return null;
  const arc=(loop,start,edges,direction=1)=>Array.from({length:edges+1},(_,i)=>loop[(start+direction*i+loop.length*2)%loop.length]);
  const distance=(a,b)=>v3.dot(v3.sub(vertices[a],vertices[b]),v3.sub(vertices[a],vertices[b]));
  const strip=(a,b)=>a.slice(1).map((_,i)=>[a[i],a[i+1],b[i+1],b[i]]),candidates=[];
  for(let start=0;start<np;start++){
    const arcs=[arc(parent.indices,start,outer[0]),arc(parent.indices,(start+outer[0])%np,outer[1])];
    const matches=children.map((child,k)=>{const result=[];for(let phase=0;phase<ns[k];phase++)for(const direction of [1,-1]){
      const path=arc(child.indices,phase,outer[k],direction),seam=arc(child.indices,phase,inner,-direction),cost=path.reduce((sum,v,i)=>sum+distance(v,arcs[k][i]),0);
      result.push({outer:path,inner:seam,cost});
    }return result.sort((a,b)=>a.cost-b.cost).slice(0,4);});
    for(const a of matches[0])for(const b of matches[1]){
      const opposite=[...b.inner].reverse(),faces=[...strip(arcs[0],a.outer),...strip(arcs[1],b.outer),...strip(a.inner,opposite),[arcs[0][0],a.inner[0],opposite[0]],[arcs[1][0],opposite[inner],a.inner[inner]]];
      candidates.push({faces,cost:a.cost+b.cost+a.inner.reduce((sum,v,i)=>sum+distance(v,opposite[i]),0)});
    }
  }
  candidates.sort((a,b)=>a.cost-b.cost);
  for(const triangulate of options.preserveRings?[false,true]:[false])for(const candidate of candidates){
    const folded=f=>f.length===4&&quadDiagonalQuality(vertices,f,false)<=0;
    if(!triangulate&&candidate.faces.some(folded))continue;
    const faces=triangulate?candidate.faces.flatMap(f=>folded(f)?[[f[0],f[1],f[2]],[f[0],f[2],f[3]]]:[f]):candidate.faces;
    const ids=[...new Set(faces.flat())],map=new Map(ids.map((id,i)=>[id,i])),points=ids.map(i=>vertices[i]),bounds={lo:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),hi:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))};
    const scan=detectPenetrations({vertices:points,objFaces:faces.map(f=>f.map(i=>map.get(i))),bounds});if(!scan.truncated&&!scan.trianglePairs)return faces;
  }
  return null;
}

function curveV2LateEntryAnchoredJunction(parent,children,vertices){
  const labels=parent.rawOwners.map(s=>children.findIndex(c=>c.sources.has(s))),transitions=labels.map((s,i)=>s!==labels[(i+labels.length-1)%labels.length]?i:-1).filter(i=>i>=0);
  if(transitions.length!==2||labels.some(s=>s<0))return null;
  const np=parent.indices.length,ns=children.map(c=>c.indices.length),inner=(ns[0]+ns[1]-np)/2,outer=ns.map(n=>n-inner);if(!Number.isInteger(inner)||inner<2||outer.some(n=>n<2))return null;
  const measure=ring=>{const lengths=ring.map((p,i)=>v3.len(v3.sub(p,ring[(i+1)%ring.length]))),offsets=[0];for(const d of lengths)offsets.push(offsets.at(-1)+d);return {ring,lengths,offsets,total:offsets.at(-1)};};
  const at=(m,s)=>{s=((s%m.total)+m.total)%m.total;let i=0;while(i<m.ring.length-1&&s>m.offsets[i+1])i++;return v3.mix(m.ring[i],m.ring[(i+1)%m.ring.length],(s-m.offsets[i])/Math.max(1e-20,m.lengths[i]));};
  const sample=(m,a,b,n,d=1)=>{const span=((d*(b-a)%m.total)+m.total)%m.total;return Array.from({length:n+1},(_,i)=>at(m,a+d*span*i/n));};
  const nearest=(p,m)=>{let best={distance:Infinity};for(let i=0;i<m.ring.length;i++){const a=m.ring[i],b=m.ring[(i+1)%m.ring.length],d=v3.sub(b,a),u=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,v3.dot(d,d))),distance=v3.len(v3.sub(p,v3.mix(a,b,u)));if(distance<best.distance)best={distance,offset:m.offsets[i]+u*m.lengths[i]};}return best;};
  const pm=measure(parent.rawRing),start=transitions.find(i=>labels[i]===0),end=transitions.find(i=>labels[i]===1),pa=sample(pm,pm.offsets[start],pm.offsets[end],outer[0]),pb=sample(pm,pm.offsets[end],pm.offsets[start],outer[1]),parentPaths=[pa,pb];
  const childPaths=children.map((c,k)=>{const m=measure(c.rawRing),a=nearest(parentPaths[k][0],m).offset,b=nearest(parentPaths[k].at(-1),m).offset,paths=[1,-1].map(d=>({outer:sample(m,a,b,outer[k],d),inner:sample(m,a,b,inner,-d)}));
    const cost=path=>path.outer.reduce((sum,p,i)=>sum+v3.len(v3.sub(p,parentPaths[k][i])),0);return cost(paths[0])<=cost(paths[1])?paths[0]:paths[1];});
  const targets=[pa.slice(0,-1).concat(pb.slice(0,-1)),...childPaths.map(c=>c.outer.slice(0,-1).concat([...c.inner].reverse().slice(0,-1)))],contours=[parent,...children],assignments=[];
  for(let k=0;k<3;k++){const target=targets[k],loop=contours[k].indices;let best;
    for(let phase=0;phase<loop.length;phase++)for(const direction of [1,-1]){const ids=target.map((_,i)=>loop[(phase+direction*i+loop.length*2)%loop.length]),cost=ids.reduce((sum,id,i)=>sum+v3.dot(v3.sub(vertices[id],target[i]),v3.sub(vertices[id],target[i])),0);if(!best||cost<best.cost)best={ids,cost};}assignments.push(best.ids);
  }
  const p=assignments[0],arcs=[p.slice(0,outer[0]+1),p.slice(outer[0]).concat(p[0])],outers=children.map((_,k)=>assignments[k+1].slice(0,outer[k]+1)),inners=children.map((_,k)=>[assignments[k+1][0],...assignments[k+1].slice(outer[k]).reverse()]);inners[1].reverse();
  const strip=(a,b)=>a.slice(1).map((_,i)=>[a[i],a[i+1],b[i+1],b[i]]),faces=[...strip(arcs[0],outers[0]),...strip(arcs[1],outers[1]),...strip(inners[0],inners[1]),[p[0],inners[0][0],inners[1][0]],[p[outer[0]],inners[1].at(-1),inners[0].at(-1)]],saved=new Map();
  assignments.forEach((ids,k)=>ids.forEach((id,i)=>{saved.set(id,vertices[id]);vertices[id]=targets[k][i];}));
  const ids=[...saved.keys()],map=new Map(ids.map((id,i)=>[id,i])),points=ids.map(id=>vertices[id]),bounds={lo:[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),hi:[0,1,2].map(a=>Math.max(...points.map(p=>p[a])))};
  const scan=detectPenetrations({vertices:points,objFaces:faces.map(f=>f.map(i=>map.get(i))),bounds});
  if(!scan.truncated&&!scan.trianglePairs&&faces.every(f=>f.length!==4||quadDiagonalQuality(vertices,f,false)>0))return faces;
  for(const [id,p] of saved)vertices[id]=p;return null;
}

function curveV2LateEntryTransport(rows,vertices){
  const tracks=new Map();for(const row of rows)for(const c of row){if(!tracks.has(c.phaseTrack))tracks.set(c.phaseTrack,[]);tracks.get(c.phaseTrack).push(c);}
  const measure=ring=>{const lengths=ring.map((p,i)=>v3.len(v3.sub(p,ring[(i+1)%ring.length]))),offsets=[0];for(const l of lengths)offsets.push(offsets.at(-1)+l);return {ring,lengths,offsets,total:offsets.at(-1)};};
  const locate=(p,m)=>{let best={distance:Infinity,offset:0};for(let i=0;i<m.ring.length;i++){const a=m.ring[i],b=m.ring[(i+1)%m.ring.length],d=v3.sub(b,a),t=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,v3.dot(d,d))),distance=v3.len(v3.sub(p,v3.mix(a,b,t)));if(distance<best.distance)best={distance,offset:(m.offsets[i]+t*m.lengths[i])/m.total};}return best.offset;};
  const sample=(m,t)=>{let s=((t%1)+1)%1*m.total,i=0;while(i<m.ring.length-1&&s>m.offsets[i+1])i++;return v3.mix(m.ring[i],m.ring[(i+1)%m.ring.length],(s-m.offsets[i])/Math.max(1e-20,m.lengths[i]));};
  for(const track of tracks.values()){
    const info=track.map(c=>{const m=measure(c.rawRing),base=c.ring.map(p=>locate(p,m)),delta=c.indices.map((id,i)=>{const d=locate(vertices[id],m)-base[i];return d-Math.round(d);}),changed=delta.some(d=>Math.abs(d)>1e-6);return {c,m,base,delta,changed};});
    for(let row=0;row<info.length;row++){
      const item=info[row];if(item.changed||item.c.sectionRow===0||item.c.sectionRow>=rows.length-2)continue;
      const anchors=info.map((other,j)=>({other,d:Math.abs(j-row)})).filter(a=>a.other.changed&&a.d<5);if(!anchors.length)continue;
      const weights=anchors.map(a=>(1-a.d/5)**2),sum=weights.reduce((a,b)=>a+b,0),delta=item.base.map((_,i)=>anchors.reduce((s,a,j)=>s+a.other.delta[i]*weights[j],0)/Math.max(1,sum));
      const targets=item.base.map((v,i)=>v+delta[i]);
      // Lane order must remain cyclic and positive, even at very thin edges.
      if(targets.some((t,i)=>{const before=(item.base[(i+1)%targets.length]-item.base[i]+1)%1,after=before+delta[(i+1)%targets.length]-delta[i];return after<before*.15;}))continue;
      item.c.indices.forEach((id,i)=>vertices[id]=sample(item.m,targets[i]));
    }
  }
}

function curveV2LateEntryRootLayout(mesh,rows){
  const roots=[];
  for(let row=1;row<rows.length;row++){
    const previous=new Set(rows[row-1].flatMap(c=>[...c.sources]));
    if(rows[row].some(c=>c.sources.size>1&&[...c.sources].some(s=>!previous.has(s))))roots.push(row);
  }
  if(!roots.length)return null;
  const original=mesh.vertices,vertices=original.map(p=>[...p]),metadata=new Map(),tracks=new Map(),adjacency=vertices.map(()=>new Set()),normals=vertices.map(()=>[0,0,0]);
  for(const face of mesh.objFaces){
    const n=v3.cross(v3.sub(original[face[1]],original[face[0]]),v3.sub(original[face.at(-1)],original[face[0]]));
    for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length];adjacency[a].add(b);adjacency[b].add(a);normals[a]=v3.add(normals[a],n);}
  }
  normals.forEach((n,i)=>normals[i]=v3.norm(n));
  for(const row of rows)for(const c of row){
    if(!tracks.has(c.phaseTrack))tracks.set(c.phaseTrack,[]);tracks.get(c.phaseTrack).push(c);
    c.indices.forEach((id,lane)=>metadata.set(id,{c,lane}));
  }
  const movable=[];
  for(const [id,{c,lane}]of metadata){
    const distance=Math.min(...roots.map(r=>Math.abs(r-c.sectionRow)));
    if(distance>=5||c.sectionRow<2||c.sectionRow>rows.length-4)continue;
    const track=tracks.get(c.phaseTrack),index=track.indexOf(c),previous=track[index-1]?.indices[lane],next=track[index+1]?.indices[lane];
    const lengths=[...adjacency[id]].map(j=>v3.len(v3.sub(original[id],original[j]))).sort((a,b)=>a-b);
    if(!lengths.length)continue;
    movable.push({id,previous,next,cap:lengths[Math.floor(lengths.length/2)]*.6,weight:(1-distance/5)**2});
  }
  for(let pass=0;pass<8;pass++){
    const old=vertices.map(p=>[...p]);
    for(const {id,previous,next,cap,weight}of movable){
      const neighbors=[...adjacency[id]],center=v3.scale(neighbors.reduce((a,j)=>v3.add(a,old[j]),[0,0,0]),1/neighbors.length);
      const target=previous!==undefined&&next!==undefined?v3.mix(center,v3.mix(old[previous],old[next],.5),.7):center;
      const raw=v3.sub(target,old[id]),tangent=v3.sub(raw,v3.scale(normals[id],v3.dot(raw,normals[id])));
      let point=v3.add(old[id],v3.scale(tangent,.15*weight)),delta=v3.sub(point,original[id]);
      if(v3.len(delta)>cap)point=v3.add(original[id],v3.scale(delta,cap/v3.len(delta)));
      vertices[id]=point;
    }
  }
  // Do not let any triangle turn inside-out relative to the validated patch.
  for(const f of mesh.objFaces)for(let i=1;i<f.length-1;i++){
    const normal=p=>v3.cross(v3.sub(p[f[i]],p[f[0]]),v3.sub(p[f[i+1]],p[f[0]]));
    if(v3.dot(normal(original),normal(vertices))<=0)return null;
  }
  // Supply our own triangle array: rebuilding must never append to the baseline.
  const result=rebuildEditedMesh({...mesh,faces:[]},vertices,mesh.objFaces,'late-entry-root-collar-layout');
  result.lateEntryRootLayout={roots,movableVertices:movable.length,maxDisplacement:Math.max(0,...movable.map(({id})=>v3.len(v3.sub(vertices[id],original[id]))))};
  return result;
}

function curveV2ReduceSectionRows(mesh,rows,reference){
  const budget={faces:reference.objFaces.length,triangles:reference.faces.length,vertices:reference.vertices.length},tracks=new Map();
  for(const row of rows)for(const contour of row){if(!tracks.has(contour.phaseTrack))tracks.set(contour.phaseTrack,[]);tracks.get(contour.phaseTrack).push(contour);}
  let current=mesh,removed=0;
  const counts=m=>({faces:m.objFaces.length,triangles:m.faces.length,vertices:new Set(m.objFaces.flat()).size}),within=m=>{const n=counts(m);return Object.keys(budget).every(k=>n[k]<=budget[k]);};
  const original=counts(mesh),diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo));
  while(!within(current)){
    const choices=[];
    for(const track of tracks.values())for(let i=1;i<track.length-1;i++){
      const a=track[i-1],b=track[i],d=track[i+1],n=b.indices.length;if(a.indices.length!==n||d.indices.length!==n)continue;
      const owners=c=>[...c.sources].sort((x,y)=>x-y).join(',');if(owners(a)!==owners(b)||owners(b)!==owners(d))continue;
      const middle=new Set(b.indices),allowed=new Set([...a.indices,...b.indices,...d.indices]),incident=current.objFaces.filter(f=>f.some(id=>middle.has(id)));
      if(incident.length!==2*n||incident.some(f=>f.length!==4||!f.every(id=>allowed.has(id))||f.filter(id=>middle.has(id)).length!==2))continue;
      const faces=a.indices.map((id,j)=>[id,a.indices[(j+1)%n],d.indices[(j+1)%n],d.indices[j]]);
      if(faces.some(f=>quadDiagonalQuality(current.vertices,f,false)<.5))continue;
      const errors=b.indices.map((id,j)=>{const p=current.vertices[a.indices[j]],q=current.vertices[d.indices[j]],v=v3.sub(q,p),t=clamp(v3.dot(v3.sub(current.vertices[id],p),v)/Math.max(1e-20,v3.dot(v,v)));return v3.len(v3.sub(current.vertices[id],v3.mix(p,q,t)));});
      const error=Math.max(...errors);if(error>diagonal*.012)continue;
      choices.push({track,i,middle,faces,error});
    }
    choices.sort((a,b)=>a.error-b.error);
    let accepted=false;
    for(const choice of choices){
      const faces=current.objFaces.filter(f=>!f.some(id=>choice.middle.has(id))).map(f=>[...f]).concat(choice.faces);
      orientFacesOutward(current.vertices,faces);
      const candidate=rebuildEditedMesh(current,current.vertices,faces,'source-budget-row-reduction'),scan=detectPenetrations(candidate);
      if(scan.truncated||scan.trianglePairs)continue;
      current=candidate;choice.track.splice(choice.i,1);removed++;accepted=true;break;
    }
    if(!accepted)break;
  }
  // Compact only once; contour indices above remain valid throughout reduction.
  const used=[...new Set(current.objFaces.flat())].sort((a,b)=>a-b),map=new Map(used.map((id,i)=>[id,i]));
  current=rebuildEditedMesh(current,used.map(id=>current.vertices[id]),current.objFaces.map(f=>f.map(id=>map.get(id))),'source-budget-row-reduction');
  const report={budget,before:original,after:counts(current),removedRows:removed,withinBudget:within(current)};
  current.sourceBudgetReduction=report;return {mesh:current,report};
}

function curveV2LateEntryFaceQuality(mesh){
  let warped=0,acute=0,thin=0;
  for(const f of mesh.objFaces)if(f.length===4){
    if(quadDiagonalQuality(mesh.vertices,f,false)<Math.cos(Math.PI/6))warped++;
    if(f.some((id,i)=>v3.dot(v3.norm(v3.sub(mesh.vertices[f[(i+3)%4]],mesh.vertices[id])),v3.norm(v3.sub(mesh.vertices[f[(i+1)%4]],mesh.vertices[id])))>Math.cos(Math.PI/9)))acute++;
    const lengths=f.map((id,i)=>v3.len(v3.sub(mesh.vertices[id],mesh.vertices[f[(i+1)%4]])));
    if(Math.max(...lengths)/Math.max(1e-20,Math.min(...lengths))>10)thin++;
  }
  return {warped,acute,thin};
}

async function curveUnionV2(sweeps,axialLoops=16,flowSmooth=.55,onProgress=()=>{},options={}){
  const now=()=>globalThis.performance?.now?.()??Date.now(),started=now(),timing={criticMs:0,validationMs:0,criticCalls:0};
  const gradeMesh=(...args)=>{const start=now();try{return options.accelerateCritic===false?globalThis.StrandRemesh.gradeMesh(...args):curveUnionV2GradeMesh(...args);}finally{timing.criticMs+=now()-start;timing.criticCalls++;}};
  const strictQualityAudit=(...args)=>{const start=now();try{return curveUnionV2AuditMesh(...args);}finally{timing.validationMs+=now()-start;}};
  if(!sweeps?.length)throw new Error('Load at least one visible strand.');
  const mergeDistance=clamp(options.mergeDistance===undefined?.03:Number(options.mergeDistance)||0,0,.75),graph=qualityOverlapGroups(sweeps,mergeDistance),meshes=[],reports=[];
  const loops=Math.max(10,Math.min(80,Math.round(axialLoops)));
  for(let i=0;i<graph.groups.length;i++){
    let group=graph.groups[i];onProgress(i/graph.groups.length,`Curve Union 2.0: group ${i+1}/${graph.groups.length}`);await new Promise(resolve=>setTimeout(resolve,0));
    if(group.length===1){meshes.push(sourceSweepMesh(group[0]));reports.push({strands:1,preserved:true});continue;}
    let lateEntry=options.lateEntrySections===false?null:curveV2LateEntryPlan(group);
    if(lateEntry){
      // Boundary tracing has deterministic tie breaks: give it a geometric
      // source order, not the file's arbitrary strand order. Do not mutate it.
      const length=s=>s.frames.slice(1).reduce((sum,f,i)=>sum+v3.len(v3.sub(f.c,s.frames[i].c)),0);
      group=[...group].sort((a,b)=>length(b)-length(a)||JSON.stringify(a.frames.map(f=>f.c)).localeCompare(JSON.stringify(b.frames.map(f=>f.c))));
      lateEntry=curveV2LateEntryPlan(group);
      // Never extend an accessory root back to the common crown. Use physical
      // sections only for this small, overlapping late-root configuration.
      const reference=buildSourceMesh(group),attempts=[];let accepted;
      const counts=[...new Set([Math.max(32,Math.min(52,loops*2)),32,48])];
      for(const count of counts){
        onProgress(i/graph.groups.length,`Curve Union 2.0: late-entry sections (${count} rows)`);
        await new Promise(resolve=>setTimeout(resolve,0));
        try{
          const stations=curveV2LateEntryStations(group,lateEntry,count);
          let mesh=repairFoldedQuads(sectionContourMesh(group,count,{sectionStations:stations,sectionJunctionBuilder:curveV2LateEntryJunction,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true}));
          let audit=strictQualityAudit(mesh,1);
          if(audit.penetrations.trianglePairs&&Number(options.collisionCleanupPasses)>0){mesh=repairFoldedQuads(untangleMesh(mesh,options.collisionCleanupPasses,options.collisionCleanupStrength));audit=strictQualityAudit(mesh,1);}
          attempts.push({rows:count,intersections:audit.penetrations.trianglePairs,hardValid:audit.hardValid});
          if(!audit.hardValid||audit.foldedQuads)continue;
          let grade=gradeMesh(mesh,reference,group),flowRefinement=null,layoutRows=null,rootLayout=null,profileFlowRefinement=null;
          if(!qualityGeometryAcceptable(grade)||grade.metrics.gapBridgeFaces)continue;
          if(options.lateEntryFlow!==false&&options.lateEntryProfileFlow!==false){
            try{
              let budgets;
              const fitted=repairFoldedQuads(sectionContourMesh(group,count,{sectionStations:stations,sectionPrepareContours:(rows,frames)=>{budgets=curveV2LateEntryPrepareContours(rows,frames,group,{profileBudget:20,preserveFeatures:true});},sectionJunctionBuilder:(parent,children,vertices)=>curveV2LateEntryJunctionAdaptive(parent,children,vertices,{preserveRings:true}),sectionPreservePhase:true,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true}));
              const checked=strictQualityAudit(fitted,1);
              if(checked.hardValid&&!checked.foldedQuads){
                const scored=gradeMesh(fitted,reference,group),a=grade.metrics,b=scored.metrics,before=curveV2LateEntryFaceQuality(mesh),after=curveV2LateEntryFaceQuality(fitted);
                // Stable source-rail correspondence must improve the visible
                // body, not merely pass a nonintersection test. Permit a small
                // worst-stretch trade for markedly better overall rail flow;
                // never trade away source coverage or add acute corners.
                const accepted=qualityGeometryAcceptable(scored)&&!b.gapBridgeFaces&&scored.scores.shape>=grade.scores.shape&&b.normalizedChamfer<=a.normalizedChamfer&&b.minimumSourceCoverage>=a.minimumSourceCoverage&&b.minimumAxialCoverage>=a.minimumAxialCoverage&&b.railKinkMaxDegrees<=a.railKinkMaxDegrees&&b.railKinkP95Degrees<=a.railKinkP95Degrees*.9&&b.transitionStretchMax<=a.transitionStretchMax*1.08&&after.warped<=before.warped*.75&&after.acute<=before.acute&&after.thin/Math.max(1,checked.validation.quads)<=before.thin/Math.max(1,audit.validation.quads)&&fitted.objFaces.length<=mesh.objFaces.length*1.6;
                profileFlowRefinement={accepted,budgets,before:{...before,railBend:a.railKinkMaxDegrees,railP95:a.railKinkP95Degrees,shape:grade.scores.shape},after:{...after,railBend:b.railKinkMaxDegrees,railP95:b.railKinkP95Degrees,shape:scored.scores.shape}};
                if(accepted){mesh=fitted;audit=checked;grade=scored;}
              }else profileFlowRefinement={accepted:false,reason:'Profile correspondence failed geometry audit'};
            }catch(error){profileFlowRefinement={accepted:false,reason:error.message};}
          }
          if(options.lateEntryFlow!==false&&!profileFlowRefinement?.accepted){
            let budgets;
            try{
              let fitted=repairFoldedQuads(sectionContourMesh(group,count,{sectionStations:stations,sectionPrepareContours:(rows,frames)=>{budgets=curveV2LateEntryPrepareContours(rows,frames,group);},sectionJunctionBuilder:curveV2LateEntryJunctionAdaptive,sectionFinalizeContours:(rows,vertices)=>{layoutRows=rows;curveV2LateEntryTransport(rows,vertices);},sectionPreservePhase:true,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true}));
              let checked=strictQualityAudit(fitted,1);
              if(checked.penetrations.trianglePairs&&Number(options.collisionCleanupPasses)>0){fitted=repairFoldedQuads(untangleMesh(fitted,options.collisionCleanupPasses,options.collisionCleanupStrength));checked=strictQualityAudit(fitted,1);}
              if(checked.hardValid&&!checked.foldedQuads){
                const scored=gradeMesh(fitted,reference,group),a=grade.metrics,b=scored.metrics,warp=m=>m.objFaces.filter(f=>f.length===4&&quadDiagonalQuality(m.vertices,f,false)<Math.cos(Math.PI/6)).length;
                if(qualityGeometryAcceptable(scored)&&!b.gapBridgeFaces&&b.normalizedChamfer<=a.normalizedChamfer*1.05&&b.minimumSourceCoverage>=a.minimumSourceCoverage-2&&b.minimumAxialCoverage>=a.minimumAxialCoverage&&b.railKinkMaxDegrees<=a.railKinkMaxDegrees+1&&b.railKinkP95Degrees<=a.railKinkP95Degrees+1&&b.illegalTrackTerminations<=a.illegalTrackTerminations&&b.badJunctionValence<=a.badJunctionValence+1&&warp(fitted)<=warp(mesh)&&checked.validation.triangles<=audit.validation.triangles&&(b.transitionStretchMax<a.transitionStretchMax*.9||b.railKinkP95Degrees<a.railKinkP95Degrees*.9)){
                  flowRefinement={accepted:true,budgets,before:{triangles:audit.validation.triangles,stretch:a.transitionStretchMax,railBend:a.railKinkMaxDegrees},after:{triangles:checked.validation.triangles,stretch:b.transitionStretchMax,railBend:b.railKinkMaxDegrees}};mesh=fitted;audit=checked;grade=scored;
                }
              }
            }catch(error){/* Keep the already validated physical-section mesh. */}
          }
          if(flowRefinement?.accepted&&layoutRows&&options.lateEntryRootLayout!==false){
            try{
              const candidate=curveV2LateEntryRootLayout(mesh,layoutRows);
              if(candidate){
                const checked=strictQualityAudit(candidate,1);
                if(checked.hardValid&&!checked.foldedQuads){
                  const scored=gradeMesh(candidate,reference,group),a=grade.metrics,b=scored.metrics,before=curveV2LateEntryFaceQuality(mesh),after=curveV2LateEntryFaceQuality(candidate);
                  // Flow-first but not shape-blind: allow a small fitting error,
                  // never a new hole, intersection, skinny quad or flow reversal.
                  if(qualityGeometryAcceptable(scored)&&!b.gapBridgeFaces&&b.normalizedChamfer<=a.normalizedChamfer*1.05&&scored.scores.shape>=grade.scores.shape-1&&b.minimumSourceCoverage>=a.minimumSourceCoverage-4&&b.minimumAxialCoverage>=a.minimumAxialCoverage&&b.railKinkMaxDegrees<=a.railKinkMaxDegrees*.95&&b.railKinkP95Degrees<=a.railKinkP95Degrees+.25&&b.transitionStretchMax<=a.transitionStretchMax&&b.illegalTrackTerminations<=a.illegalTrackTerminations&&b.badJunctionValence<=a.badJunctionValence&&after.warped<=before.warped&&after.acute<=before.acute&&after.thin<=before.thin){
                    rootLayout={accepted:true,...candidate.lateEntryRootLayout,before:{...before,railBend:a.railKinkMaxDegrees,stretch:a.transitionStretchMax},after:{...after,railBend:b.railKinkMaxDegrees,stretch:b.transitionStretchMax}};
                    mesh=candidate;audit=checked;grade=scored;
                  }
                }
              }
            }catch(error){/* Keep the validated baseline on unsupported layouts. */}
          }
          accepted={mesh,audit,grade,flowRefinement,rootLayout,profileFlowRefinement,rows:mesh.sectionContourCounts.length,sectionSources:mesh.sectionContourSources,stationParameters:stations.slice(0,mesh.sectionContourCounts.length).map(s=>s.parameter)};break;
        }catch(error){attempts.push({rows:count,error:error.message});}
      }
      if(!accepted)throw new Error('Curve Union 2.0 detected a strand starting partway down another, but could not build a safe late-entry junction at these settings. The original sweeps are unchanged.');
      // The dense correspondence pass is a construction aid, not permission
      // to export a mesh denser than the authored sweeps. Fit within all three
      // source budgets (polygons, rendered triangles, and vertices).
      const sourceBudget={faces:reference.objFaces.length,triangles:reference.faces.length,vertices:reference.vertices.length},withinBudget=m=>m.objFaces.length<=sourceBudget.faces&&m.faces.length<=sourceBudget.triangles&&m.vertices.length<=sourceBudget.vertices;
      if(!withinBudget(accepted.mesh)){
        let compact;
        const sourceRows=Math.max(...group.map(s=>s.frames.length));
        for(const count of [...new Set([Math.max(16,Math.min(32,sourceRows+1)),16])]){
          onProgress(i/graph.groups.length,`Curve Union 2.0: fitting source polygon budget (${sourceBudget.faces})`);await new Promise(resolve=>setTimeout(resolve,0));
          try{
            const stations=curveV2LateEntryStations(group,lateEntry,count);let rows;
            let candidate=repairFoldedQuads(sectionContourMesh(group,count,{sectionStations:stations,sectionPrepareContours:(rows,frames)=>curveV2LateEntryPrepareContours(rows,frames,group,{profileBudget:16,minimumCount:8,preserveFeatures:true}),sectionJunctionBuilder:(p,cs,v)=>curveV2LateEntryJunctionAdaptive(p,cs,v,{preserveRings:true}),sectionFinalizeContours:r=>rows=r,sectionPreservePhase:true,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true}));
            const reduced=curveV2ReduceSectionRows(candidate,rows,reference);candidate=reduced.mesh;
            if(!withinBudget(candidate))continue;
            const checked=strictQualityAudit(candidate,1);if(!checked.hardValid||checked.foldedQuads)continue;
            const scored=gradeMesh(candidate,reference,group);if(!qualityGeometryAcceptable(scored)||scored.metrics.gapBridgeFaces)continue;
            compact={...accepted,mesh:candidate,audit:checked,grade:scored,flowRefinement:null,profileFlowRefinement:null,rootLayout:null,sourceBudgetReduction:reduced.report,rows:candidate.sectionContourCounts.length,sectionSources:candidate.sectionContourSources,stationParameters:stations.slice(0,candidate.sectionContourCounts.length).map(s=>s.parameter)};break;
          }catch(error){attempts.push({budgetRows:count,error:error.message});}
        }
        if(!compact)throw new Error('Curve Union 2.0 could not build a safe late-entry mesh within the original sweep polygon budget. The original sweeps are unchanged.');
        accepted=compact;
      }
      accepted.mesh.sourceBudgetReduction=accepted.sourceBudgetReduction||{budget:sourceBudget,withinBudget:true,removedRows:0};
      meshes.push(accepted.mesh);reports.push({strands:group.length,layout:'late-entry physical sections',lateEntry:{...lateEntry,rows:accepted.rows,sectionSources:accepted.sectionSources,stationParameters:accepted.stationParameters,attempts,physicalContactsOnly:true,flowRefinement:accepted.flowRefinement,rootLayout:accepted.rootLayout,profileFlowRefinement:accepted.profileFlowRefinement},audit:accepted.audit,grade:accepted.grade,railFlowAccepted:accepted.grade.metrics.railKinkMaxDegrees<=60&&accepted.grade.metrics.railKinkP95Degrees<=25});continue;
    }
    const largeGroup=group.length>8;
    const sampled=group.map(sweep=>curveUnionV2Resample(sweep,loops)),aligned=options.alignJunctionStations===false?sampled:curveUnionV2AlignStations(sampled),reference=buildSourceMesh(group),candidates=[];
    // A small fixed deterministic set addresses the two supported seam-frame
    // choices; it never trains, randomizes, or invokes Curve Union.
    const junctionPlans=largeGroup?[true]:options.branchLedJunctions===undefined?(group.length>2?[false,true]:[false]):[Boolean(options.branchLedJunctions)];
    for(const branchLedJunctions of junctionPlans)for(const localNodeFrames of (largeGroup?[true]:[false,true])){
      onProgress(i/graph.groups.length,`Generating ${group.length}-strand group${largeGroup?' · bounded large-job mode':''}`);
      let candidate=repairFoldedQuads(curveUnionV2Atlas(aligned,loops,0,{...options,branchLedJunctions,localNodeFrames,contactPaddingRatio:mergeDistance}));
      let audit=strictQualityAudit(candidate,1);
      if(!largeGroup&&audit.penetrations.trianglePairs&&Number(options.collisionCleanupPasses)>0){
        const cleaned=repairFoldedQuads(untangleMesh(candidate,options.collisionCleanupPasses,options.collisionCleanupStrength)),cleanAudit=strictQualityAudit(cleaned,1);
        if(cleanAudit.penetrations.trianglePairs<audit.penetrations.trianglePairs&&!cleanAudit.zeroAreaFaces&&!cleanAudit.foldedQuads&&!cleanAudit.validation.boundaryEdges&&!cleanAudit.validation.nonManifoldEdges){candidate=cleaned;audit=cleanAudit;}
      }
      onProgress(i/graph.groups.length,`Grading ${group.length}-strand group`);
      let grade=gradeMesh(candidate,reference,group);
      // Prefer smoother, more evenly spaced rails with a bounded shape trade:
      // at most 5% volume change, small coverage-score losses, no invalid faces.
      if(!largeGroup&&flowSmooth>0&&audit.hardValid){
        for(const factor of [1,.5,.25]){
        const relaxed=curveUnionV2FairRails(candidate,group,clamp(flowSmooth)*factor),relaxedAudit=strictQualityAudit(relaxed,1);
        if(relaxedAudit.hardValid){const relaxedGrade=gradeMesh(relaxed,reference,group);
          if(relaxed.railFairing.after<relaxed.railFairing.before*.99&&Math.abs(1-relaxed.railFairing.volumeRatio)<=.05&&qualityGeometryAcceptable(relaxedGrade)&&!relaxedGrade.metrics.gapBridgeFaces&&relaxedGrade.scores.shape>=grade.scores.shape-4&&relaxedGrade.metrics.minimumAxialCoverage>=grade.metrics.minimumAxialCoverage-15&&relaxedGrade.metrics.minimumSourceCoverage>=grade.metrics.minimumSourceCoverage-10&&relaxedGrade.metrics.railKinkMaxDegrees<=grade.metrics.railKinkMaxDegrees+3&&relaxedGrade.metrics.railKinkP95Degrees<=grade.metrics.railKinkP95Degrees+1){candidate=relaxed;audit=relaxedAudit;grade=relaxedGrade;break;}
        }
        }
      }
      candidates.push({mesh:candidate,audit,grade,localNodeFrames,branchLedJunctions});
    }
    // Rebuild invalid multi-source forks from exposed, source-owned arcs.
    // Do not replace a valid existing layout merely for a higher shape score.
    if(!largeGroup&&group.length>2&&options.sourceOwnedJunctions!==false&&!candidates.some(c=>c.audit.hardValid&&!c.mesh.contactBoundaryViolations)){
      onProgress(i/graph.groups.length,'Curve Union 2.0: rebuilding exposed junction arcs');
      for(const localNodeFrames of [false,true])for(const ownedJunctionFlow of (options.ownedJunctionFlow===false?[false]:[false,.5,.25])){
        const mesh=repairFoldedQuads(curveUnionV2Atlas(aligned,loops,0,{...options,sourceOwnedJunctions:true,ownedJunctionFlow,junctionRailFit:0,branchLedJunctions:false,localNodeFrames,contactPaddingRatio:mergeDistance}));
        const audit=strictQualityAudit(mesh,1),grade=gradeMesh(mesh,reference,group);
        // An unsuccessful reconstruction is not an alternative preview.
        if(audit.hardValid&&!mesh.contactBoundaryViolations)candidates.push({mesh,audit,grade,localNodeFrames,ownedJunctionFlow,layout:ownedJunctionFlow?'source-owned flowing junction arcs':'source-owned junction arcs'});
      }
    }
    const cleanRails=candidate=>candidate.audit.hardValid&&candidate.grade.metrics.railKinkMaxDegrees<=60&&candidate.grade.metrics.railKinkP95Degrees<=25;
    // A height-envelope atlas cannot represent every stacked contact cleanly.
    // Escalate by measured rail shape, never by project identity. The contour
    // construction retains profile correspondence through the shared interval.
    if(group.length===2&&!candidates.some(cleanRails)){
      for(const density of [false,true])try{
        const mesh=repairFoldedQuads(profileContactSectionContourPairMesh(group,loops,{sectionRingCount:14,profileContactSourceDensity:density}));
        const audit=strictQualityAudit(mesh,1),grade=gradeMesh(mesh,reference,group);
        candidates.push({mesh,audit,grade,layout:density?'source-profile contours':'compact profile contours'});
      }catch(error){/* Unsupported contact patterns retain an audited atlas preview. */}
    }
    const usable=candidate=>!candidate.mesh.contactBoundaryViolations&&candidate.audit.hardValid&&qualityGeometryAcceptable(candidate.grade)&&!(candidate.grade.metrics.gapBridgeFaces>0);
    const referenceShape=Math.max(...candidates.filter(usable).map(candidate=>candidate.grade.scores.shape),0);
    const eligible=candidate=>usable(candidate)&&candidate.grade.scores.shape>=referenceShape-8;
    candidates.sort((a,b)=>(a.mesh.contactBoundaryViolations||0)-(b.mesh.contactBoundaryViolations||0)||Number(eligible(b))-Number(eligible(a))||Number(b.audit.hardValid)-Number(a.audit.hardValid)||a.audit.penetrations.trianglePairs-b.audit.penetrations.trianglePairs||
      (b.grade.metrics.contactLocalityScore||0)-(a.grade.metrics.contactLocalityScore||0)||
      Number(cleanRails(b))-Number(cleanRails(a))||
      // In the reconstructed family, balance the widespread turns against the
      // worst turn so a fractional cap-angle difference cannot veto better flow.
      (a.layout?.startsWith('source-owned')&&b.layout?.startsWith('source-owned')?
        a.grade.metrics.railKinkP95Degrees-b.grade.metrics.railKinkP95Degrees+.2*(a.grade.metrics.railKinkMaxDegrees-b.grade.metrics.railKinkMaxDegrees):0)||
      (a.grade.metrics.railKinkMaxDegrees-b.grade.metrics.railKinkMaxDegrees)||
      (a.grade.metrics.railKinkP95Degrees-b.grade.metrics.railKinkP95Degrees)||a.audit.validation.faces-b.audit.validation.faces);
    let selected=candidates[0];
    // One bounded fit of the winning reconstructed layout, not a larger search.
    // Keep the original candidate if any geometry/contact/shape guard fails.
    const fitStrength=options.junctionRailFit===false?0:clamp(options.junctionRailFit===undefined?Math.min(.5,.5*clamp(flowSmooth)/.55):Number(options.junctionRailFit)||0,0,1);
    if(!largeGroup&&group.length>2&&fitStrength>0&&selected.audit.hardValid&&selected.layout?.startsWith('source-owned')){
      onProgress(i/graph.groups.length,'Curve Union 2.0: fitting continuous junction rails');
      const preFlow=selected.ownedJunctionFlow===false?false:.5;
      const fitted=repairFoldedQuads(curveUnionV2Atlas(aligned,loops,0,{...options,sourceOwnedJunctions:true,ownedJunctionFlow:preFlow,branchLedJunctions:false,localNodeFrames:selected.localNodeFrames,contactPaddingRatio:mergeDistance,junctionRailFit:fitStrength,junctionRowPhase:0}));
      const audit=strictQualityAudit(fitted,1);
      // The atlas already uses diagonal repair. Permit at most one additional
      // quad split, not a triangle-heavy workaround for a poor fitted surface.
      if(audit.hardValid&&!audit.foldedQuads&&!fitted.contactBoundaryViolations&&audit.validation.triangles<=selected.audit.validation.triangles+2){
        const grade=gradeMesh(fitted,reference,group),before=selected.grade.metrics,after=grade.metrics;
        const warpCount=m=>m.objFaces.filter(f=>f.length===4&&quadDiagonalQuality(m.vertices,f,false)<Math.cos(Math.PI/6)).length;
        if(qualityGeometryAcceptable(grade)&&!after.gapBridgeFaces&&
          JSON.stringify(fitted.contactBoundaryAudit)===JSON.stringify(selected.mesh.contactBoundaryAudit)&&
          grade.scores.shape>=selected.grade.scores.shape-4&&after.hardReferenceCoverage>=before.hardReferenceCoverage-8&&
          after.minimumSourceCoverage>=before.minimumSourceCoverage-10&&after.minimumAxialCoverage>=before.minimumAxialCoverage-15&&
          after.railKinkP95Degrees<before.railKinkP95Degrees*.95&&after.railKinkMaxDegrees<=before.railKinkMaxDegrees+1&&
          audit.worstQuadNormalDot>=selected.audit.worstQuadNormalDot-1e-6&&warpCount(fitted)<=warpCount(selected.mesh)){
          fitted.junctionRailFit={...fitted.junctionRailFit,strength:fitStrength,beforeP95:before.railKinkP95Degrees,afterP95:after.railKinkP95Degrees};
          selected={...selected,ownedJunctionFlow:preFlow,mesh:fitted,audit,grade,layout:'source-owned coupled junction rails'};
        }
      }
    }
    // A single direction-constrained spacing candidate follows the accepted
    // rail fit. Failure retains that fit, never the older unfitted candidate.
    if(selected.mesh.junctionRailFit&&options.junctionRowPhase!==false){
      onProgress(i/graph.groups.length,'Curve Union 2.0: aligning cross-loop spacing');
      const phaseStrength=Math.min(.25,fitStrength*.5);
      const phased=repairFoldedQuads(curveUnionV2Atlas(aligned,loops,0,{...options,sourceOwnedJunctions:true,ownedJunctionFlow:selected.ownedJunctionFlow,branchLedJunctions:false,localNodeFrames:selected.localNodeFrames,contactPaddingRatio:mergeDistance,junctionRailFit:fitStrength,junctionRowPhase:phaseStrength}));
      const audit=strictQualityAudit(phased,1),phase=phased.junctionRailFit?.rowPhase;
      if(phase&&phase.afterRms<phase.beforeRms&&audit.hardValid&&!audit.foldedQuads&&!phased.contactBoundaryViolations&&audit.validation.triangles<=selected.audit.validation.triangles){
        const grade=gradeMesh(phased,reference,group),before=selected.grade.metrics,after=grade.metrics;
        const warpCount=m=>m.objFaces.filter(f=>f.length===4&&quadDiagonalQuality(m.vertices,f,false)<Math.cos(Math.PI/6)).length;
        if(qualityGeometryAcceptable(grade)&&!after.gapBridgeFaces&&
          JSON.stringify(phased.contactBoundaryAudit)===JSON.stringify(selected.mesh.contactBoundaryAudit)&&
          grade.scores.shape>=selected.grade.scores.shape-1&&after.hardReferenceCoverage>=before.hardReferenceCoverage-2&&
          after.minimumSourceCoverage>=before.minimumSourceCoverage-2&&after.minimumAxialCoverage>=before.minimumAxialCoverage-2&&
          after.railKinkP95Degrees<before.railKinkP95Degrees*.97&&after.railKinkMaxDegrees<=before.railKinkMaxDegrees+1&&
          audit.worstQuadNormalDot>=selected.audit.worstQuadNormalDot-.005&&warpCount(phased)<=warpCount(selected.mesh)){
          phased.junctionRailFit={...selected.mesh.junctionRailFit,rowPhase:phase};
          selected={...selected,mesh:phased,audit,grade,layout:'source-owned phase-aligned junction rails'};
        }
      }
    }
    if(!largeGroup&&options.dissolveTrianglePairs!==false&&selected.audit.hardValid){
      const dissolved=curveUnionV2DissolveTriangles(selected.mesh,group);
      if(dissolved!==selected.mesh){const audit=strictQualityAudit(dissolved,1);if(audit.hardValid){selected.mesh=dissolved;selected.audit=audit;selected.grade=gradeMesh(dissolved,reference,group);}}
    }
    // Experimental only: the isolated cross-loop fit regressed the surrounding
    // junction visually. Keep the reviewed cavity layout as the app default.
    if(!largeGroup&&selected.mesh.junctionRailFit&&options.junctionFlowTemplate===true&&selected.audit.hardValid){
      onProgress(i/graph.groups.length,'Curve Union 2.0: routing junction cross-loops');
      for(const routed of curveUnionV2JunctionFlowCandidates(selected.mesh)){
        const audit=strictQualityAudit(routed,1);if(!audit.hardValid||audit.foldedQuads)continue;
        const grade=gradeMesh(routed,reference,group),before=selected.grade.metrics,after=grade.metrics;
        if(!qualityGeometryAcceptable(grade)||after.gapBridgeFaces||grade.scores.shape<selected.grade.scores.shape||
          after.hardReferenceCoverage<before.hardReferenceCoverage-1||after.minimumSourceCoverage<before.minimumSourceCoverage-1||after.minimumAxialCoverage<before.minimumAxialCoverage-1||
          after.railKinkP95Degrees>before.railKinkP95Degrees||after.railKinkMaxDegrees>before.railKinkMaxDegrees+1||
          audit.worstQuadNormalDot<selected.audit.worstQuadNormalDot-1e-6||after.badJunctionValence>before.badJunctionValence||after.illegalTrackTerminations>before.illegalTrackTerminations)continue;
        selected={...selected,mesh:routed,audit,grade,layout:'source-owned continuous cross-loop junction'};break;
      }
    }
    if(!largeGroup&&!selected.mesh.junctionFlowTemplate&&selected.mesh.junctionRailFit&&options.junctionPatch!==false&&selected.audit.hardValid){
      onProgress(i/graph.groups.length,'Curve Union 2.0: simplifying pinched junction patches');
      for(const patched of curveUnionV2JunctionPatchCandidates(selected.mesh,group)){
        const audit=strictQualityAudit(patched,1);if(!audit.hardValid||audit.foldedQuads)continue;
        const grade=gradeMesh(patched,reference,group),before=selected.grade.metrics,after=grade.metrics;
        if(!qualityGeometryAcceptable(grade)||after.gapBridgeFaces||grade.scores.shape<selected.grade.scores.shape||
          after.hardReferenceCoverage<before.hardReferenceCoverage-1||after.minimumSourceCoverage<before.minimumSourceCoverage-1||after.minimumAxialCoverage<before.minimumAxialCoverage-1||
          after.railKinkP95Degrees>before.railKinkP95Degrees||after.railKinkMaxDegrees>before.railKinkMaxDegrees+1||
          audit.worstQuadNormalDot<selected.audit.worstQuadNormalDot-1e-6||after.badJunctionValence>before.badJunctionValence||after.illegalTrackTerminations>before.illegalTrackTerminations)continue;
        selected={...selected,mesh:patched,audit,grade,layout:'source-owned simplified junction patch'};break;
      }
    }
    // Keep this bounded retile experimental: the visually promising fixture
    // candidate overloads a seven-edge pole and is correctly rejected below.
    if(!largeGroup&&selected.mesh.junctionPatch&&options.junctionPoleRouting===true&&selected.audit.hardValid){
      onProgress(i/graph.groups.length,'Curve Union 2.0: staggering junction terminations');
      for(const routed of curveUnionV2StaggerJunctionPoles(selected.mesh)){
        const audit=strictQualityAudit(routed,1);if(!audit.hardValid||audit.foldedQuads||audit.sliverTriangles>selected.audit.sliverTriangles)continue;
        const grade=gradeMesh(routed,reference,group),before=selected.grade.metrics,after=grade.metrics;
        const warpCount=m=>m.objFaces.filter(f=>f.length===4&&quadDiagonalQuality(m.vertices,f,false)<Math.cos(Math.PI/6)).length;
        if(!qualityGeometryAcceptable(grade)||after.gapBridgeFaces||grade.scores.shape<selected.grade.scores.shape||
          after.hardReferenceCoverage<before.hardReferenceCoverage||after.minimumSourceCoverage<before.minimumSourceCoverage||after.minimumAxialCoverage<before.minimumAxialCoverage||
          after.railKinkP95Degrees>before.railKinkP95Degrees||after.railKinkMaxDegrees>before.railKinkMaxDegrees+1||
          audit.worstQuadNormalDot<selected.audit.worstQuadNormalDot-1e-6||warpCount(routed)>warpCount(selected.mesh)||
          after.badJunctionValence>before.badJunctionValence||after.illegalTrackTerminations>before.illegalTrackTerminations)continue;
        selected={...selected,mesh:routed,audit,grade,layout:'source-owned staggered junction terminations'};break;
      }
    }
    meshes.push(selected.mesh);reports.push({strands:group.length,layout:selected.layout||(selected.branchLedJunctions?'branch-led continuous rows':'persistent branch rails'),localNodeFrames:selected.localNodeFrames,junctionRailFit:selected.mesh.junctionRailFit||null,junctionFlowTemplate:selected.mesh.junctionFlowTemplate||null,junctionPatch:selected.mesh.junctionPatch||null,junctionPoleRouting:selected.mesh.junctionPoleRouting||null,reducedRailVertices:selected.mesh.reducedRailVertices||0,railTerminationRuns:selected.mesh.railTerminationRuns||0,railFairing:selected.mesh.railFairing||null,dissolvedTrianglePairs:selected.mesh.dissolvedTrianglePairs||0,audit:selected.audit,grade:selected.grade,railFlowAccepted:cleanRails(selected)});
  }
  onProgress(.95,'Final geometry validation');
  let result=combineMeshes(meshes),audit=meshes.length===1&&reports[0].audit?reports[0].audit:strictQualityAudit(result,graph.groups.length),grade=meshes.length===1&&reports[0].grade?reports[0].grade:gradeMesh(result,buildSourceMesh(sweeps),sweeps);
  result.contactBoundaryViolations=meshes.reduce((sum,m)=>sum+(m.contactBoundaryViolations||0),0);
  result.contactBoundaryAudit=meshes.flatMap(m=>m.contactBoundaryAudit||[]);
  result.junctionProtectedPositions=meshes.flatMap(m=>m.junctionProtectedPositions||[]);
  result.junctionFlowNeighborhoods=meshes.flatMap(m=>m.junctionFlowNeighborhoods||[]);
  if(Number(options.volumeRecovery)>0){onProgress(.97,'Recovering volume without changing topology');const recovered=curveUnionV2RecoverVolume(result,sweeps,options.volumeRecovery,audit,grade,gradeMesh,strictQualityAudit);result=recovered.mesh;audit=recovered.audit;grade=recovered.grade;result.volumeRecovery=recovered.report;}
  result.topologyMode='curve-union-v2';result.generationStrategy='curve-union-v2';result.expectedComponents=graph.groups.length;
  result.curveUnionV2Audit=audit;result.curveUnionV2Grade=grade;result.curveUnionV2Groups=reports;
  result.curveUnionV2RailFlowAccepted=reports.every(report=>report.preserved||report.railFlowAccepted);
  const sourceMesh=buildSourceMesh(sweeps),sourceCounts={polygons:sourceMesh.objFaces.length,triangles:sourceMesh.faces.length,vertices:sourceMesh.vertices.length},resultCounts={polygons:result.objFaces.length,triangles:result.faces.length,vertices:result.vertices.length};
  result.curveUnionV2SourceBudget={source:sourceCounts,result:resultCounts,withinBudget:Object.keys(sourceCounts).every(k=>resultCounts[k]<=sourceCounts[k]),removedRows:meshes.reduce((sum,m)=>sum+(m.sourceBudgetReduction?.removedRows||0),0)};
  result.curveUnionV2ExportSafe=result.curveUnionV2SourceBudget.withinBudget&&!result.contactBoundaryViolations&&audit.hardValid&&qualityGeometryAcceptable(grade)&&!(grade.metrics.gapBridgeFaces>0);
  result.curveUnionV2Notes=['Supported front/back junction','Width-adaptive rail termination','Surface-constrained branch transition','Physical cross-strand station alignment','Geometry-driven contact contour fallback','Surface-tested groups'];
  onProgress(1,result.curveUnionV2ExportSafe?'Curve Union 2.0 ready':'Curve Union 2.0 preview: geometry checks require review');
  if(typeof options.onTiming==='function'){const totalMs=now()-started;options.onTiming({...timing,totalMs,constructionAndOtherMs:Math.max(0,totalMs-timing.criticMs-timing.validationMs)});}
  return result;
}

function curveV3Quality(mesh){
  const base=curveV2LateEntryFaceQuality(mesh);let energy=0,quads=0,corner=0;
  for(const f of mesh.objFaces)if(f.length===4){
    quads++;const p=f.map(i=>mesh.vertices[i]),warp=1-quadDiagonalQuality(mesh.vertices,f,false);
    let skew=0;for(let i=0;i<4;i++){const a=v3.norm(v3.sub(p[(i+3)%4],p[i])),b=v3.norm(v3.sub(p[(i+1)%4],p[i]));skew+=v3.dot(a,b)**2;}
    const e=p.map((x,i)=>v3.len(v3.sub(x,p[(i+1)%4]))),stretch=Math.log(Math.max(e[0],e[2])/Math.max(1e-12,Math.min(e[0],e[2])))**2+Math.log(Math.max(e[1],e[3])/Math.max(1e-12,Math.min(e[1],e[3])))**2;
    corner+=skew;energy+=warp*3+skew*.25+stretch*.2;
  }
  return {...base,energy:energy/Math.max(1,quads),corner:corner/Math.max(1,quads)};
}

function curveV3FitSectionLoops(mesh,sweeps,strength,audit,grade,evaluate=curveUnionV2GradeMesh,validate=curveUnionV2AuditMesh){
  const report={attempted:false,accepted:false,movedVertices:0,reason:'No eligible closed quad rings'};
  const unchanged=()=>({mesh,audit,grade,report});
  strength=clamp(Number(strength)||0,0,2);
  if(!strength||!audit.hardValid||audit.foldedQuads||!sweeps.length||sweeps.length>8||mesh.vertices.length>4000)return unchanged();
  if(sweeps.reduce((sum,s)=>sum+sourceSweepMesh(s).faces.length,0)>40000){report.reason='Section fitting skipped for large source mesh';return unchanged();}
  report.attempted=true;
  const p=mesh.vertices,adj=p.map(()=>new Set()),cross=p.map(()=>new Set()),fixed=new Set(),edges=new Map(),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  const diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo)),positionKey=p=>p.map(x=>Math.round(x*1e8)).join(','),pins=new Set((mesh.junctionProtectedPositions||[]).map(positionKey));
  for(const rail of [...(mesh.v3StructuralSeams?.rails||[]),...(mesh.v3StructuralSeams?.supports||[])])for(const i of rail.vertices)fixed.add(i);
  for(const i of mesh.v3PairwiseComposition?.baseVertexMap||[])fixed.add(i);
  for(const f of mesh.objFaces){if(f.length!==4)for(const i of f)fixed.add(i);for(let k=0;k<f.length;k++){const a=f[k],b=f[(k+1)%f.length];adj[a].add(b);adj[b].add(a);const e=key(a,b);edges.set(e,(edges.get(e)||0)+1);}}
  const segments=sweeps.flatMap(s=>s.frames.slice(1).map((b,i)=>({a:s.frames[i],b})));
  const tangents=p.map((point,i)=>{
    if(adj[i].size!==4||pins.has(positionKey(point)))fixed.add(i);
    let best=Infinity,tangent;
    for(const {a,b} of segments){const d=v3.sub(b.c,a.c),u=clamp(v3.dot(v3.sub(point,a.c),d)/Math.max(1e-20,v3.dot(d,d))),distance=v3.len(v3.sub(point,v3.mix(a.c,b.c,u)));if(distance<best){best=distance;tangent=v3.norm(v3.mix(a.t,b.t,u));}}
    return tangent;
  });
  for(const [e,count] of edges){const [a,b]=e.split(',').map(Number);if(count!==2){fixed.add(a);fixed.add(b);}const d=v3.norm(v3.sub(p[b],p[a]));if(Math.abs(v3.dot(d,tangents[a]))<.65&&Math.abs(v3.dot(d,tangents[b]))<.65){cross[a].add(b);cross[b].add(a);}}
  const visited=new Set(),rings=[];
  for(let i=0;i<p.length;i++)if(!visited.has(i)){
    const ids=[],stack=[i];while(stack.length){const j=stack.pop();if(visited.has(j))continue;visited.add(j);ids.push(j);stack.push(...cross[j]);}
    if(ids.length>=6&&ids.every(j=>cross[j].size===2&&!fixed.has(j)))rings.push(ids);
  }
  if(!rings.length)return unchanged();
  const triangles=[];
  sweeps.forEach((s,owner)=>{const source=sourceSweepMesh(s);for(const f of source.faces){const [a,b,c]=f.map(i=>source.vertices[i]);triangles.push({owner,a,ab:v3.sub(b,a),ac:v3.sub(c,a)});}});
  const ringOf=new Map();rings.forEach((r,i)=>r.forEach(j=>ringOf.set(j,i)));
  const data=rings.map(ids=>{
    const center=v3.scale(ids.reduce((sum,j)=>v3.add(sum,p[j]),[0,0,0]),1/ids.length),tangent=v3.norm(ids.reduce((sum,j)=>v3.add(sum,tangents[j]),[0,0,0]));
    const radial=ids.map(j=>{const d=v3.sub(p[j],center);return v3.sub(d,v3.scale(tangent,v3.dot(d,tangent)));});
    let matches=0;const targets=ids.map(()=>0);
    ids.forEach((j,k)=>{const radius=v3.len(radial[k]);if(radius<diagonal*1e-6)return;const direction=v3.scale(radial[k],1/radius);let best=Infinity;
      for(const t of triangles){const h=v3.cross(direction,t.ac),det=v3.dot(t.ab,h);if(Math.abs(det)<1e-12)continue;const s=v3.sub(p[j],t.a),u=v3.dot(s,h)/det;if(u<0||u>1)continue;const q=v3.cross(s,t.ab),v=v3.dot(direction,q)/det;if(v<0||u+v>1)continue;const distance=v3.dot(t.ac,q)/det;
        if(distance< -diagonal*1e-6||distance>Math.min(radius*.3,diagonal*.04)||distance>=best)continue;
        const hit=v3.add(p[j],v3.scale(direction,distance));if(sweeps.some((s,owner)=>owner!==t.owner&&sweepDistance(hit,s)<-diagonal*1e-5))continue;best=Math.max(0,distance);
      }
      if(Number.isFinite(best)){matches++;targets[k]=Math.min(.25,best/radius);}
    });
    return {ids,radial,targets:matches>=ids.length*.6?targets:ids.map(()=>0)};
  });
  const targets=p.map(()=>0);data.forEach(r=>r.ids.forEach((j,k)=>{targets[j]=r.targets[k];}));let scales=[...targets];
  // Solve one smooth radial expansion field over the connected ring lattice.
  // Zero displacement outside the selected rings provides fixed end collars.
  for(let pass=0;pass<8;pass++)scales=scales.map((s,i)=>ringOf.has(i)?.8*targets[i]+.2*[...adj[i]].reduce((sum,j)=>sum+scales[j],0)/adj[i].size:0);
  report.rings=rings.length;
  const source=buildSourceMesh(sweeps),quality=curveV3Quality(mesh);
  for(const factor of [1,.5,.25,.125]){
    const points=p.map(v=>[...v]);data.forEach(r=>r.ids.forEach((j,k)=>{points[j]=v3.add(p[j],v3.scale(r.radial[k],scales[j]*Math.min(1,strength)*factor));}));
    if(mesh.faces.some(f=>{const n=ps=>v3.cross(v3.sub(ps[f[1]],ps[f[0]]),v3.sub(ps[f[2]],ps[f[0]]));return v3.dot(n(p),n(points))<=0;}))continue;
    if([...edges.keys()].some(e=>{const [a,b]=e.split(',').map(Number),before=v3.len(v3.sub(p[a],p[b])),after=v3.len(v3.sub(points[a],points[b]));return Math.abs(after-before)>before*.25;}))continue;
    const candidate={...mesh,vertices:points,bounds:{lo:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),hi:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))}};
    const q=curveV3Quality(candidate);if(q.warped>quality.warped||q.acute>quality.acute||q.thin>quality.thin||q.energy>quality.energy*1.15)continue;
    const checked=validate(candidate,audit.expectedComponents);if(!checked.hardValid||checked.foldedQuads||checked.penetrations?.truncated)continue;
    const scored=evaluate(candidate,source,sweeps),a=grade.metrics,b=scored.metrics;
    if(!(b.normalizedChamfer<a.normalizedChamfer*.995)||scored.scores.shape<grade.scores.shape||b.hardReferenceCoverage<a.hardReferenceCoverage||b.minimumSourceCoverage<a.minimumSourceCoverage||b.minimumAxialCoverage<a.minimumAxialCoverage||b.gapBridgeFaces>a.gapBridgeFaces||b.railKinkP95Degrees>a.railKinkP95Degrees+1||b.railKinkMaxDegrees>a.railKinkMaxDegrees+2||b.densityRegularityScore<a.densityRegularityScore-2||scored.scores.flow<grade.scores.flow-1)continue;
    Object.assign(report,{accepted:true,reason:'Coherent cross-section fit accepted',appliedStrength:Math.min(1,strength)*factor,movedVertices:points.filter((v,i)=>v3.len(v3.sub(v,p[i]))>diagonal*1e-10).length,beforeChamfer:a.normalizedChamfer,afterChamfer:b.normalizedChamfer});
    return {mesh:candidate,audit:checked,grade:scored,report};
  }
  report.reason='Section-loop candidates did not improve fit within geometry and flow guards';return unchanged();
}

function curveV3ThinStripCandidates(mesh,sweeps,protectedPositions=new Set(),terminalOnly=false){
  const p=mesh.vertices,faces=mesh.objFaces,edges=new Map(),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  const diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo)),fixed=new Set();
  faces.forEach((f,fi)=>f.forEach((a,i)=>{const b=f[(i+1)%f.length],k=key(a,b);if(!edges.has(k))edges.set(k,{a,b,uses:[],links:new Set()});edges.get(k).uses.push(fi);}));
  for(const e of edges.values())if(e.uses.length!==2){fixed.add(e.a);fixed.add(e.b);}
  for(let i=0;i<p.length;i++)if(protectedPositions.has(p[i].join(','))||sweeps.some(s=>v3.len(v3.sub(p[i],s.frames.at(-1).c))<diagonal*.02))fixed.add(i);
  const normals=faces.map(f=>v3.norm(f.slice(1,-1).reduce((n,_,i)=>v3.add(n,v3.cross(v3.sub(p[f[i+1]],p[f[0]]),v3.sub(p[f[i+2]],p[f[0]]))),[0,0,0])));
  const eligible=new Set();
  for(const f of faces)if(f.length===4){
    const lengths=f.map((a,i)=>v3.len(v3.sub(p[a],p[f[(i+1)%4]])));
    for(const offset of [0,1]){
      const a=edges.get(key(f[offset],f[(offset+1)%4])),b=edges.get(key(f[(offset+2)%4],f[(offset+3)%4]));
      const width=Math.max(lengths[offset],lengths[(offset+2)%4]),length=Math.min(lengths[(offset+1)%4],lengths[(offset+3)%4]);
      if(width>length*.2||width>diagonal*.012||[a.a,a.b,b.a,b.b].some(i=>fixed.has(i)))continue;
      // Reject a thin sidewall between opposed surface sheets.
      const sides=[1,3].map(j=>edges.get(key(f[(offset+j)%4],f[(offset+j+1)%4])).uses.find(fi=>faces[fi]!==f));
      if(sides.some(i=>i===undefined)||v3.dot(normals[sides[0]],normals[sides[1]])<.25)continue;
      a.links.add(b);b.links.add(a);eligible.add(a);eligible.add(b);
    }
  }
  const visited=new Set(),strips=[];
  for(const first of eligible)if(!visited.has(first)){
    const strip=[],stack=[first];while(stack.length){const e=stack.pop();if(visited.has(e))continue;visited.add(e);strip.push(e);stack.push(...e.links);}
    const terminal=strip.some(e=>e.uses.some(fi=>faces[fi].length===3));
    if((terminalOnly?strip.length===2&&terminal:strip.length>=3)&&strip.every(e=>e.links.size<=2)){strip.terminal=terminal;strips.push(strip);}
  }
  strips.sort((a,b)=>(terminalOnly?0:b.length-a.length)||a[0].a-b[0].a);
  const candidates=[];
  for(const strip of strips.slice(0,12)){
    // No branching or chains of three vertices across the width of a row.
    const touched=new Set();let conflict=false;for(const e of strip)for(const i of [e.a,e.b]){if(touched.has(i))conflict=true;touched.add(i);}if(conflict)continue;
    const remap=p.map((_,i)=>i),points=p.map(v=>[...v]);
    for(const e of strip){remap[e.b]=e.a;points[e.a]=v3.mix(p[e.a],p[e.b],.5);}
    const output=[],origins=[];let bad=false;
    for(const f of faces){const mapped=f.map(i=>remap[i]),clean=mapped.filter((x,i)=>x!==mapped[(i+mapped.length-1)%mapped.length]);if(clean.length<3)continue;if(new Set(clean).size!==clean.length){bad=true;break;}
      const normal=(pts,face)=>face.slice(1,-1).reduce((n,_,i)=>v3.add(n,v3.cross(v3.sub(pts[face[i+1]],pts[face[0]]),v3.sub(pts[face[i+2]],pts[face[0]]))),[0,0,0]);
      if(v3.dot(normal(p,f),normal(points,clean))<=0){bad=true;break;}output.push(clean);origins.push(f);
    }
    if(bad)continue;
    const used=[...new Set(output.flat())].sort((a,b)=>a-b),compact=new Map(used.map((v,i)=>[v,i]));
    const result=rebuildEditedMesh(mesh,used.map(i=>points[i]),output.map(f=>f.map(i=>compact.get(i))),'v3-thin-strip-collapse');
    // Midpoint welding can twist a neighboring quad around a terminating
    // triangle. Fit each surviving cross-edge point along the original edge,
    // selecting by local shape quality before the full source/flow audit.
    const affected=strip.map(e=>({e,id:compact.get(e.a),faces:result.objFaces.filter(f=>f.includes(compact.get(e.a)))}));
    const cost=local=>{let value=0;for(const f of local){if(f.length!==4)continue;const d=quadDiagonalQuality(result.vertices,f,false);value+=(d<.8660254?100:0)+(d<.15?10000:0)+1-d;const lengths=f.map((v,j)=>v3.len(v3.sub(result.vertices[v],result.vertices[f[(j+1)%4]])));value+=Math.max(...lengths)/Math.max(1e-20,Math.min(...lengths))*.001;}return value;};
    if(terminalOnly)for(let pass=0;pass<2;pass++)for(const {e,id,faces:local}of affected){
      if(id===undefined)continue;let best=[...result.vertices[id]],score=cost(local);
      for(const amount of [0,.25,.75,1]){result.vertices[id]=v3.mix(p[e.a],p[e.b],amount);const next=cost(local);if(next<score-1e-8){score=next;best=[...result.vertices[id]];}}result.vertices[id]=best;
    }
    const faceNormal=(vertices,f)=>f.slice(1,-1).reduce((n,_,i)=>v3.add(n,v3.cross(v3.sub(vertices[f[i+1]],vertices[f[0]]),v3.sub(vertices[f[i+2]],vertices[f[0]]))),[0,0,0]);
    if(result.objFaces.some((f,i)=>v3.dot(faceNormal(result.vertices,f),faceNormal(p,origins[i]))<=0))continue;
    // Refresh bounds after fitting; render and export share these vertices.
    const refreshed=rebuildEditedMesh(result,result.vertices,result.objFaces,'v3-thin-strip-collapse');
    delete result.v3StripRefinement;result.v3MovedVertices=strip.length*2;
    result.v3CollapsedStrip={crossEdges:strip.length,removedVertices:p.length-used.length,removedPolygons:faces.length-output.length};
    Object.assign(refreshed,{v3MovedVertices:result.v3MovedVertices,v3CollapsedStrip:{...result.v3CollapsedStrip,terminalTriangle:strip.terminal}});delete refreshed.v3StripRefinement;
    candidates.push(refreshed);
  }
  return candidates;
}

function curveV3FairJunctionStrips(mesh,sweeps,strength=.3,protectedPositions=new Set()){
  const p=mesh.vertices,faces=mesh.objFaces,adj=p.map(()=>new Set()),inc=p.map(()=>[]),edges=new Map(),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo));
  faces.forEach((f,i)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length];adj[a].add(b);adj[b].add(a);inc[a].push(i);const k=key(a,b);edges.set(k,(edges.get(k)||0)+1);}));
  const fixed=new Set();for(const [k,n]of edges)if(n!==2)k.split(',').map(Number).forEach(i=>fixed.add(i));
  const frames=sweeps.flatMap(s=>s.frames.slice(0,-1).map((a,i)=>({a,b:s.frames[i+1],s,i}))),pairs=p.map(()=>null),seeds=[];
  for(let i=0;i<p.length;i++){
    if(protectedPositions.has(p[i].join(','))||adj[i].size>6||adj[i].size<3){fixed.add(i);continue;}
    let best;
    for(const {a,b,s,i:segment}of frames){const d=v3.sub(b.c,a.c),u=clamp(v3.dot(v3.sub(p[i],a.c),d)/Math.max(1e-20,v3.dot(d,d))),center=v3.mix(a.c,b.c,u),distance=v3.len(v3.sub(p[i],center))/Math.max(1e-12,a.width,a.depth);if(!best||distance<best.distance)best={distance,t:v3.norm(v3.mix(a.t,b.t,u)),u:sweepSegmentFraction(s,segment,u)};}
    if(!best||best.u<.08||best.u>.92){fixed.add(i);continue;}
    const along=[...adj[i]].map(j=>({j,d:v3.dot(v3.norm(v3.sub(p[j],p[i])),best.t)})),forward=along.filter(x=>x.d>.35).sort((a,b)=>b.d-a.d),backward=along.filter(x=>x.d<-.35).sort((a,b)=>a.d-b.d);
    if(!forward.length||!backward.length)continue;
    // A genuinely branching direction must not be arbitrarily assigned to
    // one daughter. Leave it alone until a topology-aware retile can handle it.
    if((forward[1]&&forward[0].d-forward[1].d<.08)||(backward[1]&&backward[1].d-backward[0].d<.08))continue;
    pairs[i]=[backward[0].j,forward[0].j];
    const[a,b]=pairs[i],bend=1-v3.dot(v3.norm(v3.sub(p[i],p[a])),v3.norm(v3.sub(p[b],p[i])));
    if(!fixed.has(i)&&(adj[i].size!==4||inc[i].some(f=>faces[f].length!==4)||bend>1-Math.cos(Math.PI/12)))seeds.push(i);
  }
  if(!seeds.length)return mesh;
  const weight=p.map(()=>0);for(const seed of seeds){weight[seed]=1;let front=[seed];for(const w of [.75,.4,.15]){const next=[];for(const i of front)for(const j of pairs[i]||[])if(pairs[j]&&!fixed.has(j)){weight[j]=Math.max(weight[j],w);next.push(j);}front=next;}}
  // Let the neighboring column share the adjustment, avoiding a thin ridge.
  const primary=[...weight];for(let i=0;i<p.length;i++)if(primary[i])for(const j of adj[i])if(pairs[j]&&!fixed.has(j))weight[j]=Math.max(weight[j],primary[i]*.25);
  // Very narrow neighboring columns form one band. Translate them together
  // so improving its path does not crush or twist its thin cross-section.
  const parent=p.map((_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
  for(let i=0;i<p.length;i++)if(pairs[i]&&!fixed.has(i))for(const j of adj[i])if(j>i&&pairs[j]&&!fixed.has(j)&&!pairs[i].includes(j)&&!pairs[j].includes(i)){
    const span=Math.min(...pairs[i].map(k=>v3.len(v3.sub(p[k],p[i]))),...pairs[j].map(k=>v3.len(v3.sub(p[k],p[j]))));if(v3.len(v3.sub(p[j],p[i]))<span*.35)parent[root(j)]=root(i);
  }
  const bands=new Map();for(let i=0;i<p.length;i++)if(pairs[i]&&!fixed.has(i)){const r=root(i);if(!bands.has(r))bands.set(r,[]);bands.get(r).push(i);}
  const energy=vertices=>weight.reduce((sum,w,i)=>{if(!w||!pairs[i])return sum;const[a,b]=pairs[i],u=v3.norm(v3.sub(vertices[i],vertices[a])),v=v3.norm(v3.sub(vertices[b],vertices[i]));return sum+w*(1-v3.dot(u,v));},0);
  const vertices=p.map(v=>[...v]);
  for(let pass=0;pass<8;pass++){
    const old=vertices.map(v=>[...v]);for(let i=0;i<p.length;i++)if(weight[i]&&pairs[i]&&!fixed.has(i)){
      const[a,b]=pairs[i],da=v3.len(v3.sub(old[i],old[a])),db=v3.len(v3.sub(old[i],old[b])),target=v3.mix(old[a],old[b],.85*da/Math.max(1e-20,da+db)+.075),delta=v3.scale(v3.sub(target,old[i]),strength*weight[i]),next=v3.add(old[i],delta),move=v3.sub(next,p[i]),limit=Math.min(diagonal*.015,...pairs[i].map(j=>v3.len(v3.sub(p[j],p[i]))*.35));
      vertices[i]=v3.len(move)>limit?v3.add(p[i],v3.scale(move,limit/v3.len(move))):next;
    }
    for(const band of bands.values())if(band.length>1&&band.some(i=>weight[i])){const move=v3.scale(band.reduce((sum,i)=>v3.add(sum,v3.sub(vertices[i],p[i])),[0,0,0]),1/band.length);for(const i of band)vertices[i]=v3.add(p[i],move);}
  }
  for(let pass=0;pass<8;pass++){
    const restore=new Set();for(const f of faces){
      const ratio=points=>{const lengths=f.map((i,j)=>v3.len(v3.sub(points[i],points[f[(j+1)%f.length]])));return Math.max(...lengths)/Math.max(1e-20,Math.min(...lengths));};
      let bad=f.length===4&&(quadDiagonalQuality(vertices,f,false)<.15||(ratio(vertices)>10&&ratio(p)<=10));
      for(let k=1;k<f.length-1;k++){const normal=points=>v3.cross(v3.sub(points[f[k]],points[f[0]]),v3.sub(points[f[k+1]],points[f[0]]));if(v3.dot(normal(p),normal(vertices))<=0)bad=true;}
      if(bad)f.forEach(i=>restore.add(i));
    }
    if(!restore.size)break;for(const i of restore)for(const j of bands.get(root(i))||[i])vertices[j]=[...p[j]];
  }
  for(const f of mesh.faces){const normal=points=>v3.cross(v3.sub(points[f[1]],points[f[0]]),v3.sub(points[f[2]],points[f[0]]));if(v3.dot(normal(p),normal(vertices))<=0)return mesh;}
  const before=energy(p),after=energy(vertices);if(after>=before*.95)return mesh;
  const result=rebuildEditedMesh(mesh,vertices,faces,'v3-junction-strip-fit');result.v3StripRefinement={seeds:seeds.length,before,after,movedIrregular:seeds.filter(i=>(adj[i].size!==4||inc[i].some(f=>faces[f].length!==4))&&v3.len(v3.sub(p[i],vertices[i]))>diagonal*1e-9).length};result.v3MovedVertices=vertices.filter((v,i)=>v3.len(v3.sub(v,p[i]))>diagonal*1e-9).length;return result;
}

function curveV3FairSurface(mesh,sweeps,strength=.35,protectedPositions=new Set()){
  const p=mesh.vertices,faces=mesh.objFaces,adj=p.map(()=>new Set()),incident=p.map(()=>[]),edges=new Map(),normal=p.map(()=>[0,0,0]),edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  const fn=faces.map(f=>v3.norm(v3.cross(v3.sub(p[f[1]],p[f[0]]),v3.sub(p[f.at(-1)],p[f[0]]))));
  faces.forEach((f,i)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length];adj[a].add(b);adj[b].add(a);incident[a].push(i);normal[a]=v3.add(normal[a],fn[i]);const key=edgeKey(a,b);if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key).faces.push(i);}));
  const fixed=new Set(),creases=p.map(()=>[]),diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo));
  for(const e of edges.values())if(e.faces.length!==2){fixed.add(e.a);fixed.add(e.b);}else if(v3.dot(fn[e.faces[0]],fn[e.faces[1]])<Math.cos(Math.PI*.3)){creases[e.a].push(e.b);creases[e.b].push(e.a);}
  const pins=sweeps.flatMap(s=>[s.frames[0].c,s.frames.at(-1).c]);
  for(let i=0;i<p.length;i++)if(protectedPositions.has(p[i].join(','))||pins.some(c=>v3.len(v3.sub(c,p[i]))<diagonal*1e-5)||creases[i].length>2)fixed.add(i);
  const stencils=[];
  for(let i=0;i<p.length;i++){
    if(fixed.has(i)||adj[i].size!==4||incident[i].some(f=>faces[f].length!==4))continue;
    const neighbors=[...adj[i]],a=neighbors[0],b=neighbors.find(b=>b!==a&&!incident[i].some(f=>faces[f].includes(a)&&faces[f].includes(b)));
    if(b===undefined)continue;const other=neighbors.filter(j=>j!==a&&j!==b);
    stencils.push({i,pairs:[[a,b],other],normal:v3.norm(normal[i]),limit:Math.min(diagonal*.012,...neighbors.map(j=>v3.len(v3.sub(p[i],p[j]))*.35))});
  }
  const vertices=p.map(v=>[...v]);
  for(let pass=0;pass<10;pass++){
    const old=vertices.map(v=>[...v]);
    for(const {i,pairs,normal,limit} of stencils){
      const targets=pairs.map(([a,b])=>{const da=v3.len(v3.sub(old[i],old[a])),db=v3.len(v3.sub(old[i],old[b]));return v3.mix(old[a],old[b],.65*da/Math.max(1e-20,da+db)+.35*.5);});
      let delta=v3.sub(v3.mix(targets[0],targets[1],.5),old[i]);
      if(creases[i].length===2){const tangent=v3.norm(v3.sub(old[creases[i][1]],old[creases[i][0]]));delta=v3.scale(tangent,v3.dot(delta,tangent));}
      else delta=v3.sub(delta,v3.scale(normal,v3.dot(delta,normal)*.95));
      let next=v3.add(old[i],v3.scale(delta,strength)),move=v3.sub(next,p[i]);if(v3.len(move)>limit)next=v3.add(p[i],v3.scale(move,limit/v3.len(move)));vertices[i]=next;
    }
  }
  // Freeze only the neighborhood responsible for a newly introduced sliver,
  // acute corner or warped quad; keep useful movement elsewhere.
  const flags=(points,f)=>{
    const e=f.map((id,j)=>v3.len(v3.sub(points[id],points[f[(j+1)%4]])));
    return [quadDiagonalQuality(points,f,false)<Math.cos(Math.PI/6),f.some((id,j)=>v3.dot(v3.norm(v3.sub(points[f[(j+3)%4]],points[id])),v3.norm(v3.sub(points[f[(j+1)%4]],points[id])))>Math.cos(Math.PI/9)),Math.max(...e)/Math.max(1e-20,Math.min(...e))>10];
  };
  const originalFlags=faces.map(f=>f.length===4?flags(p,f):null);
  for(let pass=0;pass<8;pass++){
    const restore=new Set();faces.forEach((f,i)=>{if(f.length===4&&flags(vertices,f).some((bad,j)=>bad&&!originalFlags[i][j]))f.forEach(v=>restore.add(v));});
    if(!restore.size)break;for(const i of restore)vertices[i]=[...p[i]];
  }
  const moved=vertices.reduce((n,v,i)=>n+(v3.len(v3.sub(v,p[i]))>diagonal*1e-10?1:0),0);
  if(!moved)return mesh;
  // Reject inverted triangles before any expensive global comparisons.
  for(const f of mesh.faces){const normal=points=>v3.cross(v3.sub(points[f[1]],points[f[0]]),v3.sub(points[f[2]],points[f[0]]));if(v3.dot(normal(p),normal(vertices))<=0)return mesh;}
  const result=rebuildEditedMesh(mesh,vertices,faces,'v3-coupled-quad-fairing');result.v3MovedVertices=moved;return result;
}

function curveV3PrepareSeamContours(rows,frames,sweeps,supportLimit=4,localIntervals=false,profileBudget=16){
  const tracks=curveV2LateEntryPrepareContours(rows,frames,sweeps,{profileBudget,minimumCount:8,preserveFeatures:true});
  const mod=x=>(x%1+1)%1,report=[];
  const arc=c=>{
    const lengths=c.rawRing.map((p,i)=>v3.len(v3.sub(p,c.rawRing[(i+1)%c.rawRing.length]))),total=lengths.reduce((s,x)=>s+x,0),starts=[];
    let sum=0;for(const length of lengths){starts.push(sum);sum+=length;}
    const project=p=>{let nearest={distance:Infinity,offset:0};for(let i=0;i<lengths.length;i++){
      const a=c.rawRing[i],b=c.rawRing[(i+1)%lengths.length],d=v3.sub(b,a),u=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,lengths[i]**2)),distance=v3.len(v3.sub(p,v3.mix(a,b,u)));
      if(distance<nearest.distance)nearest={distance,offset:(starts[i]+u*lengths[i])/total};
    }return nearest.offset;};
    const offset=project(c.ring[0]);
    return {
      project:p=>mod(project(p)-offset),
      seams:c.rawRing.flatMap((p,i)=>{const from=c.rawOwners[(i+lengths.length-1)%lengths.length],to=c.rawOwners[i];return from===to?[]:[{key:from+'>'+to,t:mod(starts[i]/total-offset)}];}),
      point:t=>{let d=mod(t+offset)*total,j=0;while(j<lengths.length-1&&d>lengths[j])d-=lengths[j++];return {p:v3.mix(c.rawRing[j],c.rawRing[(j+1)%lengths.length],d/Math.max(1e-20,lengths[j])),owner:c.rawOwners[j]};}
    };
  };
  const domains=[];
  for(let trackId=0;trackId<tracks.length;trackId++){
    const track=tracks[trackId],all=rows.flat().filter(c=>c.phaseTrack===trackId);
    if(!localIntervals){domains.push({trackId,track,contours:all,partial:false});continue;}
    const signature=c=>{const seams=arc(c).seams.map(s=>s.key).sort();return seams.length===2&&new Set(seams).size===2?seams.join('|'):'';};
    for(let start=0;start<all.length;){const key=signature(all[start]);let end=start+1;while(end<all.length&&signature(all[end])===key)end++;
      if(key)domains.push({trackId,track,contours:all.slice(start,end),partial:start>0||end<all.length});start=end;
    }
  }
  for(const {trackId,track,contours,partial} of domains){
    if(contours.length<4)continue;
    const arcs=contours.map(arc),keys=[...new Set(arcs[0].seams.map(s=>s.key))];
    const stable=keys.filter(key=>arcs.every(a=>a.seams.filter(s=>s.key===key).length===1)).map(key=>({key,offsets:arcs.map(a=>a.seams.find(s=>s.key===key).t)})).filter(s=>Math.max(...s.offsets)-Math.min(...s.offsets)<.2);
    // Paired transitions keep the even edge budget needed at a fork. A short,
    // disappearing or ambiguous contact is not permission to invent a seam.
    if(stable.length!==2)continue;
    // A local seam must not change the ring count midway along a track.
    // Reuse existing lanes; full-track seams retain their previous +2 policy.
    const count=contours[0].ring.length+(partial?0:2);
    for(const seam of stable)seam.lane=Math.round(seam.offsets.reduce((a,b)=>a+b,0)/seam.offsets.length*count);
    if(partial){
      // A seam near the phase origin can round to lane N (the same vertex as
      // lane zero). Reserve distinct ordered interior lanes instead of dropping
      // the contact merely because it is close to an existing profile shoulder.
      const ordered=[...stable].sort((a,b)=>a.offsets[0]-b.offsets[0]);let previous=0;
      ordered.forEach((seam,i)=>{seam.lane=Math.max(previous+1,Math.min(count-(ordered.length-i),seam.lane));previous=seam.lane;});
    }
    if(stable.some(s=>s.lane<1||s.lane>=count)||new Set(stable.map(s=>s.lane)).size!==2)continue;
    // Keep exposed AHS profile shoulders as support rails as well. Allocate
    // these in the same ring budget, without displacing either contact seam.
    const features=[],occupied=new Set([0,count,...stable.map(s=>s.lane)]);
    for(const landmark of track.landmarks||[]){
      if(features.length>=supportLimit)break;
      const offsets=contours.map((c,i)=>arcs[i].project(c.ring[landmark.lane])),mean=offsets.reduce((a,b)=>a+b,0)/offsets.length,lane=Math.round(mean*count);
      if(occupied.has(lane)||offsets.some(t=>Math.abs(t-lane/count)>.45/count))continue;
      const feature={lane,offsets,source:landmark.source,profile:landmark.profile};
      const anchors=[{lane:0,offsets:offsets.map(()=>0)},...stable,...features,feature,{lane:count,offsets:offsets.map(()=>1)}].sort((a,b)=>a.lane-b.lane);
      if(anchors.some((a,j)=>j&&a.offsets.some((t,r)=>t-anchors[j-1].offsets[r]<.08/count)))continue;
      occupied.add(lane);features.push(feature);
    }
    const rings=[];let bad=false;
    for(let r=0;r<contours.length;r++){
      const anchors=[{lane:0,t:0},...[...stable,...features].map(s=>({lane:s.lane,t:s.offsets[r]})),{lane:count,t:1}].sort((a,b)=>a.lane-b.lane);
      if(anchors.some((a,i)=>i&&a.t<=anchors[i-1].t)){bad=true;break;}
      const ring=[],owners=[];let k=0;
      for(let j=0;j<count;j++){while(j>anchors[k+1].lane)k++;const a=anchors[k],b=anchors[k+1],hit=arcs[r].point(a.t+(b.t-a.t)*(j-a.lane)/(b.lane-a.lane));ring.push(hit.p);owners.push(hit.owner);}
      rings.push({ring,owners});
    }
    if(bad)continue;
    contours.forEach((c,i)=>{Object.assign(c,rings[i]);c.center=v3.scale(c.ring.reduce((s,p)=>v3.add(s,p),[0,0,0]),1/count);});
    report.push({track:trackId,rows:partial?contours.map(c=>c.sectionRow):track.rows,partial,previousCount:track.count,count,rails:stable.map(seam=>({sources:seam.key,lane:seam.lane,points:contours.map(c=>[...c.ring[seam.lane]])})),supports:features.map(f=>({source:f.source,profile:f.profile,lane:f.lane,points:contours.map(c=>[...c.ring[f.lane]])}))});
  }
  return report;
}

function curveV3SeamCandidate(sweeps,supportLimit=4,options={}){
  const length=s=>s.frames.slice(1).reduce((sum,f,i)=>sum+v3.len(v3.sub(f.c,s.frames[i].c)),0);
  const group=[...sweeps].sort((a,b)=>length(b)-length(a)||JSON.stringify(a.frames.map(f=>f.c)).localeCompare(JSON.stringify(b.frames.map(f=>f.c))));
  const plan=curveV2LateEntryPlan(group);if(!plan)return null;
  const source=buildSourceMesh(group);let count=Math.max(16,Math.min(32,Math.max(...group.map(s=>s.frames.length))+1)),stations=curveV2LateEntryStations(group,plan,count);
  if(options.localSeamIntervals){
    // Insert half-step physical cuts only around changing contact domains.
    // Original stations remain exact; the unaffected body is not densified.
    const probe=sectionContourMesh(group,count,{sectionStations:stations,contoursOnly:true}),signature=row=>row.map(s=>s.join(',')).sort().join('|'),extra=new Set();
    for(let r=1;r<probe.sectionContourSources.length;r++)if(signature(probe.sectionContourSources[r])!==signature(probe.sectionContourSources[r-1]))for(let j=Math.max(0,r-2);j<=Math.min(count-2,r+1);j++)extra.add(j);
    const dense=curveV2LateEntryStations(group,plan,count*2),refined=[];
    for(let r=0;r<count;r++){refined.push(stations[r]);if(extra.has(r)&&refined.length+(count-r-1)<52)refined.push(dense[r*2+1]);}
    stations=refined;count=stations.length;
  }
  let rows,tracks;
  const constructed=repairFoldedQuads(sectionContourMesh(group,count,{
    sectionStations:stations,sectionPrepareContours:(r,f)=>{tracks=curveV3PrepareSeamContours(r,f,group,supportLimit,options.localSeamIntervals,options.localSeamIntervals?(options.localProfileBudget||16):16);},
    sectionJunctionBuilder:(p,cs,v)=>curveV2LateEntryJunctionAdaptive(p,cs,v,{preserveRings:true}),sectionFinalizeContours:r=>{rows=r;},
    sectionPreservePhase:true,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true
  }));
  if(!tracks.length)return null;
  const reduced=options.allowSourceBudgetExceeded===true?{mesh:constructed,report:{withinBudget:true,removedRows:0}}:curveV2ReduceSectionRows(constructed,rows,source),mesh=reduced.mesh;
  if(!reduced.report.withinBudget)return null;
  const positions=new Map(mesh.vertices.map((p,i)=>[p.join(','),i])),edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,edges=new Set();
  for(const f of mesh.objFaces)f.forEach((a,j)=>edges.add(edgeKey(a,f[(j+1)%f.length])));
  const rails=[],supports=[];
  for(const track of tracks)for(const rail of [...track.rails,...track.supports]){
    const vertices=rail.points.map(p=>positions.get(p.join(','))).filter(i=>i!==undefined);
    // Row reduction may skip samples, but the seam must remain an actual
    // connected edge chain, not just a collection of nearby points.
    if(vertices.length<4||vertices.some((v,i)=>i&&!edges.has(edgeKey(vertices[i-1],v))))return null;
    if(rail.sources)rails.push({sources:rail.sources,vertices});else supports.push({source:rail.source,profile:rail.profile,vertices});
  }
  mesh.v3StructuralSeams={rails,supports,addedLanes:tracks.reduce((n,t)=>n+t.count-t.previousCount,0),constructionRows:count,removedRows:reduced.report.removedRows};
  if(options.localSeamIntervals)mesh.v3StructuralSeams.localIntervals=tracks.filter(t=>t.partial).map(t=>({rows:t.rows,parameters:t.rows.map(r=>stations[r].parameter),sources:t.rails.map(s=>s.sources),ringCount:t.count}));
  return mesh;
}

function curveV3SeamError(mesh,candidate){
  const edges=new Map(),key=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
  for(const f of mesh.objFaces)f.forEach((a,j)=>edges.set(key(a,f[(j+1)%f.length]),[mesh.vertices[a],mesh.vertices[f[(j+1)%f.length]]]));
  let error=0,samples=0;
  for(const rail of candidate.v3StructuralSeams.rails)for(let i=1;i<rail.vertices.length;i++){
    const a=candidate.vertices[rail.vertices[i-1]],b=candidate.vertices[rail.vertices[i]];
    for(const t of [.25,.5,.75]){
      const p=v3.mix(a,b,t);let best=Infinity;
      for(const [u,v] of edges.values()){const d=v3.sub(v,u),f=clamp(v3.dot(v3.sub(p,u),d)/Math.max(1e-20,v3.dot(d,d)));best=Math.min(best,v3.len(v3.sub(p,v3.mix(u,v,f))));}
      error+=best;samples++;
    }
  }
  return error/Math.max(1,samples);
}

function curveV3SourceGraftFinish(vertices,input){
  const faces=input.filter(f=>f.length>=3),used=[...new Set(faces.flat())].sort((a,b)=>a-b),map=new Map(used.map((v,i)=>[v,i])),p=used.map(v=>vertices[v]),out=faces.map(f=>f.map(v=>map.get(v)));
  const edges=new Map(),key=(a,b)=>a<b?a+','+b:b+','+a;
  out.forEach((f,i)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length],k=key(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push({i,sign:a<b?1:-1});}));
  if([...edges.values()].some(e=>e.length!==2))return null;
  const signs=new Map([[0,1]]),queue=[0];
  while(queue.length){const i=queue.pop();for(let j=0;j<out[i].length;j++){const es=edges.get(key(out[i][j],out[i][(j+1)%out[i].length])),me=es.find(e=>e.i===i),other=es.find(e=>e.i!==i);if(!other)return null;const sign=-signs.get(i)*me.sign*other.sign;if(signs.has(other.i)){if(signs.get(other.i)!==sign)return null;}else{signs.set(other.i,sign);queue.push(other.i);}}}
  if(signs.size!==out.length)return null;
  for(const [i,sign]of signs)if(sign<0)out[i]=[out[i][0],...out[i].slice(1).reverse()];
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const v of p)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}
  return {vertices:p,objFaces:out,faces:out.flatMap(f=>f.slice(1,-1).map((_,i)=>[f[0],f[i+1],f[i+2]])),bounds:{lo,hi},graftVertexMap:map};
}

function curveV3SourceGraftPlan(sweeps){
  if(sweeps.length!==2)return null;
  const length=s=>s.frames.slice(1).reduce((v,f,i)=>v+v3.len(v3.sub(f.c,s.frames[i].c)),0),s=[...sweeps].sort((a,b)=>length(b)-length(a));
  const [host,branch]=s,entry=curveV2LateEntryPlan(s);if(!entry||branch.profile.length!==4)return null;
  const rings=s.map(x=>x.frames.map(f=>x.profile.map(p=>sweepPoint(f,p)))),dist=(a,b)=>v3.len(v3.sub(a,b));
  let best={error:Infinity};
  for(let r=2;r<host.frames.length-4;r++)for(let e=0;e<host.profile.length;e++){
    const a=rings[0][r][e],b=rings[0][r][(e+1)%host.profile.length],d=v3.sub(b,a),t=clamp(v3.dot(v3.sub(branch.frames[0].c,a),d)/v3.dot(d,d)),error=dist(v3.mix(a,b,t),branch.frames[0].c);
    if(error<best.error)best={r,e,error};
  }
  // Pick the exposed profile edge, not whichever edge has matching indices.
  const scores=branch.profile.map((_,i)=>{const j=(i+1)%4;return [0,1].reduce((v,r)=>v+sweepDistance(v3.mix(rings[1][r][i],rings[1][r][j],.5),host),0);});
  const outer=scores.indexOf(Math.max(...scores));let corners=[outer,(outer+1)%4,(outer+2)%4,(outer+3)%4];
  const a=rings[0][best.r][best.e],b=rings[0][best.r][(best.e+1)%host.profile.length];
  if(dist(a,rings[1][0][corners[0]])+dist(b,rings[1][0][corners[1]])>dist(a,rings[1][0][corners[1]])+dist(b,rings[1][0][corners[0]]))corners=[corners[1],corners[0],corners[3],corners[2]];
  return {s,rings,...best,corners};
}

function curveV3SourceGraftCandidate(plan,{start,end,cut,inset=0,rootBlend=1,backShift=0}){
  const {s:[host,branch],rings,e,corners}=plan,n=host.profile.length,vertices=[],faces=[],add=p=>{vertices.push([...p]);return vertices.length-1;};
  if(start<2||end<=start||end>=host.frames.length-2||cut<1||cut>=branch.frames.length-2)return null;
  // Only source-declared coincident tip corners are welded, never nearby sheets.
  const create=(rs)=>rs.map((ring,r)=>{const same=r===rs.length-1&&ring.every(p=>v3.len(v3.sub(p,ring[0]))<1e-9);if(same){const id=add(ring[0]);return ring.map(()=>id);}return ring.map(add);});
  const h=create(rings[0]),b=create(rings[1]),put=f=>{const g=f.filter((v,i)=>v!==f[(i+f.length-1)%f.length]);if(new Set(g).size>=3)faces.push(g);};
  for(let r=0;r<h.length-1;r++)for(let j=0;j<n;j++)if(!(j===e&&r>=start-1&&r<end))put([h[r][j],h[r+1][j],h[r+1][(j+1)%n],h[r][(j+1)%n]]);
  for(let r=cut;r<b.length-1;r++)for(let j=0;j<4;j++)put([b[r][j],b[r+1][j],b[r+1][(j+1)%4],b[r][(j+1)%4]]);
  const cap=(ids,c)=>{
    if(new Set(ids).size<3)return;
    const normal=v3.norm(ids.reduce((v,a,i)=>v3.add(v,v3.cross(v3.sub(vertices[a],c),v3.sub(vertices[ids[(i+1)%ids.length]],c))),[0,0,0])),turn=(a,b,d)=>v3.dot(v3.cross(v3.sub(vertices[b],vertices[a]),v3.sub(vertices[d],vertices[b])),normal),left=[...ids],tri=[];
    while(left.length>3){let found=false;for(let j=0;j<left.length;j++){
      const a=left[(j+left.length-1)%left.length],b=left[j],d=left[(j+1)%left.length];
      if(turn(a,b,d)<=1e-14)continue;
      if(left.some(v=>v!==a&&v!==b&&v!==d&&turn(a,b,v)>=-1e-14&&turn(b,d,v)>=-1e-14&&turn(d,a,v)>=-1e-14))continue;
      tri.push([a,b,d]);left.splice(j,1);found=true;break;
    }if(!found)throw Error('Unsupported source cap');}
    tri.push(left);
    // Pair only triangles in this cap, never change the source body faces.
    for(let i=0;i<tri.length;i++)for(let j=i+1;j<tri.length;j++)if(tri[i]?.length===3&&tri[j]?.length===3){
      const f=tri[i],g=tri[j],edges=f.map((a,k)=>[a,f[(k+1)%3]]).concat(g.map((a,k)=>[a,g[(k+1)%3]])).filter(([a,b],_,all)=>!all.some(([c,d])=>a===d&&b===c));
      if(edges.length!==4)continue;const q=[edges[0][0]];while(q.length<4){const next=edges.find(e=>e[0]===q.at(-1));if(!next)break;q.push(next[1]);}
      if(new Set(q).size!==4||quadDiagonalQuality(vertices,q,false)<.8||q.some((a,k)=>turn(a,q[(k+1)%4],q[(k+2)%4])<1e-14))continue;
      tri[i]=q;tri[j]=null;
    }
    tri.filter(Boolean).forEach(put);
  };
  cap(h[0],host.frames[0].c);cap(h.at(-1),host.frames.at(-1).c);cap(b.at(-1),branch.frames.at(-1).c);
  const raised=[];
  for(let r=start;r<=end;r++){
    const a=rings[0][r][e],z=rings[0][r][(e+1)%n],center=v3.mix(a,z,.5),normal=host.frames[r].t,row=[];
    for(let side=0;side<2;side++){
      let hit;
      for(let j=0;j<cut;j++){
        const p=rings[1][j][corners[side]],q=rings[1][j+1][corners[side]],dp=v3.dot(v3.sub(p,center),normal),dq=v3.dot(v3.sub(q,center),normal);
        if(dp*dq<=0&&Math.abs(dp-dq)>1e-10){hit=v3.mix(p,q,dp/(dp-dq));break;}
      }
      if(!hit)return null;
      if(inset)hit=v3.mix(hit,v3.mix(a,z,side?1-inset:inset),.2);
      if(r===start)hit=v3.mix(side?z:a,hit,rootBlend);
      row.push(add(hit));
    }
    raised.push(row);
  }
  const A=r=>h[r][e],B=r=>h[r][(e+1)%n];
  put([A(start-1),raised[0][0],raised[0][1],B(start-1)]);
  put([A(start-1),A(start),raised[0][0]]);put([B(start-1),raised[0][1],B(start)]);
  for(let r=start;r<end;r++){const p=raised[r-start],q=raised[r-start+1];put([A(r),A(r+1),q[0],p[0]]);put([p[0],q[0],q[1],p[1]]);put([p[1],q[1],B(r+1),B(r)]);}
  const mouth=[raised.at(-1)[0],raised.at(-1)[1],B(end),A(end)],tail=corners.map(j=>b[cut][j]);
  if(backShift){for(let j=2;j<4;j++)vertices[tail[j]]=v3.mix(vertices[tail[j]],rings[1][cut+1][corners[j]],backShift);}
  for(let j=0;j<4;j++)put([mouth[j],tail[j],tail[(j+1)%4],mouth[(j+1)%4]]);
  const mesh=curveV3SourceGraftFinish(vertices,faces);if(mesh){
    const remap=mesh.graftVertexMap;delete mesh.graftVertexMap;
    const rails=[0,1].map(side=>({sources:side?'0>1':'1>0',vertices:[side?B(start-1):A(start-1),...raised.map(r=>r[side]),tail[side],b[cut+1][corners[side]]].map(i=>remap.get(i))}));
    mesh.v3StructuralSeams={rails,supports:[],addedLanes:2,constructionRows:end-start+1,removedRows:cut};
    mesh.sourceGraft={start,end,cut,edge:e,corners,inset,rootBlend,backShift,unchangedHostVertices:h.flat().every(i=>remap.has(i)&&mesh.vertices[remap.get(i)].every((v,k)=>v===vertices[i][k]))};
    // Source-grid identity, not proximity, is the welding key when independent
    // patches share a host. Collapsed source tips intentionally share one ID.
    const hostIds={};h.forEach((row,r)=>row.forEach((v,j)=>{const id=remap.get(v);if(hostIds[id]===undefined)hostIds[id]=r*n+j;}));
    mesh.sourceGraftPatch={hostIds,hostRows:h.length,hostColumns:n};
  }return mesh;
}

function curveV3SourceGraftSearch(sweeps,source,options,auditMesh,scoreMesh){
  if(options.sourceGraft===false)return null;
  const plan=curveV3SourceGraftPlan(sweeps);if(!plan)return null;
  let best;const attempts=[];
  for(let start=plan.r;start<=plan.r+1;start++)for(let end=start+1;end<=start+2;end++)for(let cut=1;cut<=3;cut++)for(const rootBlend of [1,.6])for(const backShift of [0,.25,.5]){
    const config={start,end,cut,rootBlend,backShift};
    try{
      const m=curveV3SourceGraftCandidate(plan,config);if(!m)continue;
      const attempt={...config,polygons:m.objFaces.length};attempts.push(attempt);
      if(options.allowSourceBudgetExceeded!==true&&(m.objFaces.length>source.objFaces.length||m.faces.length>source.faces.length||m.vertices.length>source.vertices.length)){attempt.reason='Source budget exceeded';continue;}
      const audit=auditMesh(m,1);if(!audit.hardValid||audit.foldedQuads){attempt.reason='Geometry audit failed';continue;}
      const grade=scoreMesh(m,source,sweeps);if(!qualityGeometryAcceptable(grade)||grade.metrics.gapBridgeFaces||grade.scores.shape<98){attempt.reason='Source fit or contact check failed';continue;}
      const adjacency=m.vertices.map(()=>new Set());for(const f of m.objFaces)f.forEach((a,i)=>{const b=f[(i+1)%f.length];adjacency[a].add(b);adjacency[b].add(a);});
      if(m.v3StructuralSeams.rails.some(r=>r.vertices.length<4||new Set(r.vertices).size!==r.vertices.length||r.vertices.some((v,i)=>!m.vertices[v]||(i&&!adjacency[v].has(r.vertices[i-1]))))){attempt.reason='Disconnected seam';continue;}
      // A source-authored four-sided tip is a pole too. The generic critic's
      // valence-based tip detector misses it and pairs its converging rails.
      // Keep the critic unchanged; use exact AHS endpoint identity for this
      // constructor's flow guard (same 75/45 degree limits as section fallback).
      const eps=v3.len(v3.sub(source.bounds.hi,source.bounds.lo))*1e-9,tipSet=new Set(m.vertices.flatMap((p,i)=>sweeps.some(s=>v3.len(v3.sub(p,s.frames.at(-1).c))<=eps)?[i]:[])),flow=artistMeshDiagnostics(m,sweeps,adjacency,tipSet);
      if(flow.railKinkMaxDegrees>75||flow.railKinkP95Degrees>45){attempt.reason='Rail flow limits exceeded';continue;}
      attempt.accepted=true;
      const utility=grade.scores.shape+grade.scores.flow-grade.metrics.normalizedChamfer*100;
      if(!best||utility>best.utility)best={mesh:m,audit,grade,utility,flow:{maxDegrees:flow.railKinkMaxDegrees,p95Degrees:flow.railKinkP95Degrees,sourceTipPoles:tipSet.size}};
    }catch(error){attempts.push({...config,reason:error.message});}
  }
  if(!best)return null;
  const {mesh,audit,grade,flow}=best;mesh.sourceGraft.flow=flow;
  return {seed:{...mesh,expectedComponents:1,curveUnionV2Audit:audit,curveUnionV2Grade:grade,curveUnionV2Groups:[{strands:2,layout:'3.0 source-preserving side graft',lateEntry:{rows:mesh.sourceGraft.end-mesh.sourceGraft.start+1,physicalContactsOnly:true,sourceGraft:true},preserved:false}]},report:{attempted:true,accepted:true,sourceGraft:true,reason:'Source-preserving side graft after base rejection',attempts}};
}

function curveV3LateEntryFallback(sweeps,source,options,auditMesh,scoreMesh){
  const report={attempted:false,accepted:false,attempts:[]};let best;
  if(options.structuralSeams===false||sweeps.length<2||sweeps.length>6)return {report};
  const gap=clamp(options.mergeDistance===undefined?.03:Number(options.mergeDistance)||0,0,.75);
  if(qualityOverlapGroups(sweeps,gap).groups.length!==1)return {report};
  const length=s=>s.frames.slice(1).reduce((n,f,i)=>n+v3.len(v3.sub(f.c,s.frames[i].c)),0);
  const sorted=[...sweeps].sort((a,b)=>length(b)-length(a)||JSON.stringify(a.frames.map(f=>f.c)).localeCompare(JSON.stringify(b.frames.map(f=>f.c))));
  if(!curveV2LateEntryPlan(sorted))return {report};
  const graft=curveV3SourceGraftSearch(sweeps,source,options,auditMesh,scoreMesh);if(graft)return graft;
  report.attempted=true;
  // Preserve the previous result whenever its full-track constructor works.
  // Otherwise try the smallest local-contact ring budget first; only escalate
  // density when every candidate at that budget fails the same safety gates.
  for(const layout of [{},...[8,10,12,16].map(localProfileBudget=>({localSeamIntervals:true,localProfileBudget}))]){
  for(const supportLimit of [4,2,1,0]){
    const attempt={supportLimit,...layout,accepted:false};report.attempts.push(attempt);
    try{
      const mesh=curveV3SeamCandidate(sweeps,supportLimit,{...options,...layout});
      if(!mesh){attempt.reason='No supported connected seam candidate';continue;}
      attempt.polygons=mesh.objFaces.length;
      if(options.allowSourceBudgetExceeded!==true&&(mesh.objFaces.length>source.objFaces.length||mesh.faces.length>source.faces.length||mesh.vertices.length>source.vertices.length)){attempt.reason='Source budget exceeded';continue;}
      if(!mesh.vertices.every(p=>p.length===3&&p.every(Number.isFinite))){attempt.reason='Non-finite geometry';continue;}
      const key=(a,b)=>a<b?a+','+b:b+','+a,edges=new Set(mesh.objFaces.flatMap(f=>f.map((a,i)=>key(a,f[(i+1)%f.length])))),seams=mesh.v3StructuralSeams;
      if(!seams?.rails?.length||[...seams.rails,...(seams.supports||[])].some(r=>r.vertices.length<4||new Set(r.vertices).size!==r.vertices.length||r.vertices.some((v,i)=>!mesh.vertices[v]||(i&&!edges.has(key(r.vertices[i-1],v)))))){attempt.reason='Disconnected or missing structural rails';continue;}
      const audit=auditMesh(mesh,1);
      if(!audit.hardValid||audit.foldedQuads){attempt.reason='Geometry audit failed';continue;}
      const grade=scoreMesh(mesh,source,sweeps),metrics=grade.metrics;
      if(!qualityGeometryAcceptable(grade)||metrics.gapBridgeFaces||mesh.contactBoundaryViolations){attempt.reason='Source fit or contact check failed';continue;}
      // No valid baseline exists here, so use absolute flow limits rather
      // than weakening the ordinary baseline-relative acceptance checks.
      if(metrics.railKinkMaxDegrees>75||metrics.railKinkP95Degrees>45){attempt.reason='Rail flow limits exceeded';continue;}
      attempt.accepted=true;attempt.shape=grade.scores.shape;attempt.flow=grade.scores.flow;
      const utility=grade.scores.shape+grade.scores.flow;
      if(!best||utility>best.utility)best={mesh,audit,grade,utility,supportLimit,layout};
    }catch(error){attempt.reason=error.message;}
  }
  if(best)break;
  }
  if(!best)return {report};
  report.accepted=true;report.supportLimit=best.supportLimit;report.reason='Safe seam-aware starting mesh after base budget rejection';
  if(best.layout.localSeamIntervals){report.localSeamIntervals=true;report.localProfileBudget=best.layout.localProfileBudget;}
  const seed={...best.mesh,expectedComponents:1,curveUnionV2Audit:best.audit,curveUnionV2Grade:best.grade,curveUnionV2Groups:[{strands:sweeps.length,layout:'3.0 seam-aware late-entry fallback',lateEntry:{rows:best.mesh.sectionContourCounts?.length,physicalContactsOnly:true,seamFallback:true},preserved:false}]};
  return {seed,report};
}

function curveV3PrepareForkContours(rows,frames,sweeps,profileBudget=16){
  curveV2LateEntryPrepareContours(rows,frames,sweeps,{profileBudget,minimumCount:6,preserveFeatures:true});
  const counts=new Map(),tracks=new Map();
  for(const row of rows)for(const c of row){if(c.sources.size===1)counts.set([...c.sources][0],c.ring.length);else{if(!tracks.has(c.phaseTrack))tracks.set(c.phaseTrack,[]);tracks.get(c.phaseTrack).push(c);}}
  const measure=points=>{const lengths=points.slice(1).map((p,i)=>v3.len(v3.sub(p,points[i]))),offsets=[0];for(const d of lengths)offsets.push(offsets.at(-1)+d);return {points,lengths,offsets,total:offsets.at(-1)};};
  const sample=(m,t)=>{let x=clamp(t)*m.total,k=0;while(k<m.lengths.length-1&&x>m.lengths[k])x-=m.lengths[k++];return v3.mix(m.points[k],m.points[k+1],x/Math.max(1e-20,m.lengths[k]));};
  const nearest=(m,p)=>{let best={distance:Infinity};for(let i=0;i<m.lengths.length;i++){const a=m.points[i],b=m.points[i+1],d=v3.sub(b,a),u=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,v3.dot(d,d))),distance=v3.len(v3.sub(p,v3.mix(a,b,u)));if(distance<best.distance)best={distance,t:(m.offsets[i]+m.lengths[i]*u)/m.total};}return best;};
  const hit=(source,profile,frame,arc)=>{let best;const points=sweeps[source].frames.map(f=>sweepPoint(f,sweeps[source].profile[profile]));for(let i=1;i<points.length;i++){const a=v3.dot(v3.sub(points[i-1],frame.anchor),frame.t),b=v3.dot(v3.sub(points[i],frame.anchor),frame.t);if((a<0)===(b<0)||Math.abs(a-b)<1e-20)continue;const q=nearest(arc,v3.mix(points[i-1],points[i],a/(a-b)));if(!best||q.distance<best.distance)best=q;}return best;};
  const report=[];
  for(const track of tracks.values()){
    const sources=[...track[0].sources].sort((a,b)=>a-b);if(sources.length!==2||sources.some(s=>!counts.has(s)))throw Error('Unsupported fork ownership');
    const arcs=track.map(c=>{const n=c.rawRing.length,starts=c.rawOwners.map((s,i)=>s!==c.rawOwners[(i+n-1)%n]?i:-1).filter(i=>i>=0);if(starts.length!==2)throw Error('Fork needs two contiguous source arcs');return sources.map(s=>{const start=starts.find(i=>c.rawOwners[i]===s),end=starts.find(i=>c.rawOwners[i]!==s);if(start===undefined||end===undefined)throw Error('Missing fork owner');const points=[c.rawRing[start]];for(let i=(start+1)%n;;i=(i+1)%n){points.push(c.rawRing[i]);if(i===end)break;}return measure(points);});});
    const sides=sources.map((source,k)=>{
      const count=counts.get(source)-1,candidates=[];
      for(let profile=0;profile<sweeps[source].profile.length;profile++){
        const hits=track.map((c,i)=>hit(source,profile,frames[c.sectionRow],arcs[i][k]));
        if(hits.some((h,i)=>!h||h.distance>arcs[i][k].total*1e-5||h.t<1e-5||h.t>1-1e-5))continue;
        const shape=sweeps[source].profile,p=shape[profile],a=shape[(profile+shape.length-1)%shape.length],b=shape[(profile+1)%shape.length],u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]],turn=Math.acos(clamp((u[0]*v[0]+u[1]*v[1])/Math.max(1e-20,Math.hypot(...u)*Math.hypot(...v)),-1,1));
        if(turn>.12)candidates.push({profile,hits,turn,mean:hits.reduce((s,h)=>s+h.t,0)/hits.length});
      }
      const selected=candidates.sort((a,b)=>b.turn-a.turn||a.profile-b.profile).slice(0,count-1).sort((a,b)=>a.mean-b.mean);
      if(track.some((_,i)=>selected.some((x,j)=>j&&x.hits[i].t<=selected[j-1].hits[i].t)))throw Error('Crossing fork landmarks');
      // Ordered dynamic assignment cannot give two profile corners the same lane.
      let states=[{last:0,cost:0,lanes:[]}];
      selected.forEach((feature,j)=>{const next=[];for(let lane=1;lane<=count-(selected.length-j);lane++){let best;for(const prev of states)if(prev.last<lane){const cost=prev.cost+(lane/count-feature.mean)**2;if(!best||cost<best.cost)best={last:lane,cost,lanes:[...prev.lanes,lane]};}if(best)next.push(best);}states=next;});
      const lanes=states.sort((a,b)=>a.cost-b.cost)[0]?.lanes||[];
      return {count,selected,lanes};
    });
    track.forEach((c,i)=>{const ring=[],owners=[];sides.forEach((side,k)=>{const knots=[{lane:0,t:0},...side.selected.map((x,j)=>({lane:side.lanes[j],t:x.hits[i].t})),{lane:side.count,t:1}];for(let a=1;a<knots.length;a++)for(let lane=knots[a-1].lane;lane<knots[a].lane;lane++){const u=(lane-knots[a-1].lane)/(knots[a].lane-knots[a-1].lane);ring.push(sample(arcs[i][k],knots[a-1].t+(knots[a].t-knots[a-1].t)*u));owners.push(sources[k]);}});c.ring=ring;c.owners=owners;c.v3ForkSeam={sources,lanes:[0,sides[0].count]};});
    report.push({rows:track.map(c=>c.sectionRow),lanes:sides.map(s=>s.count),seamLanes:[0,sides[0].count],landmarks:sides.map(s=>s.selected.map((f,i)=>({profile:f.profile,lane:s.lanes[i]})))});
  }
  return report;
}

function curveV3PlannedForkJunction(parent,children,vertices){
  if(children.some(c=>c.sectionRow<parent.sectionRow))return curveV2LateEntryJunctionAdaptive(parent,children,vertices,{preserveRings:true});
  const seam=parent.v3ForkSeam;if(!seam)throw Error('Missing planned fork seam');
  const ordered=seam.sources.map(s=>children.find(c=>c.sources.has(s))),split=seam.lanes[1],paths=[parent.indices.slice(0,split+1),parent.indices.slice(split).concat(parent.indices[0])],childPaths=[];
  for(let k=0;k<2;k++){
    const c=ordered[k];if(!c||c.indices.length!==paths[k].length)throw Error('Unsupported fork lane count');
    const n=c.rawRing.length,lengths=c.rawRing.map((p,i)=>v3.len(v3.sub(p,c.rawRing[(i+1)%n]))),offsets=[0];for(const d of lengths)offsets.push(offsets.at(-1)+d);const total=offsets.at(-1);
    const locate=p=>{let best;for(let i=0;i<n;i++){const a=c.rawRing[i],b=c.rawRing[(i+1)%n],d=v3.sub(b,a),t=clamp(v3.dot(v3.sub(p,a),d)/Math.max(1e-20,v3.dot(d,d))),distance=v3.len(v3.sub(p,v3.mix(a,b,t)));if(!best||distance<best.distance)best={distance,s:offsets[i]+lengths[i]*t};}return best.s;};
    const at=s=>{s=(s%total+total)%total;let i=0;while(i<n-1&&s>lengths[i])s-=lengths[i++];return v3.mix(c.rawRing[i],c.rawRing[(i+1)%n],s/Math.max(1e-20,lengths[i]));};
    const a=locate(vertices[paths[k][0]]),b=locate(vertices[paths[k].at(-1)]),num=paths[k].length-1,alternatives=[];
    for(const direction of [1,-1]){
      const span=(direction*(b-a)%total+total)%total;if(span<total*1e-6)continue;
      const targets=paths[k].map((id,j)=>{let t=(direction*(locate(vertices[id])-a)%total+total)%total/span;t=j===0?0:j===num?1:clamp(t);return t*.8+.2*j/num;});
      for(let j=1;j<num;j++)targets[j]=Math.max(targets[j-1]+.008,Math.min(1-(num-j)*.008,targets[j]));
      if(targets.some((t,j)=>!Number.isFinite(t)||(j&&t<=targets[j-1])))continue;
      const points=targets.map(t=>at(a+direction*span*t));alternatives.push({points,cost:points.reduce((sum,q,j)=>sum+v3.len(v3.sub(q,vertices[paths[k][j]])),0)});
    }
    alternatives.sort((a,b)=>a.cost-b.cost);if(!alternatives.length)throw Error('Collapsed fork side');
    const target=alternatives[0].points;let best;
    for(let phase=0;phase<c.indices.length;phase++)for(const direction of [1,-1]){const ids=target.map((_,i)=>c.indices[(phase+direction*i+c.indices.length*2)%c.indices.length]),cost=ids.reduce((sum,id,i)=>sum+v3.len(v3.sub(vertices[id],target[i])),0);if(!best||cost<best.cost)best={ids,cost};}
    best.ids.forEach((id,i)=>vertices[id]=target[i]);childPaths.push(best.ids);
  }
  const strip=(a,b)=>a.slice(1).map((_,i)=>[a[i],a[i+1],b[i+1],b[i]]),a=childPaths[0],b=childPaths[1];
  parent.v3PlannedFork=true;
  return [...strip(paths[0],a),...strip(paths[1],b),[a.at(-1),a[0],b.at(-1),b[0]],[paths[0][0],a[0],b.at(-1)],[paths[1][0],b[0],a.at(-1)]];
}

function curveV3PhysicalPairFallback(sweeps,source,seed,loops,options,auditMesh,scoreMesh){
  const a=seed.curveUnionV2Audit;
  if(options.physicalPairFallback===false||sweeps.length!==2||a?.hardValid||!a?.duplicateFaces||!a.validation.nonManifoldEdges||a.penetrations.trianglePairs||a.foldedQuads)return null;
  if(qualityOverlapGroups(sweeps,options.mergeDistance??.03).groups.length!==1)return null;
  const length=s=>s.frames.slice(1).reduce((sum,f,i)=>sum+v3.len(v3.sub(f.c,s.frames[i].c)),0),group=[...sweeps].sort((a,b)=>length(b)-length(a)||JSON.stringify(a.frames).localeCompare(JSON.stringify(b.frames)));
  if(curveV2LateEntryPlan(group))return null;
  const attempts=[],counts=[...new Set([Math.max(16,Math.min(32,Math.round(loops))),16])],configs=[...(options.plannedPairFork===false?[]:[20,16].flatMap(profileBudget=>counts.map(count=>({count,profileBudget,planned:true})))),...counts.map(count=>({count,profileBudget:16,planned:false}))];let best;
  for(const {count,profileBudget,planned} of configs)try{
    const stations=curveV2LateEntryStations(group,{guide:0,entries:[]},count);let rows,plan;
    let mesh=repairFoldedQuads(sectionContourMesh(group,count,{sectionStations:stations,sectionPrepareContours:(r,f)=>{if(planned)plan=curveV3PrepareForkContours(r,f,group,profileBudget);else curveV2LateEntryPrepareContours(r,f,group,{profileBudget:16,minimumCount:6,preserveFeatures:true});},sectionFinalizeContours:(r,v)=>{rows=r;if(planned)curveV2LateEntryTransport(r,v);},sectionJunctionBuilder:(p,c,v)=>planned?curveV3PlannedForkJunction(p,c,v):curveV2LateEntryJunctionAdaptive(p,c,v,{preserveRings:true}),sectionPreservePhase:true,sectionRingCount:12,preserveContourDeaths:true,geometricEventPartition:true,matchedEventPatch:true}));
    const attempt={rows:count,profileBudget,planned,accepted:false};attempts.push(attempt);
    const within=m=>m.objFaces.length<=source.objFaces.length&&m.faces.length<=source.faces.length&&m.vertices.length<=source.vertices.length;
    if(options.allowSourceBudgetExceeded!==true&&!within(mesh)){if(!planned){const reduced=curveV2ReduceSectionRows(mesh,rows,source);mesh=reduced.mesh;}if(!within(mesh)){attempt.reason='Source budget exceeded';continue;}}
    const audit=auditMesh(mesh,1);if(!audit.hardValid||audit.foldedQuads){attempt.reason='Geometry audit failed';continue;}
    const grade=scoreMesh(mesh,source,group);if(!qualityGeometryAcceptable(grade)||grade.metrics.gapBridgeFaces||mesh.contactBoundaryViolations||grade.scores.shape<seed.curveUnionV2Grade.scores.shape){attempt.reason='Source fit or contact check failed';continue;}
    const adjacency=mesh.vertices.map(()=>new Set());for(const f of mesh.objFaces)f.forEach((v,i)=>{const w=f[(i+1)%f.length];adjacency[v].add(w);adjacency[w].add(v);});
    const eps=v3.len(v3.sub(source.bounds.hi,source.bounds.lo))*1e-9,tipSet=new Set(mesh.vertices.flatMap((p,i)=>group.some(s=>v3.len(v3.sub(p,s.frames.at(-1).c))<=eps)?[i]:[])),flow=artistMeshDiagnostics(mesh,group,adjacency,tipSet);
    if(flow.railKinkMaxDegrees>75||flow.railKinkP95Degrees>45){attempt.reason='Rail flow limits exceeded';continue;}
    if(planned){
      const tracks=new Map();for(const row of rows)for(const c of row)if(c.v3ForkSeam){if(!tracks.has(c.phaseTrack))tracks.set(c.phaseTrack,[]);tracks.get(c.phaseTrack).push(c);}
      const rails=[...tracks.values()].flatMap(track=>track[0].v3ForkSeam.lanes.map(lane=>({vertices:track.map(c=>c.indices[lane])}))),forks=rows.flat().filter(c=>c.v3PlannedFork).map(c=>c.sectionRow);
      if(!forks.length||rails.some(r=>r.vertices.length<3||r.vertices.some((v,i)=>i&&!adjacency[v].has(r.vertices[i-1])))){attempt.reason='Disconnected planned seam';continue;}
      mesh.v3StructuralSeams={rails,supports:[],addedLanes:2,constructionRows:Math.max(...plan.map(p=>p.rows.length))};
      mesh.v3PlannedPairFork={tracks:plan,forkRows:forks,profileBudget};
    }
    attempt.accepted=true;attempt.polygons=mesh.objFaces.length;attempt.shape=grade.scores.shape;
    best={seed:{...mesh,expectedComponents:1,curveUnionV2Audit:audit,curveUnionV2Grade:grade,curveUnionV2Groups:[{strands:2,layout:planned?'3.0 seam-led pair fork':'3.0 physical pair recovery',preserved:false}]},report:{attempted:true,accepted:true,physicalPair:true,plannedFork:planned,reason:planned?'Source-owned seam layout into the fork':'Physical pair reconstruction after invalid atlas',attempts,flow:{maxDegrees:flow.railKinkMaxDegrees,p95Degrees:flow.railKinkP95Degrees,sourceTipPoles:tipSet.size}}};break;
  }catch(error){attempts.push({rows:count,profileBudget,planned,accepted:false,reason:error.message});}
  return best||null;
}

function curveV3PatchBoundary(faces){
  const edges=new Map(),key=(a,b)=>a<b?a+','+b:b+','+a;
  for(const f of faces)f.forEach((a,i)=>{const b=f[(i+1)%f.length],k=key(a,b);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);});
  if([...edges.values()].some(e=>e.length>2))return null;
  const border=[...edges.values()].filter(e=>e.length===1).map(e=>e[0]),neighbors=new Map();
  for(const [a,b]of border){for(const [u,v]of [[a,b],[b,a]]){if(!neighbors.has(u))neighbors.set(u,[]);neighbors.get(u).push(v);}}
  if(!border.length||[...neighbors.values()].some(n=>n.length!==2))return null;
  const loop=[border[0][0]];while(loop.length<=border.length){const next=neighbors.get(loop.at(-1)).find(v=>v!==loop.at(-2));if(next===loop[0])return loop.length===border.length?loop:null;if(loop.includes(next))return null;loop.push(next);}return null;
}

function curveV3LocalGraftCandidates(back,graft){
  const host=graft.sourceGraftPatch?.hostIds;if(!host)return [];
  const patch=graft.objFaces.filter(f=>f.some(v=>host[v]===undefined)),border=curveV3PatchBoundary(patch);
  if(!border||border.some(v=>host[v]===undefined)||patch.flat().some(v=>host[v]!==undefined&&!border.includes(v)))return [];
  const count=(border.length-2)/2;if(!Number.isInteger(count)||count<1||count>5)return [];
  const key=(a,b)=>a<b?a+','+b:b+','+a,edgeFaces=new Map();back.objFaces.forEach((f,i)=>f.forEach((a,j)=>{const k=key(a,f[(j+1)%f.length]);if(!edgeFaces.has(k))edgeFaces.set(k,[]);edgeFaces.get(k).push(i);}));
  const protectedIds=new Set([...(back.v3StructuralSeams?.rails||[]),...(back.v3StructuralSeams?.supports||[])].flatMap(r=>r.vertices));
  const centroid=ps=>v3.scale(ps.reduce((a,b)=>v3.add(a,b),[0,0,0]),1/ps.length),center=centroid(border.map(v=>graft.vertices[v])),diameter=Math.max(...border.flatMap(a=>border.map(b=>v3.len(v3.sub(graft.vertices[a],graft.vertices[b])))));
  const starts=back.objFaces.map((f,i)=>({i,d:v3.len(v3.sub(centroid(f.map(v=>back.vertices[v])),center))})).sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,24),matches=[],seen=new Set();
  for(const {i}of starts)for(let direction=0;direction<4;direction++){
    let ids=[i],current=i,edge=direction;
    while(ids.length<count){const f=back.objFaces[current];if(f.length!==4)break;const k=key(f[edge],f[(edge+1)%4]),next=edgeFaces.get(k)?.find(j=>j!==current);if(next===undefined||ids.includes(next)||back.objFaces[next].length!==4)break;const g=back.objFaces[next],entry=g.findIndex((v,j)=>key(v,g[(j+1)%4])===k);ids.push(next);current=next;edge=(entry+2)%4;}
    if(ids.length!==count)continue;const hash=[...ids].sort((a,b)=>a-b).join(',');if(seen.has(hash))continue;seen.add(hash);
    const cut=ids.map(i=>back.objFaces[i]);if(cut.some(f=>f.length!==4)||cut.flat().some(v=>protectedIds.has(v)))continue;
    const loop=curveV3PatchBoundary(cut);if(!loop||loop.length!==border.length)continue;let best;
    for(let phase=0;phase<loop.length;phase++)for(const direction of [1,-1]){const target=border.map((_,j)=>loop[(phase+direction*j+loop.length*2)%loop.length]),distances=target.map((v,j)=>v3.len(v3.sub(back.vertices[v],graft.vertices[border[j]]))),cost=distances.reduce((a,b)=>a+b*b,0);if(!best||cost<best.cost)best={target,cost,max:Math.max(...distances)};}
    if(best.max>diameter*.3||Math.sqrt(best.cost/border.length)>diameter*.18)continue;
    matches.push({ids,...best});
  }
  matches.sort((a,b)=>a.cost-b.cost||a.ids[0]-b.ids[0]);const candidates=[];
  for(const match of matches.slice(0,8)){
    const map=new Map(border.map((v,i)=>[v,match.target[i]])),vertices=back.vertices.map(p=>[...p]);
    for(const f of patch)for(const v of f)if(!map.has(v)){map.set(v,vertices.length);vertices.push([...graft.vertices[v]]);}
    const removed=new Set(match.ids),faces=back.objFaces.filter((_,i)=>!removed.has(i)).concat(patch.map(f=>f.map(v=>map.get(v)))),mesh=curveV3SourceGraftFinish(vertices,faces);if(!mesh)continue;
    const remap=mesh.graftVertexMap;delete mesh.graftVertexMap;
    if(back.vertices.some((p,i)=>!remap.has(i)||p.some((x,k)=>mesh.vertices[remap.get(i)][k]!==x)))continue;
    const baseVertexMap=back.vertices.map((_,i)=>remap.get(i)),mapRails=(rs,m)=>rs.map(r=>({...r,vertices:r.vertices.map(m)}));
    mesh.v3StructuralSeams={rails:[...mapRails(back.v3StructuralSeams.rails,v=>remap.get(v)),...mapRails(graft.v3StructuralSeams.rails,v=>remap.get(map.get(v)))],supports:mapRails(back.v3StructuralSeams.supports||[],v=>remap.get(v)),addedLanes:back.v3StructuralSeams.addedLanes+graft.v3StructuralSeams.addedLanes};
    mesh.v3PlannedPairFork=structuredClone(back.v3PlannedPairFork);
    mesh.v3PairwiseComposition={basePolygons:back.objFaces.length,removedBaseFaces:match.ids,addedPatchFaces:patch.length,baseVertexMap,baseVerticesUnchanged:true,keptBaseFaces:back.objFaces.length-match.ids.length,sharedHostOnce:true,boundaryMaxShift:match.max,accessoryGraft:{...graft.sourceGraft}};
    candidates.push(mesh);
  }
  return candidates;
}

async function curveV3PairwiseAssembly(sweeps,source,loops,smoothing,onProgress,options,auditMesh,scoreMesh){
  if(options.pairwiseAssembly===false||sweeps.length!==3||options.sourceGraft===false||options.plannedPairFork===false||options.structuralSeams===false)return null;
  const plans=[];
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const p=curveV3SourceGraftPlan([sweeps[i],sweeps[j]]);if(!p)continue;const other=sweeps.find(s=>!p.s.includes(s));if(qualityOverlapGroups([p.s[1],other],options.mergeDistance??.03).groups.length!==2)continue;plans.push({p,other});}
  if(plans.length!==1)return null;
  const report={attempted:true,accepted:false,pairwise:true,attempts:[]};
  try{
    const {p,other}=plans[0],subOptions={...options,pairwiseAssembly:false,volumeRecovery:0};
    onProgress(.03,'Curve Union 3.0: building independent back pair');
    const back=await curveUnionV3([p.s[0],other],loops,smoothing,()=>{},subOptions);
    if(!back.curveUnionV3ExportSafe||!back.v3PlannedPairFork){report.reason='No approved seam-led back pair';return {report};}
    onProgress(.35,'Curve Union 3.0: building local accessory patch');
    const graft=await curveUnionV3(p.s,loops,smoothing,()=>{},subOptions);
    if(!graft.curveUnionV3ExportSafe||!graft.sourceGraftPatch){report.reason='No source-preserving accessory graft';return {report};}
    onProgress(.6,'Curve Union 3.0: matching the local patch boundary');
    for(const mesh of curveV3LocalGraftCandidates(back,graft)){
      const attempt={polygons:mesh.objFaces.length,removedFaces:mesh.v3PairwiseComposition.removedBaseFaces,accepted:false};report.attempts.push(attempt);
      if(options.allowSourceBudgetExceeded!==true&&(mesh.objFaces.length>source.objFaces.length||mesh.faces.length>source.faces.length||mesh.vertices.length>source.vertices.length)){attempt.reason='Source budget exceeded';continue;}
      const audit=auditMesh(mesh,1);if(!audit.hardValid||audit.foldedQuads){attempt.reason='Combined geometry check failed';continue;}
      const grade=scoreMesh(mesh,source,sweeps);if(!qualityGeometryAcceptable(grade)||grade.metrics.gapBridgeFaces||mesh.contactBoundaryViolations||grade.scores.shape<Math.min(back.curveUnionV3Grade.scores.shape,graft.curveUnionV3Grade.scores.shape)-2){attempt.reason='Combined source fit/contact failed';continue;}
      const adjacency=mesh.vertices.map(()=>new Set());for(const f of mesh.objFaces)f.forEach((a,i)=>{const b=f[(i+1)%f.length];adjacency[a].add(b);adjacency[b].add(a);});
      if(mesh.v3StructuralSeams.rails.some(r=>r.vertices.some((v,i)=>v===undefined||!mesh.vertices[v]||(i&&!adjacency[v].has(r.vertices[i-1]))))){attempt.reason='Disconnected composed seam';continue;}
      const epsilon=v3.len(v3.sub(source.bounds.hi,source.bounds.lo))*1e-9,tips=new Set(mesh.vertices.flatMap((p,i)=>sweeps.some(s=>v3.len(v3.sub(p,s.frames.at(-1).c))<=epsilon)?[i]:[])),flow=artistMeshDiagnostics(mesh,sweeps,adjacency,tips);
      if(tips.size!==3||flow.railKinkMaxDegrees>75||flow.railKinkP95Degrees>45){attempt.reason='Combined rail flow failed';continue;}
      attempt.accepted=true;report.accepted=true;report.reason='Local accessory graft on preserved back pair';report.flow={maxDegrees:flow.railKinkMaxDegrees,p95Degrees:flow.railKinkP95Degrees,sourceTipPoles:tips.size};
      return {seed:{...mesh,expectedComponents:1,curveUnionV2Audit:audit,curveUnionV2Grade:grade,curveUnionV2Groups:[{strands:3,layout:'3.0 local pair composition',preserved:false}]},report};
    }
    report.reason='No safe independent patch boundary';
  }catch(error){report.reason=error.message;}
  return {report};
}

async function curveUnionV3(sweeps,loops=16,smoothing=.55,onProgress=()=>{},options={}){
  const started=Date.now(),source=buildSourceMesh(sweeps),allowExtra=options.allowSourceBudgetExceeded===true,withinSourceBudget=m=>m.objFaces.length<=source.objFaces.length&&m.faces.length<=source.faces.length&&m.vertices.length<=source.vertices.length,budget=m=>allowExtra||withinSourceBudget(m),edits=[];
  const timing={criticMs:0,validationMs:0,criticCalls:0},timed=(field,fn)=>(...args)=>{const start=Date.now();try{return fn(...args);}finally{timing[field]+=Date.now()-start;if(field==='criticMs')timing.criticCalls++;}},auditMesh=timed('validationMs',curveUnionV2AuditMesh),scoreMesh=timed('criticMs',curveUnionV2GradeMesh);
  const baseOptions={...options,volumeRecovery:0,onTiming:t=>{for(const key of Object.keys(timing))timing[key]+=t[key]||0;}};
  let seed,baseFallback;
  const assembly=await curveV3PairwiseAssembly(sweeps,source,loops,smoothing,onProgress,baseOptions,auditMesh,scoreMesh);
  if(assembly?.seed){seed=assembly.seed;baseFallback=assembly.report;edits.push({operation:'insert independent accessory patch on approved back pair',...seed.v3PairwiseComposition});}
  try{if(!seed)seed=await curveUnionV2(sweeps,loops,smoothing,(p,s)=>onProgress(p*.65,s.replace('2.0','3.0 base')),baseOptions);}
  catch(error){
    if(error.message!=='Curve Union 2.0 could not build a safe late-entry mesh within the original sweep polygon budget. The original sweeps are unchanged.')throw error;
    onProgress(.66,'Curve Union 3.0: trying seam-aware source-budget fallback');await new Promise(r=>setTimeout(r,0));
    const fallback=curveV3LateEntryFallback(sweeps,source,options,auditMesh,scoreMesh);baseFallback=fallback.report;seed=fallback.seed;
    if(!seed){const failure=new Error(allowExtra?'Curve Union 3.0 could not build a safe late-entry mesh even with the source budget relaxed. The seam-aware alternatives failed geometry, contact, or flow checks, or the layout is unsupported. The original sweeps are unchanged.':'Curve Union 3.0 could not build a safe late-entry mesh within the original sweep budget. Its base mesh exceeded the budget, and no safe seam-aware fallback was available. The original sweeps are unchanged.',{cause:error});failure.curveUnionV3Fallback=baseFallback;throw failure;}
    edits.push({operation:baseFallback.sourceGraft?'build source-preserving side graft':'build seam-aware starting mesh after base budget rejection',polygonsAfter:seed.objFaces.length,seams:seed.v3StructuralSeams});
  }
  if(!baseFallback){const recovered=curveV3PhysicalPairFallback(sweeps,source,seed,loops,options,auditMesh,scoreMesh);if(recovered){edits.push({operation:'rebuild invalid two-strand atlas from physical sections',polygonsBefore:seed.objFaces.length,polygonsAfter:recovered.seed.objFaces.length});seed=recovered.seed;baseFallback=recovered.report;}}
  const hasPreserved=seed.curveUnionV2Groups?.some(g=>g.preserved),protectedPositions=new Set();
  if(hasPreserved)for(const group of qualityOverlapGroups(sweeps,clamp(options.mergeDistance===undefined?.03:Number(options.mergeDistance)||0,0,.75)).groups)if(group.length===1)for(const p of sourceSweepMesh(group[0]).vertices)protectedPositions.add(p.join(','));
  let mesh=seed,audit=seed.curveUnionV2Audit,grade=seed.curveUnionV2Grade,quality=curveV3Quality(mesh);
  const baselineGrade=grade,reference={polygons:mesh.objFaces.length,quality,grade:grade.total,shape:grade.scores.shape};
  const accept=(candidate,label)=>{
    if(candidate===mesh||!budget(candidate))return false;
    const q=curveV3Quality(candidate);if((q.energy>quality.energy*.99&&candidate.objFaces.length>=mesh.objFaces.length)||q.warped>quality.warped||q.acute>quality.acute||q.thin>quality.thin)return false;
    const a=auditMesh(candidate,mesh.expectedComponents||audit.expectedComponents);if(!a.hardValid||a.foldedQuads)return false;
    const g=scoreMesh(candidate,source,sweeps),b=grade.metrics,c=g.metrics,ref=baselineGrade.metrics;
    // Fit losses are capped against the original seed, not accumulated each
    // iteration. Coverage bins are discrete; allow one small-bin sample loss.
    if(!qualityGeometryAcceptable(g)||c.gapBridgeFaces||g.scores.shape<baselineGrade.scores.shape-2||c.normalizedChamfer>ref.normalizedChamfer*1.08+1e-6||c.minimumSourceCoverage<ref.minimumSourceCoverage-3||c.minimumAxialCoverage<ref.minimumAxialCoverage-8||c.railKinkP95Degrees>b.railKinkP95Degrees+1||c.railKinkMaxDegrees>b.railKinkMaxDegrees+2||q.warped>quality.warped||q.acute>quality.acute||q.thin>quality.thin||c.badJunctionValence>b.badJunctionValence||c.bodyPoleVertices>b.bodyPoleVertices||c.illegalTrackTerminations>b.illegalTrackTerminations)return false;
    edits.push({operation:label,polygonsBefore:mesh.objFaces.length,polygonsAfter:candidate.objFaces.length,qualityBefore:quality,qualityAfter:q,movedVertices:candidate.v3MovedVertices||0,...(candidate.v3StripRefinement?{strip:candidate.v3StripRefinement}:{}),...(candidate.v3CollapsedStrip?{collapse:candidate.v3CollapsedStrip}:{})});mesh=candidate;audit=a;grade=g;quality=q;return true;
  };
  if(!baseFallback&&audit.hardValid&&budget(mesh)&&mesh.vertices.length<=12000){
    if(!hasPreserved)accept(curveUnionV2DissolveTriangles(mesh,sweeps),'dissolve redundant triangle pairs');
    if(!hasPreserved&&mesh.vertices.length<=4000)for(const candidate of quadRotationMutations(mesh,6))if(accept(candidate,'redirect two-quad patch'))break;
    for(let pass=0;pass<2&&smoothing>0;pass++){
      onProgress(.7+pass*.1,'Curve Union 3.0: fairing quad flow');await new Promise(r=>setTimeout(r,0));let improved=false;
      for(const strength of [.4,.2,.08])if(accept(curveV3FairSurface(mesh,sweeps,strength*Math.max(.1,clamp(smoothing)),protectedPositions),'coupled quad flow')){improved=true;break;}
      if(!improved)break;
    }
    if(!hasPreserved)accept(curveUnionV2DissolveTriangles(mesh,sweeps),'dissolve redundant triangle pairs');
  }
  if(!baseFallback&&audit.hardValid&&budget(mesh)&&mesh.vertices.length<=4000&&smoothing>0&&options.junctionStripFit!==false){
    onProgress(.92,'Curve Union 3.0: fitting continuous junction strips');await new Promise(r=>setTimeout(r,0));
    for(const strength of [.15,.06,.025])if(accept(curveV3FairJunctionStrips(mesh,sweeps,strength*clamp(smoothing)/.55,protectedPositions),'continuous junction strip fit'))break;
  }
  if(!baseFallback&&audit.hardValid&&budget(mesh)&&mesh.vertices.length<=4000&&options.thinStripCleanup!==false){
    let attempts=0;
    for(let pass=0;pass<8&&attempts<12;pass++){
      onProgress(.93,'Curve Union 3.0: removing redundant thin strips');await new Promise(r=>setTimeout(r,0));
      let improved=false;for(const candidate of curveV3ThinStripCandidates(mesh,sweeps,protectedPositions)){
        const q=curveV3Quality(candidate);
        if(q.thin>=quality.thin||q.energy>quality.energy*1.02||q.warped>quality.warped||q.acute>quality.acute)continue;
        if(attempts++>=12)break;
        if(accept(candidate,'collapse redundant thin strip')){improved=true;break;}
      }
      if(!improved)break;
    }
  }
  if(!baseFallback&&audit.hardValid&&budget(mesh)&&mesh.vertices.length<=4000&&options.thinStripCleanup!==false&&options.terminalStripCleanup!==false){
    let attempts=0;
    for(let pass=0;pass<4&&attempts<8;pass++){
      onProgress(.95,'Curve Union 3.0: simplifying triangular strip endings');await new Promise(r=>setTimeout(r,0));
      let improved=false;for(const candidate of curveV3ThinStripCandidates(mesh,sweeps,protectedPositions,true)){
        const q=curveV3Quality(candidate);if(q.thin>=quality.thin||q.energy>quality.energy*1.02||q.warped>quality.warped||q.acute>quality.acute)continue;
        if(attempts++>=8)break;
        if(accept(candidate,'collapse triangular strip ending')){improved=true;break;}
      }
      if(!improved)break;
    }
  }
  // Seam-first candidate has its own acceptance policy. Thin strips adjacent
  // to a measured physical seam are allowed; holes, folds and overspending
  // the source budget are not. Ordinary 3.0 cleanup above keeps its guards.
  let seamReport=baseFallback?{...baseFallback,fallback:true}:{attempted:false,accepted:false};
  if(!baseFallback&&options.structuralSeams!==false&&audit.hardValid&&!hasPreserved&&sweeps.length<=6&&seed.curveUnionV2Groups?.length===1&&seed.curveUnionV2Groups[0].lateEntry){
    onProgress(.96,'Curve Union 3.0: reserving physical strand seams');await new Promise(r=>setTimeout(r,0));
    seamReport.attempted=true;
    for(const supportLimit of [4,2,1,0])try{
      const candidate=curveV3SeamCandidate(sweeps,supportLimit,options);
      if(candidate&&budget(candidate)){
        const checked=auditMesh(candidate,audit.expectedComponents),q=curveV3Quality(candidate);
        if(checked.hardValid&&!checked.foldedQuads){
          const scored=scoreMesh(candidate,source,sweeps),a=grade.metrics,b=scored.metrics,diagonal=v3.len(v3.sub(mesh.bounds.hi,mesh.bounds.lo)),beforeError=curveV3SeamError(mesh,candidate),afterError=curveV3SeamError(candidate,candidate);
          const accepted=qualityGeometryAcceptable(scored)&&!b.gapBridgeFaces&&scored.scores.shape>=grade.scores.shape-2&&b.normalizedChamfer<=a.normalizedChamfer*1.08+1e-6&&b.minimumSourceCoverage>=a.minimumSourceCoverage-4&&b.minimumAxialCoverage>=a.minimumAxialCoverage-8&&b.badJunctionValence<=a.badJunctionValence&&b.bodyPoleVertices<=a.bodyPoleVertices&&b.illegalTrackTerminations<=a.illegalTrackTerminations&&scored.scores.flow>=grade.scores.flow&&q.acute<=quality.acute&&q.warped<=quality.warped+3&&b.railKinkMaxDegrees<=Math.max(75,a.railKinkMaxDegrees)&&b.railKinkP95Degrees<=Math.max(45,a.railKinkP95Degrees)&&beforeError>diagonal*.0005&&afterError<beforeError*.1;
          seamReport={attempted:true,accepted,supportLimit,beforeError,afterError,polygons:candidate.objFaces.length,qualityBefore:quality,qualityAfter:q,reason:accepted?'Persistent source-owner boundaries reserved as connected rails':'Seam candidate failed fit or flow safeguards'};
          if(accepted){
            edits.push({operation:'reserve structural strand seams',polygonsBefore:mesh.objFaces.length,polygonsAfter:candidate.objFaces.length,qualityBefore:quality,qualityAfter:q,seams:candidate.v3StructuralSeams});
            // Keep source-group diagnostics, but the final audit/grade below
            // always describe the new mesh, not the 2.0 seed.
            candidate.curveUnionV2Groups=mesh.curveUnionV2Groups;mesh=candidate;audit=checked;grade=scored;quality=q;break;
          }
        }else seamReport.reason='Seam candidate failed geometry audit';
      }else seamReport.reason='No supported continuous seam within source budget';
    }catch(error){seamReport.reason=error.message;}
  }
  if(Number(options.volumeRecovery)>0&&audit.hardValid){
    onProgress(.96,'Curve Union 3.0: guarded volume recovery');
    const beforeRecovery=mesh,beforeRecoveryGrade=grade;
    const recovery=curveUnionV2RecoverVolume(mesh,sweeps,options.volumeRecovery,audit,grade,scoreMesh,auditMesh);
    const q=curveV3Quality(recovery.mesh);
    const seamMoved=(mesh.v3StructuralSeams&&[...mesh.v3StructuralSeams.rails,...mesh.v3StructuralSeams.supports].some(rail=>rail.vertices.some(i=>v3.len(v3.sub(mesh.vertices[i],recovery.mesh.vertices[i]))>1e-10)))||mesh.v3PairwiseComposition?.baseVertexMap.some(i=>mesh.vertices[i].some((x,k)=>x!==recovery.mesh.vertices[i][k]));
    if(!seamMoved&&q.warped<=quality.warped&&q.acute<=quality.acute&&q.thin<=quality.thin&&q.energy<=quality.energy*1.1){mesh=recovery.mesh;audit=recovery.audit;grade=recovery.grade;mesh.volumeRecovery=recovery.report;quality=q;}
    else mesh={...mesh,volumeRecovery:{...recovery.report,accepted:false,movedVertices:0,reason:seamMoved?'3.0 retained physical seam positions':'3.0 retained the pre-recovery mesh to protect quad quality'}};
    if(options.sectionLoopFit!==false&&!hasPreserved){
      const baselineQuality=quality,baselineGrade=grade,passes=[];
      for(let pass=0;pass<2;pass++){
        onProgress(.97,'Curve Union 3.0: fitting source cross-section loops');
        const fitted=curveV3FitSectionLoops(mesh,sweeps,options.volumeRecovery,audit,grade,scoreMesh,auditMesh);
        passes.push(fitted.report);if(!fitted.report.accepted)break;
        const q=curveV3Quality(fitted.mesh),a=baselineGrade.metrics,b=fitted.grade.metrics;
        // Bound cumulative change, not just the increment of each iteration.
        if(q.energy>baselineQuality.energy*1.15||b.railKinkP95Degrees>a.railKinkP95Degrees+1||b.railKinkMaxDegrees>a.railKinkMaxDegrees+2||b.densityRegularityScore<a.densityRegularityScore-2||fitted.grade.scores.flow<baselineGrade.scores.flow-1){passes[passes.length-1]={...fitted.report,accepted:false,movedVertices:0,reason:'Cumulative flow guard retained the previous fit'};break;}
        mesh=fitted.mesh;audit=fitted.audit;grade=fitted.grade;quality=q;
      }
      mesh={...mesh,curveUnionV3SectionFit:{accepted:passes.some(p=>p.accepted),passes}};
      if(mesh.curveUnionV3SectionFit.accepted){
        const distances=mesh.vertices.map((p,i)=>v3.len(v3.sub(p,beforeRecovery.vertices[i])));
        mesh.volumeRecovery={...mesh.volumeRecovery,strength:Number(options.volumeRecovery),accepted:true,limitedToLegacy:false,movedVertices:distances.filter(d=>d>1e-10).length,maxDisplacement:Math.max(...distances),beforeChamfer:beforeRecoveryGrade.metrics.normalizedChamfer,afterChamfer:grade.metrics.normalizedChamfer,reason:'Guarded normal and cross-section loop fit accepted'};
      }
    }
  }
  const safe=audit.hardValid&&!audit.foldedQuads&&qualityGeometryAcceptable(grade)&&!grade.metrics.gapBridgeFaces&&!mesh.contactBoundaryViolations&&budget(mesh);
  const result={...mesh,topologyMode:'curve-union-v3',generationStrategy:'curve-union-v3',curveUnionV3Audit:audit,curveUnionV3Grade:grade,curveUnionV3ExportSafe:safe,curveUnionV3Edits:edits,curveUnionV3Baseline:reference,curveUnionV3Quality:quality,curveUnionV3ArtistReady:safe&&grade.artistQualityTarget===true,curveUnionV3SourceBudget:{source:{polygons:source.objFaces.length,triangles:source.faces.length,vertices:source.vertices.length},result:{polygons:mesh.objFaces.length,triangles:mesh.faces.length,vertices:mesh.vertices.length},withinBudget:withinSourceBudget(mesh),allowed:budget(mesh),allowSourceBudgetExceeded:allowExtra}};
  // Compatibility for existing summaries; do not retain the seed's stale grade.
  result.curveUnionV3SeamReport=seamReport;
  if(assembly)result.curveUnionV3PairwiseReport=assembly.report;
  if(baseFallback)result.curveUnionV3BaseFallback=baseFallback;
  result.curveUnionV2Audit=audit;result.curveUnionV2Grade=grade;result.curveUnionV2ExportSafe=safe;result.curveUnionV2SourceBudget=result.curveUnionV3SourceBudget;result.curveUnionV2RailFlowAccepted=grade.metrics.railKinkMaxDegrees<=60&&grade.metrics.railKinkP95Degrees<=25;
  onProgress(1,safe?'Curve Union 3.0 ready — inspect flow':'Curve Union 3.0 preview — geometry or source budget requires review');
  if(options.onTiming){const totalMs=Date.now()-started;options.onTiming({...timing,totalMs,constructionAndOtherMs:Math.max(0,totalMs-timing.criticMs-timing.validationMs)});}
  return result;
}

return curveUnionV3;
}
export const curveUnionV3 = createCurveUnionRuntime();
