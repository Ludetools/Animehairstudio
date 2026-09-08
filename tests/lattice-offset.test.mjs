import test from 'node:test';
import assert from 'node:assert/strict';
import {latticeOffsetNormals} from '../modules/lattice-offset.js';
test('lattice offsets use unit perpendiculars and tolerate collapsed cells',()=>{
 const points=[{x:0,y:1,z:0},{x:1,y:1,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}];
 for(const n of latticeOffsetNormals(points,2,2))assert.deepEqual(n,{x:0,y:0,z:1});
 for(const n of latticeOffsetNormals(Array(4).fill(points[0]),2,2))assert.deepEqual(n,{x:0,y:0,z:0});
 assert.equal(latticeOffsetNormals([],2,2),null);
});
