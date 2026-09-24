#!/usr/bin/env node
// Paint stills of a film without HyperFrames (the design pass), optionally as one contact sheet.
//   node scripts/shoot.mjs <film-dir> <t,t,...> <out-prefix>              → <out-prefix>-<t>.png per time
//   node scripts/shoot.mjs <film-dir> <t,t,...> <out.jpg> --sheet [cols]  → one labelled contact sheet
//   node scripts/shoot.mjs <film-dir> chapters <out.jpg> --sheet [cols]   → one frame per chapter at its payload moment
// Launches headless Chromium on the film's own index.html (?nobridge: the page's HyperFrames bridge stays idle).
// The page loads its local files plus the Gochi Hand font from Google Fonts. Writes only the output path(s).
import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const [dir, times, out, ...rest] = process.argv.slice(2);
if (!dir || !times || !out) { console.error('usage: node scripts/shoot.mjs <film-dir> <t,t,... | chapters> <out-prefix | out.jpg --sheet [cols]>'); process.exit(2); }
const sheet = rest.includes('--sheet'), cols = +(rest[rest.indexOf('--sheet') + 1]) || 4;
let T;
if (times === 'chapters') {   // one frame per chapter, at its payload moment (archetypes.json `check`)
  const { readFileSync } = await import('node:fs');
  const story = JSON.parse(readFileSync(join(resolve(dir), 'story.json'), 'utf8')), arch = JSON.parse(readFileSync(join(resolve(dir), 'archetypes.json'), 'utf8'));
  const bar = 60 / arch.bpm * arch.beatsPerBar; let t = 0; T = [];
  for (const c of story.chapters) { const ty = arch.types[c.type]; T.push(Math.floor((t + (ty.check ?? ty.bars * bar * .55)) * 8) / 8); t += ty.bars * bar; }
} else T = times.split(',').map(Number);
await mkdir(dirname(resolve(out)), { recursive: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + join(resolve(dir), 'index.html') + '?nobridge', { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  const shots = [];
  for (const t of T) {
    const data = await page.evaluate(tt => window.renderAt(tt), t);
    if (sheet) shots.push(data); else { const f = `${out}-${t.toFixed(3)}.png`; await writeFile(f, Buffer.from(data.split(',')[1], 'base64')); console.log(f); }
  }
  if (sheet) {
    const url = await page.evaluate(async (shots, T, cols) => {
      const w = 640, h = 360, rows = Math.ceil(shots.length / cols), c = document.createElement('canvas');
      c.width = cols * w; c.height = rows * h; const x = c.getContext('2d');
      for (let i = 0; i < shots.length; i++) {
        const im = new Image(); im.src = shots[i]; await im.decode();
        const px = (i % cols) * w, py = Math.floor(i / cols) * h;
        x.drawImage(im, px, py, w, h); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(px, py + h - 24, 70, 24);
        x.fillStyle = '#fff'; x.font = '15px sans-serif'; x.fillText(T[i].toFixed(2) + 's', px + 6, py + h - 7);
      }
      return c.toDataURL('image/jpeg', .88);
    }, shots, T, cols);
    await writeFile(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out);
  }
} finally { await browser.close(); }
