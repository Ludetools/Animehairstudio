// Ear clipping in the dominant Newell-normal projection. Returned indices
// refer to authored vertices; diagonals never become authored topology.
export function triangulatePolygon(points, face) {
  if (!Array.isArray(face) || face.length < 3) return [];
  const normal=[0,0,0];
  for(let i=0;i<face.length;i++){
    const a=points[face[i]],b=points[face[(i+1)%face.length]];
    if(!a||!b)return [];
    normal[0]+=(a.y-b.y)*(a.z+b.z);normal[1]+=(a.z-b.z)*(a.x+b.x);normal[2]+=(a.x-b.x)*(a.y+b.y);
  }
  const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  if(!normal[drop])return [];
  const axes=['x','y','z'].filter((_,i)=>i!==drop);
  const p=face.map(i=>axes.map(k=>points[i][k]));
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let area=0;for(let i=0;i<p.length;i++)area+=p[i][0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*p[i][1];
  const sign=Math.sign(area),epsilon=Math.abs(area)*1e-12;
  if(!sign)return [];
  if(face.length===4&&cross(p[0],p[1],p[2])*sign>epsilon&&cross(p[0],p[2],p[3])*sign>epsilon)return [[face[0],face[1],face[2]],[face[0],face[2],face[3]]];
  const remaining=face.map((_,i)=>i),result=[];
  while(remaining.length>3){
    let clipped=false;
    for(let i=0;i<remaining.length;i++){
      const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
      if(cross(p[a],p[b],p[c])*sign<=epsilon)continue;
      if(remaining.some(v=>v!==a&&v!==b&&v!==c&&cross(p[a],p[b],p[v])*sign>=-epsilon&&cross(p[b],p[c],p[v])*sign>=-epsilon&&cross(p[c],p[a],p[v])*sign>=-epsilon))continue;
      result.push([face[a],face[b],face[c]]);remaining.splice(i,1);clipped=true;break;
    }
    if(!clipped)return [];
  }
  if(cross(...remaining.map(i=>p[i]))*sign<=epsilon)return [];
  result.push(remaining.map(i=>face[i]));return result;
}
