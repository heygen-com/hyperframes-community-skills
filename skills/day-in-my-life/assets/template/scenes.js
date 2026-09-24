// scenes.js: the chapter archetypes of "a day in my life as <user>'s agent".
// Content comes from window.STORY (story.json, written by the agent from its user's own history and approved by the
// user); every timing comes from window.ARCH (archetypes.json), which scripts/score.py reads too.
// Each archetype names its sustained-motion route; nothing idles between entry and exit.
(() => {
  const S = window.STORY, A = window.ARCH, BAR = 60 / A.bpm * A.beatsPerBar;

  // reveal lines of a bubble one at a time from t0, every dt seconds (keeps the bubble's full height from the start)
  const linesBy = (lines, u, t0, dt) => lines.map((l, i) => (u >= t0 + i * dt ? l : ''));
  function upto(P, k) { if (k <= 0) return null; const R = resample(P, 6), n = Math.max(3, Math.round(R.length * clamp(k))); return R.slice(0, n); }
  const asLines = x => (Array.isArray(x) ? x : x ? [x] : []);
  const hopAt = (u, t0, t1, h) => (u > t0 && u < t1 ? h * Math.sin(seg(u, t0, t1) * Math.PI) : 0);

  // the desk (intro and tag): window + sun, desk, terminal monitor, ink pot and pen
  function desk0() {
    room(false);
    windowPanes('win', 1260, 150, 440, 360);
    sun('sun', 1480, 290, 56);
    desk('desk', 770, 60, 1860);
    boilSeed('mon');
    roughWash([[560, 300], [1150, 296], [1154, 660], [562, 664]], INK, { amp: 3, mis: 3 });
    sketchPoly([[548, 288], [1164, 284], [1168, 672], [550, 676]], 1.1, INK, { over: 18, sep: 8 });
    pen([[800, 676], [790, 760]], 1.8, INK, 'flat', { twice: 2, sep: 10 }); pen([[930, 676], [940, 760]], 1.8, INK, 'flat', { twice: 2, sep: 10 });
    pen([[700, 764], [1030, 762]], 2, INK, 'flat', { twice: 2, sep: 8 });
    inkPot('pot', 1440, 764, 1.1);
    boilSeed('pen'); pen([[1420, 660], [1560, 470]], 1.4, INK, 'flat', { twice: 2, sep: 6 });
  }

  const ARCHETYPES = {
    // route: camera with intent (title → tilt down to the desk) + staged reveals (title writes on, the command is typed,
    // the session starts) → swallow (push into the terminal's ink)
    intro: (C, E) => (u, dur, ci) => {
      const tilt = ease(seg(u, E.tilt[0], E.tilt[1])), push = easeIn(seg(u, E.push[0], E.push[1]), 2.2);
      cam(ci, u, lerp(960, 900, push), lerp(-470, 540, tilt), 1 + 4.2 * push);
      desk0();
      const [l1, l2] = C.title;
      handwrite('title', [[l1, 960, -560], [l2, 960, -330]], 176, seg(u, E.write[0], E.write[1]), { w: 4.6 });
      terminal(u, A.keysRel.map(d => E.enter + d), E.enter, C.command || 'claude');
      camEnd();
      inkDisc('swallow-intro', W / 2, H / 2, 2400 * easeIn(seg(u, E.push[1] - .6, dur), 2));
      if (u >= E.caption) caption(C.caption, typed(u, E.caption));
    },

    // route: camera with intent (dolly along the shelf to the reader) + staged reveals (a rule pins up, a page turns)
    shelf: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, lerp(760, 1180, ease(seg(u, 0, dur - .8))), 540, 1);
      air('air', 7, [1300, 820, 700, 180]);
      shelf('shelf', 80, 170, 1080, 4, 212, C.spines || []);
      const d = dropIn(u, E.pin, 70);
      if (d !== null && C.note) pinned('rule', 1250, 150 + d, 330, C.note, 44, { rot: -.04 - (d / 70) * .1 });
      lampCone('lamp', 1560, 330, 90, 1070, 620);
      const turn = seg(u, E.turn[0], E.turn[1]), hop = u > E.turn[1] && u < E.turn[1] + .375 ? 14 : 0;
      blot('me', 1560, 500 - hop, 70, { petals: 12, splat: 7 });
      boilSeed('book');
      const bl = [[1560, 720], [1508, 600], [1330, 596], [1318, 712]], br = [[1560, 720], [1612, 600], [1790, 596], [1802, 712]];
      roughWash(bl, PAPER, { amp: 2, mis: 1.5 }); roughWash(br, PAPER, { amp: 2, mis: 1.5 });
      sketchPoly(bl, 1, INK, { over: 8, sep: 5 }); sketchPoly(br, 1, INK, { over: 8, sep: 5 });
      letter(C.book || 'MEMORY.md', 1352, 640, 30, { rot: .02 });
      for (let i = 0; i < 3; i++) { boilSeed('pg' + i); squiggle(1360, 666 + i * 16, 110 - i * 18, { amp: 3, wave: 14, w: .5 }); squiggle(1630, 628 + i * 18, 130 - i * 16, { amp: 3, wave: 14, w: .5 }); }
      if (turn > 0 && turn < 1) {
        const x = lerp(1790, 1330, ease(turn)), lift = Math.sin(turn * Math.PI) * 70;
        const pg = [[1560, 720], [1510, 600], [x, 600 - lift], [x + (x > 1560 ? 12 : -12), 712 - lift * .4]];
        boilSeed('turn'); roughWash(pg, PAPER, { amp: 1.5, mis: 1 }); sketchPoly(pg, .9, INK, { over: 6, sep: 4 });
      }
      camEnd();
      caption(C.caption, typed(u, .6));
    },

    // route: staged reveals (the user's first message lands line by line, the blot reacts, a receipt slaps on)
    'first-message': (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, 960, 540, 1 + .04 * ease(seg(u, 0, dur)));
      air('air', 6, [70, 260, 360, 520]);
      monitor('mon', 600, 120, 1020, 640);
      const LINES = asLines(C.lines).slice(0, 6);
      if (u >= E.lines) {
        bubble('ask', 820, 210, 780, linesBy(LINES, u, E.lines, E.lineStep), 34);
        if (C.link != null && u >= E.lines + C.link * E.lineStep) {
          const yl = 210 + 34 * .8 * .55 + 34 * .85 + C.link * 34 * 1.24 + 8;
          boilSeed('link'); pen([[850, yl], [850 + measure(LINES[C.link], 34), yl + 2]], .55, INK, 'flat', { lifts: .1 });
        }
      }
      const hop = hopAt(u, E.hop, E.hop + .4, 34);
      blot('me', 900, 640 - hop, 52 * (1 + (hop ? .15 : 0)), { petals: 12, splat: 9, eye: false });
      backOfHead('you', 650, 700, 190);
      const d = dropIn(u, E.sticky, 60);
      if (d !== null && C.sticky) {   // fit the longest word into the note, and keep the note clear of the frame under the push
        let fs = 32; while (fs > 20 && Math.max(...C.sticky.split(' ').map(w => measure(w, fs))) > 200) fs--;
        pinned('sticky', 1596, 320 + d, 250, C.sticky, fs, { rot: .05 + (d / 60) * .15 });
      }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: sequenced UI life (a reel plays, or a web page scrolls, on a big screen; optionally the blot mutes it on
    // the beat) + camera push
    watching: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, 960, lerp(540, 470, ease(seg(u, 0, dur))), 1 + .06 * ease(seg(u, 0, dur)));
      boilSeed('screen');
      const Sc = [[330, 140], [1590, 124], [1640, 690], [290, 706]];
      roughWash(Sc, PAPER, { amp: 5, mis: 3 });
      sketchPoly(Sc, 1.2, PAPER, { over: 26, sep: 10, lifts: .3 });
      if (C.kind === 'page') {   // a web page scrolling (docs, a search, an issue): title bar, heading, text, an image
        boilSeed('page');
        const sc = 90 * ease(seg(u, .5, dur - .5)), x0 = 420, x1 = 1500;
        [0, 1, 2].forEach(i => inkDot(x0 + 20 + i * 22, 172, 5)); pen([[x0, 196], [x1, 194]], .8, INK, 'flat', { twice: 2, sep: 5 });
        if (C.title) letter(C.title, x0 + 90, 180, 28);
        const Y = y => y - sc;
        if (Y(260) > 200) pen([[x0 + 20, Y(260)], [x0 + 520, Y(262)]], 2.4, INK, 'flat', { twice: 2, sep: 8 });
        for (let i = 0; i < 7; i++) { const y = Y(320 + i * 44); if (y > 210 && y < 660) { boilSeed('para' + i); squiggle(x0 + 20, y, 380 + (i * 97) % 220, { amp: 4, wave: 18, w: .6 }); } }
        const iy = Y(330); if (iy > 200) { boilSeed('img'); roughWash([[1040, iy], [1460, iy], [1460, Math.min(660, iy + 240)], [1040, Math.min(660, iy + 240)]], INK, { amp: 2, mis: 2 }); }
      } else {
        boilSeed('reel');
        const rx = 810, ry = 170, rw = 300, rh = 500;
        sketchPoly([[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], 1, INK, { over: 10, sep: 6 });
        const talk = Math.floor(u * 4) % 2;
        roughWash(ellPts(rx + rw / 2, ry + 200 - talk * 4, 62, 74, 18, 3), INK, { amp: 2, mis: 1 });
        roughWash([[rx + 40, ry + rh], [rx + 70, ry + 330], [rx + rw / 2, ry + 290], [rx + rw - 70, ry + 330], [rx + rw - 40, ry + rh]], INK, { amp: 3, mis: 1 });
        const bt = Math.floor(u / .5);
        boilSeed('cap' + bt); pen([[rx + 50, ry + 420], [rx + 50 + 120 + (bt % 3) * 40, ry + 420]], 1.6, PAPER, 'flat');
      }
      const mute = C.muted === true, hop = mute ? hopAt(u, E.mute - .3125, E.mute + .0625, 30) : 0;   // muting needs a receipt
      if (C.kind === 'page' && !mute) { /* a page makes no sound */ }
      else if (!mute || u < E.mute) { boilSeed('waves'); for (let i = 0; i < 3; i++) pen(ellPts(1440, 210, 18 + i * 16, 22 + i * 18, 8, 0, -.8, .8), .8, INK, 'flat'); boilSeed('spk'); pen([[1400, 198], [1414, 198], [1434, 180], [1434, 240], [1414, 222], [1400, 222], [1400, 196]], 1, INK, 'flat', { curv: 0, twice: 2, sep: 4 }); }
      else muted('mute', 1400, 210, 1.1);
      if (C.kind !== 'page') { seats('row1', 900, 9, 160, 1760); seats('row2', 1010, 8, 240, 1680); }
      else { boilSeed('pdesk'); pen([[180, 930], [1740, 926]], 2, PAPER, 'flat', { twice: 2, sep: 10 }); }
      blot('me', 1300, 676 - hop, 100, { petals: 13, splat: 8 });
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (frames pin up in a waterfall, a magnifier walks them LEFT, pausing on one)
    frames: (C, E) => (u, dur, ci) => {
      room(false);
      cam(ci, u, lerp(1000, 900, ease(seg(u, 0, dur))), 540, 1);
      const L = layRng('grid');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const x = 170 + c * 262 + (L() - .5) * 14, y = 250 + r * 190 + (L() - .5) * 12, kind = Math.floor(L() * 4);
        const d = dropIn(u, .25 + r * .125 + c * .0625, 40, .25);
        if (d === null) continue;
        filmFrame(`fr${r}${c}`, x, y + d, 232, 140, kind);
        boilSeed(`pin${r}${c}`); inkDot(x + 116, y - 4 + d, 6);
      }
      const td = dropIn(u, E.tape, 50);
      if (td !== null && C.tape) { boilSeed('tape'); const w = measure(C.tape, 40) + 110; const tp = [[180, 170 + td], [180 + w, 160 + td], [184 + w, 214 + td], [184, 224 + td]]; sketchPoly(tp, .9, INK, { over: 8, sep: 5 }); letter(C.tape, 238, 206 + td, 40, { rot: -.035 }); }
      const k = u < E.pause[0] ? ease(seg(u, E.walk[0], E.walk[1])) * .45 : u < E.pause[1] ? .45 : .45 + ease(seg(u, E.walk2[0], E.walk2[1])) * .55;
      const mx = lerp(1500, 360, k), my = 520 + Math.sin(k * 6) * 30;
      if (u > E.walk[0] - .125) { magnifier('mag', mx, my, 96); blot('me', mx + 250, my + 260, 80, { petals: 13, splat: 8 }); }
      else blot('me', 1750, 830, 80 * ease(seg(u, E.walk[0] - .625, E.walk[0] - .125)) + 1, { petals: 13, splat: 8 });
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (the go-ahead lands, the blot paints, pages fly out of the light)
    building: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, 960, 540, 1 + .04 * ease(seg(u, 0, dur)));
      lampCone('lamp', 1000, 150, 130, 1050, 1080, { cord: true });
      boilSeed('table');
      const top = [[560, 660], [1400, 620], [1440, 700], [520, 740]];
      roughWash(top, INK, { amp: 2, mis: 2 }); sketchPoly(top, .9, INK, { over: 16, sep: 6 });
      pen([[600, 740], [620, 1060]], 2, INK, 'flat', { twice: 2, sep: 10 }); pen([[1380, 700], [1360, 1060]], 2, INK, 'flat', { twice: 2, sep: 10 });
      sketchPoly([[760, 560], [1160, 540], [1180, 640], [740, 660]], .8, INK, { over: 10, sep: 5 });
      const wk = seg(u, E.paint[0], E.paint[1]), w1 = []; for (let s = 0; s <= 300; s += 6) w1.push([800 + s, 590 + (Math.round(s / 6) % 2 ? -5 : 5)]);
      const drawn = upto(w1, wk); if (drawn) { boilSeed('drawing'); pen(drawn, .7, INK, 'ink', { curv: .6 }); }
      if (wk >= 1) { boilSeed('drawing2'); squiggle(800, 620, 200 * ease(seg(u, E.paint[1], E.paint[1] + .46)) + 1, { amp: 4, wave: 18, w: .6 }); }
      const head = drawn ? drawn[drawn.length - 1] : [800, 590], bx = head[0] + 70, by = 430;
      blot('me', bx, by, 84, { petals: 13, splat: 8 });
      boilSeed('brush'); pen([[bx - 20, by + 60], [head[0], head[1] - 6]], 1.8, INK, 'sumi');
      [[1560, 300, .2], [1700, 520, -.15], [1520, 690, .3]].forEach(([tx, ty, a], i) => {
        const t0 = E.pages[i]; if (t0 == null || u < t0) return;
        const k = easeOut(seg(u, t0, t0 + .5), 2), [x, y] = arcPt([1060, 590], [tx, ty], 120, k), aa = a * k + (1 - k) * .8;
        boilSeed('fly' + i); const c = Math.cos(aa), s = Math.sin(aa), P = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
        roughWash([P(-70, -50), P(70, -50), P(70, 50), P(-70, 50)], PAPER, { amp: 2, mis: 1.5 });
        pen([P(-50, -18), P(40, -18)], .5, INK, 'flat'); pen([P(-50, 6), P(24, 6)], .5, INK, 'flat');
        if (k > .9) strays(x - 110, y, 30, 2, PAPER, { a0: Math.PI * .9, span: .4, len: 50, along: false });
      });
      if (u >= E.bubble) bubble('go', 110, 360, 440, linesBy(asLines(C.bubble), u, E.bubble, .3125), 38, { fill: true });
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: sequenced UI life (a command typed into a terminal, output scrolls; optionally it fails, the blot fixes
    // it, the re-run passes) + camera push
    terminal: (C, E) => (u, dur, ci) => {
      room(false);
      cam(ci, u, 960, 520, 1 + .05 * ease(seg(u, 0, dur)));
      desk('tdesk', 900, 80, 1840);
      boilSeed('term');
      const F = [[380, 130], [1540, 124], [1546, 790], [384, 796]];
      roughWash(F, INK, { amp: 3, mis: 3 }); sketchPoly([[366, 116], [1556, 110], [1562, 806], [368, 810]], 1.1, INK, { over: 18, sep: 8 });
      pen([[900, 810], [880, 900]], 1.8, INK, 'flat', { twice: 2, sep: 10 }); pen([[1040, 810], [1060, 900]], 1.8, INK, 'flat', { twice: 2, sep: 10 });
      const cmd = asLines(C.commands)[0] || '', ch = Math.min(cmd.length, Math.max(0, Math.floor((u - E.type) * E.cps)));
      const red = !!(C.fail && C.pass), second = red && u >= E.rerun, entered = u >= E.enter;
      letter('$', 430, 210, 40, { col: PAPER, heavy: .05 });
      letter(cmd.slice(0, ch), 470, 210, 40, { col: PAPER, heavy: .05 });
      const out = asLines(C.output).slice(0, 4), outT = second ? E.rerun : E.enter;
      if (entered) out.forEach((l, i) => { if (u >= outT + .125 * (i + 1)) letter(l, 470, 270 + i * 50, 30, { col: PAPER, heavy: .03 }); });
      if (entered && !out.length) for (let i = 0; i < 4; i++) if (u >= outT + .125 * (i + 1)) { boilSeed('out' + i + (second ? 'b' : '')); pen([[470, 270 + i * 50], [470 + 260 + (i * 131) % 380, 272 + i * 50]], .9, PAPER, 'flat', { lifts: .3 }); }
      const box = (txt, y, k) => { if (!txt) return; const w = measure(txt, 40) + 70; boilSeed('box' + k); wash(rectPts(466, y - 44, w, 62, 2), PAPER); letter(txt, 500, y, 40); return w; };
      if (red && u >= E.fail && !second) box(C.fail, 560, 'f');
      if (red && u >= E.pass) { const w = box(C.pass, 560, 'p'); boilSeed('tick'); const tk = upto([[500 + w, 540], [520 + w, 562], [556 + w, 506]], seg(u, E.pass, E.pass + .25)); if (tk) pen(tk, 1.4, PAPER, 'flat', { curv: 0 }); }
      if (!red && C.done && u >= E.fail) box(C.done, 560, 'd');
      if (!entered || (second && u < E.rerun + .125)) { boilSeed('cur'); wash(rectPts(474 + measure(cmd.slice(0, ch), 40) + 6, 172, 22, 44, 1.5), PAPER); }
      const hop = hopAt(u, E.fail, E.fail + .375, 30) + (red ? hopAt(u, E.pass, E.pass + .375, 40) : 0);
      blot('me', 1680, 860 - hop, 70 * (1 + (red && u >= E.pass ? .12 * backOut(seg(u, E.pass, E.pass + .3)) : 0)), { petals: 13, splat: 7 });
      if (red && u >= E.fix && u < E.rerun) { boilSeed('fixing'); pen([[1640, 820], [1400, 640]], 1.4, INK, 'sumi'); }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (a file on the desk: old lines struck out, new ones written in, the change stamped)
    diff: (C, E) => (u, dur, ci) => {
      room(false);
      cam(ci, u, lerp(980, 930, ease(seg(u, 0, dur))), 540, 1 + .04 * ease(seg(u, 0, dur)));
      desk('ddesk', 960, 60, 1860);
      boilSeed('page');
      const P = [[600, 200], [1320, 192], [1332, 900], [592, 908]];
      sketchPoly(P, 1.1, INK, { over: 14, sep: 7 });
      if (C.file) { const w = measure(C.file, 30) + 50; wash(rectPts(612, 150, w, 50, 2), INK); letter(C.file, 634, 186, 30, { col: PAPER, heavy: .04 }); }
      const rem = asLines(C.removed).slice(0, 3), add = asLines(C.added).slice(0, 3);
      const rows = 12, R = i => 250 + i * 52, cut = [4, 5, 6];
      for (let i = 0; i < rows; i++) {
        if (cut.includes(i) && u >= E.write[0]) continue;              // struck lines give way to the new ones
        const indent = [0, 40, 40, 80, 80, 80, 40, 0, 40, 80, 40, 0][i], len = 220 + (i * 173) % 360;
        const ri = cut.indexOf(i);
        if (ri >= 0 && rem[ri]) letter(rem[ri], 640 + indent, R(i) + 10, 28);
        else { boilSeed('code' + i); pen([[640 + indent, R(i)], [640 + indent + len, R(i) + 1]], .8, INK, 'flat', { lifts: .15 }); }
        if (ri >= 0 && u >= E.strike[ri]) { boilSeed('strike' + i); pen([[620, R(i) + 2], [lerp(620, 1290, seg(u, E.strike[ri], E.strike[ri] + .25)), R(i) + 4]], 2.2, INK, 'sumi'); }
      }
      const wk = seg(u, E.write[0], E.write[1]);
      if (wk > 0) cut.forEach((i, k) => {
        const kk = clamp(wk * 3 - k); if (kk <= 0) return;
        if (add[k]) letter(add[k].slice(0, Math.ceil(add[k].length * kk)), 680, R(i) + 10, 28);
        else { boilSeed('new' + i); const L = upto([[680, R(i)], [680 + 300 + k * 60, R(i) + 1]], kk); if (L) pen(L, .9, INK, 'ink'); }
      });
      const head = wk > 0 && wk < 1 ? [680 + 360 * (wk * 3 % 1), R(cut[Math.min(2, Math.floor(wk * 3))])] : [1180, 640];
      blot('me', head[0] + 180, head[1] - 90, 64, { petals: 12, splat: 6 });
      boilSeed('brush2'); pen([[head[0] + 150, head[1] - 50], [head[0] + 10, head[1] - 6]], 1.6, INK, 'sumi');
      const d = dropIn(u, E.stamp, 40);
      if (d !== null && C.stat) { const w = measure(C.stat, 40) + 60; boilSeed('stamp'); sketchPoly([[1060, 790 + d], [1060 + w, 780 + d], [1066 + w, 846 + d], [1064, 854 + d]], 1.2, INK, { over: 8, sep: 5 }); letter(C.stat, 1090, 834 + d, 40, { rot: -.03 }); }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: sequenced UI life (a pause request lands, the screen powers down, counts in the dark, comes back)
    restart: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, 960, 560, 1 + .03 * ease(seg(u, 0, dur)));
      if (u >= E.bubble) bubble('pause', 560, 190, 800, linesBy(asLines(C.bubble), u, E.bubble, .3125), 40, { fill: true });
      boilSeed('off');
      const M = [660, 430, 606, 366];
      sketchPoly([[M[0], M[1]], [M[0] + M[2], M[1] - 6], [M[0] + M[2] + 6, M[1] + M[3]], [M[0] + 4, M[1] + M[3] + 6]], 1.1, PAPER, { over: 20, sep: 9, lifts: .3 });
      pen([[860, 806], [850, 900]], 1.2, PAPER, 'flat', { twice: 2, sep: 8 }); pen([[1060, 806], [1070, 900]], 1.2, PAPER, 'flat', { twice: 2, sep: 8 });
      const cx = M[0] + M[2] / 2, cy = M[1] + M[3] / 2, off = E.off, on = E.on;
      let fw = 1, fh = 1;
      if (u >= off && u < off + .5) { const k = seg(u, off, off + .5); fh = k < .5 ? lerp(1, .02, easeIn(k * 2)) : .02; fw = k < .5 ? 1 : lerp(1, 0, easeIn((k - .5) * 2)); }
      else if (u >= off + .5 && u < on) { fw = 0; fh = 0; }
      else if (u >= on && u < on + .5) { const k = seg(u, on, on + .5); fw = k < .5 ? lerp(0, 1, easeOut(k * 2)) : 1; fh = k < .5 ? .02 : lerp(.02, 1, easeOut((k - .5) * 2)); }
      if (fw > 0 && fh > 0) { boilSeed('face'); const w2 = (M[2] - 24) * fw / 2, h2 = Math.max(3, (M[3] - 24) * fh / 2); roughWash([[cx - w2, cy - h2], [cx + w2, cy - h2], [cx + w2, cy + h2], [cx - w2, cy + h2]], PAPER, { amp: fh > .5 ? 2 : .5, mis: 0 }); }
      if (fw >= 1 && fh >= 1) blot('me', cx - 60, cy + 10, 44, { petals: 11, splat: 5, eye: false });
      else if (fw === 0) {
        blot('meDark', cx - 60, cy + 10, 30, { petals: 10, splat: 3, eye: false, col: PAPER });
        const n = E.dots.filter(t => u >= t).length;
        for (let i = 0; i < n; i++) { boilSeed('dot' + i); wash(ellPts(cx + i * 30, cy + 20, 6, 6, 8, 1), PAPER); }
      }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (two knocks, the door swings open, the user steps in, checks in, the blot shows its work)
    knock: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, lerp(1000, 920, ease(seg(u, 0, dur))), 540, 1);
      const open = easeOut(seg(u, E.knocks[1], E.enter));
      const kn = E.knocks.filter(t => u >= t).length;
      if (u < E.knocks[1] + .1875) { boilSeed('knock' + kn); strays(1300, 520, 30, 3, PAPER, { a0: Math.PI, span: .6, len: 34 }); }
      if (open > 0) {
        boilSeed('door'); const x = 1300, y = 170, w = 380 * open, h = 770;
        roughWash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], PAPER, { amp: 3, mis: 0 });
        roughWash([[x, y + h], [x + w, y + h], [x + w + 260 * open, H + 40], [x - 160 * open, H + 40]], PAPER, { amp: 5, mis: 0 });
      }
      boilSeed('frameD'); sketchPoly([[1288, 158], [1692, 158], [1692, 940], [1288, 940]], 1.2, PAPER, { over: 14, sep: 8, closed: false });
      if (u >= E.enter) figure('you', lerp(1760, 1490, easeOut(seg(u, E.enter, E.enter + .625))), 940, 620);
      if (u >= E.bubble) bubble('how', 860, 240, 360, asLines(C.bubble), 52, { fill: true });
      lampCone('lamp', 430, 310, 90, 1000, 700);
      boilSeed('stack');
      for (let i = 0; i < 5; i++) sketchPoly([[250 + i * 6, 900 - i * 22], [470 + i * 4, 896 - i * 22], [476, 918 - i * 22], [254, 922 - i * 22]], .7, INK, { over: 8, sep: 4, twice: 1 });
      blot('me', 560, 720 - hopAt(u, E.hop, E.hop + .3125, 28), 72, { petals: 13, splat: 7 });
      if (u >= E.show) {
        const k = easeOut(seg(u, E.show, E.show + .5)), y = lerp(900, 560, k);
        boilSeed('show'); const pg = [[610, y - 70], [760, y - 76], [764, y + 40], [614, y + 44]];
        roughWash(pg, PAPER, { amp: 1.5, mis: 1 }); sketchPoly(pg, .8, INK, { over: 6, sep: 4 });
        boilSeed('showsq'); squiggle(630, y - 34, 110, { amp: 4, wave: 16, w: .55 }); squiggle(630, y - 6, 80, { amp: 4, wave: 16, w: .55 });
      }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: staged reveals (the user's notes pin up one a beat; old drafts get crossed out; paper balls fly)
    notes: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, 960, lerp(560, 520, ease(seg(u, 0, dur))), 1 + .03 * ease(seg(u, 0, dur)));
      const SLOTS = [[560, 150, 360, -.04], [980, 130, 380, .03], [1420, 170, 340, -.02], [700, 400, 380, .04], [1180, 390, 360, -.05]];
      asLines(C.notes).slice(0, 5).forEach((txt, i) => {
        const [x, y, w, rot] = SLOTS[i], d = dropIn(u, E.pins[i], 60);
        if (d !== null) pinned('n' + i, x, y + d, w, txt, 32, { rot: rot + (d / 60) * .12 });
      });
      const dx1 = dropIn(u, E.drafts[0], 50), dx2 = dropIn(u, E.drafts[1], 50);
      if (dx1 !== null) pinned('x1', 140, 230 + dx1, 300, ' ', 30, { rot: .06, minH: 220, scribble: 5, cross: u >= E.cross[0] });
      if (dx2 !== null) pinned('x2', 1610, 420 + dx2, 240, ' ', 30, { rot: -.08, minH: 200, scribble: 4, cross: u >= E.cross[1] });
      lampCone('lamp', 960, 640, 90, 1080, 640);
      const hop = E.pins.slice(0, asLines(C.notes).length).some(t0 => u >= t0 && u < t0 + .25) ? 14 : 0;
      blot('me', 960, 900 - hop, 62, { petals: 12, splat: 6 });
      [[260, 990, 30], [1560, 1000, 28], [420, 1020, 24]].forEach(([x, y, r], i) => {
        const t0 = E.balls[i]; if (t0 == null || u < t0) return;
        const k = easeOut(seg(u, t0, t0 + .4), 2), p = arcPt([960, 840], [x, y], 160, k); paperBall('ball' + i, p[0], p[1], r);
      });
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (the work is sealed in a parcel, stamped with the blot, sent LEFT out the door, and the
    // status lands: merged / pushed / deployed)
    ship: (C, E) => (u, dur, ci) => {
      room(true);
      cam(ci, u, lerp(1000, 880, ease(seg(u, 0, dur))), 540, 1);
      boilSeed('win2'); roughWash([[120, 200], [420, 200], [420, 760], [120, 760]], PAPER, { amp: 3, mis: 0 });
      sketchPoly([[108, 188], [432, 188], [432, 760], [108, 760]], 1.2, PAPER, { over: 14, sep: 8, closed: false });
      lampCone('lamp', 1180, 90, 120, 1060, 900, { cord: true });
      boilSeed('table2'); const top = [[860, 780], [1520, 770], [1540, 830], [840, 840]];
      roughWash(top, INK, { amp: 2, mis: 2 }); sketchPoly(top, .9, INK, { over: 14, sep: 6 });
      const sk = seg(u, E.send[0], E.send[1]), [px, py] = sk > 0 ? arcPt([1180, 690], [-260, 460], 200, easeIn(sk, 1.6)) : [1180, 690];
      if (px > -240) {
        const rot = -.25 * sk, c = Math.cos(rot), s2 = Math.sin(rot), Q = (dx, dy) => [px + dx * c - dy * s2, py + dx * s2 + dy * c];
        boilSeed('parcel'); const B = [Q(-190, -90), Q(190, -90), Q(190, 90), Q(-190, 90)];
        roughWash(B, PAPER, { amp: 2, mis: 1.5 }); sketchPoly(B, 1, INK, { over: 8, sep: 5 });
        pen([Q(0, -90), Q(0, 90)], .8, INK, 'flat'); pen([Q(-190, 0), Q(190, 0)], .8, INK, 'flat');
        let fs = 26; while (fs > 14 && measure(C.label || '', fs) > 330) fs--;
        if (C.label) letter(C.label, ...Q(-165, -40), fs, { rot });
        if (u >= E.seal) { boilSeed('tape'); pen([Q(-200, 30), Q(200, 30)], 2.2, INK, 'flat', { twice: 2, sep: 8 }); }
        if (u >= E.stamp) blot('stamp', ...Q(110, 50), 30 * backOut(seg(u, E.stamp, E.stamp + .2), 1.4) + 1, { petals: 11, splat: 3, eye: false });
        if (sk > 0 && sk < 1) strays(px + 240, py, 40, 4, PAPER, { a0: -.2, span: .4, len: 90, along: false });
      }
      const hop = hopAt(u, E.stamp - .25, E.stamp + .1, 30);
      blot('me', 1420, 700 - hop, 66, { petals: 12, splat: 6 });
      const d = dropIn(u, E.status, 50);
      if (d !== null && C.status) pinned('status', 1560, 240 + d, 280, C.status, 40, { rot: .05 });
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: sequenced UI life (two carousels spin; ours is off, then snaps into line on the beat) → swallow
    'side-by-side': (C, E) => (u, dur, ci) => {
      room(false);
      const sw = seg(u, E.swallow, dur);
      const bp = u < E.hop[0] ? [620, 900] : u < E.hop[1] ? arcPt([620, 900], [1320, 880], 120, ease(seg(u, E.hop[0], E.hop[1]))) : [1320, 880];
      cam(ci, u, lerp(960, bp[0], ease(sw)), lerp(540, bp[1], ease(sw)), 1 + .5 * easeIn(sw, 2));
      const fixed = u >= E.snap, spin = u * .7;
      const donut = (key, cx, cy, sp, rx, ry) => { for (let i = 0; i < 8; i++) { const a = sp + i / 8 * TAU, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; boilSeed(key + i); sketchPoly([[x - 34, y - 26], [x + 34, y - 26], [x + 34, y + 26], [x - 34, y + 26]], .6, INK, { over: 5, sep: 3, twice: 1 }); } };
      boilSeed('m1'); sketchPoly([[120, 220], [900, 214], [906, 690], [124, 696]], 1.1, INK, { over: 18, sep: 8 });
      boilSeed('m2'); sketchPoly([[1020, 214], [1800, 220], [1796, 696], [1016, 690]], 1.1, INK, { over: 18, sep: 8 });
      const [la, lb] = C.labels || ['ref', 'ours'];
      letter(la, 150, 270, 34); letter(lb, 1050, 270, 34);
      donut('d1', 512, 460, spin, 190, 90);
      donut('d2', 1408, 462, fixed ? spin : spin + .5, fixed ? 190 : 170, fixed ? 90 : 120);
      const rk = ease(seg(u, .3125, .9375)); if (rk > 0) { boilSeed('ruler'); pen([[1760, 778], [lerp(1760, 160, rk), 776]], 1, INK, 'flat', { twice: 2, sep: 7 }); for (let i = 16; i >= 0; i--) { const x = 160 + i * 100; if (x >= lerp(1760, 160, rk)) pen([[x, 760], [x, 800]], .6, INK, 'flat'); } }
      if (u >= E.bubble && C.bubble) bubble('close', 1240, 70, 520, asLines(C.bubble), 40);
      blot('me', bp[0], bp[1] - (fixed && u < E.snap + .3125 ? 18 : 0), 70 * (1 + 30 * easeIn(sw, 2.6)), { petals: 13, splat: 7 });
      camEnd();
      inkDisc('swallow-side', W / 2, H / 2, 2400 * easeIn(seg(u, E.swallow + .3125, dur), 2));
      caption(C.caption, typed(u, .15));
    },

    // route: staged reveals → climax (the praise lands, a held breath, then the blot opens to full size on the tutti)
    'good-part': (C, E) => (u, dur, ci) => {
      room(false);
      cam(ci, u, lerp(960, 900, ease(seg(u, E.tutti, dur))), 540, 1 + .05 * ease(seg(u, E.tutti, dur)));
      monitor('mon', 1180, 290, 600, 380, { onDark: false, stand: true });
      if (u >= E.bubble) bubble('ty', 1240, 400, 480, linesBy(asLines(C.bubble), u, E.bubble, .3125), 42);
      const g = backOut(seg(u, E.breath[1], E.tutti), 1.4), R = lerp(56, 300, g);
      blot('me', 640, 590, R, { petals: 14, splat: 14 });
      const rk = easeOut(seg(u, E.tutti, E.tutti + .625));
      if (rk > 0) { boilSeed('rays'); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + jit(.08), r0 = 400 + random() * 30, r1 = r0 + (60 + random() * 70) * rk; pen([[640 + Math.cos(a) * r0, 590 + Math.sin(a) * r0], [640 + Math.cos(a) * r1, 590 + Math.sin(a) * r1]], 1, INK, 'flat', { twice: random() < .5 ? 2 : 1, sep: 6 }); } }
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // route: animated sequence (the lesson flies LEFT into its gap on the shelf, the camera arrives on it) → lamp out
    kept: (C, E) => (u, dur, ci) => {
      room(true);
      if (u >= E.lampOff) { boilSeed('cordOff'); cam(ci, u, 760, 470, 1.18); pen([[1260, -20], [1260, 76]], .6, PAPER, 'flat', { lifts: .2 }); camEnd(); return; }
      const arrive = ease(seg(u, E.arrive[0], E.arrive[1]));
      cam(ci, u, lerp(960, 760, arrive), lerp(540, 470, arrive), 1 + .18 * arrive);
      const slots = shelf('shelf', 90, 150, 900, 4, 222, C.spines || [], { gap: { r: 1, x: 520 } });
      const [gx, gbase, gbw, gbh] = slots[0] || [520, 594, 44, 180];
      lampCone('lamp', 1260, 120, 110, 1070, 820, { cord: true });
      const hold = [1110, 560], slot = [gx + gbw / 2, gbase - gbh / 2];
      const fk = ease(seg(u, E.fly[0], E.fly[1])), sk = easeOut(seg(u, E.fly[1], E.land)), flying = u < E.fly[1];
      const [bx, by] = flying ? arcPt(hold, [slot[0], slot[1] - 40], 160, fk) : [slot[0], lerp(slot[1] - 40, slot[1], sk)];
      const a = lerp(-.3, 0, flying ? fk : 1), c = Math.cos(a), s = Math.sin(a), P = (dx, dy) => [bx + dx * c - dy * s, by + dx * s + dy * c];
      // the new book stands taller than its neighbours when its title needs it (just shelved, sticking up)
      const need = measure(C.newBook || '', 26) + 44, hw = flying ? 40 : Math.max(gbw / 2, 22), hh = flying ? Math.max(150, need / 2) : Math.max(gbh / 2, need / 2);
      const [bx2, by2] = flying ? [bx, by] : [bx, gbase - hh];
      const Pb = (dx, dy) => [bx2 + dx * c - dy * s, by2 + dx * s + dy * c];
      boilSeed('newbook');
      const face = [Pb(-hw, -hh), Pb(hw, -hh), Pb(hw, hh), Pb(-hw, hh)];
      roughWash(face, PAPER, { amp: 1.5, mis: 1 }); sketchPoly(face, .8, INK, { over: 6, sep: 4 });
      occlude(face, 1);   // spine labels under the book don't show through it
      letter(C.newBook || '', ...Pb(26 * .32, hh - 18), 26, { rot: -Math.PI / 2 + a, z: 2 });
      if (u > E.land && u < E.land + .3125) strays(slot[0], slot[1] + gbh / 2, 30, 3, PAPER, { a0: Math.PI * 1.1, span: .8, len: 30 });
      blot('me', 1290, 680, 70, { petals: 12, splat: 6 });
      air('air', 6, [1560, 200, 400, 600]);
      camEnd();
      caption(C.caption, typed(u, .15));
    },

    // the next morning: the desk, the command typed again, a new session starts
    tag: (C, E) => (u, dur, ci) => {
      cam(ci, u, 960 - 60 * ease(seg(u, E.enter, dur)), 540 - 40 * ease(seg(u, E.enter, dur)), 1 + .08 * ease(seg(u, E.enter, dur)));
      desk0();
      terminal(u, A.keysRel.map(d => E.enter + d), E.enter, C.command || 'claude');
      camEnd();
      caption(C.caption, typed(u, .15));
    },
  };

  chapters(S.chapters.map(C => {
    const T = A.types[C.type];
    if (!T || !ARCHETYPES[C.type]) throw new Error('unknown chapter type: ' + C.type);
    const out = C.out !== undefined ? C.out : T.out;
    return { name: C.caption, dur: T.bars * BAR, out, selfSwallow: !!T.selfSwallow, irisAt: [W / 2, H / 2], draw: ARCHETYPES[C.type](C, { ...T.events, ...(C.events || {}) }) };
  }));
})();
