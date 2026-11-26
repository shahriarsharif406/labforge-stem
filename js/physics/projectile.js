import { gaussian, streamFor } from '../rng.js';
export const DT = 1 / 240;

export function simulateFlight(g, v0, angDeg, record = false) {
  const a = (angDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(a);
  let vy = v0 * Math.sin(a), x = 0, y = 0, t = 0;
  const path = record ? [[0, 0]] : null;
  while (t < 60) {
    const py = y, px = x;
    vy += -g * DT;
    x += vx * DT;
    y += vy * DT;
    t += DT;
    if (y < 0 && t > DT) {
      const f = py / (py - y);
      const xl = px + f * (x - px);
      if (record) path.push([xl, 0]);
      return { range: xl, time: t, path };
    }
    if (record) path.push([x, y]);
  }
  return { range: NaN, time: t, path };
}

export function measureProjectile(inst, v0, angDeg, k) {
  const { range } = simulateFlight(inst.projectile.g, v0, angDeg);
  const rnd = streamFor(inst.seed, 'projectile:' + k);
  return Math.round((range + gaussian(rnd) * inst.projectile.rangeSigma) * 100) / 100;
}
