const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function endToEndSections(sources) {
 if(sources.length>64)throw Error('End-to-end chains support at most 64 strands.');
 const sorted=[...sources].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 for(const source of sorted)if(!Array.isArray(source.points)||source.points.length<2||source.points.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))throw Error('A strand needs a valid curve.');
 const routes=sorted.map(first=>{
  const order=[first],remaining=sorted.filter(s=>s!==first);let cost=0;
  while(remaining.length){
   const tip=order.at(-1).points.at(-1);
   let best=0;for(let i=1;i<remaining.length;i++)if(distance(tip,remaining[i].points[0])<distance(tip,remaining[best].points[0]))best=i;
   cost+=distance(tip,remaining[best].points[0]);order.push(remaining.splice(best,1)[0]);
  }
  return {order,cost};
 }).sort((a,b)=>a.cost-b.cost);
 const order=routes[0]?.order||[],sections=[];
 const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
 for(const source of order){
  const span=length(source.points);if(span<1e-7)throw Error('The selected curve has no length.');
  if(sections.length){
   const prior=sections.at(-1),a=prior.points.at(-1),b=source.points[0],gap=distance(a,b);
   if(gap>1e-7)sections.push({points:[a,b],normals:[prior.normals?.at(-1)||[0,0,1],source.normals?.[0]||[0,0,1]],length:gap});
  }
  sections.push({points:source.points,normals:source.normals,length:span});
 }
 if(sections.length>64)throw Error('Too many strand connections for a 64-bone chain. Select fewer strands.');
 return {order,sections};
}

export function distributeEndToEndBones(sections,budget) {
 const count=Math.max(sections.length,Math.min(64,Math.max(1,Math.round(Number(budget)||6))));
 const counts=sections.map(()=>1);
 for(let n=sections.length;n<count;n++){
  let best=0;for(let i=1;i<sections.length;i++)if(sections[i].length/counts[i]>sections[best].length/counts[best])best=i;
  counts[best]++;
 }
 return counts;
}
