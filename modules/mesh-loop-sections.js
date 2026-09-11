// Recover cross sections from current polygon connectivity, never vertex order or UVs.
export function meshLoopSections(vertices, faces) {
 const edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`;
 const edges=new Map(),incident=vertices.map(()=>[]),quads=[];
 faces.forEach((f,i)=>{f.forEach(v=>incident[v].push(i));if(f.length===4)quads.push(i);for(let j=0;j<f.length;j++){const key=edgeKey(f[j],f[(j+1)%f.length]);if(!edges.has(key))edges.set(key,[]);edges.get(key).push(i);}});
 const seeds=faces.filter(f=>f.length>4);
 incident.forEach((list,v)=>{if(list.length>=3&&list.every(i=>faces[i].length===3))seeds.push([...new Set(list.flatMap(i=>faces[i].filter(p=>p!==v)))]);});
 for(const seed of seeds){
  const set=new Set(seed),adj=new Map(seed.map(v=>[v,[]]));
  for(const a of seed)for(const i of incident[a]){const f=faces[i];if(f.length!==4)continue;const j=f.indexOf(a);for(const b of [f[(j+1)%4],f[(j+3)%4]])if(set.has(b)&&!adj.get(a).includes(b))adj.get(a).push(b);}
  if([...adj.values()].some(a=>a.length!==2))continue;
  let ring=[seed[0]],prev=-1;
  while(ring.length<seed.length){const next=adj.get(ring.at(-1)).find(v=>v!==prev);if(ring.includes(next))break;prev=ring.at(-1);ring.push(next);}
  if(ring.length!==seed.length)continue;
  const rings=[ring],used=new Set();let valid=true;
  while(rings.length<=faces.length){
   const mapping=new Map(),batch=[];
   for(let j=0;j<ring.length;j++){
    const a=ring[j],b=ring[(j+1)%ring.length];
    const candidates=(edges.get(edgeKey(a,b))||[]).filter(i=>faces[i].length===4&&!used.has(i));
    if(candidates.length!==1){valid=candidates.length===0&&batch.length===0;break;}
    const i=candidates[0],f=faces[i],k=f.indexOf(a),forward=f[(k+1)%4]===b;
    const pairs=[[a,f[(k+(forward?3:1))%4]],[b,f[(k+2)%4]]];
    for(const [u,v] of pairs){if(mapping.has(u)&&mapping.get(u)!==v)valid=false;mapping.set(u,v);}batch.push(i);
   }
   if(!valid||batch.length===0)break;
   if(batch.length!==ring.length){valid=false;break;}
   batch.forEach(i=>used.add(i));ring=ring.map(v=>mapping.get(v));
   if(new Set(ring).size!==ring.length){valid=false;break;}rings.push(ring);
  }
  if(valid&&rings.length>=3&&used.size===quads.length){
   const sections=rings.map(r=>r.map(i=>vertices[i]));
   sections.capPoints=[rings[0],rings.at(-1)].map(end=>{
    const boundary=new Set(end);
    const candidates=new Set(end.flatMap(v=>incident[v].flatMap(i=>faces[i])).filter(v=>!boundary.has(v)));
    const poles=[...candidates].filter(v=>incident[v].length===end.length&&incident[v].every(i=>faces[i].length===3&&faces[i].every(p=>p===v||boundary.has(p))));
    return poles.length===1?vertices[poles[0]]:null;
   });
   return sections;
  }
 }
 return null;
}
