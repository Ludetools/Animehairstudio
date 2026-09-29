// Self-contained so the same implementation can run in the cancellable Blob worker.
export function createSurfaceCutStitchRuntime() {
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const mul = (a,s) => a.map(v => v*s);
  const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length = a => Math.hypot(...a);
  const unit = a => mul(a,1/Math.max(1e-30,length(a)));
  const edgeKey = (a,b) => a<b ? `${a}:${b}` : `${b}:${a}`;
  function edges(faces) {
    const map = new Map();
    faces.forEach((f,fi) => f.forEach((a,i) => {
      const key=edgeKey(a,f[(i+1)%f.length]);
      if (!map.has(key)) map.set(key,[]);
      map.get(key).push(fi);
    }));
    return map;
  }
  function prepare(meshes) {
    if (!Array.isArray(meshes) || !meshes.length || meshes.length>64) throw Error('Boolean supports 1–64 source objects.');
    const sources=[];
    let vertexCount=0;
    for (const mesh of meshes) {
      const vertices=mesh.vertices, faces=mesh.faces;
      if (!Array.isArray(vertices) || !Array.isArray(faces) || !faces.length
        || vertices.some(p => !Array.isArray(p) || p.length!==3 || !p.every(Number.isFinite))
        || faces.some(f => f.length!==3 || new Set(f).size!==3 || f.some(i => !Number.isInteger(i)||i<0||i>=vertices.length))) {
        throw Error('Boolean source has invalid triangle geometry.');
      }
      vertexCount+=vertices.length;
      if (vertexCount>100000 || faces.length>200000) throw Error('Boolean supports up to 100,000 source vertices.');
      if (mesh.corners && (mesh.corners.length!==faces.length || mesh.corners.some(face=>face.length!==3 || face.some(c=>
        c && Object.entries({uv:2,normal:3,color:3,tangent:4}).some(([key,size])=>c[key]!=null && (!Array.isArray(c[key]) || c[key].length!==size || !c[key].every(Number.isFinite))))))) {
        throw Error('Boolean source has invalid corner attributes.');
      }
      const adjacent=Array.from({length:vertices.length},()=>[]);
      faces.forEach((f,i)=>f.forEach(v=>adjacent[v].push(i)));
      const remaining=new Set(faces.map((_,i)=>i));
      while(remaining.size) {
        const seed=remaining.values().next().value, stack=[seed], ids=[];
        remaining.delete(seed);
        while(stack.length) {
          const i=stack.pop(); ids.push(i);
          for(const v of faces[i]) for(const j of adjacent[v]) if(remaining.delete(j)) stack.push(j);
        }
        const used=[...new Set(ids.flatMap(i=>faces[i]))], map=new Map(used.map((v,i)=>[v,i]));
        const objFaces=ids.map(i=>faces[i].map(v=>map.get(v)));
        const source={vertices:used.map(i=>vertices[i].slice()),objFaces,
          corners:ids.map(i=>mesh.corners?.[i] || [null,null,null])};
        source.closed=[...edges(objFaces).values()].every(fs=>fs.length===2);
        sources.push(source);
        if(sources.length>256) throw Error('Boolean source has too many disconnected parts (maximum 256).');
      }
    }
    return sources;
  }
  function triangles(sources) {
    return sources.flatMap((s,owner)=>s.objFaces.map((f,fi)=>{
      const p=f.map(i=>s.vertices[i]), n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));
      return {p,n,owner,fi,corners:s.corners[fi],cuts:[],
        lo:[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))),hi:[0,1,2].map(k=>Math.max(...p.map(v=>v[k])))};
    }));
  }
  function tolerance(tris) {
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const t of tris) for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],t.lo[k]);hi[k]=Math.max(hi[k],t.hi[k]);}
    return Math.max(1e-10,length(sub(hi,lo))*1e-8);
  }
  function clip(poly, n, origin, epsilon, side=1) {
    const output=[];
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length],da=dot(sub(a,origin),n)*side,db=dot(sub(b,origin),n)*side;
      if(da>=-epsilon) output.push(a);
      if((da>epsilon&&db< -epsilon)||(da< -epsilon&&db>epsilon)) output.push(add(a,mul(sub(b,a),da/(da-db))));
    }
    return output.filter((p,i)=>length(sub(p,output[(i+output.length-1)%output.length]))>epsilon);
  }
  function planeSection(t,n,origin,epsilon) {
    const points=[];
    for(let i=0;i<3;i++) {
      const a=t.p[i],b=t.p[(i+1)%3],da=dot(sub(a,origin),n),db=dot(sub(b,origin),n);
      if(Math.abs(da)<=epsilon) points.push(a);
      if(da*db<0 && Math.abs(da)>epsilon && Math.abs(db)>epsilon) points.push(add(a,mul(sub(b,a),da/(da-db))));
    }
    return points;
  }
  function intersect(a,b,epsilon) {
    const direction=cross(a.n,b.n);
    if(length(direction)<1e-8) {
      if(Math.abs(dot(sub(a.p[0],b.p[0]),b.n))>epsilon) return false;
      let overlap=a.p;
      for(let i=0;i<3&&overlap.length;i++) {
        const inward=cross(b.n,sub(b.p[(i+1)%3],b.p[i]));
        overlap=clip(overlap,inward,b.p[i],epsilon*length(inward));
      }
      let area=0;
      for(let i=1;i+1<overlap.length;i++) area+=length(cross(sub(overlap[i],overlap[0]),sub(overlap[i+1],overlap[0])))/2;
      if(area>epsilon*epsilon*4) throw Error('Coincident overlapping surfaces cannot be stitched unambiguously. Separate or trim the overlapping sheets first.');
      return false;
    }
    const line=unit(direction),as=planeSection(a,b.n,b.p[0],epsilon),bs=planeSection(b,a.n,a.p[0],epsilon);
    if(as.length<2||bs.length<2)return false;
    const av=as.map(p=>dot(p,line)),bv=bs.map(p=>dot(p,line));
    return Math.min(Math.max(...av),Math.max(...bv))-Math.max(Math.min(...av),Math.min(...bv))>epsilon;
  }
  function cornerAt(triangle,p) {
    const [a,b,c]=triangle.p,v0=sub(b,a),v1=sub(c,a),v2=sub(p,a);
    const d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),d20=dot(v2,v0),d21=dot(v2,v1),den=d00*d11-d01*d01;
    if(Math.abs(den)<1e-30)throw Error('Degenerate source triangle.');
    const v=(d11*d20-d01*d21)/den,w=(d00*d21-d01*d20)/den,weights=[1-v-w,v,w];
    const output={};
    for(const key of ['uv','normal','color','tangent']) {
      const values=triangle.corners.map(c=>c?.[key]);
      output[key]=values.every(a=>Array.isArray(a)&&a.every(Number.isFinite))
        ? values[0].map((_,k)=>weights.reduce((sum,weight,i)=>sum+weight*values[i][k],0)) : null;
      if(key==='normal'&&output[key])output[key]=unit(output[key]);
      if(key==='tangent'&&output[key])output[key]=[...unit(output[key].slice(0,3)),output[key][3]<0?-1:1];
    }
    return output;
  }
  function bake(vertices,faces,owners,tris) {
    return {points:vertices.map(([x,y,z])=>({x,y,z})),faces:faces.map(f=>f.slice()),
      corners:faces.map((f,i)=>f.map(v=>cornerAt(tris[owners[i]],vertices[v]))),
      openSurface:[...edges(faces).values()].some(fs=>fs.length!==2)};
  }
  function stitch(sources,progress=()=>{}) {
    const tris=triangles(sources),epsilon=tolerance(tris),ordered=[...tris].sort((a,b)=>a.lo[0]-b.lo[0]);
    let intersections=0,comparisons=0;
    for(let i=0;i<ordered.length;i++) {
      const a=ordered[i];
      if(length(a.n)<.5)throw Error('Degenerate source triangle.');
      for(let j=i+1;j<ordered.length&&ordered[j].lo[0]<=a.hi[0]+epsilon;j++) {
        const b=ordered[j];
        if(a.owner===b.owner||[1,2].some(k=>a.hi[k]<b.lo[k]-epsilon||b.hi[k]<a.lo[k]-epsilon))continue;
        if(++comparisons>2000000)throw Error('Surface stitching is too dense. Reduce source resolution or select fewer objects.');
        if(intersect(a,b,epsilon)){a.cuts.push(b);b.cuts.push(a);intersections++;}
      }
      if(i%100===0)progress(.1+.3*i/ordered.length,'Finding surface intersections');
    }
    const vertices=[],buckets=new Map();
    const vertex=p=>{
      const cell=p.map(v=>Math.floor(v/epsilon));
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
        for(const i of buckets.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))||[]) if(length(sub(vertices[i],p))<=epsilon)return i;
      }
      const key=cell.join(','),i=vertices.length;
      if(i>=500000)throw Error('Surface stitching exceeded the output vertex limit.');
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(i);vertices.push(p.slice());return i;
    };
    const polygons=[];
    tris.forEach((t,owner)=>{
      let pieces=[t.p];
      for(const cut of t.cuts) {
        pieces=pieces.flatMap(poly=>{
          const distances=poly.map(p=>dot(sub(p,cut.p[0]),cut.n));
          if(!distances.some(d=>d>epsilon)||!distances.some(d=>d< -epsilon))return [poly];
          return [clip(poly,cut.n,cut.p[0],epsilon),clip(poly,cut.n,cut.p[0],epsilon,-1)].filter(p=>p.length>=3);
        });
        if(pieces.length>4096)throw Error('Too many cuts in one source face. Reduce the overlap complexity.');
      }
      for(const poly of pieces)polygons.push({ids:poly.map(vertex),owner});
      if(polygons.length>250000)throw Error('Surface stitching exceeded the output face limit.');
    });
    // Insert every seam endpoint into adjacent polygon edges before triangulating.
    // This avoids T junctions at triangle boundaries and at partial intersections.
    const sorted=vertices.map((p,i)=>({p,i})).sort((a,b)=>a.p[0]-b.p[0]),edgeCache=new Map();
    let edgeChecks=0;
    const edgePoints=(a,b)=>{
      const key=edgeKey(a,b);
      if(!edgeCache.has(key)) {
        const u=Math.min(a,b),v=Math.max(a,b),start=vertices[u],end=vertices[v],dir=sub(end,start),den=dot(dir,dir),found=[];
        const lo=Math.min(start[0],end[0])-epsilon,hi=Math.max(start[0],end[0])+epsilon;
        let left=0,right=sorted.length;
        while(left<right){const m=(left+right)>>1;if(sorted[m].p[0]<lo)left=m+1;else right=m;}
        for(let j=left;j<sorted.length&&sorted[j].p[0]<=hi;j++) {
          const {p,i}=sorted[j];if(i===u||i===v)continue;
          if([1,2].some(k=>p[k]<Math.min(start[k],end[k])-epsilon||p[k]>Math.max(start[k],end[k])+epsilon))continue;
          if(++edgeChecks>10000000)throw Error('Surface seam validation is too dense. Reduce source resolution.');
          const t=dot(sub(p,start),dir)/den;
          if(t>epsilon/Math.sqrt(den)&&t<1-epsilon/Math.sqrt(den)&&length(sub(p,add(start,mul(dir,t))))<=epsilon)found.push({i,t});
        }
        edgeCache.set(key,[u,...found.sort((a,b)=>a.t-b.t).map(v=>v.i),v]);
      }
      const result=edgeCache.get(key);return a<b?result:result.slice().reverse();
    };
    const faces=[],owners=[],areaByTriangle=new Float64Array(tris.length),seen=new Set();
    const emit=(f,owner)=>{
      if(faces.length>=500000)throw Error('Surface stitching exceeded the output triangle limit.');
      if(new Set(f).size!==3)throw Error('Collapsed surface seam.');
      const normal=cross(sub(vertices[f[1]],vertices[f[0]]),sub(vertices[f[2]],vertices[f[0]]));
      if(dot(normal,tris[owner].n)<=epsilon*epsilon)throw Error('Surface cut produced a degenerate or reversed face.');
      const key=[...f].sort((a,b)=>a-b).join(',');
      if(seen.has(key))throw Error('Surface cut produced duplicate faces.');
      seen.add(key);faces.push(f);owners.push(owner);areaByTriangle[owner]+=length(normal)/2;
    };
    polygons.forEach(({ids,owner},i)=>{
      const boundary=ids.flatMap((a,j)=>edgePoints(a,ids[(j+1)%ids.length]).slice(0,-1));
      if(boundary.length===3)emit(boundary,owner);
      else {
        const center=vertex(mul(boundary.reduce((s,i)=>add(s,vertices[i]),[0,0,0]),1/boundary.length));
        boundary.forEach((a,j)=>emit([a,boundary[(j+1)%boundary.length],center],owner));
      }
      if(i%100===0)progress(.5+.4*i/polygons.length,'Stitching shared surface edges');
    });
    tris.forEach((t,i)=>{
      const area=length(cross(sub(t.p[1],t.p[0]),sub(t.p[2],t.p[0])))/2;
      if(Math.abs(areaByTriangle[i]-area)>Math.max(epsilon*epsilon*10,area*1e-5))throw Error('Surface cut changed source area.');
    });
    const incidence=edges(faces),boundaryEdges=[...incidence.values()].filter(f=>f.length===1).length;
    const junctionEdges=[...incidence.values()].filter(f=>f.length>2).length;
    const meshBake=bake(vertices,faces,owners,tris);
    return {vertices,objFaces:faces,meshBake,surfaceCutStitchSafe:true,
      surfaceCutStitchAudit:{intersections,boundaryEdges,junctionEdges,shapePreserved:true}};
  }
  function bakeSolid(mesh, sources, provenance) {
    const tris=triangles(sources),offsets=[];let offset=0;
    sources.forEach(s=>{offsets.push(offset);offset+=s.objFaces.length;});
    // The manifold union retains each source face id; use nearest containing
    // triangle within that source for attributes on newly introduced vertices.
    const owners=mesh.objFaces.map((f,i)=>{
      const owner=provenance.owners[i],center=mul(f.reduce((sum,v)=>add(sum,mesh.vertices[v]),[0,0,0]),1/f.length);
      let best=Infinity,bestIndex=offsets[owner];
      sources[owner].objFaces.forEach((_,j)=>{
        const t=tris[offsets[owner]+j],plane=Math.abs(dot(sub(center,t.p[0]),t.n));
        const outside=[0,1,2].reduce((s,k)=>s+Math.max(0,-dot(cross(sub(t.p[(k+1)%3],t.p[k]),sub(center,t.p[k])),t.n)),0);
        const score=plane+outside;if(score<best){best=score;bestIndex=offsets[owner]+j;}
      });
      return bestIndex;
    });
    return bake(mesh.vertices,mesh.objFaces,owners,tris);
  }
  return {prepare,stitch,bakeSolid};
}
