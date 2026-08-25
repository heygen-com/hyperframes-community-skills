#!/usr/bin/env node
// p5.brush -> PNG render harness (the "environment" from surya.website/rling-qwen-to-paint-with-code)
// Usage: node render.mjs sketches/foo.js [out/foo.png] [--size 700x700] [--seed 42] [--timeout 30000]

import puppeteer from "puppeteer";
import { readFile, mkdir } from "fs/promises";
import { dirname, basename, resolve } from "path";
import { fileURLToPath } from "url";
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
  console.error("usage: node render.mjs <sketch.js> [out.png] [--size WxH] [--seed N] [--timeout ms]");
  process.exit(1);
}
const outPath =
  positional[1] ?? resolve(here, "out", basename(sketchPath).replace(/\.js$/, "") + ".png");
const [W, H] = (flags.size ?? "700x700").split("x").map(Number);
const seed = flags.seed !== undefined ? Number(flags.seed) : null;
const timeout = Number(flags.timeout ?? 30000);

const sketchSrc = await readFile(resolve(sketchPath), "utf8");

// Seeded PRNG (mulberry32) installed over Math.random BEFORE libs load, so
// p5.brush's internal noise/scatter is reproducible when --seed is given.
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

// Contract with the sketch: it defines setup() (global mode), creates its own
// WEBGL canvas (globals W and H hold the requested size), and draws everything
// in setup. The harness supplies draw() to flush one frame and flag completion.
const harness = `
  window.__done = false;
  window.__error = null;
  window.addEventListener("error", (e) => { window.__error = String(e.message); });
  window.addEventListener("unhandledrejection", (e) => { window.__error = String(e.reason); });
  var W = ${W}, H = ${H};
  function draw() {
    // anim-style sketches keep strokes in a paint() generator — drain it whole
    try {
      if (typeof paint === "function") { for (const _ of paint()); }
    } catch (e) { window.__error = String(e); }
    noLoop();
    requestAnimationFrame(() => { window.__done = true; });
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
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#fff"></body></html>`
  );
  if (seedShim) await page.addScriptTag({ content: seedShim });
  // --inject "NAME=value;NAME2=value2" -> globals visible to the sketch
  if (flags.inject) {
    const decls = buildInjectDeclarations(flags.inject);
    await page.addScriptTag({ content: decls });
  }
  // --image path -> global IMG_SRC data URI (load with loadImage(IMG_SRC) in setup)
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
  // p5 global mode auto-boots on window load, which fired before the sketch
  // script existed — start it explicitly.
  await page.evaluate(() => new p5());

  await page.waitForFunction("window.__done === true || window.__error !== null", { timeout });
  const err = await page.evaluate(() => window.__error);
  if (err) {
    console.error("SKETCH ERROR:", err);
    process.exit(2);
  }

  const canvas = await page.waitForSelector("canvas", { timeout: 5000 });
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await canvas.screenshot({ path: resolve(outPath) });
  console.log("rendered", resolve(outPath));
} finally {
  await browser.close();
}
