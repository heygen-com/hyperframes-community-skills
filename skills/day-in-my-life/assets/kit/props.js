// props.js: reusable set pieces built from brush-ink primitives. Every prop takes a key (boil seed) first.
// Load after brush-ink.js. Never name a global after a p5 function or a window property (line, dot, box, screen...).

function room(dark = true) { boilSeed('room'); wash([[-3000, -3000], [W + 3000, -3000], [W + 3000, H + 3000], [-3000, H + 3000]], dark ? INK : PAPER); }

// paper dashes drifting in the dark ("air")
function air(key, n, bx) {
  const L = layRng(key); boilSeed(key);
  for (let i = 0; i < n; i++) {
    const x = bx[0] + L() * bx[2], y = bx[1] + L() * bx[3], len = 30 + L() * 90;
    pen([[x, y], [x + len * .5, y + jit(2)], [x + len, y + jit(3)]], .7 + L() * .5, PAPER, 'flat', { twice: L() < .6 ? 2 : 1, sep: 7, lifts: .15 * SKETCH });
  }
}

function wrapText(str, size, maxW) {
  const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (measure(t, size) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}

// A monitor: hand-cut paper face, bezel drawn edge by edge, window dots + title bar. onDark = bezel in paper.
function monitor(key, x, y, w, h, o = {}) {
  const { onDark = true, stand = true } = o, edge = onDark ? PAPER : INK;
  boilSeed(key);
  roughWash([[x, y], [x + w, y - 4], [x + w + 4, y + h], [x, y + h + 2]], PAPER, { amp: 3 });
  sketchPoly([[x - 14, y - 14], [x + w + 14, y - 18], [x + w + 18, y + h + 14], [x - 12, y + h + 14]], 1.1, edge, { over: 20, sep: 9, lifts: .25 });
  [0, 1, 2].forEach(i => inkDot(x + 38 + i * 24 + jit(1.5), y + 34 + jit(1.5), 5.5));
  pen([[x + 28, y + 62], [x + w - 28, y + 64]], .75, INK, 'flat', { lifts: .35 * SKETCH, twice: 2, sep: 6, wob: 1.5 });
  if (stand) {
    pen([[x + w * .2, y + h + 18], [x + w * .34, y + h + 150]], 1, edge, 'flat', { twice: 2, sep: 8, lifts: .2 });
    pen([[x + w * .8, y + h + 18], [x + w * .66, y + h + 150]], 1, edge, 'flat', { twice: 2, sep: 8, lifts: .2 });
  }
}

// Chat bubble with wrapped text. fill = paper face (needed on dark grounds). Returns its height.
function bubble(key, x, y, w, txt, size = 34, o = {}) {
  const { fill = false, lh = size * 1.24, pad = size * .8 } = o;
  const lines = Array.isArray(txt) ? txt : wrapText(txt, size, w - pad * 2), h = lines.length * lh + pad * 1.3;
  boilSeed(key);
  if (fill) roughWash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], PAPER, { amp: 2, mis: 2 });
  const r = 18;
  sketchPoly([[x + r, y], [x + w - r, y + jit(3)], [x + w + jit(3), y + r], [x + w + jit(3), y + h - r], [x + w - r, y + h], [x + r, y + h + jit(3)], [x, y + h - r], [x + jit(3), y + r]], .8, INK, { over: 8, sep: 5, lifts: .2 });
  lines.forEach((l, i) => letter(l, x + pad, y + pad * .55 + size * .85 + i * lh, size));
  return h;
}

// A file dragged in: page with a folded corner + its name.
function fileChip(key, x, y, name, size = 26) {
  const w = measure(name, size) + 84, h = size * 2.1;
  boilSeed(key);
  roughWash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], PAPER, { amp: 1.5, mis: 1 });
  sketchPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], .8, INK, { over: 6, sep: 4 });
  const px = x + 16, py = y + 10, pw = 30, ph = h - 20;
  sketchPoly([[px, py], [px + pw - 10, py], [px + pw, py + 10], [px + pw, py + ph], [px, py + ph]], .6, INK, { over: 3, sep: 3, twice: 1 });
  pen([[px + pw - 10, py], [px + pw - 10, py + 10], [px + pw, py + 10]], .5, INK, 'flat');
  letter(name, x + 60, y + h * .66, size);
  return w;
}

// Pinned note: paper sheet, pin, a verbatim line in Gochi Hand. Returns its box.
function pinned(key, x, y, w, txt, size = 30, o = {}) {
  const { rot = 0, cross = false, minH = 0, scribble = 0 } = o, lines = txt.trim() ? wrapText(txt, size, w - 40) : [], h = Math.max(minH, lines.length * size * 1.2 + 56);
  boilSeed(key);
  const c = Math.cos(rot), s = Math.sin(rot), P = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
  roughWash([P(0, 0), P(w, 0), P(w, h), P(0, h)], PAPER, { amp: 2, mis: 1.5 });
  inkDot(...P(w / 2, 14), 6);
  lines.forEach((l, i) => { const [lx, ly] = P(20, 48 + i * size * 1.2); letter(l, lx, ly, size, { rot }); });
  for (let i = 0; i < scribble; i++) { const [sx0, sy0] = P(24, 44 + i * 30); squiggle(sx0, sy0, (w - 60) * (.5 + random() * .5), { amp: 4, wave: 18, w: .55 }); }
  if (cross) { pen([P(14, 20), P(w - 14, h - 14)], 1.4, INK, 'sumi'); pen([P(w - 16, 22), P(18, h - 12)], 1.3, INK, 'sumi'); }
  return { x, y, w, h };
}

// Crumpled paper ball on a dark floor: a few overlapping loops in paper.
function paperBall(key, x, y, r = 28) {
  boilSeed(key);
  roughWash(ellPts(x, y, r, r * .85, 12, r * .12), PAPER, { amp: 3, mis: 0 });
  for (let i = 0; i < 3; i++) { const a = random() * TAU; pen([[x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .6], [x, y + jit(r * .2)], [x + Math.cos(a + 2) * r * .6, y + Math.sin(a + 2) * r * .5]], .45, INK, 'flat', { curv: .5 }); }
}

// Lamp shade + hand-cut light cone (paper) on a dark room.
function lampCone(key, cx, top, topW, bot, botW, o = {}) {
  boilSeed(key);
  const a = [cx - topW / 2, top], b = [cx + topW / 2, top], c = [cx + botW / 2, bot], d = [cx - botW / 2, bot];
  roughWash([a, b, c, d], PAPER, { amp: 6, mis: 0 });
  pen([a, d], .8, INK, 'flat', { lifts: .35 * SKETCH, twice: 2, sep: 9, wob: 2 });
  pen([b, c], .8, INK, 'flat', { lifts: .35 * SKETCH, twice: 2, sep: 9, wob: 2 });
  roughWash([[cx - topW / 2 - 12, top - 44], [cx + topW / 2 + 12, top - 44], [cx + topW / 2 + 30, top + 2], [cx - topW / 2 - 30, top + 2]], INK, { amp: 2 });
  sketchPoly([[cx - topW / 2 - 34, top + 6], [cx + topW / 2 + 34, top + 6]], 1, PAPER, { closed: false, over: 16, lifts: .3 });
  if (o.cord) pen([[cx, -20], [cx, top - 44]], .6, PAPER, 'flat', { lifts: .2 });
}

// The shelf. Labelled spines get a paper face (readable); the rest are drawn in with strokes and gaps.
function shelf(key, sx, top, sw, rows, rh, labels = [], o = {}) {
  const L = layRng(key); let label = 0; const slots = [];
  boilSeed(key + ':case'); sketchPoly([[sx, top], [sx + sw, top], [sx + sw, top + rows * rh + 16], [sx, top + rows * rh + 16]], 1.2, PAPER, { over: 18, sep: 8, lifts: .22 });
  for (let r = 0; r < rows; r++) {
    const base = top + (r + 1) * rh; let x = sx + 18;
    boilSeed(key + ':board' + r); pen([[sx - 10, base + 6], [sx + sw + 12, base + 5]], 1.2, PAPER, 'flat', { curv: 0, twice: 2, sep: 8, lifts: .25 * SKETCH });
    while (x < sx + sw - 40) {
      const bw = 30 + L() * 30, bh = rh - 25 - L() * 40, lean = L() < .08 ? (L() - .5) * 30 : 0;
      if (x + bw > sx + sw - 16) break;
      boilSeed(`${key}:${r}_${Math.round(x)}`);
      const face = [[x + lean, base - bh], [x + bw + lean, base - bh + jit(3)], [x + bw, base], [x, base]];
      if (o.gap && o.gap.r === r && Math.abs(x - o.gap.x) < 40) { slots.push([x, base, bw, bh]); x += bw + 7; continue; }
      const hasLabel = L() < (o.labelRate ?? .42) && label < labels.length && bw > 34;
      if (hasLabel) {
        roughWash(face, PAPER, { amp: 2, mis: 1.5 });
        let fs = 24; while (fs > 14 && measure(labels[label], fs) > bh - 28) fs--;
        letter(labels[label], x + bw / 2 + fs * .32, base - 14, fs, { rot: -Math.PI / 2 }); label++;
      } else {
        hatchFill([[x + 6 + lean, base - bh + 4], [x + bw - 6 + lean, base - bh + 4], [x + bw - 6, base - 4], [x + 6, base - 4]], PAPER, { gap: 10, w: 1.2, skip: .06, ragged: 5 });
        if (L() < .5) asterisk(x + bw / 2, base - bh * (.3 + L() * .4), 9, INK, .55);
      }
      if (L() < .55) pen([[x + bw * .3, base - bh + 14], [x + bw * .7, base - bh + 14 + jit(2)]], .6, INK, 'flat');
      x += bw + 7 + L() * 4;
    }
  }
  return slots;
}

// Window with panes. onDark: paper frame on ink (night); else ink frame on paper (day).
function windowPanes(key, x, y, w, h, o = {}) {
  const { onDark = false, cols = 2, rows = 2 } = o, col = onDark ? PAPER : INK;
  boilSeed(key);
  sketchPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 1.3, col, { over: 16, sep: 8 });
  for (let i = 1; i < cols; i++) pen([[x + w * i / cols, y - 6], [x + w * i / cols, y + h + 6]], 1.1, col, 'flat', { twice: 2, sep: 7, lifts: .1 });
  for (let j = 1; j < rows; j++) pen([[x - 6, y + h * j / rows], [x + w + 6, y + h * j / rows]], 1.1, col, 'flat', { twice: 2, sep: 7, lifts: .1 });
  pen([[x - 30, y + h + 16], [x + w + 30, y + h + 18]], 1.6, col, 'flat', { twice: 2, sep: 8 });
}

// Sun on a paper sky: ink ring + dashed rays.
function sun(key, cx, cy, r) {
  boilSeed(key);
  pen(ellPts(cx, cy, r, r, 26, r * .04), 1.2, INK, 'flat', { twice: 2, sep: 7, lifts: .1 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + jit(.06), r0 = r * 1.3, r1 = r * (1.6 + random() * .35); pen([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], .9, INK, 'flat'); }
}

// Desk edge + legs.
function desk(key, y, x0, x1, col = INK) {
  boilSeed(key);
  pen([[x0, y], [x1, y + jit(4)]], 2.2, col, 'flat', { twice: 2, sep: 12, lifts: .1 });
  pen([[x0 + 60, y + 20], [x0 + 70, H + 20]], 1.6, col, 'flat', { twice: 2, sep: 10 });
  pen([[x1 - 60, y + 20], [x1 - 70, H + 20]], 1.6, col, 'flat', { twice: 2, sep: 10 });
}

// Ink pot (day 0 motif).
function inkPot(key, x, y, s = 1) {
  boilSeed(key);
  const body = [[x - 44 * s, y], [x + 44 * s, y], [x + 50 * s, y - 70 * s], [x + 22 * s, y - 84 * s], [x - 22 * s, y - 84 * s], [x - 50 * s, y - 70 * s]];
  roughWash(body, INK, { amp: 2, mis: 1.5 });
  sketchPoly(body, .8, INK, { over: 8, sep: 5 });
  roughWash([[x - 20 * s, y - 84 * s], [x + 20 * s, y - 84 * s], [x + 20 * s, y - 104 * s], [x - 20 * s, y - 104 * s]], INK, { amp: 1.5 });
  sketchRect(x - 30 * s, y - 60 * s, 60 * s, 30 * s, .6, PAPER, { over: 4, twice: 1 });
}

// Open door on a dark wall: light wedge on the floor, frame in paper. Returns the doorway box.
function doorway(key, x, y, w, h) {
  boilSeed(key);
  roughWash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], PAPER, { amp: 3, mis: 0 });
  roughWash([[x, y + h], [x + w, y + h], [x + w + 260, H + 40], [x - 160, H + 40]], PAPER, { amp: 5, mis: 0 });
  sketchPoly([[x - 12, y - 12], [x + w + 12, y - 12], [x + w + 12, y + h], [x - 12, y + h]], 1.2, PAPER, { over: 14, sep: 8, closed: false });
  return { x, y, w, h };
}

// Seated audience row / chair backs: ink humps with paper rims.
function seats(key, y, n, x0, x1) {
  boilSeed(key);
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) { const cx = x0 + w * (i + .5); pen(ellPts(cx, y, w * .42, w * .32, 14, 2, Math.PI, TAU), 1, PAPER, 'flat', { twice: 2, sep: 6, lifts: .15 }); }
}

// Speaker with an X (muted), in col.
function muted(key, x, y, s = 1, col = INK) {
  boilSeed(key);
  pen([[x, y - 12 * s], [x + 14 * s, y - 12 * s], [x + 34 * s, y - 30 * s], [x + 34 * s, y + 30 * s], [x + 14 * s, y + 12 * s], [x, y + 12 * s], [x, y - 14 * s]], 1, col, 'flat', { curv: 0, twice: 2, sep: 4 });
  pen([[x + 50 * s, y - 16 * s], [x + 80 * s, y + 16 * s]], 1.1, col, 'flat'); pen([[x + 80 * s, y - 16 * s], [x + 50 * s, y + 16 * s]], 1.1, col, 'flat');
}

// Magnifying glass: ring + handle.
function magnifier(key, x, y, r, col = INK) {
  boilSeed(key);
  pen(ellPts(x, y, r, r, 24, 1), 1.4, col, 'flat', { twice: 2, sep: 6 });
  pen([[x + r * .72, y + r * .72], [x + r * 1.8, y + r * 1.8]], 2.6, col, 'flat', { twice: 2, sep: 8 });
}

// A small film frame with a scribbled subject inside (contact sheets, footage pinned to a wall).
function filmFrame(key, x, y, w, h, kind = 0, o = {}) {
  const { onDark = false } = o;
  boilSeed(key);
  if (onDark) roughWash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], PAPER, { amp: 1.5, mis: 1 });
  sketchPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], .7, INK, { over: 6, sep: 4 });
  const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h);
  if (kind === 0) blot(key + ':b', cx, cy, s * .28, { splat: 3, eye: false });
  else if (kind === 1) { for (let i = 0; i < 3; i++) pen([[x + w * .15, cy - s * .18 + i * s * .18], [x + w * (.55 + random() * .3), cy - s * .18 + i * s * .18]], .7, INK, 'flat'); }
  else if (kind === 2) { pen(ellPts(cx, cy, s * .3, s * .22, 16, 1), .8, INK, 'flat', { twice: 2, sep: 4 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; inkDot(cx + Math.cos(a) * s * .3, cy + Math.sin(a) * s * .22, s * .05); } }
  else { const pts = []; for (let i = 0; i <= 8; i++) pts.push([x + w * (.1 + i * .1), cy + Math.sin(i * 1.3) * s * .2]); pen(pts, .8, INK, 'flat', { curv: .6 }); }
}

// ---------- hand lettering (single-stroke letterforms, drawn on with the brush) ----------
// Single-stroke lowercase letterforms, normalized: x 0..~0.75, baseline y = .88, x-height top ~.4, ascender .08,
// descender to 1.25. a-z and the apostrophe; anything else is skipped (story.mjs warns about it).
const GLYPHS = {
  a: [[[0.62,0.45],[0.35,0.38],[0.15,0.55],[0.2,0.8],[0.45,0.88],[0.62,0.72],[0.65,0.45],[0.68,0.88]]],
  b: [[[0.15,0.08],[0.17,0.88],[0.2,0.55],[0.45,0.42],[0.65,0.6],[0.55,0.85],[0.2,0.86]]],
  d: [[[0.6,0.45],[0.35,0.38],[0.15,0.55],[0.2,0.8],[0.45,0.88],[0.63,0.72]], [[0.64,0.08],[0.66,0.88]]],
  e: [[[0.15,0.65],[0.6,0.6],[0.55,0.4],[0.3,0.38],[0.12,0.6],[0.25,0.85],[0.6,0.82]]],
  f: [[[0.62,0.14],[0.47,0.06],[0.33,0.16],[0.31,0.88]], [[0.12,0.42],[0.52,0.4]]],
  g: [[[0.6,0.42],[0.3,0.38],[0.12,0.6],[0.3,0.8],[0.55,0.75],[0.62,0.45],[0.66,1.05],[0.5,1.25],[0.25,1.18]]],
  h: [[[0.15,0.08],[0.17,0.88],[0.18,0.55],[0.4,0.4],[0.6,0.5],[0.63,0.88]]],
  i: [[[0.3,0.45],[0.32,0.85]], [[0.3,0.24],[0.325,0.27]]],
  j: [[[0.42,0.45],[0.44,1.05],[0.32,1.25],[0.12,1.18]], [[0.42,0.24],[0.445,0.27]]],
  k: [[[0.15,0.08],[0.17,0.88]], [[0.56,0.4],[0.19,0.66],[0.62,0.88]]],
  l: [[[0.3,0.08],[0.32,0.8],[0.46,0.88]]],
  m: [[[0.1,0.88],[0.11,0.42],[0.13,0.55],[0.28,0.38],[0.4,0.55],[0.42,0.45],[0.55,0.38],[0.68,0.55],[0.7,0.88]]],
  n: [[[0.12,0.42],[0.14,0.88],[0.15,0.55],[0.35,0.4],[0.55,0.5],[0.58,0.88]]],
  o: [[[0.4,0.38],[0.15,0.5],[0.15,0.75],[0.4,0.88],[0.62,0.75],[0.6,0.48],[0.38,0.4]]],
  s: [[[0.6,0.42],[0.3,0.38],[0.14,0.52],[0.35,0.62],[0.58,0.7],[0.45,0.86],[0.14,0.82]]],
  t: [[[0.35,0.15],[0.38,0.8],[0.52,0.86]], [[0.15,0.42],[0.6,0.4]]],
  u: [[[0.12,0.4],[0.15,0.75],[0.35,0.88],[0.55,0.75],[0.6,0.4],[0.64,0.88]]],
  y: [[[0.12,0.4],[0.15,0.7],[0.35,0.82],[0.56,0.68],[0.6,0.4],[0.62,1.05],[0.45,1.25],[0.2,1.16]]],
  "'": [[[0.26,0.08],[0.22,0.3]]],
  c: [[[0.6,0.45],[0.35,0.38],[0.15,0.55],[0.2,0.8],[0.45,0.88],[0.62,0.8]]],
  p: [[[0.15,0.4],[0.17,1.25]], [[0.17,0.55],[0.4,0.4],[0.62,0.55],[0.58,0.8],[0.35,0.88],[0.17,0.8]]],
  q: [[[0.6,0.45],[0.35,0.38],[0.15,0.55],[0.2,0.8],[0.45,0.88],[0.62,0.72]], [[0.63,0.4],[0.65,1.25],[0.76,1.15]]],
  r: [[[0.15,0.4],[0.17,0.88]], [[0.17,0.58],[0.32,0.42],[0.55,0.4]]],
  v: [[[0.1,0.4],[0.35,0.88],[0.62,0.4]]],
  w: [[[0.08,0.4],[0.25,0.88],[0.42,0.5],[0.58,0.88],[0.76,0.4]]],
  x: [[[0.12,0.4],[0.6,0.88]], [[0.6,0.4],[0.12,0.88]]],
  z: [[[0.14,0.42],[0.6,0.42],[0.14,0.86],[0.62,0.86]]],
};
const GADV = { i: .42, j: .5, l: .46, f: .56, t: .6, s: .66, e: .66, a: .7, o: .7, u: .7, n: .68, h: .68, b: .68, d: .72, g: .72, k: .64, y: .7, m: .84, "'": .3,
  c: .64, p: .7, q: .74, r: .56, v: .68, w: .86, x: .66, z: .66 };

// Lay out a line: strokes in absolute coords + their lengths. Per-letter size/tilt/bounce come from the layout rng
// (stable across the boil); the boil only re-jitters points when drawn.
function handLayout(key, text, cx, baseY, size) {
  const L = layRng(key), letters = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') { x += size * .42; continue; }
    const g = GLYPHS[ch]; if (!g) continue;
    const s = size * (.92 + L() * .16), rot = (L() - .5) * .1 + .04, dy = (L() - .7) * size * .08;
    letters.push({ g, x, s, rot, dy }); x += s * (GADV[ch] ?? .68) * (.95 + L() * .08);
  }
  const x0 = cx - x / 2, strokes = [];
  for (const { g, x: lx, s, rot, dy } of letters) for (const st of g) {
    const pts = st.map(([px, py]) => { const rx = px * Math.cos(rot) - (py - .88) * Math.sin(rot), ry = (py - .88) * Math.cos(rot) + px * Math.sin(rot); return [x0 + lx + rx * s, baseY + ry * s + dy]; });
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    strokes.push({ pts, len: Math.max(len, 12) });
  }
  return strokes;
}
// Write lines on: k = 0..1 of the total pen path across every line, in order. Double strike trails the pen.
// Returns the pen tip (world) or null when nothing is drawn yet.
function handwrite(key, lines, size, k, o = {}) {
  const { w = 3.2, col = INK } = o;
  const S = lines.flatMap(([txt, cx, by], i) => handLayout(key + i, txt, cx, by, size));
  const total = S.reduce((a, s) => a + s.len, 0);
  let left = clamp(k) * total, tip = null;
  boilSeed(key);
  for (const s of S) {
    if (left <= 0) break;
    const f = Math.min(1, left / s.len); left -= s.len;
    const P = s.pts.map(([x, y]) => [x + jit(size * .012), y + jit(size * .012)]);
    const part = f >= 1 ? P : upToFrac(P, f);
    if (part.length >= 2) {
      pen(part, w, col, 'ink', { curv: .45 });
      if (f >= 1) pen(P.map(([x, y]) => [x + jit(size * .02), y + jit(size * .02)]), w * .7, col, 'ink', { curv: .45 });   // second lap
      tip = part[part.length - 1];
    }
  }
  return tip;
}
function upToFrac(P, f) {
  const R = resample(P, 5), n = Math.max(2, Math.round(R.length * clamp(f)));
  return R.slice(0, n);
}

// The desk terminal: ink screen, prompt, typed command (keys = keystroke times), a cursor, and after Enter the blot
// arrives in paper (a session starting). Returns true once entered.
function terminal(u, keys, enterT, word = 'claude') {
  const typedN = keys.filter(t => u >= t - 1e-6).length, entered = u >= enterT;
  letter('>', 604, 390, 50, { col: PAPER, heavy: .06 });
  if (typedN) letter(word.slice(0, typedN), 648, 390, 50, { col: PAPER, heavy: .05 });
  const cx = 650 + (typedN ? measure(word.slice(0, typedN), 50) + 8 : 0);
  if (!entered) { boilSeed('cursor'); wash(rectPts(cx, 348, 24, 46, 1.5), PAPER); }
  if (entered) {
    const k = backOut(seg(u, enterT, enterT + .3), 1.5);
    blot('termBlot', 640, 520, 38 * k + 1, { petals: 11, splat: 4, eye: false, col: PAPER });
    boilSeed('cursor2'); wash(rectPts(604, 594, 24, 46, 1.5), PAPER);
  }
  return entered;
}
