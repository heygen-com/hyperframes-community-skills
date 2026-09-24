// props.js: the room's decorations, a library of props that each fit one slot. story.json's "room" picks a prop for
// each slot, from what the agent knows about its user. Add your own with PROPS['name'] = { slot, draw(b, env) } in
// scenes/props-custom.js (see references/room.md). b is the slot's box or anchor; env = { tod, night, t, fx }.
//
// Slots (screen space, 1920×1080, Claude at the desk centre):
//   sill   anchor { x, y } = the jar/pot base on the window sill, ≤ 80 wide, ≤ 190 tall above it
//   wallA  box 250 × 170 between the window and the monitor (boards, posters)
//   wallB  box 200 × 150 above the monitor (a framed print)
//   wallC  box 170 × 170 on the right wall, under the shelf (a square frame, a clock)
//   shelf  up to three items standing on the shelf board (anchors: bottom-left of each spot, ≤ 70 wide, ≤ 95 tall)
//   hook   anchor under the shelf: something hanging (it swings when Claude gets bonked)
//   floor  anchor left of the desk: something tall standing on the floor (≤ 650 tall)
//   desk   anchor on the desk, left of the keyboard: drawn BEHIND Claude (≤ 110 wide, ≤ 200 tall)
// Keep the lane above the right half of the desk (x 1000–1600, y 360–460) clear: the mallet's handle swings through it.
const SLOTS = {
  sill: { x: 560, y: 560 }, wallA: { x: 690, y: 222, w: 250, h: 170 }, wallB: { x: 1150, y: 212, w: 200, h: 150 },
  wallC: { x: 1500, y: 500, w: 170, h: 170 }, shelf: [{ x: 1470, y: 330 }, { x: 1545, y: 330 }, { x: 1620, y: 330 }],
  hook: { x: 1470, y: 350 }, floor: { x: 392, y: 902 }, desk: { x: 681, y: 744 },
};
const PROPS = {};
const frameBox = (x, y, w, h, wood) => { paint(rectPts(x, y, w, h, 1.5), { wash: wood, ink: PAL.ink, sw: .8 }); };
const colOf = c => (c && PAL[c]) || c;

// ---------- sill ----------
PROPS.roses = { slot: 'sill', draw(b) {   // roses in a jar
  const { x, y } = b, glass = mixCol(PAL.sky, PAL.cream, .45);
  for (const [dx, h, a] of [[-10, 96, -.28], [4, 118, .06], [16, 90, .34]]) {
    const tip = [x + dx + Math.sin(a) * h, y - 58 - Math.cos(a) * h];
    inkLine([[x + dx * .4, y - 20], [x + dx + Math.sin(a) * h * .5, y - 58 - Math.cos(a) * h * .55], tip], 1.3, mixCol(PAL.sap, PAL.ink, .3), 'ink', .4);
    paint(ellPts(x + dx + Math.sin(a) * h * .45 + 9, y - 58 - Math.cos(a) * h * .45, 10, 5, 10, 0, -.6), { wash: PAL.sap, ink: PAL.ink, sw: .4 });
    paint(ellPts(tip[0], tip[1], 17, 15, 14, 1.2), { wash: mixCol(PAL.rose, '#C8332B', .5), ink: PAL.ink, sw: .6 });
    inkLine([[tip[0] - 7, tip[1] + 2], [tip[0], tip[1] - 6], [tip[0] + 7, tip[1]], [tip[0] + 1, tip[1] + 5]], .5, mixCol(PAL.ink, '#C8332B', .5), 'inkfine', .6);
  }
  paint([[x - 30, y - 70], [x + 30, y - 70], [x + 34, y], [x - 34, y]], { wash: glass, washOp: 210, ink: PAL.ink, sw: .7 });
  paint(rectPts(x - 26, y - 40, 52, 36), { fill: mixCol(PAL.sky, PAL.teal, .3), fillOp: 90, bleed: .02, tex: .4, ink: null });
} };
PROPS.succulent = { slot: 'sill', draw(b) {   // a succulent in a terracotta pot
  const { x, y } = b, pot = mixCol(PAL.clay, PAL.cream, .15);
  for (const [a, r] of [[-1.1, 34], [-.55, 44], [0, 48], [.55, 44], [1.1, 34], [-.3, 30], [.3, 30]])
    paint(ellPts(x + Math.sin(a) * r * .55, y - 62 - Math.cos(a) * r * .5, 11, 24, 12, .8, a), { wash: mixCol(PAL.sap, PAL.teal, .3 + .2 * Math.abs(a)), ink: PAL.ink, sw: .5 });
  paint([[x - 32, y - 58], [x + 32, y - 58], [x + 25, y], [x - 25, y]], { wash: pot, ink: PAL.ink, sw: .7 });
  paint(rectPts(x - 35, y - 64, 70, 12, 1), { wash: mixCol(pot, PAL.ink, .15), ink: PAL.ink, sw: .6 });
} };
PROPS['cat-sill'] = { slot: 'sill', draw(b) {   // a cat sitting on the sill, looking out
  const { x, y } = b, fur = mixCol(PAL.ink, PAL.paper, .25);
  paint(ellPts(x, y - 34, 30, 36, 18, 1), { wash: fur, ink: PAL.ink, sw: .6 });
  paint(ellPts(x - 6, y - 82, 20, 18, 16, 1), { wash: fur, ink: PAL.ink, sw: .6 });
  for (const s of [-1, 1]) paint([[x - 6 + s * 8, y - 96], [x - 6 + s * 17, y - 112], [x - 6 + s * 19, y - 90]], { wash: fur, ink: PAL.ink, sw: .5 });
  inkLine([[x + 24, y - 6], [x + 50, y - 10], [x + 58, y - 36]], 3, fur, 'ink', .6);
} };

// ---------- wallA ----------
// a corkboard of pinned cards. o.cards: up to 3 of { kind: 'landscape' | 'blob' | 'gradient' | 'word', a, b, word }
PROPS.corkboard = { slot: 'wallA', draw(b, env, o = {}) {
  const { x, y, w, h } = b;
  paint(rectPts(x - 10, y - 10, w + 20, h + 20, 1.5), { wash: mixCol(PAL.clayDk, PAL.ink, .3), ink: PAL.ink, sw: .8 });
  paint(rectPts(x, y, w, h), { wash: mixCol(PAL.ochre, PAL.clayDk, .35), ink: null });
  for (let i = 0; i < 30; i++) paint(ellPts(x + 8 + hash(i + 70) * (w - 16), y + 8 + hash(i + 71) * (h - 16), 2, 2, 6), { wash: mixCol(PAL.clayDk, PAL.ink, .2), ink: null });
  const cards = (o.cards || [{ kind: 'landscape' }, { kind: 'blob' }, { kind: 'gradient' }]).slice(0, 3);
  const spots = [[58, 50, -.08, PAL.rose], [176, 58, .1, PAL.teal], [118, 124, .04, PAL.ochre]];
  cards.forEach((c, i) => {
    const [dx, dy, rot, pin] = spots[i], cx = x + dx, cy = y + dy;
    boilSeed('card' + i);
    push(); translate(cx, cy); rotate(rot);
    paint(rectPts(-44, -32, 88, 64, .8), { wash: PAL.cream, ink: PAL.ink, sw: .5 });
    if (c.kind === 'landscape') { paint(rectPts(-38, -26, 76, 36), { wash: colOf(c.a) || PAL.sky, ink: null });
      paint([[-38, 26], [-38, 4], [0, -2], [38, 6], [38, 26]], { wash: colOf(c.b) || PAL.sap, ink: null }); paint(rectPts(-6, -8, 16, 10), { wash: PAL.clay, ink: PAL.ink, sw: .3 }); }
    else if (c.kind === 'blob') { paint(rectPts(-38, -26, 76, 52), { wash: mixCol(PAL.cream, colOf(c.b) || PAL.sky, .3), ink: null });
      paint(ellPts(0, 2, 26, 17, 18, 1.5), { wash: colOf(c.a) || '#8FA3FF', ink: PAL.ink, sw: .4 }); inkLine([[-10, -4], [-4, 1], [-10, 6]], .6, PAL.cream, 'inkfine', 0); }
    else if (c.kind === 'gradient') { for (let k = 0; k < 6; k++) paint(rectPts(-38 + k * 12.7, -26, 13.2, 52), { wash: mixCol(colOf(c.a) || '#F2A283', colOf(c.b) || '#7B5CA8', k / 5), ink: null }); }
    pop();
    if (c.kind === 'word') letter(String(c.word || '').slice(0, 8), cx, cy + 2, 20, colOf(c.a) || PAL.ink, { rot, font: `20px ${HAND}`, ink: false });
    paint(ellPts(cx + Math.sin(rot) * 30, cy - 30, 5, 5, 10), { wash: pin, ink: PAL.ink, sw: .4 });
  });
} };
// a poster with a hand-lettered word. o: { word (≤ 10 chars), a (ground), b (ink) }
PROPS.poster = { slot: 'wallA', draw(b, env, o = {}) {
  const { x, y, w, h } = b, ground = colOf(o.a) || PAL.teal, ink = colOf(o.b) || PAL.cream;
  paint(rectPts(x + 30, y - 6, w - 60, h + 12, 1.2), { wash: ground, ink: PAL.ink, sw: .8 });
  paint(ellPts(x + w / 2, y + h * .38, 46, 46, 22, 1), { wash: mixCol(ground, ink, .35), ink: null });
  for (const px of [x + 38, x + w - 38]) paint(ellPts(px, y + 2, 4, 4, 8), { wash: PAL.ink, ink: null });
  const word = String(o.word || '').slice(0, 10), size = Math.min(38, 170 / Math.max(3, word.length) * 1.6);
  if (word) letter(word, x + w / 2, y + h * .8, size, ink, { font: `${size}px ${HAND}`, ink: false });
} };

// ---------- wallB ----------
PROPS['curve-print'] = { slot: 'wallB', draw(b) {   // an animation curve, framed: an ease with its two handles
  const { x, y, w, h } = b;
  frameBox(x - 12, y - 12, w + 24, h + 24, mixCol(PAL.ink, PAL.paper, .25));
  paint(rectPts(x, y, w, h), { wash: PAL.cream, ink: null });
  for (let i = 1; i < 5; i++) { inkLine([[x + i * w / 5, y + 8], [x + i * w / 5, y + h - 8]], .3, mixCol(PAL.cream, PAL.ink, .2), 'inkfine', 0); inkLine([[x + 8, y + i * h / 5], [x + w - 8, y + i * h / 5]], .3, mixCol(PAL.cream, PAL.ink, .2), 'inkfine', 0); }
  const p0 = [x + 20, y + h - 20], p1 = [x + w - 20, y + 20], c0 = [x + w * .62, y + h - 20], c1 = [x + w * .38, y + 20];
  const B = []; for (let k = 0; k <= 20; k++) { const q = k / 20, a = (1 - q) ** 3, bb = 3 * (1 - q) ** 2 * q, c = 3 * (1 - q) * q * q, d = q ** 3; B.push([a * p0[0] + bb * c0[0] + c * c1[0] + d * p1[0], a * p0[1] + bb * c0[1] + c * c1[1] + d * p1[1]]); }
  inkLine(B, 2.2, PAL.clay, 'ink', .3);
  for (const [p, c] of [[p0, c0], [p1, c1]]) { inkLine([p, c], .6, PAL.ink, 'inkfine', 0); paint(ellPts(...c, 5, 5, 10), { wash: PAL.cream, ink: PAL.ink, sw: .5 }); }
} };
// a framed painting. o.scene: 'mountains' | 'sea' | 'city'
PROPS.painting = { slot: 'wallB', draw(b, env, o = {}) {
  const { x, y, w, h } = b, scene = o.scene || 'mountains';
  frameBox(x - 12, y - 12, w + 24, h + 24, mixCol(PAL.ochre, PAL.clayDk, .45));
  paint(rectPts(x, y, w, h), { wash: scene === 'city' ? mixCol(PAL.rose, PAL.ochre, .4) : mixCol(PAL.sky, PAL.cream, .3), ink: null });
  if (scene === 'mountains') { paint([[x, y + h], [x + w * .3, y + h * .3], [x + w * .5, y + h * .6], [x + w * .72, y + h * .2], [x + w, y + h * .7], [x + w, y + h]], { wash: mixCol(PAL.indigo, PAL.sky, .45), ink: null });
    paint([[x + w * .64, y + h * .32], [x + w * .72, y + h * .2], [x + w * .8, y + h * .34]], { wash: PAL.cream, ink: null }); }
  if (scene === 'sea') { paint(rectPts(x, y + h * .55, w, h * .45), { wash: mixCol(PAL.teal, PAL.indigo, .3), ink: null });
    for (let i = 0; i < 4; i++) inkLine([[x + 16 + i * 44, y + h * .7 + (i % 2) * 14], [x + 36 + i * 44, y + h * .66 + (i % 2) * 14], [x + 56 + i * 44, y + h * .7 + (i % 2) * 14]], .6, PAL.cream, 'inkfine', .5);
    paint(ellPts(x + w * .74, y + h * .3, 16, 16, 14), { wash: PAL.ochre, ink: null }); }
  if (scene === 'city') { paint(ellPts(x + w * .78, y + h * .26, 15, 15, 14), { wash: PAL.cream, ink: null });
    for (let i = 0; i < 7; i++) { const bw = (w - 16) / 7 - 4, bh = h * (.3 + .5 * hash(i + 3)), bx = x + 8 + i * (w - 16) / 7, by = y + h - bh;
      paint(rectPts(bx, by, bw, bh), { wash: mixCol(PAL.indigo, PAL.ink, .3 * hash(i)), ink: null });
      for (let r = 0; r < Math.floor(bh / 14) - 1; r++) for (const c of [.28, .68]) if (hash(i * 13 + r * 3 + c * 10) > .35)
        paint(rectPts(bx + bw * c - 2, by + 8 + r * 14, 4, 5), { wash: PAL.ochre, ink: null }); } }
} };

// ---------- wallC ----------
PROPS.record = { slot: 'wallC', draw(b, env) {   // a framed record
  const { x, y, w } = b, s = w, cx = x + s / 2, cy = y + s / 2;
  frameBox(x - 12, y - 12, s + 24, s + 24, mixCol(PAL.clayDk, PAL.ink, .4));
  paint(rectPts(x, y, s, s), { wash: mixCol(PAL.cream, PAL.rose, .2), ink: null });
  paint(ellPts(cx, cy, 70, 70, 30, 1), { wash: mixCol(PAL.ink, PAL.indigo, .2 + .2 * env.night), ink: PAL.ink, sw: .6 });
  for (const r of [58, 46, 34]) paint(ellPts(cx, cy, r, r, 24), { ink: mixCol(PAL.ink, PAL.paper, .35), sw: .3 });
  paint(ellPts(cx, cy, 20, 20, 16), { wash: PAL.rose, ink: null });
  paint(ellPts(cx, cy, 3, 3, 8), { wash: PAL.ink, ink: null });
} };
PROPS.clock = { slot: 'wallC', draw(b, env) {   // a wall clock: the session's real time when the beats have times
  const { x, y, w } = b, cx = x + w / 2, cy = y + w / 2, r = w * .42, hr = env.hour != null ? env.hour : 8 + env.tod * 14;
  paint(ellPts(cx, cy, r + 10, r + 10, 30, 1), { wash: mixCol(PAL.teal, PAL.ink, .3), ink: PAL.ink, sw: .8 });
  paint(ellPts(cx, cy, r, r, 30, .5), { wash: PAL.cream, ink: PAL.ink, sw: .5 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; inkLine([[cx + Math.sin(a) * r * .8, cy - Math.cos(a) * r * .8], [cx + Math.sin(a) * r * .92, cy - Math.cos(a) * r * .92]], .8, PAL.ink, 'inkfine', 0); }
  const ah = (hr % 12) / 12 * TAU, am = (hr % 1) * TAU;
  inkLine([[cx, cy], [cx + Math.sin(ah) * r * .5, cy - Math.cos(ah) * r * .5]], 2.4, PAL.ink, 'ink', 0);
  inkLine([[cx, cy], [cx + Math.sin(am) * r * .78, cy - Math.cos(am) * r * .78]], 1.4, PAL.ink, 'ink', 0);
} };

// ---------- shelf items (b = bottom-left of the spot on the board) ----------
PROPS.clapperboard = { slot: 'shelf', draw(b) {
  const x = b.x, y = b.y;
  paint(rectPts(x, y - 62, 66, 62, 1), { wash: mixCol(PAL.ink, PAL.paper, .15), ink: PAL.ink, sw: .6 });
  paint([[x - 4, y - 78], [x + 62, y - 94], [x + 66, y - 78], [x, y - 62]], { wash: mixCol(PAL.ink, PAL.paper, .15), ink: PAL.ink, sw: .6 });
  for (let i = 0; i < 4; i++) paint([[x + 4 + i * 16, y - 80 - i * 4], [x + 12 + i * 16, y - 82 - i * 4], [x + 16 + i * 16, y - 66 - i * 4], [x + 8 + i * 16, y - 64 - i * 4]], { wash: PAL.cream, ink: null });
} };
PROPS.books = { slot: 'shelf', draw(b, env, o = {}) {   // o.colors: three PAL names or hexes
  (o.colors || ['violet', 'teal', 'ochre']).slice(0, 3).forEach((c, i) => {
    boilSeed('book' + i); const h = 66 + 16 * hash(i + 30);
    paint(rectPts(b.x + i * 22, b.y - h, 22, h, 1), { wash: mixCol(colOf(c), PAL.indigo, .25 * env.night), ink: PAL.ink, sw: .6 });
  });
} };
PROPS.dachshund = { slot: 'shelf', draw(b) {   // a little dachshund figure
  const dx = b.x, dy = b.y - 12, fur = mixCol(PAL.clayDk, PAL.ochre, .25);
  for (const lx of [4, 12, 38, 46]) paint(rectPts(dx + lx, dy, 5, 12), { wash: mixCol(fur, PAL.ink, .3), ink: null });
  paint(rrPts(dx, dy - 16, 56, 20, 9), { wash: fur, ink: PAL.ink, sw: .6 });
  paint(ribbon([[dx + 1, dy - 10], [dx - 8, dy - 18]], 4, 1.5), { wash: fur, ink: PAL.ink, sw: .4 });
  paint(ellPts(dx + 60, dy - 20, 12, 10, 12, 0, -.2), { wash: fur, ink: PAL.ink, sw: .6 });
  paint(ellPts(dx + 72, dy - 16, 7, 5, 10), { wash: fur, ink: PAL.ink, sw: .5 });
  paint(ellPts(dx + 56, dy - 14, 5, 9, 10, 0, .3), { wash: mixCol(fur, PAL.ink, .35), ink: null });
  paint(ellPts(dx + 64, dy - 23, 2, 2, 6), { wash: PAL.ink, ink: null });
} };
PROPS.cat = { slot: 'shelf', draw(b, env, o = {}) {   // a sleeping cat curled on the shelf. o.color
  const x = b.x + 34, y = b.y, fur = colOf(o.color) || mixCol(PAL.ochre, PAL.cream, .3);
  paint(ellPts(x, y - 18, 34, 18, 20, 1), { wash: fur, ink: PAL.ink, sw: .6 });
  paint(ellPts(x + 24, y - 24, 14, 12, 14, 1), { wash: fur, ink: PAL.ink, sw: .6 });
  for (const s of [-1, 1]) paint([[x + 24 + s * 6, y - 32], [x + 24 + s * 11, y - 44], [x + 24 + s * 13, y - 30]], { wash: fur, ink: PAL.ink, sw: .4 });
  inkLine([[x - 32, y - 10], [x - 10, y - 2], [x + 14, y - 4]], 3, mixCol(fur, PAL.ink, .2), 'ink', .5);
  inkLine([[x + 19, y - 24], [x + 23, y - 22]], .6, PAL.ink, 'inkfine', 0); inkLine([[x + 27, y - 24], [x + 31, y - 22]], .6, PAL.ink, 'inkfine', 0);
} };
PROPS.trophy = { slot: 'shelf', draw(b) {
  const x = b.x + 32, y = b.y, gold = mixCol(PAL.ochre, PAL.cream, .2);
  paint(rectPts(x - 20, y - 14, 40, 14, 1), { wash: mixCol(PAL.ink, PAL.paper, .3), ink: PAL.ink, sw: .5 });
  paint(rectPts(x - 5, y - 34, 10, 20, 1), { wash: gold, ink: PAL.ink, sw: .5 });
  paint([[x - 24, y - 82], [x + 24, y - 82], [x + 16, y - 46], [x, y - 36], [x - 16, y - 46]], { wash: gold, ink: PAL.ink, sw: .6 });
  for (const s of [-1, 1]) inkLine([[x + s * 22, y - 76], [x + s * 34, y - 70], [x + s * 18, y - 54]], 1.2, mixCol(gold, PAL.ink, .3), 'ink', .6);
} };
PROPS.camera = { slot: 'shelf', draw(b) {
  const x = b.x, y = b.y, body = mixCol(PAL.ink, PAL.paper, .2);
  paint(rrPts(x, y - 44, 66, 44, 6), { wash: body, ink: PAL.ink, sw: .6 });
  paint(rectPts(x + 8, y - 52, 18, 8, 1), { wash: body, ink: PAL.ink, sw: .5 });
  paint(ellPts(x + 34, y - 22, 15, 15, 18, 1), { wash: mixCol(PAL.indigo, PAL.ink, .3), ink: PAL.ink, sw: .6 });
  paint(ellPts(x + 30, y - 26, 4, 4, 8), { wash: PAL.cream, ink: null });
} };
PROPS['plant-small'] = { slot: 'shelf', draw(b) {
  const x = b.x + 30, y = b.y;
  for (const a of [-.9, -.4, .1, .6, 1.0]) paint(ribbon([[x, y - 34], [x + Math.sin(a) * 26, y - 34 - Math.cos(a) * 24], [x + Math.sin(a) * 40, y - 30 - Math.cos(a) * 44]], 5, 1), { wash: PAL.sap, ink: PAL.ink, sw: .4 });
  paint([[x - 20, y - 36], [x + 20, y - 36], [x + 15, y], [x - 15, y]], { wash: PAL.cream, ink: PAL.ink, sw: .6 });
} };

// ---------- hook ----------
PROPS.headphones = { slot: 'hook', draw(b, env) {   // headphones on a hook: a hit sets them swinging
  const { x, y } = b, band = mixCol(PAL.ink, PAL.paper, .2);
  push(); translate(x, y); rotate(env.fx.phones || 0); translate(-x, -y);
  inkLine([[x - 8, y - 2], [x - 8, y + 10], [x + 8, y + 10], [x + 8, y - 2]], 1.4, mixCol(PAL.ink, PAL.paper, .35), 'inkfine', 0);
  inkLine([[x - 34, y + 90], [x - 30, y + 38], [x, y + 12], [x + 30, y + 36], [x + 34, y + 86]], 3.4, band, 'ink', .7);
  for (const [cx, cy] of [[x - 34, y + 102], [x + 34, y + 98]]) {
    paint(rrPts(cx - 16, cy - 26, 32, 52, 13), { wash: PAL.violet, ink: PAL.ink, sw: .7 });
    paint(rrPts(cx - 9, cy - 18, 18, 36, 8), { wash: mixCol(PAL.violet, PAL.ink, .35), ink: null });
  }
  pop();
} };
PROPS.tote = { slot: 'hook', draw(b, env, o = {}) {   // a canvas tote bag. o.color
  const { x, y } = b, cloth = colOf(o.color) || mixCol(PAL.cream, PAL.ochre, .2);
  push(); translate(x, y); rotate((env.fx.phones || 0) * .6); translate(-x, -y);
  inkLine([[x - 8, y - 2], [x - 8, y + 10], [x + 8, y + 10], [x + 8, y - 2]], 1.4, mixCol(PAL.ink, PAL.paper, .35), 'inkfine', 0);
  inkLine([[x - 26, y + 60], [x - 10, y + 12], [x, y + 8], [x + 10, y + 12], [x + 26, y + 60]], 2.4, cloth, 'ink', .5);
  paint([[x - 40, y + 56], [x + 40, y + 56], [x + 44, y + 140], [x - 44, y + 140]], { wash: cloth, ink: PAL.ink, sw: .7 });
  pop();
} };

// ---------- floor ----------
PROPS.guitar = { slot: 'floor', draw(b, env, o = {}) {   // an electric guitar on a stand. o.color
  push(); translate(b.x, b.y); rotate(-.15);
  const red = colOf(o.color) || mixCol(PAL.rose, '#C8332B', .45), neck = mixCol(PAL.ochre, PAL.clayDk, .35);
  inkLine([[-60, 0], [0, -120], [60, 0]], 2.4, mixCol(PAL.ink, PAL.paper, .25), 'ink', 0);
  paint(rectPts(-10, -560, 20, 390, 1), { wash: neck, ink: PAL.ink, sw: .6 });
  for (let i = 0; i < 9; i++) inkLine([[-10, -540 + i * 40], [10, -540 + i * 40]], .5, mixCol(neck, PAL.ink, .5), 'inkfine', 0);
  paint([[-13, -560], [13, -560], [22, -620], [-2, -640], [-16, -615]], { wash: mixCol(PAL.cream, PAL.ochre, .2), ink: PAL.ink, sw: .6 });
  const body = [[-18, -178], [-34, -214], [-52, -222], [-62, -202], [-54, -168], [-74, -146], [-82, -104], [-74, -56], [-54, -22], [-22, -4], [14, -2], [48, -14], [72, -44], [80, -86], [70, -124], [52, -150], [60, -188], [52, -212], [36, -216], [20, -196]];
  paint(through(body, 5), { wash: red, ink: PAL.ink, sw: .9 });
  paint(through([[-16, -176], [30, -170], [46, -128], [40, -60], [0, -40], [-44, -62], [-52, -120], [-40, -160]], 5), { wash: PAL.cream, ink: PAL.ink, sw: .4 });
  for (const yy of [-150, -118, -86]) paint(rrPts(-20, yy, 40, 12, 3), { wash: mixCol(PAL.ink, PAL.paper, .25), ink: null });
  paint(rectPts(-24, -58, 48, 10, 1), { wash: mixCol(PAL.ink, PAL.paper, .45), ink: null });
  for (const [kx, ky] of [[36, -70], [50, -48], [22, -34]]) paint(ellPts(kx, ky, 6, 6, 10), { wash: mixCol(PAL.cream, PAL.ochre, .3), ink: PAL.ink, sw: .4 });
  for (let i = 0; i < 4; i++) inkLine([[-5 + i * 3.4, -555], [-5 + i * 3.4, -56]], .3, PAL.cream, 'inkfine', 0);
  pop();
} };
PROPS['floor-plant'] = { slot: 'floor', draw(b) {   // a big leafy plant in a pot
  const x = b.x, y = b.y;
  for (const [a, h, w] of [[-.9, 210, 34], [-.45, 280, 40], [0, 300, 42], [.4, 260, 38], [.85, 200, 32]]) {
    const tip = [x + Math.sin(a) * h, y - 100 - Math.cos(a) * h];
    paint(ribbon([[x, y - 100], [x + Math.sin(a) * h * .5, y - 100 - Math.cos(a) * h * .55], tip], 6, 2), { wash: mixCol(PAL.sap, PAL.ink, .15), ink: null });
    paint(ellPts(tip[0], tip[1], w, w * .6, 16, 1, a - Math.PI / 2), { wash: PAL.sap, ink: PAL.ink, sw: .6 });
  }
  paint([[x - 60, y], [x + 60, y], [x + 45, y - 100], [x - 45, y - 100]], { wash: mixCol(PAL.clay, PAL.cream, .2), ink: PAL.ink, sw: .8 });
} };

// ---------- desk (behind Claude) ----------
PROPS.mic = { slot: 'desk', draw(b) {   // a dictation mic on a boom arm
  const x = b.x, y = b.y, iron = mixCol(PAL.ink, PAL.paper, .25);
  paint(rectPts(x - 17, y - 18, 34, 18, 1), { wash: iron, ink: PAL.ink, sw: .5 });
  inkLine([[x, y - 16], [x - 23, y - 144], [x + 28, y - 206]], 3.2, iron, 'ink', .2);   // the head clear of the agent's shoulder
  inkLine([[x + 28, y - 206], [x + 50, y - 180]], 2.6, iron, 'ink', 0);
  push(); translate(x + 55, y - 158); rotate(.45);
  paint(rrPts(-15, -36, 30, 64, 14), { wash: mixCol(PAL.ink, PAL.paper, .15), ink: PAL.ink, sw: .7 });
  for (let i = 0; i < 4; i++) inkLine([[-11, -26 + i * 9], [11, -26 + i * 9]], .4, mixCol(PAL.ink, PAL.paper, .5), 'inkfine', 0);
  pop();
} };
PROPS['pencil-cup'] = { slot: 'desk', draw(b) {
  const x = b.x, y = b.y;
  [[-10, 'rose', -.2], [0, 'ochre', .05], [10, 'teal', .25]].forEach(([dx, c, a]) =>
    paint(rectPts(x + dx - 3 + Math.sin(a) * 40, y - 104, 6, 70, .5), { wash: PAL[c], ink: PAL.ink, sw: .4 }));
  paint(rrPts(x - 24, y - 58, 48, 58, 6), { wash: mixCol(PAL.indigo, PAL.sky, .4), ink: PAL.ink, sw: .7 });
} };
PROPS['rubber-duck'] = { slot: 'desk', draw(b) {   // the debugging duck
  const x = b.x, y = b.y, yel = mixCol(PAL.ochre, '#FFE066', .5);
  paint(ellPts(x, y - 22, 30, 20, 20, 1), { wash: yel, ink: PAL.ink, sw: .7 });
  paint(ellPts(x + 14, y - 52, 16, 15, 16, 1), { wash: yel, ink: PAL.ink, sw: .7 });
  paint([[x + 28, y - 54], [x + 44, y - 50], [x + 28, y - 44]], { wash: PAL.clay, ink: PAL.ink, sw: .5 });
  paint(ellPts(x + 18, y - 56, 2.5, 2.5, 8), { wash: PAL.ink, ink: null });
} };

// draw the props story.json picked for each slot. which: 'room' (behind the desk) | 'desk' | 'hook'
function drawProps(which, env) {
  const R = (window.STORY && window.STORY.room) || {};
  const one = (slotName, pick, box) => {
    if (!pick) return;
    const spec = typeof pick === 'string' ? { prop: pick } : pick, P = PROPS[spec.prop];
    if (!P) { console.warn('[session-story] no prop named', spec.prop); return; }
    if (P.slot !== slotName) console.warn(`[session-story] ${spec.prop} is a ${P.slot} prop, placed in ${slotName}`);
    boilSeed('prop-' + slotName + spec.prop);
    P.draw(box, env, spec);
  };
  if (which === 'room') {
    for (const s of ['sill', 'wallA', 'wallB', 'wallC', 'floor']) one(s, R[s], SLOTS[s]);
    const items = (R.shelf || []).slice(0, 3);
    if (items.length) { boilSeed('shelf'); paint(rectPts(1450, 330, 330, 18, 1.5), { wash: mixCol(PAL.clayDk, PAL.ochre, .3), ink: PAL.ink, sw: .7 });
      items.forEach((it, i) => one('shelf', it, SLOTS.shelf[i])); }
  }
  if (which === 'desk') one('desk', R.desk, SLOTS.desk);
  if (which === 'hook') one('hook', R.hook, SLOTS.hook);
}
