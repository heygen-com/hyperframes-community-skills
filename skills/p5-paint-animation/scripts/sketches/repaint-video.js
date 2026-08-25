// Video repainting with temporal coherence. The stroke lattice (positions,
// brushes, per-stroke jitters) is built ONCE from the first frame and locked;
// each subsequent frame only resamples colors and orientations from the new
// pixels. Strokes stay put -> the painting holds still while the subject moves.
// Driven by render-video.mjs via window.__paintFrame(dataURI).
//
// DIALS: STYLE (0/1/2), DETAIL (1 = no fine pass, 2 = fine pass), LOOSE

let lattice = null, fit, ox, oy, bg;
let img = null;

// WORLD mode (--inject "WORLD=1"): strokes live in world coordinates. Each
// frame the camera's translation is estimated by downscaled image correlation;
// strokes ride the scene instead of the frame, and new strokes spawn as the
// camera reveals new territory — the camera pans across one growing painting.
let off = { x: 0, y: 0 };      // world -> current image translation
let prevSmall = null;
const spawnedTiles = new Set();
let passQs = null;             // per-pass stroke arrays, world coords
const DS = 8;                  // correlation downscale

function toSmall() {
  const w = floor(img.width / DS), h = floor(img.height / DS);
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = 4 * ((y * DS + (DS >> 1)) * img.width + x * DS + (DS >> 1));
      a[y * w + x] = 0.299 * img.pixels[i] + 0.587 * img.pixels[i + 1] + 0.114 * img.pixels[i + 2];
    }
  return { a, w, h };
}

function sad(p, c, dx, dy, step) {
  let s = 0, n = 0;
  for (let y = 4; y < p.h - 4; y += step) {
    const yy = y + dy;
    if (yy < 0 || yy >= c.h) continue;
    for (let x = 4; x < p.w - 4; x += step) {
      const xx = x + dx;
      if (xx < 0 || xx >= c.w) continue;
      s += abs(p.a[y * p.w + x] - c.a[yy * c.w + xx]);
      n++;
    }
  }
  return n > 150 ? s / n : 1e18;
}

// how far the scene content moved since the previous frame (image px)
function estShift(p, c) {
  let best = { d: 1e18, x: 0, y: 0 };
  const R = 20;
  for (let dy = -R; dy <= R; dy += 2)
    for (let dx = -R; dx <= R; dx += 2) {
      const m = sad(p, c, dx, dy, 3);
      if (m < best.d) best = { d: m, x: dx, y: dy };
    }
  let fine = best;
  for (let dy = best.y - 2; dy <= best.y + 2; dy++)
    for (let dx = best.x - 2; dx <= best.x + 2; dx++) {
      const m = sad(p, c, dx, dy, 2);
      if (m < fine.d) fine = { d: m, x: dx, y: dy };
    }
  return { x: fine.x * DS, y: fine.y * DS };
}

const hex2 = (n) => Math.round(constrain(n, 0, 255)).toString(16).padStart(2, "0");
const rgbHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);

function patch(u, v, s) {
  u = floor(u); v = floor(v); s = max(1, floor(s)); // pixel indices must be ints
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = max(0, v - s); y < min(img.height, v + s); y += 2) {
    for (let x = max(0, u - s); x < min(img.width, u + s); x += 2) {
      const i = 4 * (y * img.width + x);
      r += img.pixels[i]; g += img.pixels[i + 1]; b += img.pixels[i + 2]; n++;
    }
  }
  if (!n) return { r: 128, g: 128, b: 128, lum: 128 };
  r /= n; g /= n; b /= n;
  return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b };
}

function grad(u, v, s) {
  const gx = patch(u + s, v, s).lum - patch(u - s, v, s).lum;
  const gy = patch(u, v + s, s).lum - patch(u, v - s, s).lum;
  return { gx, gy, mag: sqrt(gx * gx + gy * gy) };
}

function setup() {
  createCanvas(W, H, WEBGL);
  background("#888");
  if (!window.__brushScaled) {
    brush.scaleBrushes(2); // cumulative — must run exactly once per PAGE
    window.__brushScaled = true;
  }
  brush.field("hand");
  brush.wiggle(0.3);
}
function draw() { noLoop(); }


const STYLES = [
  { under: ["marker"], body: ["pastel"], edge: ["2B", "2B", "cpencil"], fine: ["pen", "cpencil"] },
  { under: ["marker"], body: ["marker"], edge: ["marker", "2B"], fine: ["2B", "pen"] },
  { under: ["charcoal"], body: ["charcoal", "2B"], edge: ["2B"], fine: ["2B", "cpencil"] },
];

// a lattice cell: fixed position + fixed per-stroke randomness
function makeCell(u, v, s, brushName, weight, lenMul, jitterC, gate) {
  return {
    u, v, s, brushName, weight, gate,
    lenF: s * lenMul * random(0.8, 1.25),
    px: random(-s, s) * 0.4, py: random(-s, s) * 0.4,
    bendF: random(-0.28, 0.28),
    cj: [random(-jitterC, jitterC), random(-jitterC, jitterC), random(-jitterC, jitterC)],
    angR: random(-0.35, 0.35),
    ang: null, // smoothed orientation across frames
  };
}

function buildLattice() {
  const iw = img.width, ih = img.height;
  const DET = typeof DETAIL !== "undefined" ? DETAIL : 2;
  const S = STYLES[typeof STYLE !== "undefined" ? STYLE : 0];
  const LO = typeof LOOSE !== "undefined" ? LOOSE : 1;
  const cells = [];

  let s = floor(iw / 20);
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s * 0.5)); u < iw; u += s)
      cells.push(makeCell(u + floor(random(-s, s) * 0.3), v, s,
        S.under[floor(random(S.under.length))], 3.4, 1.5 * LO, 10 * LO, 0));

  s = floor(iw / 40);
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s * 0.5)); u < iw; u += s)
      cells.push(makeCell(u, v, s,
        S.body[floor(random(S.body.length))], 2.1, 1.4 * LO, 8 * LO, 4));

  s = floor(iw / 80);
  const edgeGate = DET >= 3 ? 7 : 11;
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s)); u < iw; u += s)
      cells.push(makeCell(u, v, s,
        S.edge[floor(random(S.edge.length))], 1.2, 1.6 * LO, 5 * LO, edgeGate));

  if (DET >= 2) {
    s = max(3, floor(iw / (DET >= 3 ? 220 : 140)));
    const fineGate = DET >= 3 ? 6 : 12;
    for (let v = s; v < ih; v += s)
      for (let u = floor(random(s)); u < iw; u += s)
        cells.push(makeCell(u, v, s,
          S.fine[floor(random(S.fine.length))], 0.9, 1.2, 3, fineGate));
  }
  return cells;
}

// spawn all-pass strokes for one world tile (T = pass-1 cell size), matching
// the fixed-mode densities: 1 under, 2x2 body, 4x4 edge, 7x7 fine per tile
function spawnTile(tx, ty, T, S, LO, DET) {
  const x0 = tx * T, y0 = ty * T;
  const cellAt = (n, s, brushArr, weight, lenMul, jit, gate, arr) => {
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        arr.push(makeCell(
          x0 + (i + 0.5) * (T / n) + random(-s, s) * 0.3,
          y0 + (j + 0.5) * (T / n) + random(-s, s) * 0.3,
          s, brushArr[floor(random(brushArr.length))], weight, lenMul, jit, gate));
  };
  cellAt(1, T, STYLES[S].under, 3.4, 1.5 * LO, 10 * LO, 0, passQs[0]);
  cellAt(2, T / 2, STYLES[S].body, 2.1, 1.4 * LO, 8 * LO, 4, passQs[1]);
  cellAt(4, T / 4, STYLES[S].edge, 1.2, 1.6 * LO, 5 * LO, DET >= 3 ? 7 : 11, passQs[2]);
  if (DET >= 2) {
    const n = DET >= 3 ? 10 : 7; // 10/tile ~= the stills' 3.4px feature grid
    cellAt(n, T / n, STYLES[S].fine, 0.9, 1.2, 3, DET >= 3 ? 6 : 12, passQs[3]);
  }
}

function drawCell(st, iu = st.u, iv = st.v) {
  // MASKED mode: paint only where the (matted) frame is opaque
  if (typeof MASKED !== "undefined" && MASKED) {
    const ai = 4 * (floor(iv) * img.width + floor(iu)) + 3;
    if ((img.pixels[ai] ?? 0) < 110) return;
  }
  const p = patch(iu, iv, floor(st.s * 0.6));
  const g = grad(iu, iv, st.s);
  // gated passes: skip where this frame has no structure (gate in lum units)
  if (st.gate && g.mag < st.gate) return;
  // orientation: contour direction, eased across frames to avoid flicker
  const target = g.mag > 6 ? atan2(g.gy, g.gx) + HALF_PI : st.angR;
  if (st.ang === null) st.ang = target;
  else {
    let d = target - st.ang;
    while (d > PI) d -= TWO_PI;
    while (d < -PI) d += TWO_PI;
    st.ang += d * 0.35;
  }
  const [x, y] = toCanvas(iu + st.px, iv + st.py);
  const dx = cos(st.ang), dy = sin(st.ang);
  // painter's edge discipline: shorten only the FAT passes near strong edges
  // (keeps background strokes off silhouettes without collapsing coverage)
  const edgeShort = st.gate < 5 ? 1 - 0.35 * min(g.mag, 30) / 30 : 1;
  const L = st.lenF * edgeShort;
  const bend = st.bendF * L;
  // saturation compensation: translucent strokes over the toned ground read
  // chalky, so push sampled colors outward from their luma (SAT dial)
  const SATV = typeof SAT !== "undefined" ? SAT : 1.12;
  const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
  brush.set(st.brushName, rgbHex(
    lum + (p.r - lum) * SATV + st.cj[0],
    lum + (p.g - lum) * SATV + st.cj[1],
    lum + (p.b - lum) * SATV + st.cj[2]
  ), st.weight);
  brush.spline(
    [
      [x - dx * L * fit, y - dy * L * fit],
      [x - dy * bend * fit * 0.4, y + dx * bend * fit * 0.4],
      [x + dx * L * fit, y + dy * L * fit],
    ],
    0.5
  );
}

function toCanvas(u, v) {
  return [ox + u * fit, oy + v * fit];
}

let frameIdx = -1;

// warmup: brush's compositor reaches alpha steady-state one frame in, so the
// harness paints frame 0 once, discards it, and starts capturing from the
// second paint (which is byte-stable thereafter)
window.__paintFrame = async function (uri, warmup = false) {
  img = await loadImage(uri);
  img.loadPixels();
  frameIdx++;
  if (warmup) frameIdx = -1; // don't advance the texture phase
  const world = typeof WORLD !== "undefined" && WORLD;
  const first = !lattice && !passQs;
  if (first) {
    fit = min(W / img.width, H / img.height);
    ox = -img.width * fit / 2;
    oy = -img.height * fit / 2;
    // light toned ground — translucent strokes over a dark ground go muddy
    if (typeof BG !== "undefined") bg = BG;
    else {
      const g = patch(floor(img.width / 2), floor(img.height / 2), floor(img.width / 3));
      bg = rgbHex(g.r * 0.8 + 55, g.g * 0.8 + 53, g.b * 0.8 + 48);
    }
    if (!world) lattice = buildLattice();
    else passQs = [[], [], [], []];
  }
  // freeze brush-internal randomness so stroke texture holds frame to frame;
  // BOIL=n cycles through n texture phases (hand-drawn boil), default frozen
  const phases = typeof BOIL !== "undefined" ? BOIL : 1;
  const reseed = () => {
    const phase = frameIdx % phases;
    window.__reseed(window.__seedBase + 1000 + phase);
    brush.seed("tex-" + phase);      // p5.brush's internal PRNG
    randomSeed(window.__seedBase + phase); // p5's random() — brush draws from it
    noiseSeed(window.__seedBase + phase);  // p5's noise() — fields use it
    brush.refreshField(phase);       // pin the time-dependent wiggle field
  };

  const flush = () =>
    new Promise((r) => { redraw(); requestAnimationFrame(() => requestAnimationFrame(r)); });
  if (!world) {
    reseed();
    background(bg);
    brush.noFill();
    for (const st of lattice) drawCell(st);
    await flush();
    return lattice.length;
  }

  // ---- WORLD mode ----
  const cur = toSmall();
  if (prevSmall) {
    const d = estShift(prevSmall, cur); // scene moved by +d in image space
    off.x += d.x;
    off.y += d.y;
  }
  prevSmall = cur;

  // spawn strokes for world tiles the camera can now see
  const DET = typeof DETAIL !== "undefined" ? DETAIL : 2;
  const S = typeof STYLE !== "undefined" ? STYLE : 0;
  const LO = typeof LOOSE !== "undefined" ? LOOSE : 1;
  const T = floor(img.width / 20);
  const wx0 = floor(-off.x / T) - 1, wx1 = floor((-off.x + img.width) / T) + 1;
  const wy0 = floor(-off.y / T) - 1, wy1 = floor((-off.y + img.height) / T) + 1;
  for (let ty = wy0; ty <= wy1; ty++)
    for (let tx = wx0; tx <= wx1; tx++) {
      const k = tx + "," + ty;
      if (!spawnedTiles.has(k)) {
        spawnedTiles.add(k);
        spawnTile(tx, ty, T, S, LO, DET);
      }
    }

  // draw: world stroke -> current image coords; skip strokes off-frame
  reseed();
  background(bg);
  brush.noFill();
  let drawn = 0;
  const m = T; // margin
  for (const q of passQs)
    for (const st of q) {
      const iu = st.u + off.x, iv = st.v + off.y;
      if (iu < -m || iu > img.width + m || iv < -m || iv > img.height + m) continue;
      drawCell(st, iu, iv);
      drawn++;
    }
  await flush();
  return drawn;
};
