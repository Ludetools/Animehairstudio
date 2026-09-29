import {normalizeBoneLimit, boneLimitOutline, swingDirection, offsetBoneLimitFrame, rotateBoneLimit, boneLimitRingPoint} from './hair-bone-limits.js';

// View-only helpers and one-gesture transactions; no Three objects enter authored state.
export function createBoneLimitEditor({THREE, scene, camera, canvas, panel, getContext,
  beforeCommit, afterCommit, setDragging, getMirror=()=>null, setRotationEditing=()=>{}, eventTarget=window}) {
  const group=new THREE.Group();scene.add(group);
  const mode=panel.querySelector('[data-limit-mode]'),edit=panel.querySelector('[data-limit-edit]');
  const rotate=panel.querySelector('[data-limit-rotate]'),reset=panel.querySelector('[data-limit-reset]');
  const fields=[...panel.querySelectorAll('[data-limit-angle]')];
  const labels=['sideways','forward'].map(axis=>{
    const label=panel.ownerDocument.createElement('div');label.className=`rig-limit-label ${axis}`;
    label.hidden=true;panel.ownerDocument.body.append(label);return label;
  });
  let transaction=null,drag=null,signature='',handles=[],rings=[],rotationEditing=false;
  const read=ctx=>normalizeBoneLimit(ctx.rig.rotationLimits?.[ctx.index]);
  const snapshot=rig=>rig.rotationLimits?.map(value=>({...value,...(value?.rotation?{rotation:[...value.rotation]}:{})}));
  const restore=(rig,value)=>{if(value)rig.rotationLimits=value;else delete rig.rotationLimits;};
  const sameContext=(a,b)=>a&&b&&a.rig===b.rig&&a.index===b.index&&a.key===b.key;
  function clear() {
    group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});group.clear();handles=[];rings=[];
    labels.forEach(label=>{label.hidden=true;});
  }
  function begin(ctx) {
    if(transaction&&!sameContext(transaction.ctx,ctx))finish(true);
    if(!transaction) {
      const mirror=getMirror(ctx);
      transaction={ctx,before:snapshot(ctx.rig),mirror,mirrorBefore:mirror?snapshot(mirror.rig):undefined,physics:ctx.physics,playing:ctx.physics?.playing};
      if(ctx.physics)ctx.physics.playing=false;
    }
  }
  function change(patch) {
    const ctx=getContext();if(!ctx)return;
    const value=normalizeBoneLimit({...read(ctx),...patch});
    if(JSON.stringify(value)===JSON.stringify(read(ctx)))return;
    begin(ctx);
    ctx.rig.rotationLimits=ctx.rig.joints.slice(0,-1).map((_,i)=>i===ctx.index?value:normalizeBoneLimit(ctx.rig.rotationLimits?.[i]));
    const mirror=transaction.mirror;
    if(mirror)mirror.rig.rotationLimits=mirror.rig.joints.slice(0,-1).map((_,i)=>i===mirror.index?mirror.convert(value):normalizeBoneLimit(mirror.rig.rotationLimits?.[i]));
    signature='';update();
  }
  function finish(cancel=false) {
    const active=transaction;transaction=null;
    const pointer=drag?.id;drag=null;
    if(pointer!=null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
    if(pointer!=null)setDragging(false);
    if(!active)return;
    const result=snapshot(active.ctx.rig);
    const mirrorResult=active.mirror?snapshot(active.mirror.rig):undefined;
    restore(active.ctx.rig,active.before);
    if(active.mirror)restore(active.mirror.rig,active.mirrorBefore);
    if(active.physics&&getContext()?.physics===active.physics)active.physics.playing=active.playing;
    if(!cancel&&JSON.stringify(result)!==JSON.stringify(active.before)) {
      beforeCommit();restore(active.ctx.rig,result);
      if(active.mirror)restore(active.mirror.rig,mirrorResult);
      afterCommit();
    }
    const ctx=getContext();
    if(ctx)fields.forEach(field=>{field.value=read(ctx)[field.dataset.limitAngle];});
    signature='';
  }
  function line(points,color,opacity=1) {
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const object=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,toneMapped:false}));
    object.renderOrder=115;object.raycast=()=>{};group.add(object);
  }
  function build(ctx,value) {
    clear();if(!ctx.visible||value.mode==='free')return;
    const radius=Math.max(.025,ctx.length*.8);
    const frame=offsetBoneLimitFrame(ctx.frame,value);
    const world=local=>ctx.origin.map((v,i)=>v+radius*(frame.x[i]*local[0]+frame.y[i]*local[1]+frame.z[i]*local[2]));
    const outline=boneLimitOutline(value).map(world);
    line(outline,'#9ac8de',.8);
    for(let i=0;i<64;i+=8)line([ctx.origin,outline[i]],'#9ac8de',.3);
    if(rotate.checked&&edit.checked&&ctx.interactive) {
      ['x','y','z'].forEach((axis,i)=>{
        const points=Array.from({length:73},(_,j)=>world(boneLimitRingPoint(axis,j*5).map(v=>v*1.15)));
        line(points,['#ed8585','#8ddd9a','#8eaeff'][i]);
        rings.push({axis,ctx,frame,radius:radius*1.15,points});
      });
    }
    if(value.mode==='locked'){line([ctx.origin,world([0,1,0])],'#f0c66b');return;}
    const positions=[];
    for(let i=0;i<outline.length-1;i++)positions.push(...ctx.origin,...outline[i],...outline[i+1]);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#79c8e8',transparent:true,opacity:.07,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));
    fill.renderOrder=114;fill.raycast=()=>{};group.add(fill);
    ['sideways','forward'].forEach((axis,index)=>{
      const color=index?'#db9be9':'#71d6ef',angle=value[axis];
      const local=degrees=>swingDirection(index?0:degrees,index?degrees:0);
      line(Array.from({length:49},(_,i)=>world(local(-angle+2*angle*i/48))),color);
      if(!edit.checked||!ctx.interactive||rotate.checked)return;
      for(const sign of [-1,1]) {
        const position=world(local(sign*angle));
        const handle=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.004,radius*.045),10,8),new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false}));
        handle.position.fromArray(position);handle.renderOrder=116;group.add(handle);
        handles.push({object:handle,axis,sign,ctx,frame,radius});
        if(sign===1){labels[index].textContent=`${index?'Forward / Back':'Sideways'} ±${Math.round(angle)}°`;labels[index].position=position;}
      }
    });
  }
  function update() {
    const ctx=getContext();
    if(transaction&&!sameContext(transaction.ctx,ctx))finish(true);
    panel.hidden=!ctx;
    const rotating=Boolean(ctx?.visible&&ctx?.interactive&&read(ctx).mode!=='free'&&edit.checked&&rotate.checked);
    if(rotating||rotating!==rotationEditing)setRotationEditing(rotating);
    rotationEditing=rotating;
    if(!ctx){if(signature!=='hidden'){clear();signature='hidden';}return;}
    const value=read(ctx);mode.value=value.mode;
    fields.forEach(field=>{
      field.disabled=value.mode!=='limited';
      if(panel.ownerDocument.activeElement!==field||drag)field.value=value[field.dataset.limitAngle];
    });
    edit.disabled=value.mode==='free'||!ctx.interactive;
    rotate.disabled=edit.disabled;reset.disabled=!value.rotation;
    const next=JSON.stringify([ctx.key,ctx.origin,ctx.frame,ctx.length,ctx.visible,ctx.interactive,value,edit.checked,rotate.checked]);
    if(next!==signature){build(ctx,value);signature=next;}
    // Orbit changes camera transforms before the renderer refreshes its inverse matrix.
    // DOM labels must project with the same camera state as this frame's bones.
    camera.updateMatrixWorld(true);
    const bounds=canvas.getBoundingClientRect();
    labels.forEach(label=>{
      if(!label.position||!handles.length){label.hidden=true;return;}
      const p=new THREE.Vector3(...label.position).project(camera);
      label.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
      label.style.left=`${bounds.left+(p.x+1)*bounds.width/2+10}px`;
      label.style.top=`${bounds.top+(1-p.y)*bounds.height/2-10}px`;
    });
  }
  mode.addEventListener('change',()=>{change({mode:mode.value});finish();update();});
  fields.forEach(field=>{
    field.addEventListener('input',()=>{if(field.value!=='')change({[field.dataset.limitAngle]:Number(field.value)});});
    for(const type of ['change','blur'])field.addEventListener(type,()=>{finish();update();});
  });
  edit.addEventListener('change',()=>{finish(true);signature='';update();});
  rotate.addEventListener('change',()=>{finish(true);if(rotate.checked)edit.checked=true;signature='';update();});
  reset.addEventListener('click',()=>{finish(true);change({rotation:undefined});finish();update();});
  function nearestRing(event,ring) {
    const bounds=canvas.getBoundingClientRect();let best=Infinity,degrees=0;
    for(let angle=0;angle<360;angle++) {
      const v=boneLimitRingPoint(ring.axis,angle);
      const p=new THREE.Vector3(...ring.ctx.origin.map((n,i)=>n+ring.radius*(ring.frame.x[i]*v[0]+ring.frame.y[i]*v[1]+ring.frame.z[i]*v[2]))).project(camera);
      if(p.z< -1||p.z>1)continue;
      const distance=Math.hypot(bounds.left+(p.x+1)*bounds.width/2-event.clientX,bounds.top+(1-p.y)*bounds.height/2-event.clientY);
      if(distance<best){best=distance;degrees=angle;}
    }
    return {distance:best,degrees};
  }
  function down(event) {
    if(event.target!==canvas){if(drag)finish(true);return;}
    if(event.button!==0||event.altKey)return;
    update();
    if(rings.length) {
      const hit=rings.map(ring=>({...ring,...nearestRing(event,ring)})).sort((a,b)=>a.distance-b.distance)[0];
      if(hit.distance>7)return;
      event.preventDefault();event.stopImmediatePropagation();begin(hit.ctx);
      drag={...hit,kind:'rotation',startValue:read(hit.ctx),startAngle:hit.degrees,id:event.pointerId};
      setDragging(true);canvas.setPointerCapture(event.pointerId);return;
    }
    if(!handles.length)return;
    const bounds=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2),camera);
    group.updateMatrixWorld(true);
    const hit=ray.intersectObjects(handles.map(h=>h.object),false)[0];
    const handle=handles.find(h=>h.object===hit?.object);if(!handle)return;
    event.preventDefault();event.stopImmediatePropagation();begin(handle.ctx);
    drag={...handle,id:event.pointerId};setDragging(true);canvas.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!sameContext(drag.ctx,getContext())){finish(true);return;}
    if(drag.kind==='rotation') {
      const angle=nearestRing(event,drag).degrees-drag.startAngle;
      change({rotation:rotateBoneLimit(drag.startValue,drag.axis,angle).rotation});return;
    }
    // Screen-projected arc remains draggable when its plane is edge-on to the camera.
    const bounds=canvas.getBoundingClientRect();let best=Infinity,degrees=read(drag.ctx)[drag.axis];
    for(let angle=0;angle<=175;angle++) {
      const v=swingDirection(drag.axis==='sideways'?angle*drag.sign:0,drag.axis==='forward'?angle*drag.sign:0);
      const p=new THREE.Vector3(...drag.ctx.origin.map((n,i)=>n+drag.radius*(drag.frame.x[i]*v[0]+drag.frame.y[i]*v[1]+drag.frame.z[i]*v[2]))).project(camera);
      const distance=Math.hypot(bounds.left+(p.x+1)*bounds.width/2-event.clientX,bounds.top+(1-p.y)*bounds.height/2-event.clientY);
      if(distance<best){best=distance;degrees=angle;}
    }
    change({[drag.axis]:degrees});
  }
  function up(event) {if(drag&&event.pointerId===drag.id){event.preventDefault();event.stopImmediatePropagation();finish(event.type!=='pointerup');update();}}
  function key(event) {
    if(!transaction)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);update();}
    else if(drag||(event.ctrlKey||event.metaKey)&&['s','z','y'].includes(event.key.toLowerCase())){finish(true);update();}
  }
  eventTarget.addEventListener('pointerdown',down,true);
  eventTarget.addEventListener('pointermove',move,true);
  eventTarget.addEventListener('pointerup',up,true);
  eventTarget.addEventListener('pointercancel',up,true);
  eventTarget.addEventListener('keydown',key,true);
  eventTarget.addEventListener('blur',()=>{finish(true);update();});
  canvas.addEventListener('lostpointercapture',up);
  return {update,cancel:()=>{finish(true);update();}};
}
