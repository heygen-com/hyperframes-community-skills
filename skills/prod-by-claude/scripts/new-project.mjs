// Creates a HyperFrames project for a Strudel code video.
//
// usage: node new-project.mjs <new-project-dir> [track.strudel.js]
// Copies the template (index.html, app.js, video.json), the track (or the synth-only example), and
// these scripts into <dir>/tools. Plain file copies: no dependencies, no network.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, "..");
const fail = (msg) => { console.error("new-project: " + msg); process.exit(1); };
const dir = path.resolve(process.argv[2] ?? fail("usage: node new-project.mjs <new-project-dir> [track.strudel.js]"));
const track = path.resolve(process.argv[3] ?? path.join(skill, "assets/example/track.strudel.js"));
if (fs.existsSync(dir) && fs.readdirSync(dir).length) fail(`${dir} is not empty`);
if (!fs.existsSync(track)) fail(`no track at ${track}`);

fs.mkdirSync(path.join(dir, "assets/fonts"), { recursive: true });
fs.mkdirSync(path.join(dir, "data"), { recursive: true });
for (const f of ["index.html", "app.js", "video.json"]) fs.copyFileSync(path.join(skill, "assets/template", f), path.join(dir, f));
fs.copyFileSync(track, path.join(dir, "track.strudel.js"));
fs.mkdirSync(path.join(dir, "tools"));
for (const f of ["package.json", "recorder.html", "record.mjs", "build-data.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "tools", f));
fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" } }, null, 2) + "\n");
fs.writeFileSync(path.join(dir, ".hyperframesignore"), "tools/\nsnapshots/\ndata/events.json\nassets/stem-*.wav\n");
console.log(`created ${dir}\nnext: cd ${path.join(dir, "tools")} && npm install && node record.mjs .. && node build-data.mjs ..`);
