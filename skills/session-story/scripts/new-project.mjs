// new-project.mjs: scaffold a session-story project. Copies the engine (assets/engine), the pinned browser
// dependencies installed by setup.sh (p5, p5.brush, the Permanent Marker font) and the score tools into <dir>, then
// writes a starter story.json and score/score.py for you to fill in.
//
//   node scripts/new-project.mjs <dir>              a fresh project (refuses a non-empty <dir>)
//   node scripts/new-project.mjs <dir> --example    the reference film's story and score, to see the format working
//
// Writes only inside <dir>. No network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(HERE, '..');
const [dirArg, ...flags] = process.argv.slice(2);
if (!dirArg) { console.error('usage: node scripts/new-project.mjs <dir> [--example]'); process.exit(2); }
const DIR = path.resolve(dirArg), example = flags.includes('--example');
if (fs.existsSync(DIR) && fs.readdirSync(DIR).filter(f => f !== '.DS_Store').length) { console.error(`refusing: ${DIR} is not empty`); process.exit(1); }

const NM = path.join(HERE, 'node_modules');
const VENDOR = [
  [path.join(NM, 'p5/lib/p5.min.js'), 'assets/vendor/p5.min.js'],
  [path.join(NM, 'p5.brush/dist/p5.brush.js'), 'assets/vendor/p5.brush.js'],
  [path.join(NM, '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2'), 'assets/fonts/permanent-marker-400.woff2'],
];
for (const [src] of VENDOR) if (!fs.existsSync(src)) { console.error(`missing ${path.relative(SKILL, src)}: run  sh scripts/setup.sh  once first`); process.exit(1); }

const copy = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
const copyTree = (src, dst) => { for (const e of fs.readdirSync(src, { withFileTypes: true })) {
  if (e.name === '.DS_Store') continue;
  const s = path.join(src, e.name), d = path.join(dst, e.name);
  if (e.isDirectory()) copyTree(s, d); else copy(s, d); } };

fs.mkdirSync(DIR, { recursive: true });
copyTree(path.join(SKILL, 'assets/engine'), DIR);
for (const [src, dst] of VENDOR) copy(src, path.join(DIR, dst));
for (const f of ['orchestra.py', 'render.swift', 'build.sh', 'qc.py']) copy(path.join(HERE, 'score', f), path.join(DIR, 'score', f));
fs.chmodSync(path.join(DIR, 'score/build.sh'), 0o755);
fs.mkdirSync(path.join(DIR, 'assets/audio'), { recursive: true });
fs.mkdirSync(path.join(DIR, 'renders'), { recursive: true });

if (example) {
  copy(path.join(SKILL, 'assets/example/story.json'), path.join(DIR, 'story.json'));
  copy(path.join(SKILL, 'assets/example/score.py'), path.join(DIR, 'score/score.py'));
} else {
  fs.writeFileSync(path.join(DIR, 'story.json'), JSON.stringify({
    user: 'FIRST NAME (ask your user which name goes on screen)',
    nameplate: null,
    hook: null,
    screen: 'code',
    ending: 'next',
    cast: 'clawd',
    approved: false,
    room: { sill: null, wallA: null, wallB: null, wallC: null, shelf: [], hook: null, floor: null, desk: null, why: {} },
    beats: [
      { type: 'request', text: 'their first message, verbatim', time: 'HH:MM', source: 'session id + timestamp' },
      { type: 'reply', text: 'what you answered, short', time: 'HH:MM' },
    ],
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'score/score.py'), SCORE_STUB());
}
fs.writeFileSync(path.join(DIR, 'package.json'), JSON.stringify({
  name: path.basename(DIR), private: true, type: 'module',
  scripts: { check: 'npx --yes hyperframes@0.8.71 check', preview: 'npx --yes hyperframes@0.8.71 preview', render: 'npx --yes hyperframes@0.8.71 render --fps 24 --crf 12' },
}, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, 'hyperframes.json'), JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { assets: 'assets' } }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '.hyperframesignore'), 'score/\nrenders/\nsnapshots/\nstory.json\n');
console.log(`project ready: ${DIR}
next: write story.json (references/story.md), then  node ${path.relative(process.cwd(), path.join(HERE, 'schedule.mjs'))} ${path.relative(process.cwd(), DIR)}`);

function SCORE_STUB() {
  return `"""score.py: this film's score, composed against its own timeline (score/timeline.json, written by schedule.mjs).
Write it for your user: your own theme, your key, your palette. See references/score.md.
Run it with  sh score/build.sh  from the project folder.
"""
from orchestra import *

key('F', 'major')           # your key: pick one that fits your user
tempo(.56)                  # seconds per beat for the theme (0.45 brisk, 0.7 unhurried)

# the session theme: [(note, beats)], in YOUR key. Write a new one; don't reuse the example's.
THEME = [('C5', .5), ('D5', .5), ('E5', 1)]
ANSWER = [('E5', .5), ('D5', .5), ('C5', 1)]
theme(THEME, ANSWER)

# which instrument plays which role (General MIDI names: see GM in orchestra.py)
palette(lead='flute', reply='clarinet', sing='strings')

# override any beat's cue with your own: def praise(b): ...  then pass cues={'praise': praise}
build()
`;
}
