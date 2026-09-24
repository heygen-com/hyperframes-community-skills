// director.js: the film, one continuous shot of the agent at its desk, played from the schedule compile.js makes out
// of story.json. Requests glide in as paper planes and unfold; the agent types each reply onto a sheet, folds it and
// throws it back; corrections are a mallet that bonks, then turns its face to camera with the words on it; praise is a
// butterfly towing the words on a ribbon. Everything is a pure function of t. Motion is authored as physics where it
// can be: glides with a phugoid, flare and slide; throws that inherit the hand's velocity; a swing that accelerates
// into the hit and rebounds off the head it squashes; wingbeats that lift the body on the downstroke.
(() => {
  const SCH = compileStory(window.STORY);
  window.SCHEDULE = SCH;
  const { cx, gy, u } = DESK;
  const CAST = window.CAST || clawd;                     // the agent's character: Clawd, or your own (references/cast.md)
  const E7 = cubicBezierEase(.857, 0, .143, 1);          // the overlap ease (keyframe-overlap): 7× peak velocity
  const EIO = x => (x = clamp(x), x * x * (3 - 2 * x));
  const DUR_ = SCH.duration;

  // ---------- keys: monotone cubic through [t, v...] rows (no overshoot; velocity carries through inner keys) ----------
  const SL = new WeakMap();
  function mono(t, K, j = 1) {
    const n = K.length; if (t <= K[0][0]) return K[0][j]; if (t >= K[n - 1][0]) return K[n - 1][j];
    let c = SL.get(K); if (!c) SL.set(K, c = {});
    if (!c[j]) { const d = [], m = []; for (let k = 0; k < n - 1; k++) d.push((K[k + 1][j] - K[k][j]) / (K[k + 1][0] - K[k][0]));
      m[0] = d[0]; m[n - 1] = d[n - 2]; for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
      for (let k = 0; k < n - 1; k++) { if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; } const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b; if (s > 9) { const r = 3 / Math.sqrt(s); m[k] = r * a * d[k]; m[k + 1] = r * b * d[k]; } } c[j] = m; }
    const m = c[j]; let i = 0; while (t > K[i + 1][0]) i++;
    const h = K[i + 1][0] - K[i][0], s = (t - K[i][0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * K[i][j] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * K[i + 1][j] + (s3 - s2) * h * m[i + 1];
  }
  // a track of [t, value, ease] keys: holds between keys, moves into each key with its ease (default E7)
  function track(t, K) {
    if (t <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const a = K[i - 1], b = K[i], e = b[2] || E7; return lerp(a[1], b[1], e((t - a[0]) / (b[0] - a[0]))); }
    return K[K.length - 1][1];
  }
  const win = (t, a, b, r = .15) => clamp(Math.min((t - a) / r, (b - t) / r));   // a soft on/off window
  const spr = (t, t0, k, w) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
  const todAt = t => mono(t, SCH.tod);
  const inAny = (t, L) => L.some(([a, b]) => t >= a && t <= b);

  // ---------- the agent's acting ----------
  const { mood: MOOD, al: AL, ar: AR, typing: TYPING, throws: THROWS, folds: FOLDS, emoArms: EMO_ARMS, holdsL: HOLDS_L, hits: HITS } = SCH;
  function throwArm(t, T) {   // wind-up over the head, snap forward, release, follow through and settle
    const w = T.t0, r = T.rel;
    if (t < w) return null; if (t > r + .9) return null;
    if (t < r - .025) { const k = EIO((t - w) / (r - .025 - w)); return { a: lerp(.9, 2.05, k), rot: .1 * k, sq: .06 * k }; }
    if (t < r + .045) { const k = clamp((t - (r - .025)) / .07); return { a: lerp(2.05, .45, k * k), rot: lerp(.1, -.08, k), sq: lerp(.06, -.05, k) }; }
    const s = t - (r + .045);
    return { a: -.85 + (1.3 * Math.exp(-5 * s)) * Math.cos(s * 6), rot: -.08 * Math.exp(-5 * s) * Math.cos(s * 9), sq: -.05 * Math.exp(-7 * s) };
  }
  // the character's pose (front view) + the world points we attach things to (the anchor contract: references/cast.md)
  function bodyTf(o) {
    const x0 = cx + (o.dx || 0) * u, y0 = gy + (o.dy || 0) * u, sq = o.sq || 0, r = o.rot || 0, cr = Math.cos(r), sr = Math.sin(r);
    const sx = 1 + sq * .6, sy = 1 - sq;
    return (lx, ly) => [x0 + cr * sx * lx - sr * sy * ly, y0 + sr * sx * lx + cr * sy * ly];
  }
  function armTip(o, side) {
    const a = side < 0 ? (o.aL ?? .2) : (o.aR ?? .2), px = side < 0 ? -4.9 : 4.9, shift = side * .55 * clamp((Math.abs(a) - .7) / .9);
    const pvx = (px + shift) * u, pvy = -4.5 * u, L = 2.2 * u;
    const lx = side < 0 ? pvx - L * Math.cos(a) : pvx + L * Math.cos(a), ly = pvy - L * Math.sin(a);
    return bodyTf(o)(lx, ly);
  }
  const headTop = (o, lx = 0) => bodyTf(o)(lx, -8 * u);
  const eyePt = o => bodyTf(o)(0, -6 * u);

  // ---------- impacts: the hits and what they shake ----------
  function squashOf(t) {   // the body after a hit: flattened, springs back past round, settles
    let sq = 0, dy = 0;
    for (const h of HITS) { const s = t - h.t; if (s < 0 || s > 1.4) continue;
      sq += h.k * (.46 * Math.exp(-5.2 * s) * Math.cos(13 * s)); dy += h.k * .5 * Math.exp(-6 * s); }
    return { sq, dy };
  }
  function fxAt(t) {
    const f = { mug: { dy: 0, rot: 0 }, phones: 0, wob: 0, kb: 0, tray: 0, shake: 0 };
    for (const h of HITS) { const s = t - h.t; if (s < 0 || s > 2.5) continue;
      const hop = s < .2 ? 260 * s - 1300 * s * s : s < .3 ? (() => { const q = s - .2; return 90 * q - 900 * q * q; })() : 0;
      f.mug.dy -= h.k * Math.max(0, hop); f.mug.rot += h.k * .12 * Math.exp(-6 * s) * Math.sin(20 * s);
      f.phones += h.k * .38 * Math.exp(-2.2 * s) * Math.sin(9.5 * s);
      f.wob += h.k * .03 * Math.exp(-5 * s) * Math.sin(24 * s);
      f.kb -= h.k * 5 * Math.exp(-18 * s) * Math.abs(Math.sin(30 * s));
      f.tray += h.k * 7 * Math.exp(-7 * s) * Math.abs(Math.sin(16 * s));
      f.shake += h.k * 15 * Math.exp(-7 * s);
    }
    return f;
  }

  // ---------- the paper: every note and plane, one life cycle each ----------
  const PP = PAPER_POSE;
  const HELD_S = .95, PLANE_S = .5;
  const heldAt = (tip, s = HELD_S, tilt = -.05) => [tip[0] - (PAPER.W / 2 - 16) * s * Math.cos(tilt) + (PAPER.H / 2 - 16) * s * Math.sin(tilt), tip[1] - (PAPER.H / 2 - 16) * s * Math.cos(tilt) - (PAPER.W / 2 - 16) * s * Math.sin(tilt)];
  // incoming planes glide in from outside the window. A paper plane glides at about 3:1, so from the window to the
  // desk it needs a long way down: a banked circle in at the window, behind the head, round the right side, back in
  // front and down onto the pad. The joyful variant loops the loop first.
  function inFlight(t, F) {
    const L = F.loop;
    if (L && t > L.a && t < L.b) {   // a loop-the-loop: up the right side, over the top, down the left, same speed in and out
      const ph = (t - L.a) / (L.b - L.a) * TAU;
      return [L.c[0] + L.r * Math.sin(ph), L.c[1] + L.r * Math.cos(ph), .5];
    }
    const K = L && t >= L.b ? F.K[1] : F.K[0];
    return [mono(t, K, 1), mono(t, K, 2), mono(t, K, 3)];
  }
  const lastKey = F => F.K[F.K.length - 1][F.K[F.K.length - 1].length - 1];
  const restR = (s, dir = 1) => PP.flight([dir, .02 + .08 * Math.exp(-6 * s) * Math.cos(s * 18), -.2], 0, .75);
  function planeIn(t, F) {   // position + pose of an incoming plane until it comes to rest
    const t0 = F.t0, landT = F.land, loop = F.loop; if (t < t0) return null;
    if (t <= landT) {
      const p = inFlight(t, F), q = inFlight(t + .012, F), pm = inFlight(t - .012, F);
      const env = 1 - seg(t, landT - .45, landT - .1);
      const ph = 10 * Math.sin((t - t0) * TAU * 1.5) * env;   // the phugoid: a paper plane porpoises
      const vx = q[0] - pm[0], vy = q[1] - pm[1], dz = (q[2] - pm[2]) * 900;
      const inLoop = loop && t > loop.a && t < loop.b;
      const turn = Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.atan2(p[1] - pm[1], p[0] - pm[0]);
      const flare = seg(t, landT - .22, landT);
      const f = [vx, vy - Math.hypot(vx, vy) * .35 * flare, dz];
      let R = PP.flight(f, clamp(-6 * turn, -.6, .6), inLoop ? .2 : .75);
      const kb = EIO(seg(t, landT - .15, landT)); if (kb > 0 && !F.far) R = PP.mat(PP.slerp(PP.quat(R), PP.quat(restR(0, F.dir)), kb));   // flares into the landing attitude
      return { x: p[0], y: p[1] + (inLoop ? 0 : ph * .4), s: p[2], R, fold: 1 };
    }
    // touchdown: a hop, a short slide on friction, the nose settles
    const s = t - landT, K = lastKey(F), slide = 12 * F.dir * (1 - Math.exp(-9 * s)), hop = s < .12 ? -4 * Math.sin(s / .12 * Math.PI) : 0;
    return { x: K[1] + slide, y: K[2] + hop, s: K[3], R: restR(s, F.dir), fold: 1 };
  }
  // pick up + unfold: the plane rides the hand up, turns to face us, unfolds, and settles into the hand
  function pickedUp(t, rest, tip, g) {   // g: { grab, unfold: [a, b] }
    const kl = E7(seg(t, g.grab + .05, g.grab + .6)), R0 = PP.quat(rest.R);
    const held = heldAt(tip), carry = [tip[0] - 6, tip[1] - 14];
    const k1 = E7(seg(t, g.grab, g.grab + .1));
    const pos = [lerp(lerp(rest.x, carry[0], k1), held[0], kl), lerp(lerp(rest.y, carry[1], k1), held[1], kl)];
    const fold = 1 - clamp((t - g.unfold[0]) / (g.unfold[1] - g.unfold[0]));
    const flutter = .06 * spr(t, g.unfold[1], 6, 16);   // the sheet settles in the hand
    return { x: pos[0], y: pos[1], s: lerp(rest.s, HELD_S, kl), R: PP.mat(PP.slerp(R0, PP.quat(PP.facing(-.05 + flutter, 0)), kl)), fold, creased: true };
  }
  // a held note put down: released from the hand, it falls fluttering into the tray
  function fallToTray(t, rel, from) {
    const s = clamp((t - rel) / .5), sway = Math.sin(s * TAU * 1.2) * (1 - s);
    return { x: lerp(from[0], 536, EIO(s)) + 36 * sway, y: lerp(from[1], 716, s * s), s: lerp(HELD_S, .3, EIO(s)),
             R: PP.facing(-.05 + .35 * sway, -1.3 * EIO(s)), fold: 0, creased: true };
  }
  // a reply: torn from the pad, typed into, folded, carried to the hand, thrown, flown out through the window
  function reply(t, g, tipOf) {
    if (t < g.grab) return null;
    const tip = tipOf(t);
    const pin = [PAPER.W / 2 - 16, PAPER.H / 2 - 16];
    const heldState = s => { const k = E7(seg(s, g.grab, g.up)), tp = tipOf(s), from = [756, 760];
      const flutter = .07 * spr(s, g.up, 5, 14) - .03 * spr(s, g.fold[1], 6, 18);
      const kf = clamp((s - g.fold[0]) / (g.fold[1] - g.fold[0])), yaw = 1.05 * EIO(seg(kf, .5, 1)), lean = .35 * EIO(seg(kf, .55, 1));
      return { x: lerp(from[0], tp[0], k), y: lerp(from[1], tp[1], k), pin, s: lerp(.24, HELD_S, k), R: PP.facing(-.05 + flutter, lerp(-1.35, 0, k) + lean, yaw),
               fold: clamp((s - g.fold[0]) / (g.fold[1] - g.fold[0])), lines: g.lines, typed: seg(s, g.type[0], g.type[1]), paper: REPLY.paper, ink: REPLY.ink }; };
    if (t < g.carry[0]) return heldState(t);
    const Rf = PP.flight([-.82, -.55, .15], .1, .75);
    if (t < g.rel) {   // carried to the fingertips, nose toward the window, and wound up
      const k = E7(seg(t, g.carry[0], g.carry[1])), c0 = paperModel({ ...heldState(g.carry[0]), measure: true }).centroid, at = [tip[0] - 20, tip[1] - 26];
      return { x: lerp(c0[0], at[0], k), y: lerp(c0[1], at[1], k), s: lerp(HELD_S, PLANE_S * 1.2, k), R: PP.mat(PP.slerp(PP.quat(heldState(g.carry[0]).R), PP.quat(Rf), k)), fold: 1, paper: REPLY.paper };
    }
    // released with the hand's own velocity, then a glide out through the window, shrinking into the distance
    const t0 = g.rel, p0 = [tipOf(t0)[0] - 20, tipOf(t0)[1] - 26], pm = [tipOf(t0 - .02)[0] - 20, tipOf(t0 - .02)[1] - 26];
    const v0 = [(p0[0] - pm[0]) / .02, (p0[1] - pm[1]) / .02], s = t - t0, D = .8;
    if (s > D + .3) return null;
    const k = clamp(s / D), exit = [330, 300], out = [300, 286];
    const herm = q => { const a = 2 * q ** 3 - 3 * q * q + 1, b = q ** 3 - 2 * q * q + q, c = -2 * q ** 3 + 3 * q * q, d = q ** 3 - q * q;
      return [a * p0[0] + b * v0[0] * D * .5 + c * exit[0] + d * -260 * D, a * p0[1] + b * v0[1] * D * .5 + c * exit[1] + d * -40 * D]; };
    let [x, y] = herm(k);
    if (s > D) { const q = (s - D) / .3; x = lerp(exit[0], out[0], q); y = lerp(exit[1], out[1], q); }
    const [xn, yn] = herm(Math.min(k + .02, 1));
    const f = s > D ? [-1, -.3, -.6] : [xn - x, yn - y, -30 * (1 + k)];
    return { x, y, s: PLANE_S * 1.2 * lerp(1, .2, EIO(seg(s, .2, D + .3))), R: PP.flight(f, .15 * Math.sin(s * 9), .75), fold: 1, gone: s > D + .25, paper: REPLY.paper };
  }

  // ---------- the mallets ----------
  // A mallet swings on an arc about an off-screen grip: ε is how far above the hit it is (radians). Its face leads the
  // swing; at the hit the handle lies level and the face points straight down on the head.
  function swingPose(side, eps, G, Lh) {
    const dir = side > 0 ? [-Math.cos(eps), -Math.sin(eps)] : [Math.cos(eps), -Math.sin(eps)];
    const C = [G[0] + Lh * dir[0], G[1] + Lh * dir[1], 0], Hd = [-dir[0], -dir[1], 0];
    const A = side > 0 ? [-Math.sin(eps), Math.cos(eps), -.18] : [Math.sin(eps), Math.cos(eps), -.18];
    return { C, A, Hd };
  }
  const MALLET = { R: 148, S: 430, Lh: 600, side: 1, x: cx };
  function mallet(t, M, o) {
    if (t < M.enter || t > M.gone) return null;
    const faceDown = MALLET.S / 2 * .984, top = headTop(o, 0)[1];   // the head, as squashed right now
    const G = [MALLET.x + MALLET.side * MALLET.Lh, top - faceDown], sw = MALLET.side;
    let eps, smear = 0, squash = 0;
    if (t < M.hang) eps = lerp(1.0, .2, 1 - (1 - seg(t, M.enter, M.hang)) ** 3);                     // brought into frame, slowing to a hang
    else if (t < M.swing) eps = lerp(.2, .3, EIO(seg(t, M.hang, M.swing)));                          // the cock back: a held breath
    else if (t < M.hit) { const k = seg(t, M.swing, M.hit); eps = .3 * (1 - k ** 3); smear = k > .35 ? k : 0; }   // accelerating into the hit
    else { const s = t - M.hit; eps = .085 * Math.exp(-4.5 * s) * Math.abs(Math.sin(11 * s)); squash = s < .08 ? 1 - s / .08 : 0; }
    let P = swingPose(sw, eps, G, MALLET.Lh);
    // lift off the head, then twist the face to camera: overlapped stages. It's heavy, so the twist is a slow
    // ease-in-out that overshoots a few degrees and settles back, not a snap
    if (t > M.lift) {
      const kL = EIO(seg(t, M.lift, M.lift + .35)), kT = seg(t, M.turn, M.turn + .6);
      const rest = swingPose(sw, 0, G, MALLET.Lh), lifted = rest.C[1] - 70, present = 372;
      const kP = EIO(seg(t, M.turn + .15, M.turn + .6));
      const C = [lerp(rest.C[0], MALLET.x, kL), lerp(lerp(rest.C[1], lifted, kL), present, kP), 0];
      const th = (Math.PI / 2 + .12) * (EIO(kT) + .09 * Math.sin(Math.PI * clamp((kT - .7) / .3)));   // twist angle about the handle
      const A = [0, Math.cos(th) * .984, Math.sin(th) * .984 - .18 * Math.cos(th)];
      P = { C, A, Hd: [sw, 0, 0] };
      for (const j of M.jabs) { const q = t - j; if (q > 0 && q < .3) { const e = Math.sin(q / .3 * Math.PI); P.C[1] += 8 * e; P.grow = .06 * e; } }   // jabs for emphasis
      if (t > M.exit) {   // turns away a little and is yanked out of frame, accelerating
        const kx = E7(seg(t, M.exit, M.exit + .3)), ko = seg(t, M.exit + .12, M.gone) ** 2.2;
        P.A = [0, lerp(P.A[1], .7, kx), lerp(P.A[2], .6, kx)];
        P.C = [lerp(P.C[0], MALLET.x + MALLET.side * 1000, ko), lerp(P.C[1], P.C[1] - 380, ko), 0];
      }
    }
    const g = 1 + (P.grow || 0);
    return { ...P, R: MALLET.R * g, S: MALLET.S * g * (1 - .1 * squash), Lh: MALLET.Lh * 1.4, msg: M.msg, smear, eps, side: sw };
  }
  function malletSmear(m) {   // dry-brush speed lines trailing the barrel through the fast part of the swing
    if (!m || m.smear <= 0) return;
    boilSeed('msmear');
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * m.R * .38, px = m.C[0] + m.Hd[0] * off, py = m.C[1] - m.S * .3 + (i - 2) * 6;
      inkLine([[px, py - 40 - 120 * m.smear], [px + 6, py - 20 - 60 * m.smear], [px, py]], 2.2 * m.smear, mixCol(PAL.ochre, PAL.clayDk, .4), 'dry', .3);
    }
  }

  // ---------- the butterflies ----------
  // a landed butterfly takes off again (when a correction swings in, or a third would crowd the head): up off the
  // head, back out through the window
  function takeoffPath(B) { const x = cx + B.spot, y = B.K[B.K.length - 1][2], L = B.leave;
    return B._off || (B._off = [[L, x, y, 1], [L + .3, x - 130, y - 40, 1], [L + .8, 600, 380, .8], [L + 1.4, 360, 300, .3]]); }   // low and left, clear of the mallet
  function wingPhase(t, B) {   // integrate the wingbeat frequency from the butterfly's first frame (pure: fixed start)
    const t0 = B.K[0][0]; let ph = 0;
    for (let s = t0; s < t; s += 1 / 240) {
      const f = B.leave != null && s > B.leave ? 9.5 : s > B.land ? 1.4 * Math.exp(-2 * (s - B.land)) : s > B.brake[0] ? 9.5 : s > B.glide[0] && s < B.glide[1] ? .6 : 6.2;
      ph += TAU * f * Math.min(1 / 240, t - s);
    }
    return ph;
  }
  function butterflyAt(t, B, o) {
    if (t < B.K[0][0]) return null;
    const ph = wingPhase(t, B);
    if (B.leave != null && t >= B.leave) {
      const K = takeoffPath(B); if (t > K[K.length - 1][0]) return null;
      const vx = mono(t + .02, K, 1) - mono(t - .02, K, 1);
      return { x: mono(t, K, 1), y: mono(t, K, 2) - 6 * Math.sin(ph), s: mono(t, K, 3), open: .5 + .5 * Math.cos(ph), rot: clamp(vx * .004, -.25, .25) };
    }
    if (t >= B.land) {
      const hp = headTop(o, B.spot), s = t - B.land;
      return { x: hp[0], y: hp[1] - 14, s: 1, open: .62 + .3 * Math.cos(ph) * Math.exp(-1.5 * s), rot: .05 * Math.sin(ph) * Math.exp(-2 * s), landed: true };
    }
    const gl = win(t, B.glide[0], B.glide[1], .08);
    const x = mono(t, B.K, 1), y = mono(t, B.K, 2), sc = mono(t, B.K, 3), flap = 1 - gl;
    const bob = -6 * Math.sin(ph) * flap;
    const vx = mono(t + .02, B.K, 1) - mono(t - .02, B.K, 1);
    return { x, y: y + bob, s: sc, open: flap > .1 ? .5 + .5 * Math.cos(ph) : .92, rot: clamp(vx * .004, -.25, .25) + .04 * Math.sin(ph) * flap };
  }
  const trailPos = (s, B, o) => {
    if (B.leave != null && s >= B.leave) { const K = takeoffPath(B); return [mono(s, K, 1), mono(s, K, 2) + 8]; }
    if (s >= B.land) { const hp = headTop(o, B.spot); return [hp[0], hp[1] - 6]; }
    const gl = win(s, B.glide[0], B.glide[1], .08); return [mono(s, B.K, 1), mono(s, B.K, 2) - 6 * Math.sin(TAU * 6.2 * (s - B.K[0][0])) * (1 - gl) + 8]; };
  // the ribbon trails along the path the butterfly actually flew, then drapes down to the desk once it lands
  function ribbonPts(t, B, o) {
    const bt = butterflyAt(t, B, o); if (!bt) return null;
    const L = B.txt.length * 15 + 70, pts = [[bt.x, bt.y + 8]];
    let acc = 0, s = t;
    while (acc < L && s > B.K[0][0] - 1) {
      s -= 1 / 60; const p = s < B.K[0][0] ? [B.K[0][1] - (B.K[0][0] - s) * 300, B.K[0][2] + 8] : trailPos(s, B, o);
      const l = pts[pts.length - 1]; acc += Math.hypot(p[0] - l[0], p[1] - l[1]); pts.push(p);
    }
    const w = EIO(seg(t, B.land - .1, B.land + .75)) * (B.leave != null ? 1 - EIO(seg(t, B.leave, B.leave + .4)) : 1), sway = 8 * spr(t, B.land + .6, 3, 5);
    if (w > 0) {   // blend into the drape: attach → sag → the end resting on the desk
      const a = pts[0], D = [a, [a[0] + B.drape[0][0], a[1] + B.drape[0][1]], [a[0] + B.drape[1][0], a[1] + B.drape[1][1] + sway], [a[0] + B.drape[2][0], a[1] + B.drape[2][1]]];
      const bez = k => { const q = 1 - k; return [q ** 3 * D[0][0] + 3 * q * q * k * D[1][0] + 3 * q * k * k * D[2][0] + k ** 3 * D[3][0], q ** 3 * D[0][1] + 3 * q * q * k * D[1][1] + 3 * q * k * k * D[2][1] + k ** 3 * D[3][1]]; };
      return pts.map((p, i) => { const b = bez(i / (pts.length - 1)); return [lerp(p[0], b[0], w), lerp(p[1], b[1], w)]; });
    }
    return pts;
  }
  function drawRibbon(P, txt) {
    if (!P || P.length < 3) return;
    boilSeed('ribbon' + txt.length);
    const bw = 40, top = [], bot = [], N = P.length, tan = i => { const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    for (let i = 1; i < N; i++) { const d = tan(i); top.push([P[i][0] - d[1] * bw / 2, P[i][1] + d[0] * bw / 2]); bot.push([P[i][0] + d[1] * bw / 2, P[i][1] - d[0] * bw / 2]); }
    inkLine([P[0], P[1]], .6, PAL.ink, 'inkfine', .3);
    const end = P[N - 1], de = tan(N - 1);
    paint([...top, [end[0] + de[0] * 26, end[1] + de[1] * 26], ...bot.reverse()], { wash: mixCol(PAL.rose, PAL.cream, .45), ink: PAL.ink, sw: .7 });
    // the words, glyph by glyph along the ribbon, reading left to right whichever way it trails
    const c = document.createElement('canvas').getContext('2d'), size = 28; c.font = `${size}px ${HAND}`;
    const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = cum[N - 1], tw = c.measureText(txt).width, leftToRight = P[N - 1][0] > P[0][0];
    const at = d => { let i = 1; while (i < N - 1 && cum[i] < d) i++; const k = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [lerp(P[i - 1][0], P[i][0], k), lerp(P[i - 1][1], P[i][1], k), tan(i)]; };
    let d = (total - tw) / 2 + 20;
    for (const ch of txt) {
      const cw = c.measureText(ch).width, dist = leftToRight ? d + cw / 2 : total - (d + cw / 2);
      const [x, y, tg] = at(clamp(dist, 0, total)); let rot = Math.atan2(tg[1], tg[0]); if (!leftToRight) rot += Math.PI;
      if (ch !== ' ') letter(ch, x, y, size, mixCol(PAL.ink, PAL.clayDk, .25), { rot, font: `${size}px ${HAND}`, ink: false });
      d += cw;
    }
  }

  // ---------- gaze: where the agent is looking, with quick saccades between targets ----------
  function gazeTarget(t, S) {
    for (const [a, b, g] of SCH.gaze) {
      if (t < a || t >= b) continue;
      if (g === 'screen') return [1300, 590];
      if (g === 'planeOut') return S.planeOut || [400, 320];
      if (Array.isArray(g)) return g;
      if (g.plane != null) { const p = planeIn(t, SCH.planes[g.plane]); return p && [p.x, p.y]; }
      if (g.scan != null) { const q = (t - g.scan) / .45; return [560 + 170 * (q % 1), 480 + 30 * Math.floor(q % 3)]; }
      if (g.butterfly != null) { const b = S.b && S.b[g.butterfly]; return b && [b.x, b.y]; }
    }
    return null;
  }

  function clawdPose(t, S) {
    const m = emotions(t, MOOD);
    const o = { ...m, noLegs: true, noShadow: true, seed: 2, boilKey: 'clawd', view: 'front' };
    // arms: the acting track, with typing on top, or the emotion's own arms where it has authority
    const emo = inAny(t, EMO_ARMS), holdL = inAny(t, HOLDS_L);
    let aL = track(t, AL), aR = track(t, AR);
    for (const [a, b, kl, kr] of TYPING) { const e = win(t, a, b, .12);
      if (e > 0) { aL += e * kl * .12 * Math.sin(t * TAU * 7.3 + 1.7 * Math.sin(t * 3.1)); aR += e * kr * .12 * Math.sin(t * TAU * 6.1 + 1.3 + 1.9 * Math.sin(t * 2.3)); } }
    for (const T of THROWS) { const th = throwArm(t, T); if (th) { aL = th.a; o.rot = (o.rot || 0) + th.rot; o.sq = (o.sq || 0) + th.sq; } }
    // asleep: slumped over the desk; woken: a jolt; then the big stretch and yawn, arms up, body long (the open, 0–9 s)
    const slump = 1 - EIO(seg(t, 7.2, 7.5)) + (SCH.sleepAt ? EIO(seg(t, SCH.sleepAt, SCH.sleepAt + .6)) : 0); if (slump > 0) { o.dy = (o.dy || 0) + .3 * slump; o.rot = (o.rot || 0) + .05 * slump; }
    const st = EIO(seg(t, 7.8, 8.1)) * (1 - EIO(seg(t, 8.35, 8.8)));
    if (st > 0) { aL = lerp(aL, 1.45, st); aR = lerp(aR, 1.45, st); o.sq = (o.sq || 0) - .13 * st; o.dy = (o.dy || 0) - .15 * st; }
    // fold taps: the hand presses at each crease
    for (const f of FOLDS) { if (t > f[0] && t < f[1]) { const q = (t - f[0]) / (f[1] - f[0]); aL -= .08 * Math.max(0, Math.sin(q * TAU * 2 - .5)); o.dy = (o.dy || 0) + .06 * Math.max(0, Math.sin(q * TAU * 2)); } }
    const wEmo = emo && !holdL ? 1 : 0;
    o.aL = lerp(aL, m.aL ?? aL, wEmo); o.aR = lerp(aR, m.aR ?? aR, emo ? 1 : 0);
    // hits: the squash comes from the blow, not the mood
    const h = squashOf(t), inHit = HITS.some(x => t > x.t - .06 && t < x.t + 1.44);
    if (h.sq || h.dy) { o.sq = inHit ? h.sq : (o.sq || 0) + h.sq; o.dy = (o.dy || 0) + h.dy; }
    if (HITS.some(x => t > x.t - .02 && t < x.t + .44)) { o.eyes = 'x'; o.mouth = 'wobble'; }
    if (t > 3.9 && t < 6.55) o.emote = null;   // inside the monitor the snore marks would drift across the hook
    const tg = gazeTarget(t, S);
    if (tg && !HITS.some(x => t > x.t && t < x.t + 1.14)) { const e = eyePt(o); o.lookX = clamp((tg[0] - e[0]) / 260, -1, 1); o.lookY = clamp((tg[1] - e[1]) / 170, -1, 1); }
    return o;
  }
  function screenAt(t) {   // [state, progress, what the work looks like]
    let cur = SCH.screen[0], kind = 'code';
    for (const s of SCH.screen) if (t >= s[0]) { cur = s; if (s[3]) kind = s[3]; }
    const k = cur[2], kk = Array.isArray(k) ? lerp(k[2], k[3], seg(t, k[0], k[1])) : k;
    return [cur[1], kk, kind];
  }

  // ---------- the film ----------
  function film(t) {
    const S = {}, fx = fxAt(t), tod = todAt(t);
    // the paper pass needs this frame's arm tip: pose the agent first (the butterflies feed the gaze, so place them too)
    const oProbe = clawdPose(t, S);
    S.b = SCH.butterflies.map(B => butterflyAt(t, B, oProbe));
    const tipAt = s => armTip(clawdPose(s, S), -1);
    const o = clawdPose(t, S);
    // camera: a slow push on the sleeper; into the monitor until the hook fills the frame; back out to morning; a
    // step back as a mallet looms; pushes on its message, on each butterfly and on the long build
    const zoom = mono(t, SCH.zoom);
    const inMon = t > 3.5 && t < 7.3 ? clamp((zoom - 1.36) / (6.2 - 1.36)) : 0;
    const cxC = lerp(cx, 1300, inMon), cyC = lerp(mono(t, SCH.camY), 591, inMon);
    const [sx, sy] = fx.shake > .3 ? shakeXY(t, fx.shake) : [0, 0];
    camBegin(cxC + sx, cyC + sy, zoom);
    const env = { tod, night: nightOf(tod), t, fx, hour: SCH.hours ? mono(t, SCH.hours) : null };
    room(tod, env); drawProps('desk', env);
    for (const F of SCH.planes) if (F.behind && t > F.behind[0] && t < F.behind[1]) paperModel({ ...planeIn(t, F), key: F.key });   // passing behind the head
    CAST(cx, gy, u, o);
    desk();
    tray(3 + SCH.trayAt.filter(x => t > x).length, fx.tray); mug(tod < .3 && t > 7, fx.mug); notepad(SCH.padN - SCH.padAt.filter(x => t > x).length);
    keyboard(inAny(t, TYPING.map(([a, b]) => [a, b])) ? t : 0, fx.kb);
    const L0 = SCH.lampAt, lampOn = L0 == null || t < L0 ? 0 : clamp([0, .7, .25, 1][Math.min(3, Math.floor((t - L0) / .06))] ?? 1);
    lamp(lampOn);
    const flash = SCH.flashes.reduce((a, x) => a + (t > x ? Math.exp(-6 * (t - x)) : 0), 0);
    const [scr, sk, kind] = screenAt(t);
    monitor(scr, sk, fx.wob, flash, { lines: SCH.hook, t, kind });
    drawProps('hook', env);

    // paper: each request's plane and note, each reply, and the next request already on its way
    const paper = [];
    for (const F of SCH.planes) {
      if (t < F.t0) continue;
      if (F.far) { paper.push({ ...planeIn(t, F), key: F.key }); continue; }
      if (t < F.grab) paper.push({ ...planeIn(t, F), key: F.key, behind: F.behind && t > F.behind[0] && t < F.behind[1] });
      else if (t < F.putdown) paper.push({ ...pickedUp(t, planeIn(F.grab - .02, F), armTip(o, -1), { grab: F.grab, unfold: F.unfold }), lines: F.lines, key: F.key });
      else if (t < F.putdown + .5) paper.push({ ...fallToTray(t, F.putdown, heldAt(tipAt(F.putdown))), lines: F.lines, key: F.key });
    }
    for (const g of SCH.replies) { const r = reply(t, g, tipAt); if (r && !r.gone) { paper.push({ ...r, key: g.key }); if (t > g.rel) S.planeOut = [r.x, r.y]; } }
    for (const p of paper) if (!p.behind) paperModel(p);

    for (const M of SCH.mallets) {
      const m = mallet(t, M, o);
      if (m) { malletSmear(m); mallet3(m); const s = t - M.hit; if (s >= 0 && s < .12) impactStar(MALLET.x, headTop(o, 0)[1] - 8, 60 * (1 - s / .12 * .4)); }
    }
    SCH.butterflies.forEach(B => { const b = butterflyAt(t, B, o); if (!b) return; drawRibbon(ribbonPts(t, B, o), B.txt); butterfly(b.x, b.y, 17 * b.s, b.open, b.rot); });
    camEnd();
    boilSeed('transition');
    if (t < .5) iris(960, 560, lerp(0, 1500, easeIn(t / .5)));
    if (!(window.STORY && window.STORY.approved)) letter(`DRAFT: not approved by ${SCH.user}`, 24, 40, 30, '#C8332B', { font: '30px Menlo, monospace', align: 'left', ink: false, screen: true });
    const I = SCH.iris;
    if (t > I.close) { const r = t < I.close + .5 ? lerp(1500, 300, EIO(seg(t, I.close, I.close + .5))) : t < DUR_ - .3 ? lerp(300, 280, seg(t, I.close + .5, DUR_ - .3)) : lerp(280, 0, easeIn(seg(t, DUR_ - .3, DUR_ - .05))); iris(960, 560, r); }
  }
  shots([[0, film]]);
  window.__session = { SCH, clawdPose, armTip, planeIn, mallet, butterflyAt, squashOf, headTop };
})();
