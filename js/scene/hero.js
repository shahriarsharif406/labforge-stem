// Full-page 3D scene: procedural planet (point cloud) + swinging pendulum + stars. Morphs on "forge".
import * as THREE from 'three';

export function initScene(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 9);

  // solid shaded planet (banded, lit, atmosphere rim) + spark shell used by the "forge" morph
  const planetMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: { uHue: { value: 212 / 360 }, uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP; uniform float uHue; uniform float uT; uniform float uA;
      vec3 hsl(float h,float s,float l){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); return l + s*(k-0.5)*(1.-abs(2.*l-1.)); }
      void main(){
        vec3 n = normalize(vN); vec3 p = normalize(vP);
        float w = sin(p.x*3.1+uT*.2)*.35 + sin(p.z*4.3-p.x*1.7)*.22;
        float band = sin((p.y + w*.18) * 11.0) * .5 + .5;
        float fine = sin((p.y + w*.08) * 34.0) * .5 + .5;
        vec3 c1 = hsl(uHue, .85, .56), c2 = hsl(uHue + .10, .9, .70), c3 = hsl(uHue - .08, .8, .40);
        vec3 col = mix(mix(c3, c1, band), c2, fine * .35);
        vec3 L = normalize(vec3(.55,.6,.75));
        float d = max(dot(n,L),0.0); float wrap = d*.8 + .2;
        col *= wrap * 1.15;
        float fr = pow(1.0 - max(dot(n, vec3(0.,0.,1.)),0.0), 2.6);
        col += vec3(1.0,.82,.3) * fr * .55 + vec3(1.0,.4,.65) * pow(fr,3.) * .4;
        float dark = smoothstep(-.2,.5,dot(n,L)); col = mix(col*.8, col, dark);
        gl_FragColor = vec4(col,uA);
      }`,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(2.1, 96, 64), planetMat);
  const group = new THREE.Group();
  group.add(planet);
  // sparks (hidden until forging)
  const N = innerWidth < 800 ? 1800 : 3600;
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), rnd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const k = i + 0.5, phi = Math.acos(1 - 2 * k / N), th = Math.PI * (1 + Math.sqrt(5)) * k;
    base.set([Math.cos(th) * Math.sin(phi) * 2.15, Math.sin(th) * Math.sin(phi) * 2.15, Math.cos(phi) * 2.15], i * 3);
    rnd[i * 3] = (Math.random() - .5) * 2; rnd[i * 3 + 1] = (Math.random() - .5) * 2; rnd[i * 3 + 2] = (Math.random() - .5) * 2;
  }
  pos.set(base);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.06, color: 0xfff3c2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(geo, mat); group.add(sparks);
  // flat banded ring
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 1 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: `varying vec2 vU; varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform float uA; void main(){ float r = length(vP.xy); float t = (r-2.7)/1.1; float a = smoothstep(0.,.08,t)*smoothstep(1.,.88,t); float b = .55 + .45*sin(t*38.); a *= (.35 + .55*b); vec3 c = mix(vec3(1.0,.82,.25), vec3(1.0,.37,.64), t); gl_FragColor = vec4(c, a*.9*uA); }`,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.8, 180, 1), ringMat);
  ring.rotation.set(-1.15, 0.0, 0.3); group.add(ring);
  scene.add(group);

  // pendulum in front of the planet
  const pend = new THREE.Group();
  const pivot = new THREE.Vector3(3.0, 2.5, 1.6);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), new THREE.MeshBasicMaterial({ color: 0xc9d2ff, transparent: true, opacity: 0.7 }));
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xb77a00, metalness: 0.7, roughness: 0.25 }));
  pend.add(rod, bob);
  pend.position.copy(pivot);
  scene.add(pend);
  const trail = []; const trailGeo = new THREE.BufferGeometry();
  const TR = 60; const tp = new Float32Array(TR * 3); for (let i = 0; i < TR; i++) { tp[i * 3] = pivot.x; tp[i * 3 + 1] = pivot.y - 3; tp[i * 3 + 2] = pivot.z; } trailGeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const trailLine = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0xffd23f, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(trailLine);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.PointLight(0xfff0c8, 60, 30); key.position.set(4, 4, 6); scene.add(key);
  const rim = new THREE.PointLight(0xffd23f, 40, 30); rim.position.set(-6, -2, 4); scene.add(rim);

  // stars
  const S = 700, sp = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) { sp[i * 3] = (Math.random() - .5) * 60; sp[i * 3 + 1] = (Math.random() - .5) * 40; sp[i * 3 + 2] = -10 - Math.random() * 30; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.05, color: 0xc9d2ff, transparent: true, opacity: 0.7 })));

  const st = { hue: 212, targetHue: 212, scatter: 0, mode: 'hero', modeT: 1, px: 0, py: 0, forging: false };
  const paint = () => { planetMat.uniforms.uHue.value = (((st.hue % 360) + 360) % 360) / 360; };
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
    planetMat.uniforms.uT.value += dt;
    if (!reduce) {
      const s2 = st.scatter;
      for (let i = 0; i < N; i++) { pos[i * 3] = base[i * 3] + rnd[i * 3] * s2 * 3.2; pos[i * 3 + 1] = base[i * 3 + 1] + rnd[i * 3 + 1] * s2 * 3.2; pos[i * 3 + 2] = base[i * 3 + 2] + rnd[i * 3 + 2] * s2 * 3.2; }
      geo.attributes.position.needsUpdate = true;
      planet.rotation.y += dt * (0.18 + s2 * 2.5); planet.scale.setScalar(1 - s2 * 0.12);
    }
    mat.opacity = Math.min(1, st.scatter * 1.6);
    // mode transform: hero = big right, dim = small corner and faded
    st.modeT += ((st.mode === 'hero' ? 1 : 0) - st.modeT) * Math.min(1, dt * 3);
    const m = st.modeT, wide = camera.aspect > 1.1;
    group.position.set(THREE.MathUtils.lerp(wide ? 5.4 : 3.5, wide ? 2.5 : 0, m), THREE.MathUtils.lerp(wide ? 1.2 : 3.4, wide ? 0 : 3.2, m), THREE.MathUtils.lerp(-4, 0, m));
    group.scale.setScalar(THREE.MathUtils.lerp(wide ? .62 : .5, wide ? .9 : .62, m));
    const A = THREE.MathUtils.lerp(0.22, wide ? 1 : 0.5, m); planetMat.uniforms.uA.value = A; ringMat.uniforms.uA.value = A;
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
