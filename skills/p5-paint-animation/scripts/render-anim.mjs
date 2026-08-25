#!/usr/bin/env node
// p5.brush -> paint-on timelapse. The sketch defines setup() (canvas, background,
// brush config — no strokes) and function* paint() that yields between strokes.
// Each yield = one animation step; the harness screenshots every frame and
// stitches an MP4 with ffmpeg.
//
// Usage: node render-anim.mjs sketches/foo.anim.js [out/foo.mp4]
//        [--size 700x700] [--seed 42] [--spf 1] [--fps 30] [--hold 45] [--timeout 60000]

import puppeteer from "puppeteer";
import { readFile, mkdir, rm, copyFile } from "fs/promises";
import { dirname, basename, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { buildInjectDeclarations } from "./lib/inject.mjs";
import { hardenPage } from "./lib/page-safety.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
  else positional.push(args[i]);
}
const sketchPath = positional[0];
if (!sketchPath) {
  console.error("usage: node render-anim.mjs <sketch.js> [out.mp4] [--size WxH] [--seed N] [--spf N] [--fps N] [--hold N]");
  process.exit(1);
}
const name = basename(sketchPath).replace(/\.js$/, "");
const outPath = positional[1] ?? resolve(here, "out", name + ".mp4");
const [W, H] = (flags.size ?? "700x700").split("x").map(Number);
const seed = flags.seed !== undefined ? Number(flags.seed) : null;
const spf = Number(flags.spf ?? 1);       // strokes (yields) per frame
const fps = Number(flags.fps ?? 30);
const hold = Number(flags.hold ?? Math.round(fps * 1.5)); // end-hold frames
const timeout = Number(flags.timeout ?? 60000);

const sketchSrc = await readFile(resolve(sketchPath), "utf8");
const framesDir = resolve(here, "out", "_frames_" + name);
await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const seedShim = seed === null ? "" : `
  (() => {
    let s = ${seed} >>> 0;
    Math.random = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
`;

// draw() advances the paint() generator spf steps, then pauses; the node side
// screenshots the presented frame and calls redraw() for the next step.
const harness = `
  window.__frame = 0;
  window.__finished = false;
  window.__error = null;
  window.addEventListener("error", (e) => { window.__error = String(e.message); });
  var W = ${W}, H = ${H};
  var __gen = null;
  function draw() {
    try {
      if (!__gen) __gen = paint();
      for (let i = 0; i < ${spf}; i++) {
        if (__gen.next().done) { window.__finished = true; break; }
      }
    } catch (e) { window.__error = String(e); }
    noLoop();
    window.__frame++;
  }
`;

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await hardenPage(page);
  await page.setViewport({ width: W + 40, height: H + 40, deviceScaleFactor: 1 });
  page.on("console", (m) => {
    if (m.type() === "error") console.error("[page]", m.text());
  });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"></body></html>`);
  if (seedShim) await page.addScriptTag({ content: seedShim });
  if (flags.inject) {
    const decls = buildInjectDeclarations(flags.inject);
    await page.addScriptTag({ content: decls });
  }
  if (flags.image) {
    const buf = await readFile(resolve(flags.image));
    const mime = flags.image.endsWith(".png") ? "image/png" : "image/jpeg";
    await page.addScriptTag({
      content: `var IMG_SRC = "data:${mime};base64,${buf.toString("base64")}";`,
    });
  }
  await page.addScriptTag({ path: resolve(here, "node_modules/p5/lib/p5.min.js") });
  await page.addScriptTag({ path: resolve(here, "node_modules/p5.brush/dist/p5.brush.js") });
  await page.addScriptTag({ content: harness + "\n" + sketchSrc });
  await page.evaluate(() => new p5());

  const pad = (n) => String(n).padStart(5, "0");
  let frame = 0;
  let last = 0;
  const deadline = Date.now() + timeout;
  for (;;) {
    await page.waitForFunction(`window.__frame > ${last} || window.__error !== null`, {
      timeout: Math.max(1000, deadline - Date.now()),
    });
    const { err, finished, f } = await page.evaluate(() => ({
      err: window.__error, finished: window.__finished, f: window.__frame,
    }));
    if (err) { console.error("SKETCH ERROR:", err); process.exit(2); }
    last = f;
    const canvas = await page.$("canvas");
    await canvas.screenshot({ path: resolve(framesDir, pad(frame) + ".png") });
    frame++;
    if (finished) break;
    if (Date.now() > deadline) { console.error("timeout"); process.exit(3); }
    await page.evaluate(() => redraw());
  }
  // sketches may drop frame markers: (window.__markers ||= {})["name"] = window.__frame
  const markers = await page.evaluate(() => window.__markers || {});
  if (Object.keys(markers).length) console.log("markers", JSON.stringify(markers));
  // sketches may record a per-frame camera track: window.__track = [[x,y],...]
  const track = await page.evaluate(() => window.__track || null);
  if (track) {
    const { writeFile: wf } = await import("fs/promises");
    const trackPath = resolve(outPath).replace(/\.mp4$/, ".track.json");
    await wf(trackPath, JSON.stringify({ track, markers }));
    console.log("track", trackPath);
  }
  for (let i = 0; i < hold; i++) {
    await copyFile(resolve(framesDir, pad(frame - 1) + ".png"), resolve(framesDir, pad(frame + i) + ".png"));
  }
  console.log(`${frame} paint frames + ${hold} hold, stitching at ${fps}fps...`);

  await mkdir(dirname(resolve(outPath)), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-framerate", String(fps), "-i", resolve(framesDir, "%05d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", resolve(outPath),
  ], { stdio: ["ignore", "ignore", "pipe"] });
  if (flags["keep-frames"] !== "1") await rm(framesDir, { recursive: true, force: true });
  else console.log("frames", framesDir);
  console.log("rendered", resolve(outPath));
} finally {
  await browser.close();
}
