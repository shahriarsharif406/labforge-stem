# LabForge — QA Test Report

Date: 2026-11-26. Build tested: local folder served at http://127.0.0.1:8123/.
Tools: `node tests/run.mjs`; Python Playwright driving headless Google Chrome (SwiftShader WebGL).
Scripts: `/home/claude/qa/qa.py`, `/home/claude/qa/qa2.py` (contrast: `contrast.js`, touch targets: `touch.js`). Screenshots: `/home/claude/shots/qa-*.png`.

## Summary
- Unit tests 1-14 (plus 15/16 logic): **31/31 pass**.
- Browser cases 15-24: 7 pass, 2 partial, 1 fail (case 18: the no-WebGL hero has no static SVG and the `#nogl` hash flag does nothing).
- Extra checks: the ground truth never appears in the DOM before the card, the share URL has no name or ID, no external requests, no NaN/undefined/null on any screen. Text contrast passes on solid backgrounds. Some touch targets on mobile are below 44 px.

## Results

| # | Case | Result | Evidence |
|---|---|---|---|
| 1-14 | `node tests/run.mjs` | PASS | 31 passed, 0 failed |
| 15 | Copy attempt | PASS | A ("Student A Test") got 95/100 with g = 18. B ("Student B Test", true g 13.44) submitted A's "18 m/s^2" and got 50/100, 33.93 % error, B (consistency) = 0 |
| 16 | Replay determinism | PASS (with note) | Deleting the **last** row and measuring again with the same settings gives the same T (1.051 = 1.051). Deleting a **middle** row gives a new value, because the trial index is `rows.length` (see defect 7) |
| 17 | Reduced motion (`reduced_motion='reduce'`) | PASS | No forge morph; camera and planet rotation are fixed (hero.js L93-109); the forge goes straight to #/labs; a measurement takes 0.69 s instead of 3.2 s; the score ring is set at once. The 3D hero pendulum keeps swinging, which the spec allows ("pendulum still runs") |
| 18 | No WebGL (`?nogl`) end to end | **FAIL (partial)** | `html.no-webgl` is set and `#bg` is hidden. All 3 labs complete run → report → card with the 2D canvas (scores 76/45/55). But **no static SVG hero** is shown (0 `<svg>` elements, plain text only; see `qa-nogl-hero.png`). The spec's hash flag `#nogl` does nothing: it is routed to `#/`, with no `no-webgl` class |
| 19 | Mobile 375×667 | PASS | scrollWidth = 375 on hero, start, labs, all 3 benches, report, about and card. The CTA is at 507-555 px, above the 667 px fold. Table inputs are 48 px tall. The sim view is on top and the table below |
| 20 | Keyboard only | PASS (with note) | Ohm lab done with Tab/Enter/Arrow/Space only: CTA → ID → labs → tile → slider → 7 readings → report → radio → submit → card (77/100) → share button. The focus ring (2px solid) is visible. Note: focus drops to `<body>` after each "Read meter" (defect 4), and the skip link is broken (defect 3) |
| 21 | Contrast (computed-style script, WCAG AA) | PASS (solid backgrounds) | 0 failures on #/, #/start, #/labs, bench, report, card and about. Not covered: text drawn over the 3D canvas. On mobile the hero eyebrow sits on top of the planet's dots (`qa-m-hero.png`). Lighthouse was not run |
| 22 | Offline / no external requests | PASS (no sw.js) | No requests to non-local hosts across every flow (desktop, mobile, nogl, reduced, keyboard). No service worker, so the offline reload was not tested |
| 23 | Verify link | PASS (with note) | Valid link shows "Verified report … 100/100". Editing total, a part score or the seedTag, a corrupted character, or garbage → "Checksum mismatch: this link was edited." But editing `exp` is **accepted** (defect 2), and a forger can recompute `chk` from public fields (defect 6) |
| 24 | Refresh mid-lab | PASS | Ohm table with 16 rows plus a hand-edited cell: same after reload (`equal: true`, still on #/lab/ohm) |
| X1 | Ground truth hidden before card | PASS | Truth strings (e.g. 18.06 / 318 / 19.13) were searched for in innerText, every attribute and every input value on labs, bench (before and after runs) and report for all 3 labs and 3 users: 0 hits. Shown only on the card |
| X2 | No name/ID in share URL | PASS | Payload = `{v, seedTag, exp, parts, total, chk}`. Contains no ID, class code or numeric seed |
| X3 | NaN/undefined/null visible | PASS | None found on any screen (desktop, mobile, nogl, cards) |
| X4 | Console errors | PASS (warnings only) | 0 errors and 0 page errors. Warnings: GSAP "target not found" ×2 on every verify page (defect 8), a font preload not used in time, and SwiftShader GPU stall messages (environment only) |
| X5 | Touch targets ≥ 44 px (mobile) | **FAIL** | Nav links "Labs" 30×20 and "How grading works" 119×20, brand 127×31, skip link 41 h, range sliders 32 h, row delete "×" 44×36. Radio buttons are 13×13, but their wrapping label is 44 px, so that one is acceptable |
| X6 | Start disabled with empty ID | PASS | `#go.disabled === true` |

## Defects (ordered by severity)

1. **Medium — The no-WebGL fallback has no static SVG hero; the `#nogl` flag does not work.** The spec (§2, case 18) asks for a static SVG hero and a hash flag `#nogl`. The code only reads the query param `?nogl` (`js/main.js` L44), and `#nogl` is treated as an unknown route that redirects to `#/`. When `.no-webgl` is set, nothing replaces the hero (`css/styles.css` L99 only hides `#bg`). Fix: add an inline SVG hero shown under `.no-webgl`, and also accept `location.hash === '#nogl'` (or `#/?nogl`).
2. **Medium — The verify checksum does not cover `exp`.** `js/main.js` L258 and L274 hash only `parts + total + seedTag`. Changing `"exp":"pendulum"` to `"ohm"` still shows "Verified report" for a lab the student did not do. Fix: include `exp` (and `v`) in the hashed string.
3. **Medium (a11y) — The skip link sends the user to the home page.** `index.html` L15 has `href="#app"`, and the hash router (`route()`, main.js ~L60) treats `#app` as an unknown route and redirects to `#/`. Tested: from #/about, the skip link lands on `#/`. Fix: handle the click in JS (`app.focus()`, preventDefault), or make the router ignore `#app`.
4. **Medium (keyboard) — Focus is lost after every measurement.** `js/main.js` L180 sets `run.disabled = true`, which drops focus to `<body>` (tested: `BODY` is active after Enter). Keyboard and screen-reader users lose their place on each of the 5+ readings. Fix: use `aria-disabled` plus a guard flag instead of `disabled`, or call `run.focus()` after re-enabling.
5. **Medium — Touch targets under 44 px on mobile.** Nav links are 20 px tall (`css/styles.css` L23/L96), the brand is 31 px (L18), range inputs are 32 px (L54), the delete "×" is 36 px (L75) and the skip link is 41 px. Fix: give them `min-height:44px` with `display:inline-flex; align-items:center` (nav/brand), and raise the range min-height and `td .x` min-height to 44.
6. **Low — The verify checksum can be forged with public data.** `chk = cyrb53(parts + total + seedTag)` uses only fields in the URL, so anyone can recompute it. Tested: a forged 100/100 is accepted. The spec formula uses the secret `seed`, but a verifier cannot know it. The About text already says the link is "not tamper-proof"; just keep the README wording honest about this.
7. **Low — Replay and trial-index collisions.** The trial index is `k = tb.rows.length` (`js/main.js` L181). After deleting a middle row, the next reading reuses the noise stream of the current last index, so two rows share the same noise draw. Case 16 holds only for deleting the last row. Fix: store `k` per row and use `max(k)+1`, or keep a running counter in `store`.
8. **Low — GSAP console warnings on the verify screen.** `finish()` (`js/main.js` L68) calls `gsap.from` on an empty `[data-in]` NodeList, because `verify()` (L271-279) renders no `data-in` elements. Fix: guard on `length`, or add `data-in` to the verify markup.
9. **Low — Text on the mobile hero overlaps the 3D planet.** At 375 px the eyebrow "VIRTUAL PHYSICS LAB · AUTO-GRADED" is drawn over the planet's dotted rim and the orbit line (`qa-m-hero.png`), which lowers its contrast. Fix: on narrow screens move the planet lower or further back (hero.js mode transform L104-107), or give the hero copy a backing scrim.
10. **Low — Hard-coded English strings outside `i18n.js`** (spec §4): "Clean run." (main.js L241), "Link copied. It carries no name or ID." (L260), the whole About rubric table (L265), the HUD strings in `bench2d.js`, and the "slope = … R² = …" label.
11. **Info — The projectile 2D view draws the noise-free trajectory and landing marker** (`bench2d.js` L45 uses `fl.range`, not the measured value). It is not in the DOM, so X1 still passes. But the ruler shows the exact true range, which differs from the noisy measured value shown in the HUD, and that may confuse students.
12. **Info — Font preload warning:** `space-grotesk-700` is preloaded (`index.html` L10) but not used within a few seconds on some routes. Harmless.
