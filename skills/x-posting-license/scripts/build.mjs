#!/usr/bin/env node
/* Build one X posting-license project from the template.
   Usage:
     node <SKILL_DIR>/scripts/build.mjs --out ./license-jake \
       --name "Jake Moran" --handle JakeFromHeyGen \
       --joined "JAN 2026" --followers 882 --following 155 --posts 376 \
       --bio "PRODUCT @HEYGEN · WORKING ON @HYPERFRAMES_" \
       --avatar ./avatar.jpg \
       [--big "MORAN, JAKE"]   # optional; derived from --name if omitted
   Then render:
     npx hyperframes@latest render <out> -q high -o <out>/renders/license.mp4

   Safety contract:
   - All profile strings are treated as untrusted: control characters are
     stripped, lengths are capped, and every value is HTML-escaped before
     substitution. Counter values are validated as plain non-negative
     integers because they land inside the composition's <script>.
   - Writes stay inside --out: the script refuses to operate through
     symlinks (the out dir, its subdirs, or any existing target file).
*/
import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync,
  lstatSync, realpathSync, existsSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function die(msg) { console.error("error:", msg); process.exit(1); }

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const k = String(argv[i] || "");
  if (!k.startsWith("--")) die("unexpected argument: " + k);
  if (argv[i + 1] === undefined) die(k + " needs a value");
  args[k.slice(2)] = String(argv[i + 1]);
}

const need = ["out", "name", "handle", "joined", "followers", "following", "posts", "bio", "avatar"];
const missing = need.filter((k) => !args[k]);
if (missing.length) die("missing: " + missing.map((m) => "--" + m).join(" "));

/* ---------- validation (untrusted input) ---------- */

// strip control chars (incl. newlines) and cap length; these are display strings
function cleanText(v, label, max) {
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) die("--" + label + " is empty after sanitising");
  if (s.length > max) die("--" + label + " is longer than " + max + " characters");
  return s;
}

// counters land inside the composition's <script>: accept ONLY plain
// non-negative integers (no signs, fractions, exponents, NaN, commas)
function cleanCount(v, label) {
  const s = v.trim().replace(/,/g, "");
  if (!/^\d{1,10}$/.test(s)) die("--" + label + ' must be a non-negative integer (got "' + v + '")');
  return String(Number(s));
}

const handle = args.handle.replace(/^@/, "");
if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) die("--handle must be a valid X handle ([A-Za-z0-9_], max 15)");

const MONTHS = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
                 JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const joined = cleanText(args.joined, "joined", 8).toUpperCase();
const [mon, year] = joined.split(/\s+/);
if (!MONTHS[mon] || !/^\d{4}$/.test(year || "")) die('--joined must look like "JAN 2026"');
const iss = MONTHS[mon] + "/" + year;

const name = cleanText(args.name, "name", 40);
const bio = cleanText(args.bio, "bio", 90);
const big = args.big ? cleanText(args.big, "big", 40) : null;

// "Jake Moran" -> "MORAN, JAKE"; single-token names (e.g. "|||") pass through
function bigFrom(n) {
  const parts = n.split(/\s+/);
  if (parts.length < 2) return n.toUpperCase();
  const last = parts.pop();
  return (last + ", " + parts.join(" ")).toUpperCase();
}

// every string token is HTML-escaped; they are substituted into text nodes only
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const followers = cleanCount(args.followers, "followers");
const fmt = (n) => Number(n).toLocaleString("en-US");

const fill = {
  NAME_BIG: esc((big || bigFrom(name))),
  NAME_SIG: esc(name),
  HANDLE_UPPER: esc(handle.toUpperCase()),
  JOINED: esc(joined),
  ISS: esc(iss),
  FOLLOWERS: followers,                       // validated integer, script context
  FOLLOWING: cleanCount(args.following, "following"),
  POSTS: cleanCount(args.posts, "posts"),
  FOLLOWERS_FMT: esc(fmt(followers)),
  BIO_UPPER: esc(bio.toUpperCase()),
};

/* ---------- symlink-safe output ---------- */

function refuseSymlink(p) {
  try {
    if (lstatSync(p).isSymbolicLink()) die(p + " is a symlink; refusing to write through it");
  } catch { /* does not exist: fine */ }
}

const outArg = resolve(args.out);
refuseSymlink(outArg);
mkdirSync(join(outArg, "assets"), { recursive: true });
mkdirSync(join(outArg, "renders"), { recursive: true });
const outReal = realpathSync(outArg);

// after mkdir, every path we touch must resolve inside the real out dir
function safePath(...parts) {
  const p = join(outReal, ...parts);
  refuseSymlink(p);
  const parentReal = realpathSync(dirname(p));
  if (parentReal !== outReal && !parentReal.startsWith(outReal + sep)) {
    die(p + " escapes the output directory; refusing");
  }
  return p;
}

/* ---------- build ---------- */

const dir = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(dir, "../template/index.template.html"), "utf8");
for (const [k, v] of Object.entries(fill)) html = html.split("{{" + k + "}}").join(v);
const left = html.match(/{{[A-Z_]+}}/);
if (left) die("unfilled token: " + left[0]);

if (!existsSync(args.avatar)) die("--avatar file not found: " + args.avatar);

writeFileSync(safePath("index.html"), html);
copyFileSync(args.avatar, safePath("assets", "avatar.jpg"));
writeFileSync(safePath("hyperframes.json"), JSON.stringify({
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
}, null, 2));
writeFileSync(safePath("meta.json"), JSON.stringify({
  id: "x-posting-license", name: "x-posting-license-" + handle.toLowerCase(),
}, null, 2));

console.log("built", outReal, "->", fill.NAME_BIG, "@" + fill.HANDLE_UPPER,
  fill.FOLLOWERS_FMT + " followers");
console.log("render: npx hyperframes@latest render " + outReal +
  " -q high -o " + join(outReal, "renders", "license.mp4"));
