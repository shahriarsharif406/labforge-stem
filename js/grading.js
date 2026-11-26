// PURE grading. grade(expId, instance, table, report) -> { total, band, parts[], notes[], pctError, truth, fitValue, r2 }
import { linfit, sigFigs, clamp } from './stats.js';
import { parseQuantity } from './units.js';

export const EXPERIMENTS = {
  pendulum: { unit: 'm/s²', dim: 'accel', correctLin: ['T2_vs_L', 'T_vs_sqrtL'], answer: 'b' },
  ohm: { unit: 'Ω', dim: 'resistance', correctLin: ['V_vs_I', 'I_vs_V'], answer: 'a' },
  projectile: { unit: 'm/s²', dim: 'accel', correctLin: ['R_vs_sin2t'], answer: 'c' },
};

const half = (v) => Math.round(v * 2) / 2;
const fin = (v) => (Number.isFinite(v) ? v : 0);
const truthOf = (id, inst) => (id === 'pendulum' ? inst.pendulum.g : id === 'ohm' ? inst.ohm.R : inst.projectile.g);

// Build (x, y) for a linearization from raw rows. Rows: {x, y, th?, v0?}
export function linearize(expId, lin, rows) {
  const ok = rows.filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));
  if (expId === 'pendulum') {
    if (lin === 'T2_vs_L') return { x: ok.map((r) => r.x), y: ok.map((r) => r.y * r.y), through: true };
    if (lin === 'T_vs_sqrtL') return { x: ok.map((r) => Math.sqrt(Math.max(r.x, 0))), y: ok.map((r) => r.y), through: true };
    return { x: ok.map((r) => r.x), y: ok.map((r) => r.y), through: true };
  }
  if (expId === 'ohm') {
    if (lin === 'I_vs_V') return { x: ok.map((r) => r.x), y: ok.map((r) => r.y / 1000), through: true };
    if (lin === 'V_vs_I2') return { x: ok.map((r) => (r.y / 1000) ** 2), y: ok.map((r) => r.x), through: true };
    return { x: ok.map((r) => r.y / 1000), y: ok.map((r) => r.x), through: true }; // V vs I(A)
  }
  // projectile
  if (lin === 'R_vs_sin2t') return { x: ok.map((r) => Math.sin((2 * r.x * Math.PI) / 180)), y: ok.map((r) => r.y), through: true };
  return { x: ok.map((r) => r.x), y: ok.map((r) => r.y), through: true };
}

// Physical constant implied by a fit slope for the given linearization.
export function valueFromSlope(expId, lin, m, rows) {
  if (!Number.isFinite(m) || m === 0) return NaN;
  if (expId === 'pendulum') return lin === 'T_vs_sqrtL' ? (4 * Math.PI ** 2) / (m * m) : (4 * Math.PI ** 2) / m;
  if (expId === 'ohm') return lin === 'I_vs_V' ? 1 / m : m;
  const v0 = rows.find((r) => Number.isFinite(r.v0))?.v0 ?? NaN;
  return (v0 * v0) / m;
}

export function grade(expId, inst, table, report) {
  const ex = EXPERIMENTS[expId];
  const rows = (table?.rows || []).map((r) => ({ ...r, x: Number(r.x), y: Number(r.y) })).filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));
  const notes = [];
  const parts = [];
  const truth = truthOf(expId, inst);
  const q = parseQuantity(String(report?.valueStr ?? ''));
  let x = NaN;
  if (q.ok) x = q.dim === ex.dim ? q.si : q.value;
  if (q.comma) notes.push('Comma decimal read as a point.');
  const valid = q.ok && Number.isFinite(x) && x > 0;
  if (!q.ok) notes.push('Enter a number with a unit, like 9.81 m/s^2.');
  else if (!(x > 0)) notes.push('Your value must be greater than zero.');

  // Fit on student's own data (correct linearization) for consistency, chosen one for R2
  const lin = report?.linearization || ex.correctLin[0];
  const goodLin = ex.correctLin.includes(lin);
  const baseLin = ex.correctLin[0];
  const L0 = linearize(expId, baseLin, rows);
  const f0 = linfit(L0.x, L0.y, { throughOrigin: true });
  const fitValue = f0.ok ? valueFromSlope(expId, baseLin, f0.m, rows) : NaN;
  const Lc = linearize(expId, lin, rows);
  const fc = linfit(Lc.x, Lc.y, { throughOrigin: true });
  const r2 = fin(fc.r2);

  // A accuracy
  let pctError = NaN, A = 0;
  if (valid) {
    pctError = (100 * Math.abs(x - truth)) / truth;
    A = 35 * clamp((20 - pctError) / 18, 0, 1);
  }
  parts.push({ id: 'A', label: 'Accuracy', max: 35, pts: half(A), formula: '35·clamp((20 − e)/18, 0, 1), e = % error' });
  if (valid && pctError > 2) notes.push(`Your value is ${pctError.toFixed(1)}% from the hidden truth; re-check your slope.`);

  // B consistency
  let B = 0;
  if (valid && Number.isFinite(fitValue) && fitValue > 0) {
    const c = (100 * Math.abs(x - fitValue)) / fitValue;
    B = 10 * clamp((10 - c) / 9, 0, 1);
    if (c > 10) notes.push('Your answer does not match what your own table gives.');
  } else if (rows.length) notes.push('Need at least two different x values to compare with your data.');
  parts.push({ id: 'B', label: 'Matches your data', max: 10, pts: half(B), formula: '10·clamp((10 − c)/9, 0, 1), c = % gap to your own fit' });

  // C linearization + fit
  let C = 0;
  if (goodLin) C += 8;
  else notes.push(expId === 'pendulum' ? 'Use T² on the y-axis against L.' : expId === 'ohm' ? 'Plot V against I; the slope is R.' : 'Plot range against sin(2θ).');
  if (rows.length >= 3 && fc.ok) C += 12 * clamp((r2 - 0.9) / 0.09, 0, 1);
  else notes.push('Need at least 3 distinct points for a fit.');
  parts.push({ id: 'C', label: 'Graph and fit', max: 20, pts: half(C), formula: '8 for a correct graph + 12·clamp((R² − 0.90)/0.09, 0, 1)' });

  // D units
  let D = 0;
  if (q.ok && q.dim === ex.dim) D = 10;
  else if (q.ok && q.unit) notes.push(`Unit "${q.unit}" does not fit; expected ${ex.unit}.`);
  else if (q.ok) notes.push('Add a unit to your value.');
  parts.push({ id: 'D', label: 'Units', max: 10, pts: D, formula: '10 if the unit has the right dimension, else 0' });

  // E sig figs
  let E = 0;
  if (q.ok) {
    const s = sigFigs(String(report.valueStr).replace(/\s*[^\d.,eE+-].*$/, ''));
    E = s === 3 || s === 4 ? 10 : s === 2 || s === 5 ? 5 : 0;
    if (E < 10) notes.push('Report your value with 3 or 4 significant figures.');
  }
  parts.push({ id: 'E', label: 'Significant figures', max: 10, pts: E, formula: '3–4 s.f. = 10, 2 or 5 = 5, otherwise 0' });

  // F method
  let F = 0;
  const xs = rows.map((r) => +r.x.toFixed(6));
  const distinct = new Set(xs).size;
  if (distinct >= 5) F += 3; else notes.push('Take at least 5 different settings.');
  const pos = xs.filter((v) => v > 0);
  let span = false;
  if (expId === 'ohm') span = xs.length > 0 && Math.max(...xs) >= 6;
  else span = pos.length > 0 && Math.max(...pos) / Math.min(...pos) >= 2;
  if (span) F += 3; else notes.push('Spread your settings wider (at least 2× range).');
  const repeated = distinct < xs.length;
  if (repeated) F += 3; else notes.push('Repeat at least one setting to check consistency.');
  let spec = false;
  if (rows.length) {
    if (expId === 'pendulum') spec = rows.every((r) => !Number.isFinite(r.th) || r.th <= 15);
    else if (expId === 'ohm') {
      const fr = linfit(rows.map((r) => r.x), rows.map((r) => r.y));
      const maxI = Math.max(...rows.map((r) => r.y));
      spec = xs.includes(0) || (fr.ok && maxI > 0 && Math.abs(fr.b) < 0.02 * maxI);
    } else spec = new Set(rows.map((r) => r.v0)).size === 1;
  }
  if (spec) F += 3; else if (rows.length) notes.push(expId === 'pendulum' ? 'Keep the swing angle at 15° or less.' : expId === 'ohm' ? 'Include V = 0 to check the line passes through the origin.' : 'Keep the launch speed the same for every shot.');
  if (report?.conclusion === ex.answer) F += 3; else notes.push('Re-read the conclusion question.');
  parts.push({ id: 'F', label: 'Method', max: 15, pts: F, formula: '5 checks × 3: ≥5 settings, 2× span, a repeat, experiment rule, conclusion' });

  const total = Math.round(parts.reduce((s, p) => s + fin(p.pts), 0));
  const band = total >= 90 ? 'Distinction' : total >= 75 ? 'Merit' : total >= 50 ? 'Pass' : 'Revise';
  return { total: clamp(total, 0, 100), band, parts, notes: notes.slice(0, 6), pctError: Number.isFinite(pctError) ? pctError : null, truth, fitValue: Number.isFinite(fitValue) ? fitValue : null, r2, nRows: rows.length };
}
