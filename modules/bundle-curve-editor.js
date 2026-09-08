export function mountBundleCurveEditor(root, title, read, write) {
  const doc=root.ownerDocument, ns='http://www.w3.org/2000/svg';
  const section=doc.createElement('fieldset'), legend=doc.createElement('legend');
  legend.textContent=title; section.append(legend);
  const svg=doc.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 240 110'); svg.setAttribute('preserveAspectRatio','none'); svg.setAttribute('aria-label',title); svg.classList.add('bundle-curve-editor');
  const line=doc.createElementNS(ns,'polyline'); svg.append(line);
  let drag=null;
  const handles=Array.from({length:9},(_,index)=>{
    const handle=doc.createElementNS(ns,'circle');handle.setAttribute('r','5');handle.setAttribute('tabindex','0');
    handle.setAttribute('role','slider');handle.setAttribute('aria-label',`${title} at ${index*12.5}%`);
    handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','2');
    handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();drag={id:event.pointerId,index,before:read().map(p=>({...p}))};svg.setPointerCapture(event.pointerId);});
    handle.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const curve=read().map(p=>({...p}));
      curve[index].value=event.key==='Home'?0:event.key==='End'?2:Math.max(0,Math.min(2,curve[index].value+(event.key==='ArrowUp'?.05:-.05)));
      write(curve);render();
    });
    svg.append(handle);return handle;
  });
  const render=()=>{const curve=read();line.setAttribute('points',curve.map((p,i)=>`${10+i*27.5},${100-p.value*45}`).join(' '));handles.forEach((h,i)=>{h.setAttribute('cx',String(10+i*27.5));h.setAttribute('cy',String(100-curve[i].value*45));h.setAttribute('aria-valuenow',String(curve[i].value));});};
  svg.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const rect=svg.getBoundingClientRect();const curve=read().map(p=>({...p}));
    curve[drag.index].value=Math.max(0,Math.min(2,(100-(event.clientY-rect.top)/rect.height*110)/45));
    write(curve);render();
  });
  const finish=(event,cancel)=>{if(!drag||event.pointerId!==drag.id)return;const old=drag;drag=null;if(cancel){write(old.before);render();}if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);};
  svg.addEventListener('pointerup',event=>finish(event,false));svg.addEventListener('pointercancel',event=>finish(event,true));
  svg.addEventListener('lostpointercapture',event=>finish(event,true));
  const hint=doc.createElement('small');hint.textContent='Root → Tip · Drag points vertically (0–2×). Arrow keys adjust focused points.';
  section.append(svg,hint);root.append(section);render();return {render};
}
