// Mesh-only reconstruction. No authored strand data or provenance is accepted.
import { meshLoopSections } from './mesh-loop-sections.js?v=20260910-2';
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
const unit=a=>mul(a,1/(norm(a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mean=a=>mul(a.reduce(add,[0,0,0]),1/a.length);
const vector=a=>({x:a[0],y:a[1],z:a[2]});

function distances(graph,start){
 const dist=graph.map(()=>Infinity), heap=[];
 const push=(entry)=>{heap.push(entry);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=entry[0])break;heap[i]=heap[p];i=p;}heap[i]=entry;};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 dist[start]=0;push([0,start]);
 while(heap.length){const [d,i]=pop();if(d!==dist[i])continue;for(const [j,w] of graph[i]){const next=d+w;if(next<dist[j]){dist[j]=next;push([next,j]);}}}
 return dist;
}

export function reconstructStrandFromMesh(positions,faces,{pointCount=8,flip=false}={}){
 if(!Array.isArray(positions)||positions.length<4||positions.length>100000)throw Error('Use a mesh with 4–100,000 vertices.');
 const input=positions.map(p=>[p.x,p.y,p.z]);
 if(input.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('Mesh contains invalid positions.');
 const low=[0,1,2].map(k=>input.reduce((m,p)=>Math.min(m,p[k]),Infinity));
 const high=[0,1,2].map(k=>input.reduce((m,p)=>Math.max(m,p[k]),-Infinity));
 const scale=norm(sub(high,low));if(scale<1e-8)throw Error('Mesh has no usable length.');
 const tolerance=scale*1e-7, vertices=[],lookup=new Map();
 const ids=input.map(p=>{const key=p.map((v,k)=>Math.round((v-low[k])/tolerance)).join(',');if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p);}return lookup.get(key);});
 const graph=vertices.map(()=>new Map()), edges=[];
 for(const face of faces){if(face.length<3||face.some(i=>!Number.isInteger(i)||i<0||i>=input.length))throw Error('Invalid mesh face.');
  for(let k=0;k<face.length;k++){const a=ids[face[k]],b=ids[face[(k+1)%face.length]];if(a===b||graph[a].has(b))continue;const length=norm(sub(vertices[a],vertices[b]));graph[a].set(b,length);graph[b].set(a,length);edges.push([a,b]);}}
 const farthest=d=>d.reduce((best,v,i)=>v>d[best]?i:best,0);
 const initial=distances(graph,0);if(initial.some(d=>!Number.isFinite(d)))throw Error('Select a single connected hair chunk; this mesh contains separate pieces.');
 const a=farthest(initial),da=distances(graph,a),b=farthest(da),db=distances(graph,b),length=da[b];
 if(length<scale*.5)throw Error('Mesh is too short to fit a strand.');
 const field=da.map((d,i)=>(d-db[i]+length)/(2*length));
 const count=Math.max(4,Math.min(32,Math.round(Number(pointCount)||8)));
 const loopSamples=meshLoopSections(vertices,faces.map(f=>[...new Set(f.map(i=>ids[i]))]).filter(f=>f.length>=3));
 const sections=loopSamples ? loopSamples.map(samples=>({samples,center:mean(samples)})) : Array.from({length:count},(_,i)=>{
  const t=.04+.92*i/(count-1), samples=[];
  for(const [u,v] of edges){const lo=field[u],hi=field[v];if(Math.abs(hi-lo)<1e-10||t<Math.min(lo,hi)||t>Math.max(lo,hi))continue;samples.push(add(vertices[u],mul(sub(vertices[v],vertices[u]),(t-lo)/(hi-lo))));}
  if(samples.length<2)throw Error('Could not find continuous cross-sections. Try a simpler hair chunk.');
  return {samples,center:mean(samples)};
 });
 // Cross-section footprint, not world height or stored metadata, chooses the root.
 const spread=s=>s.samples.reduce((m,p)=>Math.max(m,norm(sub(p,s.center))),0);
 const reverse=(spread(sections[0])+spread(sections[1])<spread(sections.at(-1))+spread(sections.at(-2)))!==Boolean(flip);
 if(reverse)sections.reverse();
 const sectionCount=sections.length;
 let previousX=null;
 const fitted=sections.map((s,i)=>{
  const tangent=unit(sub(sections[Math.min(i+1,sectionCount-1)].center,sections[Math.max(0,i-1)].center));
  const seed=Math.abs(tangent[0])<.8?[1,0,0]:[0,1,0];
  const u=unit(cross(tangent,seed)),v=unit(cross(tangent,u));
  let aa=0,bb=0,ab=0;
  for(const p of s.samples){const d=sub(p,s.center),x=dot(d,u),y=dot(d,v);aa+=x*x;bb+=y*y;ab+=x*y;}
  const angle=.5*Math.atan2(2*ab,aa-bb);
  let x=add(mul(u,Math.cos(angle)),mul(v,Math.sin(angle)));
  if(previousX&&Math.abs(aa-bb)+Math.abs(ab)<(aa+bb)*.08)x=unit(sub(previousX,mul(tangent,dot(previousX,tangent))));
  if(previousX&&dot(x,previousX)<0)x=mul(x,-1);
  previousX=x;const z=unit(cross(x,tangent));
  const xs=s.samples.map(p=>dot(sub(p,s.center),x)),zs=s.samples.map(p=>dot(sub(p,s.center),z));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const center=add(s.center,add(mul(x,(minX+maxX)/2),mul(z,(minZ+maxZ)/2)));
  return {center,normal:z,width:(maxX-minX)/2,depth:Math.max(scale*1e-5,(maxZ-minZ)/2),profile:xs.map((x,j)=>({x:x-(minX+maxX)/2,z:zs[j]-(minZ+maxZ)/2}))};
 });
 // Extend the centerline to the mesh ends; section samples deliberately avoid
 // degenerate cap poles, but should not shorten the reconstructed strand.
 if(!loopSamples) [0,count-1].forEach(i=>{
  const end=fitted[i],neighbor=fitted[i===0?1:count-2];
  const outward=unit(sub(end.center,neighbor.center));
  const endField=(i===0)!==reverse?0:1;
  let extension=0;
  vertices.forEach((p,j)=>{if(Math.abs(field[j]-endField)<.12)extension=Math.max(extension,dot(sub(p,end.center),outward));});
  end.center=add(end.center,mul(outward,extension));
 });
 if(loopSamples?.capPoints){
  const caps=reverse?[...loopSamples.capPoints].reverse():loopSamples.capPoints;
  const extra=caps.map((pole,i)=>{
   if(!pole)return null;
   const end=fitted[i===0?0:fitted.length-1],neighbor=fitted[i===0?1:fitted.length-2];
   const outgoing=sub(end.center,neighbor.center),step=norm(outgoing);
   // Flat cap centers can be off-center in the profile plane. Only axial
   // extension counts as a pointed end, not lateral distance to that center.
   if(dot(sub(pole,end.center),unit(outgoing))<=Math.max(scale*1e-6,step*.2))return null;
   return {center:[...pole],normal:[...end.normal],width:0,depth:0,profile:[]};
  });
  if(extra[0])fitted.unshift(extra[0]);
  if(extra[1])fitted.push(extra[1]);
 }
 const width=Math.max(...fitted.map(s=>s.width)),depth=Math.max(...fitted.map(s=>s.depth));
 if(width<scale*1e-6)throw Error('Mesh is too thin to reconstruct.');
 const lengths=[0];for(let i=1;i<fitted.length;i++)lengths.push(lengths[i-1]+norm(sub(fitted[i].center,fitted[i-1].center)));
 const total=lengths.at(-1);
 const parameters=lengths.map(d=>d/total);
 const resampled=Array.from({length:count},(_,i)=>{
  const t=i/(count-1);let k=0;while(k<fitted.length-2&&parameters[k+1]<t)k++;
  const blend=(t-parameters[k])/(parameters[k+1]-parameters[k]||1);
  return {center:add(fitted[k].center,mul(sub(fitted[k+1].center,fitted[k].center),blend)),normal:unit(add(mul(fitted[k].normal,1-blend),mul(fitted[k+1].normal,blend)))};
 });
 let sweepProfile;
 if(loopSamples){
  const useful=fitted.filter(s=>s.width>width*.2&&s.depth>depth*.2);
  sweepProfile=useful[0].profile.map((_,j)=>({x:useful.reduce((sum,s)=>sum+s.profile[j].x/s.width,0)/useful.length,z:useful.reduce((sum,s)=>sum+s.profile[j].z/s.depth,0)/useful.length,interpolation:'linear'}));
  const area=sweepProfile.reduce((sum,p,i)=>{const q=sweepProfile[(i+1)%sweepProfile.length];return sum+p.x*q.z-q.x*p.z;},0);
  if(area<0)sweepProfile.reverse();
 }
 const curve=(key,max)=>fitted.map((s,i)=>({position:parameters[i],value:s[key]/max,interpolation:'linear'}));
 // Match recoverable rings directly. Otherwise approximate the polygon budget
 // in quad equivalents; split render vertices must not inflate this estimate.
 const radialSegments=loopSamples ? Math.max(4,Math.min(24,loopSamples[0].length)) : 12;
 const quadBudget=faces.reduce((sum,face)=>sum+Math.max(1,face.length-2)/2,0);
 const lengthSegments=Math.max(4,Math.min(256,Math.round(loopSamples ? fitted.length-1 : quadBudget/radialSegments)));
 return {points:resampled.map(s=>vector(s.center)),pointSurfaceNormals:resampled.map(s=>vector(s.normal)),width,depth,taperCurve:curve('width',width),depthCurve:curve('depth',depth),sweepProfile,radialSegments,lengthSegments,warning:loopSamples?'Fitted from mesh loops and measured profile. Check the silhouette before confirming.':'Approximate elliptical fit. Check the root, tip and silhouette; branched meshes may not fit one strand.'};
}
