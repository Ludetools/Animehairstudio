import test from 'node:test';
import assert from 'node:assert/strict';
import {chamferMeshEdges} from '../modules/mesh-chamfer.js';
const points=[{x:-1,y:-1,z:-1},{x:1,y:-1,z:-1},{x:1,y:1,z:-1},{x:-1,y:1,z:-1},{x:-1,y:-1,z:1},{x:1,y:-1,z:1},{x:1,y:1,z:1},{x:-1,y:1,z:1}];
const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
test('cube chamfer removes original crease, cuts volume and remains closed with outward welded quads',()=>{
  const before=JSON.stringify({points,faces}),r=chamferMeshEdges(points,faces,[[1,2]],.2);
  assert.ok(r);assert.equal(JSON.stringify({points,faces}),before);
  assert.ok(!r.points.some(p=>p.x===1&&p.z===-1));
  assert.ok(r.faces.every(f=>f.length===4));
  const incidence=new Map();let volume=0;
  for(const f of r.faces){
    for(let i=0;i<4;i++){const a=f[i],b=f[(i+1)%4],k=[a,b].sort((a,b)=>a-b).join(':');if(!incidence.has(k))incidence.set(k,[]);incidence.get(k).push(a<b?1:-1);}
    for(const tri of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]){
      const [a,b,c]=tri.map(i=>r.points[i]);
      const n={x:(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y),y:(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z),z:(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)};
      assert.ok(Math.hypot(n.x,n.y,n.z)>1e-8);
      assert.ok(n.x*(a.x+b.x+c.x)+n.y*(a.y+b.y+c.y)+n.z*(a.z+b.z+c.z)>0);
      volume+=(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;
    }
  }
  for(const uses of incidence.values())assert.deepEqual(uses.slice().sort(),[-1,1]);
  assert.ok(Math.abs(volume-7.84)<1e-8);
  r.weights.forEach(ws=>assert.ok(Math.abs(ws.reduce((s,[,w])=>s+w,0)-1)<1e-8));
});
test('chamfer accepts connected selections and supports open hinges but rejects boundary edges',()=>{
  assert.ok(chamferMeshEdges(points,faces,[[1,2],[2,6]],.2));
  const p=[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:0,z:1},{x:0,y:1,z:0},{x:1,y:1,z:0},{x:1,y:1,z:1}],f=[[0,1,4,3],[1,2,5,4]];
  assert.ok(chamferMeshEdges(p,f,[[1,4]],.2));
  assert.equal(chamferMeshEdges(p,f,[[0,3]],.2),null);
  for(const width of [.02,.45])assert.ok(chamferMeshEdges(points,faces,[[1,2]],width).points.every(p=>Object.values(p).every(Number.isFinite)));
});

test('connected loops, three-way corners and all cube edges stay welded with local quad patches',()=>{
  const all=[...new Map(faces.flatMap(f=>f.map((v,i)=>[ [v,f[(i+1)%4]].sort((a,b)=>a-b).join(':'),[v,f[(i+1)%4]] ]))).values()];
  for(const edges of [[[1,2],[2,6]],[[1,2],[0,3]],[[1,2],[2,6],[2,3]],[[0,1],[1,2],[2,3],[3,0]],all]){
    for(const width of [.02,.2,.45]){
      const r=chamferMeshEdges(points,faces,edges,width);assert.ok(r,JSON.stringify(edges));
      const incidence=new Map();
      for(const f of r.faces){assert.equal(f.length,4);f.forEach((a,i)=>{const b=f[(i+1)%4],k=[a,b].sort((a,b)=>a-b).join(':');if(!incidence.has(k))incidence.set(k,[]);incidence.get(k).push(a<b?1:-1);});}
      for(const uses of incidence.values())assert.deepEqual(uses.slice().sort(),[-1,1]);
      assert.equal(r.points.length-incidence.size+r.faces.length,2);
      assert.ok(r.points.every(p=>Object.values(p).every(Number.isFinite)));
    }
  }
  const r=chamferMeshEdges(points,faces,[[1,2]],.2);
  assert.ok(r.faces.length<30,'no whole mesh subdivision');
  const untouched=faces[4].map(i=>points[i]);
  assert.ok(r.faces.some(f=>f.length===4 && untouched.every(p=>f.some(i=>JSON.stringify(r.points[i])===JSON.stringify(p)))));
});

test('multi-edge bevel preserves a disconnected untouched component exactly',()=>{
  const extra=points.map(p=>({...p,x:p.x+5}));
  const r=chamferMeshEdges([...points,...extra],[...faces,...faces.map(f=>f.map(i=>i+8))],[[1,2],[2,6]],.2);
  assert.ok(r);
  for(const face of faces){
    const expected=face.map(i=>extra[i]);
    assert.ok(r.faces.some(f=>f.length===4&&expected.every(p=>f.some(i=>JSON.stringify(p)===JSON.stringify(r.points[i])))));
  }
});

test('segmented bevel rounds the profile and welds connected corner patches',()=>{
  const all=[...new Map(faces.flatMap(f=>f.map((v,i)=>[[v,f[(i+1)%4]].sort((a,b)=>a-b).join(':'),[v,f[(i+1)%4]]]))).values()];
  for(const edges of [[[1,2]],[[1,2],[2,6]],[[1,2],[2,6],[2,3]],all])for(const segments of [2,3,6,12])for(const width of [.02,.2,.45]){
    const r=chamferMeshEdges(points,faces,edges,width,segments);
    assert.ok(r,`segments ${segments}: ${JSON.stringify(edges)}`);
    const uses=new Map();
    r.faces.forEach(f=>{assert.equal(f.length,4);f.forEach((a,i)=>{const b=f[(i+1)%4],k=[a,b].sort((a,b)=>a-b).join(':');if(!uses.has(k))uses.set(k,[]);uses.get(k).push(a<b?1:-1);});});
    for(const u of uses.values())assert.deepEqual(u.sort(),[-1,1]);
    assert.equal(r.points.length-uses.size+r.faces.length,2);
    for(const f of r.faces)for(const tri of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]){
      const [a,b,c]=tri.map(i=>r.points[i]);
      const n={x:(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y),y:(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z),z:(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)};
      assert.ok(n.x*(a.x+b.x+c.x)+n.y*(a.y+b.y+c.y)+n.z*(a.z+b.z+c.z)>0,'nonzero outward triangles');
    }
    r.weights.forEach(ws=>assert.ok(Math.abs(ws.reduce((s,[,w])=>s+w,0)-1)<1e-8));
  }
  const rounded=chamferMeshEdges(points,faces,[[1,2]],.2,2);
  assert.ok(rounded.points.some(p=>Math.abs(p.x-.9)<1e-8&&Math.abs(p.z+.9)<1e-8),'middle loop is rounded toward the old crease, not a flat strip subdivision');
});
