// Reverse painting: repaint an input image (--image path -> IMG_SRC) with
// brushstrokes. Coarse-to-fine passes; strokes are queued, ordered painter-style
// (region by region, flat regions first, detailed regions — the face — last),
// and big strokes animate on tip-to-tail across frames.
//
// DIALS via --inject, e.g. --inject "STYLE=0;DETAIL=3;LOOSE=1":
//   STYLE  0 pastel (default) | 1 gouache | 2 sketch
//   DETAIL 1 painterly | 2 faces resolve | 3 soft features (noses) come through
//   LOOSE  stroke length + color scatter, 0.7 tight .. 1.5 wild
//   COARSE underpainting stroke-size multiplier

let img, fit, ox, oy;

const hex2 = (n) => Math.round(constrain(n, 0, 255)).toString(16).padStart(2, "0");
const rgbHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);

function patch(u, v, s) {
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

function toCanvas(u, v) {
  return [ox + u * fit, oy + v * fit];
}

async function setup() {
  img = await loadImage(IMG_SRC);
  createCanvas(W, H, WEBGL);
  img.loadPixels();
  fit = min(W / img.width, H / img.height);
  ox = -img.width * fit / 2;
  oy = -img.height * fit / 2;
  const g = patch(floor(img.width / 2), floor(img.height / 2), floor(img.width / 3));
  background(rgbHex(g.r * 0.9 + 20, g.g * 0.9 + 20, g.b * 0.9 + 18));
  brush.scaleBrushes(2);
  brush.field("hand");
  brush.wiggle(0.3);
}

const STYLES = [
  { under: ["marker"], body: ["pastel"], edge: ["2B", "2B", "cpencil"], fine: ["pen", "cpencil"] },
  { under: ["marker"], body: ["marker"], edge: ["marker", "2B"], fine: ["2B", "pen"] },
  { under: ["charcoal"], body: ["charcoal", "2B"], edge: ["2B"], fine: ["2B", "cpencil"] },
];
const pickBrush = (arr) => arr[floor(random(arr.length))];

// compute a stroke's geometry + ink without drawing it
function makeStroke(u, v, s, brushName, weight, lenMul, jitterC) {
  const p = patch(u, v, floor(s * 0.6));
  const g = grad(u, v, s);
  const a = g.mag > 6 ? atan2(g.gy, g.gx) + HALF_PI : random(-0.35, 0.35);
  const L = s * lenMul * random(0.8, 1.25);
  const [x, y] = toCanvas(u + random(-s, s) * 0.4, v + random(-s, s) * 0.4);
  const dx = cos(a), dy = sin(a);
  const bend = random(-0.28, 0.28) * L;
  const ink = rgbHex(
    p.r + random(-jitterC, jitterC),
    p.g + random(-jitterC, jitterC),
    p.b + random(-jitterC, jitterC)
  );
  return {
    p0: [x - dx * L * fit, y - dy * L * fit],
    pm: [x - dy * bend * fit * 0.4, y + dx * bend * fit * 0.4],
    p1: [x + dx * L * fit, y + dy * L * fit],
    ink, brushName, weight, u, v, mag: g.mag,
  };
}

// quadratic point along the stroke's arc
function strokePt(st, t) {
  const q = 1 - t;
  return [
    q * q * st.p0[0] + 2 * t * q * st.pm[0] + t * t * st.p1[0],
    q * q * st.p0[1] + 2 * t * q * st.pm[1] + t * t * st.p1[1],
  ];
}

function drawSeg(st, t0, t1) {
  brush.set(st.brushName, st.ink, st.weight);
  brush.spline([strokePt(st, t0), strokePt(st, (t0 + t1) / 2), strokePt(st, t1)], 0.5);
}

// tip-to-tail growth: redraw the stroke from its start out to tEnd. Separate
// spline calls restart the brush's stamp train (beads), so each growth stage
// re-covers the prefix — the small ink build-up reads as natural pressure.
function drawGrow(st, tEnd) {
  brush.set(st.brushName, st.ink, st.weight);
  const pts = [];
  for (let t = 0; t <= tEnd + 0.001; t += tEnd / 4) pts.push(strokePt(st, t));
  brush.spline(pts, 0.5);
}

// painter ordering: bucket strokes into a grid of regions, average the image
// activity per region, paint calm regions first and busy ones (the face) last;
// shuffle within each region so nothing raster-scans.
function painterOrder(strokes, iw, ih) {
  const R = 4;
  const buckets = new Map();
  for (const st of strokes) {
    const k = floor((st.u / iw) * R) + R * floor((st.v / ih) * R);
    if (!buckets.has(k)) buckets.set(k, { sum: 0, list: [] });
    const b = buckets.get(k);
    b.sum += st.mag;
    b.list.push(st);
  }
  const regions = [...buckets.values()];
  for (const b of regions) {
    b.score = b.sum / b.list.length;
    for (let i = b.list.length - 1; i > 0; i--) {
      const j = floor(random(i + 1));
      [b.list[i], b.list[j]] = [b.list[j], b.list[i]];
    }
  }
  regions.sort((a, b) => a.score - b.score);
  return regions.flatMap((b) => b.list);
}

function* paint() {
  brush.noFill();
  const iw = img.width, ih = img.height;
  const DET = typeof DETAIL !== "undefined" ? DETAIL : 1;
  const S = STYLES[typeof STYLE !== "undefined" ? STYLE : 0];
  const LO = typeof LOOSE !== "undefined" ? LOOSE : 1;
  const CO = typeof COARSE !== "undefined" ? COARSE : 1;

  // ---- build the stroke queues ----
  const passes = [];

  // pass 1: underpainting — everything covered
  let s = floor((iw / 22) * CO);
  let q = [];
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s * 0.5)); u < iw; u += s)
      q.push(makeStroke(u + floor(random(-s, s) * 0.3), v, s, pickBrush(S.under), 3.4, 1.5 * LO, 10 * LO));
  passes.push({ q, segs: 4, perFrame: 34 });

  // pass 2: refinement where the image has structure
  s = floor(iw / 46);
  q = [];
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s * 0.5)); u < iw; u += s) {
      const g = grad(u, v, s);
      if (g.mag < 4 && random() < 0.55) continue;
      q.push(makeStroke(u, v, s, pickBrush(S.body), 2.1, 1.4 * LO, 8 * LO));
    }
  passes.push({ q, segs: 3, perFrame: 90 });

  // pass 3: edges
  s = floor(iw / 95);
  q = [];
  for (let v = s; v < ih; v += s)
    for (let u = floor(random(s)); u < iw; u += s) {
      const g = grad(u, v, s * 2);
      if (g.mag < 14 / DET) continue;
      q.push(makeStroke(u, v, s, pickBrush(S.edge), 1.2, 1.6 * LO, 5 * LO));
    }
  passes.push({ q, segs: 1, perFrame: 200 });

  // pass 4 (DETAIL >= 2): fine features — eyes, lips, noses, hair strands.
  // DETAIL=3 tightens the grid and lowers the gate so soft edges register.
  // DETAIL 4-5 keep lowering the gate (soft flats like foreheads get covered)
  // and add a half-cell-offset second lap for double fine coverage.
  if (DET >= 2) {
    s = max(3, floor(iw / (170 + 90 * (DET - 2))));
    const fineGate = DET >= 3 ? max(2.5, 5.5 - (DET - 3) * 1.5) : 9;
    const laps = DET >= 4 ? 2 : 1;
    q = [];
    for (let lap = 0; lap < laps; lap++) {
      const off = floor(lap * s * 0.5);
      for (let v = s + off; v < ih; v += s)
        for (let u = floor(random(s)) + off; u < iw; u += s) {
          const g = grad(u, v, s * 2);
          if (g.mag < fineGate) continue;
          q.push(makeStroke(u, v, s, pickBrush(S.fine), 0.9, 1.2, 3));
        }
    }
    passes.push({ q, segs: 1, perFrame: 420 });
  }

  // ---- subject-first mode (SUBJECT="cx,cy,rx,ry" as image fractions) ----
  // Paint everything inside the subject ellipse through ALL passes first, drop
  // a frame marker, then paint the background — so a camera can hold tight on
  // the subject and pull out as the background arrives.
  let queue = passes;
  if (typeof SUBJECT !== "undefined" && SUBJECT) {
    const [scx, scy, srx, sry] = String(SUBJECT).split(",").map(Number);
    const inside = (st) =>
      sq((st.u / iw - scx) / srx) + sq((st.v / ih - scy) / sry) <= 1;
    const subj = passes.map((p) => ({ ...p, q: p.q.filter(inside) }));
    const bg = passes.map((p) => ({ ...p, q: p.q.filter((st) => !inside(st)) }));
    subj[subj.length - 1].marker = "subject-done";
    queue = [...subj, ...bg];
  }

  // ---- paint: region order, tip-to-tail growth ----
  for (const pass of queue) {
    const ordered = painterOrder(pass.q, iw, ih);
    let emitted = 0;
    if (pass.segs === 1) {
      for (const st of ordered) {
        drawSeg(st, 0, 1);
        if (++emitted % pass.perFrame === 0) yield;
      }
    } else {
      // interleave a small pool of active strokes so several grow at once,
      // each drawn tip-to-tail
      const POOL = 3;
      for (let i = 0; i < ordered.length; i += POOL) {
        const group = ordered.slice(i, i + POOL);
        for (let g = 1; g <= pass.segs; g++) {
          for (const st of group) drawGrow(st, g / pass.segs);
          if (++emitted % ceil(pass.perFrame / POOL) === 0) yield;
        }
      }
    }
    if (pass.marker) (window.__markers ||= {})[pass.marker] = window.__frame;
    yield;
  }
}
