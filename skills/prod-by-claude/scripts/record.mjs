// Records a Strudel track for the video, offline and silent.
//
// Serves recorder.html (the pinned @strudel/web build from node_modules) on 127.0.0.1, opens it in a
// muted headless Chrome, and for the track named in <project>/video.json:
//   1. evaluates every labelled part on its own and exports each note event with its time, part,
//      values and the character ranges of the code tokens that produced it
//   2. renders the full mix (plus the optional ending bars) with Strudel's offline renderer
//   3. renders a solo stem for every part that calls ._scope(), for the scope widget
//
// usage: node record.mjs <project-dir>
// writes: <project>/assets/bgm.wav, <project>/assets/stem-<part>.wav, <project>/data/events.json
// env:    CHROME=<path to a Chrome binary> overrides the pinned Chrome for Testing
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser, computeExecutablePath } from "@puppeteer/browsers";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME_BUILD = "149.0.7827.22";
const fail = (msg) => { console.error("record: " + msg); process.exit(1); };
const t0 = Date.now(), step = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s] ${msg}`);

const project = path.resolve(process.argv[2] ?? fail("usage: node record.mjs <project-dir>"));
const cfg = JSON.parse(fs.readFileSync(path.join(project, "video.json"), "utf8"));
const code = fs.readFileSync(path.join(project, cfg.track), "utf8");
const bars = cfg.bars ?? fail("video.json needs bars (the length of the arrangement)");
const endingBars = cfg.ending ? cfg.ending.bars : 0;

// labelled parts, in order. A label longer than one character starting with a capital S solos
// itself in Strudel and silences everything else, so refuse it rather than record a broken mix
const labels = [...code.matchAll(/^([A-Za-z$][\w$]*):\s/gm)].map((m) => m[1]).filter((l) => l !== "$");
if (!labels.length) fail("no labelled parts found (write each part as `name: pattern`)");
const soloing = labels.filter((l) => l.length > 1 && l.startsWith("S"));
if (soloing.length) fail(`labels starting with a capital S solo in Strudel: ${soloing.join(", ")}. Rename them`);
// mute every other part by swapping its first letter for "_" (same length, so offsets hold)
const solo = (keep) => labels.reduce((c, l) => (l === keep ? c : c.replace(new RegExp(`^${l.replace("$", "\\$")}:`, "m"), "_" + l.slice(1) + ":")), code);
const scopeParts = labels.filter((l) => {
  const start = code.search(new RegExp(`^${l.replace("$", "\\$")}:`, "m"));
  const next = labels.map((o) => code.search(new RegExp(`^${o.replace("$", "\\$")}:`, "m"))).filter((i) => i > start).sort((a, b) => a - b)[0] ?? code.length;
  return code.slice(start, next).includes("._scope(");
});

// a static server for recorder.html and node_modules only
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const file = path.join(here, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/recorder.html`;

const executablePath = process.env.CHROME ?? computeExecutablePath({ browser: Browser.CHROME, buildId: CHROME_BUILD, cacheDir: path.join(here, ".chrome") });
if (!fs.existsSync(executablePath)) fail(`Chrome not found at ${executablePath}. Install it with: npx @puppeteer/browsers install chrome@${CHROME_BUILD} --path ${path.join(here, ".chrome")}  (or set CHROME)`);

const outAssets = path.join(project, "assets"), outData = path.join(project, "data");
fs.mkdirSync(outAssets, { recursive: true }); fs.mkdirSync(outData, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--mute-audio"], protocolTimeout: 600000 });
try {
  const cdp = await browser.target().createCDPSession();
  const downloads = new Map();
  cdp.on("Browser.downloadWillBegin", (e) => downloads.set(e.guid, { name: e.suggestedFilename, done: false }));
  cdp.on("Browser.downloadProgress", (e) => { if (e.state === "completed" && downloads.has(e.guid)) downloads.get(e.guid).done = true; });
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: outAssets, eventsEnabled: true });
  const waitFor = async (name) => {
    for (let i = 0; i < 1200; i++) { if ([...downloads.values()].some((d) => d.name === name && d.done)) return; await new Promise((r) => setTimeout(r, 100)); }
    fail(`timed out waiting for ${name}`);
  };

  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page: " + e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.mouse.click(10, 10); // strudel starts its audio engine on the first click
  await page.waitForFunction(() => window.recorderReady, { timeout: 60000 });
  await page.evaluate(() => window.recorderReady);

  // 1. events, part by part
  step(`evaluating ${labels.length} parts`);
  const exported = await page.evaluate(async ({ code, labels, bars, soloCodes }) => {
    const { repl, strudel } = window;
    const run = async (src) => {
      const pat = await repl.evaluate(src, false);
      if (!pat) throw new Error("evaluation failed: " + (repl.state?.evalError?.message ?? "unknown error"));
      return pat;
    };
    const full = await run(code);
    const cps = repl.scheduler.cps;
    const sliders = (repl.state?.widgets ?? []).filter((w) => w.type === "slider").map((w) => ({ from: w.from, to: w.to, value: w.value, min: w.min, max: w.max }));
    const midi = (n) => (n == null ? null : typeof n === "number" ? n : strudel.noteToMidi(n));
    const events = [];
    for (const label of labels) {
      const pat = await run(soloCodes[label]);
      for (const h of pat.queryArc(0, bars)) {
        if (!h.hasOnset()) continue;
        const v = h.value;
        const locs = [...new Set((h.context?.locations ?? []).map((l) => l.start + ":" + l.end))].map((k) => k.split(":").map(Number));
        events.push({
          c0: +h.whole.begin.valueOf().toFixed(6), c1: +h.whole.end.valueOf().toFixed(6), part: label,
          s: v.s ?? null, midi: midi(v.note ?? (typeof v.n === "number" && !v.s ? v.n : null)),
          slice: v.begin != null ? Math.round(v.begin * 16) : null,
          gain: v.gain ?? null, hpf: v.hcutoff ?? null, room: v.room ?? null, locs,
        });
      }
    }
    events.sort((a, b) => a.c0 - b.c0);
    if (!full.queryArc(0, bars).some((h) => h.hasOnset())) throw new Error("the track makes no sound in the first " + bars + " bars");
    return { cps, sliders, events };
  }, { code, labels, bars, soloCodes: Object.fromEntries(labels.map((l) => [l, solo(l)])) });

  // 2. the mix, with the optional ending bars played once after the arrangement
  step(`rendering the mix (${bars + endingBars} bars), the slowest step`);
  await page.evaluate(async ({ code, ending, bars, endingBars, cps }) => {
    const { repl, strudel } = window;
    const main = await repl.evaluate(code, false);
    let pat = main;
    if (ending) {
      const tail = await repl.evaluate(ending.code, false);
      if (!tail) throw new Error("ending code failed: " + (repl.state?.evalError?.message ?? "unknown error"));
      pat = strudel.stack(main.mask(`<1!${bars} 0!${endingBars}>`), tail.mask(`<0!${bars} 1 0!${Math.max(0, endingBars - 1)}>`));
    }
    await strudel.renderPatternAudio(pat, cps, 0, bars + endingBars, 44100, 512, false, "bgm");
  }, { code, ending: cfg.ending ?? null, bars, endingBars, cps: exported.cps });
  await waitFor("bgm.wav");

  // 3. solo stems for the scope widgets
  for (const part of scopeParts) {
    step(`rendering the ${part} stem for the scope`);
    await page.evaluate(async ({ src, bars, cps, name }) => {
      const pat = await window.repl.evaluate(src, false);
      await window.strudel.renderPatternAudio(pat, cps, 0, bars, 44100, 512, false, name);
    }, { src: solo(part), bars, cps: exported.cps, name: "stem-" + part });
    await waitFor(`stem-${part}.wav`);
  }

  // levels per 4 bars from the rendered mix, so the balance is measured before anyone listens
  const wav = fs.readFileSync(path.join(outAssets, "bgm.wav"));
  let off = 12, data = 0, len = 0, ch = 2, rate = 44100;
  while (off < wav.length) { const id = wav.toString("ascii", off, off + 4), n = wav.readUInt32LE(off + 4); if (id === "fmt ") { ch = wav.readUInt16LE(off + 10); rate = wav.readUInt32LE(off + 12); } if (id === "data") { data = off + 8; len = n; break; } off += 8 + n; }
  const frames = len / 2 / ch, perBar = rate / exported.cps, db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : "-inf");
  let clipped = 0; const rows = [];
  for (let b0 = 0; b0 < bars + endingBars; b0 += 4) {
    let pk = 0, ss = 0, n = 0;
    for (let f = Math.floor(b0 * perBar); f < Math.min(frames, Math.floor((b0 + 4) * perBar)); f++) for (let c = 0; c < ch; c++) { const v = Math.abs(wav.readInt16LE(data + (f * ch + c) * 2) / 32768); pk = Math.max(pk, v); ss += v * v; n++; if (v >= 0.999) clipped++; }
    rows.push(`  bars ${String(b0 + 1).padStart(2)}-${String(Math.min(b0 + 4, bars + endingBars)).padEnd(2)}  peak ${db(pk).padStart(6)} dBFS  rms ${db(Math.sqrt(ss / Math.max(1, n))).padStart(6)}`);
  }
  console.log("levels:\n" + rows.join("\n"));
  if (clipped) console.warn(`WARNING: ${clipped} clipped samples. Lower gains or the all(x => x.velocity(...)) trim and record again`);

  fs.writeFileSync(path.join(outData, "events.json"), JSON.stringify({ cps: exported.cps, bars, endingBars, code, labels, scopeParts, sliders: exported.sliders, events: exported.events }));
  const bpm = Math.round(exported.cps * 60 * 4 * 100) / 100;
  console.log(`recorded ${labels.length} parts (${labels.join(", ")}), ${exported.events.length} events, ${bpm} BPM, ${bars + endingBars} bars`);
} catch (e) {
  const pos = e.message.match(/\((\d+):(\d+)\)/); // acorn reports (line:column) where parsing stopped
  const hint = pos ? `\n  parsing stopped at line ${pos[1]}: ${code.split("\n")[pos[1] - 1] ?? ""}\n  (an unclosed bracket or quote is usually earlier)` : "";
  fail(e.message.split("\n")[0] + hint);
} finally {
  await browser.close();
  server.close();
}
