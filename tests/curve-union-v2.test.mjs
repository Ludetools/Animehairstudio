import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildSweep, validateTopology } from '../modules/strand-remesh.js';
import { curveUnionV2 } from '../modules/curve-union-v2.js';
import { curveUnionV1 } from '../modules/curve-union-v1.js';
import { curveUnionV3 } from '../modules/curve-union-v3.js';
import { effectiveRemeshMethod, remeshOutputAcceptable, remeshQualityChecksPassed } from '../modules/remesh-method.js';
import { startCurveUnionJob, curveUnionWorkerSource } from '../modules/curve-union-job.js';

test('Curve Union defaults to 2.0 but Adaptive always forces Legacy', () => {
  assert.equal(effectiveRemeshMethod(), 'curve-union-v2');
  for (const method of ['legacy', 'curve-union-v2', 'curve-union-v3', undefined]) {
    assert.equal(effectiveRemeshMethod(method, true), 'legacy');
  }
  assert.equal(effectiveRemeshMethod('legacy'), 'legacy');
  assert.equal(effectiveRemeshMethod('curve-union-v3'), 'curve-union-v3');
  assert.equal(remeshOutputAcceptable('curve-union-v2', {}), false);
  assert.equal(remeshQualityChecksPassed('curve-union-v2', {curveUnionV2ExportSafe: true}), true);
  assert.equal(remeshQualityChecksPassed('legacy', {}), true);
});

test('Effort UI keeps Medium default and exposes all three engines without version labels', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="autoRemeshMethod"[\s\S]*?<\/select>/)[0];
  assert.match(select, /value="legacy">Low Effort/);
  assert.match(select, /value="curve-union-v2" selected>Medium Effort/);
  assert.match(select, /value="curve-union-v3">High Effort/);
  assert.doesNotMatch(select, /Legacy|2\.0|3\.0/);
});

test('High Effort cannot commit geometry that failed its strict upstream safety gate', () => {
  const mesh = {vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,2]]};
  for (const flag of [undefined, false]) {
    assert.equal(remeshOutputAcceptable('curve-union-v3', {...mesh, curveUnionV3ExportSafe: flag}), false);
    assert.equal(remeshQualityChecksPassed('curve-union-v3', {...mesh, curveUnionV3ExportSafe: flag}), false);
  }
  assert.equal(remeshOutputAcceptable('curve-union-v3', {...mesh, curveUnionV3ExportSafe: true}), true);
  assert.equal(remeshOutputAcceptable('curve-union-v3', {...mesh, faces: [[0,1,8]], curveUnionV3ExportSafe: true}), false);
});

test('High Effort produces a confirmable union for sufficiently sampled AHS strands', async () => {
  const sweeps = [-.08,.08].map(x=>buildSweep({name:'Strand',width:.22,depth:.16,lengthSegments:48,
    points:[{x,y:1,z:0},{x:x*.75,y:.5,z:.08},{x:x*.4,y:0,z:.14},{x:0,y:-.5,z:.18}],
    sweepProfile:[{x:-1,z:0},{x:0,z:1},{x:1,z:0},{x:0,z:-1}]},{}));
  const mesh = await curveUnionV3(sweeps,10,.55,()=>{},{});
  assert.equal(remeshOutputAcceptable('curve-union-v3',mesh),true);
  assert.equal(mesh.curveUnionV3SourceBudget.withinBudget,true);
  assert.equal(validateTopology(mesh).nonManifoldEdges,0);
});

for (const [method,run] of [['legacy',curveUnionV1],['curve-union-v3',curveUnionV3]]) {
  test(`${method} updated runtime consumes AHS sweeps and matches its isolated worker`, async () => {
    const sweeps = [-0.08,0.08].map(x => buildSweep({name:'Strand',width:.22,depth:.16,lengthSegments:12,
      points:[{x,y:1,z:0},{x:x*.75,y:.5,z:.08},{x:x*.4,y:0,z:.14},{x:0,y:-.5,z:.18}],
      sweepProfile:[{x:-1,z:0},{x:0,z:1},{x:1,z:0},{x:0,z:-1}]},{}));
    const before = JSON.stringify(sweeps);
    const mesh = await run(sweeps,10,.55,()=>{},{topologyStrategy:'balanced'});
    assert.equal(JSON.stringify(sweeps),before,'input sweeps are immutable');
    assert.ok(remeshOutputAcceptable('legacy',mesh),'finite indexed geometry');
    assert.equal(validateTopology(mesh).nonManifoldEdges,0);
    if(method==='curve-union-v3') {
      assert.equal(typeof mesh.curveUnionV3ExportSafe,'boolean');
      // A low-resolution source can be too small for a valid union budget.
      // Preserve the upstream refusal instead of assuming all fixtures are safe.
      if(!mesh.curveUnionV3SourceBudget.withinBudget) {
        assert.equal(mesh.curveUnionV3ExportSafe,false);
        assert.equal(remeshOutputAcceptable(method,mesh),false);
      }
    }
    const messages=[];
    const scope={postMessage:message=>messages.push(message)};
    runInNewContext(curveUnionWorkerSource(method),{self:scope,setTimeout,clearTimeout,console});
    await scope.onmessage({data:{method,sweeps,axialLoops:10,flowSmoothing:.55,options:{topologyStrategy:'balanced'}}});
    assert.equal(messages.at(-1).type,'result',messages.at(-1).message);
    const result=messages.at(-1).mesh;
    assert.equal(JSON.stringify(result.vertices),JSON.stringify(mesh.vertices));
    assert.equal(JSON.stringify(result.objFaces||result.faces),JSON.stringify(mesh.objFaces||mesh.faces));
  });
}

test('Quality warnings do not block valid remesh data; malformed geometry still cannot commit', () => {
  const mesh = {vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]], curveUnionV2ExportSafe: false};
  assert.equal(remeshOutputAcceptable('curve-union-v2', mesh), true);
  assert.equal(remeshQualityChecksPassed('curve-union-v2', mesh), false);
  for (const method of ['legacy', 'curve-union-v2']) {
    assert.equal(remeshOutputAcceptable(method, {...mesh, faces: [[0, 1, 99]]}), false);
    assert.equal(remeshOutputAcceptable(method, {...mesh, faces: [[0, 0, 1]]}), false);
    assert.equal(remeshOutputAcceptable(method, {...mesh, vertices: [[NaN, 0, 0], [1, 0, 0], [0, 1, 0]]}), false);
    assert.equal(remeshOutputAcceptable(method, {...mesh, faces: []}), false);
  }
});

class FakeWorker {
  static latest;
  constructor(url) {
    assert.ok(url.startsWith('blob:'), 'file-origin workers must not load external script URLs');
    FakeWorker.latest = this; this.terminated = false;
  }
  postMessage(data) { this.data = data; }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage({data}); }
}

test('Curve Union background jobs forward progress and release their worker', async () => {
  const progress = [];
  const job = startCurveUnionJob({sweeps: []}, (...args) => progress.push(args), FakeWorker);
  const worker = FakeWorker.latest;
  worker.emit({type: 'progress', progress: 0.5, message: 'Building'});
  worker.emit({type: 'result', mesh: {vertices: []}});
  assert.deepEqual(await job.promise, {vertices: []});
  assert.deepEqual(progress, [[0.5, 'Building']]);
  assert.equal(worker.terminated, true);
});

test('Curve Union cancellation rejects pending work and ignores late results', async () => {
  const job = startCurveUnionJob({}, () => assert.fail('stale progress'), FakeWorker);
  const worker = FakeWorker.latest;
  job.cancel();
  worker.emit({type: 'progress'});
  worker.emit({type: 'result', mesh: {}});
  await assert.rejects(job.promise, /cancelled/);
  assert.equal(worker.terminated, true);
});

test('Curve Union worker errors release resources', async () => {
  const job = startCurveUnionJob({}, () => {}, FakeWorker);
  FakeWorker.latest.onerror({message: 'Failed'});
  await assert.rejects(job.promise, /Failed/);
  assert.equal(FakeWorker.latest.terminated, true);
});

test('Curve Union 2.0 consumes AHS sweeps and produces finite indexed topology', async () => {
  const sweeps = [-0.08, 0.08].map(x => buildSweep({
    name: 'Strand', width: 0.22, depth: 0.16, lengthSegments: 12,
    points: [{x, y: 1, z: 0}, {x: x * 0.75, y: 0.5, z: 0.08},
      {x: x * 0.4, y: 0, z: 0.14}, {x: 0, y: -0.5, z: 0.18}],
    sweepProfile: [{x: -1, z: 0}, {x: 0, z: 1}, {x: 1, z: 0}, {x: 0, z: -1}]
  }, {}));
  const mesh = await curveUnionV2(sweeps, 10, 0.55, () => {}, {});
  assert.ok(mesh.vertices.length > 0);
  assert.ok(mesh.vertices.every(point => point.every(Number.isFinite)));
  const faces = mesh.objFaces || mesh.faces;
  assert.ok(faces.length > 0);
  assert.ok(faces.every(face => face.length >= 3 && face.every(i => Number.isInteger(i) && i >= 0 && i < mesh.vertices.length)));
  assert.equal(validateTopology(mesh).nonManifoldEdges, 0);
  assert.equal(typeof mesh.curveUnionV2ExportSafe, 'boolean');
  // Execute exactly the Blob payload without imports or application globals.
  const messages = [];
  const scope = { postMessage: message => messages.push(message) };
  runInNewContext(curveUnionWorkerSource(), {self: scope, setTimeout, clearTimeout, console});
  await scope.onmessage({data: {sweeps, axialLoops: 10, flowSmoothing: 0.55, options: {}}});
  assert.equal(messages.at(-1).type, 'result');
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).mesh)), JSON.parse(JSON.stringify(mesh)));
});

test('Curve Union Blob URLs are released on cancellation and constructor failure', async () => {
  const revoked = [];
  const urls = {createObjectURL: () => 'blob:fixture', revokeObjectURL: url => revoked.push(url)};
  const job = startCurveUnionJob({}, () => {}, FakeWorker, urls);
  job.cancel();
  await assert.rejects(job.promise, /cancelled/);
  assert.deepEqual(revoked, ['blob:fixture']);
  class BlockedWorker { constructor() { throw new Error('Blocked'); } }
  assert.throws(() => startCurveUnionJob({}, () => {}, BlockedWorker, urls), /Blocked/);
  assert.deepEqual(revoked, ['blob:fixture', 'blob:fixture']);
});

test('Adaptive rebuild and preview confirmation retain their explicit engine guards', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const adaptive = app.slice(app.indexOf('async function regenerateAdaptiveRemeshAfterEdit'), app.indexOf('function syncAutoRemeshPanelState'));
  assert.match(adaptive, /unionAutoRemeshSweeps\(/);
  assert.doesNotMatch(adaptive, /startCurveUnionJob\(/);
  assert.match(app, /latestOutput\.method !== effectiveRemeshMethod/);
  assert.match(app, /operation\.remeshJob\?\.cancel\(\)/);
});
