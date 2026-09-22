# Recipes

Code the worked film doesn't show: depth-first caption groups, the ring wrapped in front of the speaker, the receding
staircase, and hand-drawn words. Every snippet runs inside the comp script after `C3.init(...)`, with `T =
CAM3D_TABLES`, `FPS = 30`, `DP = 3000` (plate depth), a `fr(t)` onset helper, and `words = {A: [], B: []}` painted by
the shot loop.

## Depth-first caption groups

Give every group its own distance `D0`. Camera moves then pull the layers apart by parallax. `SHADOW` scales with
nearness, so near words also cast bigger, softer shadows.

```js
var SHADOW = [6, 16, 0.5, 1500];                                  // [dy, blur, alpha, reference depth]
function place(shot, parent, cam, spec) {                         // size / rise = on-screen px at the landing camera
  var x = spec.x, cl = cam.at(spec.tland), kl = spec.D0 / (spec.D0 - cl.cz);
  spec.words.forEach(function (w) {
    var ref = C3.unproject(cl, x, spec.y, spec.D0), on = w[1], rise = spec.rise / kl;
    words[shot].push(new C3.Word(parent, { text: w[0], cls: spec.cls, font: spec.font, size: spec.size / kl,
      on: on / FPS, off: spec.off != null ? (spec.off + 6) / FPS : null, D0: spec.D0, opacity: fadeFn(spec.off),
      shadow: spec.shadow === false ? null : SHADOW,
      state: function (ta) { return { x: ref.x, y: ref.y + rise * C3.entry(T.ENTRY, (ta - on / FPS) * 15),
                                      ax: 0, ay: C3.baseOf(spec.font) * spec.size / kl }; } }));
    x += C3.advOf(spec.font, w[0] + ' ') * spec.size;
  });
}
// one clause, three depths: near words bigger, far words smaller and slower
place('A', $('frontA'), camA, { cls: 'cap', font: 'cap', size: 64, x: 1270, y: 650, D0: 1500, tland: 0.9, rise: 30, words: [['I’ve', fr(0.10)], ['learned', fr(0.24)]] });
place('A', $('frontA'), camA, { cls: 'cap', font: 'cap', size: 48, x: 1420, y: 745, D0: 2200, tland: 0.9, rise: 26, words: [['that', fr(0.44)], ['people', fr(0.56)]] });
place('A', $('frontA'), camA, { cls: 'cap', font: 'cap', size: 70, x: 1470, y: 905, D0: 1250, tland: 1.45, rise: 34, words: [['what', fr(1.18)], ['you', fr(1.30)], ['said', fr(1.44)]] });
```

Hero words behind the speaker use `D0: DP` and `shadow: false`.

Depth of field: ring glyphs take the full DOF. Flat captions cap at 1.2 px, so they read as depth and stay legible:

```js
function dofWord(word, c, tp) { var d = dofAt((word.zNow != null ? word.zNow : word.o.D0) - c.cz, tp); return word.o.pieces ? d : Math.min(d, 1.2); }
```

## Ring wrapped in front of the speaker (turning)

A horizontal circle round the speaker, centred IN FRONT of them, so its back arc is still nearer than the plate. It is
seen from 11–16° above. Words appear small at the speaker's side as they are spoken, swing round the front at about
twice the side size, and the sentence settles centred.

```js
var RZ = 2000, RR = 760, REL = 0.28, RCX = 900, RCY = 480;       // type; hand-drawn: RR 900, REL 0.20
var R1 = new C3.Ring3D({ X: (RCX - C3.W / 2) * RZ / C3.F, Y: (RCY - C3.H / 2) * RZ / C3.F, Z: RZ, R: RR,
                         rx: -(Math.PI / 2 - REL), ry: 0, rz: 0, Zf: RZ - RR * Math.cos(REL) });   // front arc = nominal size
var FRONT = R1.sOf(Math.PI), T0 = 3.2, T1 = 4.45, THETA = 1.15 * R1.L / (2 * Math.PI);
function turn(t) { var u = C3.clamp((t - T0) / (T1 - T0), 0, 1); return -THETA * (1 - C3.PROF.swing(u)) + 26 * Math.max(0, t - T1); }
var fade = function (q) {                                         // visible within 55 deg of the front, gone by 82
  var c = (RZ - q.z) / (RR * Math.cos(REL)), a = C3.clamp((c - Math.cos(1.431)) / (Math.cos(0.960) - Math.cos(1.431)), 0, 1);
  return { s: 1, hid: a <= 0.001, a: a };
};
var sent = [['but', 'ring', 104, fr(3.40)], ['they’ll', 'ring', 104, fr(3.52)], ['never', 'ring', 104, fr(3.70)], ['forget', 'hero', 150, fr(4.09)]];
var spec = sent.map(function (w) { return { text: w[0], font: w[1], size: w[2], flip: true, lift: 0.81 }; }), cache = {};
var lineAt = function (ta) {                                      // re-laid ON SCREEN every pose: spacing stays even while turning
  var k = ta.toFixed(5); return cache[k] || (cache[k] = C3.ringLine(R1, spec, { centre: FRONT + turn(ta), dir: -1, gap: 30 }));
};
sent.forEach(function (w, i) {
  var layAt = function (ta) { var l = lineAt(ta)[i]; return C3.ringLayout(R1, w[0], w[1], w[2], l.th, 0.81, true, fade, { rel: l.rel }); };
  var lay0 = layAt(T1);
  words.B.push(new C3.Word($('frontB'), { pieces: lay0.chars, cls: 'ring', font: w[1], size: w[2], on: w[3] / FPS,
    D0: C3.meanZ(lay0.pose(0)), shutter: 0.5, shadow: SHADOW, state: function (ta) { return layAt(ta).pose(0); } }));
});
```

Rack focus to the ring's front depth while it turns, then to the speaker as the push starts.

## Receding staircase

Each word of the finale caption sits deeper and smaller along a descending diagonal. The push-in drives the near words
apart. Leave ~64 px between words: before landing, the near words sit closer to the frame centre than their neighbours.

```js
var stair = [['how', 84, 1500, fr(4.46)], ['you', 72, 1800, fr(4.64)], ['made', 63, 2100, fr(4.76)], ['them', 56, 2400, fr(4.94)]];
var x = 170, y = 190;
stair.forEach(function (w) {
  place('B', $('frontB'), camB, { cls: 'cap', font: 'cap', size: w[1], x: x, y: y, D0: w[2], tland: 5.35, rise: 30, words: [[w[0], w[3]]] });
  x += C3.advOf('cap', w[0] + ' ') * w[1] + 64; y += 44;
});
```

## Hand-drawn words (p5.brush write-on sprites)

1. List every word with its brush and colour in `words.json`. Run
   `python3 scripts/hand/build-sprites.py words.json assets/hand --engine <p5-paint-animation>/scripts`.
   - Output: `sprites.js` plus one PNG sheet per word.
   - Size sprites at their on-screen size (`size` = letter cell height, px).
   - Look used: captions `2B`, 2 laps, white. Heroes `charcoal`, 3 laps, jit 0.05, red. Ring `crayon`, green.
2. Build the metrics from the sprites, so `ringLine` spaces words by the pen's own advances:

```js
var MET = { adv: {}, base: {} };
Object.keys(HAND).forEach(function (id) { var m = HAND[id], a = {}; m.letters.forEach(function (l) { a[l.ch] = (l.x1 - l.x0) / m.sz; }); MET.adv[id] = a; MET.base[id] = m.oy / m.sz; });
C3.init(MET, { W: 1920, H: 1080 });
function spr(id) { var m = HAND[id]; return Object.assign({ url: 'assets/hand/' + m.src }, m); }
function advPx(id) { var m = HAND[id]; return m.letters[m.letters.length - 1].x1 - m.ox; }
```

3. A flat sprite word is a `Word` with `sprite`. Its state returns the sprite scale `s` and the baseline-left anchor. It
   writes itself on from its onset on the 15-fps grid:

```js
new C3.Word(parent, { sprite: spr(id), on: on / FPS, D0: D0, shadow: SHADOW,
  state: function (ta) { return { x: ref.x, y: ref.y + rise * C3.entry(T.ENTRY, (ta - on / FPS) * 15), s: scale / kl, ax: m.ox, ay: m.oy }; } });
```

4. On a ring, place each handwritten word WHOLE, rotated to the tangent and scaled by depth. Handwriting doesn't need
   per-glyph bending.
   - Use `ringLine` with the sprite ids as fonts, `track: 1.0` (the pen advances carry the letter spacing) and
     `gap: 28` (one word space).
   - Pose per word: `{x: q.x, y: q.y, r: q.r + Math.PI, s: q.k0 * scale, ax: m.ox + advPx(id) / 2, ay: m.oy - 0.62 * m.sz,
     a: fadeAlpha(q.z)}`, where `q = R1.at(line[i].sc)`.
   - Handwriting runs longer than type, so use a bigger, flatter ring (R 900, tilt 11°). Otherwise the end words tip
     toward vertical.
