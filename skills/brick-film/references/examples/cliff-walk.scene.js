// REFERENCE EXCERPT (a real test build; the photo it matched is not shipped). Person-in-landscape path:
// hero minifig on a cliff walkway, raised walkway with a crowd, hillside + mountain-ridge chunks floating in the void.
// Beat: wave → climb the rail → a paraglider snaps together brick by brick → jump → glide off toward the peaks.
// Read for API usage and technique (rotated deck group, tracking camera, prop that builds mid-action); invent your own beat.
import { film, THREE, G, makeFig, E, kf, clamp01, composeM, D2R, rng } from './kit/engine.js';
import { DEV_CAM } from './dev.js';

const C = {
  rock: '#5f646b', rock2: '#6f747b', rockDk: '#4a4e55', snow: '#f3f4f2', grass: '#6b8f4a', grass2: '#5a7d3f', grassDk: '#4a6b36',
  steel: '#b9bec4', steelDk: '#8e949b', deck: '#3b3e44', tee: '#4a4b50', khaki: '#c8c7b3', orange: '#fe8a18', blue: '#1e5aa8',
};
const A = 8.2, T = (x) => A + x;

// Layout from the photo through its camera (project.py): the rail runs from far-left to beside the hero at 52°, the raised
// walkway sits 15–30 studs back rising to camera-right, the mountains are 100 studs out and top out near eye level.
const P0 = [0, 0, -0.87];                       // rail point directly behind the hero
const BETA = -51.7 * D2R;                       // rail direction (deck-local +x); deck-local +z = the walkway side
const RAIL_H = 2.2;                             // handrail at minifig elbow height
const deckM = composeM(P0, [0, BETA, 0]);
const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(deckM);
const UP = { x: 2.8, y: 5.6, z: -22.8, yaw: -65.4 * D2R, pitch: 3 * D2R, len: 26, w: 5 };

function build(ctx) {
  const { M, Vox } = ctx;
  const r = rng(658);
  ctx.groups.deck = deckM;
  const inv = deckM.clone().invert();
  const localZ = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(inv).z;

  // ── hillside chunk: grass just below the deck beyond the rail, falling away toward the valley ──
  const hill = new Vox({ lp: 3, origin: [0, -24, 0], k: 2, exposedStudsOnly: true });
  for (let ix = -16; ix < 16; ix++) for (let iz = -22; iz < 4; iz++) {
    const x = ix * 2 + 1, z = iz * 2 + 1;
    const beyond = -localZ(x, z);                                              // studs past the rail line
    if (beyond < -1) continue;                                                // the deck side is open air under the grating
    let h = -1.4 - Math.max(0, beyond) * 0.55 - Math.max(0, beyond - 18) * 0.4;
    if (x < -14) h += 2 + Math.sin(z * 0.3) * 1.5;
    const n = Math.max(1, Math.round((h + 24) / 1.2));
    for (let iy = 0; iy < n; iy++) {
      const top = iy === n - 1, y = -24 + (iy + 1) * 1.2;
      const c = top ? (x < -14 ? (r() < 0.5 ? C.rock : C.rockDk) : r() < 0.5 ? C.grass : C.grass2) : (y > -8 ? C.rock2 : C.rockDk);
      hill.set(ix, iy, iz, { c, top: 'stud' });
    }
  }
  hill.emit(M);

  // ── mountain ridge chunk 100 studs out: a snowy massif on the left, lower ridges right, base in the valley ──
  const peaks = [[-44, -100, 15, 30], [-24, -108, 11, 24], [-4, -96, 2, 20], [18, -104, 5, 26], [40, -98, 4, 24], [62, -104, 7, 22], [-66, -96, 8, 22]];
  const ridge = new Vox({ lp: 3, origin: [0, -30, 0], k: 2, exposedStudsOnly: true });
  for (let ix = -44; ix < 40; ix++) for (let iz = -60; iz < -42; iz++) {
    const x = ix * 2 + 1, z = iz * 2 + 1;
    let h = -24 + Math.sin(x * 0.07) * 2;
    for (const [px, pz, ph, pr] of peaks) {
      const d = Math.hypot((x - px) / pr, (z - pz) / (pr * 0.6));
      h = Math.max(h, -24 + (ph + 24) * Math.max(0, 1 - d) ** 0.9 + Math.sin(x * 0.6 + z) * 0.9 * Math.max(0, 1 - d));
    }
    const n = Math.max(1, Math.round((h + 30) / 1.2));
    for (let iy = 0; iy < n; iy++) {
      const y = -30 + (iy + 1) * 1.2, top = iy === n - 1;
      const snowLine = 3 + Math.sin(x * 0.4) * 2;
      const c = y > snowLine ? C.snow : (top && y > snowLine - 4 && r() < 0.55) ? C.snow : y < -20 ? C.grassDk : r() < 0.5 ? C.rock : C.rock2;
      ridge.set(ix, iy, iz, { c, top: 'stud' });
    }
  }
  ridge.emit(M);

  // ── deck (steel grating), beams, railing — deck-local: rail on z = 0, walkway on +z ──
  for (let x = -18; x < 10; x += 4) for (let z = 0; z < 10; z += 2) M.brick(x, -0.4, z, 4, 2, 1, (x + z) % 8 === 0 ? '#34373c' : C.deck, { top: 'tile', tier: 0, group: 'deck' });
  for (const z of [0.5, 5, 9.5]) M.brick(-18, -1.6, z - 0.5, 28, 1, 3, C.steelDk, { top: 'tile', tier: 0, group: 'deck' });
  const rail = (x0, x1, z, y0, grp, H = RAIL_H) => {
    for (let x = x0; x <= x1; x += 4) M.add({ geo: G.cylGeo(0.14, H, 12), color: C.steel, pos: [x, y0 + H / 2, z], group: grp, conn: 1 });
    const len = x1 - x0;
    M.add({ geo: G.cylGeo(0.13, len, 16).clone().rotateZ(Math.PI / 2), color: C.steel, pos: [(x0 + x1) / 2, y0 + H, z], group: grp, conn: 2 });
    M.add({ geo: G.cylGeo(0.1, len, 10).clone().rotateZ(Math.PI / 2), color: C.steelDk, pos: [(x0 + x1) / 2, y0 + 0.4, z], group: grp, conn: 1 });
    for (let x = x0; x < x1; x += 4) M.add({ geo: G.boxGeo(3.8, H - 0.6, 0.06), mat: 'lattice', color: '#9ea4aa', pos: [x + 2, y0 + 0.4 + (H - 0.6) / 2, z], group: grp, conn: 2 });
  };
  rail(-18, 10, 0, 0, 'deck');

  // ── raised walkway: thin deck on steel side beams, rails both sides, a column + raking strut into the slope ──
  ctx.groups.upper = composeM([UP.x, UP.y, UP.z], [0, UP.yaw, UP.pitch]);
  for (let x = 0; x < UP.len; x += 4) M.brick(x, -0.4, -UP.w / 2, 4, UP.w, 1, C.deck, { top: 'tile', group: 'upper' });
  for (const zz of [-UP.w / 2 + 0.2, UP.w / 2 - 0.2]) M.add({ geo: G.boxGeo(UP.len, 0.4, 0.3), color: C.steelDk, pos: [UP.len / 2, -0.6, zz], group: 'upper', conn: 4 });
  rail(0, UP.len, -UP.w / 2 + 0.2, 0, 'upper', 2.4);
  rail(0, UP.len, UP.w / 2 - 0.2, 0, 'upper', 2.4);
  M.add({ geo: G.cylGeo(0.42, 13, 16), color: C.steelDk, pos: [5.5, -7.1, 0], group: 'upper', conn: 2 });
  M.add({ geo: G.cylGeo(0.3, 14, 12), color: C.steelDk, pos: [2.0, -6.8, 0], rot: [0, 0, -0.45], group: 'upper', conn: 2 });
  M.add({ geo: G.cylGeo(0.42, 13, 16), color: C.steelDk, pos: [17, -7.1, 0], group: 'upper', conn: 2 });

  // ── minifigs ──
  const hero = makeFig({ skin: '#f0c9a8', shirt: C.tee, legs: C.khaki, shorts: true, shoes: '#2b2c30', hair: '#5a3a24', brow: '#33200f', neck: true,
    straps: '#1f2024', tube: '#2f7fd6', clip: '#15161a', backpack: '#1f2024', bracelet: true, hairStyle: 'wavy', mouth: 'grin' });
  ctx.figs.push({ F: hero, land: [6.55, 6.8, 7.0, 7.2, 7.45], pose: heroPose });
  ctx.state.hero = hero;

  const man = makeFig({ skin: '#e2b48f', shirt: '#eeeeea', legs: '#4e5157', shorts: true, shoes: '#2b2c30', hair: '#9a9ca0', brow: '#6d6f73', neck: false,
    backpack: '#1f2024', straps: '#1f2024', hairStyle: 'short', shades: true, mouth: 'smile', seed: 2 });
  ctx.figs.push({ F: man, land: [5.9, 6.05, 6.15, 6.3, 6.4], pose: manPose });

  const tour = [
    ['#f1c6c6', '#c9b89a', 'short'], ['#f1f1ec', '#23252b', 'crop'], ['#2b2c30', '#23252b', 'short'], ['#e9e4d8', '#6b6f78', 'long'],
    ['#dcdad2', '#3b4150', 'crop'], ['#9fb6c9', '#e9e4d8', 'short'], ['#e6e1d4', '#23252b', 'long'], ['#c9d1c1', '#5a5d64', 'short'], ['#f4f4f0', '#2d3a55', 'crop'],
  ];
  ctx.state.crowd = [];
  tour.forEach(([shirt, legs, hs], i) => {
    const f = makeFig({ skin: i % 3 ? '#e9bf9b' : '#c99b76', shirt, legs, hair: ['#2b211b', '#6a4a33', '#1e1a17', '#b08a5a'][i % 4], brow: '#2a1d16', neck: false,
      hairStyle: hs, mouth: 'smile', seed: 10 + i });
    const s = { x: 2 + i * 3.1 + (r() - 0.5), y: 0, z: (i % 2 ? -1 : 1.1), yaw: (i % 3 === 0 ? 0.3 : -Math.PI / 2 + (r() - 0.5) * 0.6), aR: [0.1, 0, 0], aL: [-0.15, 0, 0] };
    const f0 = { F: f, group: 'upper', land: [5.5, 5.6, 5.7, 5.8, 5.9].map(v => v + i * 0.06), still: s, base: s };
    f0.pose = (ta) => crowdPose(f0, i, ta);
    ctx.figs.push(f0); ctx.state.crowd.push(f0);
  });

  // ── paraglider: canopy of curved cells + lines, its own group; bricks land late (T 1.9 → 2.7) ──
  const cells = 15, RC = 7.2, span = 124 * D2R, arc = RC * span / cells;
  for (let i = 0; i < cells; i++) {
    const th = -span / 2 + (i + 0.5) * (span / cells);
    const col = i === 7 ? '#f2f2ee' : i % 2 ? C.orange : C.blue;
    M.add({ geo: G.curveGeo(3.6, 0.6, arc + 0.06, 0.9, 0.12, 'ell'), color: col, pos: [Math.sin(th) * RC, Math.cos(th) * RC, 0], rot: [th, Math.PI / 2, 0], group: 'glider', conn: 2, land: T(1.95) + Math.abs(i - 7) * 0.05, tier: 2 });
  }
  for (const th of [-0.9, -0.45, 0.45, 0.9]) {
    const ex = Math.sin(th) * (RC - 0.3), ey = Math.cos(th) * (RC - 0.3);
    const dx = ex - Math.sign(th) * 0.6, dy = ey - 2.9, len = Math.hypot(dx, dy);
    M.add({ geo: G.cylGeo(0.035, len, 6), color: '#e8e8e4', pos: [Math.sign(th) * 0.6 + dx / 2, 2.9 + dy / 2, 0], rot: [0, 0, -Math.atan2(dx, dy)], group: 'glider', conn: 0, land: T(2.7), tier: 2 });
  }

}

// ── choreography (ta = on-twos time after A) ──
const STAND = { x: 0, z: 0 };
const XJ = 0.68;                                     // rail-local x of the point behind the hero
const RW = toWorld(XJ, 0, 0.8), RT = toWorld(XJ, 0, 0);
const RAIL = { x: RW.x, z: RW.z };
const FACE_RAIL = Math.PI + BETA;                    // facing deck-local −z (over the drop)
const JUMP = A + 3.2;
function flight(ta) {                               // pilot hips, world — out over the drop, curving left toward the snowy massif
  const u = Math.max(0, ta - JUMP);
  const d = 5.5 * u + 2.6 * u * u;
  const turn = Math.min(1, u / 3.5);
  const hx = -0.12 - 0.36 * turn * turn, hz = -Math.sqrt(1 - hx * hx);
  const x = RT.x + (-0.12 * d - 0.36 * d * turn * turn / 3), z = RT.z + hz * d;
  const drop = -1.8 * Math.sin(Math.min(1, u / 0.55) * Math.PI / 2) + Math.max(0, u - 0.55) * 0.7;
  return { x, y: RAIL_H + 0.2 + G.FIG.legH + drop, z, bank: Math.min(0.3, u * 0.22) * -1, yaw: Math.atan2(hx, hz) };
}
function heroPose(ta) {
  const s = { x: STAND.x, y: 0, z: STAND.z, yaw: 0.12, aR: [0.05, 0, -0.05], aL: [0.05, 0, 0.05] };
  if (ta < A) return s;
  // wave
  s.hz = kf([[T(0), 0], [T(0.13), 0.14, 'out2'], [T(0.27), 0]], ta);
  if (ta >= T(0.35) && ta < T(1.3)) {
    const raise = kf([[T(0.35), 0], [T(0.5), 1, 'out3'], [T(1.1), 1], [T(1.25), 0]], ta);
    const wv = ta < T(0.5) || ta > T(1.1) ? 0 : Math.sin((ta - T(0.5)) / 0.133 * Math.PI) * 0.35;
    s.aR = [-2.9 * raise, 0, 0.45 * raise + wv];
  }
  // turn to the rail, two hops up onto it
  const turn = kf([[T(1.35), 0], [T(1.5), 1, 'out2']], ta);
  s.yaw = 0.12 + (FACE_RAIL - 0.12 - Math.PI * 2 * (FACE_RAIL - 0.12 > Math.PI)) * turn;
  if (ta >= T(1.55)) {
    const u = clamp01((ta - T(1.55)) / 0.55);
    s.x = STAND.x + (RAIL.x - STAND.x) * u; s.z = STAND.z + (RAIL.z - STAND.z) * u;
    const ph = u * 3 * Math.PI, sw = u < 1 ? Math.sin(ph) : 0;
    s.legL = 0.5 * sw; s.legR = -0.5 * sw; s.aR = [-0.4 * sw, 0, 0]; s.aL = [0.4 * sw, 0, 0]; s.y = Math.abs(Math.sin(ph)) * 0.16;
  }
  if (ta >= T(2.15)) {                       // hop onto the handrail
    const u = clamp01((ta - T(2.15)) / 0.4);
    s.x = kf([[T(2.15), RAIL.x], [T(2.55), RT.x, 'io2']], ta); s.z = kf([[T(2.15), RAIL.z], [T(2.55), RT.z, 'io2']], ta);
    s.y = (RAIL_H + 0.2) * E.out2(u) + Math.sin(u * Math.PI) * 1.0;
    s.aR = [-2.6 * Math.sin(u * Math.PI), 0, 0.3]; s.aL = [-2.6 * Math.sin(u * Math.PI), 0, -0.3];
    s.legL = s.legR = -0.3 * Math.sin(u * Math.PI);
  }
  if (ta >= T(2.55) && ta < JUMP) {         // balance on the rail as the canopy clicks together behind him; looks back at camera
    s.y = RAIL_H + 0.2; s.x = RT.x; s.z = RT.z; s.yaw = FACE_RAIL;
    s.aR = [0, 0, 0.9]; s.aL = [0, 0, -0.9];
    s.hy = kf([[T(2.6), 0], [T(2.75), -2.6, 'out2'], [T(3.0), -2.6], [T(3.1), 0, 'in2']], ta);
    s.y = RAIL_H + 0.2 - kf([[T(3.0), 0], [JUMP, 0.2, 'out2']], ta);  // crouch into the jump
  }
  if (ta >= JUMP) {
    const f = flight(ta);
    s.x = f.x; s.y = f.y - G.FIG.legH; s.z = f.z; s.yaw = f.yaw; s.roll = f.bank * 0.5;
    const tuck = kf([[JUMP, 0], [JUMP + 0.3, 1, 'out2']], ta);
    s.legL = s.legR = -1.3 * tuck;                 // seated in the harness
    const yay = kf([[JUMP, 0], [JUMP + 0.25, 1, 'out3'], [JUMP + 0.9, 1], [JUMP + 1.2, 0.35]], ta);
    s.aR = [-2.9 * yay, 0, 0.35]; s.aL = [-2.9 * yay, 0, -0.35];
    s.hy = 0; s.headPitch = 0;
  }
  return s;
}
function manPose(ta) {
  const s = { x: -3.7, y: 0, z: -2.6, yaw: -Math.PI / 2 - 0.35, aR: [0.1, 0, 0], aL: [0.05, 0, 0] };
  if (ta >= T(1.6)) s.hy = kf([[T(1.6), 0], [T(1.75), 1.6, 'out2']], ta) + (ta > JUMP ? kf([[JUMP, 0], [JUMP + 1.5, 0.5]], ta) : 0);
  if (ta >= JUMP + 0.3) { const k = kf([[JUMP + 0.3, 0], [JUMP + 0.45, 1, 'out3']], ta); s.aR = [-2.8 * k, 0, 0.4 * k]; s.aL = [-2.8 * k, 0, -0.4 * k]; }
  return s;
}
function crowdPose(f, i, ta) {
  const s = { ...f.base };
  if (ta < JUMP + 0.1) return s;
  const k = kf([[JUMP + 0.1 + i * 0.05, 0], [JUMP + 0.25 + i * 0.05, 1, 'out3']], ta);
  s.aR = [-2.7 * k, 0, 0.4 * k]; s.aL = [-2.7 * k * (i % 2), 0, -0.4 * k];
  s.hy = (s.hy || 0) + 0.5 * k;
  return s;
}

function groups(ta) {
  const f = flight(ta);
  const onRail = ta < JUMP;
  const pos = onRail ? [RT.x, RAIL_H + 0.2 + G.FIG.legH, RT.z] : [f.x, f.y, f.z];
  const yaw = onRail ? FACE_RAIL : f.yaw;
  const infl = onRail ? 0.82 : kf([[JUMP, 0.82], [JUMP + 0.35, 1.1, 'out2'], [JUMP + 0.6, 1]], ta);
  return { glider: composeM(pos, [0.1, yaw, onRail ? 0 : f.bank]).multiply(composeM([0, 0, 0], [0, 0, 0], [infl, 1, 1])) };
}

film({
  dur: 17.6, alive: A, bg: '#bfc7cf', floorY: null, seed: 658,
  light: { sky: '#e9eef3', ground: '#6f7466', hemi: 1.45, sunColor: '#f4f1ea', sun: 1.7, sunPos: [-40, 90, 60], sunTarget: [0, 0, -30], shadowBox: 120, shadowFar: 320 },
  envIntensity: 0.6, exposure: 1.0,
  mats: (THREE) => ({ lattice: latticeMat(THREE) }),
  schedule: { ground: [0.12, 0.9], rest: [0.8, 6.0], worldY: true, sweep: [0.3, -0.12] },
  build, groups,
  devCam: DEV_CAM,
  cams: {
    START: { tgt: [-6, -6, -52], az: 34, el: 30, dist: 230, fov: 30 },
    PHOTO: { tgt: [0.4, 3.15, 0], az: 8, el: -4, dist: 4.9, fov: 57 },
    CLOSE: { tgt: [0.5, 5.6, -0.8], az: 24, el: 4, dist: 14.5, fov: 52 },
    FOLLOW: (t) => { const f = flight(t < A ? 0 : t); return { tgt: [f.x * 0.75, 3 + (f.y - 3) * 0.6, f.z * 0.75], az: 14, el: 3, dist: 16, fov: 52 }; },
    END: { tgt: [-8, -6, -55], az: -16, el: 24, dist: 235, fov: 30 },
  },
  moves: [[0, 7.8, 'START', 'PHOTO', 'io2'], [8.3, 10.9, 'PHOTO', 'CLOSE', 'sine'], [11.35, 13.9, 'CLOSE', 'FOLLOW', 'io2'], [14.4, 17.0, 'FOLLOW', 'END', 'io2']],
  timeline: (tl) => {
    tl.fromTo('#label .kick', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.3);
    tl.fromTo('#label .title', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0.42);
    tl.fromTo('#label .sub', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.56);
    tl.to('#label', { y: 28, opacity: 0, duration: 0.5, ease: 'power2.in' }, 8.4);
    tl.to('#label', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 15.2);
  },
});

// chain-link / LEGO lattice fence: alpha-tested diamond grid
function latticeMat(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#fff'; g.lineWidth = 7;
  for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i, 256); g.lineTo(i + 256, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.8, 2.4); t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.5, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
}
