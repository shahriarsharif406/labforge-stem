# LabForge — Build Spec (v1, hackathon scope)

> A browser virtual physics lab. Each student gets a seeded, personal experiment instance, runs a real
> simulation, records data, submits a lab report, and gets an auto-graded, shareable report card.
> Static site, no backend, no paid API, GitHub Pages. Target build time: ~90 min for one engineer.

## 1. Problem and pitch (for README / Devpost)
- Many students worldwide have limited or no access to a physical lab bench.
- Free simulations exist (e.g. PhET) but are mostly open sandboxes: no guided procedure, no assessment,
  and every student sees identical values, so answers are easy to copy.
- LabForge adds three things on top of a simulation: **a seeded personal instance** (hidden constants
  differ per student), **a guided procedure with a data table**, and **transparent auto-grading** of the
  report (accuracy, fit quality, units, sig figs, method checks).
- Wording rules: never claim "first" or "unique"; never name a specific country.

## 2. Design concept
**Metaphor: "the night calibration bench"** — a dark precision bench in an observatory where each experiment
is a glowing instrument under a single spotlight, and the student's hidden constants come from a seeded
"world" (a small procedural planet). Palette: ink `#0B1020` (background), panel `#141B2E`, rule `#26304A`,
chalk text `#EEF1F7` (contrast ~16:1 on ink), muted text `#A9B3C9` (~8:1), phosphor data accent `#4FF0C3`,
signal amber `#FFB547` (warnings), ion violet `#8B7CFF` (3D highlights), error coral `#FF7A6B` (all accents
>= 4.5:1 on ink; never put text on accent fills except ink `#0B1020` on phosphor). Fonts: **Space Grotesk**
(display/UI) and **JetBrains Mono** (all numbers, tables, units), both OFL, self-hosted woff2 in `/fonts`,
fallbacks `system-ui, sans-serif` / `ui-monospace, monospace`. Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 72.
Radius 6 (instruments are machined, not bubbly); 1px hairline rules instead of card shadows; no generic
gradient cards. Motion language: "measure, then settle" — elements arrive with a short overshoot like a
needle settling (GSAP `expo.out` 600 ms, stagger 60 ms), numbers count up digit-by-digit in mono, graphs draw
their fit line left-to-right. **Signature hero moment:** a 3D pendulum swings over a slowly rotating
procedural planet; when the student types their name/ID, the planet dissolves into particles and re-forms
with a new color/terrain while a mono readout scrambles to `g = ??.?? m/s²` and the headline reads
"Your lab has been forged." No alcohol imagery, no flasks of liquid used as decoration.

**Accessibility/robustness:** `prefers-reduced-motion` → no particle morph, no camera moves, GSAP durations 0,
pendulum still runs (it is data) but hero is a static render. WebGL failure (`!renderer` or context lost) →
add `.no-webgl` to `<html>`, show a static SVG hero and 2D canvas sims (all sims are drawn with a 2D
canvas fallback renderer sharing the same physics module). Mobile: single column < 768 px, sim canvas
on top, table below, controls >= 44 px touch targets. All controls keyboard-reachable, visible focus ring
(2px phosphor), table cells are real `<input>`s with `<label>`s.

## 3. Screens (hash router, single `index.html`)
1. `#/` **Hero** — 3D signature moment, one-line pitch, "Start lab" CTA, 3-step strip (Measure → Report → Graded).
2. `#/start` **Identify** — name/ID + optional class code → computes seed; shows the seeded planet name.
3. `#/labs` **Lab select** — 3 instrument tiles (Pendulum, Ohm's Law, Projectile), each a mini 3D/2D preview.
4. `#/lab/:id` **Bench** — sim viewport + controls + procedure steps (3-4 short lines) + data table + live graph.
5. `#/lab/:id/report` **Report** — final value, unit, uncertainty, linearization choice, conclusion MCQ.
6. `#/lab/:id/card` **Report card** — score ring /100, rubric breakdown, fitted graph, PNG download, share link.
7. `#/about` **How grading works** — the formulas in section 7, in plain language (for teachers/judges).

## 4. File structure (no build step, ES modules)
```
labforge/
  index.html            # import map: three -> ./vendor/three.module.min.js
  css/styles.css        # tokens (CSS vars) from section 2
  fonts/                # SpaceGrotesk-*.woff2, JetBrainsMono-*.woff2 (+ OFL.txt)
  vendor/three.module.min.js, vendor/gsap.min.js    # vendored, pinned versions (no CDN at runtime)
  js/main.js            # router, state, screen mounting
  js/i18n.js            # export const dict = { en: {...} }; export function t(key, vars)
  js/rng.js             # hashString (cyrb53), mulberry32, gaussian (Box-Muller), streamFor(seed, tag)
  js/instance.js        # createInstance(studentId, classCode) -> section 5 object
  js/physics/pendulum.js, ohm.js, projectile.js     # PURE: no DOM, importable from Node
  js/stats.js           # linfit(x,y,{throughOrigin}), r2, sigFigs(str), mean, stdev
  js/units.js           # parseQuantity("9.8 m/s^2") -> {value, unit, dim, siValue}
  js/grading.js         # PURE: grade(expId, instance, table, report) -> {total, parts[], notes[]}
  js/scene/hero.js, js/scene/bench3d.js, js/scene/bench2d.js   # renderers; 2d = fallback
  js/ui/table.js, js/ui/graph.js (2D canvas), js/ui/card.js (PNG export via canvas.toBlob)
  tests/run.mjs         # `node tests/run.mjs` — tests physics/stats/units/grading (section 9)
  README.md, LICENSE (MIT)
```
All user-facing strings go through `t()`; no hard-coded English in JS/HTML other than the dictionary.

## 5. Data model
```js
// seed = cyrb53(normalize(studentId) + "|" + normalize(classCode || "open"))   normalize = trim+lowercase
Instance = {
  v: 1, seed: 1234567890, seedTag: "LF-7Q3K",        // seedTag = base36 of seed, first 4 chars, for display
  planet: { name: "Veyra-4", hue: 212 },              // name from syllable table via rng
  pendulum:   { g: 3.00..25.00 (2 dp), timingSigma: 0.010 s },
  ohm:        { R: 47..470 Ω (int), noisePct: 1..5 (% of I), meterRes: 0.1 mA },
  projectile: { g: 3.00..25.00 (independent draw), v0Options: [10,15,20] m/s, rangeSigma: 0.02 m }
}
Trial  = { i, x, y, raw: {...}, ts }        // x = independent var (L, V, theta), y = measured (T, I, R)
Table  = { expId, rows: Trial[], xUnit, yUnit }      // max 20 rows; rows editable, deletable
Report = { valueStr: "9.79", unitStr: "m/s^2", uncStr: "0.05", linearization: "T2_vs_L",
           conclusion: "b" }
Saved  = localStorage["labforge:v1:"+seed] = { tables, reports, grades }   // never sent anywhere
```
Noise determinism: measurement k of experiment e uses `streamFor(seed, e + ":" + k)` so re-running the same
trial index reproduces the same noise (replay-safe, testable). Ground-truth values are never rendered to
the DOM before the report card.

## 6. Physics (dt = 1/240 s fixed step, accumulator loop, max 8 substeps/frame)
**Pendulum** (nonlinear, so large amplitudes teach the small-angle limit):
- `ω += -(g/L)·sin(θ)·dt;  θ += ω·dt` (semi-implicit Euler; energy drift < 0.5% over 20 periods at dt above).
- Controls: L ∈ [0.20, 2.00] m (step 0.05), θ0 ∈ [2°, 40°]. "Measure 10 swings" runs sim; virtual photogate
  detects upward zero crossings (linear interpolation of crossing time); `T = (t10 - t0)/10 + N(0, timingSigma/√10)`.
- Analysis: plot T² vs L; slope k (through origin) → `g_meas = 4π²/k`. Also accepted: T vs √L, `g = 4π²/k²`.
**Ohm's law**:
- `I_true = V/R`; `I_meas = round_to(I_true·(1 + N(0, noisePct/100)), meterRes)`; V ∈ [0, 12] V step 0.5.
- Visual: 3D circuit, charge particles move with speed ∝ I; resistor glows ∝ I²R.
- Analysis: V vs I, slope through origin = R_meas; intercept (free fit) should be ≈ 0.
**Projectile** (drag-free, level ground, launch height 0):
- `vx = v0·cosθ; vy += -g·dt; x += vx·dt; y += vy·dt`; landing when y < 0, interpolate to y = 0.
- Measured range `Rm = x_land + N(0, rangeSigma)`, rounded to 0.01 m. Controls: v0 ∈ v0Options, θ ∈ [10°, 80°] step 5°.
- Analysis: Rm vs sin(2θ) at fixed v0, slope k → `g_meas = v0²/k`. Conclusion MCQ: max range at 45°, and
  complementary angles (e.g. 30°/60°) give equal range.

## 7. Grading (pure function, 100 pts, deterministic)
Let `truth` = hidden constant (g, R, or g), `x` = student value converted to SI via `units.js`.
Let the app's own fit on the student's table give `fitValue` and `R²`.

| Part | Pts | Formula |
|---|---|---|
| A. Accuracy | 35 | `e = 100·|x − truth|/truth`; `A = 35·clamp((20 − e)/18, 0, 1)` (full ≤ 2%, zero ≥ 20%) |
| B. Consistency with own data | 10 | `c = 100·|x − fitValue|/fitValue`; `B = 10·clamp((10 − c)/9, 0, 1)` (catches copied answers) |
| C. Linearization + fit | 20 | correct linearization chosen = 8; `R²` part `12·clamp((R² − 0.90)/0.09, 0, 1)` |
| D. Units | 10 | dimension matches (m/s², Ω) = 10; recognized but wrong dimension = 0; missing = 0. Prefixes (kΩ, cm/s²) accepted |
| E. Significant figures | 10 | `s = sigFigs(valueStr)`: s ∈ {3,4} → 10; s ∈ {2,5} → 5; else 0. Uncertainty given and same decimal place as value → shown as a note only |
| F. Method checks | 15 | 5 × 3 pts: (1) n ≥ 5 distinct x values; (2) x span: max/min ≥ 2 (Ohm: max V ≥ 6 V); (3) at least one repeated x; (4) experiment-specific: pendulum all θ0 ≤ 15°, Ohm includes V = 0 or intercept |b| < 2% of max I, projectile uses one v0 only; (5) conclusion MCQ correct |

- `R²` = coefficient of determination of the linearized least-squares fit (free intercept), `1 − SSres/SStot`;
  if SStot = 0 or n < 3 → R² part = 0 and note `"need ≥ 3 distinct points"`.
- Empty table: B = C = F(1-4) = 0, A still graded if value given; card shows "No data recorded".
- Unparseable value → A = B = E = 0 with note. Negative or zero value → A = 0.
- Rounding: each part rounded to 0.5, total to integer. Bands: ≥ 90 "Distinction", ≥ 75 "Merit",
  ≥ 50 "Pass", else "Revise". Each note is one short sentence with a fix ("Use T² on the y-axis").
- Report card shows: % error, truth (revealed only now), fit graph, every part with its formula.

**Share link:** `#/verify/<payload>` where payload = base64url JSON `{v, seedTag, exp, parts, total, chk}`,
`chk = cyrb53(JSON(parts)+seed)` in base36. **No name or ID in the URL**; name appears only on the
downloaded PNG. State honestly in About: this checksum deters casual edits, it is not tamper-proof.

## 8. Performance and offline
- No network calls at runtime (fonts/vendor local). Optional `sw.js` cache-first for all static files (nice-to-have).
- Pixel ratio capped at 2; pause render loop when tab hidden or screen not visible; target 60 fps on a
  mid laptop, ≥ 30 fps on mid phone; total transfer < 1.5 MB.

## 9. Test cases (tester must run all; `node tests/run.mjs` for 1-14, browser for 15-24)
1. Same ID + class → identical Instance; different ID → different g/R (50 random IDs → ≥ 45 distinct pendulum g values).
2. ID normalization: `"  Ana "` and `"ana"` give same seed. Empty ID → Start button disabled.
3. Pendulum: L = 1 m, g = 9.81, θ0 = 5° → simulated T within 0.3% of 2π√(L/g).
4. Pendulum θ0 = 40° → T longer than small-angle T by 2.5–3.5% (nonlinear check).
5. Ohm noise 0% → slope fit equals R exactly (±1e-9 before meter rounding).
6. Projectile θ = 45°, v0 = 20, g = 9.81 → range within 0.5% of v0²/g; 30° and 60° within 0.5% of each other.
7. Perfect report (x = truth, 3 s.f., correct unit, good data) → total ≥ 95.
8. Accuracy boundaries: e = 2% → A = 35; e = 11% → A = 17.5; e = 20% → A = 0; e = 50% → A = 0.
9. Empty table + correct value → no crash, B = C = 0, card renders "No data recorded".
10. Single row / all-same x → R² part 0, note shown, no NaN anywhere in output (assert `Number.isFinite`).
11. Wrong units: `"9.8 m/s"` → D = 0; `"9.8"` (no unit) → D = 0; `"0.33 kΩ"` for R = 330 Ω → D = 10 and A full.
12. Garbage values: `"abc"`, `""`, `"1e999"`, `"-9.8"`, `"9,8"` (comma decimal → accept as 9.8, note) → no throw.
13. Extreme noise: force noisePct = 50 → grading completes, R² low, C reduced, total still in [0,100].
14. Sig figs: "9.8"→2, "9.81"→3, "9.810"→4, "0.00981"→3, "1200"→2 (ambiguous trailing zeros treated as not significant).
15. Copy attempt: student B submits student A's value → B's % error large, B score lower.
16. Replay: delete row k and re-measure same settings at same trial index → same value (determinism).
17. `prefers-reduced-motion: reduce` (DevTools emulation) → no hero morph/camera motion; app fully usable.
18. WebGL disabled (Chrome `--disable-webgl`, or debug hash flag `#nogl`) → static hero + 2D sims work end to end.
19. Mobile 375×667: no horizontal scroll, table usable, CTA visible above fold.
20. Keyboard only: complete one full experiment and reach report card.
21. Contrast: axe/Lighthouse shows no contrast failures; Lighthouse a11y ≥ 90.
22. Offline: load once, go offline, reload → app works (if sw.js done) or at least no external requests in Network tab.
23. Share link opens `#/verify/...` and shows score; edited payload → "checksum mismatch".
24. Refresh mid-lab → table restored from localStorage.

## 10. Definition of done
- [ ] All 3 experiments: run sim → record ≥ 5 rows → submit report → graded card, on desktop and mobile.
- [ ] `node tests/run.mjs` passes 1-14; browser checks 15-24 recorded in README (pass/fail list).
- [ ] Hero signature moment works; reduced-motion and no-WebGL fallbacks verified.
- [ ] No runtime network requests; no paid API; no backend; deployed on GitHub Pages and URL works in incognito.
- [ ] All UI strings in `i18n.js`; no console errors; no NaN/undefined visible anywhere.
- [ ] Contrast ≥ 4.5:1 for all text; focus visible; touch targets ≥ 44 px.
- [ ] Ground truth hidden until report card; no name/ID in any URL.
- [ ] README: 3-sentence pitch, screenshot/GIF, how grading works (link to #/about), run/test instructions,
      tech stack, limitations (client-side checksum, simplified physics: no drag, ideal meters).
- [ ] No "first"/"unique" claims, no country names, no alcohol imagery anywhere (text, 3D, icons).

## 11. Build order (if time runs short, stop after step 4 and ship)
1. rng/instance/stats/units/grading + tests (30 min) → 2. Bench screen with 2D renderer + table + graph for
all 3 labs (30 min) → 3. Report + card + share (15 min) → 4. Deploy (5 min) → 5. Three.js hero + 3D
bench + GSAP polish (remaining time).
