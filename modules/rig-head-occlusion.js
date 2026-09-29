// Keep hair X-ray readability, but rebuild depth from the character before
// drawing rig overlays. Every temporary renderer/scene change is restored.
export function createRigHeadOcclusionRenderer(THREE) {
 let depthMaterial;
 return function render(renderer,scene,camera,head,groups,renderBase=(r,s,c)=>r.render(s,c)) {
  groups=groups.filter(group=>group?.visible);
  if(!groups.length){renderBase(renderer,scene,camera);return;}
  depthMaterial ||= new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide});
  const visibility=new Map(),materials=new Map();
  const autoClear=renderer.autoClear,background=scene.background,override=scene.overrideMaterial;
  const shadowUpdate=renderer.shadowMap?.autoUpdate;
  const under=(object,roots)=>{for(let p=object;p;p=p.parent)if(roots.includes(p))return true;return false;};
  const restoreVisibility=()=>visibility.forEach((visible,object)=>{object.visible=visible;});
  scene.traverse(object=>visibility.set(object,object.visible));
  try {
   groups.forEach(group=>{group.visible=false;});renderBase(renderer,scene,camera);
   restoreVisibility();renderer.autoClear=false;scene.background=null;
   if(renderer.shadowMap)renderer.shadowMap.autoUpdate=false;
   renderer.clearDepth();
   // Hide renderable leaves, not ancestor groups, so world transforms stay intact.
   scene.traverse(object=>{if(object.isMesh||object.isLine||object.isPoints||object.isSprite)object.visible=visibility.get(object)&&under(object,head?[head]:[]);});
   scene.overrideMaterial=depthMaterial;renderer.render(scene,camera);
   restoreVisibility();scene.overrideMaterial=null;
   scene.traverse(object=>{
    if(!(object.isMesh||object.isLine||object.isPoints||object.isSprite))return;
    object.visible=visibility.get(object)&&under(object,groups);
    if(object.visible)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material&&!materials.has(material)){
     materials.set(material,{depthTest:material.depthTest,depthWrite:material.depthWrite});material.depthTest=!object.userData?.rigHighlighted;material.depthWrite=false;
    }
   });
   renderer.render(scene,camera);
  }finally{
   restoreVisibility();materials.forEach((state,material)=>Object.assign(material,state));
   renderer.autoClear=autoClear;scene.background=background;scene.overrideMaterial=override;
   if(renderer.shadowMap)renderer.shadowMap.autoUpdate=shadowUpdate;
  }
 };
}
