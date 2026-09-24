#!/usr/bin/env node
// Scaffold a film project, or re-sync one after story.json changes.
//
//   node scripts/new-film.mjs <dir> [--story <story.json>]   scaffold <dir> (empty, or holding only receipts.json /
//                                                            story.json; uses <dir>/story.json, else the example)
//   node scripts/new-film.mjs <dir> --sync                   validate <dir>/story.json, rewrite story.js + durations
//
// Writes only inside <dir>. Needs `sh scripts/setup.sh` once (copies p5 + p5.brush from the pinned node_modules).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), SKILL = resolve(HERE, '..');
const TPL = join(SKILL, 'assets/template'), KIT = join(SKILL, 'assets/kit');
const args = process.argv.slice(2), dir = args[0] && resolve(args[0]);
const flag = k => args.includes(k), opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
if (!dir) { console.error('usage: node scripts/new-film.mjs <dir> [--story story.json] | <dir> --sync'); process.exit(2); }

const REQUIRED = {
  intro: ['title', 'caption'], shelf: ['caption', 'spines'], 'first-message': ['caption', 'lines'], watching: ['caption'],
  frames: ['caption'], building: ['caption', 'bubble'], restart: ['caption', 'bubble'], knock: ['caption', 'bubble'],
  notes: ['caption', 'notes'], 'side-by-side': ['caption', 'bubble'], 'good-part': ['caption', 'bubble'], kept: ['caption', 'newBook'], tag: ['caption'],
  terminal: ['caption', 'commands'], diff: ['caption'], ship: ['caption', 'label'],
};
const SECRET = [/\bsk-[A-Za-z0-9_-]{8,}/, /\bsk_[A-Za-z0-9]{8,}/, /\bghp_[A-Za-z0-9]{8,}/, /\bgithub_pat_/, /\bxox[abpr]-/, /\bAKIA[0-9A-Z]{12,}/, /-----BEGIN/];
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/, PATH = /(^|\s)(\/Users\/|\/home\/|~\/|[A-Z]:\\)/, URL = /\b(https?:\/\/|www\.)|\b[\w-]+\.(com|io|dev|ai|app|net|org|co)\/\S+/i;

function validate(story, arch) {
  const errs = [], warns = [], ch = story.chapters || [];
  if (!ch.length) errs.push('story.chapters is empty');
  if (ch[0] && ch[0].type !== 'intro') errs.push('the first chapter must be "intro"');
  if (ch.length && ch[ch.length - 1].type !== 'tag') errs.push('the last chapter must be "tag" (the next morning)');
  const ki = ch.findIndex(c => c.type === 'kept');
  if (ki >= 0 && ki !== ch.length - 2) errs.push('"kept" must come right before "tag" (its lamp-out leads into the morning)');
  ch.forEach((c, i) => {
    const at = `chapter ${i + 1} (${c.type})`;
    if (!arch.types[c.type]) { errs.push(`${at}: unknown type`); return; }
    for (const k of REQUIRED[c.type] || []) if (c[k] == null || (Array.isArray(c[k]) && !c[k].length)) errs.push(`${at}: missing "${k}"`);
    if (typeof c.caption === 'string') {
      if (/\.\s*$/.test(c.caption)) errs.push(`${at}: caption ends with a period ("${c.caption}"); on-screen lines never do`);
      if (c.caption !== c.caption.toLowerCase()) warns.push(`${at}: caption has capitals; the style is lowercase`);
      if (c.caption.length > 26) warns.push(`${at}: caption is ${c.caption.length} chars; keep it to a few words`);
    }
    if (c.type === 'intro' && Array.isArray(c.title)) {
      if (c.title.length !== 2) errs.push(`${at}: title must be exactly two lines`);
      for (const l of c.title) { const bad = [...new Set(l.replace(/[a-z' ]/g, ''))]; if (bad.length) warns.push(`${at}: title characters without a hand-drawn glyph (skipped): ${bad.join(' ')}`); }
    }
    if (c.type === 'first-message' && Array.isArray(c.lines)) {
      if (c.lines.length > 6) errs.push(`${at}: at most 6 lines`);
      c.lines.forEach(l => l.length > 34 && warns.push(`${at}: line over 34 chars may overflow the bubble: "${l}"`));
    }
    if (c.type === 'notes' && Array.isArray(c.notes) && (c.notes.length < 3 || c.notes.length > 5)) errs.push(`${at}: 3-5 notes`);
    if (c.type === 'first-message' && typeof c.sticky === 'string' && c.sticky.length > 28) warns.push(`${at}: sticky over 28 chars will wrap to 3+ lines: "${c.sticky}"`);
    if (c.type === 'kept' && typeof c.newBook === 'string' && c.newBook.length > 22) warns.push(`${at}: newBook over 22 chars stands very tall on the shelf: "${c.newBook}"`);
    if (c.type === 'terminal' && (!!c.fail !== !!c.pass)) errs.push(`${at}: "fail" and "pass" go together (red, then green), or leave both out and use "done"`);
    if (c.type === 'terminal' && Array.isArray(c.commands) && c.commands[0] && c.commands[0].length > 24) warns.push(`${at}: command over 24 chars types past the Enter beat: "${c.commands[0]}"`);
    for (const [k, v] of Object.entries(c)) {
      const texts = (Array.isArray(v) ? v : [v]).filter(x => typeof x === 'string');
      for (const t of texts) {
        if (SECRET.some(r => r.test(t))) errs.push(`${at}.${k}: looks like a credential; remove it`);
        if (EMAIL.test(t)) errs.push(`${at}.${k}: contains an email address; remove it`);
        if (PATH.test(t)) errs.push(`${at}.${k}: contains a file path; remove it`);
        if (URL.test(t)) warns.push(`${at}.${k}: contains a URL: only keep it if the user approved showing it: "${t}"`);
      }
    }
  });
  if (!story.approved) warns.push('story.approved is not true: show the user every on-screen line (with its receipt) and get a yes before rendering');
  return { errs, warns };
}

function sync(d) {
  const arch = JSON.parse(readFileSync(join(d, 'archetypes.json'), 'utf8'));
  const story = JSON.parse(readFileSync(join(d, 'story.json'), 'utf8'));
  const { errs, warns } = validate(story, arch);
  warns.forEach(w => console.warn('warn:', w));
  if (errs.length) { errs.forEach(e => console.error('error:', e)); process.exit(1); }
  const bar = 60 / arch.bpm * arch.beatsPerBar;
  const dur = story.chapters.reduce((a, c) => a + arch.types[c.type].bars * bar, 0);
  const pub = { ...story }; delete pub.receipts;   // provenance stays in story.json, never on the page
  writeFileSync(join(d, 'story.js'), `// generated by scripts/new-film.mjs --sync from story.json + archetypes.json. Edit those, not this.\nwindow.STORY = ${JSON.stringify(pub)};\nwindow.ARCH = ${JSON.stringify(arch)};\n`);
  const html = join(d, 'index.html');
  writeFileSync(html, readFileSync(html, 'utf8').replace(/data-duration="[^"]*"/g, `data-duration="${dur}"`));
  console.log(`synced ${story.chapters.length} chapters, ${dur} s (${(dur / bar).toFixed(2)} bars at ${arch.bpm} BPM)`);
}

if (flag('--sync')) { sync(dir); process.exit(0); }

const KEEP = new Set(['receipts.json', 'story.json']);   // the harvest and the approved story may already be there
if (existsSync(dir) && readdirSync(dir).some(f => !KEEP.has(f) && f !== '.DS_Store')) { console.error(`refusing to scaffold into ${dir}: it holds files other than receipts.json / story.json`); process.exit(1); }
const nm = join(HERE, 'node_modules');
const P5 = join(nm, 'p5/lib/p5.min.js'), BRUSH = join(nm, 'p5.brush/dist/p5.brush.js');
if (!existsSync(P5) || !existsSync(BRUSH)) { console.error('run `sh scripts/setup.sh` first (pinned p5 + p5.brush)'); process.exit(1); }
for (const sub of ['', 'kit', 'vendor', 'music', 'renders']) mkdirSync(join(dir, sub), { recursive: true });
for (const f of ['index.html', 'scenes.js', 'archetypes.json', 'hyperframes.json']) copyFileSync(join(TPL, f), join(dir, f));
for (const f of readdirSync(KIT)) copyFileSync(join(KIT, f), join(dir, 'kit', f));
copyFileSync(P5, join(dir, 'vendor/p5.min.js')); copyFileSync(BRUSH, join(dir, 'vendor/p5.brush.js'));
const storySrc = opt('--story') ? resolve(opt('--story')) : existsSync(join(dir, 'story.json')) ? null : join(TPL, 'story.example.json');
if (storySrc && storySrc !== join(dir, 'story.json')) copyFileSync(storySrc, join(dir, 'story.json'));
if (!opt('--story') && storySrc) console.warn('warn: no story.json given, using the fictional example story');
writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'day-in-my-life-film', private: true, type: 'module',
  scripts: { check: 'npx --yes hyperframes@0.8.70 check', render: 'npx --yes hyperframes@0.8.70 render --fps 24 --crf 12 --browser-gpu -o renders/film.mp4' } }, null, 2) + '\n');
sync(dir);
console.log(`scaffolded ${dir}`);
