import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const handlers=new Map(),stages=['modules-ready','ui-initialized','head-ready','scalp-ready','next-animation-frame'];
  const rows=stages.map(stage=>({dataset:{startupStage:stage,loadingLabel:stage},classList:{toggle(){}},querySelector:()=>({})}));
  let removed=false,timeout;
  const splash={querySelectorAll:()=>rows,classList:{add(){}},remove(){removed=true;}};
  const status={},progress={},dismiss={hidden:true,addEventListener:(type,fn)=>{dismiss.click=fn;}};
  const elements={'#startupSplash':splash,'#startupSplashStatus':status,'#startupSplashProgress':progress,'#startupSplashDismiss':dismiss};
  const state=vm.createContext({document:{querySelector:id=>elements[id]},
    window:{addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)},
    setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}});
  vm.runInContext(readFileSync(new URL('../modules/startup-splash.js',import.meta.url),'utf8'),state);
  return {status,progress,dismiss,stages,handlers,removed:()=>removed,timeout:()=>timeout(),
    send:(name,detail)=>handlers.get(name)?.({detail})};
}
test('Splash counts real milestones in any order and closes only when all are ready',()=>{
  const f=fixture();
  f.send('ahs-startup-stage','scalp-ready');f.send('ahs-startup-stage','scalp-ready');
  assert.equal(f.progress.value,1);assert.equal(f.removed(),false);
  for(const stage of f.stages) f.send('ahs-startup-stage',stage);
  assert.equal(f.progress.value,5);assert.equal(f.removed(),true);assert.equal(f.handlers.size,0);
});
test('Splash failures remain visible and dismissible, never claiming startup succeeded',()=>{
  const f=fixture();f.send('ahs-startup-failed','Head failed');
  assert.equal(f.status.textContent,'Head failed');assert.equal(f.dismiss.hidden,false);
  for(const stage of f.stages)f.send('ahs-startup-stage',stage);
  assert.equal(f.removed(),false);assert.equal(f.status.textContent,'Head failed');
  f.dismiss.click();assert.equal(f.removed(),true);
});
test('Slow module loading exposes a dismiss action without fake progress',()=>{
  const f=fixture();f.timeout();
  assert.equal(f.dismiss.hidden,false);assert.match(f.status.textContent,/Still loading/);
  assert.notEqual(f.progress.value,5);
  f.dismiss.click();assert.equal(f.removed(),true);
});
test('Splash bootstrap precedes the app module and needs no external imports',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('startup-splash.js')<html.indexOf('id="ahsMainModule"'));
  const script=readFileSync(new URL('../modules/startup-splash.js',import.meta.url),'utf8');
  assert.doesNotMatch(script,/^import /m);
  for(const id of ['startupSplash','startupSplashStatus','startupSplashProgress','startupSplashDismiss'])assert.equal(html.split(`id="${id}"`).length,2);
});
