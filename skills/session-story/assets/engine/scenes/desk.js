// desk.js: the set and the message objects for the session story. Screen space, 1920×1080, the agent centred.
// Every message arrives as an object that carries the user's actual words: a paper plane (a request) unfolds into
// a note; a mallet (a correction) bonks, then turns its striking face to camera with the words on it; a butterfly
// (praise) tows a ribbon with the words. The window carries time of day across the session.
const DESK = { cx: 960, gy: 830, u: 34, top: 742 };   // Clawd's ground point (hidden by the desk) and size
const HAND = '"Permanent Marker", "Comic Sans MS", cursive';

// ---------- time of day: the window carries the session's colour arc (0 morning → 1 night) ----------
const SKY_KEYS = [[0, '#CFE6F2'], [.35, '#8EC3E6'], [.6, '#9FC4DA'], [.8, '#F0A98A'], [1, '#2B2F63']];
function skyAt(tod) {
  let i = 0; while (i + 1 < SKY_KEYS.length && tod > SKY_KEYS[i + 1][0]) i++;
  const [a, ca] = SKY_KEYS[i], [b, cb] = SKY_KEYS[Math.min(i + 1, SKY_KEYS.length - 1)];
  return b > a ? mixCol(ca, cb, clamp((tod - a) / (b - a))) : ca;
}
const nightOf = tod => clamp((tod - .8) / .2);

// ---------- the room: walls, window and floor; the decorations are props.js, picked in story.json ----------
function room(tod, env) {
  const P = ((window.STORY && window.STORY.room) || {}).palette || {}, pc = (c, d) => (c && PAL[c]) || c || d;
  const WALL = pc(P.wall, mixCol(PAL.paper, PAL.ochre, .14)), night = nightOf(tod);
  boilSeed('wall');
  paint(rectPts(-40, -40, W + 80, 760), { wash: mixCol(WALL, PAL.indigo, .35 * night), ink: null });
  paint(ellPts(420, 330, 520, 360, 30, 6), { fill: mixCol(WALL, PAL.cream, .5), fillOp: 90, bleed: .05, tex: .5, ink: null });
  boilSeed('wainscot');
  paint(rectPts(-40, 690, W + 80, 230), { wash: mixCol(pc(P.wainscot, mixCol(PAL.teal, PAL.paper, .6)), PAL.indigo, .3 * night), ink: null });
  inkLine([[-40, 690], [W / 2, 688], [W + 40, 691]], .8, PAL.ink, 'ink', .4);
  boilSeed('floor');
  paint(rectPts(-40, 900, W + 80, 220), { wash: mixCol(pc(P.floor, mixCol(PAL.clayDk, PAL.paper, .5)), PAL.indigo, .3 * night), ink: null });
  inkLine([[-40, 900], [W / 2, 902], [W + 40, 899]], .8, PAL.ink, 'ink', .4);
  windowFrame(tod);
  drawProps('room', env || { tod, night, t: 0, fx: {} });
}
function windowFrame(tod) {
  const x = 170, y = 150, w = 470, h = 410, sky = skyAt(tod), night = nightOf(tod);
  boilSeed('window');
  paint(rectPts(x, y, w, h, 2), { wash: sky, ink: null });
  if (night > .3) { for (let i = 0; i < 9; i++) { boilSeed('star' + i); paint(starPts(x + 40 + hash(i) * (w - 80), y + 30 + hash(i + 9) * h * .6, 5 + 4 * hash(i + 3), .35, 4), { wash: PAL.cream, ink: null }); }
    boilSeed('moon'); paint(ellPts(x + w * .72, y + 110, 40, 40, 20, 1), { wash: PAL.cream, ink: PAL.ink, sw: .6 }); }
  else { boilSeed('sun'); const sy = y + 120 + 150 * clamp((tod - .5) / .3);
    paint(ellPts(x + w * .7, sy, 42, 42, 20, 1), { wash: mixCol(PAL.cream, PAL.ochre, .4 + .4 * clamp((tod - .6) / .2)), ink: PAL.ink, sw: .6 });
    boilSeed('wcloud'); paint(ellPts(x + w * .3, y + 90, 90, 26, 16, 3), { wash: mixCol(PAL.cream, sky, .25), ink: null }); }
  boilSeed('hills');   // a hill through the glass, kept inside the frame
  const H = [[x, y + h]]; for (let k = 0; k <= 16; k++) { const xx = x + w * k / 16; H.push([xx, y + h - 70 + 55 * ((xx - x - w * .4) / (w * .8)) ** 2]); } H.push([x + w, y + h]);
  paint(H, { wash: mixCol(PAL.sap, sky, .45), ink: null });
  boilSeed('frame');
  const f = mixCol(PAL.cream, PAL.ochre, .25);
  for (const R of [[x - 18, y - 18, w + 36, 18], [x - 18, y + h, w + 36, 26], [x - 18, y, 18, h], [x + w, y, 18, h], [x + w / 2 - 7, y, 14, h], [x, y + h * .45 - 7, w, 14]])
    paint(rectPts(...R, 1.5), { wash: f, ink: PAL.ink, sw: .7 });
}
// ---------- the desk ----------
function desk() {
  const wood = mixCol(PAL.clayDk, PAL.ochre, .35), top = mixCol(wood, PAL.cream, .3);
  boilSeed('deskshadow'); paint(ellPts(960, 1000, 620, 40, 24), { fill: PAL.ink, fillOp: 70, bleed: .05, ink: null });
  boilSeed('desk');
  paint([[470, DESK.top], [1450, DESK.top], [1490, 790], [430, 790]], { wash: top, ink: PAL.ink, sw: .9 });
  paint(rectPts(440, 790, 1040, 200, 2), { wash: wood, ink: PAL.ink, sw: .9 });
  paint(rectPts(460, 800, 1000, 30, 1), { fill: mixCol(wood, PAL.ink, .3), fillOp: 90, bleed: .03, tex: .5, ink: null });
  for (const dx of [490, 1310]) { paint(rectPts(dx, 850, 120, 90, 2), { wash: mixCol(wood, PAL.cream, .12), ink: PAL.ink, sw: .6 }); paint(ellPts(dx + 60, 895, 9, 6, 10), { wash: PAL.ochre, ink: PAL.ink, sw: .5 }); }
  for (const lx of [450, 1450]) paint(rectPts(lx, 990, 22, 22, 1), { wash: mixCol(wood, PAL.ink, .35), ink: PAL.ink, sw: .6 });
  nameplate((window.SCHEDULE && SCHEDULE.nameplate) || '');
}
// a brass plaque on the desk front
function nameplate(txt) {
  boilSeed('nameplate');
  const x = 700, y = 856, w = 520, h = 78, brass = mixCol(PAL.ochre, PAL.cream, .25);
  paint(rrPts(x, y, w, h, 6, 1), { wash: brass, ink: PAL.ink, sw: .9 });
  paint(rrPts(x + 9, y + 9, w - 18, h - 18, 4), { ink: mixCol(brass, PAL.ink, .45), sw: .5 });
  paint(rectPts(x + 14, y + 12, w - 28, 12), { fill: PAL.cream, fillOp: 120, bleed: .02, tex: .4, ink: null });
  for (const sx of [x + 22, x + w - 22]) paint(ellPts(sx, y + h / 2, 5, 5, 8), { wash: mixCol(brass, PAL.ink, .5), ink: null });
  const size = Math.min(36, (w - 60) / Math.max(1, txt.length * .46));
  if (txt) letter(txt, x + w / 2, y + h / 2 + 2, size, mixCol(PAL.ink, PAL.clayDk, .3), { font: `italic 600 ${size}px Georgia, serif`, ink: false });
}
function keyboard(tap = 0, jump = 0) {
  boilSeed('keyboard');
  push(); translate(0, jump);
  paint([[800, 752], [1120, 752], [1135, 778], [785, 778]], { wash: mixCol(PAL.paper, PAL.ink, .2), ink: PAL.ink, sw: .7 });
  for (let r = 0; r < 2; r++) for (let k = 0; k < 11; k++) {
    const x = 815 + k * 28 + r * 6, y = 757 + r * 10, down = tap && hash(k * 7 + r + Math.floor(tap * 9)) > .8;
    paint(rectPts(x, y + (down ? 1.5 : 0), 20, 7), { wash: down ? PAL.cream : mixCol(PAL.paper, PAL.ink, .35), ink: null });
  }
  pop();
}
// state: 'off', 'boot' (k 0..1: a CRT line opening into the screen), 'hook' (k = typed; o.lines, o.t for the cursor),
// 'code' (work in progress, k = how far), 'result' (the finished work), 'error' (red), 'ok' (green), 'render' (a progress
// bar, k = done). o.kind is what the user's work looks like: code, tests, terminal, page, doc, chart, image.
const MONO = 'Menlo, Monaco, "Courier New", monospace';
function monitor(state = 'code', k = 1, wob = 0, flash = 0, o = {}) {
  boilSeed('monitor');
  push(); translate(1300, 752); rotate(wob); translate(-1300, -752);
  const S = [[1190, 520], [1410, 482], [1410, 690], [1190, 700]];
  paint(rectPts(1290, 690, 22, 62, 1), { wash: mixCol(PAL.ink, PAL.paper, .3), ink: PAL.ink, sw: .6 });
  paint(ellPts(1300, 752, 60, 10, 14), { wash: mixCol(PAL.ink, PAL.paper, .3), ink: PAL.ink, sw: .6 });
  paint([[1178, 508], [1422, 468], [1422, 702], [1178, 712]], { wash: mixCol(PAL.ink, PAL.paper, .15), ink: PAL.ink, sw: .8 });
  const at = (u, v) => [lerp(lerp(S[0][0], S[1][0], u), lerp(S[3][0], S[2][0], u), v), lerp(lerp(S[0][1], S[1][1], u), lerp(S[3][1], S[2][1], u), v)];
  if (state === 'off' || state === 'boot') {
    paint(S, { wash: '#16141d', ink: null });
    paint([at(.62, .06), at(.9, .04), at(.9, .1), at(.62, .12)], { fill: mixCol('#16141d', PAL.cream, .25), fillOp: 60, bleed: .02, ink: null });   // a dark glass sheen
    if (state === 'boot') {   // the tube warms: a line of light across the middle, which opens into the screen
      const w = clamp(k / .35), hgt = clamp((k - .35) / .65), col = mixCol('#FFFDF2', '#232746', ease(hgt));
      if (w > 0) paint([at(.5 - .5 * w, .5 - .5 * hgt - .012), at(.5 + .5 * w, .5 - .5 * hgt - .012), at(.5 + .5 * w, .5 + .5 * hgt + .012), at(.5 - .5 * w, .5 + .5 * hgt + .012)], { wash: col, ink: null });
      glow(...at(.5, .5), 180 + 120 * hgt, '#DDE8FF', .5 * w);
    }
    pop(); return;
  }
  const kind = o.kind || 'code', PAGE = '#EFE8D8', TERM = '#15131C';
  const scr = state === 'error' ? mixCol('#3B1E2A', '#C8332B', .35) : state === 'ok' ? mixCol('#1E3B2E', PAL.sap, .45)
    : ['code', 'result', 'render'].includes(state) && kind === 'doc' ? PAGE : ['code', 'result', 'render'].includes(state) && kind === 'terminal' ? TERM : '#232746';
  paint(S, { wash: scr, ink: null });
  if (state === 'hook') {   // the session boots: the line types out, a block cursor blinking after it
    const lines = o.lines || [], size = 17.5, cw = size * .6, ex = [(S[1][0] - S[0][0]) / 220, (S[1][1] - S[0][1]) / 220], ey = [0, 1];
    const total = lines.reduce((a, l) => a + l.length, 0); let shown = Math.floor(clamp(k) * total + 1e-6), cur = null;
    lines.forEach((l, i) => {
      const n = Math.max(0, Math.min(l.length, shown)); shown -= l.length;
      const p = at(.09, .36 + i * .2);
      if (n > 0) letter(l.slice(0, n), p[0], p[1], size, '#A8F5C0', { mat: [ex[0], ex[1], ey[0], ey[1]], font: `${size}px ${MONO}`, align: 'left', ink: false });
      if (n < l.length && !cur || (i === lines.length - 1 && !cur)) cur = [p[0] + ex[0] * cw * n, p[1] + ex[1] * cw * n];
    });
    if (cur && (Math.floor((o.t || 0) * 2.2) % 2 === 0 || k < 1)) paint([[cur[0] + 2, cur[1] - size * .45], [cur[0] + 2 + cw * .9, cur[1] - size * .45 + ex[1] * cw * .9], [cur[0] + 2 + cw * .9, cur[1] + size * .42 + ex[1] * cw * .9], [cur[0] + 2, cur[1] + size * .42]], { wash: '#A8F5C0', ink: null });
    glow(...at(.5, .5), 260, '#9FE8C0', .4 + .5 * flash);
    pop(); return;
  }
  // the work, as it looks for this user: code, tests, a terminal, a web page, a document, a chart or a picture
  const Q = (u0, v0, u1, v1) => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  const tick = (u, v, r, col, w = 2) => inkLine([at(u - r, v), at(u - r * .3, v + r * 1.2), at(u + r * 1.1, v - r * 1.1)], w, col, 'ink', 0);
  const codeLines = (n, cols = [PAL.rose, PAL.sky, PAL.ochre, PAL.cream]) => { for (let i = 0; i < n; i++) {
    const ind = [0, .08, .08, .16, .08, 0, .08, .16, 0][i], len = .25 + .45 * hash(i + 50), v = .1 + i * .09;
    inkLine([at(.08 + ind, v), at(.08 + ind + len, v)], 1.6, cols[i % cols.length], 'inkfine', 0); } };
  const docLines = n => { for (let i = 0; i < n; i++) { const v = .2 + i * .085, len = i % 4 === 3 ? .42 : .8 - .06 * hash(i + 7);
    inkLine([at(.1, v), at(.1 + len, v)], 1.3, mixCol(PAL.ink, PAGE, .4), 'inkfine', 0); } };
  const termLines = n => { for (let i = 0; i < n; i++) { const v = .12 + i * .09;
    inkLine([at(.06, v), at(.09, v)], 1.6, '#A8F5C0', 'inkfine', 0); inkLine([at(.12, v), at(.12 + .2 + .5 * hash(i + 90), v)], 1.4, mixCol('#A8F5C0', TERM, .35), 'inkfine', 0); } };
  const testRows = (done, total = 7) => { for (let i = 0; i < total; i++) { const v = .14 + i * .115;
    if (i < done) tick(.1, v, .018, PAL.sap, 1.8); else paint(ellPts(...at(.1, v), 5, 5, 10), { wash: mixCol('#232746', PAL.cream, .3), ink: null });
    inkLine([at(.17, v), at(.17 + .35 + .3 * hash(i + 20), v)], 1.4, mixCol(PAL.cream, '#232746', .3), 'inkfine', 0); } };
  if (state === 'code' || state === 'error') {
    const n = Math.round(9 * k);
    if (state === 'error' || ['code', 'image', 'chart'].includes(kind)) codeLines(n);
    else if (kind === 'doc') docLines(n);
    else if (kind === 'terminal') termLines(n);
    else if (kind === 'tests') testRows(Math.floor(7 * k));
    else if (kind === 'page') { paint(Q(.04, .04, .96, .12), { wash: mixCol('#232746', PAL.cream, .25), ink: null }); codeLines(Math.round(6 * k)); }
  }
  if (state === 'result') {
    if (kind === 'image') { paint([at(.2, .75), at(.4, .35), at(.55, .6), at(.7, .3), at(.85, .75)], { wash: PAL.clay, ink: null }); paint(ellPts(...at(.75, .22), 12, 12, 12), { wash: PAL.ochre, ink: null }); }
    else if (kind === 'code') { codeLines(9); paint(ellPts(...at(.86, .15), 15, 15, 14), { wash: PAL.sap, ink: null }); tick(.86, .15, .022, PAL.cream, 2.2); }
    else if (kind === 'tests') testRows(7);
    else if (kind === 'terminal') { termLines(6); tick(.2, .72, .045, '#A8F5C0', 3.4); }
    else if (kind === 'doc') { inkLine([at(.1, .1), at(.6, .1)], 3.4, PAL.ink, 'ink', 0); docLines(8); }
    else if (kind === 'page') { paint(Q(.04, .04, .96, .12), { wash: mixCol('#232746', PAL.cream, .25), ink: null });
      paint(Q(.08, .18, .92, .5), { wash: mixCol(PAL.clay, PAL.cream, .2), ink: null }); paint(ellPts(...at(.78, .3), 14, 14, 12), { wash: PAL.ochre, ink: null });
      for (let i = 0; i < 3; i++) paint(Q(.08 + i * .29, .58, .3 + i * .29, .9), { wash: mixCol(PAL.cream, '#232746', .15), ink: null }); }
    else if (kind === 'chart') { inkLine([at(.1, .12), at(.1, .86), at(.92, .86)], 1.4, PAL.cream, 'inkfine', 0);
      [.3, .45, .4, .62, .8].forEach((hgt, i) => paint(Q(.16 + i * .15, .86 - hgt * .7, .26 + i * .15, .86), { wash: [PAL.sky, PAL.teal, PAL.ochre, PAL.clay, PAL.sap][i], ink: null })); }
  }
  if (state === 'render' && kind !== 'image') {   // a long run: the user's kind of work filling in, the progress along the bottom
    if (kind === 'doc') docLines(Math.round(8 * k)); else if (kind === 'terminal') termLines(Math.round(8 * k)); else if (kind === 'tests') testRows(Math.floor(7 * k)); else codeLines(Math.round(8 * k));
    paint(Q(.06, .9, .94, .95), { wash: mixCol('#232746', PAL.cream, .2), ink: null }); paint(Q(.06, .9, lerp(.06, .94, k), .95), { wash: PAL.sky, ink: null });
  } else if (state === 'render') { paint([at(.12, .45), at(.88, .45), at(.88, .57), at(.12, .57)], { wash: mixCol('#232746', PAL.cream, .2), ink: PAL.cream, sw: .5 });
    paint([at(.12, .45), at(lerp(.12, .88, k), .45), at(lerp(.12, .88, k), .57), at(.12, .57)], { wash: PAL.sky, ink: null }); }
  if (state === 'ok') inkLine([at(.35, .5), at(.47, .66), at(.68, .3)], 5, PAL.cream, 'ink', 0);
  glow(...at(.5, .5), 260, state === 'error' ? '#FF7A6A' : state === 'ok' ? '#A8F0B0' : '#8FB8FF', .35 + .5 * flash);
  pop();
}
function mug(steam = 0, fx = {}) {   // fx: { dy, rot } when a hit makes it hop
  boilSeed('mug');
  push(); translate(621, 750 + (fx.dy || 0)); rotate(fx.rot || 0); translate(-621, -750);
  paint(rrPts(590, 690, 62, 60, 8), { wash: PAL.rose, ink: PAL.ink, sw: .8 });
  paint(ellPts(666, 718, 14, 16, 12), { ink: PAL.ink, sw: .9 });
  for (let i = 0; steam && i < 3; i++) inkLine([[606 + i * 15, 684], [600 + i * 15, 664], [610 + i * 15, 644]], .7, mixCol(PAL.paper, PAL.ink, .4), 'inkfine', .6);
  pop();
}
// the peach notepad the agent tears replies from, lying on the desk by the keyboard
function notepad(n = 6) {
  boilSeed('notepad');
  const pad = [[724, 752], [786, 752], [792, 772], [718, 772]], peach = mixCol(PAL.clayLt, PAL.cream, .55);
  paint(pad.map(([x, y]) => [x, y + 3]), { wash: mixCol(peach, PAL.ink, .25), ink: PAL.ink, sw: .5 });
  for (let i = 0; i < Math.min(n, 4); i++) inkLine([[719 + i, 772 - i * .8], [791 - i, 772 - i * .8]], .3, mixCol(peach, PAL.ink, .35), 'inkfine', 0);
  paint(pad, { wash: peach, ink: PAL.ink, sw: .6 });
}
function lamp(on = 0) {
  boilSeed('lamp');
  const iron = mixCol(PAL.teal, PAL.ink, .5);
  paint(ellPts(1470, 752, 46, 10, 14), { wash: iron, ink: PAL.ink, sw: .6 });
  inkLine([[1470, 752], [1500, 600], [1420, 540]], 3.5, iron, 'ink', .2);
  paint([[1390, 520], [1450, 540], [1420, 590], [1370, 575]], { wash: iron, ink: PAL.ink, sw: .7 });
  if (on) glow(1400, 590, 330, '#FFD98A', on);
}
function tray(n = 3, lift = 0) {
  boilSeed('tray');
  paint([[488, 725], [578, 725], [586, 752], [480, 752]], { wash: mixCol(PAL.paper, PAL.ink, .25), ink: PAL.ink, sw: .7 });
  for (let i = 0; i < n; i++) paint(rectPts(490 + i * 2, 716 - i * 5 - (i === n - 1 ? lift : 0), 86, 10, 1), { wash: PAL.cream, ink: PAL.ink, sw: .4 });
}

// ---------- message objects ----------
// Paper plane (a request, folded), nose along +x before rot. s ≈ half its length.
function paperPlane(x, y, s, rot = 0) {
  boilSeed('plane' + Math.round(x) % 7);
  push(); translate(x, y); rotate(rot);
  const P = pts => pts.map(([a, b]) => [a * s, b * s]);
  paint(P([[1.6, 0], [-1.2, .45], [-.8, .05]]), { wash: mixCol(PAL.cream, PAL.paper, .5), ink: PAL.ink, sw: .7 });
  paint(P([[1.6, 0], [-.9, .08], [-1.05, .5]]), { wash: mixCol(PAL.paper, PAL.ink, .15), ink: PAL.ink, sw: .6 });
  paint(P([[1.6, 0], [-1.2, -.6], [-.75, 0]]), { wash: PAL.cream, ink: PAL.ink, sw: .7 });
  pop();
}
// The plane unfolded into its note: the request in the user's words, with the fold creases still in it.
// o.paper / o.ink colour it (Claude's replies go out on peach paper, in clay ink); o.fold 0..1 folds the top corner
// down, the first fold of a new plane.
function requestNote(x, y, w, h, lines, rot = 0, o = {}) {
  boilSeed('note' + lines[0].length);
  const paper = o.paper || PAL.cream, fold = clamp(o.fold || 0);
  push(); translate(x, y); rotate(rot);
  paint(rectPts(-w / 2, -h / 2, w, h, 1.5), { wash: paper, ink: PAL.ink, sw: .8 });
  if (!fold) for (const [a, b] of [[[-w / 2, 0], [w / 2, 0]], [[0, -h / 2], [0, h / 2]], [[-w / 2, -h / 2], [0, 0]], [[w / 2, -h / 2], [0, 0]]]) inkLine([a, b], .35, mixCol(paper, PAL.ink, .3), 'inkfine', 0);
  else { const f = h * .8 * fold; paint([[w / 2 - f, -h / 2], [w / 2, -h / 2 + f], [w / 2 - f, -h / 2 + f]], { wash: mixCol(paper, PAL.ink, .12), ink: PAL.ink, sw: .6 }); }
  pop();
  const size = Math.min(40, w * .8 / (Math.max(...lines.map(l => l.length)) * .5)), n = lines.length;
  const dx = fold ? -w * .06 : 0, dy = fold ? h * .08 : 0;
  lines.forEach((l, i) => { const off = (i - (n - 1) / 2) * size * 1.12;
    letter(l, x + dx - Math.sin(rot) * off, y + dy + Math.cos(rot) * off, size, o.ink || PAL.ink, { rot, font: `${size}px ${HAND}`, ink: false }); });
}
// a pen at an arm tip (armL / armR hook)
function pen(u, sw) {
  paint(rrPts(0, -.16 * u, 1.9 * u, .32 * u, .14 * u), { wash: PAL.indigo, ink: PAL.ink, sw: sw * .6 });
  paint([[1.9 * u, -.16 * u], [2.3 * u, 0], [1.9 * u, .16 * u]], { wash: PAL.cream, ink: PAL.ink, sw: sw * .5 });
}
const REPLY = { paper: mixCol(PAL.clayLt, PAL.cream, .55), ink: PAL.clayDk };
// The butterfly (praise). open 0..1 is the wing beat.
const WING = ['#F6C94E', '#F0A04B'];
function butterfly(x, y, s, open, rot = 0) {
  boilSeed('butterfly' + Math.round(x) % 5);
  push(); translate(x, y); rotate(rot);
  const wk = .16 + .84 * clamp(open), sw = .7;
  for (const side of [-1, 1]) {
    push(); scale(side * wk, 1);
    paint(ellPts(1.2 * s, 1.0 * s, 1.25 * s, 1.0 * s, 16, 0, .45), { wash: WING[1], ink: PAL.ink, sw });
    paint(ellPts(1.6 * s, -1.25 * s, 1.95 * s, 1.3 * s, 18, 0, -.5), { wash: WING[0], ink: PAL.ink, sw });
    paint(ellPts(2.3 * s, -1.6 * s, .45 * s, .35 * s, 10), { wash: PAL.cream, ink: null });
    pop();
  }
  paint(ribbon([[0, -1.7 * s], [0, 0], [0, 1.9 * s]], .55 * s, .3 * s), { wash: PAL.ink, ink: null });
  for (const side of [-1, 1]) inkLine([[0, -1.6 * s], [side * .5 * s, -2.6 * s], [side * 1.0 * s, -3.1 * s]], .6, PAL.ink, 'inkfine', .6);
  pop();
}
// The ribbon a butterfly tows: the praise in the user's words. It trails from (x, y) toward angle `dir`.
function praiseRibbon(x, y, txt, dir = Math.PI * .85, t = 0) {
  boilSeed('ribbon' + txt.length);
  const size = 30, len = txt.length * size * .5 + 70, bw = 44, tx = Math.cos(dir), ty = Math.sin(dir), nx = -ty, ny = tx;
  const at = (k, j) => { const wv = 7 * Math.sin(k * 5 + t * 6) * k; return [x + tx * (40 + k * len) + nx * (j * bw / 2 + wv), y + ty * (40 + k * len) + ny * (j * bw / 2 + wv)]; };
  inkLine([[x, y + 10], at(0, 0)], .6, PAL.ink, 'inkfine', .3);
  const top = [], bot = []; for (let i = 0; i <= 12; i++) { top.push(at(i / 12, -1)); bot.push(at(i / 12, 1)); }
  paint([...top, at(1.07, 0), ...bot.reverse()], { wash: mixCol(PAL.rose, PAL.cream, .45), ink: PAL.ink, sw: .7 });
  let rot = Math.atan2(ty, tx); if (rot > Math.PI / 2) rot -= Math.PI; if (rot < -Math.PI / 2) rot += Math.PI;
  const mid = at(.5, 0);
  letter(txt, mid[0], mid[1], size, mixCol(PAL.ink, PAL.clayDk, .25), { rot, font: `${size}px ${HAND}`, ink: false });
}

// The mallet (a correction): a real 3D prop, projected orthographically, so a swing from the side, the bonk and
// the turn all read with the same geometry. C = head centre [x, y, z] (z toward camera); A = the striking face's
// direction; Hd = toward the grip (made perpendicular to A); R = barrel radius; S = barrel length; Lh = handle length.
// The message is written on the striking face and shows when the face turns toward camera.
const V3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
function hull(P) {   // monotone-chain convex hull of 2D points
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// the largest type size at which every line fits inside a circle of radius R (lines stacked, centred)
function fitInCircle(lines, R, gap = 1.1, fill = .86, cw = .56) {
  let lo = 4, hi = R, n = lines.length;
  for (let it = 0; it < 20; it++) {
    const s = (lo + hi) / 2;
    const ok = lines.every((l, i) => { const off = Math.abs(i - (n - 1) / 2) * s * gap + s * .5; return off < R && l.length * cw * s <= 2 * Math.sqrt(R * R - off * off) * fill; });
    if (ok) lo = s; else hi = s;
  }
  return lo;
}
function mallet3({ C, A, Hd, R, S, Lh, msg = [] }) {
  boilSeed('mallet' + Math.round(R));
  A = V3.norm(A); Hd = V3.norm(V3.add(Hd, V3.sc(A, -V3.dot(Hd, A))));
  const E = V3.cross(A, Hd), L = V3.norm([-.45, -.65, .6]);   // third axis; light from upper left, in front
  const wood = mixCol(PAL.ochre, PAL.clayDk, .4), lite = mixCol(wood, PAL.cream, .45), dark = mixCol(wood, PAL.ink, .4), iron = mixCol(PAL.clayDk, PAL.ink, .45);
  const pt = (k, t, r = R) => { const p = V3.add(V3.add(C, V3.sc(A, k * S / 2)), V3.add(V3.sc(Hd, r * Math.cos(t)), V3.sc(E, r * Math.sin(t)))); return [p[0], p[1]]; };
  const nz = t => V3.add(V3.sc(Hd, Math.cos(t)), V3.sc(E, Math.sin(t)));
  const rim = (k, r = R, n = 40) => Array.from({ length: n }, (_, i) => pt(k, i / n * TAU, r));
  // a strip of the barrel between two axial positions, over the visible angles where `keep` holds
  const t0 = Math.atan2(E[2], Hd[2]);   // the visible half of the barrel is centred on this angle
  const band = (k0, k1, keep) => { const T = []; for (let i = 0; i <= 48; i++) { const t = t0 - Math.PI / 2 + i / 48 * Math.PI; if (keep(t)) T.push(t); }
    return T.length > 1 ? [...T.map(t => pt(k0, t)), ...T.slice().reverse().map(t => pt(k1, t))] : null; };
  const handle = () => {
    const h0 = V3.add(C, V3.sc(Hd, R * .8)), h1 = V3.add(C, V3.sc(Hd, Lh)), d = V3.norm([h1[0] - h0[0], h1[1] - h0[1], 0]), w = R * .17;
    paint([[h0[0] - d[1] * w, h0[1] + d[0] * w], [h1[0] - d[1] * w, h1[1] + d[0] * w], [h1[0] + d[1] * w, h1[1] - d[0] * w], [h0[0] + d[1] * w, h0[1] - d[0] * w]], { wash: mixCol(wood, PAL.cream, .2), ink: PAL.ink, sw: .8 });
  };
  if (Hd[2] <= 0) handle();
  const sil = hull([...rim(-1), ...rim(1)]);
  paint(sil, { wash: wood, ink: null });
  const hi = band(-1, 1, t => V3.dot(nz(t), L) > .55), lo = band(-1, 1, t => V3.dot(nz(t), L) < -.1);
  if (hi) paint(hi, { fill: lite, fillOp: 150, bleed: .03, tex: .6, ink: null });
  if (lo) paint(lo, { fill: dark, fillOp: 130, bleed: .03, tex: .6, ink: null });
  for (const k of [-.72, .72]) { const b = band(k - .07, k + .07, () => true); if (b) paint(b, { wash: iron, ink: PAL.ink, sw: .5 }); }
  paint(sil, { ink: PAL.ink, sw: 1.2 });
  const faceK = A[2] >= 0 ? 1 : -1, facing = Math.abs(A[2]);   // the end turned toward us
  if (facing > .04) {
    paint(rim(faceK), { wash: mixCol(lite, PAL.cream, .3), ink: PAL.ink, sw: 1 });
    for (const r of [.78, .45]) paint(rim(faceK, R * r), { ink: mixCol(wood, PAL.ink, .15), sw: .45 });
    if (faceK > 0 && msg.length && facing > .35) {   // the words, laid on the striking face
      const c = pt(1, 0, 0), flip = Hd[0] < 0 ? -1 : 1, mat = [Hd[0] * flip, Hd[1] * flip, E[0] * flip, E[1] * flip];
      const n = msg.length, gap = 1.1, size = fitInCircle(msg, R, gap);
      msg.forEach((l, i) => { const off = (i - (n - 1) / 2) * size * gap;
        letter(l, c[0] + E[0] * flip * off, c[1] + E[1] * flip * off, size, '#D93A30', { mat, font: `${size}px ${HAND}`, ink: false, stroke: PAL.cream }); });
    }
  }
  if (Hd[2] > 0) handle();
}
// Storyboard marks for the design pass: a dashed motion path with an arrowhead.
function motionPath(pts, col = PAL.ink) {
  const P = through(pts, 10);
  for (let i = 0; i < P.length - 2; i += 3) inkLine([P[i], P[i + 1]], .9, col, 'inkfine', 0);
  const a = P[P.length - 2], b = P[P.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (const s of [-1, 1]) inkLine([b, [b[0] - 16 * Math.cos(ang + s * .45), b[1] - 16 * Math.sin(ang + s * .45)]], 1, col, 'inkfine', 0);
}
function impactStar(x, y, r) {
  boilSeed('impact');
  paint(starPts(x, y, r, .4, 9, .2), { wash: PAL.cream, ink: PAL.ink, sw: .9 });
  for (let i = 0; i < 7; i++) { const a = -Math.PI + i * .52, r0 = r * 1.25, r1 = r * 1.9; inkLine([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 1.3, PAL.ink, 'ink', 0); }
}
