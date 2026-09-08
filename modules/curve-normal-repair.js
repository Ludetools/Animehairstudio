const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=v=>{const n=v&&Math.hypot(v.x,v.y,v.z);return Number.isFinite(n)&&n>1e-8?{x:v.x/n,y:v.y/n,z:v.z/n}:null;};
export function rebuiltCurveNormals(tangents, rootNormal = null) {
  const perpendicular=(n,t)=>unit({x:n.x-t.x*dot(n,t),y:n.y-t.y*dot(n,t),z:n.z-t.z*dot(n,t)});
  const fallback=t=>{
    const axes=[{x:0,y:0,z:1},{x:0,y:1,z:0},{x:1,y:0,z:0}];
    axes.sort((a,b)=>Math.abs(dot(a,t))-Math.abs(dot(b,t)));
    return perpendicular(axes[0],t);
  };
  let previousTangent=null, normal=null;
  return tangents.map(value=>{
    const tangent=unit(value)||previousTangent||{x:0,y:1,z:0};
    if(!normal)normal=(unit(rootNormal)&&perpendicular(unit(rootNormal),tangent))||fallback(tangent);
    else {
      const c=dot(previousTangent,tangent),k=cross(previousTangent,tangent);
      if(c>-.999999) {
        const kv=cross(k,normal),kkv=cross(k,kv);
        normal={x:normal.x+kv.x+kkv.x/(1+c),y:normal.y+kv.y+kkv.y/(1+c),z:normal.z+kv.z+kkv.z/(1+c)};
      }
      normal=perpendicular(normal,tangent)||fallback(tangent);
    }
    previousTangent=tangent;return {...normal};
  });
}
// Parallel transport the previous normal through the tangent change before
// comparing signs. Curving through 180 degrees is not itself a normal flip.
export function flippedCurveNormalIndices(points, normals) {
  const flipped=[];
  let previous=null, previousTangent=null;
  for(let i=0;i<points.length;i++) {
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const tangent=unit({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z}) || previousTangent;
    let normal=unit(normals?.[i]);
    if(!normal)continue;
    let reference=previous;
    if(reference&&tangent&&previousTangent) {
      const c=dot(previousTangent,tangent),k=cross(previousTangent,tangent);
      if(c>-.999999) {
        const kv=cross(k,reference),kkv=cross(k,kv);
        reference={x:reference.x+kv.x+kkv.x/(1+c),y:reference.y+kv.y+kkv.y/(1+c),z:reference.z+kv.z+kkv.z/(1+c)};
      } else { previous=null; reference=null; } // Ambiguous cusp: do not invent a frame.
    }
    if(reference && dot(normal,reference)<-1e-6) {
      flipped.push(i);normal={x:-normal.x,y:-normal.y,z:-normal.z};
    }
    previous=normal;previousTangent=tangent;
  }
  return flipped;
}
