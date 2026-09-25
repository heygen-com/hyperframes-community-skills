---
name: brick-film
description: Turn a photo into a LEGO-style brick film in HyperFrames. A Three.js diorama of real brick shapes builds itself brick by brick on a plain void, lands on the photo's exact framing, then comes alive as a stop-motion brickfilm (a person gets in a car and drives off, jumps off a cliff with a paraglider, a guitar plays itself). Use for "recreate this photo in LEGO / bricks", "make a LEGO version of me or this picture", "build this in bricks and animate it", or the "AI designs LEGO" trend. Covers people (minifigs with pad-printed faces and molded hair), vehicles, buildings, terrain, crowds and single objects (brick sculptures traced from the photo). Renders locally with a GPU.
---

# Brick Film

Builds one continuous shot, about 16 to 18 s at 1080×1080 / 30 fps:

| Phase | Time | What happens |
|---|---|---|
| Build | 0 to 7.5 s | Ground tiles cascade in, then every part drops in bottom-up; a label counts parts and stud connections as they land; the camera descends from a wide 3/4 onto the photo framing |
| Photo | 7.8 to 8.2 s | Hold on the recreated photo (the camera lands at 7.8 s; the last minifig part at about 7.5 s) |
| Alive | 8.2 to ~14 s | One story beat per hero, animated on twos (15 fps steps) while the camera moves smoothly |
| Out | ~14 s to end | Pull back to the whole diorama; the label returns with the final count |

## When to use / when not to

Use it when the input is a single still photo and the deliverable is a short brick-built animation of that photo.

Don't use it for:
- video or footage input (rebuilding moving footage frame by frame is out of scope)
- flat brick mosaics or LEGO Art style pixel pictures (a 2D grid is a simpler, different build)
- real building instructions or part lists for physical LEGO (the parts are real shapes, but nobody checks buildability, stock or colours)
- anything that has to render on HyperFrames cloud (WebGL compositions failed there in testing)

## Requirements

| Need | Version | Used by |
|---|---|---|
| Node.js | 22+ | HyperFrames CLI |
| HyperFrames CLI | 0.8.74, pinned in `scripts/common.sh` and run through `npx` | init, check, snapshot, render |
| Python 3 | Pillow, numpy, scipy (`scripts/requirements.txt`) | photo prep, contact sheets, colour sampler, tracer (scipy), projector, verify |
| ffmpeg / ffprobe | any recent | `motion_trace.py` (HyperFrames rendering needs it anyway) |
| GPU browser capture | Apple Silicon or a desktop GPU | `render --browser-gpu`; software rendering works but is slow |
| macOS `sips` | only for HEIC / DNG photos | `new-project.sh`; on other systems convert the photo to JPG first |

No credentials, accounts or paid services.

## Trust boundary

- **Commands**: `npx --yes hyperframes@0.8.74 init | check | snapshot | render` (the version lives in `scripts/common.sh`), `python3`, `ffmpeg` / `ffprobe`, `sips` (HEIC / DNG only). The skill never runs the project's `publish` script.
- **Network**:
  - npm registry: fetches the pinned CLI on first run.
  - jsdelivr, loaded by the composition: `three@0.181.2` (MIT) and `gsap@3.14.2`.
  - Google Fonts: Inter, fetched by the HyperFrames compiler.
  - No other network destinations, and no user data leaves the machine.
- **Files written**, all inside the one project directory:
  - `new-project.sh` creates the directory and refuses an existing path. It holds HyperFrames' own init files (`AGENTS.md`, `CLAUDE.md`, `meta.json`, `package.json`, `hyperframes.json`) plus `index.html`, `scene.js`, `dev.js`, `kit/` and `reference/`.
  - `trace_object.py` writes `trace/`.
  - `shoot.sh` writes `shots/`, or the output name you pass: HyperFrames frame PNGs, a contact sheet, and `sheet.jpg`, `onion.jpg`, `side.jpg`. It rewrites `dev.js` and always restores `DEV_CAM = null` on exit.
  - `render.sh` writes to `renders/`.
  - Temp directories are removed on exit, including after a failure.
- **Page behaviour**: `assets/kit/engine.js` replaces `Math.random` with a seeded generator inside the composition page so every render worker draws identical frames.
- **Photos**: the user's photo is copied into the project's `reference/` folder and used locally only.

## Workflow

1. **Read the photo.** List every subject, prop and backdrop element. Sample their colours with `python3 scripts/sample_colors.py <photo> x,y ...`, which averages a 7×7 patch. Choose a path for each:
   - person → minifig (`makeFig`)
   - vehicle → `kit/cars.js`
   - building, wall, deck or furniture → `Vox` volumes plus custom parts
   - landscape → `Vox` heightmap chunks
   - a single object as the subject → a traced sculpture (`scripts/trace_object.py`)
2. **Scaffold.** `bash scripts/new-project.sh <dir> <photo> "<title>" [kicker] [#bg] [crop x0,y0,x1,y1]`. The crop is the square of the photo the PHOTO camera must reproduce; the default is the centred square. The film length is 17 s in both `scene.js` (`dur`) and `index.html` (`data-duration`); change them together, or the engine logs an error that `check` reports.
3. **Build `scene.js`.** Follow `references/scene-api.md` (film config, parts, voxels, minifigs, cars) and `references/recipes.md` (walks, jumps, lids, drive-offs, props, tracking shots, terrain, sculptures). `references/examples/` has two complete scenes from test builds, for API reference only.
4. **Match the camera.** `bash scripts/shoot.sh <dir> 8.0` writes `shots/side.jpg` (photo | render) and `shots/onion.jpg`. Adjust `cams.PHOTO` until the hero's silhouette sits on the photo's.
   - Lens: fov 57 suits phone snapshots of people; flat, frontal product-style photos fit fov 15 to 30.
   - `scripts/project.py` turns a photo pixel plus a depth into a world position for background placement. Run it with `PYTHONPATH=<skill>/scripts`.
5. **Choreograph** the alive beat, and review it with `shoot.sh` sheets at 0.3 to 0.5 s spacing.
   - Give timeline sheets their own output name (4th argument) so they don't overwrite the photo-match `onion.jpg` and `side.jpg`.
   - Pass a camera object as the 3rd argument to inspect a close-up without changing the film: `bash scripts/shoot.sh <dir> 10,11 "{ tgt: [0, 3, 0], az: 20, el: 5, dist: 8, fov: 40 }" closeup`.
6. **Verify**: `bash scripts/verify.sh <dir>` (see Verification).
7. **Render**: `bash scripts/render.sh <dir> <name>` (local GPU, CRF 12, 30 fps), then `bash scripts/verify.sh <dir> <dir>/renders/<name>.mp4`.

The expected output is `<dir>/renders/<name>.mp4`, a 1080×1080 H.264 file at 30 fps with no audio.

## Look rules

- Use real LEGO shapes only: brick, plate, tile, slope, curved slope, round plate, bar, windscreen. Tile the smooth tops and leave studs where a builder would. Seams between parts stay visible.
- **Faces are pad prints**: flat inks, small tall oval eyes with a white catch-light, thin tapered brows, and a crisp mouth (an open grin with teeth, or a thin smile). No gradients or shading.
- **Hair is one molded shell** (`moldedHair`) with a clean hairline and sculpted relief. Sphere clusters read as fake.
- **Skin** is light nougat by default. Classic yellow is the iconic alternative, so ask when the brief doesn't say.
- **The void** is one flat colour taken from the photo's sky or backdrop. When the backdrop itself is built (a wall, a room), pick a void that contrasts with it, such as a light blue, so the diorama keeps its edges in the wide shots.
- **The label** sits bottom-left: kicker, title, then `N parts · M connections checked`, with counts that come from the model. It steps aside during the action and returns for the pull-back.

## Placement

- **Frame by the whole figure.** A minifig head is about a quarter of its height, so matching a person's face-to-hip span makes the head huge.
- **Dioramas can't reach a far horizon.** Match the tops of distant things (rooflines, peaks), accept lower bases, and hide the gap behind the heroes.
- **Rotate the whole scene** so the main facade faces the lens the way it does in the photo.
- **Build large scenes as separate floating chunks** (a hero chunk and a backdrop ridge) so the wide shots read as a diorama.

## Choreography

- The alive phase samples `ta` (on-twos time); the camera stays smooth.
- **One causal chain per hero**: each move is launched by the previous one (tap → lid pops → jump → lid slams → suspension dips).
- **Invent the beat from what the photo contains**: the car, the drop, the instrument. Don't reuse a previous film's gag.
- **Props that join the action** (a canopy, notes, smoke) get fixed landing times or their own groups, so they appear on camera.
- **Camera moves** use sine or power2 in-out over 2 to 3.5 s.

## Verification

`bash scripts/verify.sh <project> [render.mp4]` exits 0 only when:
1. `hyperframes check` passes (on failure it prints the check's error lines);
2. the same timestamp captured after seeking from three different places is byte-identical (seek-order determinism, which parallel render workers rely on).

With a render it also runs `motion_trace.py`, which is advisory and never fails:
- **Spikes**: inspect each one. Legitimate spikes are fast moves on twos, such as a spin passing edge-on.
- **Frozen runs longer than 0.75 s**: anything other than the final hold is dead time. Start the next move, usually the pull-back, earlier.

A reviewer can reproduce the whole path without personal photos:

```bash
python3 scripts/make_fixture.py /tmp/mug.jpg
bash scripts/new-project.sh /tmp/brick-mug /tmp/mug.jpg "Red Mug"
```

Then build `scene.js` using the object path.

## Known limits

- The browser preview can't paint when its window is minimized. `shoot.sh` works headless, so use it for every visual check.
- Colour segmentation fails on white objects against pale walls, so hand-trace polygons for those (`trace_object.py` accepts both).
- Parts counts run to roughly 1,000 to 8,000. Renders took 20 to 40 s for 16 to 18 s films on an Apple M3 Pro.
