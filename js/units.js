// parseQuantity("9.8 m/s^2") -> { value, unit, dim, si, comma, ok }
const PREFIX = { k: 1e3, m: 1e-3, c: 1e-2, M: 1e6, '': 1 };

function unitInfo(u) {
  const s = u.replace(/\s+/g, '').replace('²', '^2').replace('Ω', 'ohm').replace('ω', 'ohm').replace('Ohm', 'ohm').replace('ohms', 'ohm').replace(/\*\*/g, '^');
  let m;
  if ((m = s.match(/^([kmcM]?)m\/s\^2$/))) return { dim: 'accel', f: PREFIX[m[1]] };
  if ((m = s.match(/^([kmcM]?)m\/s$/))) return { dim: 'speed', f: PREFIX[m[1]] };
  if ((m = s.match(/^([kM]?)ohm$/i)) || (m = s.match(/^([kM]?)ohm$/))) return { dim: 'resistance', f: PREFIX[m[1] || ''] };
  if (/^ohm$/i.test(s)) return { dim: 'resistance', f: 1 };
  if ((m = s.match(/^([kmc]?)m$/))) return { dim: 'length', f: PREFIX[m[1]] };
  if (/^s$/.test(s)) return { dim: 'time', f: 1 };
  if ((m = s.match(/^([m]?)A$/))) return { dim: 'current', f: PREFIX[m[1]] };
  if (/^V$/.test(s)) return { dim: 'voltage', f: 1 };
  return null;
}

export function parseQuantity(str) {
  const out = { ok: false, value: NaN, unit: '', dim: null, si: NaN, comma: false };
  if (typeof str !== 'string') return out;
  const m = str.trim().match(/^([+-]?\d*[.,]?\d+(?:[eE][+-]?\d+)?)\s*(.*)$/);
  if (!m) return out;
  out.comma = m[1].includes(',');
  out.value = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(out.value)) return out;
  out.unit = m[2].trim();
  out.ok = true;
  const info = out.unit ? unitInfo(out.unit) : null;
  if (info) { out.dim = info.dim; out.si = out.value * info.f; }
  else out.si = out.value;
  out.recognized = !!info;
  return out;
}
