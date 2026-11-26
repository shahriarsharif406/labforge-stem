# Devpost text (paste-ready)

**Project name:** LabForge

**Tagline:** A virtual physics lab where every student gets their own hidden numbers, and the lab report grades itself.

## Project overview (short)
Many students have no lab bench. Free simulations help, but everyone sees the same values and nothing checks the work.

LabForge gives each student a seeded personal experiment. Your name creates hidden constants (your world's gravity, a resistor value). You run a real physics simulation, record noisy measurements, pick your graph, and submit a report. The app grades it in seconds using formulas you can read, then reveals the hidden truth.

Three experiments: Pendulum, Ohm's law, Projectile.

## Project details
**The problem.** Lab access is uneven, and open simulations have no guided procedure or assessment.

**The solution.** A browser lab with three parts: a seeded instance per student, a guided data table and graph, and transparent 100-point auto-grading (accuracy 35, consistency with your own data 10, graph and R² 20, units 10, significant figures 10, method 15). Audience: students and teachers.

**Key features.**
- Personal hidden constants from a seed (name or ID plus optional class code)
- Real physics: nonlinear pendulum, noisy ohmic meter, projectile motion
- Data table, live graph, least-squares fit with R²
- Report card with score ring, rubric, hidden-truth reveal, PNG download
- Share link that contains no name or ID
- Runs fully in the browser: no backend, no paid API, no network calls at runtime; 3D hero with a 2D fallback

**Technologies.** JavaScript (ES modules), Three.js, GSAP, HTML5 canvas, localStorage, Node for tests.

**Challenges.** Making grading fair and explainable (no black-box model), keeping noise deterministic so a repeated trial reproduces, and handling messy input (units, comma decimals, degenerate data).

**Future improvements.** More experiments (optics, springs, titration-free chemistry sims), teacher dashboard with class codes, more languages, signed share links with a small server.

## Additional information
- **AI disclosure:** Built with AI assistance (Claude). The author understands and can explain the architecture and every grading formula (see `docs/DESIGN-SPEC.md`).
- **Pre-existing work:** None. LabForge was created during the hackathon period. Open-source libraries: Three.js (MIT), GSAP, Space Grotesk and JetBrains Mono fonts (OFL).
- **Limitations:** simplified physics (no drag, ideal instruments); share-link checksum is not tamper-proof.
- **Team:** Solo.

## Built with
javascript, three.js, gsap, html5-canvas, github-pages, node.js
