import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {startCurveUnionJob} from '../modules/lazy-remesh-job.js';
import {markStartup} from '../modules/startup-timing.js';

test('Lazy remesh cancellation before import completion never starts a worker',async()=>{
  let finish,starts=0;
  const job=startCurveUnionJob({},()=>{},()=>new Promise(resolve=>{finish=resolve;}));
  await Promise.resolve();
  job.cancel();
  await assert.rejects(job.promise,/cancelled/);
  finish({startCurveUnionJob(){starts++;return {promise:Promise.resolve({})};}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(starts,0);
});
test('Lazy remesh forwards completion, load errors and cancellation after loading',async()=>{
  let cancelled=0;
  const load=async()=>({startCurveUnionJob:()=>({promise:Promise.resolve('mesh'),cancel(){cancelled++;}})});
  const job=startCurveUnionJob({},()=>{},load);
  assert.equal(await job.promise,'mesh');
  job.cancel();job.cancel();assert.equal(cancelled,1);
  await assert.rejects(startCurveUnionJob({},()=>{},async()=>{throw new Error('load failed');}).promise,/load failed/);
});
test('Startup timing stages are recorded once without overwriting later measurements',()=>{
  const marks=new Set(['ahs:start']),measures=[];
  const clock={getEntriesByName:name=>marks.has(name)?[{}]:[],mark:name=>marks.add(name),measure:(...args)=>measures.push(args)};
  markStartup('head-ready',clock);markStartup('head-ready',clock);
  assert.equal(measures.length,1);
  assert.deepEqual(measures[0],['AHS startup: head-ready','ahs:start','ahs:head-ready']);
});
test('Braid assets load once on demand; startup has no eager asset calls',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function ensureBraidMeshPreset('),app.indexOf('\n}',app.indexOf('function ensureBraidMeshPreset('))+2);
  const calls=[];
  const state=vm.createContext({braidMeshPresets:new Map(),requestedBraidMeshPresets:new Set(),loadBraidMeshPreset:(...args)=>calls.push(args)});
  vm.runInContext(source,state);
  assert.equal(calls.length,0);
  state.ensureBraidMeshPreset('chain-links');state.ensureBraidMeshPreset('chain-links');
  assert.equal(calls.length,1);assert.equal(calls[0][2].authoredCaps,true);
  assert.doesNotMatch(app,/^loadBraidMeshPreset\(/m);
  assert.match(app,/from "\.\/modules\/lazy-remesh-job/);
});
test('Custom preset detail requests are deduplicated and cached only after success',async()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('const pendingCustomPresetLoads ='),app.indexOf('async function loadCustomHairstylePresets()'));
  let reads=0,resolve;
  const state=vm.createContext({customHairstylePresetProjects:new Map(),presetCatalog:[{id:'p',custom:true}],
    readHairstylePresetRecord(){reads++;return new Promise(r=>{resolve=r;});},
    registerCustomHairstylePreset:r=>state.customHairstylePresetProjects.set(r.id,r.project)});
  vm.runInContext(source,state);
  const a=state.ensureCustomPresetLoaded('p'),b=state.ensureCustomPresetLoaded('p');
  assert.equal(reads,1);resolve({id:'p',project:{}});await Promise.all([a,b]);
  await state.ensureCustomPresetLoaded('p');assert.equal(reads,1);
});
