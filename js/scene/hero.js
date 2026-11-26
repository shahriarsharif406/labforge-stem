// Full-page 3D scene: procedural planet (point cloud) + swinging pendulum + stars. Morphs on "forge".
import * as THREE from 'three';

export function initScene(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 9);

  // planet point cloud (fibonacci sphere with noisy terrain)
  const N = innerWidth < 800 ? 5500 : 11000;
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = new Float32Array(N * 3);
  const noise = (x, y, z) => Math.sin(x * 3.1 + 1.3) * Math.cos(y * 2.7 - .4) * 0.5 + Math.sin(z * 4.3 + x * 1.7) * 0.3 + Math.sin((x + y + z) * 7.1) * 0.12;
  for (let i = 0; i < N; i++) {
    const k = i + 0.5, phi = Math.acos(1 - 2 * k / N), th = Math.PI * (1 + Math.sqrt(5)) * k;
    const x = Math.cos(th) * Math.sin(phi), y = Math.sin(th) * Math.sin(phi), z = Math.cos(phi);
    const h = noise(x, y, z), r = 2.15 + h * 0.16;
    base[i * 3] = x * r; base[i * 3 + 1] = y * r; base[i * 3 + 2] = z * r;
    rnd[i * 3] = (Math.random() - .5) * 2; rnd[i * 3 + 1] = (Math.random() - .5) * 2; rnd[i * 3 + 2] = (Math.random() - .5) * 2;
    pos.set([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.028, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const planet = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(planet);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.012, 8, 220), new THREE.MeshBasicMaterial({ color: 0x8b7cff, transparent: true, opacity: 0.55 }));
  ring.rotation.x = 1.25; group.add(ring);
  scene.add(group);

  // pendulum in front of the planet
  const pend = new THREE.Group();
  const pivot = new THREE.Vector3(3.0, 2.5, 1.6);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), new THREE.MeshBasicMaterial({ color: 0xa9b3c9, transparent: true, opacity: 0.7 }));
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), new THREE.MeshStandardMaterial({ color: 0x4ff0c3, emissive: 0x1f9e80, metalness: 0.7, roughness: 0.25 }));
  pend.add(rod, bob);
  pend.position.copy(pivot);
  scene.add(pend);
  const trail = []; const trailGeo = new THREE.BufferGeometry();
  const TR = 60; const tp = new Float32Array(TR * 3); for (let i = 0; i < TR; i++) { tp[i * 3] = pivot.x; tp[i * 3 + 1] = pivot.y - 3; tp[i * 3 + 2] = pivot.z; } trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const trailLine = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x4ff0c3, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(trailLine);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.PointLight(0x8b7cff, 60, 30); key.position.set(4, 4, 6); scene.add(key);
  const rim = new THREE.PointLight(0x4ff0c3, 40, 30); rim.position.set(-6, -2, 4); scene.add(rim);

  // stars
  const S = 700, sp = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) { sp[i * 3] = (Math.random() - .5) * 60; sp[i * 3 + 1] = (Math.random() - .5) * 40; sp[i * 3 + 2] = -10 - Math.random() * 30; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.05, color: 0xa9b3c9, transparent: true, opacity: 0.7 })));

  const st = { hue: 212, targetHue: 212, scatter: 0, mode: 'hero', modeT: 1, px: 0, py: 0, forging: false };
  const color = new THREE.Color();
  function paint() {
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      const h = (r - 2.15) / 0.16; // -1..1ish
      color.setHSL(((st.hue + h * 28) % 360) / 360, 0.75, 0.52 + h * 0.18);
      col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
    }
    geo.attributes.color.needsUpdate = true;
  }
  paint();

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', (e) => { st.px = (e.clientX / innerWidth - .5); st.py = (e.clientY / innerHeight - .5); });

  let visible = true; document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) loop(); });
  let lost = false; canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; document.documentElement.classList.add('no-webgl'); });

  let t0 = performance.now(), rafId = 0, theta = 0.7, omega = 0;
  function loop(now = performance.now()) {
    if (!visible || lost) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.033, (now - t0) / 1000); t0 = now;
    // pendulum physics (g=9.8, L=3.3) — the hero is itself a tiny simulation
    const L = 3.0; omega += -(9.8 / L) * Math.sin(theta) * dt; theta += omega * dt;
    pend.rotation.z = theta; rod.scale.y = L; rod.position.y = -L / 2; bob.position.y = -L;
    const bw = bob.getWorldPosition(new THREE.Vector3());
    for (let i = TR - 1; i > 0; i--) { tp[i * 3] = tp[(i - 1) * 3]; tp[i * 3 + 1] = tp[(i - 1) * 3 + 1]; tp[i * 3 + 2] = tp[(i - 1) * 3 + 2]; }
    tp[0] = bw.x; tp[1] = bw.y; tp[2] = bw.z; trailGeo.attributes.position.needsUpdate = true;
    // morph
    if (!reduce) {
      for (let i = 0; i < N; i++) {
        const s = st.scatter;
        pos[i * 3] = base[i * 3] + rnd[i * 3] * s * 3.2; pos[i * 3 + 1] = base[i * 3 + 1] + rnd[i * 3 + 1] * s * 3.2; pos[i * 3 + 2] = base[i * 3 + 2] + rnd[i * 3 + 2] * s * 3.2;
      }
      geo.attributes.position.needsUpdate = true;
      group.rotation.y += dt * 0.12;
    }
    // mode transform: hero = big right, dim = small corner and faded
    st.modeT += ((st.mode === 'hero' ? 1 : 0) - st.modeT) * Math.min(1, dt * 3);
    const m = st.modeT, wide = camera.aspect > 1.1;
    group.position.set(THREE.MathUtils.lerp(wide ? 5.4 : 3.5, wide ? 3.2 : 0, m), THREE.MathUtils.lerp(wide ? 1.2 : 3.4, wide ? 0 : 3.2, m), THREE.MathUtils.lerp(-4, 0, m));
    group.scale.setScalar(THREE.MathUtils.lerp(wide ? .62 : .5, wide ? 1 : .62, m));
    mat.opacity = THREE.MathUtils.lerp(0.3, wide ? 0.95 : 0.5, m);
    pend.visible = trailLine.visible = m > 0.5 && wide; pend.position.x = pivot.x + (wide ? 0 : -2.6);
    camera.position.x += ((reduce ? 0 : st.px * 1.2) - camera.position.x) * 0.04;
    camera.position.y += ((reduce ? 0.2 : 0.2 - st.py * 0.8) - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  loop();

  return {
    setMode(m) { st.mode = m; },
    setHue(h) { st.hue = h; paint(); },
    // dissolve into particles, re-form with a new world colour
    forge(h, done) {
      if (reduce || !window.gsap) { st.hue = h; paint(); done && done(); return; }
      gsap.to(st, { scatter: 1, duration: 0.7, ease: 'power3.in', onComplete: () => { st.hue = h; paint(); gsap.to(st, { scatter: 0, duration: 1.4, ease: 'expo.out', onComplete: done }); } });
    },
    dispose() { cancelAnimationFrame(rafId); renderer.dispose(); },
  };
}
