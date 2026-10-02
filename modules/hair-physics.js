import {rigJointFrame} from './hair-rig.js';
import {followParentVector, boneLimitFrame, constrainBoneDirection} from './hair-bone-limits.js';
// Preview-only, fixed-step chain dynamics. Inputs and authored rigs are never mutated.
export function createChainSimulation(points) {
  if (!Array.isArray(points) || points.length < 2 || points.some(p => !Array.isArray(p) || p.length !== 3 || p.some(v => !Number.isFinite(v)))) throw new Error('Invalid physics chain');
  const rest = points.map(p => [...p]);
  return {rest, points: rest.map(p => [...p]), previous: rest.map(p => [...p]),
    lengths: rest.slice(1).map((p, i) => Math.hypot(...p.map((v, a) => v - rest[i][a]))), accumulator: 0};
}

export function shakeChainSimulation(chain) {
  const speed = chain.lengths.reduce((a, b) => a + b, 0) * 2;
  chain.previous.slice(1).forEach((p, i) => { p[0] -= speed / 120 * (i + 1) / (chain.points.length - 1); });
}

export function stepChainSimulation(chain, elapsed, {gravity = 1, stiffness = 0.35, damping = 0.2, enabled = [], limits = [], normals = []} = {}) {
  const clamp = (v, fallback, max = 1) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
  gravity = clamp(gravity, 1, 2); stiffness = clamp(stiffness, 0.35); damping = clamp(damping, 0.2);
  const dt = 1 / 120, total = chain.lengths.reduce((a, b) => a + b, 0);
  const velocityDecay = Math.exp(-(1 + damping * 24) * dt), delta = [0,0,0];
  // Rest targets/normals are stable within this call, but may change next frame.
  // Cache only the rest basis; the parent-relative posed frame stays dynamic.
  let restFrames;
  chain.accumulator += clamp(elapsed, 0, 0.1);
  while (chain.accumulator + 1e-10 >= dt) {
    chain.accumulator -= dt;
    for (let a = 0; a < 3; a++) chain.points[0][a] = chain.rest[0][a];
    for (let i = 1; i < chain.points.length; i++) {
      const p = chain.points[i], previous = chain.previous[i];
      if (enabled[i - 1] === false) {
        let offset = chain.rest[i].map((v,a)=>v-chain.rest[i-1][a]);
        if (i > 1) offset = followParentVector(offset,
          chain.rest[i-1].map((v,a)=>v-chain.rest[i-2][a]),
          chain.points[i-1].map((v,a)=>v-chain.points[i-2][a]));
        for(let a=0;a<3;a++) p[a]=chain.points[i-1][a]+offset[a];
        for (let a = 0; a < 3; a++) previous[a] = p[a];
        continue; // Kinematic bones inherit their parent without gravity response.
      }
      for (let a = 0; a < 3; a++) {
        const before = p[a];
        const target = chain.points[i - 1][a] + chain.rest[i][a] - chain.rest[i - 1][a];
        p[a] += (p[a] - previous[a]) * velocityDecay
          + ((target - p[a]) * stiffness * 180 - (a === 1 ? gravity * total * 4 : 0)) * dt * dt;
        previous[a] = before;
      }
      // Root-to-tip projection gives exact lengths without displacing the root.
      const parent = chain.points[i - 1];
      for (let a = 0; a < 3; a++) delta[a] = p[a] - parent[a];
      let frame = null;
      if (limits[i-1]?.mode && limits[i-1].mode !== 'free') {
        restFrames ||= [];
        const restFrame = restFrames[i-1] ||= rigJointFrame(chain.rest,normals,i-1);
        frame = boneLimitFrame(chain.rest,chain.points,restFrame,i-1);
      }
      const distance = Math.hypot(...delta);
      for (let a = 0; a < 3; a++) p[a] = parent[a] + (distance > 1e-12 ? delta[a] / distance * chain.lengths[i - 1] : chain.rest[i][a] - chain.rest[i - 1][a]);
      if (frame) {
        const direction=p.map((v,a)=>v-parent[a]);
        const limited=constrainBoneDirection(direction,frame,limits[i-1]);
        const result=limited.map((v,a)=>parent[a]+v*chain.lengths[i-1]);
        const changed=result.some((v,a)=>Math.abs(v-p[a])>1e-10);
        result.forEach((v,a)=>{p[a]=v;});
        if (changed) for (let a = 0; a < 3; a++) previous[a] = p[a];
      }
    }
  }
  return chain.points;
}
