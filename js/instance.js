import { cyrb53, streamFor } from './rng.js';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const r2 = (x) => Math.round(x * 100) / 100;

const SYL_A = ['Ve', 'Ky', 'Or', 'Ta', 'Zu', 'Mi', 'Ar', 'Lu', 'No', 'Xe', 'Ha', 'Pe'];
const SYL_B = ['yra', 'ndos', 'lune', 'thos', 'vara', 'mere', 'quil', 'dara', 'nox', 'rian'];

export function createInstance(studentId, classCode = '') {
  const seed = cyrb53(norm(studentId) + '|' + (norm(classCode) || 'open')) >>> 0;
  const rnd = streamFor(seed, 'instance');
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const range = (lo, hi) => lo + rnd() * (hi - lo);
  const name = pick(SYL_A) + pick(SYL_B) + '-' + (1 + Math.floor(rnd() * 9));
  return {
    v: 1,
    seed,
    seedTag: 'LF-' + seed.toString(36).toUpperCase().slice(0, 4).padEnd(4, '0'),
    planet: { name, hue: Math.floor(range(0, 360)) },
    pendulum: { g: r2(range(3, 25)), timingSigma: 0.01 },
    ohm: { R: Math.round(range(47, 470)), noisePct: Math.round(range(1, 5)), meterRes: 0.1 },
    projectile: { g: r2(range(3, 25)), v0Options: [10, 15, 20], rangeSigma: 0.02 },
  };
}
