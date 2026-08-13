import assert from "node:assert/strict";
import {
  buildHairShellTopology,
  canExtrudeHairShellFace,
  hairShellFaceCenter,
  hairShellFaceNormal
} from "../modules/hair-shell.js";

const points = [
  { x: -1, y: 0, z: -1 },
  { x: 1, y: 0, z: -1 },
  { x: 1, y: 0, z: 1 },
  { x: -1, y: 0, z: 1 },
  { x: 3, y: 0, z: -1 },
  { x: 3, y: 0, z: 1 }
];
const faces = [[0, 1, 2, 3], [1, 4, 5, 2]];

assert.deepEqual(hairShellFaceCenter(points, faces[0]), { x: 0, y: 0, z: 0 });
assert.deepEqual(hairShellFaceNormal(points, faces[0]), { x: 0, y: -1, z: 0 });
assert.equal(canExtrudeHairShellFace(faces, [], 0), true);
assert.equal(canExtrudeHairShellFace(faces, [{ faceIndex: 0 }], 1), false);

const result = buildHairShellTopology(points, faces, [{
  faceIndex: 0,
  loops: 3,
  curvePoints: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0.5, y: -2, z: 0 }
  ]
}]);
assert.equal(result.faces.some((face) => face.join(":") === "0:1:2:3"), false);
assert.equal(result.faces.length, 14);
assert.equal(result.points.length, 18);
assert.deepEqual(result.faceSources, [1, ...new Array(13).fill(null)]);
assert.deepEqual(result.faces[1].slice(0, 2), [0, 1]);

console.log("hair-shell tests passed");
