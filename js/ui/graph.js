// Scatter + through-origin fit on a 2D canvas.
export function drawGraph(canvas, xs, ys, fit, labels = {}) {
  const d = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
  const w = Math.max(10, r.width), h = Math.max(10, r.height);
  canvas.width = w * d; canvas.height = h * d;
  const c = canvas.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
  const padL = 46, padB = 34, padT = 12, padR = 14;
  c.font = '11px "JetBrains Mono",monospace';
  const ok = xs.length > 0;
  const mx = ok ? Math.max(...xs, 1e-9) * 1.1 : 1, my = ok ? Math.max(...ys, 1e-9) * 1.1 : 1;
  const X = (v) => padL + (v / mx) * (w - padL - padR), Y = (v) => h - padB - (v / my) * (h - padB - padT);
  c.strokeStyle = '#5468FF'; c.fillStyle = '#C9D2FF'; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gx = (mx / 4) * i, gy = (my / 4) * i;
    c.beginPath(); c.moveTo(X(gx), padT); c.lineTo(X(gx), h - padB); c.stroke();
    c.beginPath(); c.moveTo(padL, Y(gy)); c.lineTo(w - padR, Y(gy)); c.stroke();
    c.fillText(+gx.toPrecision(2), X(gx) - 8, h - padB + 14); c.fillText(+gy.toPrecision(2), 4, Y(gy) + 4);
  }
  c.fillStyle = '#FFF8EC'; if (labels.x) c.fillText(labels.x, w - padR - c.measureText(labels.x).width, h - 4); if (labels.y) c.fillText(labels.y, 4, 10);
  if (fit && fit.ok) {
    c.strokeStyle = '#FFD23F'; c.lineWidth = 2; c.shadowColor = '#FFD23F'; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(mx), Y(fit.m * mx)); c.stroke(); c.shadowBlur = 0;
  }
  c.fillStyle = '#FF8A3D';
  xs.forEach((x, i) => { c.beginPath(); c.arc(X(x), Y(ys[i]), 4, 0, 7); c.fill(); });
  if (!ok) { c.fillStyle = '#C9D2FF'; c.fillText('—', w / 2, h / 2); }
}
