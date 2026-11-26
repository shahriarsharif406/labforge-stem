// Nonlinear pendulum, semi-implicit Euler, fixed dt. PURE (no DOM).
import { gaussian, streamFor } from '../rng.js';
export const DT = 1 / 240;

export function stepPendulum(s, g, L, dt = DT) {
  s.w += -(g / L) * Math.sin(s.th) * dt;
  s.th += s.w * dt;
  return s;
}

// Virtual photogate: time of n upward zero-crossings of theta, linear interpolation.
export function simulatePeriod(g, L, theta0Deg, swings = 10) {
  const s = { th: (theta0Deg * Math.PI) / 180, w: 0 };
  let t = 0, prev = s.th, crossings = [];
  const maxT = 400;
  while (crossings.length < swings + 1 && t < maxT) {
    stepPendulum(s, g, L);
    t += DT;
    if (prev < 0 && s.th >= 0) {
      const f = -prev / (s.th - prev);
      crossings.push(t - DT + f * DT);
    }
    prev = s.th;
  }
  if (crossings.length < swings + 1) return NaN;
  return (crossings[swings] - crossings[0]) / swings;
}

export function measurePendulum(inst, L, theta0Deg, k) {
  const T = simulatePeriod(inst.pendulum.g, L, theta0Deg, 10);
  const rnd = streamFor(inst.seed, 'pendulum:' + k);
  const Tm = T + (gaussian(rnd) * inst.pendulum.timingSigma) / Math.sqrt(10);
  return Math.round(Tm * 1000) / 1000;
}

export const smallAnglePeriod = (g, L) => 2 * Math.PI * Math.sqrt(L / g);
