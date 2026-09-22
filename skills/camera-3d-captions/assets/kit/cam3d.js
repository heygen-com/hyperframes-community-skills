/* cam3d.js — kit copy (skill camera-3d-captions). The "3D text camera" technique (AE: 3D camera + DOF + text on path + Posterize Time 15 + motion blur)
   as a deterministic per-frame painter for HyperFrames. One analytic clock: CAM3D.render(t) writes every style.
   Model: each shot has a camera {cz (dolly toward the scene), px/py (pan/tilt as screen shift)}; every layer lives in
   "ref-screen" coordinates (how it looks at the shot's reference camera) at a reference distance D0.
   screen = C + (ref - C) * D0/(D0 - cz) + (px, py).  Text is posterized (camera AND own animation sampled at
   15 fps) with 7-ghost motion blur; the plate/matte move every frame with a directional Gaussian from camera speed. */
(function () {
  var W = 1440, H = 1080, CX = 720, CY = 540, FPS = 30, POST = 15, K = 7;   // frame: set by CAM3D.init
  var BASE = 0.86377;                       // baseline from line-box top at line-height 1 (em); per font via init
  var BASES = {};                           // font key -> baseline (em), from scripts/font-metrics.py
  var ADV = null;                           // glyph advance tables (em) — set by CAM3D.init
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function post(t) { return Math.floor(t * POST + 1e-4) / POST; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  // frame-indexed table {f0, key:[...]} -> value at time t (linear between frames, clamped)
  function tab(T, key, t) {
    var arr = T[key], f = t * FPS - T.f0, i = Math.floor(f);
    if (i < 0) return arr[0];
    if (i >= arr.length - 1) return arr[arr.length - 1];
    return lerp(arr[i], arr[i + 1], f - i);
  }
  // step table [[frame, a, b, ...], ...] -> linear interpolation between step samples
  function steps(S, t, col) {
    var f = t * FPS;
    if (f <= S[0][0]) return S[0][col];
    for (var i = 0; i < S.length - 1; i++) {
      if (f < S[i + 1][0]) return lerp(S[i][col], S[i + 1][col], (f - S[i][0]) / (S[i + 1][0] - S[i][0]));
    }
    return S[S.length - 1][col];
  }
  // remaining-fraction entry profile, measured per 15-fps step (index can be fractional)
  function entry(profile, n) {
    if (n <= 0) return 1;
    var i = Math.floor(n);
    if (i >= profile.length - 1) return 0;
    return lerp(profile[i], profile[i + 1], n - i);
  }
  function baseOf(font) { return font && BASES[font] != null ? BASES[font] : BASE; }
  function advOf(font, s) { var a = 0, tb = ADV[font]; for (var i = 0; i < s.length; i++) a += (tb[s[i]] != null ? tb[s[i]] : 0.6); return a; }

  // ---------- camera ----------
  function Camera(fn, D0plate) { this.fn = fn; this.Dp = D0plate; }
  Camera.prototype.at = function (t) { return this.fn(t); };   // {cz, px, py}
  function camFromTable(T, Dp) {
    return new Camera(function (t) {
      var m = tab(T, 'm', t);
      return { cz: Dp * (1 - 1 / m), px: tab(T, 'px', t), py: tab(T, 'py', t) };
    }, Dp);
  }
  var F = 1326.1;                                  // AE camera zoom (px); 57.0 deg H on a 1440-wide frame
  function project(c, x, y, D0) {                 // ref-screen point at distance D0 -> screen
    var d = D0 - c.cz, k = D0 / d, tx = c.tx || 0, ty = c.ty || 0;
    return { x: CX + (x - CX) * k + c.px - tx * F / d, y: CY + (y - CY) * k + c.py - ty * F / d, k: k };
  }
  function unproject(c, sx, sy, D0) {             // screen point -> ref-screen coords at distance D0 (inverse of project)
    var d = D0 - c.cz, k = D0 / d, tx = c.tx || 0, ty = c.ty || 0;
    return { x: CX + (sx - c.px + tx * F / d - CX) / k, y: CY + (sy - c.py + ty * F / d - CY) / k };
  }
  // ---------- measured motion profiles (progress 0..1 over u in 0..1) ----------
  // arrival: the tutorial's whip-in camera (shot 1 dy, 19 frames) -> remaining fraction per frame
  var ARR = [1, .740, .575, .449, .358, .289, .227, .175, .133, .110, .088, .070, .056, .044, .033, .024, .016, .009, .004, 0];
  var PROF = {
    linear: function (u) { return u; },
    arrive: function (u) { var n = u * 19, i = Math.floor(n); if (i >= 19) return 1; return 1 - lerp(ARR[i], ARR[i + 1], n - i); },
    exit3: function (u) { return u * u * u; },
    push: function (u) { return Math.pow(u, 1.9); },               // tutorial push-in f100-f133: m = .95 + .256 u^1.9
    // velocity-matched swing: cubic ease-in for the first quarter, then the measured arrival (35 % of travel in the first 25 %)
    swing: function (u) { var a = 0.25, c1 = 0.354; return u < a ? c1 * Math.pow(u / a, 3) : c1 + (1 - c1) * PROF.arrive((u - a) / (1 - a)); },
    step: function (u) { return u > 0 ? 1 : 0; }
  };
  // camera from additive segments {t0, dur, prof, m, px, py, tx, ty} on top of a base state
  function camFromSegments(base, segs, Dp) {
    return new Camera(function (t) {
      var c = { m: base.m, px: base.px || 0, py: base.py || 0, tx: base.tx || 0, ty: base.ty || 0 };
      for (var i = 0; i < segs.length; i++) {
        var g = segs[i], u = g.dur > 0 ? clamp((t - g.t0) / g.dur, 0, 1) : (t >= g.t0 ? 1 : 0);
        if (u <= 0) continue;
        var p = PROF[g.prof || 'swing'](u);
        if (g.m) c.m += g.m * p; if (g.px) c.px += g.px * p; if (g.py) c.py += g.py * p;
        if (g.tx) c.tx += g.tx * p; if (g.ty) c.ty += g.ty * p;
      }
      return { cz: Dp * (1 - 1 / c.m), px: c.px, py: c.py, tx: c.tx, ty: c.ty, m: c.m };
    }, Dp);
  }

  // ---------- plate (tall padded video + alpha matte share one transform & one blur) ----------
  // cfg: {el, clipEl, personEl, personClipEl, fPlate, fPerson (feGaussianBlur nodes), padTop, padLeft,
  //       refU, refV (plate px that sits at refX, refY at the reference camera), refX, refY, S0, D0, dof(t)}
  function Plate(cfg) { this.c = cfg; }
  Plate.prototype.paint = function (cam, t) {
    var c = this.c, p = cam.at(t), dd = c.D0 - p.cz, k = c.D0 / dd, s = c.S0 * k;
    var x0 = CX + (c.refX - c.refU * c.S0 - CX) * k + p.px - (p.tx || 0) * F / dd, y0 = CY + (c.refY - c.refV * c.S0 - CY) * k + p.py - (p.ty || 0) * F / dd;
    c.el.style.transform = 'matrix(' + s.toFixed(5) + ',0,0,' + s.toFixed(5) + ',' + x0.toFixed(2) + ',' + y0.toFixed(2) + ')';
    if (c.personEl) c.personEl.style.transform = 'matrix(' + s.toFixed(5) + ',0,0,' + s.toFixed(5) + ',' + (x0 + (c.padLeft || 0) * s).toFixed(2) + ',' + (y0 + c.padTop * s).toFixed(2) + ')';
    // camera speed at frame centre (px / frame) -> directional motion blur (180 deg shutter => half a frame of travel)
    var a = cam.at(t - 1 / 120), b = cam.at(t + 1 / 120);
    var ka = c.D0 / (c.D0 - a.cz), kb = c.D0 / (c.D0 - b.cz);
    var ga = F / (c.D0 - a.cz), gb = F / (c.D0 - b.cz);
    var vx = ((b.px - (b.tx || 0) * gb) - (a.px - (a.tx || 0) * ga)) * 0.5 * 120 / FPS;
    var vy = ((b.py - (b.ty || 0) * gb) - (a.py - (a.ty || 0) * ga)) * 0.5 * 120 / FPS;
    var vs = Math.abs(kb - ka) * 60 / FPS * 700;  // radial smear from dolly speed (~700 px lever)
    var d = c.dof ? c.dof(t) : 0;
    var sx = Math.sqrt(d * d + Math.pow(0.2 * Math.abs(vx), 2) + Math.pow(0.1 * vs, 2));
    var sy = Math.sqrt(d * d + Math.pow(0.2 * Math.abs(vy), 2) + Math.pow(0.1 * vs, 2));
    var on = sx > 0.06 || sy > 0.06;
    var sd = Math.max(sx, 0.02).toFixed(2) + ' ' + Math.max(sy, 0.02).toFixed(2);
    if (c.fPlate) { c.fPlate.setAttribute('stdDeviation', sd); c.clipEl.style.filter = on ? 'url(#' + c.fPlate.parentNode.id + ')' : 'none'; }
    if (c.fPerson) { c.fPerson.setAttribute('stdDeviation', sd); c.personClipEl.style.filter = on ? 'url(#' + c.fPerson.parentNode.id + ')' : 'none'; }
  };

  // ---------- words ----------
  // A Word owns a group element (isolation) with K ghost layers; each ghost holds the word's pieces
  // (one piece for a flat word, one per glyph for text on a path). pose(ta, c) returns piece poses in SCREEN px.
  function Word(parent, opt) {
    this.o = opt;
    var g = document.createElement('div'); g.className = 'wg ' + (opt.cls || ''); parent.appendChild(g);
    if (opt.font) g.dataset.font = opt.font;          // metrics key: baseline + glyph-gap QC
    this.g = g; this.gh = []; this.pcs = [];
    var pieces = opt.pieces || [opt.text];
    for (var k = 0; k < K; k++) {
      var gh = document.createElement('div'); gh.className = 'gh'; g.appendChild(gh);
      var row = [];
      for (var i = 0; i < pieces.length; i++) {
        var sp;
        if (opt.sprite) {                               // hand-drawn word: a write-on sprite sheet (scripts/hand/build-sprites.py)
          var m = opt.sprite; sp = document.createElement('div'); sp.className = 'pc spr';
          sp.style.width = m.fw + 'px'; sp.style.height = m.fh + 'px';
          sp.style.backgroundImage = 'url(' + m.url + ')'; sp.style.backgroundRepeat = 'no-repeat';
          sp.style.backgroundSize = (m.cols * m.fw) + 'px ' + (Math.ceil(m.n / m.cols) * m.fh) + 'px';
        } else {
          sp = document.createElement('span'); sp.className = 'pc'; sp.textContent = pieces[i];
          sp.style.fontSize = opt.size + 'px';
        }
        gh.appendChild(sp); row.push(sp);
      }
      this.gh.push(gh); this.pcs.push(row);
    }
    g.style.display = 'none';
  }
  Word.prototype.paint = function (t, cam, dofFn) {
    var o = this.o, ph = (o.phase || 0) / FPS, tp = post(t - ph + 1e-6) + ph;   // per-layer posterize grid (AE: layer time)
    if (tp < o.on - 1e-6 || (o.off != null && tp >= o.off - 1e-6)) { this.g.style.display = 'none'; return; }
    this.g.style.display = 'block';
    // AE-style motion blur on a posterized layer: shutter = 180 deg of the 15-fps step, centred on the step time
    var h = (o.shutter != null ? o.shutter : 1) * 0.25 / POST;   // o.shutter < 1 = shorter shutter for very fast moves
    var A = this.poses(tp - h, cam), B = this.poses(tp + h, cam);
    if (o.sprite) {                                     // write-on frame on the 15-fps grid, from the word's onset
      var m = o.sprite, fi = clamp(Math.floor((tp - o.on) * POST * (o.spriteRate || 1) + 1e-6), 0, m.n - 1);
      var bp = (-(fi % m.cols) * m.fw) + 'px ' + (-Math.floor(fi / m.cols) * m.fh) + 'px';
      for (var kk = 0; kk < K; kk++) this.pcs[kk][0].style.backgroundPosition = bp;
    }
    for (var k = 0; k < K; k++) {
      var u = k / (K - 1), row = this.pcs[k];
      for (var i = 0; i < row.length; i++) {
        var a = A[i], b = B[i];
        var x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u), r = lerp(a.r, b.r, u), s = lerp(a.s, b.s, u);
        row[i].style.visibility = b.hid ? 'hidden' : 'visible';
        if (b.a != null) row[i].style.opacity = lerp(a.a != null ? a.a : b.a, b.a, u).toFixed(3);   // per-glyph fade (3D ring turning away)
        row[i].style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + r.toFixed(4) + 'rad) scale(' + s.toFixed(4) + ') translate(' + (-a.ax).toFixed(2) + 'px,' + (-a.ay).toFixed(2) + 'px)';
      }
    }
    var zs = 0, zn = 0; for (var j = 0; j < B.length; j++) if (B[j].z != null && !B[j].hid) { zs += B[j].z; zn++; }
    this.zNow = zn ? zs / zn : null;                  // current mean depth of the visible glyphs (3D rings)
    var c0 = cam.at(tp), d = dofFn ? dofFn(this, c0, tp) : 0;
    var fl = d > 0.15 ? 'blur(' + d.toFixed(2) + 'px)' : '';
    if (o.shadow) {                                   // depth shadow: nearer words cast a bigger, softer shadow (o.shadow = [dy, blur, alpha, refDepth])
      var D = this.zNow != null ? this.zNow : o.D0, kk = o.shadow[3] / Math.max(50, D - c0.cz);
      fl += ' drop-shadow(0px ' + (o.shadow[0] * kk).toFixed(1) + 'px ' + (o.shadow[1] * kk).toFixed(1) + 'px rgba(0,0,0,' + o.shadow[2] + '))';
    }
    this.g.style.filter = fl || 'none';
    this.g.style.opacity = o.opacity ? o.opacity(tp) : 1;
  };
  // flat word: pose from a function of (ta) -> {x, y (ref-screen anchor), s, r, screen:bool}
  Word.prototype.poses = function (ta, cam) {
    var o = this.o, st = o.state(ta), out = [];
    if (o.pieces) {
      // text on path: st gives per-piece ref-screen poses
      for (var i = 0; i < st.length; i++) {
        var q = st[i], P = project(cam.at(ta), q.x, q.y, q.z != null ? q.z : o.D0);
        var split = o.side && q.z != null && (o.side === 'front' ? q.z > o.zSplit : q.z <= o.zSplit);   // occlusion by depth
        out.push({ x: P.x, y: P.y, r: q.r, s: P.k * (q.s || 1), ax: q.ax, ay: q.ay, z: q.z, a: q.a, hid: q.hid || split || P.k * (q.s || 1) > (o.kmax || 1e9) });
      }
      return out;
    }
    var ax = st.ax != null ? st.ax : 0, ay = st.ay != null ? st.ay : baseOf(o.font) * o.size;
    if (st.screen) { out.push({ x: st.x, y: st.y, r: st.r || 0, s: st.s || 1, ax: ax, ay: ay }); return out; }
    var P2 = project(cam.at(ta), st.x, st.y, o.D0);
    out.push({ x: P2.x, y: P2.y, r: st.r || 0, s: P2.k * (st.s || 1), ax: ax, ay: ay, a: st.a, hid: st.hid });
    return out;
  };

  // ---------- text on an elliptical path (AE: Path Options -> Mask, Reverse Path ON: letters face outward) ----------
  function Ring(cx, cy, a, b, phi, n) {
    this.cx = cx; this.cy = cy; this.a = a; this.b = b; this.phi = phi || 0;
    this.cp = Math.cos(this.phi); this.sp = Math.sin(this.phi);
    n = n || 2048; this.th = new Float64Array(n + 1); this.s = new Float64Array(n + 1);
    var acc = 0, prev = null;
    for (var i = 0; i <= n; i++) {
      var th = -Math.PI + 2 * Math.PI * i / n, q = this.pt(th);
      if (prev) acc += Math.hypot(q.x - prev.x, q.y - prev.y);
      this.th[i] = th; this.s[i] = acc; prev = q;
    }
    this.L = acc; this.n = n;
  }
  Ring.prototype.pt = function (th) {      // rotated ellipse, th = 0 at the top, clockwise on screen
    var u = this.a * Math.sin(th), v = -this.b * Math.cos(th);
    return { x: this.cx + u * this.cp - v * this.sp, y: this.cy + u * this.sp + v * this.cp };
  };
  Ring.prototype.sOf = function (th) {
    var i = clamp((th + Math.PI) / (2 * Math.PI) * this.n, 0, this.n); var j = Math.floor(i);
    return j >= this.n ? this.s[this.n] : lerp(this.s[j], this.s[j + 1], i - j);
  };
  Ring.prototype.thAt = function (s) {     // arc length -> angle
    var L = this.L; s = ((s % L) + L) % L; var lo = 0, hi = this.n;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (this.s[mid] <= s) lo = mid; else hi = mid; }
    return lerp(this.th[lo], this.th[hi], (s - this.s[lo]) / Math.max(1e-9, this.s[hi] - this.s[lo]));
  };
  Ring.prototype.at = function (s) {       // arc length (wraps) -> point + tangent angle
    var L = this.L; s = ((s % L) + L) % L;
    var lo = 0, hi = this.n;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (this.s[mid] <= s) lo = mid; else hi = mid; }
    var u = (s - this.s[lo]) / Math.max(1e-9, this.s[hi] - this.s[lo]);
    var th = lerp(this.th[lo], this.th[hi], u), q = this.pt(th);
    var du = this.a * Math.cos(th), dv = this.b * Math.sin(th);
    q.r = Math.atan2(du * this.sp + dv * this.cp, du * this.cp - dv * this.sp);
    return q;
  };
  // screen-spaced sentence on a 3D ring: walks every glyph of every word along the ring so each on-screen step equals the
  // glyph advance at that depth (x track), with a word gap between words. words: [{text, font, size, flip}].
  // opts: dir (+1 sentence runs clockwise / -1), gap (px at Zf), track, and start (arc s of the line's leading edge) OR
  // centre (the whole line is centred there). Returns per word {sc, th, rel} -> ringLayout(..., th, ..., {rel}).
  function ringLine(ring, words, opts) {
    var D = opts.dir || 1, gap = opts.gap != null ? opts.gap : 28, track = opts.track != null ? opts.track : 1.1;
    // distance is measured between glyph MIDDLES, not path points: a word hung off the path (flipped, lift .81) sits on the
    // outside of the curve and spreads wherever the ring bends, so spacing at the path alone reads loose there
    // where the path bends hard (a ring seen near edge-on) the glyph tops on the inside of the curve still converge, so the
    // baseline and cap lines must also clear 90 % of the step
    var hOff = [0, 0, 0], fl = 1;
    var probe = function (s) {
      var p = ring.at(s), r = p.r + (fl < 0 ? Math.PI : 0), sn = -Math.sin(r) * p.k0, cs = Math.cos(r) * p.k0;
      return hOff.map(function (h) { return [p.x + sn * h, p.y + cs * h]; });
    };
    var stepTo = function (sFrom, want) {
      var p0 = probe(sFrom), sN = sFrom, st = Math.max(0.25, want / 48);
      for (var k = 0; k < 2000; k++) {
        sN += D * st; var p = probe(sN), ok = true;
        for (var j = 0; j < 3 && ok; j++) ok = Math.hypot(p[j][0] - p0[j][0], p[j][1] - p0[j][1]) >= want * (j ? 0.9 : 1);
        if (ok) return sN;
      }
      return sN;
    };
    var walk = function (sStart) {
      var cur = sStart, out = [];
      words.forEach(function (w, wi) {
        var lf = w.lift != null ? w.lift : 0.36; fl = w.flip ? -1 : 1;   // path point -> glyph middle / baseline / cap line
        hOff = [(lf - 0.3) * w.size, lf * w.size, (lf - 0.72) * w.size];
        var chars = w.text.split(''), adv = chars.map(function (ch) { return (ADV[w.font][ch] != null ? ADV[w.font][ch] : 0.6) * w.size; });
        var rev = (w.flip ? -1 : 1) !== D, ord = adv.slice(); if (rev) ord.reverse();
        var pos = [];
        if (wi > 0) cur = stepTo(cur, gap * ring.at(cur).k0);
        cur = stepTo(cur, ord[0] / 2 * track * ring.at(cur).k0); pos.push(cur);
        for (var g = 1; g < ord.length; g++) { cur = stepTo(cur, (ord[g - 1] + ord[g]) / 2 * track * ring.at(cur).k0); pos.push(cur); }
        cur = stepTo(cur, ord[ord.length - 1] / 2 * track * ring.at(cur).k0);
        if (rev) pos.reverse();
        var sc = (pos[0] + pos[pos.length - 1]) / 2;
        out.push({ sc: sc, th: ring.thAt(sc), rel: pos.map(function (v) { return v - sc; }) });
      });
      out.end = cur; return out;
    };
    if (opts.centre == null) return walk(opts.start);
    var st0 = opts.centre, res = walk(st0);
    for (var it = 0; it < 3; it++) { st0 = opts.centre - (res.end - st0) / 2; res = walk(st0); }   // re-centre: spacing varies along the ring
    return res;
  }
  // glyph layout for one word centred at angle th (reads clockwise); returns fn(offsetS) -> piece poses
  function ringLayout(ring, word, font, size, th, lift, flip, fx, opts) {
    var chars = word.split(''), adv = chars.map(function (ch) { return (ADV[font][ch] != null ? ADV[font][ch] : 0.6) * size; });
    var Lw = adv.reduce(function (p, v) { return p + v; }, 0), s0 = ring.sOf(th) - Lw / 2;
    var rel = null;
    opts = opts || {};
    if (opts.rel) rel = opts.rel;                  // precomputed by ringLine (whole sentence spaced on screen)
    else if (ring.screen) {
      // 3D ring: glyphs face the camera but the path runs in depth, so arc-length spacing lets them collide wherever the ring
      // turns toward/away from the lens. Space them ON SCREEN instead (ringLine: one-word line centred on `spaceAt`, default
      // the word's own slot). rel[i] = arc offset of glyph i's centre from the word centre.
      var sRef = opts.spaceAt != null ? opts.spaceAt : ring.sOf(th);
      rel = ringLine(ring, [{ text: word, font: font, size: size, flip: flip, lift: lift }],
                     { centre: sRef, dir: flip ? -1 : 1, track: opts.track })[0].rel;
    }
    return {
      chars: chars, length: Lw,
      pose: function (ds) {            // ds: number, or fn(glyphIndex) for per-glyph offsets
        var out = [], acc = 0, f = typeof ds === 'function' ? ds : null, sc = ring.sOf(th);
        for (var i = 0; i < chars.length; i++) {
          // flip: the word reads counter-clockwise with letters facing inward (upright on the lower half)
          var d = f ? f(i) : ds;            // null = glyph not born yet
          var q = rel ? ring.at(sc + rel[i] + (d || 0)) : (flip ? ring.at(s0 + Lw + d - acc - adv[i] / 2) : ring.at(s0 + d + acc + adv[i] / 2));
          var e = fx ? fx(q) : null;
          out.push({ x: q.x, y: q.y, r: flip ? q.r + Math.PI : q.r, ax: adv[i] / 2, ay: baseOf(font) * size - (lift || 0) * size,
                     hid: d === null || (e && e.hid), s: (e && e.s != null ? e.s : 1) * (q.k0 || 1), z: q.z, a: e ? e.a : undefined });
          acc += adv[i];
        }
        return out;
      }
    };
  }

  // ---------- a real 3D circle: text on a path on a TILTED 3D layer ----------
  // Centre (X, Y, Z) in camera space at the shot's reference camera (Z = distance), world radius R, orientation
  // M = Rz(rz)·Ry(ry)·Rx(rx) applied to the screen plane. th = 0 at the top, clockwise on screen. Font px are true
  // at depth Zf, so a glyph at depth Z reads at size·Zf/Z at the reference camera and Zf/(Z − cz) under a dolly.
  // Arc length is measured in "px at Zf" so it is a drop-in for Ring (same sOf / thAt / at / L API).
  function Ring3D(o) {
    this.X = o.X; this.Y = o.Y; this.Z = o.Z; this.R = o.R; this.Zf = o.Zf;
    var cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry), sy = Math.sin(o.ry), cz = Math.cos(o.rz), sz = Math.sin(o.rz);
    this.e1 = [cz * cy, sz * cy, -sy];
    this.e2 = [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx];
    this.u = this.R * F / this.Zf;                     // px-at-Zf per radian
    this.L = 2 * Math.PI * this.u;
  }
  Ring3D.prototype.world = function (th) {
    var s = Math.sin(th), c = Math.cos(th), R = this.R, a = this.e1, b = this.e2;
    return [this.X + R * (s * a[0] - c * b[0]), this.Y + R * (s * a[1] - c * b[1]), this.Z + R * (s * a[2] - c * b[2])];
  };
  Ring3D.prototype.screen = function (th) { var w = this.world(th); return { x: CX + F * w[0] / w[2], y: CY + F * w[1] / w[2], z: w[2] }; };
  Ring3D.prototype.sOf = function (th) { return (th + Math.PI) * this.u; };
  Ring3D.prototype.thAt = function (s) { var L = this.L; s = ((s % L) + L) % L; return s / this.u - Math.PI; };
  Ring3D.prototype.at = function (s) {
    var th = this.thAt(s), q = this.screen(th), q2 = this.screen(th + 1e-3);
    return { x: q.x, y: q.y, r: Math.atan2(q2.y - q.y, q2.x - q.x), z: q.z, k0: this.Zf / q.z };
  };
  // mean depth of a laid-out word at rest (drives its depth of field)
  function meanZ(pieces) { var a = 0, n = 0; pieces.forEach(function (q) { if (q.z != null) { a += q.z; n++; } }); return n ? a / n : null; }

  window.CAM3D = {
    W: W, H: H, FPS: FPS, POST: POST, K: K, BASE: BASE,
    // init(adv, {W, H, F, base}) — adv/base from scripts/font-metrics.py. F defaults to the tutorial lens at this frame
    // HEIGHT (vertical FOV kept), so the measured tables (px of a 1080-tall frame) apply unscaled at 16:9 too
    init: function (adv, o) {
      ADV = adv.adv || adv; if (adv.base) BASES = adv.base; o = o || {};
      if (o.W) { W = o.W; H = o.H; CX = W / 2; CY = H / 2; }
      F = o.F || 1326.1 * H / 1080; if (o.base != null) BASE = o.base;
      this.W = W; this.H = H; this.F = F; this.BASE = BASE;
    },
    baseOf: baseOf,
    post: post, tab: tab, steps: steps, ringLine: ringLine, entry: entry, advOf: advOf, lerp: lerp, clamp: clamp,
    Camera: Camera, camFromTable: camFromTable, camFromSegments: camFromSegments, project: project, unproject: unproject, PROF: PROF, F: F,
    Plate: Plate, Word: Word, Ring: Ring, Ring3D: Ring3D, meanZ: meanZ, ringLayout: ringLayout
  };
})();
