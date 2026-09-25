// LEGO photo-film engine for HyperFrames. A scene module calls film({...}); the engine owns rendering,
// instancing, the brick-by-brick build, minifig drop-in, the on-twos brickfilm clock, the camera path,
// the parts/connections label and the HyperFrames timeline hookup. Everything is a pure function of time.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as G from './parts.js';
import { Model, Vox, rng, LEGO } from './vox.js';
import { makeFig } from './fig.js';

export { THREE, G, Model, Vox, rng, LEGO, makeFig };
export const D2R = Math.PI / 180;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const E = {
  lin: (x) => x,
  in2: (x) => x * x, out2: (x) => 1 - (1 - x) * (1 - x), io2: (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
  out3: (x) => 1 - Math.pow(1 - x, 3), in3: (x) => x * x * x, io3: (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  back: (x) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
// keys: [[t, v, ease?], ...] — ease applies to the segment ENDING at that key; v may be a number or an array
export function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e = 'io2'] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = E[e](clamp01((t - t0) / (t1 - t0)));
      return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * u) : v0 + (v1 - v0) * u;
    }
  }
  return keys[keys.length - 1][1];
}
export function composeM(pos, euler = [0, 0, 0], scale = 1) {
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler, 'YXZ')), new THREE.Vector3(...s));
}

// cfg: see references/scene-api.md
export function film(cfg) {
  Math.random = rng(cfg.seed ?? 20260924);                     // library noise is seeded → identical frames in every worker
  const W = cfg.W ?? 1080, H = cfg.H ?? 1080, DUR = cfg.dur;
  const rootDur = parseFloat(document.querySelector('[data-composition-id]')?.dataset.duration);
  if (Math.abs(rootDur - DUR) > 1e-6) console.error(`brick-film: film dur ${DUR} ≠ index.html data-duration ${rootDur}; set both to the same value`);
  const A = cfg.alive ?? Infinity;                             // brickfilm (on twos) from here on
  const onTwos = (t) => t < A ? t : A + Math.floor((t - A) * (cfg.twosFps ?? 15) + 1e-6) / (cfg.twosFps ?? 15);

  // ── renderer ──
  const canvas = document.getElementById(cfg.canvas ?? 'stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = cfg.exposure ?? 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.bg ?? '#aecdee');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = cfg.envIntensity ?? 0.55;
  const L = cfg.light ?? {};
  const hemi = new THREE.HemisphereLight(L.sky ?? '#e4f0ff', L.ground ?? '#8d877d', L.hemi ?? 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(L.sunColor ?? '#fff3e3', L.sun ?? 2.7);
  sun.position.set(...(L.sunPos ?? [-38, 70, 52])); sun.target.position.set(...(L.sunTarget ?? [0, 0, -4])); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sb = L.shadowBox ?? 48;
  Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: L.shadowFar ?? 220 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5;
  if (cfg.floorY !== null) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.ShadowMaterial({ color: cfg.floorShadow ?? '#29425e', opacity: 0.22 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = cfg.floorY ?? -0.41; catcher.receiveShadow = true; scene.add(catcher);
  }
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.3, 900);

  // ── scene build (the scene module fills M and ctx) ──
  const M = new Model(cfg.seed ?? 7279);
  const ctx = { THREE, G, M, Vox, LEGO, rng, E, kf, clamp01, composeM, D2R, scene, camera, A, onTwos, figs: [], groups: {}, state: {} };
  cfg.build(ctx);
  const STATIC = { static: new THREE.Matrix4(), ...M.staticMats, ...ctx.groups };
  for (const [wg, s] of Object.entries(M.groupsStatic)) STATIC[wg] = (STATIC[s.parent] || new THREE.Matrix4()).clone().multiply(new THREE.Matrix4().makeTranslation(...s.pos));

  // ── instancing ──
  const plastic = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0 });
  const MATS = {
    plastic,
    chrome: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.88, envMapIntensity: 0.55 }),
    glassLt: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.5, envMapIntensity: 1.5, depthWrite: false }),
    lightW: new THREE.MeshStandardMaterial({ color: '#dfe7ef', emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.2 }),
    lightR: new THREE.MeshStandardMaterial({ color: '#7a0c07', emissive: '#ff2414', emissiveIntensity: 0.5, roughness: 0.2 }),
    ...(cfg.mats ? cfg.mats(THREE) : {}),
  };
  const parts = M.parts;
  const buckets = new Map();
  parts.forEach((p, i) => { const k = p.geo.uuid + '|' + p.mat; if (!buckets.has(k)) buckets.set(k, { geo: p.geo, mat: p.mat, list: [] }); buckets.get(k).list.push(i); });
  const meshes = [];
  for (const b of buckets.values()) {
    const im = new THREE.InstancedMesh(b.geo, MATS[b.mat], b.list.length);
    im.castShadow = b.mat !== 'glassLt'; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    b.list.forEach((pi, j) => { im.setColorAt(j, new THREE.Color(parts[pi].color)); parts[pi].im = im; parts[pi].ii = j; });
    scene.add(im); meshes.push(im);
  }
  const studList = [];
  parts.forEach((p, i) => p.studs.forEach(s => studList.push({ pi: i, m: p.local.clone().multiply(new THREE.Matrix4().makeTranslation(...s)) })));
  const studs = new THREE.InstancedMesh(G.studGeo(), plastic, Math.max(1, studList.length));
  studs.castShadow = true; studs.receiveShadow = true; studs.frustumCulled = false; studs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  studList.forEach((s, j) => studs.setColorAt(j, new THREE.Color(parts[s.pi].color)));
  scene.add(studs);

  // ── connections: stud ↔ anti-stud contacts, counted from the model ──
  {
    const top = new Set();
    const key = (g, x, y, z) => `${g}|${x.toFixed(1)}|${y.toFixed(2)}|${z.toFixed(1)}`;
    parts.forEach(p => { if (p.box) for (const s of (p.tops || p.studs)) top.add(key(p.group, p.pos.x + s[0], p.pos.y + s[1], p.pos.z + s[2])); });
    parts.forEach(p => {
      if (!p.box) return;
      let n = 0; const { x, z, w, d } = p.box, yb = p.pos.y - p.box.h / 2;
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (top.has(key(p.group, x + i + 0.5, yb, z + j + 0.5))) n++;
      p.conn = n;
    });
  }

  // ── build schedule: tier 0 (ground) cascades first, then everything bottom-up with a sweep ──
  const FALL = cfg.fall ?? 0.5;
  const SCH = { ground: [0.12, 1.1], rest: [0.95, 6.3], dropMin: 4.2, dropVar: 2.2, sweep: [0.7, -0.35], ...(cfg.schedule || {}) };
  {
    const r = rng(99);
    const G0 = cfg.groups ? cfg.groups(0, 0, ctx) : {};
    const gm = (p) => STATIC[p.group] || G0[p.group] || new THREE.Matrix4();
    const wpos = (p) => p.pos.clone().applyMatrix4(gm(p));
    const ground = parts.filter(p => p.tier === 0 && p.landFixed == null), rest = parts.filter(p => p.tier !== 0 && p.landFixed == null);
    ground.forEach(p => { const w = wpos(p); p.sortKey = (w.x * 0.8 - w.z * 0.5) + r() * 3; });
    ground.sort((a, b) => a.sortKey - b.sortKey);
    ground.forEach((p, i) => { p.land = SCH.ground[0] + (i / Math.max(1, ground.length - 1)) * (SCH.ground[1] - SCH.ground[0]); });
    rest.forEach(p => { const w = wpos(p); const yb = (SCH.worldY ? w.y - (p.box ? p.box.h / 2 : 0) : p.bottom); p.sortKey = Math.round(yb / 0.4) * 1000 + (w.x * SCH.sweep[0] + w.z * SCH.sweep[1]) + r() * 6; });
    rest.sort((a, b) => a.sortKey - b.sortKey);
    rest.forEach((p, i) => { p.land = SCH.rest[0] + Math.pow(i / Math.max(1, rest.length - 1), 0.92) * (SCH.rest[1] - SCH.rest[0]); });
    parts.forEach(p => { if (p.landFixed != null) p.land = p.landFixed; p.seed = r(); p.drop = SCH.dropMin + r() * SCH.dropVar; p.spin = (r() - 0.5) * 0.9; });
  }
  const counted = parts.filter(p => !p.noCount);                 // props that pop in later (notes, puffs) aren't 'the build'
  const landSorted = counted.map(p => p.land).sort((a, b) => a - b);
  const connByLand = counted.map(p => [p.land, p.conn]).sort((a, b) => a[0] - b[0]);
  const connCum = []; { let c = 0; for (const [, n] of connByLand) { c += n; connCum.push(c); } }

  // ── minifigs: ctx.figs = [{ F, land:[legs, torso, arms, head, hair], group?, pose?(ta,t) }] ──
  const FIG_PARTS = [3, 1, 4, 1, 1], FIG_CONN = [4, 1, 4, 1, 1];
  for (const f of ctx.figs) {
    if (f.group) { f.rig = new THREE.Group(); f.rig.matrixAutoUpdate = false; f.rig.add(f.F.root); scene.add(f.rig); }
    else scene.add(f.F.root);
  }
  const _m = new THREE.Matrix4();
  function figDrop(land, stage, t) {
    const l = land[stage], u = (t - (l - FALL)) / FALL;
    if (u < 0) return { vis: false };
    if (u >= 1) { const k = (t - l) / 0.12; return { vis: true, dy: k < 1 ? -0.03 * Math.sin(k * Math.PI) : 0, sc: 1 }; }
    return { vis: true, dy: 4.6 * (1 - u * u), sc: E.out3(clamp01(u / 0.28)) };
  }
  function poseFig(F, s) {
    if (!s) return;
    F.root.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
    F.root.rotation.set(0, s.yaw ?? 0, s.roll ?? 0, 'YXZ');
    F.legL.rotation.x = s.legL ?? 0; F.legR.rotation.x = s.legR ?? 0;
    F.torso.rotation.x = -(s.lean || 0);
    const aR = s.aR ?? [0, 0, 0], aL = s.aL ?? [0, 0, 0];
    F.armR.piv.rotation.set(aR[0], aR[1], -0.1 + aR[2]);
    F.armL.piv.rotation.set(aL[0], aL[1], 0.1 + aL[2]);
    F.head.rotation.set(s.headPitch || 0, s.hy || 0, s.hz || 0);
  }
  function dropFig(f, t) {
    const F = f.F, land = f.land;
    if (t >= land[4] + 0.2) { if (!F._built) { F._built = true; F.meshes.forEach(m => { m.mesh.visible = true; m.mesh.position.copy(m.base); m.mesh.scale.setScalar(1); }); } return; }
    F._built = false;
    (f.rig || F.root).updateMatrixWorld(true);
    for (const m of F.meshes) {
      const d = figDrop(land, Math.min(4, m.stage), t);
      m.mesh.visible = d.vis; if (!d.vis) continue;
      const up = new THREE.Vector3(0, 1, 0).transformDirection(_m.copy(m.mesh.parent.matrixWorld).invert());
      m.mesh.position.copy(m.base).addScaledVector(up, d.dy); m.mesh.scale.setScalar(d.sc);
    }
  }

  // ── camera: named states + [t0, t1, from, to, ease] moves; gaps are holds ──
  function camAt(t) {
    const C = cfg.cams, res = (c) => (typeof c === 'function' ? c(t) : c);        // a state may be a function of time (tracking shots)
    let a = res(C[cfg.moves[0][2]]), b = a, u = 0;
    for (const [t0, t1, from, to, e] of cfg.moves) if (t >= t0) { a = res(C[from]); b = res(C[to]); u = E[e](clamp01((t - t0) / (t1 - t0))); }
    const ov = window.__camOverride || cfg.devCam;
    if (ov) { a = b = ov; u = 0; }                                              // dev inspection only
    const Lr = (k) => a[k] + (b[k] - a[k]) * u;
    const tgt = a.tgt.map((v, i) => v + (b.tgt[i] - v) * u);
    const az = Lr('az') * D2R, el = Lr('el') * D2R, dist = Lr('dist');
    return { pos: [tgt[0] + Math.sin(az) * Math.cos(el) * dist, tgt[1] + Math.sin(el) * dist, tgt[2] + Math.cos(az) * Math.cos(el) * dist], tgt, fov: Lr('fov') };
  }

  // ── post ──
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, W, H);
  gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = cfg.ao ?? 0.85;
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  // ── label ──
  const elCount = document.getElementById(cfg.labelId ?? 'lab-count');
  const fmt = (n) => n.toLocaleString('en-US');
  const countLanded = (t) => { let lo = 0, hi = landSorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (landSorted[mid] <= t) lo = mid + 1; else hi = mid; } return lo; };
  function updateLabel(t) {
    if (!elCount) return;
    const n = countLanded(t);
    let fn = 0, fc = 0;
    for (const f of ctx.figs) f.land.forEach((l, i) => { if (t >= l) { fn += FIG_PARTS[i]; fc += FIG_CONN[i]; } });
    elCount.textContent = `${fmt(n + fn)} parts · ${fmt((n ? connCum[n - 1] : 0) + fc)} connections checked`;
  }

  // ── per frame ──
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function dropM(p, t) {
    const st = p.land - FALL;
    if (t < st) return null;
    if (t >= p.land + 0.12) return undefined;
    let dy = 0, sc = 1, ry = 0;
    if (t < p.land) { const u = (t - st) / FALL; dy = p.drop * (1 - u * u); sc = E.out3(clamp01(u / 0.28)); ry = p.spin * (1 - u) * (1 - u); }
    else dy = -0.035 * Math.sin(((t - p.land) / 0.12) * Math.PI);
    return composeM([p.pos.x, p.pos.y + dy, p.pos.z], [0, ry, 0], sc).multiply(new THREE.Matrix4().makeTranslation(-p.pos.x, -p.pos.y, -p.pos.z));
  }
  function render(tRaw) {
    const t = Math.max(0, Math.min(DUR, tRaw)), ta = onTwos(t);
    const c = camAt(t);
    camera.position.set(...c.pos); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(...c.tgt);
    const GM = { ...STATIC, ...(cfg.groups ? cfg.groups(ta, t, ctx) : {}) };
    for (const p of parts) {
      const D = dropM(p, t), g = GM[p.group] || STATIC.static;
      if (D === null) { p.im.setMatrixAt(p.ii, ZERO); p._w = null; continue; }
      const w = D === undefined ? g.clone() : g.clone().multiply(D);
      p._w = w; p.im.setMatrixAt(p.ii, _m.copy(w).multiply(p.local));
    }
    studList.forEach((s, j) => { const w = parts[s.pi]._w; studs.setMatrixAt(j, w ? _m.copy(w).multiply(s.m) : ZERO); });
    meshes.forEach(m => m.instanceMatrix.needsUpdate = true); studs.instanceMatrix.needsUpdate = true;
    for (const f of ctx.figs) {
      if (f.rig) { f.rig.matrix.copy(GM[f.group] || STATIC.static); f.rig.matrixWorldNeedsUpdate = true; }
      poseFig(f.F, f.pose ? f.pose(ta, t) : f.still);
      dropFig(f, t);
    }
    if (cfg.update) cfg.update(t, ta, { ...ctx, MATS, GM, camera });
    updateLabel(t);
    composer.render();
  }

  // ── HyperFrames hookup: ONE full-length driver tween renders the scene from time ──
  const tl = window.__timelines[cfg.id ?? 'main'];
  const drive = { t: 0 };
  tl.to(drive, { t: DUR, duration: DUR, ease: 'none', onUpdate: () => render(drive.t) }, 0);
  if (cfg.timeline) cfg.timeline(tl);
  window.addEventListener('hf-seek', () => render(tl.time()));
  render(0);
  window.__lego = { render, parts, camAt, scene, camera, ctx, cfg };
  return window.__lego;
}
