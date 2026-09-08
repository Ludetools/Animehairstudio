// Row-major grid; normal follows the guide's down-cross-across winding.
export function latticeOffsetNormals(points, columns, rows) {
  if (points.length !== columns * rows || columns < 2 || rows < 2) return null;
  const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  return points.map((_,i) => {
    const r=Math.floor(i/columns),c=i%columns;
    const across=sub(points[r*columns+Math.min(columns-1,c+1)],points[r*columns+Math.max(0,c-1)]);
    const down=sub(points[Math.min(rows-1,r+1)*columns+c],points[Math.max(0,r-1)*columns+c]);
    const n={x:down.y*across.z-down.z*across.y,y:down.z*across.x-down.x*across.z,z:down.x*across.y-down.y*across.x};
    const length=Math.hypot(n.x,n.y,n.z);
    return length>1e-10 ? {x:n.x/length || 0,y:n.y/length || 0,z:n.z/length || 0} : {x:0,y:0,z:0};
  });
}
