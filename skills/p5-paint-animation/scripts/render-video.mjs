#!/usr/bin/env node
// Repaint a VIDEO (or Live Photo .mov) as a coherent painting: every source
// frame is repainted over a locked stroke lattice (see repaint-video.js).
// Usage: node render-video.mjs <input video> [out.mp4]
//        [--size 720x900] [--fps 12] [--seed 42] [--inject "STYLE=0;DETAIL=2"]
//        [--start 0] [--dur 3]

import puppeteer from "puppeteer";
import { readFile, readdir, mkdir, rm } from "fs/promises";
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
const inPath = positional[0];
if (!inPath) {
  console.error("usage: node render-video.mjs <video> [out.mp4] [--size WxH] [--fps N] [--seed N] [--inject ...] [--start s] [--dur s]");
  process.exit(1);
}
const name = basename(inPath).replace(/\.[^.]+$/, "");
const outPath = positional[1] ?? resolve(here, "out", name + ".painted.mp4");
const [W, H] = (flags.size ?? "720x900").split("x").map(Number);
const fps = Number(flags.fps ?? 12);
const seed = flags.seed !== undefined ? Number(flags.seed) : 7;

// 1) extract source frames
const srcDir = resolve(here, "out", "_src_" + name);
const dstDir = resolve(here, "out", "_dst_" + name);
await rm(srcDir, { recursive: true, force: true });
await rm(dstDir, { recursive: true, force: true });
await mkdir(srcDir, { recursive: true });
await mkdir(dstDir, { recursive: true });
if (flags.frames) {
  // pre-extracted frames (PNG keeps alpha for matted input)
  const { cp } = await import("fs/promises");
  await rm(srcDir, { recursive: true, force: true });
  await cp(resolve(flags.frames), srcDir, { recursive: true });
} else {
  const trim = [];
  if (flags.start) trim.push("-ss", flags.start);
  if (flags.dur) trim.push("-t", flags.dur);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", ...trim, "-i", resolve(inPath),
    "-vf", `fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    resolve(srcDir, "%05d.jpg"),
  ], { stdio: "inherit" });
}
const srcFrames = (await readdir(srcDir)).filter((f) => f.endsWith(".jpg") || f.endsWith(".png")).sort();
console.log(`${srcFrames.length} source frames at ${fps}fps`);

// 2) paint each frame over the locked lattice
const seedShim = `
  (() => {
    let s = ${seed} >>> 0;
    window.__seedBase = ${seed};
    window.__reseed = (n) => { s = n >>> 0; };
    Math.random = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
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
  await page.addScriptTag({ content: seedShim });
  await page.addScriptTag({ content: `var W = ${W}, H = ${H};` });
  if (flags.inject) {
    const decls = buildInjectDeclarations(flags.inject);
    await page.addScriptTag({ content: decls });
  }
  await page.addScriptTag({ path: resolve(here, "node_modules/p5/lib/p5.min.js") });
  await page.addScriptTag({ path: resolve(here, "node_modules/p5.brush/dist/p5.brush.js") });
  await page.addScriptTag({ path: resolve(here, "sketches/repaint-video.js") });
  await page.evaluate(() => { window.__p5Instance = new p5(); });
  await page.waitForSelector("canvas", { timeout: 15000 });

  // warmup paint: the brush compositor stabilizes after one full paint
  {
    const buf = await readFile(resolve(srcDir, srcFrames[0]));
    await page.evaluate((u) => window.__paintFrame(u, true),
      `data:image/jpeg;base64,${buf.toString("base64")}`);
  }

  for (let i = 0; i < srcFrames.length; i++) {
    const buf = await readFile(resolve(srcDir, srcFrames[i]));
    const uri = `data:image/${srcFrames[i].endsWith(".png") ? "png" : "jpeg"};base64,${buf.toString("base64")}`;
    const nStrokes = await page.evaluate((u) => window.__paintFrame(u), uri);
    const canvas = await page.$("canvas");
    await canvas.screenshot({ path: resolve(dstDir, srcFrames[i].replace(".jpg", ".png")) });
    if (i === 0) console.log(`lattice: ${nStrokes} strokes`);
    if ((i + 1) % 10 === 0) console.log(`${i + 1}/${srcFrames.length} frames painted`);
  }
} finally {
  await browser.close();
}

// 3) stitch
await mkdir(dirname(resolve(outPath)), { recursive: true });
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", String(fps), "-i", resolve(dstDir, "%05d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", resolve(outPath),
], { stdio: "inherit" });
await rm(srcDir, { recursive: true, force: true });
await rm(dstDir, { recursive: true, force: true });
console.log("rendered", resolve(outPath));
