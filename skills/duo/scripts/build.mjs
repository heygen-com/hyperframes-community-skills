#!/usr/bin/env node
// Scaffold a HyperFrames project from the duo template.
//
//   node build.mjs --out ./my-meme [--id my-meme] [--duration 10] [--icons tiktok,instagram]
//
// Writes ONLY inside --out: index.html, hyperframes.json, assets/plate.png,
// assets/screen-spec.json, and (optionally) the requested icon symbol sheets.
// No network access. No dependencies beyond Node 18+.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(here, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const out = arg('out');
if (!out) {
  console.error('usage: node build.mjs --out <dir> [--id <composition-id>] [--duration <seconds>] [--icons tiktok,instagram]');
  process.exit(1);
}
const outDir = path.resolve(process.cwd(), out);
const id = arg('id', path.basename(outDir)).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
const duration = Number(arg('duration', '10'));
if (!Number.isFinite(duration) || duration <= 0 || duration > 120) {
  console.error('--duration must be a number of seconds between 0 and 120');
  process.exit(1);
}
const icons = arg('icons', '').split(',').map((s) => s.trim()).filter(Boolean);
for (const ic of icons) {
  if (!['tiktok', 'instagram'].includes(ic)) {
    console.error(`unknown icon sheet "${ic}" (allowed: tiktok, instagram)`);
    process.exit(1);
  }
}

async function refuseSymlink(p) {
  try {
    const st = await fs.lstat(p);
    if (st.isSymbolicLink()) throw new Error(`refusing to write through symlink: ${p}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

await refuseSymlink(outDir);
await fs.mkdir(path.join(outDir, 'assets'), { recursive: true });
await fs.mkdir(path.join(outDir, 'renders'), { recursive: true });

const template = await fs.readFile(path.join(skillDir, 'template', 'index.template.html'), 'utf8');
const html = template
  .replaceAll('__COMPOSITION_ID__', id)
  .replaceAll('__DURATION__', String(duration));

const targets = [
  ['index.html', html],
  ['hyperframes.json', JSON.stringify({ name: id, entry: 'index.html', width: 1448, height: 1086, fps: 30 }, null, 2) + '\n'],
];
for (const [rel, content] of targets) {
  const p = path.join(outDir, rel);
  await refuseSymlink(p);
  await fs.writeFile(p, content, 'utf8');
}

const copies = [
  ['assets/plate.png', 'assets/plate.png'],
  ['assets/screen-spec.json', 'assets/screen-spec.json'],
  ...icons.map((ic) => [`assets/icons-${ic}.svg`, `assets/icons-${ic}.svg`]),
];
for (const [src, rel] of copies) {
  const p = path.join(outDir, rel);
  await refuseSymlink(p);
  await fs.copyFile(path.join(skillDir, src), p);
}

console.log(`scaffolded ${outDir}`);
console.log(`  composition id: ${id}   duration: ${duration}s   root: 1448x1086 @ 30fps`);
console.log('  left screen : #screen-left  .content  495x849');
console.log('  right screen: #screen-right .content  498x849');
console.log('next: fill the two .content slots and the timeline hook in index.html, then `npx hyperframes@latest check`.');
