import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferenceCurveEditor} from '../modules/reference-curve-editor.js';

test('Reference curve modal previews before creating, and cancellation discards the selection', async()=>{
  const originalImage=globalThis.Image;
  globalThis.Image=class {width=200;height=300; async decode() {}};
  const target=()=>{
    const handlers=new Map();
    return {addEventListener(name,fn){handlers.set(name,fn);},fire(name,e={}){handlers.get(name)?.(e);}};
  };
  try {
    const dialog=target();dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.fire('close');};
    const canvas=target();
    canvas.getContext=()=>new Proxy({}, {get:()=>()=>{},set:()=>true});
    canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
    canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>true;canvas.releasePointerCapture=()=>{};
    const status={},confirm=target(),reset=target(),tolerance=target();tolerance.value='0.006';
    const created=[];
    const editor=createReferenceCurveEditor({dialog,canvas,status,confirm,reset,tolerance,onConfirm:path=>created.push(path)});
    const pointer=(name,x,y)=>canvas.fire(name,{button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
    const select=()=>{
      pointer('pointerdown',30,5);pointer('pointermove',70,5);pointer('pointermove',70,95);
      pointer('pointermove',30,95);pointer('pointerup',30,95);
      pointer('pointerdown',50,10);pointer('pointerdown',50,90);
    };
    await editor.open('fixture');
    assert.ok(canvas.width<=640&&canvas.height<=640);
    select();
    assert.equal(confirm.disabled,false);
    assert.equal(created.length,0);
    dialog.close();confirm.fire('click');
    assert.equal(created.length,0);
    await editor.open('fixture');
    assert.equal(confirm.disabled,true);
    select();confirm.fire('click');
    assert.equal(created.length,1);
    assert.ok(created[0][0].y<created[0].at(-1).y);
    assert.equal(dialog.open,false);
    confirm.fire('click');assert.equal(created.length,1);
  } finally {if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;}
});
