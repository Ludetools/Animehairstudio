// Imported AHS source-parity sweep conversion dependency closure; do not hand-edit.
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

const arr = p => [Number(p.x)||0, Number(p.y)||0, Number(p.z)||0];

const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));

function curveValue(keys, t, fallback=1) {
  if (!Array.isArray(keys)||!keys.length) return fallback;
  const ordered=[...keys].sort((a,b)=>a.position-b.position);
  if(t<=ordered[0].position)return ordered[0].value;
  if(t>=ordered[ordered.length-1].position)return ordered[ordered.length-1].value;
  let edge=0;while(edge<ordered.length-2&&ordered[edge+1].position<t)edge++;
  const a=ordered[edge],b=ordered[edge+1],span=Math.max(EPS,b.position-a.position),u=(t-a.position)/span;
  if(a.interpolation==='linear'||b.interpolation==='linear')return a.value+(b.value-a.value)*u;
  // Monotone cubic Hermite interpolation keeps the slope continuous through
  // taper controls without overshooting. Per-segment smoothstep made every key
  // artificially flat, producing visible shoulders and uneven strand width.
  const spans=ordered.slice(0,-1).map((point,index)=>Math.max(EPS,ordered[index+1].position-point.position));
  const slopes=spans.map((length,index)=>(ordered[index+1].value-ordered[index].value)/length);
  const tangent=index=>{
    if(index<=0)return slopes[0];if(index>=ordered.length-1)return slopes[slopes.length-1];
    const previous=slopes[index-1],next=slopes[index];if(previous*next<=0)return 0;
    const previousSpan=spans[index-1],nextSpan=spans[index],firstWeight=2*nextSpan+previousSpan,secondWeight=nextSpan+2*previousSpan;
    return (firstWeight+secondWeight)/(firstWeight/previous+secondWeight/next);
  };
  const m0=tangent(edge),m1=tangent(edge+1),u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a.value+(u3-2*u2+u)*span*m0+(-2*u3+3*u2)*b.value+(u3-u2)*span*m1;
}

function extrapolate(a,b){return v3.sub(v3.scale(a,2),b);}

function catmullCentripetal(points,t){
  if(points.length===2)return v3.mix(points[0],points[1],clamp(t));
  const n=points.length-1,q=clamp(t)*n,i=Math.min(n-1,Math.floor(q)),u=q-i;
  const p1=points[i],p2=points[i+1],p0=i?points[i-1]:extrapolate(p1,p2),p3=i+2<points.length?points[i+2]:extrapolate(p2,p1);
  const step=(a,b)=>Math.max(Math.sqrt(v3.len(v3.sub(b,a))),1e-4),k0=0,k1=step(p0,p1),k2=k1+step(p1,p2),k3=k2+step(p2,p3),k=k1+(k2-k1)*u;
  const blend=(a,b,ka,kb)=>v3.mix(a,b,(k-ka)/Math.max(kb-ka,EPS));
  const a1=blend(p0,p1,k0,k1),a2=blend(p1,p2,k1,k2),a3=blend(p2,p3,k2,k3);
  const b1=v3.mix(a1,a2,(k-k0)/Math.max(k2-k0,EPS)),b2=v3.mix(a2,a3,(k-k1)/Math.max(k3-k1,EPS));
  return v3.mix(b1,b2,(k-k1)/Math.max(k2-k1,EPS));
}

function spacedCurve(points,count){
  const fine=Math.max(200,count*12,points.length*48),samples=Array.from({length:fine+1},(_,i)=>catmullCentripetal(points,i/fine)),lengths=[0];
  for(let i=1;i<=fine;i++)lengths.push(lengths[i-1]+v3.len(v3.sub(samples[i],samples[i-1])));
  const total=lengths[fine];
  if(total<EPS)return {points:Array.from({length:count+1},()=>[...points[0]]),parameters:Array.from({length:count+1},(_,i)=>i/count)};
  let edge=1;
  const parameters=[],result=Array.from({length:count+1},(_,i)=>{
    const target=total*i/count;while(edge<fine&&lengths[edge]<target)edge++;
    const a=edge-1,b=edge,u=(target-lengths[a])/Math.max(lengths[b]-lengths[a],EPS);parameters.push((a+u)/fine);return catmullCentripetal(points,parameters[i]);
  });
  return {points:result,parameters};
}

function sampleGuideNormal(normals,t){
  if(!normals.length)return null;if(normals.length===1)return v3.norm(normals[0]);
  const q=clamp(t)*(normals.length-1),i=Math.min(normals.length-2,Math.floor(q)),u=q-i,a=v3.norm(normals[i]);let b=v3.norm(normals[i+1]);if(v3.dot(a,b)<0)b=v3.scale(b,-1);return v3.norm(v3.mix(a,b,u));
}

function pointInterpolated(values,t,fallback){
  if(!Array.isArray(values)||!values.length)return fallback;
  if(values.length===1)return Number(values[0]);
  return curveValue(values.map((value,index)=>({position:index/(values.length-1),value:Number(value),interpolation:'smooth'})),t,fallback);
}

function scaleInterpolated(values,t){
  if(!Array.isArray(values)||!values.length)return [1,1];
  const component=axis=>values.map(value=>Number.isFinite(Number(value?.[axis]))?Number(value[axis]):1);
  return [pointInterpolated(component('x'),t,1),pointInterpolated(component('z'),t,1)];
}

function rotateAround(v,axis,angle){
  const c=Math.cos(angle),s=Math.sin(angle),d=v3.dot(axis,v)*(1-c);
  return v3.add(v3.add(v3.scale(v,c),v3.scale(v3.cross(axis,v),s)),v3.scale(axis,d));
}

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

function buildLegacySweep(strand, defaults){
  const source=(strand.points||[]).map(arr); if(source.length<2)return null;
  const count=Math.max(4, Math.min(96, Number(strand.lengthSegments||defaults?.lengthSegments||26)));
  const sampled=spacedCurve(source,count),centers=sampled.points;
  const tangents=sampled.parameters.map(t=>{const h=1e-4,a=catmullCentripetal(source,Math.max(0,t-h)),b=catmullCentripetal(source,Math.min(1,t+h));return v3.norm(v3.sub(b,a));});
  const authoredNormals=(strand.pointSurfaceNormals||[]).map(arr);
  const normalInfluence=clamp(Number.isFinite(Number(strand.surfaceNormalInfluence))?Number(strand.surfaceNormalInfluence):(authoredNormals.length?1:0));
  let ref=Math.abs(tangents[0][1])<.9?[0,1,0]:[1,0,0];
  let transportX=v3.norm(v3.cross(ref,tangents[0])), transportZ=v3.norm(v3.cross(tangents[0],transportX));
  const frames=[];
  for(let i=0;i<=count;i++){
    if(i){const axis=v3.cross(tangents[i-1],tangents[i]),l=v3.len(axis);if(l>EPS)transportX=rotateAround(transportX,v3.scale(axis,1/l),Math.atan2(l,clamp(v3.dot(tangents[i-1],tangents[i]),-1,1)));transportZ=v3.norm(v3.cross(tangents[i],transportX));transportX=v3.norm(v3.cross(transportZ,tangents[i]));}
    let baseX=transportX,baseZ=transportZ;
    let authored=sampleGuideNormal(authoredNormals,i/count);
    if(authored&&normalInfluence>EPS){
      authored=v3.sub(authored,v3.scale(tangents[i],v3.dot(authored,tangents[i])));
      if(v3.len(authored)>EPS){authored=v3.norm(authored);if(v3.dot(authored,transportZ)<0)authored=v3.scale(authored,-1);baseZ=i? v3.norm(v3.mix(transportZ,authored,.16*normalInfluence)):authored;baseX=v3.norm(v3.cross(baseZ,tangents[i]));baseZ=v3.norm(v3.cross(tangents[i],baseX));}
    }
    // Carry the filtered frame forward; otherwise each sparse guide sample can
    // independently rotate the profile and reintroduce visible waviness.
    transportX=baseX;transportZ=baseZ;
    // AHS stores strandRotation in degrees, while twist and pointTwists are radians.
    // Apply them to a copy so a constant profile rotation does not accumulate per row.
    const t=i/count, twist=(Number(strand.strandRotation)||0)*Math.PI/180+(Number(strand.twist)||0)*t+pointInterpolated(strand.pointTwists,t,0),x=Math.abs(twist)>EPS?rotateAround(baseX,tangents[i],twist):[...baseX],z=v3.norm(v3.cross(tangents[i],x));
    const ps=scaleInterpolated(strand.pointScales,t), pw=pointInterpolated(strand.pointWidths,t,1);
    const width=(Number(strand.width)||Number(strand.baseWidth)||.16)*(Number(strand.widthScale)||1)*pw*ps[0]*curveValue(strand.taperCurve||defaults?.taperCurve,t,1);
    const depth=(Number(strand.depth)||.24)*(Number(strand.depthScale)||1)*ps[1]*curveValue(strand.depthCurve||defaults?.depthCurve,t,1);
    frames.push({c:centers[i],t:tangents[i],x,z,width:Math.max(width,1e-5),depth:Math.max(depth,1e-5)});
  }
  const raw=strand.sweepProfile||defaults?.sweepProfile;
  const profile=Array.isArray(raw)&&raw.length>=3?raw.map(p=>[Number(p.x)||0,Number(p.z)||0]):Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI*2/12),Math.sin(i*Math.PI*2/12)]);
  return {frames,profile,region:strand.scalpRegion||'unassigned',name:strand.name||strand.id||'strand'};
}

function sweepPoint(frame,profile){
  const coordinates=[0,1].map(axis=>{
    const value=profile[axis],dimension=axis?'depth':'width',negative=frame[dimension+'Negative']??frame[dimension],positive=frame[dimension+'Positive']??frame[dimension],center=frame[axis?'centerZ':'centerX']||0;
    const bounds=frame.profileBounds?.[axis]||[-1,1];
    return value*(value<0?negative:positive)+center*ahsSourceMath.profileTopologyCenterWeight(value,...bounds);
  });
  return v3.add(frame.c,v3.add(v3.scale(frame.x,coordinates[0]),v3.scale(frame.z,coordinates[1])));
}

function ahsTrimmedProfile(raw,strand){
  const points=raw.map(p=>({...p,x:Number(p.x),z:Number(p.z)+(Number(strand.profileOffset)||0)})),min=Math.min(...points.map(p=>p.x)),max=Math.max(...points.map(p=>p.x)),center=(min+max)/2;
  const left=min+(center-min)*clamp(Number(strand.profileTrimLeft)||0),right=max+(center-max)*clamp(Number(strand.profileTrimRight)||0),roundness=clamp(Number(strand.profileTrimRoundness??1)),blend=Math.max(.0001,(max-min)*.24*roundness);
  return points.map(p=>{
    let x=p.x;
    if(x<=left||roundness<=0)x=Math.max(x,left);else if(x<left+blend){const t=(x-left)/blend;x=left+blend*(-t*t*t+2*t*t);}
    if(x>=right||roundness<=0)x=Math.min(x,right);else if(x>right-blend){const t=(right-x)/blend;x=right-blend*(-t*t*t+2*t*t);}
    return {...p,x,interpolation:roundness<=.001&&Math.abs(x-p.x)>.0001?'linear':p.interpolation};
  });
}

const AHS_DEFAULT_PROFILE=[[1,-.31],[.94,-.18],[.55,.14],[0,.36],[-.55,.14],[-.94,-.18],[-1,-.31],[-.7,-.36],[.7,-.36]].map(([x,z],i)=>({x,z,interpolation:i===3?'linear':'smooth'}));

function buildSweep(strand,defaults){
  const source=(strand.points||[]).map(arr);if(source.length<2)return null;
  const unsupported=[strand.curlEnabled&&'curl',strand.strandSplitEnabled&&'split strand',strand.hairCard&&'hair card',(strand.curvePointSharpness||[]).some(x=>x>.0001)&&'sharp controls'].filter(Boolean);
  if(unsupported.length){const legacy=buildLegacySweep(strand,defaults);legacy.reconstructionWarnings=['Approximate source reconstruction: '+unsupported.join(', ')];return legacy;}
  const s={...defaults,...strand},M=ahsSourceMath,point=t=>catmullCentripetal(source,t),tangent=t=>v3.norm(v3.sub(point(Math.min(1,t+.0001)),point(Math.max(0,t-.0001))));
  // THREE.Curve's default arc-length lookup uses 200 subdivisions.
  const lengths=[0];let previous=point(0);
  for(let i=1;i<=200;i++){const p=point(i/200);lengths.push(lengths[i-1]+v3.len(v3.sub(p,previous)));previous=p;}
  const parameter=u=>{const target=clamp(u)*lengths[200];let i=1;while(i<200&&lengths[i]<target)i++;return (i-1+(target-lengths[i-1])/Math.max(EPS,lengths[i]-lengths[i-1]))/200;};
  const arcFraction=t=>{const q=clamp(t)*200,i=Math.min(199,Math.floor(q));return (lengths[i]+(lengths[i+1]-lengths[i])*(q-i))/Math.max(EPS,lengths[200]);};
  const count=Math.max(4,Math.min(256,Math.round(Number(s.lengthSegments)||26))),taper=(axis,t,sign=1)=>M.sampleAsymmetricTaperCurve(s[axis?'depthCurve':'taperCurve'],s[axis?'depthCurveSecondary':'taperCurveSecondary'],s[axis?'asymmetricDepthCurve':'asymmetricWidthCurve'],sign,t);
  const vector=a=>({normalize(){return this;},angleTo(b){return Math.acos(clamp(v3.dot(a,b.array),-1,1));},array:a});
  const fractions=s.dynamicDensity?M.adaptiveCurveParameters({getTangent:u=>vector(tangent(parameter(u)))},count,s.densityAggression,0,1,4,u=>(taper(0,parameter(u))+taper(0,parameter(u),-1))*.5,true,(a,b,c)=>M.twistCurveDensityDetail(s.twistCurve,parameter(a),parameter(b),parameter(c),s.twistDensity,count)):M.uniformCurveParameters(count);
  const parameters=fractions.map(parameter),raw=Array.isArray(s.sweepProfile)&&s.sweepProfile.length>=4?s.sweepProfile:AHS_DEFAULT_PROFILE,trimmed=ahsTrimmedProfile(raw,s),n=trimmed.length;
  const axis=trimmed.reduce((best,p,i)=>p.z>trimmed[best].z+.00001||(Math.abs(p.z-trimmed[best].z)<=.00001&&Math.abs(p.x)<Math.abs(trimmed[best].x))?i:best,0);
  const slots=M.symmetricClosedCurveParameters(Math.max(4,Math.min(24,Math.round(s.radialSegments||10))),axis/n,trimmed.flatMap((p,i)=>p.interpolation==='linear'?[i/n]:[]));
  const closed=[trimmed[n-1],...trimmed,trimmed[0],trimmed[1]].map(p=>[p.x,0,p.z]);
  const profile=slots.map(t=>{const q=t*n,i=Math.min(n-1,Math.floor(q)),a=trimmed[i],b=trimmed[(i+1)%n];if(a.interpolation==='linear'||b.interpolation==='linear')return [a.x+(b.x-a.x)*(q-i),a.z+(b.z-a.z)*(q-i)];const p=catmullCentripetal(closed,(q+1)/(n+2));return [p[0],p[2]];});
  const profileBounds=[0,1].map(k=>[Math.min(...profile.map(p=>p[k])),Math.max(...profile.map(p=>p[k]))]),normals=(s.pointSurfaceNormals||[]).map(arr),frames=[];
  const projected=(v,t)=>v3.sub(v,v3.scale(t,v3.dot(v,t)));
  const outward=(p,t)=>{let radial=v3.len(p)<.01?[0,0,1]:v3.norm(p);for(const candidate of [radial,[0,0,1],[1,0,0]]){const q=projected(candidate,t);if(v3.len(q)>EPS)return v3.norm(q);}return [0,0,1];};
  for(const t of parameters){
    const c=point(t),y=tangent(t);let z=outward(c,y),influence=clamp(Number(s.surfaceNormalInfluence??0));
    if(normals.length&&influence>.0001){const q=t*(normals.length-1),i=Math.floor(q),guide=v3.mix(normals[i],normals[Math.min(i+1,normals.length-1)],q-i),authored=projected(v3.len(guide)>.01?v3.norm(guide):v3.norm(normals[i]),y);if(v3.len(authored)>=.01){const normal=v3.norm(authored);if(v3.dot(z,normal)<0)z=v3.scale(z,-1);z=v3.norm(projected(v3.mix(z,normal,influence),y));}}
    const twist=(Number(s.strandRotation)||0)*Math.PI/180+M.sampleIntegratedEnvelopeCurve(s.twistCurve,t)*Math.PI/180+(Number(s.twist)||0)*t+M.sampleArray(s.pointTwists,t);
    z=rotateAround(z,y,twist);
    if(frames.length){const before=frames.at(-1),cross=v3.cross(before.t,y),length=v3.len(cross);let transported=before.z;if(length>EPS)transported=rotateAround(transported,v3.scale(cross,1/length),Math.atan2(length,clamp(v3.dot(before.t,y),-1,1)));transported=projected(transported,y);if(v3.len(transported)>=.01){transported=v3.norm(transported);if(v3.dot(z,transported)<0)z=v3.scale(z,-1);const roll=Math.atan2(v3.dot(v3.cross(transported,z),y),clamp(v3.dot(transported,z),-1,1));z=rotateAround(transported,y,clamp(roll,-Math.PI*24/180,Math.PI*24/180));}}
    const x=v3.norm(v3.cross(y,z));z=v3.norm(v3.cross(x,y));
    const widthBase=Number(s.baseWidth??s.width??.16)*Number(s.widthScale??1)*M.sampleScale(s.pointScales,t,'x'),depthBase=Number(s.depth??.16)*Number(s.depthScale??1)*M.sampleScale(s.pointScales,t,'z');
    const widthPositive=Math.max(0,widthBase*taper(0,t)),widthNegative=Math.max(0,widthBase*taper(0,t,-1)),depthPositive=Math.max(0,depthBase*taper(1,t)),depthNegative=Math.max(0,depthBase*taper(1,t,-1));
    const center=(k,pos,neg,enabled)=>s.centerAsymmetricProfile&&enabled?(Math.min(...profile.map(p=>p[k]*(p[k]<0?neg:pos)))+Math.max(...profile.map(p=>p[k]*(p[k]<0?neg:pos))))*.5:0;
    frames.push({c,t:y,x,z,width:Math.max(1e-5,widthPositive,widthNegative),depth:Math.max(1e-5,depthPositive,depthNegative),widthPositive,widthNegative,depthPositive,depthNegative,centerX:center(0,widthPositive,widthNegative,s.asymmetricWidthCurve),centerZ:center(1,depthPositive,depthNegative,s.asymmetricDepthCurve),profileBounds,parameter:t,arcFraction:arcFraction(t)});
  }
  return {frames,profile,region:s.scalpRegion||'unassigned',name:s.name||s.id||'strand',reconstruction:'ahs-source-parity-v1'};
}

return {buildSweep, sweepPoint};
}
export const {buildSweep, sweepPoint} = createCurveUnionRuntime();
