// Turns what record.mjs wrote into data/events.js for the composition, and stamps the video
// length into index.html (HyperFrames reads the root data-duration before any script runs).
//
// usage: node build-data.mjs <project-dir>
// reads:  video.json, data/events.json, assets/bgm.wav, assets/stem-<part>.wav
// writes: data/events.js, and the data-duration attributes in index.html
import fs from "node:fs";
import path from "node:path";

const fail = (msg) => { console.error("build-data: " + msg); process.exit(1); };
const project = path.resolve(process.argv[2] ?? fail("usage: node build-data.mjs <project-dir>"));
const here = path.dirname(new URL(import.meta.url).pathname);

// the OFL fonts the composition uses, from the pinned @fontsource packages
fs.mkdirSync(path.join(project, "assets/fonts"), { recursive: true });
for (const [pkg, file] of [["jetbrains-mono", "jetbrains-mono-latin-500-normal.woff2"], ["jetbrains-mono", "jetbrains-mono-latin-700-normal.woff2"], ["rubik-mono-one", "rubik-mono-one-latin-400-normal.woff2"]]) {
  const src = path.join(here, "node_modules/@fontsource", pkg, "files", file);
  if (!fs.existsSync(src)) fail(`missing ${src}: run npm install in ${here}`);
  fs.copyFileSync(src, path.join(project, "assets/fonts", file));
}
const cfg = JSON.parse(fs.readFileSync(path.join(project, "video.json"), "utf8"));
const rec = JSON.parse(fs.readFileSync(path.join(project, "data/events.json"), "utf8"));

const FPS = cfg.fps ?? 30, PRE = cfg.pre ?? 2.0, SPC = 1 / rec.cps;
const bar = (b) => PRE + (b - 1) * SPC;            // start of bar b (1-based), in video seconds
const sec = (c) => +(PRE + c * SPC).toFixed(4);    // strudel cycle -> video seconds
const END = bar(rec.bars + 1);                      // the arrangement ends here
const DUR = +Math.max(PRE + (rec.bars + rec.endingBars) * SPC, END + (cfg.signoff ? 4.6 : 1.2)).toFixed(3);

const code = rec.code, lines = code.split("\n");
const lineStart = []; { let o = 0; for (const l of lines) { lineStart.push(o); o += l.length + 1; } }
const lineOf = (off) => { let i = 0; while (i + 1 < lines.length && lineStart[i + 1] <= off) i++; return i; };

// ---------- token highlights ----------
const byLoc = new Map();
for (const e of rec.events) for (const [a, b] of e.locs) {
  const k = a + ":" + b;
  if (!byLoc.has(k)) byLoc.set(k, { iv: [], parts: {} });
  const L = byLoc.get(k); L.iv.push([sec(e.c0), sec(e.c1)]); L.parts[e.part] = (L.parts[e.part] || 0) + 1;
}
const barsActive = (part) => new Set(rec.events.filter((e) => e.part === part).map((e) => Math.floor(e.c0))).size || 1;
const density = Object.fromEntries(rec.labels.map((p) => [p, rec.events.filter((e) => e.part === p).length / barsActive(p)]));
const locs = [...byLoc.entries()].map(([k, L]) => {
  const iv = L.iv.sort((p, q) => p[0] - q[0]), merged = [];
  for (const [a, b] of iv) { const last = merged[merged.length - 1]; if (last && a <= last[1] + 0.002) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
  const part = Object.entries(L.parts).sort((p, q) => q[1] - p[1])[0][0];
  const busy = density[part] > 8; // 16th-note parts flash softly and skip the ring
  const [s, e] = k.split(":").map(Number);
  return { s, e, iv: merged.flat(), on: [...new Set(iv.map(([a]) => a))], part, gain: busy ? 0.32 : 0.9, ring: !busy };
}).sort((p, q) => p.s - q.s);

// ---------- paragraphs: runs of non-blank lines; each powers on with its first note ----------
const paragraphs = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const from = i; while (i + 1 < lines.length && lines[i + 1].trim()) i++;
  paragraphs.push({ from, to: i });
}
for (const p of paragraphs) {
  const firsts = locs.filter((l) => { const ln = lineOf(l.s); return ln >= p.from && ln <= p.to; }).map((l) => l.on[0]);
  p.on = firsts.length ? Math.max(PRE, Math.min(...firsts)) : PRE;
  p.label = (lines.slice(p.from, p.to + 1).join("\n").match(/^([A-Za-z$][\w$]*):\s/m) || [])[1] ?? null;
}
const paragraphOf = (line) => paragraphs.find((p) => line >= p.from && line <= p.to);

// ---------- widgets: punchcards and the scope, under the line that calls them ----------
const labelAbove = (line) => { for (let i = line; i >= 0; i--) { const m = lines[i].match(/^([A-Za-z$][\w$]*):\s/); if (m) return m[1]; } return null; };
const widgets = [];
lines.forEach((l, i) => {
  if (l.includes("._punchcard(")) widgets.push({ line: i, kind: "punch", part: labelAbove(i) });
  if (l.includes("._scope(")) widgets.push({ line: i, kind: "scope", part: labelAbove(i) });
});
const rowsFor = (part) => {
  const evs = rec.events.filter((e) => e.part === part);
  const key = evs.some((e) => e.midi != null) ? "midi" : "slice";
  const vals = [...new Set(evs.map((e) => e[key] ?? 0))].sort((p, q) => q - p);
  return { rows: Math.max(1, vals.length), ev: evs.map((e) => [sec(e.c0), sec(e.c1), vals.indexOf(e[key] ?? 0)]).flat() };
};
const punch = Object.fromEntries(widgets.filter((w) => w.kind === "punch").map((w) => [w.part, rowsFor(w.part)]));

// ---------- the sweep (hpf / room written by all()), one reading per 16th ----------
const sweep = new Map();
for (const e of rec.events) { const k = Math.round(e.c0 * 16); const cur = sweep.get(k) ?? [sec(k / 16), 0, 0]; cur[1] = Math.max(cur[1], e.hpf ?? 0); cur[2] = Math.max(cur[2], e.room ?? 0); sweep.set(k, cur); }
const sweep16 = [...sweep.values()].sort((p, q) => p[0] - q[0]).flat();

// ---------- storm signals ----------
const st = cfg.storm ?? {};
const onsets = (part) => (part ? rec.events.filter((e) => e.part === part).map((e) => sec(e.c0)) : []);
const kicks = [...new Set(onsets(st.kick))];
const snares = [...new Set(onsets(st.snare))];
const rain = st.rain ? rec.events.filter((e) => e.part === st.rain && e.midi != null).map((e) => [sec(e.c0), sec(e.c1), e.midi]).flat() : [];
const stormPunch = st.punch ? (() => { const r = rowsFor(st.punch); return { rows: r.rows, ev: r.ev }; })() : null;

// ---------- audio: loudness per frame, scope frames from the scope part's stem ----------
const readWav = (file) => {
  const b = fs.readFileSync(file); let off = 12, data = 0, len = 0, ch = 2, rate = 44100;
  while (off < b.length) { const id = b.toString("ascii", off, off + 4), n = b.readUInt32LE(off + 4); if (id === "fmt ") { ch = b.readUInt16LE(off + 10); rate = b.readUInt32LE(off + 12); } if (id === "data") { data = off + 8; len = n; break; } off += 8 + n; }
  const frames = Math.floor(len / 2 / ch);
  return { rate, frames, at: (i) => (i < 0 || i >= frames ? 0 : b.readInt16LE(data + i * 2 * ch) / 32768) };
};
const videoFrames = Math.ceil(DUR * FPS);
const mix = readWav(path.join(project, "assets/bgm.wav"));
const rms = Array.from({ length: videoFrames }, (_, f) => { const a = Math.round((f / FPS - PRE) * mix.rate); let ss = 0, n = 0; for (let i = Math.max(0, a); i < Math.min(mix.frames, a + mix.rate / FPS); i++) { const v = mix.at(i); ss += v * v; n++; } return n ? Math.sqrt(ss / n) : 0; });
const rmsMax = Math.max(1e-6, ...rms);
const energy = Buffer.from(rms.map((v) => Math.round((255 * v) / rmsMax))).toString("base64");
const scopeW = widgets.find((w) => w.kind === "scope");
let scope = null;
if (scopeW) {
  const stem = readWav(path.join(project, `assets/stem-${scopeW.part}.wav`)), POINTS = 96, WIN = Math.round(stem.rate * 0.024);
  let peak = 1e-6; for (let i = 0; i < stem.frames; i += 7) peak = Math.max(peak, Math.abs(stem.at(i)));
  const bytes = Buffer.alloc(videoFrames * POINTS);
  for (let f = 0; f < videoFrames; f++) { const c = Math.round((f / FPS - PRE) * stem.rate); for (let p = 0; p < POINTS; p++) bytes.writeInt8(Math.max(-127, Math.min(127, Math.round((stem.at(c - WIN / 2 + Math.round((p * WIN) / POINTS)) / peak) * 127))), f * POINTS + p); }
  scope = { points: POINTS, frames: videoFrames, b64: bytes.toString("base64") };
}

// ---------- sections and themes ----------
const builds = (cfg.builds ?? []).map(([a, z]) => [bar(a), bar(z)]);
const drops = (cfg.drops ?? []).map(([a, z]) => [bar(a), bar(z)]);
const BLEND = 1.2;
const themes = (cfg.themes ?? [[1, "bluescreen"]]).map(([b, name, when], i) => [i === 0 ? 0 : bar(b), name, i === 0 ? 0 : when === "start" ? bar(b) : bar(b) - BLEND]);

// ---------- camera: an automatic plan unless video.json gives one ----------
const LH = 42;
const fit = (p) => Math.max(0.78, Math.min(1.05, (0.86 * 1080) / ((p.to - p.from + 1) * LH + widgets.filter((w) => w.line >= p.from && w.line <= p.to).length * 110)));
const inDrop = (t) => drops.some(([a, z]) => t >= a && t < z);
const inBuild = (t) => builds.some(([a, z]) => t > a + 0.01 && t < z);
const barOf = (t) => Math.floor((t - PRE) / SPC + 1e-3); // times are stored to 0.1 ms
const musical = paragraphs.filter((p) => p.label);
let shots = cfg.camera?.map(([b, text, opts = {}]) => ({ t: bar(b), line: lines.findIndex((l) => l.includes(text)), f: 0.3, s: 1, dur: 0.45, ...opts }));
if (!shots) {
  const first = musical[0] ?? paragraphs[0];
  shots = cfg.opener === false ? [{ t: 0, dur: 0, s: fit(first), line: first.from, f: 0.3, creep: 0.04 }]
    : [{ t: 0, dur: 0, s: 1.3, line: 0, f: 0.42, creep: 0.04 }, { t: 1.1, dur: PRE - 1.1, ease: "inOut", s: 1.0, line: first.from, f: 0.3 }, { t: PRE, dur: 0, s: 1.0, line: first.from, f: 0.3, creep: 0.04 }];
  let last = first;
  for (let b = 2; b <= rec.bars; b++) { // on every bar, frame what just powered on; tour every 2 bars otherwise
    const t = bar(b); if (inDrop(t)) continue;
    const fresh = musical.find((p) => Math.abs(p.on - t) < SPC / 4 && p !== last);
    const build = builds.find(([a]) => Math.abs(a - t) < 0.01);
    const afterDrop = drops.find(([, z]) => Math.abs(z - t) < 0.01);
    let target = null, extra = {};
    if (build && !afterDrop) { target = paragraphs.find((p) => lines.slice(p.from, p.to + 1).join("\n").includes("all(")) ?? last; extra = { push: 0.14 }; }
    else if (fresh && !inBuild(t)) target = fresh; /* a build keeps its push */
    else if (!afterDrop && !inBuild(t) && (b - 1) % 2 === 0) { /* tour, never mid-build: it would cancel the push */ const live = musical.filter((p) => p.on <= t); target = live[(live.indexOf(last) + 1) % live.length]; }
    if (target && target !== last) { shots.push({ t, dur: 0.45, s: fit(target), line: target.from, f: 0.12, creep: 0.04, ...extra }); last = target; }
  }
  for (const [a, z] of drops) { // under the storm, set up the framing its decode reveals
    const shown = z >= END - 0.01 ? { s: 0.56, line: paragraphs[Math.floor(paragraphs.length / 2)].from, f: 0.5 } : (() => { const p = [...musical].filter((q) => q.on <= z).sort((x, y) => barOf(y.on) - barOf(x.on) || y.from - x.from)[0] ?? last; /* newest code by bar, the lower one on ties */ return { s: 0.9, line: p.from, f: 0.3 }; })();
    shots.push({ t: a, dur: 0, ...shown });
    const build2 = builds.find(([b0]) => Math.abs(b0 - z) < 0.01);
    if (z < END - 0.01) shots.push({ t: z, dur: 0, ...shown, push: build2 ? 0.2 : 0.05 });
  }
}
if (cfg.signoff) shots.push({ t: END + 1.0, dur: 0.8, ease: "inOut", s: 1.05, line: lines.length, f: 0.56, creep: 0.03 });
shots.sort((p, q) => p.t - q.t);

const out = {
  FPS, PRE, SPC, DUR, END, bars: rec.bars, code, sliders: rec.sliders, opener: cfg.opener !== false, signoff: cfg.signoff ?? null,
  locs, paragraphs, widgets, punch, sweep16, kicks, snares, rain, stormPunch, energy, scope,
  builds, drops, themes, shots, words: (st.words ?? []).map((w) => w.split("|")),
};
fs.writeFileSync(path.join(project, "data/events.js"), "window.SQ = " + JSON.stringify(out) + ";\n");

// stamp the length into index.html; the audio stays the length of the recording
const idx = path.join(project, "index.html");
let html = fs.readFileSync(idx, "utf8");
html = html.replace(/(id="root"[^>]*?data-duration=")[\d.]+"/, `$1${DUR}"`).replace(/(id="bgm"[^>]*?data-start=")[\d.]+(" data-duration=")[\d.]+"/, `$1${PRE}$2${+(mix.frames / mix.rate).toFixed(3)}"`);
fs.writeFileSync(idx, html);
const at = (v) => +v.toFixed(2);
const snaps = [0.6, at(PRE + 1.5), ...paragraphs.filter((p) => p.label && p.on > PRE + 0.01).map((p) => at(p.on + 0.8)), ...builds.map(([, z]) => at(z - 0.9)), ...drops.flatMap(([a, z]) => [at(a + 0.9), at(a + SPC + 0.9), at(z + 0.55)]), ...(cfg.signoff ? [at(END + 3.2), at(END + 4.0)] : [at(DUR - 0.2)])];
console.log(`snapshot these: npx --yes hyperframes@0.8.70 snapshot . --no-end --describe false --at ${[...new Set(snaps)].sort((a, b) => a - b).join(",")}`);
console.log(`data/events.js: ${locs.length} tokens, ${paragraphs.length} paragraphs, ${widgets.length} widgets, ${shots.length} camera shots, ${DUR}s`);
