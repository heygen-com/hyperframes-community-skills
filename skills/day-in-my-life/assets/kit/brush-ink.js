// brush-ink.js: the two-tone ink look on p5.brush (p5 2.x, WEBGL). Everything is a pure function of t.
// Boil: a new drawing every 1/8 s. boilSeed(key) before each element keeps unmoving things identical
// between boil steps no matter how much randomness moving things upstream consumed.
// Load order: p5.min.js → p5.brush.js → brush-ink.js → your scene file (defines drawWorld(t)).
const W = 1920, H = 1080, TAU = Math.PI * 2, BOIL = 8;
const INK = '#121110', PAPER = '#EEE9E0';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
let BOILN = 0;
function boilSeed(key) {
  let h = 2166136261;
  for (const c of String(key) + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  randomSeed(h >>> 0);
}
// layout randomness: same every boil step (positions, sizes, which spine gets a label)
function layRng(key) {
  let a = 2166136261; for (const c of String(key)) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const jit = a => (random() * 2 - 1) * a;

// ---------- camera ----------
// camBegin(cx, cy, z): world point (cx, cy) lands at screen centre, scaled z. Letters and light-pass strokes queued
// while it is active are placed through it. One level only: always pair with camEnd().
let CAM = null;
function camBegin(cx = W / 2, cy = H / 2, z = 1) { push(); translate(W / 2, H / 2); scale(z); translate(-cx, -cy); CAM = { cx, cy, z }; }
function camEnd() { if (CAM) { pop(); CAM = null; } }
function toScreen(x, y) { return CAM ? [W / 2 + (x - CAM.cx) * CAM.z, H / 2 + (y - CAM.cy) * CAM.z] : [x, y]; }

// ---------- ink mask ----------
// Screen-space shapes that are solid ink ON TOP of everything (seam bands, irises, swallows). The light pass and the
// lettering are cut out under them, so a wipe covers paper strokes and captions too. { pts, hole? } per entry.
let INKMASK = [];
// Letters draw on the 2D compositor above all brush work. A paper face that should hide letters under it (a book
// flying over a shelf) registers as an occluder at layer z: letters with a lower z are clipped out of its shape.
let OCCLUDERS = [];
function occlude(pts, z = 1) { OCCLUDERS.push({ z, pts: pts.map(([x, y]) => toScreen(x, y)) }); }

// ---------- geometry ----------
function ellPts(cx, cy, rx, ry, n = 28, j = 0, a0 = 0, a1 = TAU) {
  const p = []; const full = Math.abs(a1 - a0 - TAU) < 1e-6;
  for (let i = 0; i < (full ? n : n + 1); i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); }
  return p;
}
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)], [x + w + jit(j) * .5, y + h / 2],
          [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5], [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function resample(P, step) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}

// walk the path and emit a point every `step` px (coarsens as well as refines)
function respace(P, step) {
  const out = [P[0]]; let carry = 0;
  for (let i = 1; i < P.length; i++) {
    let [x0, y0] = P[i - 1]; const [x1, y1] = P[i]; let seg = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / (seg || 1), dy = (y1 - y0) / (seg || 1);
    while (carry + seg >= step) { const t = step - carry; x0 += dx * t; y0 += dy * t; seg -= t; carry = 0; out.push([x0, y0]); }
    carry += seg;
  }
  const last = P[P.length - 1], e = out[out.length - 1];
  if (Math.hypot(last[0] - e[0], last[1] - e[1]) > step * .3) out.push(last);
  return out;
}

// ---------- brushes ----------
function defineBrushes() {
  // clean brush-pen line, swells a little at the start
  brush.add('ink', { type: 'default', weight: 6, scatter: .2, sharpness: .85, grain: 40, opacity: 245, spacing: .15, pressure: [1.15, .8], rotate: 'natural', noise: .12 });
  // loaded round brush for blot petals and fat marks: heavy at the start, runs out at the tip
  brush.add('sumi', { type: 'default', weight: 12, scatter: .35, sharpness: .75, grain: 30, opacity: 250, spacing: .12, pressure: [1.35, .15], rotate: 'natural', noise: .25 });
  // even marker-weight mark: ticks, boards, dashes (sumi's loaded start reads as a tadpole on short marks)
  brush.add('flat', { type: 'default', weight: 8, scatter: .25, sharpness: .8, grain: 35, opacity: 250, spacing: .14, pressure: [1.05, .85], rotate: 'natural', noise: .2 });
  // dry brush: streaky, broken, for hairy edges and flecks
  brush.add('dry', { type: 'default', weight: 10, scatter: 1.4, sharpness: .45, grain: 10, opacity: 225, spacing: .35, pressure: [1.1, .4], rotate: 'natural', noise: .55 });
}

// ---------- drawing primitives ----------
// flat ink (or paper) area
function wash(pts, col = INK) { brush.noStroke(); brush.noFill(); brush.noHatch(); brush.noMass(); brush.wash(col, 255); brush.polygon(pts); brush.noWash(); }
// an area filled the way a hand inks it: continuous brush hatching inside the shape (p5.brush mass)
// Solid ink shape: exact wash + a brush outline. (brush.mass hatches the inside with strokes, but stacked pigment
// renders darker than a washed room, so a silhouette would read as a darker blob; use mass only on paper.)
function inked(pts, col = INK, o = {}) {
  wash(pts, col);
  if (o.mass) { brush.noStroke(); brush.noFill(); brush.noHatch(); brush.noWash(); brush.mass('sumi', col, { precision: .6, strength: 1, gradient: 0, outline: false }); brush.polygon(pts); brush.noMass(); }
  if (o.edge !== false) pen(pts.concat([pts[0]]), o.edge ?? 1, col, 'ink', { curv: .2 });
}
// brush line along points; press = [start, end] pressure; lifts = chance of a pen lift per ~40 px (broken "- -" edges)
// p5.brush mixes stroke colour like pigment, so a paper stroke over ink comes out grey. Paper strokes are queued
// for a second pass: painted in INK on blank paper, then inverted and composited with 'lighten' (see paintFrame).
// Washes are exact and stay in the ink pass. Light strokes land on top of everything in the ink pass.
let PASS = 'ink', LIGHT = [];
// twice: n = go over the mark n times, offset sideways by sep px (the style's "=" double strokes), each pass
// trimmed a little differently at the ends.
function offsetPath(P, d) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - dy / l * d, p[1] + dx / l * d];
  });
}
function trim(P, t0, t1) {
  // t0, t1 = 0..1 of a 14 px budget trimmed off each end (absolute, so long lines keep their corners)
  const R = respace(P, 5), n = R.length, a = Math.min(Math.floor(t0 / .06 * 3), Math.floor(n / 4)), b = n - Math.min(Math.floor(t1 / .06 * 3), Math.floor(n / 4));
  return R.slice(a, Math.max(a + 3, b));
}
function pen(pts, w = 1, col = INK, br = 'ink', o = {}) {
  const { press = null, lifts = 0, curv = .35, wob = 0, twice = 1, sep = null } = o;
  if (PASS === 'ink' && col === PAPER) {
    const sd = Math.floor(random() * 4294967296), cam = CAM;
    LIGHT.push(() => { randomSeed(sd); if (cam) camBegin(cam.cx, cam.cy, cam.z); pen(pts, w, INK, br, o); if (cam) camEnd(); });
    return;
  }
  if (twice > 1) {
    const d = sep ?? (3 + w * 3.5);
    for (let k = 0; k < twice; k++) {
      const off = (k - (twice - 1) / 2) * d + jit(d * .25);
      pen(trim(offsetPath(pts.length < 3 ? resample(pts, 20) : pts, off), random() * .06, random() * .06), w * (k ? .8 : 1), col, br, { ...o, twice: 1 });
    }
    return;
  }
  brush.noFill(); brush.noWash(); brush.noHatch(); brush.noMass(); brush.set(br, col, w);
  let P = pts.length < 3 ? resample(pts, Math.max(4, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 3)) : pts;
  if (lifts > 0 || wob > 0) P = respace(pts, 40).map(([x, y]) => [x + jit(wob), y + jit(wob)]);
  if (lifts <= 0) { brush.spline(press ? P.map((p, i) => [p[0], p[1], lerp(press[0], press[1], i / (P.length - 1))]) : P, curv); return; }
  let run = [P[0]];
  for (let i = 1; i < P.length; i++) {
    if (random() < lifts && run.length >= 3) { brush.spline(run, curv); run = []; i++; if (i < P.length) run.push(P[i]); continue; }
    run.push(P[i]);
  }
  if (run.length >= 3) brush.spline(run, curv); else if (run.length === 2) brush.spline(resample(run, Math.max(4, Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]) / 3)), curv);
}
function sketchRect(x, y, w, h, sw = 1, col = INK, o = {}) {
  const ov = o.over ?? 10, br = o.br || 'flat';
  const e = () => jit(ov * .5) + ov * .5;
  pen([[x - e(), y + jit(2)], [x + w + e(), y + jit(2)]], sw, col, br, { curv: 0, ...o });
  pen([[x + w + jit(2), y - e()], [x + w + jit(2), y + h + e()]], sw, col, br, { curv: 0, ...o });
  pen([[x + w + e(), y + h + jit(2)], [x - e(), y + h + jit(2)]], sw, col, br, { curv: 0, ...o });
  pen([[x + jit(2), y + h + e()], [x + jit(2), y - e()]], sw, col, br, { curv: 0, ...o });
}
// ---------- sketch layer ----------
// SKETCH scales every loose thing at once: wobble, pen lifts, overshoot, edge raggedness, misregistration, gaps.
// 0 = clean, 1 = loose, 1.8 = the default (sketchy, not refined; lower it for a cleaner line).
let SKETCH = 1.8;

// Wash with a hand-cut edge: resampled every ~28 px, displaced sideways, and offset from where its outline will be
// drawn (fill and line never quite agree, like a real inked panel).
function roughWash(pts, col = INK, o = {}) {
  const amp = (o.amp ?? 4) * SKETCH, mis = (o.mis ?? 3) * SKETCH, dx = jit(mis), dy = jit(mis);
  const ring = respace(pts.concat([pts[0]]), 28).slice(0, -1);
  wash(ring.map(([x, y], i) => {
    const a = ring[Math.max(0, i - 1)], b = ring[Math.min(ring.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = jit(amp);
    return [x - (b[1] - a[1]) / l * d + dx, y + (b[0] - a[0]) / l * d + dy];
  }), col);
}
// Outline drawn edge by edge: every side its own stroke, overshooting the corners, gone over twice, with lifts.
function sketchPoly(pts, sw = 1, col = INK, o = {}) {
  const n = pts.length, closed = o.closed ?? true, ov = (o.over ?? 12) * SKETCH, br = o.br || 'flat';
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
    const e0 = ov * (.2 + random()), e1 = ov * (.2 + random());
    if (o.skip && random() < o.skip) continue;
    pen([[a[0] - ux * e0, a[1] - uy * e0], [b[0] + ux * e1, b[1] + uy * e1]], sw * (.8 + random() * .4), col, br,
      { curv: 0, lifts: (o.lifts ?? .18) * SKETCH, wob: 1.5 * SKETCH, twice: o.twice ?? 2, sep: o.sep ?? 6 });
  }
}
// Fill a shape with parallel brush strokes instead of a flat wash: gaps between strokes, strokes skipped, ragged ends.
// Reads as "drawn in", never full. angle in radians (PI/2 = vertical strokes).
function hatchFill(pts, col = PAPER, o = {}) {
  const { angle = Math.PI / 2, gap = 14, w = 1.6, br = 'flat', skip = .12, ragged = 14 } = o;
  const c = Math.cos(-angle), s = Math.sin(-angle), rot = ([x, y]) => [x * c - y * s, x * s + y * c];
  const ci = Math.cos(angle), si = Math.sin(angle), unrot = ([x, y]) => [x * ci - y * si, x * si + y * ci];
  const R = pts.map(rot), ys = R.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let y = y0 + gap * (.3 + random() * .4); y < y1; y += gap * (.8 + random() * .4)) {
    const xs = [];
    for (let i = 0; i < R.length; i++) {
      const [ax, ay] = R[i], [bx, by] = R[(i + 1) % R.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (random() < skip * SKETCH) continue;
      const g = ragged * SKETCH, xa = xs[k] + random() * g * .5, xb = xs[k + 1] - random() * g;
      if (xb - xa < 8) continue;
      pen([unrot([xa, y + jit(1.5)]), unrot([(xa + xb) / 2, y + jit(2) * SKETCH]), unrot([xb, y + jit(1.5)])], w * (.85 + random() * .3), col, br, { curv: .3, lifts: .08 * SKETCH });
    }
  }
}
// A few loose strokes hanging off a shape: construction lines, scratches, overshoots.
function strays(cx, cy, r, n, col = INK, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = (o.a0 ?? 0) + random() * (o.span ?? TAU), d = r * (.7 + random() * .6), len = (o.len ?? 40) * (.5 + random());
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, t = a + (o.along ? Math.PI / 2 : 0) + jit(.3);
    pen([[x, y], [x + Math.cos(t) * len, y + Math.sin(t) * len]], (o.w ?? .7) * (.7 + random() * .6), col, 'flat', { twice: random() < .5 ? 2 : 1, sep: 5 });
  }
}

const penBox = (x, y, w, h, sw = 1, col = INK, o = {}) => pen([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y - 3]], sw, col, 'ink', { curv: 0, ...o });
function inkDot(x, y, r, col = INK) { wash(ellPts(x, y, r, r, 10, r * .18), col); }
function squiggle(x, y, len, o = {}) {
  const { amp = 7, wave = 26, w = 1, col = INK } = o, p = [];
  for (let s = 0; s <= len; s += wave / 4) p.push([x + s, y + (Math.round(s / (wave / 4)) % 2 ? -amp : amp) * (.7 + .3 * Math.sin(s / 70))]);
  pen(p, w, col, 'ink', { curv: .6 });
}
function asterisk(x, y, r, col = INK, w = .7) {
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + .3 + jit(.08); pen([[x - Math.cos(a) * r, y - Math.sin(a) * r], [x + Math.cos(a) * r, y + Math.sin(a) * r]], w, col, 'ink', { curv: 0 }); }
}

// The protagonist: Claude's starburst as an ink splat. Each petal is several loaded strokes pulled out from the core.
function blot(key, cx, cy, R, o = {}) {
  const { petals = 13, grow = 1, eye = true, splat = 9, spin = 0, col = INK } = o;
  const L = layRng(key + ':blot'); boilSeed(key + ':blot');
  const r = R * grow; if (r < 2) return;
  wash(ellPts(cx, cy, r * .3, r * .28, 22, r * .04), col);
  const pw = Math.max(r / 55, 1.25);
  for (let i = 0; i < petals; i++) {
    const a = spin + i / petals * TAU + (L() - .5) * .35 + jit(.03);
    const len = r * (.62 + L() * .5) * (1 + jit(.05)), bend = (L() - .5) * .6, strokes = r > 70 ? 4 : 3;
    for (let k = 0; k < strokes; k++) {
      const da = (k - (strokes - 1) / 2) * .07 + jit(.02), l = len * (.72 + .28 * (1 - Math.abs(k - (strokes - 1) / 2) / strokes)) * (1 + jit(.04));
      const ux = Math.cos(a + da), uy = Math.sin(a + da), vx = -uy, vy = ux, P = (d, s) => [cx + ux * d + vx * s, cy + uy * d + vy * s];
      pen([P(r * .12, 0), P(l * .5, bend * l * .12), P(l, bend * l * .3)], pw, col, 'sumi', { curv: .7 });
    }
    if (r > 60 && L() < .5) pen([[cx + Math.cos(a) * len * .9, cy + Math.sin(a) * len * .9], [cx + Math.cos(a + .12) * len * 1.15, cy + Math.sin(a + .12) * len * 1.15]], r / 160, col, 'dry', { curv: 0 });
  }
  for (let k = 0; k < splat; k++) { const a = L() * TAU, d = r * (1 + L() * .55); inkDot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(2, r * (.012 + L() * .03)), col); }
  if (eye && r > 80) pen(ellPts(cx, cy + r * .05, r * .15, r * .085, 10, 0, Math.PI * 1.12, Math.PI * 1.88), r / 90, PAPER, 'ink', { curv: .6 });
}

// A seated person from behind (head + shoulders), bottom-anchored. rim = paper outline for dark rooms.
function backOfHead(key, x, y, s, o = {}) {
  boilSeed(key);
  const pts = [[x - s * 1.95, H + 30], [x - s * 1.8, y + s * 1.95], [x - s * 1.2, y + s * 1.5], [x - s * .55, y + s * 1.08],
    ...ellPts(x, y, s * .74, s * .88, 26, s * .02, Math.PI * .72, Math.PI * 2.28),
    [x + s * .55, y + s * 1.08], [x + s * 1.2, y + s * 1.5], [x + s * 1.8, y + s * 1.95], [x + s * 1.95, H + 30]];
  roughWash(pts, INK, { amp: 2.5, mis: 0 });
  const L = layRng(key + ':hair');
  for (let i = 0; i < Math.round(12 * SKETCH); i++) {                     // hair: a few dry flicks off the crown
    const a = Math.PI * (1.1 + L() * .8), px = x + Math.cos(a) * s * .74, py = y + Math.sin(a) * s * .88, d = s * (.03 + L() * .05);
    pen([[px - Math.cos(a) * d * .6, py - Math.sin(a) * d * .6], [px + Math.cos(a + .25) * d, py + Math.sin(a + .25) * d]], .8 + L() * .6, INK, 'dry', { curv: 0 });
  }
  if (o.rim) pen(pts.slice(1, -1), .9, PAPER, 'ink', { lifts: .25 });
}
// standing figure, feet at (x, y)
function figure(key, x, y, h, o = {}) {
  boilSeed(key); const u = h / 8;
  const body = [[x - u * .9, y], [x - u, y - u * 3.2], [x - u * 1.3, y - u * 5.6], [x - u * .6, y - u * 6.1], [x + u * .6, y - u * 6.1], [x + u * 1.3, y - u * 5.6], [x + u, y - u * 3.2], [x + u * .9, y]];
  const head = ellPts(x, y - u * 6.9, u * .72, u * .85, 20, u * .02);
  inked(body, INK, { edge: 1 }); inked(head, INK, { edge: 1 });
  if (o.rim) { pen(body, .8, PAPER, 'ink', { lifts: .15 }); pen(head.concat([head[0]]), .8, PAPER, 'ink'); }
}

// ---------- lettering: queued in screen space, drawn on the 2D compositor ----------
let LETTERS = [];
function letter(txt, x, y, size, o = {}) {
  if (CAM && !o.screen) { [x, y] = toScreen(x, y); size *= CAM.z; }
  LETTERS.push({ txt, x, y, size, ...o });
}
function maskPath(c, m) {
  c.beginPath();
  if (m.hole) { c.rect(-50, -50, W + 100, H + 100); m.hole.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  else { m.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
}
function drawLetters(c) {
  c.save();
  // letters sit under seam ink: each mask narrows the clip (successive clips intersect)
  for (const m of INKMASK) {
    c.beginPath();
    if (m.hole) { m.hole.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); }
    else { c.rect(-50, -50, W + 100, H + 100); m.pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip('evenodd'); }
  }
  for (const L of LETTERS) {
    c.save();
    for (const o of OCCLUDERS) if ((L.z || 0) < o.z) {
      c.beginPath(); c.rect(-50, -50, W + 100, H + 100); o.pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip('evenodd');
    }
    c.translate(L.x, L.y); c.rotate(L.rot || 0);
    c.font = `${L.size}px "Gochi Hand"`; c.textAlign = L.align || 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = L.col || INK; c.strokeStyle = L.col || INK; c.lineJoin = 'round'; c.lineWidth = L.size * (L.heavy ?? .045);
    const s = L.chars != null ? L.txt.slice(0, Math.floor(L.chars)) : L.txt;
    c.fillText(s, 0, 0); if (L.heavy !== 0) c.strokeText(s, 0, 0); c.restore();
  }
  c.restore();
}
let measC = null;
function measure(txt, size) { measC = measC || document.createElement('canvas').getContext('2d'); measC.font = `${size}px "Gochi Hand"`; return measC.measureText(txt).width; }

// the chapter label: paper card, broken double border, types on (chars)
function caption(txt, chars = Infinity, o = {}) {
  const { x = 54, y = 48, size = 64 } = o, w = measure(txt, size) + size * 1.1, h = size * 1.6;
  boilSeed('caption');
  wash(rectPts(x, y, w, h, 1.5), PAPER);
  sketchRect(x - 7, y - 6, w + 14, h + 12, .9, INK, { lifts: .1, over: 6 });
  pen([[x + 6, y + h + 3], [x + w - 6, y + h + 4]], 1.2, INK, 'flat', { lifts: .2, twice: 2, sep: 5 });
  letter(txt, x + size * .55, y + h * .7, size, { chars });
}
// cream margin + rough ink panel line (every shot has it)
function frame(inset = 18) {
  boilSeed('frame');
  const m = inset;
  wash([[-40, -40], [W + 40, -40], [W + 40, m + jit(1.5)], [-40, m + jit(1.5)]], PAPER);
  wash([[-40, H - m + jit(1.5)], [W + 40, H - m + jit(1.5)], [W + 40, H + 40], [-40, H + 40]], PAPER);
  wash([[-40, -40], [m + jit(1.5), -40], [m + jit(1.5), H + 40], [-40, H + 40]], PAPER);
  wash([[W - m + jit(1.5), -40], [W + 40, -40], [W + 40, H + 40], [W - m + jit(1.5), H + 40]], PAPER);
  sketchRect(m + 2, m + 2, W - 2 * m - 4, H - 2 * m - 4, 1.3, INK, { over: 0, twice: 2, sep: 4 });
}

// ---------- paper + grain ----------
let grainC = null, outC = null, outX = null;
function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const id = c.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < .5 ? rnd() * rnd() * 30 : 0); d[i] = v; d[i + 1] = v; d[i + 2] = v - 2; d[i + 3] = 255; }
  c.putImageData(id, 0, 0); return cv;
}

// ---------- frame loop ----------
let T = 0, lightC = null, lightX = null;
async function setup() {
  createCanvas(W, H, WEBGL); pixelDensity(1); noLoop();
  defineBrushes();
  grainC = makeGrain(); outC = document.getElementById('out'); outX = outC.getContext('2d', { willReadFrequently: true });
  lightC = document.createElement('canvas'); lightC.width = W; lightC.height = H; lightX = lightC.getContext('2d', { willReadFrequently: true });
  await document.fonts.load('64px "Gochi Hand"');
  window.ready = true;
  if (window.__inkReady) window.__inkReady();
}
function draw() {
  if (!window.ready) return;
  push(); translate(-W / 2, -H / 2); background(PAPER);
  if (PASS === 'ink') { LETTERS = []; LIGHT = []; INKMASK = []; OCCLUDERS = []; CAM = null; BOILN = Math.round(T * BOIL); boilSeed('frame'); noiseSeed(77); drawWorld(T); camEnd(); }
  else for (const f of LIGHT) f();
  pop();
}
// ink pass → out; light pass (paper strokes painted as ink on paper) → coverage becomes alpha → paper colour laid on
// through it (exact paper, ink untouched, anti-aliasing kept); then letters; then grain
// Every drawing holds 1/8 s, motion included: the whole picture steps at 8 fps, like hand-drawn animation.
const q8 = t => Math.floor(t * BOIL + 1e-6) / BOIL;
async function paintFrame(t) {
  T = q8(t); PASS = 'ink'; await redraw();
  const c = outX;
  c.globalCompositeOperation = 'source-over'; c.drawImage(drawingContext.canvas, 0, 0, W, H);
  // p5.brush stacks pigment: ink over ink paints darker than ink. Floor every pixel at INK so the frame stays two-tone.
  const im0 = c.getImageData(0, 0, W, H), d0 = im0.data;
  for (let i = 0; i < d0.length; i += 4) { if (d0[i] < 0x12) d0[i] = 0x12; if (d0[i + 1] < 0x11) d0[i + 1] = 0x11; if (d0[i + 2] < 0x10) d0[i + 2] = 0x10; }
  c.putImageData(im0, 0, 0);
  if (LIGHT.length) {
    PASS = 'light'; await redraw(); PASS = 'ink';
    const l = lightX;
    l.globalCompositeOperation = 'copy'; l.drawImage(drawingContext.canvas, 0, 0, W, H);
    const im = l.getImageData(0, 0, W, H), d = im.data, p0 = 0xEE, i0 = 0x12, pr = 0xEE, pg = 0xE9, pb = 0xE0;
    for (let i = 0; i < d.length; i += 4) {
      const k = (p0 - d[i]) / (p0 - i0);
      d[i] = pr; d[i + 1] = pg; d[i + 2] = pb; d[i + 3] = k <= 0 ? 0 : k >= 1 ? 255 : k * 255;
    }
    l.putImageData(im, 0, 0);
    if (INKMASK.length) { l.globalCompositeOperation = 'destination-out'; l.fillStyle = '#000'; for (const m of INKMASK) { maskPath(l, m); l.fill('evenodd'); } l.globalCompositeOperation = 'source-over'; }
    c.globalCompositeOperation = 'source-over'; c.drawImage(lightC, 0, 0);
  }
  c.globalCompositeOperation = 'source-over'; drawLetters(c);
  c.globalCompositeOperation = 'multiply'; c.drawImage(grainC, 0, 0); c.globalCompositeOperation = 'source-over';
}
let warmed = false;
async function warm(t) { if (!warmed) { await paintFrame(t); warmed = true; } }   // p5.brush's first paint on a page composites wrong
window.renderAt = async (t, type = 'image/png') => { await warm(t); await paintFrame(t); return outC.toDataURL(type); };
window.paintAt = async t => { await warm(t); await paintFrame(t); };
