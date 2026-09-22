// One handwritten WORD writing itself on blank paper, for camera-3d-captions sprites. Runs in the p5-paint-animation
// engine: node render-anim.mjs <this> out.mp4 --size WxH --spf N --inject 'HW_WORD="forget";SIZE=300;BRUSH="charcoal";LAPS=3'
// Dials: HW_WORD (never WORD: a p5 global), SIZE (letter cell height, px), BRUSH ("2B" | "charcoal" | "crayon" | "HB" | "marker"), LAPS (strokes
// per letter, re-jittered each lap = scraggly), JIT (lap jitter, fraction of SIZE), PADX (left margin, px).
// Records markers.letters = [{ch, x0, x1}] (advance boundaries, canvas px) and markers.base (baseline y, canvas px);
// the harness saves markers into <out>.track.json. LETTERS / ADV come from the engine's handwriting sketch (prepended).
// Ink is always dark on paper: scripts/hand/build-sprites.py keys it to alpha and recolours it.
const LETTERS_EXTRA = {
  "'": [[[0.36, 0.06], [0.31, 0.26]]],
  "’": [[[0.38, 0.06], [0.36, 0.16], [0.29, 0.28]]],
};
const TXT = typeof HW_WORD !== "undefined" ? HW_WORD : "hello";
const SZ = typeof SIZE !== "undefined" ? SIZE : 200;
const BRX = typeof BRUSH !== "undefined" ? BRUSH : "2B";
const NL = typeof LAPS !== "undefined" ? LAPS : 2;
const JT = typeof JIT !== "undefined" ? JIT : 0.035;
const PX = typeof PADX !== "undefined" ? PADX : Math.round(SZ * 0.3);
const BASE_Y = Math.round(SZ * 1.05);                     // baseline, canvas px from the top (room for ascenders)

function setup() {
  createCanvas(W, H, WEBGL);
  background("#f6f5f0");
  brush.scaleBrushes(Math.max(0.6, SZ / 190));            // stroke weight follows the letter size
  brush.field("hand");
  brush.wiggle(0.5);
  brush.noFill();
}

function* paint() {
  const L = Object.assign({}, LETTERS, LETTERS_EXTRA);
  const letters = [];
  let x = -W / 2 + PX;
  const baseY = -H / 2 + BASE_Y;
  window.__track = [[0, 0]];                              // makes the harness write <out>.track.json (with markers)
  for (const ch of TXT) {
    const glyph = L[ch];
    const adv = SZ * (ADV[ch] ?? (ch === "'" || ch === "’" ? 0.3 : 0.66));
    if (!glyph) { letters.push({ ch, x0: x + W / 2, x1: x + adv + W / 2 }); x += adv; continue; }
    const s = SZ * random(0.96, 1.04), rot = random(-0.03, 0.03) + 0.04, dy = random(-0.03, 0.015) * SZ;
    const place = (jit) => ([px, py]) => {
      const qx = px + random(-jit, jit), qy = py + random(-jit, jit);
      const rx = qx * Math.cos(rot) - (qy - 0.9) * Math.sin(rot);
      const ry = (qy - 0.9) * Math.cos(rot) + qx * Math.sin(rot) + 0.9;
      return [x + rx * s, baseY - s * 0.9 + ry * s + dy];
    };
    for (const strokePts of glyph) {
      for (let lap = 0; lap < NL; lap++) {
        const pts = strokePts.map(place(lap ? JT : JT * 0.4));
        brush.set(BRX, "#1d1d22", lap ? 1.1 : 1.6);
        if (pts.length === 2) brush.line(...pts[0], ...pts[1]); else brush.spline(pts, 0.4);
        yield;
      }
    }
    letters.push({ ch, x0: x + W / 2, x1: x + adv + W / 2 });
    x += adv;
  }
  const mk = (window.__markers ||= {});
  mk.letters = letters; mk.base = BASE_Y; mk.done = window.__frame;
  yield;
}
