export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const stdev = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Least squares. throughOrigin => y = m x ; else y = m x + b. R2 uses free-intercept fit always.
export function linfit(x, y, { throughOrigin = false } = {}) {
  const n = Math.min(x.length, y.length);
  const out = { n, m: NaN, b: 0, r2: 0, ok: false };
  if (n < 2) return out;
  const distinct = new Set(x.slice(0, n).map((v) => +v.toFixed(9))).size;
  if (distinct < 2) return out;
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let sxx = 0, sxy = 0, syy = 0, sxx0 = 0, sxy0 = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2;
    sxx0 += x[i] * x[i]; sxy0 += x[i] * y[i];
  }
  const mFree = sxy / sxx, bFree = my - mFree * mx;
  let ssres = 0;
  for (let i = 0; i < n; i++) ssres += (y[i] - (mFree * x[i] + bFree)) ** 2;
  out.r2 = syy === 0 ? 0 : 1 - ssres / syy;
  if (n < 3) out.r2 = 0;
  out.mFree = mFree; out.bFree = bFree;
  if (throughOrigin) { out.m = sxx0 === 0 ? NaN : sxy0 / sxx0; out.b = 0; }
  else { out.m = mFree; out.b = bFree; }
  out.ok = Number.isFinite(out.m);
  return out;
}

// Significant figures of a numeric string. Trailing zeros of integers are NOT significant.
export function sigFigs(str) {
  let s = String(str).trim().replace(',', '.').replace(/^[+-]/, '');
  const m = s.match(/^(\d*\.?\d*)(?:e[+-]?\d+)?$/i);
  if (!m || !/\d/.test(m[1])) return 0;
  let d = m[1];
  if (d.includes('.')) {
    const digits = d.replace('.', '').replace(/^0+/, '');
    return digits.length;
  }
  return d.replace(/^0+/, '').replace(/0+$/, '').length;
}
