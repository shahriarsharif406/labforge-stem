import { gaussian, streamFor } from '../rng.js';

// Returns current in mA (meter rounded to meterRes).
export function measureOhm(inst, V, k, noisePctOverride) {
  const noise = (noisePctOverride ?? inst.ohm.noisePct) / 100;
  const Itrue = (V / inst.ohm.R) * 1000; // mA
  const rnd = streamFor(inst.seed, 'ohm:' + k);
  const Im = Itrue * (1 + gaussian(rnd) * noise);
  const res = inst.ohm.meterRes;
  return Math.max(0, Number((Math.round(Im / res) * res).toFixed(1)));
}
export const trueCurrentmA = (inst, V) => (V / inst.ohm.R) * 1000;
