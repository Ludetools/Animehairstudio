import {normalizeHairRigs,normalizeHairRigRoot,rigJointFrame} from './hair-rig.js';
import {orderedHairRigs} from './hair-rig-hierarchy.js';
import {automaticHairWeights} from './hair-skinning.js';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
// USD row-vector matrices: axes occupy rows and translation occupies the last row.
const matrix=(frame,p)=>[...frame.x,0,...frame.y,0,...frame.z,0,...p,1];
function relativeMatrix(world,parent) {
 const axes=[parent.slice(0,3),parent.slice(4,7),parent.slice(8,11)],result=identity();
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)result[row*4+col]=dot(world.slice(row*4,row*4+3),axes[col]);
 const delta=world.slice(12,15).map((v,i)=>v-parent[12+i]);
 for(let col=0;col<3;col++)result[12+col]=dot(delta,axes[col]);
 return result;
}

export function buildUsdHairRig(rigs,root,identifier) {
 rigs=orderedHairRigs(normalizeHairRigs(rigs));
 if(!rigs.length)return null;
 root=normalizeHairRigRoot(root,rigs);
 const rootMatrix=identity();rootMatrix.splice(12,3,...root.position);
 const joints=[identifier(root.name)],bindTransforms=[rootMatrix],restTransforms=[rootMatrix],indices=new Map(),used=new Set(joints);
 for(const rig of rigs) {
  const own=[];
  for(let i=0;i<rig.joints.length-1;i++) {
   const parent=i?own[i-1]:rig.parentBone?indices.get(rig.parentBone.rigId)[rig.parentBone.joint]:0;
   const name=identifier(rig.boneNames?.[i]||`${rig.name}_${i?'0'+i:'root'}`);
   let path=`${joints[parent]}/${name}`,suffix=2;
   while(used.has(path))path=`${joints[parent]}/${name}_${suffix++}`;
   used.add(path);own.push(joints.length);joints.push(path);
   const world=matrix(rigJointFrame(rig.joints,rig.normals,i),rig.joints[i]);
   bindTransforms.push(world);restTransforms.push(relativeMatrix(world,bindTransforms[parent]));
  }
  indices.set(rig.id,own);
 }
 return {joints,bindTransforms,restTransforms,indices,rigs};
}

export function usdHairWeights(points,strandId,skeleton) {
 const owners=skeleton.rigs.filter(r=>r.boundStrandIds?.includes(strandId));
 if(owners.length>1)throw Error('A strand belongs to multiple chains. Unbind the conflicting chain before exporting.');
 if(!owners.length)return null;
 const rig=owners[0],mapping=skeleton.indices.get(rig.id),rootWeight=Math.max(0,Math.min(1,rig.rootWeights?.[strandId]||0));
 const bindings=automaticHairWeights(points,rig.joints,rig.bindingBlend??1);
 const indices=[],weights=[];
 for(const binding of bindings) {
  // Skip zero-weight terminal placeholders, which are not exported as joints.
  const influences=binding.indices.flatMap((joint,i)=>binding.weights[i]>0?[[mapping[joint],binding.weights[i]*(1-rootWeight)]]:[]);
  if(rootWeight>0)influences.push([0,rootWeight]);
  while(influences.length<3)influences.push([0,0]);
  for(const [index,weight] of influences){if(!Number.isInteger(index))throw Error('Invalid skin joint index.');indices.push(index);weights.push(weight);}
 }
 return {indices,weights,elementSize:3};
}
