// 2D canvas bench renderer (works without WebGL). Draws pendulum / circuit / projectile with glow.
import { stepPendulum, DT, simulatePeriod, measurePendulum } from '../physics/pendulum.js';
import { measureOhm, trueCurrentmA } from '../physics/ohm.js';
import { simulateFlight, measureProjectile } from '../physics/projectile.js';

const C = { phos: '#4FF0C3', amber: '#FFB547', ion: '#8B7CFF', coral: '#FF7A6B', chalk: '#EEF1F7', rule: '#26304A', muted: '#A9B3C9' };

export class Bench {
  constructor(canvas, exp, inst) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.exp = exp; this.inst = inst;
    this.p = exp === 'pendulum' ? { L: 1, th: 10 } : exp === 'ohm' ? { V: 6 } : { v0: 15, th: 45 };
    this.anim = null; this.shots = []; this.reading = null; this.hud = ''; this.last = performance.now(); this.t = 0;
    this.pend = { th: 0, w: 0 };
    this.resize(); this.reset();
    this._raf = 0; this.loop = this.loop.bind(this); this.loop();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas);
    this.onhud = null;
  }
  resize() {
    const r = this.c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.c.width = this.w * d; this.c.height = this.h * d; this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  reset() { this.pend = { th: (this.p.th * Math.PI) / 180, w: 0 }; }
  set(p) { Object.assign(this.p, p); if (!this.anim) { this.reset(); } }
  destroy() { cancelAnimationFrame(this._raf); this._ro.disconnect(); }

  // ---- runs (return Promise<measurement>) ----
  run(k) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.exp === 'pendulum') {
      const { L, th } = this.p, g = this.inst.pendulum.g;
      const T = simulatePeriod(g, L, th, 10), value = measurePendulum(this.inst, L, th, k);
      this.pend = { th: (th * Math.PI) / 180, w: 0 };
      const dur = reduce ? 0.01 : 3.2, speed = (10 * T) / dur;
      return new Promise((res) => { this.anim = { type: 'pend', left: dur, speed, g, L, done: () => { this.reading = { T: value }; res(value); } }; });
    }
    if (this.exp === 'ohm') {
      const value = measureOhm(this.inst, this.p.V, k);
      return new Promise((res) => { this.anim = { type: 'ohm', left: reduce ? 0.01 : 0.9, done: () => { this.reading = { I: value, V: this.p.V }; res(value); } }; });
    }
    const { v0, th } = this.p, g = this.inst.projectile.g;
    const fl = simulateFlight(g, v0, th, true), value = measureProjectile(this.inst, v0, th, k);
    const dur = reduce ? 0.01 : Math.min(2.6, Math.max(1.2, fl.time * 0.6));
    return new Promise((res) => { this.anim = { type: 'proj', t: 0, dur, path: fl.path, range: fl.range, done: () => { this.shots.push({ path: fl.path, range: fl.range }); if (this.shots.length > 6) this.shots.shift(); this.reading = { R: value }; res(value); } }; });
  }

  loop(now = performance.now()) {
    this._raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    const a = this.anim;
    if (a && a.type === 'pend') {
      let rem = dt * a.speed;
      while (rem > 0) { const s = Math.min(DT, rem); stepPendulum(this.pend, a.g, a.L, s); rem -= s; }
      a.left -= dt; if (a.left <= 0) { this.anim = null; this.reset(); a.done(); }
    } else if (a && a.type === 'ohm') { a.left -= dt; if (a.left <= 0) { this.anim = null; a.done(); } }
    else if (a && a.type === 'proj') { a.t += dt / a.dur; if (a.t >= 1) { this.anim = null; a.done(); } }
    this.draw();
  }

  frame() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(20,27,46,.55)'); g.addColorStop(1, 'rgba(11,16,32,.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(38,48,74,.55)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  glow(color, blur) { this.ctx.shadowColor = color; this.ctx.shadowBlur = blur; }
  noGlow() { this.ctx.shadowBlur = 0; }
  hudText(s) { if (this.onhud) this.onhud(s); }

  draw() {
    this.frame();
    if (this.exp === 'pendulum') this.drawPend();
    else if (this.exp === 'ohm') this.drawOhm();
    else this.drawProj();
  }

  drawPend() {
    const { ctx, w, h } = this, { L } = this.p;
    const px = w / 2, py = 28, scale = (h - 100) / 2.05, len = L * scale;
    // ruler
    ctx.font = '11px "JetBrains Mono",monospace'; ctx.fillStyle = C.muted; ctx.strokeStyle = C.rule;
    for (let m = 0; m <= 2; m += 0.25) { const y = py + m * scale; ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(m % 0.5 === 0 ? 44 : 34, y); ctx.stroke(); if (m % 0.5 === 0) ctx.fillText(m.toFixed(1) + ' m', 48, y + 4); }
    // pivot bar
    ctx.fillStyle = C.rule; ctx.fillRect(px - 60, py - 8, 120, 8);
    const th = this.anim ? this.pend.th : (this.p.th * Math.PI) / 180;
    const bx = px + Math.sin(th) * len, by = py + Math.cos(th) * len;
    // protractor arc
    ctx.strokeStyle = 'rgba(139,124,255,.35)'; ctx.beginPath(); ctx.arc(px, py, Math.min(70, len * 0.5), Math.PI / 2 - 0.7, Math.PI / 2 + 0.7); ctx.stroke();
    ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    this.glow(C.phos, 24); const gr = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, 16); gr.addColorStop(0, '#d8fff4'); gr.addColorStop(1, C.phos);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, 14, 0, 7); ctx.fill(); this.noGlow();
    // photogate
    ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, py + len + 26); ctx.lineTo(px, py + len + 56); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.amber; ctx.fillText('photogate', px + 8, py + len + 48);
    this.hudText(this.anim ? 'timing 10 swings…' : this.reading ? `T = ${this.reading.T.toFixed(3)} s   (L = ${L.toFixed(2)} m, θ₀ = ${this.p.th}°)` : `L = ${L.toFixed(2)} m   θ₀ = ${this.p.th}°`);
  }

  drawOhm() {
    const { ctx, w, h } = this, V = this.p.V;
    const x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.22, y1 = h * 0.78;
    const I = trueCurrentmA(this.inst, V);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // moving charges
    const speed = Math.sqrt(I) * 18 * (this.anim ? 1.4 : 1);
    const per = 2 * (x1 - x0 + y1 - y0), n = 46;
    for (let i = 0; i < n; i++) {
      let d = ((i / n) * per + this.t * speed) % per, x, y;
      const a = x1 - x0, b = y1 - y0;
      if (d < a) { x = x0 + d; y = y0; } else if (d < a + b) { x = x1; y = y0 + (d - a); } else if (d < 2 * a + b) { x = x1 - (d - a - b); y = y1; } else { x = x0; y = y1 - (d - 2 * a - b); }
      ctx.fillStyle = V === 0 ? 'rgba(169,179,201,.3)' : C.phos; ctx.globalAlpha = V === 0 ? 0.5 : 0.9;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // resistor (top)
    const glowK = Math.min(1, (I * I * this.inst.ohm.R) / 4e5 * 6);
    ctx.fillStyle = '#141B2E'; ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
    const rx = w / 2 - 70, ry = y0 - 16;
    this.glow(C.coral, 6 + 40 * glowK); ctx.fillRect(rx, ry, 140, 32); ctx.strokeRect(rx, ry, 140, 32); this.noGlow();
    ctx.fillStyle = `rgba(255,122,107,${0.12 + 0.6 * glowK})`; ctx.fillRect(rx + 2, ry + 2, 136, 28);
    ctx.fillStyle = C.chalk; ctx.font = '700 14px "JetBrains Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText('R = ?', w / 2, ry + 21);
    // battery (left)
    ctx.fillStyle = '#141B2E'; ctx.strokeStyle = C.ion; ctx.fillRect(x0 - 26, h / 2 - 34, 52, 68); ctx.strokeRect(x0 - 26, h / 2 - 34, 52, 68);
    ctx.fillStyle = C.ion; ctx.fillText(V.toFixed(1) + ' V', x0, h / 2 + 5);
    // ammeter (bottom)
    ctx.fillStyle = '#141B2E'; ctx.strokeStyle = C.phos; const mx = w / 2 - 70, my = y1 - 22;
    ctx.fillRect(mx, my, 140, 44); ctx.strokeRect(mx, my, 140, 44);
    ctx.fillStyle = C.phos; ctx.font = '700 20px "JetBrains Mono",monospace';
    ctx.fillText(this.reading && !this.anim ? this.reading.I.toFixed(1) + ' mA' : this.anim ? '···' : '— mA', w / 2, my + 29);
    ctx.textAlign = 'left';
    this.hudText(this.anim ? 'reading meter…' : this.reading ? `V = ${this.reading.V.toFixed(1)} V   I = ${this.reading.I.toFixed(1)} mA` : `V = ${V.toFixed(1)} V`);
  }

  drawProj() {
    const { ctx, w, h } = this;
    const gy = h - 44, x0 = 40;
    const all = [...this.shots.map((s) => s.range), this.anim ? this.anim.range : 0, 1].filter(Number.isFinite);
    const maxR = Math.max(...all) * 1.15;
    const maxH = Math.max(1, ...this.shots.map((s) => Math.max(...s.path.map((p) => p[1]))), this.anim ? Math.max(...this.anim.path.map((p) => p[1])) : 0);
    const sc = Math.min((w - x0 - 30) / maxR, (gy - 40) / (maxH * 1.15));
    // ground + ruler
    ctx.strokeStyle = C.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    ctx.font = '11px "JetBrains Mono",monospace'; ctx.fillStyle = C.muted;
    const step = maxR > 80 ? 20 : maxR > 30 ? 10 : 5;
    for (let m = 0; m <= maxR; m += step) { const x = x0 + m * sc; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + 8); ctx.stroke(); ctx.fillText(m + ' m', x - 10, gy + 22); }
    // previous shots
    this.shots.forEach((s, i) => { ctx.strokeStyle = `rgba(139,124,255,${0.25 + 0.5 * (i / this.shots.length)})`; ctx.lineWidth = 1.5; ctx.beginPath(); s.path.forEach((p, j) => { const x = x0 + p[0] * sc, y = gy - p[1] * sc; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); });
    // cannon
    const th = (this.p.th * Math.PI) / 180;
    ctx.save(); ctx.translate(x0, gy); ctx.rotate(-th); ctx.fillStyle = C.chalk; ctx.fillRect(0, -6, 38, 12); ctx.restore();
    ctx.fillStyle = C.rule; ctx.beginPath(); ctx.arc(x0, gy, 12, Math.PI, 0); ctx.fill();
    if (this.anim) {
      const a = this.anim, idx = Math.min(a.path.length - 1, Math.floor(a.t * (a.path.length - 1)));
      ctx.strokeStyle = C.phos; ctx.lineWidth = 2; this.glow(C.phos, 10); ctx.beginPath();
      for (let j = 0; j <= idx; j += 2) { const p = a.path[j]; const x = x0 + p[0] * sc, y = gy - p[1] * sc; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      const p = a.path[idx]; ctx.fillStyle = C.chalk; ctx.beginPath(); ctx.arc(x0 + p[0] * sc, gy - p[1] * sc, 7, 0, 7); ctx.fill(); this.noGlow();
    } else if (this.shots.length) {
      const s = this.shots[this.shots.length - 1]; const x = x0 + s.range * sc;
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(x, gy - 2); ctx.lineTo(x - 7, gy - 16); ctx.lineTo(x + 7, gy - 16); ctx.fill();
    }
    this.hudText(this.anim ? 'in flight…' : this.reading ? `range = ${this.reading.R.toFixed(2)} m   (v₀ = ${this.p.v0} m/s, θ = ${this.p.th}°)` : `v₀ = ${this.p.v0} m/s   θ = ${this.p.th}°`);
  }
}
