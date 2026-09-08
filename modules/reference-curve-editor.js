import {traceReferenceCurve} from './reference-curve.js?v=20260905-1';

export function createReferenceCurveEditor({dialog, canvas, status, confirm, reset, tolerance, onConfirm}) {
  const ctx=canvas.getContext('2d');
  let image=null, polygon=[], root=null, tip=null, path=null, drawing=false, session=0;
  function paint() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(image)ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const line=(points,colour,close=false)=>{
      if(!points.length)return;ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x*canvas.width,p.y*canvas.height));
      if(close){ctx.closePath();ctx.fillStyle='#53cfff30';ctx.fill();}ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.stroke();
    };
    line(polygon,'#53cfff',!drawing);if(path)line(path,'#ffee66');
    for(const [p,label] of [[root,'Root'],[tip,'Tip']])if(p){ctx.fillStyle='#ffee66';ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,5,0,Math.PI*2);ctx.fill();ctx.fillText(label,p.x*canvas.width+8,p.y*canvas.height-8);}
    confirm.disabled=!path;
  }
  function clear(){polygon=[];root=null;tip=null;path=null;drawing=false;status.textContent='Drag an outline around one lock. Release to close it.';paint();}
  function preview(){try{path=traceReferenceCurve(polygon,root,tip,{tolerance:Number(tolerance.value)});status.textContent=`Preview: ${path.length} control points. Create adds one strand on the reference plane.`;}catch(error){path=null;tip=null;status.textContent=error.message+' Click a tip to retry.';}paint();}
  const position=e=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||!image)return;e.preventDefault();
    if(polygon.length<3){drawing=true;polygon=[position(e)];canvas.setPointerCapture(e.pointerId);}
    else if(!root){root=position(e);status.textContent='Click the tip inside the selection.';}
    else {tip=position(e);preview();}paint();
  });
  canvas.addEventListener('pointermove',e=>{if(drawing){const p=position(e),last=polygon.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>0.004)polygon.push(p);paint();}});
  canvas.addEventListener('pointerup',e=>{if(!drawing)return;drawing=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(polygon.length<3)clear();else{status.textContent='Click the root inside the selection.';paint();}});
  canvas.addEventListener('pointercancel',clear);
  reset.addEventListener('click',clear);
  tolerance.addEventListener('input',()=>{if(root&&tip)preview();});
  confirm.addEventListener('click',()=>{if(!path)return;try{onConfirm(path);dialog.close();}catch(error){status.textContent=error.message;}});
  dialog.addEventListener('close',()=>{session++;image=null;clear();});
  return {async open(source){const token=++session;image=null;clear();dialog.showModal();status.textContent='Loading reference…';
    const img=new Image();img.src=source;
    try{await img.decode();if(token!==session)return;image=img;const scale=640/Math.max(img.width,img.height);canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));clear();}
    catch{if(token===session)status.textContent='Could not load this reference image.';}
  }};
}
