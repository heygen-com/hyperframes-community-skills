// Strudel code video: one editor, painted from time alone.
//
// Every visual is a function of t (seconds), read from data/events.js (built by build-data.mjs):
//   - the opener types line 1, fades the program in and pans down into the first part
//   - each paragraph of code sits muted until its first note, then blooms into its theme colors
//   - tokens light on their own notes (Strudel's hap source locations): outline while sounding,
//     an inverted flash on the onset, a ring on sparse parts, a fading trail after
//   - the editor moves through real Strudel themes on the bars video.json names
//   - builds corrupt the code as the all() sweep climbs
//   - drops become a graffiti ASCII storm that decodes back into the editor when they end
//   - the sign-off types two lines under the program, then everything fades out
// No state carries between frames, so any frame can be rendered on its own.
//
// window.__svInit() builds the DOM and returns the paused timeline. index.html calls it once the
// document and fonts are ready (the preview inlines this file ahead of the page markup).
window.__svInit = () => {
  const SQ = window.SQ;
  const { PRE, SPC, FPS, DUR, END } = SQ;
  const DROPS = SQ.drops, BUILDS = SQ.builds;

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const out4 = (u) => 1 - Math.pow(1 - clamp(u), 4);
  const inOut = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
  const hash = (a, b = 0, c = 0) => {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // count of entries whose key is <= t, and index of the first entry whose key is >= t (flat arrays)
  const upper = (arr, stride, t) => {
    let lo = 0, hi = arr.length / stride;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m * stride] <= t) lo = m + 1; else hi = m; }
    return lo;
  };
  const firstAtOrAfter = (arr, stride, t) => {
    let lo = 0, hi = arr.length / stride;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m * stride] < t) lo = m + 1; else hi = m; }
    return lo;
  };
  const recent = (arr, stride, t, win) => {
    const out = [];
    for (let k = firstAtOrAfter(arr, stride, t - win); k < arr.length / stride && arr[k * stride] <= t; k++) out.push(k);
    return out;
  };

  // ---------- themes: real Strudel themes (codemirror settings + syntax styles) ----------
  const parse = (c) => {
    if (c.startsWith("#")) {
      const h = c.slice(1);
      const n = h.length <= 4 ? h.split("").map((x) => parseInt(x + x, 16)) : h.match(/../g).map((x) => parseInt(x, 16));
      return [n[0], n[1], n[2], n.length > 3 ? n[3] / 255 : 1];
    }
    const m = c.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (c, bg) => [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3])).concat(1);
  const ratio = (a, b) => { const x = lum(a) + 0.05, y = lum(b) + 0.05; return x > y ? x / y : y / x; };
  // the smallest nudge (toward white on dark themes, black on light ones) that reaches 4.6:1
  const legible = (c, bg, target = 4.6) => {
    let col = over(c, bg);
    const toward = lum(bg) < 0.25 ? [255, 255, 255] : [0, 0, 0];
    for (let k = 0; k < 60 && ratio(col, bg) < target; k++) col = col.map((v, i) => (i < 3 ? v + (toward[i] - v) * 0.04 : 1));
    return col;
  };
  const W = "#ffffff";
  const RAW = { // values from strudel.cc's theme definitions; see references/themes.md
    bluescreen: { bg: "#051DB5", fg: W, muted: "#ffffff50", gutter: "#8a919966", hl: "#00000050", cm: W, str: W, num: W, kw: W, lbl: W, fn: W, var: W },
    blackscreen: { bg: "#000000", fg: W, muted: "#ffffff50", gutter: "#8a919966", hl: "#ffffff10", cm: W, str: W, num: W, kw: W, lbl: W, fn: W, var: W },
    whitescreen: { bg: "#ffffff", fg: "#000000", muted: "#00000050", gutter: "#000000", hl: "#cccccc50", cm: "#000000", str: "#000000", num: "#000000", kw: "#000000", lbl: "#000000", fn: "#000000", var: "#000000" },
    fruitDaw: { bg: "rgb(84, 93, 98)", fg: "rgb(167, 216, 177)", muted: "rgb(83, 101, 102)", gutter: "rgba(255, 255, 255, .25)", hl: "rgb(67, 76, 81)", cm: "rgba(255, 255, 255, .25)", str: "rgb(186, 230, 115)", num: "rgb(124, 206, 254)", kw: "rgb(252, 184, 67)", lbl: "rgb(252, 184, 67)", fn: W, var: W },
    redText: { bg: "#000000", fg: "#bd312a", muted: "#bd312a50", gutter: "#54636D", hl: "#171717", cm: "#54636D", str: "#ff5356", num: "#ff5356", kw: "#bd312a", lbl: "#bd312a", fn: "#bd312a", var: "#bd312a" },
    greenText: { bg: "#000000", fg: "#56bd2a", muted: "#56bd2a50", gutter: "#54636D", hl: "#171717", cm: "#54636D", str: "#8ed675", num: "#8ed675", kw: "#56bd2a", lbl: "#56bd2a", fn: "#56bd2a", var: "#56bd2a" },
    archBtw: { bg: "rgb(0, 0, 0)", fg: "rgb(82, 208, 250)", muted: "rgba(113, 208, 250, .4)", gutter: "rgba(113, 208, 250, .4)", hl: "rgb(0, 0, 0)", cm: "rgba(113, 208, 250, .4)", str: "rgb(82, 208, 250)", num: "rgb(82, 208, 250)", kw: "rgb(82, 208, 250)", lbl: "rgb(82, 208, 250)", fn: "rgb(82, 208, 250)", var: "rgb(82, 208, 250)" },
    sonicPink: { bg: "#000000", fg: "#ededed", muted: "#ffffff30", gutter: "#cccccc", hl: "#1e1e1e", cm: "#54636D", str: "#ff1493", num: "#4c83ff", kw: "#fbde2d", lbl: "#ededed", fn: "#ededed", var: "#ededed" },
    CutiePi: { bg: "#ffffff", fg: "#5c019a", muted: "#5c019a50", gutter: "#465063", hl: "#fee1ff", cm: "#97a1b7", str: "#9acd3f", num: "#d19a66", kw: "#5c019a", lbl: "#f6a6fd", fn: "#5c019a", var: "#f6a6fd" },
    dracula: { bg: "#282a36", fg: "#f8f8f2", muted: "#f8f8f250", gutter: "#6272a4", hl: "rgba(255, 255, 255, 0.1)", cm: "#6272a4", str: "#f1fa8c", num: "#BD93F9", kw: "#ff79c6", lbl: "#f8f8f2", fn: "#50fa7b", var: "#f8f8f2" },
  };
  const TEXT_KEYS = ["fg", "muted", "gutter", "cm", "str", "num", "kw", "lbl", "fn", "var"];
  const THEMES = {};
  for (const [name, r] of Object.entries(RAW)) {
    const bg = parse(r.bg), th = { bg, hl: over(parse(r.hl), bg) };
    for (const k of TEXT_KEYS) th[k] = legible(parse(r[k]), bg);
    // the graffiti crew for the drops comes from the theme's own syntax colors
    th.gFill = th.str; th.gLine = th.kw; th.gShadow = th.num; th.gShine = th.fg;
    // an outline too close to the fill smears the letters: push it away from the fill to 3:1
    const lf = lum(th.gFill), up = lum(th.gLine) > lf || (lum(th.gLine) === lf && lf < 0.5), to = up ? 255 : 0;
    for (let k = 0; k < 60 && ratio(th.gLine, th.gFill) < 3; k++) th.gLine = th.gLine.map((v, i) => (i < 3 ? v + (to - v) * 0.04 : v));
    THEMES[name] = th;
  }
  for (const [, name] of SQ.themes) if (!THEMES[name]) throw new Error(`unknown theme "${name}" (see references/themes.md)`);
  const BLEND = 1.2; // seconds per theme switch
  const mix = (a, b, u) => a.map((v, i) => (i < 3 ? Math.sqrt(v * v + (b[i] * b[i] - v * v) * u) : v + (b[i] - v) * u));
  const themeAt = (t) => { // SQ.themes rows: [switch time, theme, blend start]
    let i = 0;
    while (i + 1 < SQ.themes.length && SQ.themes[i + 1][2] <= t) i++;
    const cur = THEMES[SQ.themes[i][1]];
    if (i === 0) return cur;
    const u = inOut((t - SQ.themes[i][2]) / BLEND);
    if (u >= 1) return cur;
    const prev = THEMES[SQ.themes[i - 1][1]], out = {};
    for (const k of Object.keys(cur)) out[k] = mix(prev[k], cur[k], u);
    return out;
  };
  const css = (c, a = 1) => `rgba(${c[0].toFixed(1)},${c[1].toFixed(1)},${c[2].toFixed(1)},${(c[3] * a).toFixed(3)})`;
  const rootEl = document.getElementById("root");
  const paintTheme = (th) => { for (const k of ["bg", "hl", ...TEXT_KEYS]) rootEl.style.setProperty("--" + k, css(th[k])); };

  // ---------- layout ----------
  const CH = 16.8, LH = 42, GUT = 64, TOP = 40, SLIDER_CELLS = 6, SHEET_W = 1106;
  const code = SQ.code;
  const lines = code.split("\n");
  const CODE_LINES = lines.length;
  if (SQ.signoff) lines.push(SQ.signoff); // display only: typed under the program at the very end
  const lineStart = [];
  { let o = 0; for (const l of lines) { lineStart.push(o); o += l.length + 1; } }
  const lineOf = (off) => {
    let lo = 0, hi = CODE_LINES - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStart[m] <= off) lo = m; else hi = m - 1; }
    return lo;
  };
  const sliders = SQ.sliders.map((s) => {
    const line = lineOf(s.from);
    return { line, idx: s.from - lineStart[line], frac: (parseFloat(s.value) - s.min) / (s.max - s.min) };
  });
  const sliderOn = (line) => sliders.find((s) => s.line === line);
  const colOf = (line, idx) => { const s = sliderOn(line); return idx + (s && idx >= s.idx ? SLIDER_CELLS : 0); };
  const charAtCol = (line, col) => {
    const s = sliderOn(line);
    let idx = col;
    if (s && col >= s.idx) { if (col < s.idx + SLIDER_CELLS) return "="; idx = col - SLIDER_CELLS; }
    return lines[line][idx] ?? " ";
  };

  // ---------- syntax classes, enough for codemirror-style coloring ----------
  const syntax = (() => {
    const cls = new Array(code.length).fill("p");
    let i = 0;
    while (i < code.length) {
      const c = code[i];
      if (c === "/" && code[i + 1] === "/") { while (i < code.length && code[i] !== "\n") cls[i++] = "cm"; continue; }
      if (c === '"' || c === "`" || c === "'") {
        const q = c; cls[i++] = "str";
        while (i < code.length && code[i] !== q) cls[i++] = "str";
        if (i < code.length) cls[i++] = "str";
        continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || "") && !/[A-Za-z_)]/.test(code[i - 1] || ""))) {
        while (i < code.length && /[0-9.]/.test(code[i])) cls[i++] = "num";
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i; while (j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++;
        const word = code.slice(i, j), prev = code[i - 1], next = code[j];
        const atLineStart = i === 0 || code.slice(code.lastIndexOf("\n", i - 1) + 1, i).trim() === "";
        const k = word === "const" || word === "let" ? "kw" : atLineStart && next === ":" ? "lbl" : next === "(" || prev === "." ? "fn" : "var";
        for (let x = i; x < j; x++) cls[x] = k;
        i = j; continue;
      }
      i++;
    }
    return cls;
  })();

  // ---------- paragraphs: each is muted until its first note, then blooms down the block ----------
  const paraOfLine = new Int16Array(lines.length).fill(-1);
  SQ.paragraphs.forEach((p, pi) => { for (let i = p.from; i <= p.to; i++) paraOfLine[i] = pi; });
  const lineOn = (i, t) => {
    if (i === 0 || i >= CODE_LINES) return 1;
    const p = SQ.paragraphs[paraOfLine[i]];
    return p ? out4((t - p.on - 0.022 * (i - p.from)) / 0.3) : 1;
  };
  // the opener: line 1 types, then the program fades in (the camera pans in data/events.js)
  const TYPE = [0.1, 0.95], FADE = [1.0, 1.45];
  const typedCount = (t) => (SQ.opener ? Math.floor(lines[0].length * clamp((t - TYPE[0]) / (TYPE[1] - TYPE[0]))) : lines[0].length);
  const caretOn = (t) => SQ.opener && t >= TYPE[0] - 0.05 && t < FADE[1];
  // the sign-off: caret at the end of the program, enter, enter, type, fade out
  const LAST = CODE_LINES - 2, GAP = CODE_LINES - 1, SIGN = CODE_LINES;
  const ENDING = { caret: END + 1.6, enter1: END + 1.85, enter2: END + 2.0, type: [END + 2.1, END + 2.95], fade: [END + 3.4, END + 4.5] };
  const signTyped = (t) => {
    if (!SQ.signoff) return 0;
    const u = clamp((t - ENDING.type[0]) / (ENDING.type[1] - ENDING.type[0]));
    return u > 0 ? clamp(Math.floor(SQ.signoff.length * (u + 0.04 * Math.sin(u * 19)) + 1e-6), 0, SQ.signoff.length) : 0;
  };
  const endCaret = (t) => {
    if (!SQ.signoff || t < ENDING.caret || t >= ENDING.fade[0]) return null;
    if (t < ENDING.enter1) return { line: LAST, col: colOf(LAST, lines[LAST].length) };
    if (t < ENDING.enter2) return { line: GAP, col: 0 };
    return { line: SIGN, col: signTyped(t) };
  };
  const bornAt = (i) => (!SQ.signoff ? -1e9 : i === GAP ? ENDING.enter1 : i === SIGN ? ENDING.enter2 : -1e9);

  // ---------- DOM ----------
  const sheet = document.getElementById("sheet"), cam = document.getElementById("cam");
  const allow = (el) => { el.setAttribute("data-layout-allow-occlusion", ""); el.setAttribute("data-layout-allow-overlap", ""); return el; }; // intentional layering
  const rowEls = lines.map((text, i) => {
    const row = allow(document.createElement("div")); row.className = "row";
    const hl = document.createElement("div"); hl.className = "hl"; row.appendChild(hl);
    const glow = document.createElement("div"); glow.className = "glow"; row.appendChild(glow);
    const gut = allow(document.createElement("div")); gut.className = "gut"; gut.textContent = String(i + 1); row.appendChild(gut);
    const txt = allow(document.createElement("div")); txt.className = "txt";
    const a = lineStart[i], s = sliderOn(i);
    const clsAt = (k) => (i >= CODE_LINES ? "cm" : syntax[a + k]);
    const addRun = (from, to) => { // one span per run of the same syntax class
      let k = from;
      while (k < to) {
        let e = k; while (e < to && clsAt(e) === clsAt(k)) e++;
        const sp = allow(document.createElement("span")); sp.className = "t-" + clsAt(k); sp.textContent = text.slice(k, e);
        txt.appendChild(sp); k = e;
      }
    };
    if (s) {
      addRun(0, s.idx);
      const sl = document.createElement("span"); sl.className = "sl";
      sl.innerHTML = '<span class="trk"><span class="fil"></span></span><span class="thb"></span>';
      sl.querySelector(".fil").style.width = (s.frac * 100).toFixed(1) + "%";
      sl.querySelector(".thb").style.left = (6 + s.frac * (100.8 - 16)).toFixed(1) + "px";
      txt.appendChild(sl); addRun(s.idx, text.length);
    } else addRun(0, text.length);
    row.appendChild(txt); sheet.appendChild(row);
    return { row, hl, glow, gut, txt, fullW: colOf(i, text.length) * CH + 4 };
  });
  const widgets = SQ.widgets.map((w) => {
    const H = w.kind === "scope" ? 110 : Math.max(56, Math.min(112, (SQ.punch[w.part]?.rows ?? 8) * 7));
    const el = document.createElement("div"); el.className = "widget";
    const cv = document.createElement("canvas"); cv.width = 1882; cv.height = H * 2; cv.style.height = H + "px";
    el.appendChild(cv); sheet.appendChild(el);
    const p = SQ.paragraphs[paraOfLine[w.line]];
    return { ...w, H, el, ctx: cv.getContext("2d"), openT: p ? p.on : PRE };
  });
  const widgetAfter = new Map(widgets.map((w) => [w.line, w]));
  const locs = SQ.locs.map((l) => {
    const line = lineOf(l.s);
    const el = allow(document.createElement("div")); el.className = "hlbox";
    const inv = allow(document.createElement("div")); inv.className = "inv";
    const sp = allow(document.createElement("span")); sp.textContent = code.slice(l.s, l.e); inv.appendChild(sp);
    const ringEl = document.createElement("div"); ringEl.className = "ring";
    el.appendChild(inv); el.appendChild(ringEl); sheet.appendChild(el);
    const p = SQ.paragraphs[paraOfLine[line]];
    // l.ring (from build-data) says whether this token rings; ringEl is the element that draws it
    return { ...l, line, c0: colOf(line, l.s - lineStart[line]), c1: colOf(line, l.e - lineStart[line]), el, inv, ringEl, on0: p ? p.on : PRE };
  });
  const flash = document.getElementById("fflash"), caret = document.getElementById("caret");
  sheet.appendChild(caret);
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const energyBytes = b64(SQ.energy);
  const energyAt = (t) => energyBytes[clamp(Math.round(t * FPS), 0, energyBytes.length - 1)] / 255;
  const scopeBytes = SQ.scope ? b64(SQ.scope.b64) : null;
  const scopeAt = (t, p) => {
    if (!scopeBytes) return 0;
    const f = clamp(Math.round(t * FPS), 0, SQ.scope.frames - 1), b = scopeBytes[f * SQ.scope.points + p];
    return (b > 127 ? b - 256 : b) / 127;
  };
  const POINTS = SQ.scope ? SQ.scope.points : 96;

  // ---------- music signals ----------
  const sweepAt = (t) => { // hpf and room written by all(), read off every 16th
    const s = SQ.sweep16, n = s.length / 3, i = upper(s, 3, t) - 1;
    if (i < 0) return { hpf: 0, room: 0 };
    const j = Math.min(n - 1, i + 1), u = j > i ? clamp((t - s[i * 3]) / (s[j * 3] - s[i * 3])) : 0;
    const lerp = (k) => s[i * 3 + k] + (s[j * 3 + k] - s[i * 3 + k]) * (s[j * 3 + 1] < s[i * 3 + 1] ? 0 : u); // no ramp across a reset
    return { hpf: lerp(1), room: lerp(2) };
  };
  const kickEnv = (t, tau) => { let m = 0; for (const k of recent(SQ.kicks, 1, t, 0.6)) m += Math.exp(-(t - SQ.kicks[k]) / tau); return m; };

  // ---------- per-frame layout ----------
  const rowY = new Float64Array(lines.length);
  const layout = (t) => {
    let y = TOP;
    for (let i = 0; i < lines.length; i++) {
      rowY[i] = y; y += LH;
      const w = widgetAfter.get(i);
      if (w) { const h = w.H * out4((t - w.openT) / 0.2); w.y = y; w.h = h; y += h + 16 * (h / w.H); }
    }
  };

  // ---------- camera: the shot list from data/events.js ----------
  const anchorY = (line) => rowY[clamp(line, 0, lines.length - 1)] + LH / 2;
  const cyFor = (y, f, s) => y - (f - 0.5) * 1080 / s;
  const shots = SQ.shots.map((sh, i, arr) => ({ ...sh, end: i + 1 < arr.length ? arr[i + 1].t : DUR }));
  const shotState = (sh, t) => {
    const u = clamp((t - sh.t) / Math.max(0.001, sh.end - sh.t));
    const s = sh.s * (1 + (sh.creep || 0) * u + (sh.push || 0) * u * u);
    return { s, cy: cyFor(anchorY(sh.line), sh.f, s) };
  };
  const camera = (t) => {
    let i = 0; while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
    const sh = shots[i], cur = shotState(sh, t);
    if (i > 0 && sh.dur > 0 && t < sh.t + sh.dur) {
      const prev = shotState(shots[i - 1], t), u = (sh.ease === "inOut" ? inOut : out4)((t - sh.t) / sh.dur);
      return { s: Math.exp(Math.log(prev.s) + (Math.log(cur.s) - Math.log(prev.s)) * u), cy: prev.cy + (cur.cy - prev.cy) * u };
    }
    return cur;
  };

  // ---------- widgets ----------
  const drawPunch = (w, t, th) => {
    const { ctx } = w, Wd = 1882, H = w.H * 2, P = SQ.punch[w.part];
    ctx.clearRect(0, 0, Wd, H);
    if (w.h < 1 || !P) return;
    const rh = H / P.rows, t0 = t - SPC, t1 = t + SPC, ev = P.ev;
    for (let k = firstAtOrAfter(ev, 3, t0 - 2 * SPC); k < ev.length / 3; k++) {
      const a = ev[k * 3], b = ev[k * 3 + 1], r = ev[k * 3 + 2];
      if (a > t1) break;
      if (b < t0) continue;
      const x0 = ((a - t0) / (t1 - t0)) * Wd, x1 = ((b - t0) / (t1 - t0)) * Wd, act = a <= t && t < b;
      const grow = act ? 2 * Math.exp(-(t - a) / 0.08) : 0; // a hit swells its bar for a moment
      ctx.fillStyle = css(th.fg, act ? 1 : 0.5);
      ctx.fillRect(x0 + 1, r * rh + 1 - grow * 2, Math.max(2, x1 - x0 - 3), Math.max(2, rh - 3) + grow * 4);
    }
    ctx.fillStyle = css(th.fg, 0.9); ctx.fillRect(Wd / 2 - 1, 0, 3, H);
  };
  const drawScope = (w, t, th) => {
    const { ctx } = w, Wd = 1882, H = w.H * 2;
    ctx.clearRect(0, 0, Wd, H);
    if (w.h < 1) return;
    ctx.strokeStyle = css(th.fg); ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.beginPath();
    for (let p = 0; p < POINTS; p++) {
      const x = (p / (POINTS - 1)) * Wd, y = H / 2 - clamp(scopeAt(t, p) * 2.6, -1, 1) * (H / 2 - 10);
      if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  };

  // ---------- builds: the sweep corrupts the code ----------
  const gcv = document.getElementById("glitch"), gctx = gcv.getContext("2d");
  const RAMP = " .:-=+*#%@";
  const codeChars = [...new Set(code.replace(/\s/g, ""))].join("");
  const drawGlitch = (t, v, S, tx, ty, th) => {
    gctx.clearRect(0, 0, 1080, 1080);
    gcv.style.display = v <= 0.02 ? "none" : "block"; // an idle canvas counts as opaque to the layout checker
    if (v <= 0.02) return;
    const step = Math.floor(t * 20), n = Math.floor(v * v * 280);
    gctx.font = `500 ${(28 * S).toFixed(1)}px "JetBrains Mono"`; gctx.textBaseline = "middle";
    for (let k = 0; k < n; k++) {
      const i = Math.floor(hash(k, step, 7) * (CODE_LINES - 1)), len = colOf(i, lines[i].length);
      if (!len) continue;
      const col = Math.floor(hash(k, step, 11) * len), x = tx + (GUT + col * CH) * S, y = ty + (rowY[i] + LH / 2) * S;
      if (x < -20 || x > 1100 || y < -20 || y > 1100) continue;
      const cells = 1 + Math.floor(hash(k, step, 13) * 3 * v), invert = hash(k, step, 17) < 0.25;
      gctx.fillStyle = css(invert ? th.fg : th.bg);
      gctx.fillRect(x - 1, y - LH * S * 0.42, CH * S * cells + 2, LH * S * 0.84);
      gctx.fillStyle = css(invert ? th.bg : [th.fg, th.str, th.kw][k % 3]);
      for (let c = 0; c < cells; c++) {
        const ch = hash(k, c, step) < 0.5 ? RAMP[1 + Math.floor(hash(k, c, 3) * 9)] : codeChars[Math.floor(hash(c, k, step) * codeChars.length)];
        gctx.fillText(ch, x + c * CH * S, y);
      }
    }
  };

  // ---------- drops: the graffiti ASCII storm ----------
  const scv = document.getElementById("storm"), sctx = scv.getContext("2d");
  const GRID = { cw: 10.8, ch: 18 };
  const ATLAS_CHARS = [...new Set(RAMP.slice(1) + codeChars + "@#%/o*+")].join("");
  { // one white glyph per cell, tinted per layer when composited
    GRID.map = new Map([...ATLAS_CHARS].map((c, i) => [c, i]));
    GRID.aw = Math.ceil(GRID.cw); GRID.ah = Math.ceil(GRID.ch);
    const cv = document.createElement("canvas"); cv.width = GRID.aw * ATLAS_CHARS.length; cv.height = GRID.ah;
    const c = cv.getContext("2d");
    c.font = `700 ${GRID.ch * 0.86}px "JetBrains Mono"`; c.textBaseline = "middle"; c.textAlign = "center"; c.fillStyle = "#fff";
    [...ATLAS_CHARS].forEach((ch, i) => c.fillText(ch, i * GRID.aw + GRID.aw / 2, GRID.ah / 2 + 1));
    GRID.atlas = cv;
  }
  const LAYERS = ["field", "shadow", "fill", "line", "shine"];
  const layer = Object.fromEntries(LAYERS.map((k) => { const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1080; return [k, { cv, ctx: cv.getContext("2d") }]; }));

  // bubble letters: each letter on its own with a bounce and a tilt, a fat rounded fill, an outline
  // ring that separates it from its neighbours, a stepped 3D shadow, a top-left shine and drips.
  // One byte of flags per 3 screen px
  const MS = 360, F_FILL = 1, F_LINE = 2, F_SHADOW = 4, F_SHINE = 8;
  const bubble = (text, seed) => {
    const chars = [...text], n = chars.length;
    const cv = document.createElement("canvas"); cv.width = MS; cv.height = MS;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c.font = `400 100px "Rubik Mono One"`;
    const em = c.measureText("M").width / 100, digits = /^[0-9]+$/.test(text);
    const adv = (MS * (digits ? 0.74 : 0.78)) / Math.max(n, 1.6); // leaves room for the outline and shadow
    const long = !digits && n > 4; // long words: glyph + outline fits its slot, or the letters fuse
    const size = Math.min(digits ? 190 : 210, (adv / (em + (long ? 0.2 : 0))) * (digits ? 0.96 : 1.04));
    const stretch = digits ? 1.12 : n > 3 ? 1.55 : 1.3, fat = size * 0.045, ring = size * (digits ? 0.06 : 0.05); // thicker closes the counters in M, R and E
    const letterMask = (i, lw) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, MS, MS);
      const cx = MS / 2 + (i - (n - 1) / 2) * adv, cy = MS / 2 + (hash(seed, i, 5) - 0.5) * size * 0.28;
      const rot = (hash(seed, i, 6) - 0.5) * 0.3, sc = 0.94 + 0.12 * hash(seed, i, 7);
      c.setTransform(Math.cos(rot) * sc, Math.sin(rot) * sc * stretch, -Math.sin(rot) * sc, Math.cos(rot) * sc * stretch, cx, cy);
      c.font = `400 ${size}px "Rubik Mono One"`; c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineCap = "round";
      c.fillStyle = "#fff"; c.strokeStyle = "#fff"; c.lineWidth = lw;
      c.fillText(chars[i], 0, 0); c.strokeText(chars[i], 0, 0);
      return c.getImageData(0, 0, MS, MS).data;
    };
    const flags = new Uint8Array(MS * MS), union = new Uint8Array(MS * MS), fillU = new Uint8Array(MS * MS);
    for (let i = 0; i < n; i++) { // later letters paint over earlier ones, like layered tags
      const F = letterMask(i, fat), O = letterMask(i, fat + 2 * ring);
      for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) {
        const p = y * MS + x;
        if (O[p * 4 + 3] < 128) continue;
        union[p] = 1;
        if (F[p * 4 + 3] >= 128) {
          const q = ((y - 4) * MS + (x - 3)) * 4 + 3;
          flags[p] = y >= 4 && x >= 3 && F[q] >= 128 ? F_FILL : F_FILL | F_SHINE;
          fillU[p] = 1;
        } else { flags[p] = F_LINE; fillU[p] = 0; }
      }
    }
    const depth = Math.round(size * 0.09);
    for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) {
      const p = y * MS + x;
      if (union[p]) continue;
      for (let k = 1; k <= depth; k++) if (x - k >= 0 && y - k >= 0 && union[(y - k) * MS + (x - k)]) { flags[p] = F_SHADOW; break; }
    }
    const drips = []; // paint running off the bottom edges of the fill
    for (let k = 0; k < 10; k++) {
      const x = Math.floor(MS * (0.12 + 0.76 * hash(seed, k, 1)));
      let yb = -1; for (let y = MS - 1; y >= 0; y--) if (fillU[y * MS + x]) { yb = y; break; }
      if (yb > 0) drips.push({ x, yb, len: 14 + 44 * hash(seed, k, 2), w: 2 + 2.5 * hash(seed, k, 3), rate: 0.6 + 0.8 * hash(seed, k, 4) });
    }
    return { flags, drips };
  };
  const WORDS = SQ.words.map((ws, d) => ws.map((w, j) => bubble(w, 1 + d * 10 + j)));
  const NUMS = Array.from({ length: 17 }, (_, i) => bubble(String(i), 100 + i));
  const shapeAt = (sh, x, y, scale, age) => {
    const u = Math.round(((x - 540) / scale + 540) / 3), v = Math.round(((y - 540) / scale + 540) / 3);
    if (u < 0 || v < 0 || u >= MS || v >= MS) return 0;
    const f = sh.flags[v * MS + u];
    if (f) return f;
    for (const d of sh.drips) {
      const len = d.len * clamp((age * d.rate) / 1.2);
      if (Math.abs(u - d.x) <= d.w && v > d.yb && v < d.yb + len) return F_FILL;
      if (len > 4 && Math.hypot(u - d.x, v - (d.yb + len)) < d.w + 2) return F_FILL; // the drop at the tip
    }
    return 0;
  };

  const stormField = (t, d0, di) => { // one drop, one scene per bar
    const k = Math.floor((t - d0) / SPC), inBar = (t - d0) / SPC - k;
    const E = energyAt(t), kick = kickEnv(t, 0.09), surge = kickEnv(t, 0.16);
    const kicks = recent(SQ.kicks, 1, t, 0.8).map((i) => SQ.kicks[i]);
    const snares = recent(SQ.snares, 1, t, 0.3).map((i) => SQ.snares[i]);
    const rain = recent(SQ.rain, 3, t, 0.55).map((i) => [SQ.rain[i * 3], SQ.rain[i * 3 + 2]]);
    const scene = k === 0 && WORDS[di]?.length ? "word" : k === 1 ? "number" : k <= 3 ? "punch" : k <= 5 ? "tunnel" : k === 6 ? "scope" : "all";
    const words = WORDS[di] ?? [], second = words.length > 1 && inBar >= 0.5;
    const word = words[second ? 1 : 0], wordT0 = d0 + (second ? SPC / 2 : 0);
    const wordScale = (1 + 0.3 * (1 - out4((t - wordT0) / 0.16))) * (1 + 0.04 * kick);
    const barT = d0 + k * SPC, num = NUMS[clamp(k + 1, 0, 16)], numScale = (1 + 0.25 * Math.exp(-(t - barT) / 0.06)) * (1 + 0.04 * kick);
    const phase = Math.floor((t - PRE) / (SPC / 16));
    const A = scene === "word" || scene === "number" ? 7 + 22 * surge : 14 + 46 * surge; // the liquid warp surges on every kick
    const warp = (x, y) => [
      x + A * Math.sin(y * 0.0105 + t * 2.3) + 0.5 * A * Math.sin((x + y) * 0.019 - t * 3.1),
      y + A * Math.cos(x * 0.0118 - t * 1.9) + 0.4 * A * Math.sin((x - y) * 0.015 + t * 2.6),
    ];
    const invert = di > 0 && k >= 4 && (kicks.some((tk) => t - tk < 0.045) || snares.some((ts) => t - ts < 0.05));
    const bandY = (ts) => (0.1 + 0.8 * hash(Math.round(ts * 1000), 5)) * 1080;
    const P = SQ.stormPunch;
    const cell = (x0, y0) => { // → [layer, brightness]
      const [x, y] = warp(x0, y0), d = Math.hypot(x - 540, y - 540);
      let v = 0.2 + 0.32 * E + 0.22 * (0.5 + 0.5 * Math.sin(x * 0.012 + t * 2.1 + 2 * Math.sin(y * 0.009 + t * 1.3)));
      v += 0.3 * kick;
      for (const tk of kicks) { const r = (t - tk) * 1500; v += 0.95 * Math.exp(-(t - tk) / 0.45) * Math.exp(-(((d - r) / 55) ** 2)); }
      for (const ts of snares) if (Math.abs(y - bandY(ts) - 30 * Math.sin(x * 0.012 + ts)) < 55) v += 0.75 * Math.exp(-(t - ts) / 0.14);
      const tag = (sh, scale, age) => {
        const f = shapeAt(sh, x, y, scale, age);
        return f & F_SHINE ? ["shine", 1.2] : f & F_FILL ? ["fill", 1.1] : f & F_LINE ? ["line", 1.2] : f & F_SHADOW ? ["shadow", 1.0] : null;
      };
      if (scene === "word" && word) { const g = tag(word, wordScale, t - wordT0); if (g) return g; v *= 0.5; }
      if (scene === "number") { const g = tag(num, numScale, t - barT); if (g) return g; v *= 0.55; }
      if ((scene === "punch" || scene === "all") && P) { // pill-shaped punchcard bars
        const rh = 1080 / P.rows, r = Math.floor(y / rh), yc = r * rh + rh / 2, R = Math.min(34, rh * 0.36);
        if (Math.abs(y - yc) < R) for (let q = firstAtOrAfter(P.ev, 3, t - 2 * SPC); q < P.ev.length / 3 && P.ev[q * 3] < t + SPC; q++) {
          if (P.ev[q * 3 + 2] !== r) continue;
          const xa = 540 + ((P.ev[q * 3] - t) / SPC) * 540 + R, xb = 540 + ((P.ev[q * 3 + 1] - t) / SPC) * 540 - R;
          if (Math.hypot(x - clamp(x, xa, Math.max(xa, xb)), y - yc) < R) return [P.ev[q * 3] <= t && t < P.ev[q * 3 + 1] ? "fill" : "line", 1.1];
        }
        if (Math.abs(x - 540) < 7) v = Math.max(v, 1);
      }
      if (scene === "tunnel" || scene === "all") { // a round tunnel that steps on the 16ths
        const s = 0.5 + 0.5 * Math.cos((Math.log(d + 12) * 7 - phase * 0.55) * Math.PI);
        if (s > 0.86) return [phase % 2 ? "fill" : "line", 1];
        v = Math.max(v, s * s * s * (0.7 + 0.8 * kick));
      }
      if ((scene === "scope" || scene === "all") && scopeBytes) {
        const p = clamp(Math.round((x / 1080) * (POINTS - 1)), 0, POINTS - 1), yw = 540 - clamp(scopeAt(t, p) * 3.2, -1, 1) * 430;
        const dd = Math.abs(y - yw);
        if (dd < 44) return ["fill", 1.2 - dd / 60];
        if (dd < 70) return ["line", 1];
        if (Math.min(Math.abs(y - (yw - 150)), Math.abs(y - (yw + 150))) < 26) return ["shadow", 0.9];
      }
      for (const [t0, midi] of rain) { // pitch-placed rain, one column per note
        const cx = 70 + clamp((midi - 48) / 48) * 940, head = (t - t0) * 2600;
        if (Math.abs(x - cx) < 18 && y < head && y > head - 520) return ["shine", 0.45 + 0.75 * (1 - (head - y) / 520)];
      }
      return ["field", v];
    };
    const shiftRow = (y) => {
      let s = 0;
      for (const ts of snares) if (Math.abs(y - bandY(ts)) < 55) s += (hash(Math.round(ts * 1000), 9) - 0.5) * 360 * Math.exp(-(t - ts) / 0.12);
      return s;
    };
    return { cell, shiftRow, invert, jolt: 1 + 0.035 * kick, phase };
  };

  const CHARS = { shadow: "/", line: "@", shine: "o" };
  const drawStorm = (t, cam2d, th) => {
    const di = DROPS.findIndex(([a, z]) => t >= a && t < z + 1.15);
    if (di < 0) { scv.style.display = "none"; return false; }
    scv.style.display = "block";
    const [d0, d1] = DROPS[di], exiting = t >= d1;
    const S = stormField(exiting ? d1 - 0.001 : t, d0, di); // the storm freezes while it decodes away
    const { cw, ch: chh } = GRID, cols = Math.ceil(1080 / cw), rows = Math.ceil(1080 / chh);
    const enterR = 820 * out4((t - d0) / 0.22), exitR = exiting ? 820 * inOut((t - d1) / 1.1) : -1;
    const full = !exiting && t - d0 >= 0.22;
    for (const k of LAYERS) layer[k].ctx.clearRect(0, 0, 1080, 1080);
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, 1080, 1080);
    sctx.fillStyle = css(S.invert ? th.fg : th.bg);
    if (full) sctx.fillRect(0, 0, 1080, 1080);
    for (let r = 0; r < rows; r++) {
      const y = r * chh + chh / 2, shift = S.shiftRow(y);
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw / 2, d = Math.hypot(x - 540, y - 540);
        if (!full && d > enterR) continue;              // the shatter has not reached this cell yet
        if (exiting && d < exitR - 70) continue;        // decoded: the real editor shows through
        if (!full) sctx.fillRect(c * cw, r * chh, cw + 0.5, chh + 0.5);
        if (exiting && d < exitR) continue;             // the decode front, drawn below from the real code
        let glyph;
        const [L, v] = S.cell(x - shift, y), alpha = clamp(0.35 + 0.65 * v);
        if (L === "field") {
          if (v < 0.13) continue;
          const idx = Math.min(9, Math.floor(v * 9));
          glyph = idx >= 3 && idx <= 7 && hash(c, r, 1) < 0.4 ? codeChars[Math.floor(hash(c, r, S.phase) * codeChars.length)] : RAMP[Math.max(1, idx)];
        } else glyph = CHARS[L] ?? (hash(c, r, S.phase) < 0.5 ? "@" : "#");
        const gi = GRID.map.get(glyph);
        if (gi == null) continue;
        const lc = layer[L].ctx; lc.globalAlpha = alpha;
        lc.drawImage(GRID.atlas, gi * GRID.aw, 0, GRID.aw, GRID.ah, c * cw, r * chh, GRID.aw, GRID.ah);
      }
    }
    // tint each layer with its graffiti color, then stack them
    const tint = { field: S.invert ? th.bg : th.fg, shadow: th.gShadow, fill: th.gFill, line: th.gLine, shine: th.gShine };
    sctx.setTransform(S.jolt, 0, 0, S.jolt, 540 * (1 - S.jolt), 540 * (1 - S.jolt));
    for (const k of LAYERS) {
      const lc = layer[k].ctx;
      lc.globalAlpha = 1; lc.globalCompositeOperation = "source-in"; lc.fillStyle = css(tint[k]); lc.fillRect(0, 0, 1080, 1080);
      lc.globalCompositeOperation = "source-over";
      sctx.drawImage(layer[k].cv, 0, 0);
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    if (exiting) { // the decode front: the editor's own characters, at their real positions and size
      sctx.font = `500 ${(28 * cam2d.S).toFixed(2)}px "JetBrains Mono"`; sctx.textAlign = "center"; sctx.textBaseline = "middle";
      sctx.fillStyle = css(th.fg);
      for (let i = 0; i < CODE_LINES - 1; i++) {
        const y = cam2d.ty + (rowY[i] + LH / 2) * cam2d.S;
        if (y < -40 || y > 1120) continue;
        const cols = colOf(i, lines[i].length);
        for (let col = 0; col < cols; col++) {
          const x = cam2d.tx + (GUT + (col + 0.5) * CH) * cam2d.S, d = Math.hypot(x - 540, y - 540);
          if (d < exitR - 70 || d >= exitR) continue;
          const glyph = charAtCol(i, col);
          if (glyph !== " ") sctx.fillText(glyph, x, y);
        }
      }
    }
    if (t - d0 < 0.22) { sctx.fillStyle = css(th.fg, 0.35 * (1 - (t - d0) / 0.22)); sctx.fillRect(0, 0, 1080, 1080); }
    return full;
  };

  // ---------- paint ----------
  const fadeout = document.getElementById("fadeout"), wash = document.getElementById("wash"), tilt = document.getElementById("tilt");
  const paint = (t) => {
    const th = themeAt(t);
    paintTheme(th);
    layout(t);
    const sw = sweepAt(t);
    const bi = BUILDS.findIndex(([a, z]) => t >= a && t < z);
    const buildV = bi < 0 ? 0 : SQ.sweep16.some((v, i) => i % 3 === 1 && v > 0) ? Math.sqrt(Math.max(0, sw.hpf) / 1800) : clamp((t - BUILDS[bi][0]) / (BUILDS[bi][1] - BUILDS[bi][0]));
    const k = camera(t), S = k.s, cx = Math.min(540 / S - 4, SHEET_W / 2), tx = 540 - cx * S, ty = 540 - k.cy * S;
    const covered = drawStorm(t, { S, tx, ty }, th);
    const step = Math.floor(t * 20);

    const lineFlash = new Float64Array(lines.length);
    for (const l of locs) {
      if (covered || t < l.on0) { l.el.style.display = "none"; continue; }
      const n = upper(l.on, 1, t), lastOn = n ? l.on[n - 1] : -1e9;
      const m = upper(l.iv, 2, t), act = m > 0 && t < l.iv[(m - 1) * 2 + 1], lastEnd = m > 0 ? l.iv[(m - 1) * 2 + 1] : -1e9;
      const flashA = act ? Math.exp(-(t - lastOn) / 0.085) * l.gain : 0;
      const box = act ? 1 : 0.7 * Math.exp(-(t - lastEnd) / 0.28); // the fading trail
      const ru = (t - lastOn) / 0.3, ringA = l.ring && ru >= 0 && ru < 1 ? (1 - ru) * 0.9 : 0;
      if (box < 0.02 && ringA < 0.02) { l.el.style.display = "none"; continue; }
      l.el.style.display = "block";
      l.el.style.transform = `translate3d(${GUT + l.c0 * CH - 3}px, ${rowY[l.line] + 5}px, 0)`;
      l.el.style.width = (l.c1 - l.c0) * CH + 6 + "px"; l.el.style.height = LH - 10 + "px";
      l.el.style.borderColor = css(th.fg, box);
      l.inv.style.opacity = flashA.toFixed(3);
      l.ringEl.style.opacity = ringA.toFixed(3);
      l.ringEl.style.transform = `scale(${(1 + 0.8 * out4(ru)).toFixed(3)}, ${(1 + 0.55 * out4(ru)).toFixed(3)})`;
      lineFlash[l.line] += flashA;
    }

    const typed = typedCount(t), fadeIn = SQ.opener ? inOut((t - FADE[0]) / (FADE[1] - FADE[0])) : 1, ec = endCaret(t);
    for (let i = 0; i < lines.length; i++) {
      const r = rowEls[i];
      let x = 0; // late in a build some rows tear sideways
      if (buildV > 0.55 && i < CODE_LINES && hash(i, step, 23) < (buildV - 0.55) * 0.5) x = (hash(i, step, 29) - 0.5) * 8 * CH * buildV;
      r.row.style.transform = `translate3d(${x.toFixed(1)}px, ${rowY[i]}px, 0)`;
      r.row.style.opacity = i === 0 ? 1 : fadeIn.toFixed(3);
      r.row.style.setProperty("--on", lineOn(i, t).toFixed(3));
      r.gut.style.opacity = i === 0 ? (!SQ.opener || t >= TYPE[0] ? 1 : 0) : t >= bornAt(i) ? 1 : 0;
      r.txt.style.width = (i === 0 ? typed * CH + 4 : i === SIGN ? signTyped(t) * CH + 4 : r.fullW) + "px";
      r.hl.style.opacity = (i === 0 && caretOn(t)) || (ec && ec.line === i) ? 1 : 0;
      r.glow.style.opacity = Math.min(0.13, lineFlash[i] * 0.09).toFixed(3);
    }
    for (const w of widgets) {
      w.el.style.transform = `translate3d(0, ${w.y}px, 0)`; w.el.style.height = w.h + "px";
      if (covered) continue;
      if (w.kind === "punch") drawPunch(w, t, th); else drawScope(w, t, th);
    }
    if (caretOn(t)) { caret.style.display = "block"; caret.style.transform = `translate3d(${GUT + typed * CH}px, ${rowY[0] + 4}px, 0)`; }
    else if (ec) { caret.style.display = "block"; caret.style.transform = `translate3d(${GUT + ec.col * CH}px, ${rowY[ec.line] + 4}px, 0)`; }
    else caret.style.display = "none";

    let fl = 0; // ctrl+enter flashes: the audio start and every paragraph that powers on
    for (const bt of [PRE, ...SQ.paragraphs.map((p) => p.on).filter((v) => v > PRE)]) if (t >= bt && t < bt + 0.34) fl = Math.max(fl, (bt === PRE ? 0.3 : 0.18) * Math.pow(1 - (t - bt) / 0.34, 2));
    flash.style.opacity = covered ? 0 : fl.toFixed(3);
    cam.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${S.toFixed(5)})`;
    tilt.style.visibility = covered ? "hidden" : "visible";
    drawGlitch(t, covered ? 0 : buildV, S, tx, ty, th);
    wash.style.opacity = covered || bi < 0 ? 0 : (clamp(buildV) * 0.42).toFixed(3);
    fadeout.style.opacity = SQ.signoff ? inOut((t - ENDING.fade[0]) / (ENDING.fade[1] - ENDING.fade[0])).toFixed(3) : inOut((t - (DUR - 0.8)) / 0.8).toFixed(3);
  };

  // paint from a setter GSAP writes on every render: seek() suppresses onUpdate callbacks by default
  const P = { _t: 0, get t() { return this._t; }, set t(v) { this._t = v; paint(v); } };
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(P, { t: 0 }, { t: DUR, duration: DUR, ease: "none", lazy: false }, 0);
  paint(0);
  return tl;
};
