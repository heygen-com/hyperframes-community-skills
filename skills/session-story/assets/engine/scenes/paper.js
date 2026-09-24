// paper.js: a sheet of paper as a real 3D object. One model is the flat note, every stage of folding, and the paper
// plane in flight, so a request can land and unfold, and a reply can be folded and thrown, with the same geometry.
//
// The classic dart: S1 and S2 fold the top corners to the centre line, S3 folds it in half, S4 folds the wings down.
// Every crease is a line on the paper itself (material coordinates, measured on the flat sheet). A facet's pose is
// the rotations of the folds that moved it, applied latest-first about their material creases: that composes into
// the right rigid motion for partial and overlapping folds too, since R_world(B)·R(A) = R(A)·R_material(B).
//
// Material coords: u right, v down, z toward the camera, origin at the sheet centre; the nose is (0, -H/2).
const PAPER = { W: 270, H: 350, keel: 46 };

(() => {
  const { W, H, keel } = PAPER, hw = W / 2, hh = H / 2;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm2 = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
  // a crease from a to b, with n pointing toward the side that moves
  const crease = (a, b, toward) => { const d = nrm2(sub(b, a)); let n = [-d[1], d[0]]; if (dot2(sub(toward, a), n) < 0) n = [-n[0], -n[1]]; return { p: a, d, n }; };
  const reflectPt = (p, L) => { const s = dot2(sub(p, L.p), L.n); return [p[0] - 2 * s * L.n[0], p[1] - 2 * s * L.n[1]]; };
  const reflectLine = (L, M) => { const a = reflectPt(L.p, M), b = reflectPt([L.p[0] + L.d[0], L.p[1] + L.d[1]], M), t = reflectPt([L.p[0] + L.n[0], L.p[1] + L.n[1]], M); return crease(a, b, t); };
  const mirrorU = L => { const a = [-L.p[0], L.p[1]], b = [-(L.p[0] + L.d[0]), L.p[1] + L.d[1]], t = [-(L.p[0] + L.n[0]), L.p[1] + L.n[1]]; return crease(a, b, t); };
  // split a convex polygon by a crease: [moving side, fixed side]
  function split(P, L) {
    const A = [], B = [], s = P.map(p => dot2(sub(p, L.p), L.n));
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length, p = P[i], q = P[j], sp = s[i], sq = s[j];
      if (sp >= -1e-6) A.push(p); if (sp <= 1e-6) B.push(p);
      if ((sp > 1e-6 && sq < -1e-6) || (sp < -1e-6 && sq > 1e-6)) { const k = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]; A.push(x); B.push(x); }
    }
    return [A.length > 2 ? A : null, B.length > 2 ? B : null];
  }
  // the folds, in order, as they are made (lines in the frame of the moment); world direction +1 = toward camera
  const S1 = crease([0, -hh], [-hw, -hh + hw], [-hw, -hh]), S2 = crease([0, -hh], [hw, -hh + hw], [hw, -hh]);
  const S3 = crease([0, -hh], [0, hh], [-1, 0]);
  const S4R = crease([0, -hh], [keel, hh], [hw, 0]);        // in the frame after S3 (all paper at u >= 0)
  // build the facets with their fold history: { pts, folds: [{ i, L (material), dir (material ±1), full }] }
  let F = [{ pts: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], folds: [], flips: 0, id: 'base' }];
  const cut = (list, pick, lineOf, info) => {
    const out = [];
    for (const f of list) {
      if (!pick(f)) { out.push(f); continue; }
      const L = lineOf(f), [mv, st] = split(f.pts, L);
      if (st) out.push({ ...f, pts: st, folds: f.folds.slice() });
      if (mv) out.push({ ...f, pts: mv, folds: [...f.folds, { i: info.i, L, dir: info.dir * (f.flips % 2 ? -1 : 1), full: info.full }], flips: f.flips + (info.full === Math.PI ? 1 : 0), movedBy: { ...(f.movedBy || {}), [info.i]: 1 } });
    }
    return out;
  };
  F = cut(F, () => true, () => S1, { i: 0, dir: 1, full: Math.PI });
  F = cut(F, f => !(f.movedBy || {})[0], () => S2, { i: 1, dir: 1, full: Math.PI });
  // S3 in material coords: u = 0 for the base, reflected back through S1 for the left flap (the flap is on the left half)
  F = cut(F, f => (f.movedBy || {})[0] || f.pts.some(p => p[0] < -1e-6) && !(f.movedBy || {})[1],
          f => (f.movedBy || {})[0] ? reflectLine(S3, S1) : S3, { i: 2, dir: 1, full: Math.PI });
  // S4: the top layer (moved by S3) folds its wing toward the camera, the bottom layer away
  F = cut(F, () => true, f => {
    const m = f.movedBy || {};
    let L = m[2] ? mirrorU(S4R) : S4R;                      // back through S3 (a mirror in u) for the top layer
    if (m[0]) L = reflectLine(L, S1); if (m[1]) L = reflectLine(L, S2);   // and back through the corner fold
    return L;
  }, { i: 3, dir: 0, full: Math.PI / 2 });
  // the wing's material direction: world ±1, corrected for the flips this facet had before S4
  for (const f of F) { let flips = 0; for (const fd of f.folds) { if (fd.i === 3) fd.dir = ((f.movedBy || {})[2] ? 1 : -1) * (flips % 2 ? -1 : 1); else if (fd.full === Math.PI) flips++; } }
  // stacking order where layers coincide (bigger = nearer the camera when the stack's front faces it): flaps over the
  // sheet until the half-fold passes 90°, then the folded half on top, its flap under it, the other flap, the base
  for (const f of F) { const m = f.movedBy || {}, flap = m[0] || m[1];
    f.prioA = flap ? 3 : 1; f.prioB = m[2] ? (flap ? 4 : 5) : (flap ? 3 : 1); f.base = !m[0] && !m[1] && !m[2]; }
  const FACETS = F;
  const LINES = []; for (const f of F) for (const fd of f.folds) LINES.push({ i: fd.i, L: fd.L });
  const onLine = (a, b, L) => Math.abs(dot2(sub(a, L.p), L.n)) < .5 && Math.abs(dot2(sub(b, L.p), L.n)) < .5;
  const outer = (a, b) => (Math.abs(a[0]) > hw - .5 && Math.abs(b[0]) > hw - .5 && Math.abs(a[0] - b[0]) < .5) || (Math.abs(a[1]) > hh - .5 && Math.abs(b[1]) > hh - .5 && Math.abs(a[1] - b[1]) < .5);
  for (const f of F) f.edges = f.pts.map((a, k) => { const b = f.pts[(k + 1) % f.pts.length]; if (outer(a, b)) return { k, fold: -1 };
    const hit = LINES.find(l => onLine(a, b, l.L)); return { k, fold: hit ? hit.i : -1 }; });

  // rotate a 3D point about a material crease: angle b (signed), hinge lifted by hz along z
  function rot(P, L, b, hz) {
    const rx = P[0] - L.p[0], ry = P[1] - L.p[1], rz = P[2] - hz;
    const along = rx * L.d[0] + ry * L.d[1], s = rx * L.n[0] + ry * L.n[1], c = Math.cos(b), sn = Math.sin(b);
    const s2 = s * c - rz * sn, z2 = s * sn + rz * c;
    return [L.p[0] + along * L.d[0] + s2 * L.n[0], L.p[1] + along * L.d[1] + s2 * L.n[1], z2 + hz];
  }
  function rotV(V, L, b) { const r = rot([L.p[0] + V[0], L.p[1] + V[1], V[2]], L, b, 0); return [r[0] - L.p[0], r[1] - L.p[1], r[2]]; }
  const placeFacet = (f, ang) => {   // material → folded (paper-local 3D), latest fold first
    const tf = p => { let P = [p[0], p[1], p[2] || 0]; for (let k = f.folds.length - 1; k >= 0; k--) { const fd = f.folds[k]; P = rot(P, fd.L, fd.dir * ang[fd.i], 0); } return P; };
    const tv = v => { let V = v.slice(); for (let k = f.folds.length - 1; k >= 0; k--) { const fd = f.folds[k]; V = rotV(V, fd.L, fd.dir * ang[fd.i]); } return V; };
    return { tf, tv };
  };

  // ---------- rotations: 3×3 matrices (rows) and quaternions [w, x, y, z] ----------
  const mulMV = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
  function quatOf(M) {
    const t = M[0][0] + M[1][1] + M[2][2]; let q;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [.25 * s, (M[2][1] - M[1][2]) / s, (M[0][2] - M[2][0]) / s, (M[1][0] - M[0][1]) / s]; }
    else if (M[0][0] > M[1][1] && M[0][0] > M[2][2]) { const s = Math.sqrt(1 + M[0][0] - M[1][1] - M[2][2]) * 2; q = [(M[2][1] - M[1][2]) / s, .25 * s, (M[0][1] + M[1][0]) / s, (M[0][2] + M[2][0]) / s]; }
    else if (M[1][1] > M[2][2]) { const s = Math.sqrt(1 + M[1][1] - M[0][0] - M[2][2]) * 2; q = [(M[0][2] - M[2][0]) / s, (M[0][1] + M[1][0]) / s, .25 * s, (M[1][2] + M[2][1]) / s]; }
    else { const s = Math.sqrt(1 + M[2][2] - M[0][0] - M[1][1]) * 2; q = [(M[1][0] - M[0][1]) / s, (M[0][2] + M[2][0]) / s, (M[1][2] + M[2][1]) / s, .25 * s]; }
    return nrm(q);
  }
  function matOf([w, x, y, z]) {
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
  }
  function slerp(a, b, k) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
    if (d > .9995) return nrm(a.map((x, i) => x + (b[i] - x) * k));
    const th = Math.acos(d), s = Math.sin(th);
    return a.map((x, i) => (x * Math.sin((1 - k) * th) + b[i] * Math.sin(k * th)) / s);
  }
  // a pose facing the camera (the sheet upright, as held), rolled by `tilt` about z and leaning back by `lean` about x
  // (and turned by `yaw` about its own vertical, as you'd turn a plane in your hand to see its wings)
  function facingPose(tilt = 0, lean = 0, yaw = 0) {
    const c = Math.cos(tilt), s = Math.sin(tilt), cl = Math.cos(lean), sl = Math.sin(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const Rz = [[c, -s, 0], [s, c, 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, cl, -sl], [0, sl, cl]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
    const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return mm(mm(Rz, Rx), Ry);
  }
  // a flight pose: nose along f (world), wings level with the camera tilt `view`, banked by `bank` about f
  function flightPose(f, bank = 0, view = .75) {
    f = nrm(f);
    let up = [0, -1, view]; const k = up[0] * f[0] + up[1] * f[1] + up[2] * f[2]; up = nrm([up[0] - f[0] * k, up[1] - f[1] * k, up[2] - f[2] * k]);
    const side = cross(f, up), c = Math.cos(bank), s = Math.sin(bank);
    const uw = nrm([up[0] * c + side[0] * s, up[1] * c + side[1] * s, up[2] * c + side[2] * s]);
    const span = cross(f, uw);
    // columns: local u (spine → wings) → uw, local v (tail direction) → −f, local z → span
    return [[uw[0], -f[0], span[0]], [uw[1], -f[1], span[1]], [uw[2], -f[2], span[2]]];
  }

  // fold angles from a single progress k (0 flat → 1 plane), stages overlapped ~39% on the 7× ease, and each crease
  // springing back a hair and settling (paper remembers it was flat)
  const E7 = cubicBezierEase(.857, 0, .143, 1);
  const STAGES = [[0, .32], [.12, .44], [.36, .7], [.6, 1]];
  function foldAngles(k) {
    return STAGES.map(([a, b], i) => {
      const full = i === 3 ? Math.PI / 2 : Math.PI, q = clamp((k - a) / (b - a));
      const settle = q >= 1 ? 0 : q > .8 ? -.06 * Math.sin((q - .8) / .2 * Math.PI) : 0;
      return full * clamp(E7(q) + settle, 0, 1);
    });
  }

  // draw the paper. o: { x, y, s (scale), fold (0..1), R (3×3 pose), paper, ink, lines (text), chars (how many typed),
  // font }. Text is laid on the facets it sits on and hides once the sheet is folded in half.
  let GLYPH_CACHE = {};
  function glyphsFor(lines, size, font) {
    const key = lines.join('|') + size + font; if (GLYPH_CACHE[key]) return GLYPH_CACHE[key];
    const c = document.createElement('canvas').getContext('2d'); c.font = `${size}px ${font}`;
    const out = [], n = lines.length, gap = size * 1.16, top = 18 + (130 - (n - 1) * gap) / 2 - 10;
    lines.forEach((l, li) => {
      const w = c.measureText(l).width; let x = -w / 2;
      for (const ch of l) { const cw = c.measureText(ch).width; out.push({ ch, u: x + cw / 2, v: top + li * gap, i: out.length }); x += cw; }
    });
    return (GLYPH_CACHE[key] = out);
  }
  const inPoly = (P, p) => { let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside; } return inside; };
  const LIGHT = nrm([-.35, -.6, .72]);

  window.paperModel = function (o) {
    const ang = foldAngles(o.fold || 0), R = o.R || facingPose(), s = o.s ?? 1;
    const placed = FACETS.map(f => { const { tf, tv } = placeFacet(f, ang); return { f, pts: f.pts.map(p => tf(p)), n: tv([0, 0, 1]), tf, tv }; });
    // pivot on the centroid (so a flying plane stays put as its shape changes), or pin a material point, as a hand
    // holding a corner does, so the rest of the sheet folds around it
    let c0;
    if (o.pin) { const P = placed.find(Q => inPoly(Q.f.pts, o.pin)) || placed[0]; c0 = P.tf(o.pin); }
    else { let cx = 0, cy = 0, cz = 0, cnt = 0; for (const P of placed) for (const p of P.pts) { cx += p[0]; cy += p[1]; cz += p[2]; cnt++; } c0 = [cx / cnt, cy / cnt, cz / cnt]; }
    const toWorld = p => { const q = mulMV(R, [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]); return [o.x + q[0] * s, o.y + q[1] * s, q[2] * s]; };
    if (o.measure) { let cx = 0, cy = 0, cnt = 0; for (const P of placed) for (const p of P.pts) { const w = toWorld(p); cx += w[0]; cy += w[1]; cnt++; } return { centroid: [cx / cnt, cy / cnt] }; }
    const paper = o.paper || PAL.cream, back = mixCol(paper, PAL.ink, .08);
    const baseN = mulMV(R, (placed.find(P => P.f.base) || placed[0]).n), sigma = baseN[2] >= 0 ? 1 : -1, late = ang[2] > Math.PI / 2;
    const items = placed.map(P => {
      const wp = P.pts.map(toWorld), nw = mulMV(R, P.n), front = nw[2] >= 0;
      const z = wp.reduce((a, p) => a + p[2], 0) / wp.length + sigma * (late ? P.f.prioB : P.f.prioA) * .02;
      return { wp, nw, front, z, P };
    }).sort((a, b) => a.z - b.z);
    boilSeed('paper' + (o.key || ''));
    for (const it of items) {
      const lit = Math.max(0, Math.abs(it.nw[0] * LIGHT[0] + it.nw[1] * LIGHT[1] + it.nw[2] * LIGHT[2]));
      const col = mixCol(mixCol(it.front ? paper : back, PAL.ink, .14 * (1 - lit)), PAL.cream, .12 * lit);
      const P2d = it.wp.map(p => [p[0], p[1]]);
      paint(P2d, { wash: col, ink: null });
      // edges: the sheet's outline always; a crease only once its fold has been made (faint if it's flat again)
      for (const e of it.P.f.edges) {
        const made = e.fold < 0 ? 2 : ang[e.fold] > .12 ? 2 : (o.creased ? 1 : 0); if (!made) continue;
        inkLine([P2d[e.k], P2d[(e.k + 1) % P2d.length]], made === 2 ? (o.sw ?? .7) : .35, made === 2 ? PAL.ink : mixCol(paper, PAL.ink, .35), 'inkfine', 0);
      }
    }
    // the words: visible while the sheet faces the camera and before the half-fold covers them
    if (o.lines && ang[2] < Math.PI / 2) {
      const size = o.size || 30, font = o.font || HAND, G = glyphsFor(o.lines, size, font), shown = o.typed == null ? G.length : Math.floor(clamp(o.typed) * G.length + 1e-6);
      for (const g of G) {
        if (g.i >= shown || g.ch === ' ') continue;
        const P = placed.find(Q => inPoly(Q.f.pts, [g.u, g.v])); if (!P) continue;
        const nw = mulMV(R, P.n); if (nw[2] < .25) continue;
        const pos = toWorld(P.tf([g.u, g.v])), eu = mulMV(R, P.tv([1, 0, 0])), ev = mulMV(R, P.tv([0, 1, 0]));
        letter(g.ch, pos[0], pos[1], size * s, o.ink || PAL.ink, { mat: [eu[0], eu[1], ev[0], ev[1]], font: `${size * s}px ${font}`, ink: false });
      }
    }
    return { toWorld, c0 };
  };
  window.PAPER_POSE = { facing: facingPose, flight: flightPose, quat: quatOf, mat: matOf, slerp };
})();

// cubic-bezier easing (x1, y1, x2, y2), solved for x by Newton + bisection
function cubicBezierEase(x1, y1, x2, y2) {
  const bx = t => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3, by = t => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  const dbx = t => 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
  return x => {
    x = clamp(x); if (x <= 0 || x >= 1) return x;
    let t = x; for (let i = 0; i < 8; i++) { const d = dbx(t); if (Math.abs(d) < 1e-6) break; const nt = t - (bx(t) - x) / d; if (nt < 0 || nt > 1) break; t = nt; }
    let lo = 0, hi = 1; for (let i = 0; i < 20 && Math.abs(bx(t) - x) > 1e-5; i++) { if (bx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return by(t);
  };
}
