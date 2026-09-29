export function canParentRig(rigs,childId,parentBone) {
  const child=rigs.find(r=>r.id===childId);if(!child)return false;
  if(!parentBone)return true;
  const parent=rigs.find(r=>r.id===parentBone.rigId);
  if(!parent||!Number.isInteger(parentBone.joint)||parentBone.joint<0||parentBone.joint>=parent.joints.length-1)return false;
  const seen=new Set([childId]);let current=parent;
  while(current){if(seen.has(current.id))return false;seen.add(current.id);current=rigs.find(r=>r.id===current.parentBone?.rigId);}
  return true;
}
export function normalizeRigHierarchy(rigs) {
  for(const rig of rigs)if(rig.parentBone&&!canParentRig(rigs,rig.id,rig.parentBone))delete rig.parentBone;
  return rigs;
}
export function orderedHairRigs(rigs) {
  const result=[],seen=new Set();
  function visit(rig){if(seen.has(rig.id))return;seen.add(rig.id);const p=rigs.find(r=>r.id===rig.parentBone?.rigId);if(p)visit(p);result.push(rig);}
  rigs.forEach(visit);return result;
}
export function descendantHairRigs(rigs,id,firstJoint=0) {
  const affected=new Set();
  for(const rig of orderedHairRigs(rigs))if(rig.parentBone&&
    (affected.has(rig.parentBone.rigId)||rig.parentBone.rigId===id&&rig.parentBone.joint>=firstJoint))affected.add(rig.id);
  return rigs.filter(r=>affected.has(r.id));
}

// Native outliner drag/drop: only chain roots drag; every functional bone is a target.
export function wireRigHierarchy(root,rigs,{enabled,onParent}) {
  const folders=[...root.querySelectorAll('[data-rig-chain]')],bones=[...root.querySelectorAll('[data-rig-bone]')];
  for(const rig of orderedHairRigs(rigs)) {
    if(!rig.parentBone)continue;
    const folder=folders.find(el=>el.getAttribute('data-rig-chain')===rig.id);
    const parent=bones.find(el=>el.getAttribute('data-rig-owner')===rig.parentBone.rigId&&Number(el.getAttribute('data-rig-bone'))===rig.parentBone.joint);
    if(!folder||!parent)continue;
    const nested=root.ownerDocument.createElement('div');nested.className='rig-nested-chains';
    parent.closest('.lock-item-shell').after(nested);
    nested.append(folder);
  }
  let dragging=null;
  const handles=[...root.querySelectorAll('[data-rig-drag]')];
  const targets=[...bones,...handles,...root.querySelectorAll('[data-rig-root-drop]')];
  const clear=()=>targets.forEach(el=>el.classList.remove('rig-drop-target'));
  for(const bone of [...bones.filter(el=>el.getAttribute('data-rig-bone')==='0'),...handles]) {
    bone.draggable=enabled;bone.title='Drag onto another bone to parent this chain; drop on Hair_Root to detach';
    bone.addEventListener('dragstart',event=>{if(!enabled){event.preventDefault();return;}dragging=bone.getAttribute('data-rig-owner')||bone.getAttribute('data-rig-drag');event.stopPropagation();event.dataTransfer.setData('text/plain',dragging);event.dataTransfer.effectAllowed='move';});
    bone.addEventListener('dragend',()=>{dragging=null;clear();});
  }
  for(const target of targets) {
    const parent=target.hasAttribute('data-rig-root-drop')?null:{rigId:target.getAttribute('data-rig-owner')||target.getAttribute('data-rig-drag'),joint:Number(target.getAttribute('data-rig-bone')||0)};
    target.addEventListener('dragover',event=>{if(!enabled||!dragging||!canParentRig(rigs,dragging,parent))return;event.preventDefault();event.stopPropagation();clear();target.classList.add('rig-drop-target');event.dataTransfer.dropEffect='move';});
    target.addEventListener('dragleave',()=>target.classList.remove('rig-drop-target'));
    target.addEventListener('drop',event=>{if(!enabled||!dragging)return;event.preventDefault();event.stopPropagation();const id=dragging;dragging=null;clear();if(canParentRig(rigs,id,parent))onParent(id,parent);});
  }
}
