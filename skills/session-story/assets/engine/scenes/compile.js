// compile.js: story.json → the film's schedule. Pure data, no drawing, so it runs in the page (director.js) and in
// node (scripts/schedule.mjs writes the score's timeline.json from the same code).
//
// A story is a list of beats. Every beat is a block of choreography with fixed internal timing, placed end to end:
//   open (implicit) → request → work → reply → [correction → work → reply] → praise → … → outro (implicit)
// Each block writes keys into shared tracks (mood, arms, gaze, camera, screen) and spawns the objects it owns (a plane,
// a reply sheet, a mallet, a butterfly). A block's keys replace whatever an earlier block left after its start, so
// adjacent blocks hand off without fighting. All times are seconds.
(function (root) {
  const CX = 960;
  const LIMITS = { request: [3, 16, 48], correction: [3, 13, 40], reply: [3, 16, 44], praise: [1, 26, 26] };   // lines, chars/line, total

  function wrap(text, maxLine) {
    if (Array.isArray(text)) return text.map(String);
    const words = String(text).trim().split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= maxLine) cur += ' ' + w; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur);
    return lines;
  }
  const chars = lines => lines.join(' ').length;

  // the beats are building blocks, not a template: any order the session really had is allowed. Only a reply needs
  // work before it (added when missing), and the film opens on a message from the user.
  const TYPES = ['request', 'work', 'reply', 'correction', 'praise'], KINDS = ['code', 'tests', 'terminal', 'page', 'doc', 'chart', 'image'];
  function normalize(beats, problems) {
    const out = [];
    const need = (cond, msg) => { if (!cond) problems.push(msg); };
    need(beats.length > 0, 'story.beats is empty: a session needs at least one message from the user');
    beats.forEach((b, i) => {
      const prev = out[out.length - 1], type = b && b.type;
      need(TYPES.includes(type), `beat ${i + 1}: unknown type "${type}" (${TYPES.join(', ')})`);
      if (type === 'reply' && !(prev && prev.type === 'work')) out.push({ type: 'work', size: prev && prev.type === 'correction' ? 'short' : 'normal', auto: true });
      if (type === 'work' && b.shows != null) need(KINDS.includes(b.shows), `beat ${i + 1} (work): "shows" is one of ${KINDS.join(', ')}`);
      if (b && b.time != null) need(/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(b.time)), `beat ${i + 1}: time "${b.time}" is local 24-hour HH:MM, like "14:05"`);
      out.push({ ...b, n: i + 1 });
    });
    need(!out.length || ['request', 'correction', 'praise'].includes(out[0].type), 'the first beat is a message from the user: the session starts when they send something');
    for (const b of out) {
      if (!LIMITS[b.type]) continue;
      const [nl, cl, total] = LIMITS[b.type];
      const at = `beat ${b.n} (${b.type})`;
      if (b.type === 'praise') { b.text = Array.isArray(b.text) ? b.text.join(' ') : String(b.text || ''); need(b.text.length > 0 && b.text.length <= total, `${at} "${b.text}": 1 to ${total} characters (it rides on a ribbon)`); continue; }
      b.lines = wrap(b.text || '', cl);
      need(b.lines.length > 0 && b.lines.join('').length > 0, `${at}: text is empty`);
      need(b.lines.length <= nl, `${at} "${b.lines.join(' ')}": at most ${nl} lines: cut it to a shorter verbatim span`);
      need(chars(b.lines) <= total, `${at} "${b.lines.join(' ')}": at most ${total} characters: cut it to a shorter verbatim span`);
      for (const l of b.lines) need(l.length <= cl, `${at} line "${l}": at most ${cl} characters a line`);
    }
    return out;
  }
  // the session's clock. With real times on the beats (local HH:MM, from their sources), the window and the wall clock
  // follow them; beats without one sit between their neighbours. With none, the day just wears on.
  const hourOf = s => { const [h, m] = String(s).split(':').map(Number); return h + m / 60; };
  function todOfHour(h) {   // 0 morning → .35 noon → .6 afternoon → .8 sunset → 1 night
    h = ((h % 24) + 24) % 24;
    const K = [[0, 1], [5, 1], [7, 0], [12, .35], [16, .6], [18.5, .8], [20, 1], [24, 1]];
    let i = 0; while (h > K[i + 1][0]) i++;
    return K[i][1] + (K[i + 1][1] - K[i][1]) * (h - K[i][0]) / (K[i + 1][0] - K[i][0]);
  }

  function compileStory(story) {
    story = story || {};
    const problems = [];
    const user = story.user || 'you';
    const hook = wrap(story.hook || ['Initiating session', `with ${user}`], 19);
    if (hook.length > 3 || hook.some(l => l.length > 19)) problems.push('hook: at most 3 lines of 19 characters (it types onto the monitor)');
    const nameplate = story.nameplate || `${user}’s favorite agent`;
    if (nameplate.length > 30) problems.push('nameplate: at most 30 characters');
    const beats = normalize(story.beats || [], problems);
    const kind0 = story.screen || 'code', ending = story.ending || 'next';
    if (!KINDS.includes(kind0)) problems.push(`screen: one of ${KINDS.join(', ')} (what the user's work looks like on the monitor)`);
    if (!['next', 'sleep'].includes(ending)) problems.push('ending: "next" (the next request is on its way) or "sleep" (back to sleep)');
    if (problems.length) { const e = new Error('story.json:\n  - ' + problems.join('\n  - ')); e.problems = problems; throw e; }

    const S = { user, hook, nameplate, typing: [], throws: [], folds: [], emoArms: [], holdsL: [], hits: [], gaze: [], screen: [], flashes: [],
      planes: [], replies: [], mallets: [], butterflies: [], trayAt: [], padAt: [], blocks: [], lampAt: null };
    const keyed = { mood: [], al: [], ar: [], zoom: [[0, 1.24], [3.4, 1.32], [3.7, 1.36], [5.0, 6.2], [6.25, 6.45], [7.2, 1.3]], camY: [[0, 610]] };
    const put = (name, keys) => { if (!keys.length) return; const L = keyed[name]; while (L.length && L[L.length - 1][0] >= keys[0][0]) L.pop(); L.push(...keys); };

    // ---------- open: asleep → the monitor boots → the hook types → pushed in → morning → awake (always 0 – 9 s) ----------
    put('mood', [[0, 'sleepy'], [7.25, 'surprised'], [7.75, 'sleepy', { eyes: 'closed', mouth: 'yawn', emote: null }], [8.7, 'happy'], [9.4, 'neutral']]);
    put('al', [[0, -1.0], [7.2, -1.0], [7.35, -.6], [8.9, -.85]]); put('ar', [[0, -1.0], [7.2, -1.0], [7.35, -.6], [8.9, -.85]]);
    S.emoArms.push([7.25, 7.75]); S.gaze.push([7.25, 7.8, 'screen']);
    S.screen.push([0, 'off', 0], [3.2, 'boot', [3.2, 3.5, 0, 1]], [3.5, 'hook', [3.6, 5.0, 0, 1]], [7.3, 'code', .45, kind0]); S.flashes.push(3.5);
    S.blocks.push({ type: 'open', S: 0, end: 9.0, at: { boot: 3.2, screen: 3.5, type: [3.6, 5.0], hook: 5.0, out: 6.3, wake: 7.25, yawn: 7.8 } });

    let T = 9.0, lead = .58, nReq = 0, nPraise = 0;
    // incoming flights, relative to the plane's first frame: [t, x, y, scale]
    const GLIDE = { K: [[0, 360, 330, .12], [.25, 425, 322, .28], [.5, 530, 345, .42], [.8, 760, 392, .44], [1.1, 960, 430, .38], [1.35, 1150, 492, .42],
      [1.58, 1185, 590, .48], [1.8, 1040, 682, .52], [2.02, 830, 728, .5], [2.2, 770, 738, .5]], land: 2.2, behind: [.9, 1.3], dir: -1, grab: .32 };
    const LOOP = { K1: [[0, 360, 330, .12], [.2, 405, 420, .32], [.35, 455, 548, .45], [.45, 520, 560, .5]], loop: [.45, 1.05], c: [520, 475], r: 85,
      K2: [[1.05, 520, 560, .5], [1.25, 628, 676, .5], [1.45, 740, 738, .5]], land: 1.45, dir: 1, grab: .47 };
    const sh = (K, T) => K.map(k => [k[0] + T, ...k.slice(1)]);
    // butterflies: two flight paths (landing on the left and the right of the head), used alternately
    const FLY = [
      { K: [[0, 380, 300, .35], [.35, 470, 330, .7], [.8, 620, 290, 1], [1.2, 760, 360, 1], [1.55, 860, 440, 1], [1.8, 910, 510, 1], [2.0, 925, 546, 1]],
        glide: [.85, 1.15], brake: [1.75, 2.0], land: 2.0, spot: -35, drape: [[-110, 26], [-190, 110], [-222, 150]] },
      { K: [[0, 380, 300, .35], [.4, 500, 320, .75], [.8, 700, 262, 1], [1.2, 880, 360, 1], [1.45, 975, 470, 1], [1.6, 1000, 546, 1]],
        glide: [.85, 1.1], brake: [1.35, 1.6], land: 1.6, spot: 40, drape: [[150, 30], [240, 150], [262, 196]] }];

    const longs = beats.map((b, i) => b.type === 'work' && b.size === 'long' ? i : -1).filter(i => i >= 0), lastLong = longs[longs.length - 1];
    beats.forEach((b, bi) => {
      if (b.type === 'request') {
        const v = b.flight === 'loop' ? LOOP : GLIDE, L = T + v.land, G = L + v.grab, i = nReq++;
        S.planes.push({ key: 'in' + i, t0: T, K: v === LOOP ? [sh(v.K1, T), sh(v.K2, T)] : [sh(v.K, T)], loop: v === LOOP ? { a: T + v.loop[0], b: T + v.loop[1], c: v.c, r: v.r } : null,
          land: L, behind: v.behind ? [T + v.behind[0], T + v.behind[1]] : null, dir: v.dir, grab: G, unfold: [G + .28, G + .98], putdown: G + 2.38, lines: b.lines });
        put('al', [[L + .1, -.85], [G, -1.05], [G + .48, .55], [G + 2.18, .55], [G + 2.38, -.3], [G + 2.63, -.78]]);
        put('ar', [[G + 2.48, -.85], [G + 2.63, -.72]]);
        S.holdsL.push([G, G + 2.38]);
        const react = b.react === 'excited' ? 'excited' : 'idea';
        put('mood', [[G + 1.78, react], [G + 2.53, 'determined']]);
        S.gaze.push([T + .3, G - .12, { plane: S.planes.length - 1 }], [G - .12, G + .98, [640, 520]], [G + .98, G + 2.18, { scan: G + .98 }], [G + 2.18, G + 2.88, [560, 690]]);
        S.screen.push([G, 'code', .5]); S.trayAt.push(G + 2.88);
        const end = G + 2.58;
        S.blocks.push({ type: 'request', S: T, end, lines: b.lines, beat: b, first: i === 0, flight: b.flight === 'loop' ? 'loop' : 'glide', react,
          at: { land: L, grab: G, unfold: [G + .28, G + .98], read: [G + .98, G + 2.18], react: G + 1.78, putdown: G + 2.38, loop: v === LOOP ? [T + v.loop[0], T + v.loop[1]] : null } });
        T = end;
      } else if (b.type === 'work') {
        const size = ['short', 'normal', 'long'].includes(b.size) ? b.size : 'normal', night = bi === lastLong, kind = b.shows || kind0;
        put('al', [[T, -.78]]); put('ar', [[T, -.72]]);
        let dur, done;
        if (size === 'short') { dur = 1.25; done = T + dur; S.typing.push([T, T + dur, 1.3, 1.3]); S.screen.push([T, 'code', .7, kind], [T + dur, 'result', 1, kind]); S.gaze.push([T, T + dur, 'screen']); lead = .2; }
        else if (size === 'normal') { dur = 1.9; done = T + 1.8; S.typing.push([T, T + dur, 1.4, 1.4]); S.screen.push([T, 'code', [T, T + 1.8, .45, 1], kind], [T + 1.8, 'result', 1, kind]); S.flashes.push(done);
          put('mood', [[T + 1.85, 'proud']]); S.emoArms.push([T + 1.85, T + 2.2]); S.gaze.push([T, T + 1.85, 'screen']); lead = .58; }
        else { dur = 4.05; done = T + dur; S.typing.push([T, T + dur, 1.6, 1.6]); S.screen.push([T, 'code', .6, kind], [T + .2, 'render', [T + .2, T + 4.0, 0, 1]], [T + dur, 'ok', 1]); S.flashes.push(done);
          put('mood', [[T + 4.15, 'proud']]); S.emoArms.push([T + 4.15, T + 4.5]); put('zoom', [[T + .1, 1.3], [T + 4.0, 1.38], [T + 4.8, 1.3]]); S.gaze.push([T - .1, T + 4.1, 'screen']);
          lead = .55; }
        S.blocks.push({ type: 'work', S: T, end: T + dur, size, longest: night, shows: kind, auto: !!b.auto, beat: b, at: { done } });
        T += dur;
      } else if (b.type === 'reply') {
        const G = T + lead, n = chars(b.lines), Td = Math.min(1.2, Math.max(.5, .3 + .017 * n)), ty0 = G + .57, ty1 = ty0 + Td, F0 = ty1 + .45, F1 = F0 + .9, rel = F1 + .44;
        put('al', (lead >= .4 ? [[T, -.78], [T + .15, -.9], [G - .23, -.9], [G, -1.18]] : [[T, -.78], [T + .1, -.9], [G, -1.18]])
          .concat([[G + .47, .55], [F1, .55], [F1 + .15, .9], [rel + .91, -.85]]));
        put('ar', [[T, -.72], [T + .15, -.85], [G + .52, -.85], [G + .62, -.72], [ty1, -.72], [ty1 + .15, -.85]]);
        S.throws.push({ t0: F1 + .15, rel }); S.typing.push([G + .62, ty1, 0, 1.1]); S.folds.push([F0, F1]); S.holdsL.push([G, rel]);
        put('mood', [[G + .42, 'happy'], [rel - .03, 'excited'], [rel + .71, 'happy']]);
        S.gaze.push([G - .23, F1 + .15, [640, 500]], [F1 + .15, rel + 1.0, 'planeOut']);
        S.padAt.push(G);
        S.replies.push({ key: 'r' + S.replies.length, grab: G, up: G + .47, type: [ty0, ty1], fold: [F0, F1], carry: [F1, F1 + .25], rel, lines: b.lines });
        const end = rel + .9;
        S.blocks.push({ type: 'reply', S: T, end, lines: b.lines, beat: b, at: { grab: G, type: [ty0, ty1], fold: [F0, F1], windup: F1 + .15, rel } });
        T = end;
      } else if (b.type === 'correction') {
        const M = { enter: T, hang: T + .5, swing: T + .75, hit: T + .91, lift: T + 1.33, turn: T + 1.53, show: T + 2.13, jabs: [T + 2.5, T + 3.0], exit: T + 3.75, gone: T + 4.3, msg: b.lines };
        S.mallets.push(M); S.hits.push({ t: M.hit, k: 1 });
        put('mood', [[T + .5, 'surprised'], [T + .91, 'ko'], [T + 1.35, 'dizzy'], [T + 2.05, 'nervous'], [T + 4.0, 'determined']]);
        S.emoArms.push([T + .5, T + .89], [T + .91, T + 2.05], [T + 2.05, T + 3.85]);
        S.gaze.push([T + .3, T + .91, [1000, 250]], [T + 2.05, T + 3.8, [CX, 400]]);
        put('zoom', [[T - .25, 1.3], [T + .35, 1.22], [T + 1.05, 1.22], [T + 1.85, 1.3], [T + 2.45, 1.36], [T + 3.75, 1.36], [T + 4.75, 1.3]]);
        S.screen.push([T + .95, 'error', 1]);
        put('al', [[T + 3.95, -.85], [T + 4.1, -.78]]); put('ar', [[T + 3.95, -.85], [T + 4.1, -.72]]);
        const end = T + 4.05;
        S.blocks.push({ type: 'correction', S: T, end, lines: b.lines, beat: b, at: { hang: M.hang, swing: M.swing, hit: M.hit, lift: M.lift, show: M.show, jabs: M.jabs, exit: M.exit, gone: M.gone } });
        T = end;
      } else if (b.type === 'praise') {
        const j = nPraise++, v = FLY[j % 2], L = T + v.land;
        S.butterflies.push({ key: 'b' + j, K: sh(v.K, T), glide: [T + v.glide[0], T + v.glide[1]], brake: [T + v.brake[0], T + v.brake[1]], land: L, spot: v.spot, drape: v.drape, txt: b.text, leave: null, start: T });
        put('mood', [[T + .45, 'hopeful'], [L + .45, 'love'], [L + 1.8, 'happy']]);
        S.emoArms.push([T + .45, L], [L + .45, L + 1.6]);
        S.gaze.push([T, L, { butterfly: j }], [L, L + 1.5, [CX - 20, 400]]);
        put('zoom', [[L - .4, 1.3], [L + .6, 1.37], [L + 1.5, 1.37], [L + 2.2, 1.3]]); put('camY', [[L - .4, 610], [L + .6, 596], [L + 1.5, 596], [L + 2.2, 610]]);
        S.screen.push([L + .45, 'ok', 1]); S.flashes.push(L + .45);
        const end = L + 1.6;
        S.blocks.push({ type: 'praise', S: T, end, text: b.text, beat: b, at: { land: L, love: L + .45 } });
        T = end;
      }
    });

    // ---------- outro: the next request is already on its way and a wink, or back to sleep; the iris closes ----------
    const O = T;
    let D;
    if (ending === 'sleep') {
      put('mood', [[O + .3, 'sleepy', { eyes: 'closed', mouth: 'yawn', emote: null }], [O + .95, 'sleepy']]);
      put('al', [[O + .6, -1.0]]); put('ar', [[O + .6, -1.0]]); S.emoArms.push([O + .3, O + .6]);
      S.gaze.push([O, O + .3, 'screen']); S.screen.push([O + 1.2, 'off', 0]); S.sleepAt = O + .7;
      D = Math.ceil((O + 2.8) * 24) / 24; S.iris = { close: O + 1.5, end: D };
      S.blocks.push({ type: 'outro', S: O, end: D, ending, at: { yawn: O + .3, sleep: O + .7, off: O + 1.2, close: O + 1.5 } });
    } else {
      S.planes.push({ key: 'next', t0: O, K: [[[O, 360, 330, .12], [O + 1.5, 430, 322, .3], [O + 3, 520, 400, .45]]], loop: null, land: O + 3, behind: null, dir: 1, far: true });
      S.gaze.push([O, O + .65, [330, 330]]); put('mood', [[O + .65, 'playful']]); S.emoArms.push([O + .65, O + 2.3]);
      D = Math.ceil((O + 2.3) * 24) / 24; S.iris = { close: O + 1.0, end: D };
      S.blocks.push({ type: 'outro', S: O, end: D, ending, at: { wink: O + .65, close: O + 1.0 } });
    }
    S.duration = D;

    // a landed butterfly flies off when the next correction swings in, or when a third would crowd the head
    S.butterflies.forEach((B, j) => {
      const corr = S.mallets.find(M => M.enter > B.land), third = S.butterflies[j + 2];
      const c = [corr && corr.enter, third && third.start].filter(x => x != null);
      B.leave = c.length ? Math.min(...c) : null;
    });
    // the time of day. Asleep it's night; while the camera is inside the monitor it turns to the session's start. Real
    // times on the beats: the sky and the wall clock follow them. None: the day wears on and the last long build runs
    // into night.
    const tod = [[0, 1], [5.05, 1]], timed = S.blocks.filter(b => b.beat && b.beat.time != null);
    if (timed.length) {
      const bs = S.blocks.filter(b => b.beat), known = bs.map(b => b.beat.time != null ? hourOf(b.beat.time) : null);
      let base = 0, last = null;   // unwrap midnight: a time far before the last one is the next day
      for (let i = 0; i < known.length; i++) if (known[i] != null) { if (last != null && known[i] + base < last - 6) base += 24; known[i] += base; last = known[i]; }
      // untimed: work starts right after what it answers, a reply goes out just before the user's next message (so
      // the hours pass during the work), anything else follows the beat before it
      const M2 = 2 / 60, type = i => bs[i].type;
      for (let i = 1; i < known.length; i++) if (known[i] == null && type(i) === 'work' && known[i - 1] != null) known[i] = known[i - 1] + M2;
      for (let i = known.length - 2; i >= 0; i--) if (known[i] == null && type(i) === 'reply' && known[i + 1] != null) known[i] = known[i + 1] - M2;
      const first = known.findIndex(h => h != null);
      for (let i = first - 1; i >= 0; i--) known[i] = known[i + 1] - M2;
      for (let i = first + 1; i < known.length; i++) if (known[i] == null) known[i] = known[i - 1] + M2;
      bs.forEach((b, i) => { b.clock = known[i]; });
      tod.push([6.2, todOfHour(known[0])]); bs.forEach(b => tod.push([b.S, todOfHour(b.clock)]));
      tod.push([D, todOfHour(known[known.length - 1] + 2 / 60)]);
      S.hours = [[0, known[0]], ...bs.map(b => [b.S, b.clock]), [D, known[known.length - 1] + 2 / 60]];
    } else {
      const LB = S.blocks.find(b => b.type === 'work' && b.longest);
      tod.push([6.2, .02]);
      if (LB) tod.push([LB.S, .55], [LB.S + 3.9, 1], [Math.max(D, LB.S + 4), 1]); else tod.push([D, .6]);
      S.hours = null;
    }
    for (let i = tod.length - 1; i > 0; i--) if (tod[i][0] <= tod[i - 1][0]) tod.splice(i, 1);
    S.tod = tod;
    const todLin = t => { let i = 0; while (i < tod.length - 2 && t > tod[i + 1][0]) i++; const [a, va] = tod[i], [b2, vb] = tod[i + 1]; return va + (vb - va) * Math.min(1, Math.max(0, (t - a) / (b2 - a))); };
    for (const b of S.blocks) { b.night = todLin(b.S) > .85; delete b.beat; }
    for (let t = 6.3; t < D; t += .05) if (todLin(t) >= .86) { S.lampAt = t; break; }
    put('camY', [[D, 610]]); put('zoom', [[D, 1.3]]);
    S.mood = keyed.mood; S.al = keyed.al; S.ar = keyed.ar; S.zoom = keyed.zoom; S.camY = keyed.camY;
    S.padN = Math.max(6, S.replies.length + 2);
    return S;
  }

  // the moments worth a still frame when checking a build (npx hyperframes snapshot --at ...)
  function keyMoments(S) {
    const m = [[5.4, 'hook'], [8.2, 'yawn']];
    for (const b of S.blocks) {
      if (b.type === 'request') m.push([b.at.unfold[1] + .3, 'request: ' + b.lines.join(' ')]);
      if (b.type === 'reply') m.push([b.at.type[1] + .1, 'reply typed'], [b.at.fold[1] - .1, 'reply folded'], [b.at.rel + .15, 'thrown']);
      if (b.type === 'correction') m.push([b.at.hit + .03, 'bonk'], [b.at.show + .5, 'mallet: ' + b.lines.join(' ')]);
      if (b.type === 'praise') m.push([b.at.land - .6, 'butterfly'], [b.at.love + .3, 'praise: ' + b.text]);
      if (b.type === 'work' && b.size === 'long') m.push([b.at.done - 1, 'long build']);
      if (b.type === 'outro') m.push(b.ending === 'sleep' ? [b.at.off + .4, 'back to sleep'] : [b.at.wink + .2, 'wink']);
    }
    return m.map(([t, what]) => [Math.round(t * 100) / 100, what]);
  }

  root.compileStory = compileStory;
  root.storyKeyMoments = keyMoments;
  if (typeof module !== 'undefined' && module.exports) module.exports = { compileStory, keyMoments };
})(typeof window !== 'undefined' ? window : globalThis);
