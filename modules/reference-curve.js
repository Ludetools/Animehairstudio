// Deterministic mask-to-center-path extraction. Coordinates are normalised to
// the selected image rectangle; no colour segmentation or hidden-depth guess.
export function traceReferenceCurve(polygon, root, tip, { resolution = 96, tolerance = 0.006 } = {}) {
  const n = Math.max(24, Math.min(160, Math.round(resolution)));
  const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(valid) || !valid(root) || !valid(tip)) {
    throw new Error('Outline a lock, then mark its root and tip.');
  }
  const inside = p => {
    let hit = false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i], b=polygon[j];
      if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  };
  const point = i => ({x:(i%n+0.5)/n,y:(Math.floor(i/n)+0.5)/n});
  const mask = Uint8Array.from({length:n*n}, (_,i)=>Number(inside(point(i))));
  const neighbours = i => {
    const x=i%n,y=Math.floor(i/n), result=[];
    if(x) result.push(i-1); if(x<n-1) result.push(i+1);
    if(y) result.push(i-n); if(y<n-1) result.push(i+n);
    return result;
  };
  const distance = new Float64Array(n*n).fill(Infinity), queue=[];
  mask.forEach((v,i)=>{if(!v || i%n===0 || i%n===n-1 || i<n || i>=n*(n-1)){distance[i]=0;queue.push(i);}});
  for(let k=0;k<queue.length;k++) for(const j of neighbours(queue[k])) {
    if(distance[j]>distance[queue[k]]+1){distance[j]=distance[queue[k]]+1;queue.push(j);}
  }
  const snap = p => {
    let best=-1,d=Infinity;
    mask.forEach((v,i)=>{if(v){const q=point(i),s=(q.x-p.x)**2+(q.y-p.y)**2;if(s<d){d=s;best=i;}}});
    if(best<0 || d>0.04**2) throw new Error('Place root and tip inside the outlined lock.');
    return best;
  };
  const start=snap(root), end=snap(tip);
  if(start===end) throw new Error('Root and tip must be farther apart.');
  const costs=new Float64Array(n*n).fill(Infinity), previous=new Int32Array(n*n).fill(-1), heap=[];
  const push = item => {
    heap.push(item);let i=heap.length-1;
    while(i){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;
  };
  const pop = () => {
    const first=heap[0],last=heap.pop();
    if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(last[0]<=heap[c][0])break;heap[i]=heap[c];i=c;}heap[i]=last;}
    return first;
  };
  costs[start]=0;push([0,start]);
  while(heap.length){
    const [cost,i]=pop();if(cost!==costs[i])continue;if(i===end)break;
    for(const j of neighbours(i)) if(mask[j]) {
      const next=cost+1+24/(distance[j]+1)**2;
      if(next<costs[j]){costs[j]=next;previous[j]=i;push([next,j]);}
    }
  }
  if(!Number.isFinite(costs[end])) throw new Error('The selection is disconnected or too narrow. Redraw its outline.');
  const path=[];for(let i=end;i!==-1;i=previous[i]){path.push(point(i));if(i===start)break;}path.reverse();
  // Simplify the raster path while refusing shortcuts outside the mask.
  const result=[path[0]], epsilon=Math.max(0.002,Math.min(0.025,Number(tolerance)||0.006));
  let first=0;
  while(first<path.length-1){
    let last=first+1;
    for(let candidate=first+2;candidate<path.length;candidate++){
      const a=path[first],b=path[candidate],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
      let okay=true;
      for(let k=first+1;k<candidate;k++){const p=path[k],t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)>epsilon){okay=false;break;}}
      for(let k=1;okay&&k<32;k++) if(!inside({x:a.x+dx*k/32,y:a.y+dy*k/32}))okay=false;
      if(!okay)break;last=candidate;
    }
    result.push(path[last]);first=last;
  }
  if(result.length>100) throw new Error('This outline is too complex. Select a single simpler lock.');
  return result;
}
