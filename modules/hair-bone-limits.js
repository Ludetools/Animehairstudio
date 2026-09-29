// Swing-only limits: Y is the bone aim, X strand width, Z strand depth.
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = v => {const n=Math.hypot(...v);return n>1e-12?v.map(x=>x/n):null;};
export function normalizeBoneLimit(value) {
  const angle = v => Number.isFinite(v) ? Math.max(0,Math.min(175,v)) : 45;
  const q=Array.isArray(value?.rotation)&&value.rotation.length===4&&value.rotation.every(Number.isFinite)?value.rotation:null;
  const length=q?Math.hypot(...q):0;
  const rotation=length>1e-12?q.map(v=>v/length*(q[3]<0?-1:1)):null;
  return {mode:['limited','locked'].includes(value?.mode)?value.mode:'free',
    sideways:angle(value?.sideways),forward:angle(value?.forward),
    ...(rotation&&Math.hypot(...rotation.slice(0,3))>1e-10?{rotation}:{})};
}

// Offset is relative to the bone frame, never world or camera axes.
export function offsetBoneLimitFrame(frame,value) {
  const q=normalizeBoneLimit(value).rotation;if(!q)return frame;
  const rotate=v=>{
    const u=q.slice(0,3),a=cross(u,v),b=cross(u,a);
    const local=v.map((n,i)=>n+2*(q[3]*a[i]+b[i]));
    return frame.x.map((_,i)=>frame.x[i]*local[0]+frame.y[i]*local[1]+frame.z[i]*local[2]);
  };
  return {x:rotate([1,0,0]),y:rotate([0,1,0]),z:rotate([0,0,1])};
}

export function rotateBoneLimit(value,axis,degrees) {
  const limit=normalizeBoneLimit(value),q=limit.rotation||[0,0,0,1];
  const index=['x','y','z'].indexOf(axis);
  if(index<0||!Number.isFinite(degrees))return limit;
  const half=degrees*Math.PI/360,r=[0,0,0,Math.cos(half)];r[index]=Math.sin(half);
  const vector=cross(q.slice(0,3),r.slice(0,3));
  return normalizeBoneLimit({...limit,rotation:[...vector.map((v,i)=>v+q[3]*r[i]+r[3]*q[i]),q[3]*r[3]-dot(q.slice(0,3),r.slice(0,3))]});
}

export function boneLimitRingPoint(axis,degrees) {
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return axis==='x'?[0,c,s]:axis==='y'?[c,0,-s]:[c,s,0];
}

export function mirrorBoneLimit(value, sourceFrame, targetFrame) {
  const limit=normalizeBoneLimit(value),oriented=offsetBoneLimitFrame(sourceFrame,limit);
  // Reflect across AHS world X; flip the width basis to retain a right-handed frame.
  const columns=['x','y','z'].map(key=>{
    const world=oriented[key].map((v,i)=>v*(i===0?-1:1)*(key==='x'?-1:1));
    return ['x','y','z'].map(axis=>dot(targetFrame[axis],world));
  });
  const m=(r,c)=>columns[c][r],trace=m(0,0)+m(1,1)+m(2,2);let q;
  if(trace>0) {
    const s=Math.sqrt(trace+1)*2;
    q=[(m(2,1)-m(1,2))/s,(m(0,2)-m(2,0))/s,(m(1,0)-m(0,1))/s,s/4];
  } else {
    let i=0;if(m(1,1)>m(i,i))i=1;if(m(2,2)>m(i,i))i=2;
    const j=(i+1)%3,k=(i+2)%3,s=Math.sqrt(Math.max(0,1+m(i,i)-m(j,j)-m(k,k)))*2;
    q=[0,0,0,0];q[i]=s/4;q[j]=(m(j,i)+m(i,j))/s;q[k]=(m(k,i)+m(i,k))/s;q[3]=(m(k,j)-m(j,k))/s;
  }
  return normalizeBoneLimit({...limit,rotation:q});
}

export function followParentVector(vector, restParent, posedParent) {
  const a=unit(restParent),b=unit(posedParent);
  if(!a||!b)return [...vector];
  const cosine=Math.max(-1,Math.min(1,dot(a,b)));
  if(cosine < -0.999999) {
    const axis=unit(cross(a,Math.abs(a[0])<0.9?[1,0,0]:[0,1,0]));
    return vector.map((v,i)=>2*axis[i]*dot(axis,vector)-v);
  }
  const axis=cross(a,b),first=cross(axis,vector),second=cross(axis,first);
  return vector.map((v,i)=>v+first[i]+second[i]/(1+cosine));
}

// Same moving parent-relative frame is consumed by both solver and viewport.
export function boneLimitFrame(rest, points, frame, index) {
  if(index===0)return frame;
  const a=rest[index].map((v,k)=>v-rest[index-1][k]);
  const b=points[index].map((v,k)=>v-points[index-1][k]);
  return Object.fromEntries(Object.entries(frame).map(([key,v])=>[key,followParentVector(v,a,b)]));
}

// Exponential-map ellipse: unlike tangent cones this also supports angles >90°.
export function swingDirection(sideways, forward) {
  const x=sideways*Math.PI/180,z=forward*Math.PI/180,angle=Math.hypot(x,z);
  const scale=angle>1e-12?Math.sin(angle)/angle:1;
  return [x*scale,Math.cos(angle),z*scale];
}

export function constrainBoneDirection(direction, frame, value) {
  const limit=normalizeBoneLimit(value),d=unit(direction);
  if(limit.mode==='free'||!d)return [...direction];
  frame=offsetBoneLimitFrame(frame,limit);
  if(limit.mode==='locked')return [...frame.y];
  const local=[dot(d,frame.x),dot(d,frame.y),dot(d,frame.z)];
  const angle=Math.acos(Math.max(-1,Math.min(1,local[1])))*180/Math.PI;
  const radius=Math.hypot(local[0],local[2]);
  let x=radius>1e-10?angle*local[0]/radius:angle,z=radius>1e-10?angle*local[2]/radius:0;
  if(limit.sideways===0)x=0;
  if(limit.forward===0)z=0;
  const extent=Math.hypot(limit.sideways?x/limit.sideways:0,limit.forward?z/limit.forward:0);
  if(extent>1){x/=extent;z/=extent;}
  const result=swingDirection(x,z);
  return frame.y.map((_,i)=>frame.x[i]*result[0]+frame.y[i]*result[1]+frame.z[i]*result[2]);
}

export function boneLimitOutline(value, segments=64) {
  const limit=normalizeBoneLimit(value);
  return Array.from({length:segments+1},(_,i)=>{
    const angle=i/segments*Math.PI*2;
    return swingDirection(limit.mode==='locked'?0:limit.sideways*Math.cos(angle),
      limit.mode==='locked'?0:limit.forward*Math.sin(angle));
  });
}
