import test from 'node:test';
import assert from 'node:assert/strict';
import {polyEdgeLoopEdges} from '../modules/poly-topology.js';

function cappedStrip(count) {
  const points = [0,1,2].flatMap(y => Array.from({length: count}, (_, i) => ({
    x: Math.cos(i*2*Math.PI/count), y, z: Math.sin(i*2*Math.PI/count)
  })));
  points.push({x:0,y:3,z:0});
  const faces = [];
  for (let row=0; row<2; row++) for (let i=0; i<count; i++) {
    const j=(i+1)%count;
    faces.push([row*count+i,row*count+j,(row+1)*count+j,(row+1)*count+i]);
  }
  for (let i=0;i<count;i++) faces.push([2*count+i,2*count+(i+1)%count,3*count]);
  return {points,faces};
}
const keys = edges => new Set(edges.map(edge => [...edge].sort((a,b)=>a-b).join(':')));

test('Longitudinal edge loops include triangular tip edges without crossing the apex', () => {
  for (const count of [3,4,6,8]) {
    const {points,faces} = cappedStrip(count);
    const before = JSON.stringify({points,faces});
    const expected = keys([[0,count],[count,2*count],[2*count,3*count]]);
    for (const seed of [[0,count],[count,2*count],[2*count,3*count],[3*count,2*count]]) {
      assert.deepEqual(keys(polyEdgeLoopEdges(points,faces,seed)), expected, `fan ${count}, seed ${seed}`);
    }
    assert.equal(JSON.stringify({points,faces}),before);
  }
});

test('Crosswise loop stays on the quad/triangle boundary instead of climbing to the tip', () => {
  const {points,faces} = cappedStrip(6);
  const expected = keys(Array.from({length:6},(_,i)=>[12+i,12+(i+1)%6]));
  assert.deepEqual(keys(polyEdgeLoopEdges(points,faces,[12,13])),expected);
});
