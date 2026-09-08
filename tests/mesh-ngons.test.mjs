import test from 'node:test';
import assert from 'node:assert/strict';
import {triangulatePolygon} from '../modules/polygon-triangulation.js';
import {polyMeshBuffers,normalizePolyFaces,polyBoundaryEdges,polyEdgeLoopPlan} from '../modules/poly-topology.js';
import {chamferMeshEdges} from '../modules/mesh-chamfer.js';
import {hairFaceIndices} from '../modules/obj-export.js';
test('concave n-gons retain authored boundaries and triangulate with stable face IDs',()=>{
  const points=[[0,0],[2,0],[2,2],[1,1],[0,2]].map(([x,y])=>({x,y,z:0}));
  for(const face of [[0,1,2,3,4],[4,3,2,1,0]]){
    const b=polyMeshBuffers(points,[face]);assert.equal(b.indices.length,9);
    assert.deepEqual(b.triangleQuadIds,[0,0,0]);assert.deepEqual(b.quadFaces,[face]);
    assert.equal(polyBoundaryEdges(points,[face]).length,5);assert.equal(polyEdgeLoopPlan(points,[face],[0,1]),null);
    let area=0;
    for(const tri of triangulatePolygon(points,face)){const [a,b,c]=tri.map(i=>points[i]);area+=((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;}
    assert.equal(Math.abs(area),3);
    assert.deepEqual(hairFaceIndices({getIndex:()=>({array:b.indices}),userData:{quadFaces:b.quadFaces}}),[face]);
  }
  assert.deepEqual(normalizePolyFaces(points,[[0,1,2,3,4],[0,1,1,3]]),[[0,1,2,3,4]]);
});
test('n-gon bevel removes forced transition cuts and renders every polygon',()=>{
  const points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>({x,y,z}));
  const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
  for(const segments of [1,2,6,12]){
    const r=chamferMeshEdges(points,faces,[[1,2],[2,6]],.2,segments,{ngons:true});assert.ok(r);
    const b=polyMeshBuffers(r.points,r.faces);
    assert.equal(b.indices.length,r.faces.reduce((sum,f)=>sum+3*(f.length-2),0));
    assert.equal(polyBoundaryEdges(r.points,r.faces).length,0);
    assert.deepEqual(normalizePolyFaces(r.points,JSON.parse(JSON.stringify(r.faces))),r.faces);
  }
  const r=chamferMeshEdges(points,faces,[[1,2]],.2,1,{ngons:true});
  assert.equal(r.faces.length,7);assert.ok(r.faces.some(f=>f.length>4));
});
