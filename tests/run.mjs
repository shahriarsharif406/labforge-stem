// node tests/run.mjs  — physics, stats, units, grading
import { createInstance } from '../js/instance.js';
import { simulatePeriod, smallAnglePeriod, measurePendulum } from '../js/physics/pendulum.js';
import { measureOhm } from '../js/physics/ohm.js';
import { simulateFlight, measureProjectile } from '../js/physics/projectile.js';
import { linfit, sigFigs } from '../js/stats.js';
import { parseQuantity } from '../js/units.js';
import { grade } from '../js/grading.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const inst = createInstance('ana', 'physics-101');

// 1 determinism / distinctness
ok('1a same id => same instance', JSON.stringify(createInstance('ana', 'physics-101')) === JSON.stringify(inst));
const gs = new Set(Array.from({ length: 50 }, (_, i) => createInstance('student' + i).pendulum.g));
ok('1b 50 ids => >=45 distinct g', gs.size >= 45, String(gs.size));
// 2 normalization
ok('2 "  Ana " == "ana"', createInstance('  Ana ', 'physics-101').seed === inst.seed);
// 3, 4 pendulum
const mk = (g) => ({ ...inst, pendulum: { ...inst.pendulum, g } });
const T5 = simulatePeriod(9.81, 1, 5);
ok('3 pendulum small angle within 0.3%', near(T5 / smallAnglePeriod(9.81, 1), 1, 0.003), String(T5));
const T40 = simulatePeriod(9.81, 1, 40);
const ratio = T40 / smallAnglePeriod(9.81, 1);
ok('4 40deg longer by 2.5-3.5%', ratio > 1.025 && ratio < 1.035, String(ratio));
// 5 ohm slope
{
  const V = [1, 2, 3, 4, 5, 6], I = V.map((v, k) => measureOhm(inst, v, k, 0) / 1000);
  const f = linfit(I, V, { throughOrigin: true });
  ok('5 ohm noise0 slope ~ R (meter rounding)', near(f.m / inst.ohm.R, 1, 0.02), `${f.m} vs ${inst.ohm.R}`);
}
// 6 projectile
{
  const r45 = simulateFlight(9.81, 20, 45).range, r30 = simulateFlight(9.81, 20, 30).range, r60 = simulateFlight(9.81, 20, 60).range;
  ok('6a 45deg range ~ v0^2/g', near(r45 / (400 / 9.81), 1, 0.005), String(r45));
  ok('6b 30 and 60 equal', near(r30 / r60, 1, 0.005));
}

// helpers generating tables
const pendRows = (i, extra = {}) => [0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 0.5].map((L, k) => ({ x: L, y: measurePendulum(i, L, 8, k), th: 8 }));
const ohmRows = (i, noise) => [0, 2, 4, 6, 8, 10, 12, 6].map((V, k) => ({ x: V, y: measureOhm(i, V, k, noise) }));
const projRows = (i) => [20, 30, 40, 45, 55, 65, 75, 45].map((a, k) => ({ x: a, y: measureProjectile(i, 15, a, k), v0: 15 }));
const fmt3 = (v) => Number(v.toPrecision(3)).toString();

// 7 perfect report
{
  const t = { rows: pendRows(inst) };
  const g = grade('pendulum', inst, t, { valueStr: fmt3(inst.pendulum.g) + ' m/s^2', linearization: 'T2_vs_L', conclusion: 'b' });
  ok('7a perfect pendulum >=95', g.total >= 95, JSON.stringify(g.parts.map((p) => p.pts)) + ' ' + g.total);
  const go = grade('ohm', inst, { rows: ohmRows(inst) }, { valueStr: fmt3(inst.ohm.R) + ' ohm', linearization: 'V_vs_I', conclusion: 'a' });
  ok('7b perfect ohm >=90', go.total >= 90, go.total + ' ' + JSON.stringify(go.parts.map((p) => p.pts)));
  const gp = grade('projectile', inst, { rows: projRows(inst) }, { valueStr: fmt3(inst.projectile.g) + ' m/s^2', linearization: 'R_vs_sin2t', conclusion: 'c' });
  ok('7c perfect projectile >=95', gp.total >= 95, gp.total + ' ' + JSON.stringify(gp.parts.map((p) => p.pts)));
}
// 8 accuracy boundaries
{
  const t = { rows: pendRows(inst) };
  const A = (e) => grade('pendulum', inst, t, { valueStr: (inst.pendulum.g * (1 + e / 100)).toFixed(3) + ' m/s^2', linearization: 'T2_vs_L', conclusion: 'b' }).parts[0].pts;
  ok('8a e=2% => 35', A(2) === 35, A(2));
  ok('8b e=11% => 17.5', A(11) === 17.5, A(11));
  ok('8c e=20% => 0', A(20) === 0, A(20));
  ok('8d e=50% => 0', A(50) === 0);
}
// 9 empty table
{
  const g = grade('pendulum', inst, { rows: [] }, { valueStr: fmt3(inst.pendulum.g) + ' m/s^2', linearization: 'T2_vs_L', conclusion: 'b' });
  ok('9 empty table no crash, B=0, fit part 0', g.parts[1].pts === 0 && g.parts[2].pts === 8 && g.nRows === 0);
}
// 10 single row / same x
{
  for (const rows of [[{ x: 0.5, y: 1.4, th: 5 }], [{ x: 0.5, y: 1.4, th: 5 }, { x: 0.5, y: 1.41, th: 5 }, { x: 0.5, y: 1.39, th: 5 }]]) {
    const g = grade('pendulum', inst, { rows }, { valueStr: '9.81 m/s^2', linearization: 'T2_vs_L', conclusion: 'b' });
    const finite = g.parts.every((p) => Number.isFinite(p.pts)) && Number.isFinite(g.total) && (g.r2 === 0 || Number.isFinite(g.r2));
    ok('10 degenerate data finite', finite && g.parts[2].pts <= 8);
  }
}
// 11 units
{
  const t = { rows: pendRows(inst) };
  const D = (s) => grade('pendulum', inst, t, { valueStr: s, linearization: 'T2_vs_L', conclusion: 'b' }).parts[3].pts;
  ok('11a "9.8 m/s" => D 0', D('9.8 m/s') === 0);
  ok('11b "9.8" no unit => D 0', D('9.8') === 0);
  const ro = { ...inst, ohm: { ...inst.ohm, R: 330 } };
  const g = grade('ohm', ro, { rows: ohmRows(ro) }, { valueStr: '0.33 kΩ', linearization: 'V_vs_I', conclusion: 'a' });
  ok('11c 0.33 kΩ for 330Ω => D 10, A full', g.parts[3].pts === 10 && g.parts[0].pts === 35, JSON.stringify(g.parts.slice(0, 4).map((p) => p.pts)));
}
// 12 garbage
{
  let thrown = false;
  try {
    for (const s of ['abc', '', '1e999', '-9.8', '9,8', '   ', '9.8.8 m/s^2', 'NaN'])
      grade('pendulum', inst, { rows: pendRows(inst) }, { valueStr: s, linearization: 'T2_vs_L', conclusion: 'b' });
    const c = grade('pendulum', inst, { rows: pendRows(inst) }, { valueStr: '9,8 m/s^2' });
    ok('12 comma accepted', parseQuantity('9,8 m/s^2').value === 9.8 && c.notes.some((n) => /Comma/.test(n)));
  } catch (e) { thrown = true; console.log(e); }
  ok('12 garbage no throw', !thrown);
}
// 13 extreme noise
{
  const g = grade('ohm', inst, { rows: ohmRows(inst, 50) }, { valueStr: fmt3(inst.ohm.R) + ' ohm', linearization: 'V_vs_I', conclusion: 'a' });
  ok('13 50% noise graded in [0,100]', g.total >= 0 && g.total <= 100 && Number.isFinite(g.r2));
}
// 14 sig figs
{
  const cases = [['9.8', 2], ['9.81', 3], ['9.810', 4], ['0.00981', 3], ['1200', 2]];
  for (const [s, n] of cases) ok(`14 sigFigs(${s})=${n}`, sigFigs(s) === n, String(sigFigs(s)));
}
// 15 copy attempt
{
  let b = createInstance('bob', 'physics-101');
  for (let i = 0; Math.abs(b.pendulum.g / inst.pendulum.g - 1) < 0.25; i++) b = createInstance('bob' + i, 'physics-101');
  const gb = grade('pendulum', b, { rows: pendRows(b) }, { valueStr: fmt3(inst.pendulum.g) + ' m/s^2', linearization: 'T2_vs_L', conclusion: 'b' });
  const gh = grade('pendulum', b, { rows: pendRows(b) }, { valueStr: fmt3(b.pendulum.g) + ' m/s^2', linearization: 'T2_vs_L', conclusion: 'b' });
  ok('15 copied value scores lower', gb.total < gh.total && gb.parts[1].pts < gh.parts[1].pts, `${gb.total} vs ${gh.total}`);
}
// 16 replay determinism
ok('16 same trial index => same value', measurePendulum(inst, 0.8, 10, 3) === measurePendulum(inst, 0.8, 10, 3) && measureOhm(inst, 5, 2) === measureOhm(inst, 5, 2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
