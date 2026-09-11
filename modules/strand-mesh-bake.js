export const cloneMeshBake = value => value ? JSON.parse(JSON.stringify(value)) : null;

export function bakeStrandGeometry(geometry, sourceFaces) {
  const position = geometry.getAttribute('position');
  if (!position?.count || !sourceFaces?.length) throw new Error('The strand has no generated faces.');
  const points=[], remap=[], welded=new Map();
  for(let i=0;i<position.count;i++) {
    const p={x:position.getX(i),y:position.getY(i),z:position.getZ(i)};
    if(!Object.values(p).every(Number.isFinite)) throw new Error('The strand contains invalid vertices.');
    const key=[p.x,p.y,p.z].map(v=>Math.round(v*1e7)).join(',');
    if(!welded.has(key)){welded.set(key,points.length);points.push(p);}
    remap.push(welded.get(key));
  }
  const faces=[],corners=[];
  for(const face of sourceFaces) {
    const seen=new Set(),ids=[];
    for(const i of face) {
      if(!Number.isInteger(i)||i<0||i>=remap.length) throw new Error('Invalid strand face index.');
      if(!seen.has(remap[i])){seen.add(remap[i]);ids.push(i);}
    }
    if(ids.length<3)continue;
    faces.push(ids.map(i=>remap[i]));
    corners.push(ids.map(i=>Object.fromEntries(['uv','normal','color','tangent'].map(name=>{
      const a=geometry.getAttribute(name);
      return [name,a?Array.from({length:a.itemSize},(_,c)=>a[['getX','getY','getZ','getW'][c]](i)):null];
    }))));
  }
  if(!faces.length)throw new Error('The strand has no non-degenerate faces.');
  return {points,faces,meshBake:{points:points.map(p=>({...p})),faces:faces.map(f=>[...f]),corners,openSurface:Boolean(geometry.userData?.openSurface)}};
}

export function meshBakeMatches(faces,bake) {
  return Boolean(bake?.faces?.length===faces.length && faces.every((f,i)=>f.length===bake.faces[i].length&&f.every((v,j)=>v===bake.faces[i][j])));
}

// Reverse winding without moving vertices or detaching per-corner attributes.
export function invertMeshFaces(faces, bake, faceIndices = faces.map((_, i) => i)) {
  const selected = new Set(faceIndices);
  const nextFaces = faces.map((face, i) => selected.has(i) ? [...face].reverse() : [...face]);
  const nextBake = meshBakeMatches(faces, bake) ? cloneMeshBake(bake) : null;
  if (nextBake) {
    nextBake.faces = nextFaces.map(face => [...face]);
    nextBake.corners.forEach((corners, i) => {
      if (!selected.has(i)) return;
      corners.reverse();
      corners.forEach(corner => {
        if (corner.normal) corner.normal = corner.normal.map(v => -v || 0);
        if (corner.tangent) corner.tangent[3] = -corner.tangent[3] || 0;
      });
    });
  }
  return { faces: nextFaces, meshBake: nextBake };
}

export function mirrorMeshBake(value) {
  const bake=cloneMeshBake(value);if(!bake)return null;
  bake.points.forEach(p=>p.x=-p.x || 0);
  bake.faces.forEach(f=>f.reverse());
  bake.corners.forEach(face=>{face.reverse();face.forEach(c=>{if(c.normal)c.normal[0]=-c.normal[0] || 0;if(c.tangent){c.tangent[0]=-c.tangent[0] || 0;c.tangent[3]=-c.tangent[3] || 0;}});});
  return bake;
}
