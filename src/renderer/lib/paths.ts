export function rounded(all: { x: number; y: number }[]): string {
  const pts = all.filter((q, n) => n === 0 || q.x !== all[n - 1].x || q.y !== all[n - 1].y);
  const p = pts.filter((q, n) => n === 0 || n === pts.length - 1 || !((pts[n - 1].x === q.x && q.x === pts[n + 1].x) || (pts[n - 1].y === q.y && q.y === pts[n + 1].y)));
  let d = `M${p[0].x} ${p[0].y}`;
  for (let n = 1; n < p.length - 1; n++) {
    const P = p[n - 1], Q = p[n], R = p[n + 1];
    const a = Math.min(4, Math.hypot(Q.x - P.x, Q.y - P.y) / 2), b = Math.min(4, Math.hypot(R.x - Q.x, R.y - Q.y) / 2);
    d += ` L${Q.x - Math.sign(Q.x - P.x) * a} ${Q.y - Math.sign(Q.y - P.y) * a} Q${Q.x} ${Q.y} ${Q.x + Math.sign(R.x - Q.x) * b} ${Q.y + Math.sign(R.y - Q.y) * b}`;
  }
  return `${d} L${p[p.length - 1].x} ${p[p.length - 1].y}`;
}
