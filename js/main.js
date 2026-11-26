import { t } from './i18n.js';
import { createInstance } from './instance.js';
import { cyrb53 } from './rng.js';
import { grade, linearize, valueFromSlope, EXPERIMENTS } from './grading.js';
import { linfit } from './stats.js';
import { Bench } from './scene/bench2d.js';
import { drawGraph } from './ui/graph.js';
import { cardPNG } from './ui/card.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;
const EXP = ['pendulum', 'ohm', 'projectile'];
const LIN = {
  pendulum: [['T2_vs_L', 'T² vs L'], ['T_vs_sqrtL', 'T vs √L'], ['T_vs_L', 'T vs L']],
  ohm: [['V_vs_I', 'V vs I'], ['I_vs_V', 'I vs V'], ['V_vs_I2', 'V vs I²']],
  projectile: [['R_vs_sin2t', 'Range vs sin 2θ'], ['R_vs_theta', 'Range vs θ']],
};
const AX = { pendulum: { T2_vs_L: ['L (m)', 'T² (s²)'], T_vs_sqrtL: ['√L', 'T (s)'], T_vs_L: ['L (m)', 'T (s)'] }, ohm: { V_vs_I: ['I (A)', 'V (V)'], I_vs_V: ['V (V)', 'I (A)'], V_vs_I2: ['I² (A²)', 'V (V)'] }, projectile: { R_vs_sin2t: ['sin 2θ', 'range (m)'], R_vs_theta: ['θ (°)', 'range (m)'] } };

// ---------- state ----------
let who = null, inst = null, store = null, scene = null, bench = null, onResize = null;
addEventListener('resize', () => onResize && onResize());
const LASTKEY = 'labforge:v1:last';
const safe = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } } };
function identify(id, cls) {
  who = { id, cls }; inst = createInstance(id, cls);
  store = safe.get('labforge:v1:' + inst.seed) || { tables: {}, reports: {}, grades: {}, lin: {} };
  safe.set(LASTKEY, who);
  const b = $('#seedBadge'); b.hidden = false; b.textContent = `${inst.seedTag} · ${inst.planet.name}`;
  scene && scene.setHue(inst.planet.hue);
}
const save = () => inst && safe.set('labforge:v1:' + inst.seed, store);
const table = (e) => (store.tables[e] ||= { rows: [] });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));

// ---------- 3D scene ----------
async function bootScene() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('nogl')) throw new Error('forced');
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    const { initScene } = await import('./scene/hero.js');
    scene = initScene($('#bg'));
    if (inst) scene.setHue(inst.planet.hue);
    scene.setMode(location.hash.replace('#', '') in { '': 1, '/': 1 } ? 'hero' : 'dim');
  } catch (e) { document.documentElement.classList.add('no-webgl'); }
}

// ---------- router ----------
const routes = [
  [/^\/?$/, hero], [/^\/start$/, startScreen], [/^\/labs$/, labs], [/^\/lab\/(\w+)$/, benchScreen],
  [/^\/lab\/(\w+)\/report$/, reportScreen], [/^\/lab\/(\w+)\/card$/, cardScreen], [/^\/about$/, about], [/^\/verify\/(.+)$/, verify],
];
function route() {
  bench && bench.destroy(); bench = null; onResize = null;
  const path = location.hash.replace(/^#/, '') || '/';
  scene && scene.setMode(path === '/' ? 'hero' : 'dim');
  for (const [re, fn] of routes) { const m = path.match(re); if (m) { fn(...m.slice(1)); finish(); return; } }
  location.hash = '#/';
}
function finish() {
  scrollTo(0, 0); app.focus({ preventScroll: true });
  const ins = app.querySelectorAll('[data-in]');
  if (gsap && !reduce && ins.length) gsap.from(ins, { y: 24, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.06, clearProps: 'all' });
  document.title = 'LabForge — ' + (location.hash.replace('#/', '') || 'home');
}
const needId = () => { if (!inst) { location.hash = '#/start'; return true; } return false; };
const footer = () => `<footer>${t('foot')}</footer>`;

// ---------- screens ----------
function hero() {
  app.innerHTML = `<section class="hero">
    <div class="eyebrow" data-in>${t('hero.eyebrow')}</div>
    <h1 data-in>${t('hero.title1')}<br>${t('hero.title2')}<br><em>${t('hero.title3')}</em></h1>
    <p class="lead" data-in>${t('hero.lead')}</p>
    <div class="readout" data-in id="ro">g = ??.?? m/s²</div>
    <div class="row" data-in><a class="btn primary" href="#/start">${t('hero.cta')} →</a><a class="btn ghost" href="#/about">${t('hero.how')}</a></div>
    <div class="steps" data-in><span class="step"><b>1</b>${t('step.1')}</span><span class="step"><b>2</b>${t('step.2')}</span><span class="step"><b>3</b>${t('step.3')}</span></div>
  </section>`;
  scramble($('#ro'), 'g = ??.?? m/s²', false);
}
function scramble(el, finalText, settle) {
  if (reduce) { el.textContent = finalText; return; }
  let n = 0; const iv = setInterval(() => {
    n++; el.textContent = finalText.replace(/[?\d]/g, (c) => (settle && n > 14 ? c : String(Math.floor(Math.random() * 10))));
    if (n > (settle ? 16 : 10)) { clearInterval(iv); el.textContent = finalText; }
  }, 60);
}

function startScreen() {
  const last = who || safe.get(LASTKEY) || { id: '', cls: '' };
  app.innerHTML = `<section class="page grid2">
    <div><div class="eyebrow" data-in>01 / identify</div><h2 data-in>${t('start.title')}</h2><p data-in>${t('start.lead')}</p></div>
    <form class="panel" id="f" data-in>
      <label for="sid">${t('start.id')}</label><input id="sid" type="text" autocomplete="off" maxlength="40" value="${esc(last.id)}">
      <div style="height:16px"></div>
      <label for="cls">${t('start.class')}</label><input id="cls" type="text" autocomplete="off" maxlength="30" value="${esc(last.cls)}">
      <div style="height:24px"></div>
      <button class="btn primary" id="go" ${last.id.trim() ? '' : 'disabled'}>${t('start.go')} →</button>
      <div id="forged" style="margin-top:24px" aria-live="polite"></div>
    </form></section>${footer()}`;
  const sid = $('#sid'), go = $('#go');
  sid.addEventListener('input', () => { go.disabled = !sid.value.trim(); });
  $('#f').addEventListener('submit', (e) => {
    e.preventDefault(); if (!sid.value.trim()) return;
    identify(sid.value, $('#cls').value);
    go.disabled = true;
    const box = $('#forged');
    box.innerHTML = `<div class="readout" id="ro2">g = ??.?? m/s²</div><h3 style="margin-top:16px">${t('hero.forged')}</h3><div class="kv"><span>${t('start.planet')}: </span>${esc(inst.planet.name)}<br><span>${t('start.tag')}: </span>${inst.seedTag}</div>`;
    scramble($('#ro2'), 'g = ??.?? m/s²', false);
    const next = () => { location.hash = '#/labs'; };
    scene ? scene.forge(inst.planet.hue, () => setTimeout(next, 500)) : setTimeout(next, 1200);
  });
}

function labs() {
  if (needId()) return;
  const d = { pendulum: 'lab.pendulum.d', ohm: 'lab.ohm.d', projectile: 'lab.projectile.d' };
  app.innerHTML = `<section class="page"><div class="eyebrow" data-in>02 / ${esc(inst.planet.name)}</div><h2 data-in>${t('labs.title')}</h2><p data-in>${t('labs.lead')}</p>
    <div class="grid3">${EXP.map((e, i) => {
      const g = store.grades[e];
      return `<a class="panel tile" href="#/lab/${e}" data-in><span class="tag">EXP 0${i + 1}${g ? ' · ' + g.total + '/100' : ''}</span><canvas data-prev="${e}" aria-hidden="true"></canvas><h3>${t('lab.' + e)}</h3><p>${t(d[e])}</p></a>`;
    }).join('')}</div></section>${footer()}`;
  document.querySelectorAll('canvas[data-prev]').forEach(previewTile);
}
function previewTile(cv) {
  const e = cv.dataset.prev, c = cv.getContext('2d'); cv.width = 400; cv.height = 150; let t0 = 0;
  const draw = (ts) => {
    if (!cv.isConnected) return; t0 = ts / 1000; c.clearRect(0, 0, 400, 150); c.strokeStyle = '#4FF0C3'; c.fillStyle = '#4FF0C3'; c.lineWidth = 2; c.shadowColor = '#4FF0C3'; c.shadowBlur = 12;
    if (e === 'pendulum') { const th = 0.6 * Math.cos(t0 * 2.6), x = 200 + Math.sin(th) * 90, y = 14 + Math.cos(th) * 90; c.beginPath(); c.moveTo(200, 14); c.lineTo(x, y); c.stroke(); c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); }
    else if (e === 'ohm') { c.strokeRect(100, 30, 200, 90); for (let i = 0; i < 24; i++) { const d = ((i / 24) * 580 + t0 * 90) % 580; let x, y; if (d < 200) { x = 100 + d; y = 30; } else if (d < 290) { x = 300; y = 30 + d - 200; } else if (d < 490) { x = 300 - (d - 290); y = 120; } else { x = 100; y = 120 - (d - 490); } c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); } }
    else { c.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, x = 40 + u * 320, y = 130 - 100 * 4 * u * (1 - u); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); const u = (t0 * 0.5) % 1; c.beginPath(); c.arc(40 + u * 320, 130 - 400 * u * (1 - u), 9, 0, 7); c.fill(); }
    requestAnimationFrame(draw);
  };
  if (reduce) { draw(600); } else requestAnimationFrame(draw);
}

function cols(e) {
  return e === 'pendulum' ? ['L (m)', 'T (s)', 'θ₀ (°)'] : e === 'ohm' ? ['V (V)', 'I (mA)', ''] : ['θ (°)', 'range (m)', 'v₀ (m/s)'];
}
function benchScreen(e) {
  if (needId() || !EXP.includes(e)) return;
  const procs = e === 'pendulum' ? [1, 2, 3, 4].map((n) => 'pend.' + n) : e === 'ohm' ? [1, 2, 3].map((n) => 'ohm.' + n) : [1, 2, 3].map((n) => 'proj.' + n);
  const controls = e === 'pendulum'
    ? `<label for="cL">${t('pend.L')}: <b id="vL" class="mono">1.00</b></label><input id="cL" type="range" min="0.2" max="2" step="0.05" value="1">
       <label for="cT">${t('pend.th')}: <b id="vT" class="mono">10</b></label><input id="cT" type="range" min="2" max="40" step="1" value="10">`
    : e === 'ohm'
      ? `<label for="cV">${t('ohm.V')}: <b id="vV" class="mono">6.0</b></label><input id="cV" type="range" min="0" max="12" step="0.5" value="6">`
      : `<label for="cv0">${t('proj.v0')}</label><select id="cv0">${inst.projectile.v0Options.map((v) => `<option ${v === 15 ? 'selected' : ''}>${v}</option>`).join('')}</select>
         <label for="cA" style="margin-top:12px">${t('proj.th')}: <b id="vA" class="mono">45</b></label><input id="cA" type="range" min="10" max="80" step="5" value="45">`;
  const goText = t(e === 'pendulum' ? 'pend.go' : e === 'ohm' ? 'ohm.go' : 'proj.go');
  const lin = store.lin[e] || LIN[e][0][0];
  app.innerHTML = `<section class="page"><div class="eyebrow" data-in>03 / ${esc(inst.planet.name)}</div><h2 data-in style="font-size:clamp(28px,4vw,48px)">${t('lab.' + e)}</h2>
  <div class="bench">
    <div data-in><div class="view"><canvas id="bv" aria-label="${t('lab.' + e)} simulation"></canvas><div class="hud" id="hud" aria-live="polite"></div></div>
      <div class="panel" style="margin-top:16px"><ol class="proc">${procs.map((p) => `<li>${t(p)}</li>`).join('')}</ol>${controls}
      <div style="height:16px"></div><button class="btn primary" id="run">${goText}</button></div></div>
    <div data-in><div class="panel"><h3>${t('bench.table')}</h3><div class="tbl" id="tbl"></div>
      <h3 style="margin-top:20px">${t('bench.graph')}</h3><label for="lin">${t('bench.axes')}</label>
      <select id="lin">${LIN[e].map(([v, l]) => `<option value="${v}" ${v === lin ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div style="height:12px"></div><canvas class="graph" id="gr" aria-label="Graph"></canvas><div class="fitline" id="fit"></div>
      <div style="height:20px"></div><a class="btn primary" href="#/lab/${e}/report">${t('bench.report')} →</a></div></div>
  </div></section>${footer()}`;
  bench = new Bench($('#bv'), e, inst);
  bench.onhud = (s) => { const h = $('#hud'); if (h && h.textContent !== s) h.textContent = s; };
  const run = $('#run');
  const upd = () => {
    if (e === 'pendulum') { bench.set({ L: +$('#cL').value, th: +$('#cT').value }); $('#vL').textContent = (+$('#cL').value).toFixed(2); $('#vT').textContent = $('#cT').value; }
    else if (e === 'ohm') { bench.set({ V: +$('#cV').value }); $('#vV').textContent = (+$('#cV').value).toFixed(1); }
    else { bench.set({ v0: +$('#cv0').value, th: +$('#cA').value }); $('#vA').textContent = $('#cA').value; }
  };
  app.querySelectorAll('input[type=range],#cv0').forEach((el) => el.addEventListener('input', upd));
  $('#lin').addEventListener('change', (ev) => { store.lin[e] = ev.target.value; save(); refresh(); });
  run.addEventListener('click', async () => {
    const tb = table(e); if (tb.rows.length >= 20) return;
    run.disabled = true;
    const k = tb.rows.length, p = bench.p;
    const value = await bench.run(k);
    tb.rows.push(e === 'pendulum' ? { x: p.L, y: value, th: p.th } : e === 'ohm' ? { x: p.V, y: value } : { x: p.th, y: value, v0: p.v0 });
    save(); refresh(); run.disabled = false; run.focus();
  });
  const refresh = () => {
    const tb = table(e), c = cols(e);
    $('#tbl').innerHTML = tb.rows.length
      ? `<table><thead><tr><th>#</th><th>${c[0]}</th><th>${c[1]}</th><th>${c[2]}</th><th></th></tr></thead><tbody>${tb.rows.map((r, i) => `<tr><td>${i + 1}</td>
        <td><input aria-label="${c[0]} row ${i + 1}" data-i="${i}" data-f="x" type="number" step="any" value="${r.x}"></td>
        <td><input aria-label="${c[1]} row ${i + 1}" data-i="${i}" data-f="y" type="number" step="any" value="${r.y}"></td>
        <td>${e === 'pendulum' ? r.th : e === 'projectile' ? r.v0 : ''}</td><td><button class="x" data-del="${i}" aria-label="Delete row ${i + 1}">×</button></td></tr>`).join('')}</tbody></table>`
      : `<p>${t('bench.empty')}</p>`;
    $('#tbl').querySelectorAll('input').forEach((el) => el.addEventListener('change', () => { const v = parseFloat(el.value); if (Number.isFinite(v)) { tb.rows[+el.dataset.i][el.dataset.f] = v; save(); drawFit(); } }));
    $('#tbl').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { tb.rows.splice(+b.dataset.del, 1); save(); refresh(); }));
    drawFit();
  };
  const drawFit = () => {
    if (!$('#lin')) return;
    const l = $('#lin').value, rows = table(e).rows, L = linearize(e, l, rows), f = linfit(L.x, L.y, { throughOrigin: true });
    drawGraph($('#gr'), L.x, L.y, f, { x: AX[e][l][0], y: AX[e][l][1] });
    $('#fit').textContent = f.ok ? `slope = ${f.m.toPrecision(4)}   R² = ${(f.r2).toFixed(4)}` : '';
  };
  refresh(); upd();
  onResize = drawFit;
}

function reportScreen(e) {
  if (needId() || !EXP.includes(e)) return;
  const rep = store.reports[e] || { valueStr: '', uncStr: '', conclusion: '' };
  const lin = store.lin[e] || LIN[e][0][0];
  const linLabel = LIN[e].find((x) => x[0] === lin)[1];
  app.innerHTML = `<section class="page grid2"><div data-in><div class="eyebrow">04 / report</div><h2>${t('bench.report')}</h2><p>${t('lab.' + e)} · ${esc(inst.planet.name)}</p>
    <div class="kv"><span>${t('rep.lin')}: </span>${linLabel}<br><span>rows: </span>${table(e).rows.length}</div></div>
    <form class="panel" id="rf" data-in>
      <label for="rv">${t('rep.value')}</label><input id="rv" type="text" autocomplete="off" inputmode="text" value="${esc(rep.valueStr)}" placeholder="${e === 'ohm' ? '330 ohm' : '9.81 m/s^2'}">
      <div style="height:16px"></div><label for="ru">${t('rep.unc')}</label><input id="ru" type="text" value="${esc(rep.uncStr)}">
      <div style="height:16px"></div><label>${t('rep.q')}: ${t('q.' + e)}</label>
      ${['a', 'b', 'c'].map((o) => `<label style="display:flex;gap:10px;align-items:center;color:var(--chalk);margin:8px 0;min-height:44px"><input type="radio" name="q" value="${o}" ${rep.conclusion === o ? 'checked' : ''}> ${t('q.' + e + '.' + o)}</label>`).join('')}
      <div class="msg" id="msg" role="alert"></div>
      <button class="btn primary">${t('rep.go')} →</button></form></section>${footer()}`;
  $('#rf').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = $('#rv').value.trim(); if (!v) { $('#msg').textContent = t('rep.value'); return; }
    store.reports[e] = { valueStr: v, uncStr: $('#ru').value.trim(), conclusion: (document.querySelector('input[name=q]:checked') || {}).value || '', linearization: lin };
    store.grades[e] = grade(e, inst, table(e), store.reports[e]); save();
    location.hash = `#/lab/${e}/card`;
  });
}

function cardScreen(e) {
  if (needId() || !EXP.includes(e)) return;
  const g = store.grades[e]; if (!g) { location.hash = `#/lab/${e}/report`; return; }
  const C = 2 * Math.PI * 80, unit = EXPERIMENTS[e].unit;
  app.innerHTML = `<section class="page"><div class="eyebrow" data-in>05 / ${t('card.title')}</div><h2 data-in>${t('lab.' + e)} · ${esc(inst.planet.name)}</h2>
  <div class="grid2"><div class="panel" data-in>
    <div class="row"><div class="ring"><svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="80" fill="none" stroke="#26304A" stroke-width="14"/><circle id="arc" cx="95" cy="95" r="80" fill="none" stroke="#4FF0C3" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="filter:drop-shadow(0 0 8px #4FF0C3)"/></svg><div class="n"><div><span id="num">0</span><small>${g.band.toUpperCase()}</small></div></div></div>
    <div class="kv"><span>${t('card.truth')}</span><br>${g.truth} ${unit}<br><span>${t('card.err')}</span><br>${g.pctError == null ? '—' : g.pctError.toFixed(2) + ' %'}<br><span>${t('card.fit')}</span><br>${g.fitValue == null ? '—' : g.fitValue.toPrecision(4) + ' ' + unit}</div></div>
    <div style="height:20px"></div>${g.parts.map((p) => `<div class="part"><span>${p.label}</span><div class="bar"><i data-w="${(p.pts / p.max) * 100}"></i></div><span class="mono">${p.pts}/${p.max}</span><span class="f">${p.formula}</span></div>`).join('')}
  </div><div data-in><div class="panel"><h3>${g.nRows ? t('bench.graph') : t('card.noData')}</h3><canvas class="graph" id="gr2"></canvas><div style="height:16px"></div>
    ${g.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('') || '<div class="note" style="border-color:var(--phos)">Clean run.</div>'}
    <div class="row" style="margin-top:20px"><button class="btn primary" id="dl">${t('card.dl')}</button><button class="btn" id="sh">${t('card.share')}</button><a class="btn ghost" href="#/labs">${t('card.again')}</a></div><div class="msg" id="cm" style="color:var(--phos)"></div></div></div></div></section>${footer()}`;
  const l = (store.reports[e].linearization) || LIN[e][0][0], L = linearize(e, l, table(e).rows), f = linfit(L.x, L.y, { throughOrigin: true });
  drawGraph($('#gr2'), L.x, L.y, f, { x: AX[e][l][0], y: AX[e][l][1] });
  const dur = reduce ? 0 : 1.4;
  if (gsap && !reduce) {
    gsap.to('#arc', { strokeDashoffset: C * (1 - g.total / 100), duration: dur, ease: 'expo.out' });
    const o = { v: 0 }; gsap.to(o, { v: g.total, duration: dur, ease: 'expo.out', onUpdate: () => { $('#num').textContent = Math.round(o.v); } });
    requestAnimationFrame(() => app.querySelectorAll('.bar i').forEach((b) => (b.style.width = b.dataset.w + '%')));
  } else { $('#arc').setAttribute('stroke-dashoffset', C * (1 - g.total / 100)); $('#num').textContent = g.total; app.querySelectorAll('.bar i').forEach((b) => (b.style.width = b.dataset.w + '%')); }
  $('#dl').addEventListener('click', async () => {
    const blob = await cardPNG({ name: who.id, expLabel: t('lab.' + e), planet: inst.planet.name, seedTag: inst.seedTag, g });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `labforge-${e}-${inst.seedTag}.png`; a.click();
  });
  $('#sh').addEventListener('click', async () => {
    const parts = g.parts.map((p) => [p.id, p.pts]);
    const body = { v: 1, seedTag: inst.seedTag, exp: e, parts, total: g.total };
    body.chk = cyrb53(JSON.stringify(parts) + g.total + inst.seedTag + e).toString(36);
    const url = location.href.split('#')[0] + '#/verify/' + b64(body);
    try { await navigator.clipboard.writeText(url); $('#cm').textContent = 'Link copied. It carries no name or ID.'; } catch { $('#cm').textContent = url; }
  });
}

function about() {
  const rows = [['A · Accuracy', 35, 'e = 100·|x − truth| / truth. Points = 35·clamp((20 − e)/18, 0, 1). Full marks at 2% error or less, zero at 20%.'], ['B · Matches your data', 10, 'Compares your answer with the value your own table gives. A copied answer will not match your measurements.'], ['C · Graph and fit', 20, '8 points for choosing the right linearization, plus up to 12 from R² between 0.90 and 0.99.'], ['D · Units', 10, 'The unit must have the right dimension (m/s², Ω). Prefixes such as kΩ are accepted.'], ['E · Significant figures', 10, '3 or 4 figures = 10, 2 or 5 = 5, otherwise 0.'], ['F · Method', 15, 'Five checks, 3 points each: 5+ settings, 2× span, a repeated setting, an experiment rule, the conclusion question.']];
  app.innerHTML = `<section class="page"><div class="eyebrow" data-in>transparent grading</div><h2 data-in>${t('about.title')}</h2><p data-in>${t('about.lead')}</p>
  <div class="grid2" data-in>${rows.map((r) => `<div class="panel"><div class="row" style="justify-content:space-between"><h3>${r[0]}</h3><span class="badge">${r[1]} pts</span></div><p>${r[2]}</p></div>`).join('')}</div>
  <p style="margin-top:24px" data-in>${t('about.limit')}</p></section>${footer()}`;
}

function verify(payload) {
  let html;
  try {
    const b = unb64(payload), chk = cyrb53(JSON.stringify(b.parts) + b.total + b.seedTag + b.exp).toString(36);
    if (chk !== b.chk) throw new Error('bad');
    html = `<h2>${t('verify.title')}</h2><div class="panel"><div class="kv"><span>seed </span>${esc(b.seedTag)}<br><span>lab </span>${esc(b.exp)}<br><span>score </span><b style="font-size:40px;color:var(--phos)">${+b.total}/100</b></div><p style="margin-top:12px">${b.parts.map((p) => esc(p[0]) + ' ' + +p[1]).join(' · ')}</p></div>`;
  } catch { html = `<h2>${t('verify.title')}</h2><div class="note">${t('verify.bad')}</div>`; }
  app.innerHTML = `<section class="page">${html}<p style="margin-top:16px">${t('about.limit')}</p></section>`;
}

// ---------- boot ----------
const last = safe.get(LASTKEY); if (last && last.id) identify(last.id, last.cls || '');
addEventListener('hashchange', route);
$('.skip').addEventListener('click', (ev) => { ev.preventDefault(); app.focus(); });
bootScene().then(route);
