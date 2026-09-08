// Local bevel: welded face rails, rounded edge strips and corner patches.
import { triangulatePolygon } from './polygon-triangulation.js';
export function chamferMeshEdges(points, faces, edges, width = .12, segments = 1, { ngons = false } = {}) {
  const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  if (!points?.length || !faces?.length || !edges?.length) return null;
  if (points.some(p=>!p || !['x','y','z'].every(k=>Number.isFinite(p[k])))) return null;
  if (faces.some(f=>f.length<3 || new Set(f).size!==f.length || f.some(i=>!Number.isInteger(i)||!points[i]))) return null;
  if (edges.some(e=>!Array.isArray(e)||e.length!==2||e[0]===e[1]||e.some(i=>!Number.isInteger(i)||!points[i]))) return null;
  const incidence = polygons => {
    const map=new Map();
    polygons.forEach((f,fi)=>f.forEach((a,i)=>{const b=f[(i+1)%f.length],k=key(a,b);if(!map.has(k))map.set(k,[]);map.get(k).push({a,b,fi});}));
    return map;
  };
  const originalEdges=incidence(faces), selected=new Set(edges.map(e=>key(...e)));
  if([...originalEdges.values()].some(u=>u.length>2 || (u.length===2 && u[0].a!==u[1].b)))return null;
  if([...selected].some(k=>originalEdges.get(k)?.length!==2))return null;
  const affected=new Set(edges.flat()),boundaryVertices=new Set([...originalEdges.values()].filter(u=>u.length===1).flatMap(u=>[u[0].a,u[0].b]));
  const out=points.map(p=>({x:p.x,y:p.y,z:p.z})),weights=points.map((_,i)=>[[i,1]]),owners=points.map((_,i)=>i);
  const add=(sources,owner=null)=>{
    const combined=new Map();
    for(const [i,w] of sources)for(const [source,weight] of weights[i])combined.set(source,(combined.get(source)||0)+weight*w);
    const entries=[...combined],p={x:0,y:0,z:0};
    for(const [i,w] of entries)for(const axis of ['x','y','z'])p[axis]+=points[i][axis]*w;
    weights.push(entries);out.push(p);owners.push(owner);return out.length-1;
  };
  const amount=Math.max(.02,Math.min(.45,Number(width)||.12)),cuts=new Map();
  const cut=(v,n)=>{const k=`${v}:${n}`;if(!cuts.has(k))cuts.set(k,add([[v,1-amount],[n,amount]],v));return cuts.get(k);};
  const corners=faces.map(f=>f.map((v,i)=>{
    const prev=f[(i+f.length-1)%f.length],next=f[(i+1)%f.length];
    const incoming=selected.has(key(prev,v)),outgoing=selected.has(key(v,next));
    if(incoming&&outgoing)return add([[v,1-2*amount],[prev,amount],[next,amount]],v);
    if(incoming)return cut(v,next);
    if(outgoing)return cut(v,prev);
    return v;
  }));
  const polygons=faces.map((f,fi)=>f.flatMap((v,i)=>{
    if(corners[fi][i]!==v)return [corners[fi][i]];
    const prev=f[(i+f.length-1)%f.length],next=f[(i+1)%f.length];
    const before=cuts.get(`${v}:${prev}`),after=cuts.get(`${v}:${next}`);
    if(before!==undefined&&after!==undefined)return [before,after];
    return [...(before===undefined?[]:[before]),v,...(after===undefined?[]:[after])];
  }));
  const sources=faces.map((_,i)=>i);
  const count=Math.max(1,Math.min(12,Math.round(Number(segments)||1)));
  const degree=new Map();
  for(const k of selected)for(const v of k.split(':').map(Number))degree.set(v,(degree.get(v)||0)+1);
  const profileRails=new Map();
  for(const k of selected){
    const [l,r]=originalEdges.get(k);
    const corner=(fi,v)=>corners[fi][faces[fi].indexOf(v)];
    const rail=v=>{
      const a=corner(l.fi,v),b=corner(r.fi,v);
      const railKey=key(a,b);
      if(profileRails.has(railKey)){const saved=profileRails.get(railKey);return saved[0]===a?saved:[...saved].reverse();}
      const samples=Array.from({length:count+1},(_,i)=>{
        if(i===0)return a;if(i===count)return b;
        const t=i/count;
        // Ease back at shared corners so neighbouring curved rails cannot
        // collide halfway through their profiles.
        const strength=degree.get(v)>1?.5:1;
        const bend=2*t*(1-t);
        return add([[a,(1-t)*(1-t)+bend*(1-strength)*.5],[v,bend*strength],[b,t*t+bend*(1-strength)*.5]],v);
      });
      profileRails.set(railKey,samples);return samples;
    };
    const a=rail(l.a),b=rail(l.b);
    for(let i=0;i<count;i++){
      polygons.push([b[i],a[i],a[i+1],b[i+1]]);sources.push(-1);
    }
  }
  const open=incidence(polygons),byVertex=new Map();
  for(const uses of open.values())if(uses.length===1){
    const {a,b}=uses[0],v=owners[a];
    if(v!==null && v===owners[b] && affected.has(v)){
      if(!byVertex.has(v))byVertex.set(v,[]);byVertex.get(v).push([b,a]);
    }
  }
  const capIndices=new Set();
  for(const [v,links] of byVertex){
    const next=new Map(links);
    if(next.size!==links.length)return null;
    const start=links[0][0],loop=[start];let cursor=next.get(start);
    while(cursor!==undefined && cursor!==start && !loop.includes(cursor)){loop.push(cursor);cursor=next.get(cursor);}
    if(cursor===start && loop.length===links.length && loop.length>=3){capIndices.add(polygons.length);polygons.push(loop);sources.push(-1);}
    else if(!boundaryVertices.has(v))return null;
  }
  if(polygons.some(f=>f.length<3||new Set(f).size!==f.length))return null;
  if(count>1){
    const mids=new Map();
    for(const fi of capIndices){const f=polygons[fi];f.forEach((v,i)=>{const n=f[(i+1)%f.length],k=key(v,n);if(!mids.has(k))mids.set(k,add([[v,.5],[n,.5]]));});}
    const patched=[],patchedSources=[];
    polygons.forEach((f,fi)=>{
      if(capIndices.has(fi)){
        const center=add(f.map(v=>[v,1/f.length]));
        f.forEach((v,i)=>{patched.push([v,mids.get(key(v,f[(i+1)%f.length])),center,mids.get(key(f[(i+f.length-1)%f.length],v))]);patchedSources.push(-1);});
      }else{
        patched.push(f.flatMap((v,i)=>{const m=mids.get(key(v,f[(i+1)%f.length]));return m===undefined?[v]:[v,m];}));patchedSources.push(sources[fi]);
      }
    });
    polygons.splice(0,polygons.length,...patched);sources.splice(0,sources.length,...patchedSources);
  }
  if(ngons){
    if(polygons.some(f=>triangulatePolygon(out,f).length!==f.length-2))return null;
    const uses=incidence(polygons);
    if([...uses.values()].some(u=>u.length>2||(u.length===2&&u[0].a!==u[1].b)||(!boundaryVertices.size&&u.length!==2)))return null;
    const retained=[...new Set(polygons.flat())],remap=new Map(retained.map((v,i)=>[v,i]));
    return {points:retained.map(i=>out[i]),faces:polygons.map(f=>f.map(i=>remap.get(i))),weights:retained.map(i=>weights[i]),faceSources:sources};
  }
  // Pair odd-sided patches along short dual-graph paths. Split only these
  // transition edges, not every face in the mesh.
  const topology=incidence(polygons),adjacency=polygons.map(()=>[]),parity=polygons.map(f=>f.length%2),splits=new Map();
  for(const [k,uses] of topology){
    if(uses.length>2)return null;
    for(const u of uses)adjacency[u.fi].push({key:k,to:uses.length===1?-1:uses.find(x=>x!==u).fi,a:u.a,b:u.b});
  }
  for(let start=0;start<polygons.length;start++)if(parity[start]){
    const queue=[start],parents=new Map([[start,null]]);let end=null,boundary=null;
    for(let j=0;j<queue.length&&end===null;j++)for(const edge of adjacency[queue[j]]){
      if(splits.has(edge.key))continue;
      if(edge.to===-1){end=queue[j];boundary=edge;break;}
      if(parents.has(edge.to))continue;
      parents.set(edge.to,{from:queue[j],edge});queue.push(edge.to);
      if(parity[edge.to]){end=edge.to;break;}
    }
    if(end===null)return null;
    const split=edge=>splits.set(edge.key,add([[edge.a,.5],[edge.b,.5]]));
    if(boundary)split(boundary);else parity[end]=0;
    while(end!==start){const {from,edge}=parents.get(end);split(edge);end=from;}
    parity[start]=0;
  }
  const expanded=polygons.map(f=>f.flatMap((v,i)=>{const mid=splits.get(key(v,f[(i+1)%f.length]));return mid===undefined?[v]:[v,mid];}));
  const cross=(a,b,c)=>({x:(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y),y:(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z),z:(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const quads=[],faceSources=[];
  for(const [fi,f] of expanded.entries()){
    const normal={x:0,y:0,z:0};for(let i=1;i<f.length-1;i++){const n=cross(out[f[0]],out[f[i]],out[f[i+1]]);normal.x+=n.x;normal.y+=n.y;normal.z+=n.z;}
    const tolerance=dot(normal,normal)*1e-10;
    // Curved corner quads can be nonplanar: choose a diagonal whose two
    // triangles agree with the patch normal instead of requiring planarity.
    const valid=q=>(count>1&&sources[fi]<0&&f.length===4 || q.every((v,i)=>dot(cross(out[v],out[q[(i+1)%4]],out[q[(i+2)%4]]),normal)>=-tolerance))
      && dot(cross(out[q[0]],out[q[1]],out[q[2]]),normal)>tolerance && dot(cross(out[q[0]],out[q[2]],out[q[3]]),normal)>tolerance;
    let attempts=0;
    const partition=poly=>{
      if(++attempts>2048)return null;
      if(poly.length===4){for(let i=0;i<4;i++){const q=poly.slice(i).concat(poly.slice(0,i));if(valid(q))return [q];}return null;}
      for(let i=0;i<poly.length;i++){
        const rotated=poly.slice(i).concat(poly.slice(0,i)),ear=rotated.slice(0,4);
        if(!valid(ear))continue;
        // A convex ear must not contain another boundary vertex, otherwise
        // a concave face could be filled with overlapping quads.
        if(rotated.slice(4).some(v=>ear.every((a,j)=>dot(cross(out[a],out[ear[(j+1)%4]],out[v]),normal)>=-tolerance)))continue;
        const rest=partition([rotated[0],...rotated.slice(3)]);
        if(rest)return [ear,...rest];
      }
      return null;
    };
    const result=partition(f);if(!result)return null;
    result.forEach(q=>{quads.push(q);faceSources.push(sources[fi]);});
  }
  const finalEdges=incidence(quads);
  if([...finalEdges.values()].some(u=>u.length>2||(u.length===2&&u[0].a!==u[1].b)))return null;
  if(!boundaryVertices.size && [...finalEdges.values()].some(u=>u.length!==2))return null;
  const retained=[...new Set(quads.flat())],remap=new Map(retained.map((v,i)=>[v,i]));
  return {points:retained.map(i=>out[i]),faces:quads.map(f=>f.map(i=>remap.get(i))),weights:retained.map(i=>weights[i]),faceSources};
}
