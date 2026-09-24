// schedule.mjs: compile a project's story.json with the same code the film runs (scenes/compile.js), then write what
// the rest of the build reads from it:
//   story.js             window.STORY for the page
//   score/timeline.json  every beat's start, end and key moments, for the score
//   index.html, kit/config.js   the film's duration
// and print the beat table plus the frames worth checking. Refuses the example story unless --example.
//
//   node scripts/schedule.mjs <project> [--example]
//
// Reads and writes only inside <project>. No network.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [dirArg, ...flags] = process.argv.slice(2);
if (!dirArg) { console.error('usage: node scripts/schedule.mjs <project> [--example]'); process.exit(2); }
const DIR = path.resolve(dirArg), P = f => path.join(DIR, f);
const story = JSON.parse(fs.readFileSync(P('story.json'), 'utf8'));

// the example film is Jake's session. An agent making its own film must tell its own user's story
const EX = JSON.parse(fs.readFileSync(path.join(HERE, '../assets/example/story.json'), 'utf8'));
const quotes = s => (s.beats || []).filter(b => b.type !== 'work' && b.type !== 'reply').map(b => [].concat(b.text || []).join(' ').toLowerCase().replace(/\s+/g, ' ').trim());
const exQ = new Set(quotes(EX)), reused = quotes(story).filter(q => exQ.has(q));
if (reused.length >= 2 && !flags.includes('--example')) {
  console.error(`refusing: this is the example story (${reused.length} of its quotes). Write the story of YOUR user from YOUR history (references/sources.md).`);
  process.exit(1);
}

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P('scenes/compile.js'), 'utf8'), ctx, { filename: 'compile.js' });
let S;
try { S = ctx.compileStory(story); } catch (e) { console.error(e.message); process.exit(1); }

const D = S.duration;
fs.writeFileSync(P('story.js'), '// written by schedule.mjs from story.json: edit story.json, not this\nwindow.STORY = ' + JSON.stringify(story, null, 2) + ';\n');
fs.mkdirSync(P('score'), { recursive: true });
fs.writeFileSync(P('score/timeline.json'), JSON.stringify({ duration: D, user: S.user, hook: S.hook, blocks: S.blocks }, null, 1) + '\n');
let html = fs.readFileSync(P('index.html'), 'utf8');
html = html.replace(/(data-composition-id="main"[\s\S]*?data-duration=")[\d.]+(")/, `$1${D}$2`).replace(/(<audio id="score"[^>]*data-duration=")[\d.]+(")/, `$1${D}$2`);
fs.writeFileSync(P('index.html'), html);
fs.writeFileSync(P('kit/config.js'), `// config.js: written by schedule.mjs. duration matches the root data-duration in index.html.\nconst PROJECT = { duration: ${D}, bpm: 110, offset: 0 };\n`);

// the beat table
const fmt = x => x.toFixed(2).padStart(6);
console.log(`\n${S.user}'s session: ${D.toFixed(2)} s, ${S.blocks.length} blocks\n`);
for (const b of S.blocks) {
  const words = b.lines ? b.lines.join(' / ') : b.text || (b.type === 'work' ? b.size + (b.auto ? ' (added)' : '') : '');
  console.log(`${fmt(b.S)} - ${fmt(b.end)}  ${b.type.padEnd(10)} ${words}`);
}
const R = story.room || {}, filled = ['sill', 'wallA', 'wallB', 'wallC', 'hook', 'floor', 'desk'].filter(k => R[k]).length + ((R.shelf || []).length ? 1 : 0);
if (filled < 4) console.log(`\nwarning: the room is nearly bare (${filled} of 8 slots). Decorate it from what you know about ${S.user} (references/room.md)`);
if (!story.approved && !flags.includes('--example')) console.log(`\nDRAFT: story.json has no "approved": true yet. Frames carry a DRAFT stamp until ${S.user} approves every line (references/sources.md, the privacy gate).`);
// every prop the room names must exist (props.js + props-custom.js) and fit its slot
const known = {};
for (const f of ['scenes/props.js', 'scenes/props-custom.js']) {
  const src = fs.existsSync(P(f)) ? fs.readFileSync(P(f), 'utf8').replace(/^\s*\/\/.*$/gm, '') : '';
  for (const m of src.matchAll(/PROPS(?:\.([\w$]+)|\[['"]([\w-]+)['"]\])\s*=\s*\{\s*slot:\s*['"](\w+)['"]/g)) known[m[1] || m[2]] = m[3];
}
const roomErr = [];
for (const [slot, pick] of Object.entries(R)) {
  if (['palette', 'why'].includes(slot) || pick == null) continue;
  const picks = slot === 'shelf' ? [].concat(pick) : [pick];
  if (slot === 'shelf' && picks.length > 3) roomErr.push(`room.shelf: at most 3 items (got ${picks.length})`);
  if (!['sill', 'wallA', 'wallB', 'wallC', 'shelf', 'hook', 'floor', 'desk'].includes(slot)) { roomErr.push(`room.${slot}: no such slot (sill, wallA, wallB, wallC, shelf, hook, floor, desk)`); continue; }
  for (const p of picks) { const name = typeof p === 'string' ? p : p && p.prop;
    if (!(name in known)) roomErr.push(`room.${slot}: no prop called "${name}" (references/room.md lists them; draw your own in scenes/props-custom.js)`);
    else if (known[name] !== slot) roomErr.push(`room.${slot}: "${name}" is a ${known[name]} prop`); }
}
if (roomErr.length) { console.error('\nstory.json room:\n  - ' + roomErr.join('\n  - ')); process.exit(1); }
const noSource = (story.beats || []).filter(b => b.type !== 'work' && b.type !== 'reply' && !b.source).length;
if (noSource) console.log(`warning: ${noSource} of the user's lines have no "source". Every quote needs one (session + timestamp) for the privacy gate.`);
if (D > 80) console.log(`warning: ${D.toFixed(0)} s is long. 40 to 70 s holds attention; drop the weakest exchange.`);
const moments = ctx.storyKeyMoments(S);
console.log('\nframes to check:\n  npx --yes hyperframes@0.8.71 snapshot --no-end --describe false --timeout 20000 --at ' + moments.map(m => m[0]).join(',') + '\n');
for (const [t, what] of moments) console.log(`  ${fmt(t)}  ${what}`);
