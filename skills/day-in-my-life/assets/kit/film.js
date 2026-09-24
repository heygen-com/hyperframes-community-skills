// film.js: chapters, easing, the camera helper, and the three seams of the ink grammar.
//
// chapters([{ name, dur, draw(u, dur), out }...]) lays chapters end to end. draw() paints the WHOLE frame for local
// time u (already stepped to the 8 fps boil), must be a pure function of u, and calls caption() itself.
// out = the seam into the next chapter:
//   'wipe'    ink band travelling LEFT (the current): leading edge covers A, full ink on the cut drawing,
//             trailing edge uncovers B. Both sides pan left through it (mirrored ease-in / ease-out).
//   'swallow' Z forward: A's scene draws its own swallow (the blot / ink disc grows to cover), B opens on an iris
//             that also grows. Same scale sign both sides.
//   'black'   caused blackout: A's own light goes out (lamp, power). B cuts in from ink.
// Seams are drawn after the chapter, in screen space, and register INKMASK so paper strokes + letters go under them.

const CH = [];
let FILM_DUR = 0;
function chapters(list) { let t = 0; for (const c of list) { CH.push({ ...c, t0: t }); t += c.dur; } FILM_DUR = t; }

const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeIn = (x, p = 3) => Math.pow(clamp(x), p);
const easeOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x), p);
const backOut = (x, s = 1.6) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
// characters typed so far: starts at t0, cps characters a second
const typed = (u, t0 = .15, cps = 20) => Math.max(0, (u - t0) * cps);
// arc from p0 to p1 peaking h px above the line, k = 0..1
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
// a drop-in: y offset from -d to 0 with a small overshoot, over `dur` from t0 (reads as a slap at 8 fps)
const dropIn = (u, t0, d = 60, dur = .25) => u < t0 ? null : -d * (1 - backOut(seg(u, t0, t0 + dur), 1.2));

const WIPE = .75, SEAM_PAN = 90;   // wipe window (s) and the leftward pan carried through it (px)

// Pan offset (world px, added to camera cx) that carries content LEFT through wipe seams on both sides.
function seamPan(ci, u) {
  const c = CH[ci], prev = CH[ci - 1];
  let dx = 0;
  if (c.out === 'wipe') dx += SEAM_PAN * easeIn(seg(u, c.dur - WIPE / 2, c.dur), 2);
  if (prev && prev.out === 'wipe') dx -= SEAM_PAN * (1 - easeOut(seg(u, 0, WIPE / 2), 2));
  return dx;
}
// camera for chapter ci at local u: the chapter's own move plus the seam pan
function cam(ci, u, cx, cy, z = 1) { camBegin(cx + seamPan(ci, u) / z, cy, z); }

// ---------- seam overlays (screen space) ----------
function raggedEdge(key, x, dir) {
  // vertical ragged edge at x; dir = +1 teeth point right, -1 left. Returns points top → bottom.
  const L = layRng(key), pts = [];
  for (let y = -80; y <= H + 80; y += 36) pts.push([x + dir * (L() * 70 + jit(10)), y]);
  return pts;
}
function inkBand(key, x0, x1) {
  // solid ink from x0 (left edge, ragged) to x1 (right edge, ragged); edges may be off-frame
  if (x1 <= x0) return;
  const left = raggedEdge(key + ':l', x0, -1), right = raggedEdge(key + ':r', x1, 1).reverse();
  const poly = left.concat(right);
  boilSeed(key); wash(poly, INK);
  // dry drag marks off both edges
  for (let i = 0; i < 9; i++) {
    const y = 40 + random() * (H - 80);
    if (x0 > -60 && x0 < W + 60) pen([[x0 + 10, y], [x0 - 40 - random() * 90, y + jit(4)]], .9 + random() * .6, INK, 'dry');
    if (x1 > -60 && x1 < W + 60) pen([[x1 - 10, y], [x1 + 40 + random() * 90, y + jit(4)]], .9 + random() * .6, INK, 'dry');
  }
  INKMASK.push({ pts: poly });
}
// wipe around a cut at local time: side 'out' (u = time to the cut, negative) or 'in' (u = time since the cut)
function wipeOut(key, k) {   // k 0..1 over the last WIPE/2 before the cut; leading edge runs W → 0 accelerating
  const x0 = lerp(W + 140, -140, easeIn(k, 2));
  inkBand(key, x0, W + 400);
}
function wipeIn(key, k) {    // k 0..1 over the first WIPE/2; trailing edge runs W → 0 decelerating
  const x1 = lerp(W + 140, -140, easeOut(k, 2));
  inkBand(key, -400, x1);
}
// iris: ink everywhere except a ragged hole of radius r around (cx, cy)
function irisHole(key, cx, cy, r) {
  const L = layRng(key), hole = [];
  boilSeed(key);
  const n = 30;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 + (L() - .5) * .16) + jit(4); hole.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const far = 4000;
  for (let i = 0; i < n; i++) {
    const a = hole[i], b = hole[(i + 1) % n], out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
    const ex = (b[0] - a[0]) * .08, ey = (b[1] - a[1]) * .08, a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    wash([a2, b2, out(b2), out(a2)], INK);
  }
  // a few dry flicks into the hole off its rim
  for (let i = 0; i < 10; i++) { const a = random() * TAU, p = [cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02]; pen([p, [cx + Math.cos(a) * r * (.9 - random() * .08), cy + Math.sin(a) * r * (.9 - random() * .08)]], .8, INK, 'dry'); }
  INKMASK.push({ hole });
}
// swallow: an ink disc spreading from (cx, cy), screen space; r grows to cover the frame
function inkDisc(key, cx, cy, r) {
  if (r < 2) return;
  const L = layRng(key), pts = [];
  boilSeed(key);
  for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, rr = r * (1 + (L() - .5) * .22) + jit(5); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  wash(pts, INK);
  INKMASK.push({ pts });
}

const IRIS = .55;   // iris open time (s)

function drawWorld(t) {
  let i = 0; while (i + 1 < CH.length && t >= CH[i + 1].t0 - 1e-6) i++;
  const c = CH[i], u = t - c.t0, prev = CH[i - 1];
  c.draw(u, c.dur, i);
  camEnd();
  // a chapter that ends in a swallow but doesn't draw its own: ink spreads from the centre over the last bar-half
  if (c.out === 'swallow' && !c.selfSwallow) inkDisc('swallow' + i, W / 2, H / 2, 2400 * easeIn(seg(u, c.dur - .9, c.dur), 2));
  // seams, screen space, on top of the chapter
  if (c.out === 'wipe' && u > c.dur - WIPE / 2) wipeOut('wipe' + i, seg(u, c.dur - WIPE / 2, c.dur));
  if (prev && prev.out === 'wipe' && u < WIPE / 2) wipeIn('wipe' + (i - 1), seg(u, 0, WIPE / 2));   // cut drawing = full ink
  if (prev && prev.out === 'swallow' && u < IRIS) irisHole('iris' + i, prev.irisAt ? prev.irisAt[0] : W / 2, prev.irisAt ? prev.irisAt[1] : H / 2, lerp(40, 1300, easeOut(seg(u, 0, IRIS), 2)));
  frame();
}
