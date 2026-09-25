// REFERENCE EXCERPT (a real test build; its photo and generated trace are not shipped). Object path:
// an electric guitar on a wall, traced with scripts/trace_object.py into a stud × plate grid (trace/guitar.js), sliced into plates.
// Beat: the guitar twitches awake, hops off its hanger, spins, strums itself (strings buzz, brick notes pop out),
// hits a power chord, and hangs itself back up.
import { film, THREE, G, E, kf, clamp01, composeM, D2R, rng } from './kit/engine.js';
import { DEV_CAM } from './dev.js';
import TRACE from './trace/guitar.js';

const C = {
  body: '#ecebe4', guard: '#fbfbf6', maple: '#d59d5a', mapleDk: '#c48a48', chrome: '#d3d6da', black: '#1c1e22',
  wallHi: '#bfc3c6', wallLo: '#a4a9ad', patch: '#eeeeea', slot: '#7f858b', floor: '#8e9398',
};
const A = 8.2, T = (x) => A + x;
const BASE_Y = 4.0;                                        // guitar's lowest plate
const PX = (x) => (x - TRACE.X0) / TRACE.SX - 10;          // photo px → studs (column 10 on x = 0)
const PY = (y) => BASE_Y + (TRACE.Y0 + TRACE.rows.length * TRACE.SY - y) / 25;   // photo px → height (25 px per stud)
const Z_BACK = 0, Z_FRONT = 3;                             // body occupies z ∈ [0, 3); wall face at z = −1
const PIVOT = [0, PY(1180), 1.5];

function build(ctx) {
  const { M, Vox } = ctx;
  const r = rng(2033);
  const rows = TRACE.rows, nR = rows.length;
  // fill the empty row(s) between headstock and neck with the neck pattern below
  for (let i = 1; i < nR - 1; i++) if (!/[HN]/.test(rows[i]) && /H/.test(rows[i - 1]) && /N/.test(rows[i + 1])) rows[i] = rows[i + 1];

  // ── the guitar: plates stacked bottom-up, body 3 studs deep, neck + headstock 2 deep ──
  const gv = new Vox({ lp: 1, origin: [-10, BASE_Y, 0], group: 'gtr' });
  rows.forEach((line, ri) => {
    const iy = nR - 1 - ri;
    [...line].forEach((ch, ci) => {
      if (ch === 'B' || ch === 'G') for (let iz = 0; iz < 3; iz++) gv.set(ci, iy, iz, { c: C.body, top: 'tile' });
      if (ch === 'N') for (let iz = 1; iz < 3; iz++) gv.set(ci, iy, iz, { c: iz === 2 ? C.maple : C.mapleDk, top: 'tile' });
      if (ch === 'H') for (let iz = 1; iz < 3; iz++) gv.set(ci, iy, iz, { c: C.maple, top: 'tile' });
    });
  });
  gv.emit(M);
  // pickguard: SNOT tiles on the body face, one run per plate row
  rows.forEach((line, ri) => {
    const y = BASE_Y + (nR - 1 - ri) * G.PL;
    for (const m of line.matchAll(/G+/g)) {
      const x0 = m.index - 10, w = m[0].length;
      M.add({ geo: G.boxGeo(w, G.PL, 0.3), color: C.guard, pos: [x0 + w / 2, y + G.PL / 2, Z_FRONT + 0.15], group: 'gtr', conn: w, tier: 1 });
    }
  });

  // pickguard outline: thin dark slivers wherever a guard cell borders a non-guard cell (the photo's black edge line)
  const isG = (ri, ci) => ri >= 0 && ri < nR && rows[ri][ci] === 'G';
  rows.forEach((line, ri) => {
    const y = BASE_Y + (nR - 1 - ri) * G.PL;
    [...line].forEach((ch, ci) => {
      if (ch !== 'G') return;
      const x = ci - 10, z = Z_FRONT + 0.3;
      if (!isG(ri, ci - 1)) M.add({ geo: G.boxGeo(0.26, G.PL, 0.08), color: "#34363b", pos: [x + 0.13, y + G.PL / 2, z], group: 'gtr', conn: 0, noCount: true });
      if (!isG(ri, ci + 1)) M.add({ geo: G.boxGeo(0.26, G.PL, 0.08), color: "#34363b", pos: [x + 0.87, y + G.PL / 2, z], group: 'gtr', conn: 0, noCount: true });
      if (!isG(ri - 1, ci)) M.add({ geo: G.boxGeo(1, 0.14, 0.08), color: "#34363b", pos: [x + 0.5, y + G.PL - 0.07, z], group: 'gtr', conn: 0, noCount: true });
      if (!isG(ri + 1, ci)) M.add({ geo: G.boxGeo(1, 0.14, 0.08), color: "#34363b", pos: [x + 0.5, y + 0.07, z], group: 'gtr', conn: 0, noCount: true });
    });
  });

  const D = TRACE.details, gadd = (o) => M.add({ group: 'gtr', ...o });
  const zf = Z_FRONT + 0.3;                                  // face of the pickguard
  // pickups: white covers + six black poles
  for (const [x, y, deg] of D.pickups) {
    const w = D.pickupSize[0] / 25, h = D.pickupSize[1] / 25, a = deg * D2R;
    gadd({ geo: G.boxGeo(w, h, 0.3), color: '#fbfbf6', pos: [PX(x), PY(y), zf + 0.15], rot: [0, 0, -a], conn: 2 });
    for (let k = 0; k < 6; k++) {
      const u = (k - 2.5) * (w * 0.14);
      gadd({ geo: G.cylGeo(0.09, 0.12, 12).clone().rotateX(Math.PI / 2), color: '#3a3c40', pos: [PX(x) + u * Math.cos(a), PY(y) - u * Math.sin(a), zf + 0.33], conn: 0 });
    }
  }
  for (const [x, y] of D.knobs) {
    gadd({ geo: G.cylGeo(D.knobR / 25, 0.5, 24).clone().rotateX(Math.PI / 2), color: '#f7f7f1', pos: [PX(x), PY(y), zf + 0.25], conn: 1 });
    gadd({ geo: G.cylGeo(D.knobR / 25 * 0.55, 0.12, 20).clone().rotateX(Math.PI / 2), color: '#e6e6de', pos: [PX(x), PY(y), zf + 0.55], conn: 0 });
  }
  gadd({ geo: G.boxGeo(0.14, 0.7, 0.5), color: '#f7f7f1', pos: [PX(D.switch[0]), PY(D.switch[1]), zf + 0.3], rot: [0, 0, 0.7], conn: 1 });
  { const [x0, y0, x1, y1] = D.bridge;
    gadd({ geo: G.boxGeo((x1 - x0) / 25, (y1 - y0) / 25, 0.3), mat: 'chrome', color: C.chrome, pos: [PX((x0 + x1) / 2), PY((y0 + y1) / 2), zf + 0.15], conn: 2 });
    for (let k = 0; k < 6; k++) gadd({ geo: G.boxGeo(0.55, 0.9, 0.35), mat: 'chrome', color: '#b9bdc2', pos: [PX(x0) + 0.45 + k * 0.8, PY((y0 + y1) / 2) - 0.1, zf + 0.45], conn: 0 }); }
  { const [x, y, w, h, deg] = D.jack;
    gadd({ geo: G.cylGeo(0.5, 0.25, 28).clone().rotateX(Math.PI / 2).scale(w / 25 / 1.0, h / 25 / 1.0, 1), mat: 'chrome', color: C.chrome, pos: [PX(x), PY(y), Z_FRONT + 0.12], rot: [0, 0, -deg * D2R], conn: 1 }); }
  // neck: frets (nickel bars) + dots
  for (const [y, xm, w] of D.frets) gadd({ geo: G.boxGeo(Math.round(w / 25 * 10) / 10, 0.07, 0.12), mat: 'chrome', color: '#c9ccd0', pos: [PX(xm), PY(y), Z_FRONT + 0.06], conn: 0 });
  for (const [y, x] of D.dots) gadd({ geo: G.cylGeo(0.2, 0.08, 16).clone().rotateX(Math.PI / 2), color: C.black, pos: [PX(x), PY(y), Z_FRONT + 0.04], conn: 1 });
  gadd({ geo: G.boxGeo(2.6, 0.3, 0.3), color: '#efeee6', pos: [PX((D.neckTop[0] + D.neckTop[1]) / 2), PY(D.nut), Z_FRONT + 0.12], conn: 1 });   // nut
  // tuners: chrome posts on the face + keys off the side
  D.tunerPosts.forEach(([x, y], k) => {
    gadd({ geo: G.cylGeo(0.26, 0.45, 18).clone().rotateX(Math.PI / 2), mat: 'chrome', color: C.chrome, pos: [PX(x), PY(y), Z_FRONT + 0.2], conn: 1 });
    const [kx, ky] = D.tunerKeys[k];
    gadd({ geo: G.boxGeo(0.9, 0.7, 0.35), mat: 'chrome', color: '#cfd2d6', pos: [PX(kx) - 0.35, PY(ky), Z_FRONT - 0.7], conn: 1 });
  });
  // strings: six silver wires bridge → nut → posts, each its own group so they can buzz
  D.stringsBridge.forEach(([bx, by], k) => {
    const nx = D.neckTop[0] + 6 + k * ((D.neckTop[1] - D.neckTop[0] - 12) / 5), ny = D.nut;
    const x0 = PX(bx), y0 = PY(by), x1 = PX(nx), y1 = PY(ny), len = Math.hypot(x1 - x0, y1 - y0);
    M.add({ geo: G.cylGeo(0.035, len, 6), mat: 'chrome', color: '#dfe2e6', pos: [(x0 + x1) / 2, (y0 + y1) / 2, 0], rot: [0, 0, Math.atan2(-(x1 - x0), y1 - y0)], group: 's' + k, conn: 0, tier: 1 });
    const [px, py] = D.tunerPosts[k], x2 = PX(px), y2 = PY(py), l2 = Math.hypot(x2 - x1, y2 - y1);
    gadd({ geo: G.cylGeo(0.03, l2, 6), mat: 'chrome', color: '#dfe2e6', pos: [(x1 + x2) / 2, (y1 + y2) / 2, Z_FRONT + 0.3], rot: [0, 0, Math.atan2(-(x2 - x1), y2 - y1)], conn: 0 });
  });

  // ── wall: running-bond bricks, lighter paint up top, peeling patches, two rows of mounting slots ──
  const wall = new Vox({ lp: 3, origin: [-38, 0, -2] });
  for (let ix = 0; ix < 76; ix++) for (let iy = 0; iy < 62; iy++) {
    const x = ix - 38, y = iy * 1.2;
    const line = 49 + (x > 2 ? 2 : -3) + Math.sin(x * 0.4) * 0.8;
    let c = y > line ? C.wallHi : C.wallLo;
    const patch = [[10.5, 62, 3, 3], [17, 43, 2.2, 2], [3, 43.5, 1.2, 1.2], [18, 2, 3.5, 2.5], [-8, 30, 1.5, 1.5], [21, 30, 2, 1.2]]
      .some(([px, py, rx, ry]) => ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 < 1);
    if (patch) c = C.patch;
    wall.set(ix, iy, 0, { c, top: 'stud' });
  }
  wall.emit(M);
  for (const [x, y] of [[5.5, 45.5], [9, 45.5], [12.5, 45.5], [19, 46.5], [22.5, 46.5], [6, 38], [9.5, 38], [13, 38], [20, 38.5], [23.5, 38.5]])
    M.add({ geo: G.boxGeo(2.4, 0.4, 0.12), color: C.slot, pos: [x, y, -0.94], conn: 1 });
  // floor strip
  M.brick(-38, -0.4, -4, 76, 12, 1, C.floor, { top: 'stud', tier: 0 });
  // hanger: two black arms off the wall either side of the neck, under the headstock
  for (const [x, y0, , y1] of D.hanger) {
    M.add({ geo: G.boxGeo(0.6, (y1 - y0) / 25, 0.6), color: C.black, pos: [PX(x), PY((y0 + y1) / 2), 1.2], conn: 1 });
    M.add({ geo: G.boxGeo(0.6, 0.6, 3.4), color: C.black, pos: [PX(x), PY(y1) + 0.3, -0.5], conn: 1 });
  }

  // ── brick music notes (appear during the strum; each note is its own group) ──
  const notes = [];
  const nr = rng(77);
  for (let i = 0; i < 22; i++) {
    const beat = i < 14 ? Math.floor(i / 3.5) : 4, t0 = i < 14 ? T(1.95) + beat * 0.5 + (i % 3) * 0.067 : T(3.95) + (i - 14) * 0.034;
    const n = { g: 'n' + i, t0, life: 1.0 + nr() * 0.4, dir: [(nr() - 0.35) * 2.2, 1 + nr() * 1.4, 0.8 + nr() * 1.2], spin: (nr() - 0.5) * 2, double: nr() < 0.35, big: i >= 14 };
    const add = (o) => M.add({ group: n.g, land: 0, tier: 2, noCount: true, ...o });
    add({ geo: G.cylGeo(0.62, 0.4, 24).clone().rotateX(Math.PI / 2).scale(1.25, 1, 1), color: C.black, pos: [0, 0, 0], rot: [0, 0, 0.35], conn: 1 });
    add({ geo: G.boxGeo(0.18, 2.4, 0.3), color: C.black, pos: [0.62, 1.15, 0], conn: 1 });
    if (n.double) {
      add({ geo: G.cylGeo(0.62, 0.4, 24).clone().rotateX(Math.PI / 2).scale(1.25, 1, 1), color: C.black, pos: [1.9, -0.3, 0], rot: [0, 0, 0.35], conn: 1 });
      add({ geo: G.boxGeo(0.18, 2.4, 0.3), color: C.black, pos: [2.52, 0.85, 0], conn: 1 });
      add({ geo: G.boxGeo(2.05, 0.4, 0.3), color: C.black, pos: [1.57, 2.2, 0], rot: [0, 0, -0.15], conn: 2 });
    } else add({ geo: G.slopeGeo(1.0, 0.8, 0.3, 0, 0.1), color: C.black, pos: [1.1, 1.9, 0], rot: [0, 0, -0.9], conn: 1 });
    notes.push(n);
  }
  ctx.state.notes = notes;
}

// ── choreography ──
function gtrPose(ta) {
  const p = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  if (ta < A) return p;
  // twitch awake (on twos: alternating small rolls)
  if (ta < T(0.35)) p.roll = (Math.floor((ta - A) * 15) % 2 ? 1 : -1) * 0.035;
  // hop off the hanger toward camera, spin, strum on the beat, power chord, hang back up
  p.y = kf([[T(0.3), 0], [T(0.4), -0.5, 'out2'], [T(0.75), 3.4, 'out3'], [T(1.7), 4.2], [T(4.35), 4.2], [T(4.9), -0.35, 'in2'], [T(5.05), 0, 'out2']], ta);
  p.z = kf([[T(0.4), 0], [T(0.75), 7, 'out3'], [T(4.35), 7], [T(4.9), 0, 'io2']], ta);
  p.yaw = kf([[T(0.8), 0], [T(1.7), Math.PI * 2, 'io2']], ta);
  if (ta >= T(1.8) && ta < T(3.85)) {                               // four strums
    const b = (ta - T(1.9)) / 0.5, k = b - Math.floor(b);
    const hit = b < 0 ? 0 : Math.exp(-k * 5);
    p.roll = 0.09 * hit * (Math.floor(b) % 2 ? -1 : 1); p.y += -0.35 * hit;
  }
  p.pitch = kf([[T(3.85), 0], [T(4.0), -0.32, 'out3'], [T(4.3), -0.1], [T(4.6), 0]], ta);
  p.roll += kf([[T(3.85), 0], [T(4.0), -0.12, 'out3'], [T(4.4), 0]], ta);
  return p;
}
const buzz = (ta) => {                                              // string vibration amplitude
  if (ta < T(1.9) || ta > T(4.6)) return 0;
  const b = Math.min(4, (ta - T(1.9)) / 0.5), k = b - Math.floor(b);
  return (ta > T(3.95) ? 0.22 : 0.14) * Math.exp(-k * 2.5);
};
function groups(ta, t, ctx) {
  const p = gtrPose(ta);
  const g = composeM([PIVOT[0] + p.x, PIVOT[1] + p.y, PIVOT[2] + p.z], [p.pitch, p.yaw, p.roll]).multiply(composeM([-PIVOT[0], -PIVOT[1], -PIVOT[2]]));
  const out = { gtr: g };
  const a = buzz(ta), f = Math.floor((ta - A) * 15);
  for (let k = 0; k < 6; k++) out['s' + k] = g.clone().multiply(composeM([(f + k) % 2 ? a : -a, 0, G_FACE]));
  // notes: pop out of the pickups, fly up and out, pop away (scale on twos)
  const face = new THREE.Vector3(0, PY(1160), G_FACE + 0.8).applyMatrix4(g);
  for (const n of ctx.state.notes || []) {
    const u = (ta - n.t0) / n.life;
    if (u < 0 || u > 1) { out[n.g] = ZERO; continue; }
    const s = (n.big ? 1.35 : 1) * (u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1);
    const d = E.out2(u) * 11;
    out[n.g] = composeM([face.x + n.dir[0] * d, face.y + n.dir[1] * d * 0.9 + Math.sin(u * Math.PI) * 1.5, face.z + n.dir[2] * d], [0, 0, n.spin * u], s);
  }
  return out;
}
const G_FACE = Z_FRONT + 0.45;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

film({
  dur: 16, alive: A, bg: '#aecdee', seed: 2033,
  light: { sky: '#eef3f8', ground: '#8f8a82', hemi: 1.15, sunColor: '#fff6ea', sun: 2.4, sunPos: [-45, 85, 70], sunTarget: [0, 30, 0], shadowBox: 60, shadowFar: 260 },
  envIntensity: 0.6,
  schedule: { ground: [0.12, 0.5], rest: [0.45, 6.4], worldY: true, sweep: [0.25, 0.05] },
  build, groups,
  devCam: DEV_CAM,
  cams: {
    START: { tgt: [0, 30, 0], az: 38, el: 22, dist: 190, fov: 30 },
    PHOTO: { tgt: [1.12, 34, 0], az: 0, el: 0, dist: 92, fov: 30 },
    CLOSE: { tgt: [1, 27, 6], az: -10, el: 3, dist: 100, fov: 30 },
    END: { tgt: [0, 30, 0], az: -30, el: 16, dist: 185, fov: 30 },
  },
  moves: [[0, 7.7, 'START', 'PHOTO', 'io2'], [8.3, 10.6, 'PHOTO', 'CLOSE', 'sine'], [12.4, 15.2, 'CLOSE', 'END', 'io2']],
  timeline: (tl) => {
    tl.fromTo('#label .kick', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.3);
    tl.fromTo('#label .title', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0.42);
    tl.fromTo('#label .sub', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.56);
  },
});
