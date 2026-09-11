// Split disconnected face islands. Shared vertices connect faces; UV seams do not
// disconnect an authored mesh because UVs remain per-corner attributes.
export function splitMeshParts(mesh) {
 const parent=mesh.points.map((_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(const face of mesh.faces){
  if(face.length<3||face.some(i=>!Number.isInteger(i)||i<0||i>=parent.length))throw Error('Invalid mesh topology.');
  for(const i of face)parent[root(i)]=root(face[0]);
 }
 const islands=new Map();
 mesh.faces.forEach((face,i)=>{const key=root(face[0]);if(!islands.has(key))islands.set(key,[]);islands.get(key).push(i);});
 const groups=[...islands.values()];
 return groups.map((faceIds,part)=>{
  const remap=new Map(),points=[],faces=[],corners=[];
  for(const fi of faceIds){
   faces.push(mesh.faces[fi].map(i=>{if(!remap.has(i)){remap.set(i,points.length);points.push({...mesh.points[i]});}return remap.get(i);}));
   if(mesh.meshBake)corners.push(JSON.parse(JSON.stringify(mesh.meshBake.corners[fi])));
  }
  const result={...mesh,name:groups.length>1?`${mesh.name||'Mesh'} Part ${part+1}`:mesh.name,points,faces};
  if(mesh.meshBake){
   const edges=new Map();for(const f of faces)f.forEach((a,i)=>{const b=f[(i+1)%f.length],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);});
   result.meshBake={points:points.map(p=>({...p})),faces:faces.map(f=>[...f]),corners,openSurface:[...edges.values()].some(n=>n!==2)};
  }
  return result;
 });
}
