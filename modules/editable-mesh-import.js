const finite=(values,n)=>Array.isArray(values)&&values.length>=n&&values.slice(0,n).every(Number.isFinite);

export function validateImportedMeshes(meshes) {
 if(!meshes.length)throw Error('No polygon meshes were found in this file.');
 let vertices=0,corners=0;
 for(const mesh of meshes){
  vertices+=mesh.points.length;
  if(!mesh.faces.length||mesh.points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('Invalid mesh positions.');
  for(const f of mesh.faces){corners+=f.length;if(f.length<3||new Set(f).size!==f.length||f.some(i=>!Number.isInteger(i)||i<0||i>=mesh.points.length))throw Error('Invalid or degenerate mesh face.');}
 }
 if(vertices>250000||corners>500000)throw Error('Import is too large (maximum 250,000 vertices / 500,000 face corners).');
 return meshes;
}

function finishMesh(name,points,faces,corners){
 const edges=new Map();
 for(const face of faces)face.forEach((a,i)=>{const b=face[(i+1)%face.length],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);});
 return {name,points,faces,meshBake:{points:points.map(p=>({...p})),faces:faces.map(f=>[...f]),corners,openSurface:[...edges.values()].some(count=>count!==2)}};
}

export function parseEditableOBJ(text){
 const positions=[],uvs=[],normals=[],colors=[],meshes=[];
 let current=null,name='Mesh';
 const begin=()=>current={name,points:[],faces:[],corners:[],remap:new Map()};
 const finish=()=>{if(current?.faces.length)meshes.push(finishMesh(current.name,current.points,current.faces,current.corners));current=null;};
 const index=(s,array)=>{const v=Number(s),i=v<0?array.length+v:v-1;if(!Number.isInteger(v)||v===0||i<0||i>=array.length)throw Error('OBJ contains an invalid face index.');return i;};
 for(const raw of text.replace(/\\\r?\n/g,' ').split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim();if(!line)continue;
  const [type,...tokens]=line.split(/\s+/),values=tokens.map(Number);
  if(type==='v'){if(!finite(values,3))throw Error('Invalid OBJ vertex.');positions.push(values.slice(0,3));colors.push(values.length>=6&&finite(values,6)?values.slice(3,6):null);}
  else if(type==='vt'){if(!finite(values,2))throw Error('Invalid OBJ UV.');uvs.push(values.slice(0,2));}
  else if(type==='vn'){if(!finite(values,3))throw Error('Invalid OBJ normal.');normals.push(values.slice(0,3));}
  else if(type==='o'||type==='g'){finish();name=tokens.join(' ')||'Mesh';}
  else if(type==='f'){
   if(!current)begin();const face=[],corner=[];
   for(const token of tokens){const [p,uv,n]=token.split('/'),i=index(p,positions);
    if(!current.remap.has(i)){current.remap.set(i,current.points.length);const [x,y,z]=positions[i];current.points.push({x,y,z});}
    face.push(current.remap.get(i));corner.push({uv:uv?[...uvs[index(uv,uvs)]]:null,normal:n?[...normals[index(n,normals)]]:null,color:colors[i]?[...colors[i]]:null,tangent:null});
   }
   current.faces.push(face);current.corners.push(corner);
  }
 }
 finish();return validateImportedMeshes(meshes);
}

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const r=i%4,c=Math.floor(i/4);return [0,1,2,3].reduce((s,k)=>s+a[k*4+r]*b[c*4+k],0);});
const determinant=m=>m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
const transform=(p,m)=>({x:m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],y:m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],z:m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]});
function transformNormal(p,m){
 if(!p)return null;
 const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]];
 const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const x=cross(b,c),y=cross(c,a),z=cross(a,b),d=determinant(m);
 const n=x.map((v,i)=>(v*p[0]+y[i]*p[1]+z[i]*p[2])/d),length=Math.hypot(...n);
 return length>1e-12?n.map(v=>v/length):null;
}

// A bounded token parser for inline, static USDA polygon meshes (not USD composition).
function parseUSDA(text){
 if(!text.trimStart().startsWith('#usda'))throw Error('Expected a text USDA file, not binary USD or USDZ.');
 const tokens=text.match(/#[^\r\n]*|"(?:\\.|[^"\\])*"|@[^@]*@|<[^>]*>|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[A-Za-z_!][\w:!.-]*|[^\s]/g).filter(t=>!t.startsWith('#'));
 let pos=0;
 const take=()=>tokens[pos++];
 const expect=t=>{if(take()!==t)throw Error(`Invalid USDA syntax: expected ${t}.`);};
 const value=(depth=0)=>{
  if(depth>64)throw Error('USDA nesting is too deep.');const t=take();
  if(t==='['||t==='('){const end=t==='['?']':')',out=[];while(pos<tokens.length&&tokens[pos]!==end){if(tokens[pos]===','){pos++;continue;}out.push(value(depth+1));}expect(end);return out;}
  if(t==='{')throw Error('USDA dictionaries, time samples and composition must be flattened to static mesh data first.');
  if(t?.startsWith('"'))return JSON.parse(t);
  if(t===undefined)throw Error('Truncated USDA file.');
  return /^[-+\d.]/.test(t)?Number(t):t;
 };
 const scope=(end=null,depth=0)=>{
  if(depth>64)throw Error('USDA nesting is too deep.');
  const node={attrs:Object.create(null),children:[]};
  while(pos<tokens.length&&tokens[pos]!==end){
   if([',',';'].includes(tokens[pos])){pos++;continue;}
   if(tokens[pos]==='('){pos++;Object.assign(node.attrs,scope(')',depth+1).attrs);continue;}
   if(['def','over','class'].includes(tokens[pos])){
    const spec=take();if(spec!=='def')throw Error('Flatten USD overrides/classes before importing.');
    const type=take(),name=value();let meta={attrs:{}};
    if(tokens[pos]==='('){pos++;meta=scope(')',depth+1);}expect('{');
    const child=scope('}',depth+1);Object.assign(child.attrs,meta.attrs);Object.assign(child,{type,name});node.children.push(child);continue;
   }
   const header=[];while(pos<tokens.length&&tokens[pos]!=='='){if(['{','}',')'].includes(tokens[pos]))throw Error('Unsupported USDA declaration.');header.push(take());}
   expect('=');const key=header.at(-1);
   if(/references|payload|subLayers|variant|timeSamples/.test(key))throw Error('Flatten USD references, variants and animation before importing.');
   const data=value();let meta={};
   if(tokens[pos]==='('){pos++;meta=scope(')',depth+1).attrs;}
   node.attrs[key]={value:data,meta};
  }
  if(end)expect(end);return node;
 };
 return scope();
}

function usdLocalMatrix(attrs){
 const get=k=>attrs[k]?.value;
 let matrix=identity();
 for(const op of get('xformOpOrder')||[]){
  if(op==='!resetXformStack!')continue;
  if(op.startsWith('!invert!'))throw Error('Bake inverse USD transform operations before importing.');
  const type=op.split(':')[1],v=get(op);let m=identity();
  if(type==='transform'){
   if(!Array.isArray(v)||v.length!==4||v.some(row=>!finite(row,4)))throw Error('Invalid USDA transform matrix.');m=v.flat();
  }else if(type==='translate'||type==='scale'){
   if(!finite(v,3))throw Error('Invalid USDA transform vector.');
   if(type==='translate'){m[12]=v[0];m[13]=v[1];m[14]=v[2];}else{m[0]=v[0];m[5]=v[1];m[10]=v[2];}
  }else if(/^rotate(?:[XYZ]|XYZ|XZY|YXZ|YZX|ZXY|ZYX)$/.test(type)){
   const axes=type.slice(6),angles=axes.length===1?[v]:axes.split('').map(a=>v?.['XYZ'.indexOf(a)]);
   if(!angles.every(Number.isFinite))throw Error('Invalid USDA rotation.');
   for(let i=0;i<axes.length;i++){const r=identity(),a=angles[i]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),axis=axes[i];
    if(axis==='X'){r[5]=c;r[6]=s;r[9]=-s;r[10]=c;}if(axis==='Y'){r[0]=c;r[2]=-s;r[8]=s;r[10]=c;}if(axis==='Z'){r[0]=c;r[1]=s;r[4]=-s;r[5]=c;}m=multiply(r,m);
   }
  }else throw Error(`Unsupported USD transform ${op}. Bake transforms before importing.`);
  matrix=multiply(matrix,m);
 }
 return matrix;
}

export function parseEditableUSDA(text){
 const root=parseUSDA(text),get=(node,k)=>node.attrs[k]?.value;
 const units=Number(get(root,'metersPerUnit')??.01),axis=get(root,'upAxis')||'Y';
 if(!Number.isFinite(units)||units<=0||!['Y','Z'].includes(axis))throw Error('Unsupported USDA units or up axis.');
 const basis=axis==='Z'?[units,0,0,0,0,0,-units,0,0,units,0,0,0,0,0,1]:[units,0,0,0,0,units,0,0,0,0,units,0,0,0,0,1];
 const meshes=[];
 const walk=(node,parent)=>{
  const reset=(get(node,'xformOpOrder')||[]).includes('!resetXformStack!');
  const world=multiply(reset?identity():parent,usdLocalMatrix(node.attrs)),matrix=multiply(basis,world);
  if(node.type==='Mesh'){
   if(get(node,'holeIndices')?.length)throw Error('Remove USD hole faces before importing this control cage.');
   const source=get(node,'points'),counts=get(node,'faceVertexCounts'),indices=get(node,'faceVertexIndices');
   if(!Array.isArray(source)||source.some(p=>!finite(p,3))||!Array.isArray(counts)||!Array.isArray(indices))throw Error('USDA Mesh is missing valid points or polygon topology.');
   if(counts.some(n=>!Number.isInteger(n)||n<3)||counts.reduce((a,b)=>a+b,0)!==indices.length)throw Error('Invalid USDA face counts.');
   if(Math.abs(determinant(matrix))<1e-20)throw Error('Mesh transform collapses an axis.');
   const points=source.map(p=>transform(p,matrix)),faces=[],corners=[];let cursor=0;
   const attribute=(name,vertex,face,corner,size)=>{
    const a=node.attrs[name];if(!a)return null;
    const interpolation=a.meta.interpolation?.value??get(node,`${name}:interpolation`)??'vertex';
    let i=interpolation==='faceVarying'?corner:interpolation==='uniform'?face:interpolation==='constant'?0:interpolation==='vertex'||interpolation==='varying'?vertex:-1;
    if(i<0)throw Error(`Unsupported USDA interpolation ${interpolation}.`);
    const index=get(node,`${name}:indices`);if(index)i=index[i];
    const tuple=a.value[i];if(!finite(tuple,size))throw Error(`Invalid USDA ${name} data.`);return tuple.slice(0,size);
   };
   counts.forEach((count,fi)=>{
    const face=indices.slice(cursor,cursor+count),data=face.map((v,j)=>({uv:attribute('primvars:st',v,fi,cursor+j,2),normal:transformNormal(attribute('normals',v,fi,cursor+j,3),matrix),color:attribute('primvars:displayColor',v,fi,cursor+j,3),tangent:null}));
    const reversed=(get(node,'orientation')==='leftHanded')!==(determinant(matrix)<0);
    if(reversed){face.reverse();data.reverse();}faces.push(face);corners.push(data);cursor+=count;
   });
   meshes.push(finishMesh(String(node.name||'Mesh'),points,faces,corners));
  }
  node.children.forEach(child=>walk(child,world));
 };
 root.children.forEach(child=>walk(child,identity()));
 return validateImportedMeshes(meshes);
}

export function scaleImportedMeshes(meshes,scale){
 if(!Number.isFinite(scale)||scale<=0||scale>10000)throw Error('Import scale must be greater than 0 and at most 10,000.');
 for(const mesh of meshes){mesh.points.forEach(p=>{p.x*=scale;p.y*=scale;p.z*=scale;});if(mesh.meshBake)mesh.meshBake.points=mesh.points.map(p=>({...p}));}
 return validateImportedMeshes(meshes);
}

// Translate the complete import as one assembly, preserving part offsets.
export function centerImportedMeshes(meshes){
 validateImportedMeshes(meshes);
 const low={x:Infinity,y:Infinity,z:Infinity},high={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const mesh of meshes)for(const p of mesh.points)for(const axis of ['x','y','z']){
  low[axis]=Math.min(low[axis],p[axis]);high[axis]=Math.max(high[axis],p[axis]);
 }
 const center=Object.fromEntries(['x','y','z'].map(axis=>[axis,low[axis]/2+high[axis]/2]));
 for(const mesh of meshes){
  mesh.points=mesh.points.map(p=>({...p,x:p.x-center.x,y:p.y-center.y,z:p.z-center.z}));
  if(mesh.meshBake)mesh.meshBake.points=mesh.points.map(p=>({...p}));
 }
 return validateImportedMeshes(meshes);
}

export function fitImportedMeshesToSize(meshes,targetSize){
 validateImportedMeshes(meshes);
 if(!Number.isFinite(targetSize)||targetSize<=0)throw Error('Invalid target mesh size.');
 const low={x:Infinity,y:Infinity,z:Infinity},high={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const mesh of meshes)for(const p of mesh.points)for(const axis of ['x','y','z']){
  low[axis]=Math.min(low[axis],p[axis]);high[axis]=Math.max(high[axis],p[axis]);
 }
 const size=Math.max(high.x-low.x,high.y-low.y,high.z-low.z);
 if(!Number.isFinite(size)||size<=0)throw Error('Mesh has no usable size.');
 const factor=targetSize/size;
 const center=Object.fromEntries(['x','y','z'].map(axis=>[axis,low[axis]/2+high[axis]/2]));
 for(const mesh of meshes){
  mesh.points=mesh.points.map(p=>Object.fromEntries(['x','y','z'].map(axis=>[axis,center[axis]+(p[axis]-center[axis])*factor])));
  if(mesh.meshBake)mesh.meshBake.points=mesh.points.map(p=>({...p}));
 }
 return validateImportedMeshes(meshes);
}
