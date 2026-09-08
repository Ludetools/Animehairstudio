export function resizeStrandLattice(data, columns, rows, pointAt = null) {
  if (!Number.isInteger(columns) || !Number.isInteger(rows)
    || columns < 2 || columns > 128 || rows < 2 || rows > 256) return null;
  const oldColumns = data.curveSurfaceColumns, oldRows = data.curveSurfaceRows;
  if (data.points?.length !== oldColumns * oldRows || oldColumns < 2 || oldRows < 2) return null;
  const blend = (a, b, t) => {
    if (a == null || b == null) return a == null ? b == null ? null : blend(b,b,0) : blend(a,a,0);
    if (typeof a === 'number') return a + (b-a)*t;
    return Object.fromEntries(Object.keys(a).filter(k=>typeof a[k]==='number').map(k=>[k,a[k]+(b[k]-a[k])*t]));
  };
  const sample = (values, column, t) => {
    const row = t*(oldRows-1), low = Math.floor(row), high = Math.min(oldRows-1,low+1);
    return blend(values[column*oldRows+low], values[column*oldRows+high], row-low);
  };
  const result = {curveSurfaceColumns:columns,curveSurfaceRows:rows};
  for (const key of ['points','pointTwists','pointScales','pointWidths','pointSurfaceNormals','curvePointSharpness']) {
    const values=data[key];
    if (!values?.length && key !== 'points') { result[key]=[];continue; }
    result[key]=[];
    for(let c=0;c<columns;c++) {
      const position=c*(oldColumns-1)/(columns-1),left=Math.floor(position),right=Math.min(oldColumns-1,left+1);
      for(let r=0;r<rows;r++) {
        const t=r/(rows-1);
        const at=column=>key==='points' && pointAt ? pointAt(column,t) : sample(values,column,t);
        result[key].push(blend(at(left),at(right),position-left));
      }
    }
  }
  result.curveSurfaceCenterCurve=Math.round((data.curveSurfaceCenterCurve || 0)*(columns-1)/(oldColumns-1));
  return result;
}
