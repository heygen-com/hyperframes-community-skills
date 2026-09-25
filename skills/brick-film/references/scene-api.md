# Scene API

A project's `scene.js` imports the kit and calls `film({...})` once. The engine owns rendering, instancing, the brick-by-brick build, minifig drop-in, the on-twos clock, the camera path, the label and the HyperFrames timeline hookup. Every frame is a pure function of time.

```js
import { film, THREE, G, Vox, makeFig, E, kf, clamp01, composeM, D2R, rng } from './kit/engine.js';
import { DEV_CAM } from './dev.js';
```

`Vox` is also available as `ctx.Vox` inside `build(ctx)`.

## `film(cfg)`

| Key | Meaning |
|---|---|
| `dur` | Film length in seconds; keep `data-duration` in `index.html` equal to it (the engine logs an error that `check` reports when they differ) |
| `alive` | Time the model comes alive; the on-twos clock `ta` starts here (`twosFps`, default 15) |
| `bg` | Void colour (`#rrggbb`) |
| `floorY`, `floorShadow` | Height of the invisible shadow-catcher plane (default −0.41, just under a plate at y = 0) or `null` for none (floating terrain); its shadow colour (default `#29425e`) |
| `light` | `{ sky, ground, hemi, sunColor, sun, sunPos, sunTarget, shadowBox, shadowFar }`; place the sun where the photo's shadows fall |
| `envIntensity`, `exposure`, `ao` | Environment reflections, tone-mapping exposure, ambient-occlusion blend |
| `build(ctx)` | Fill `ctx.M` with parts, push minifigs to `ctx.figs`, put static group matrices in `ctx.groups`, keep shared data in `ctx.state` |
| `groups(ta, t, ctx)` | Per frame: `{ name: Matrix4 }` for moving groups; every part with `group: name` follows its matrix |
| `update(t, ta, ctx)` | Per frame: anything else (material intensities, extra meshes); `ctx.MATS` holds the materials |
| `schedule` | `{ ground: [t0, t1], rest: [t0, t1], worldY, sweep: [kx, kz], dropMin, dropVar }`. Tier-0 parts land across `ground` (default `[0.12, 1.1]`), everything else bottom-up across `rest` (default `[0.95, 6.3]`), ordered by height, then `x·kx + z·kz` (default `[0.7, −0.35]`). Parts fall from `dropMin + random·dropVar` studs above (defaults 4.2 and 2.2). `worldY: true` orders by world height instead of group-local height (needed when groups sit at different heights) |
| `fall` | Seconds each part takes to fall into place (default 0.5) |
| `W`, `H`, `canvas`, `labelId`, `id` | Frame size (1080), canvas element id (`stage`), label count element id (`lab-count`), composition id (`main`); change only together with `index.html` |
| `mats(THREE)` | Extra materials by name, e.g. an alpha-mapped lattice |
| `cams` | Named states `{ tgt: [x, y, z], az, el, dist, fov }` (degrees; az from +z toward +x). A state may be a function `(t) => state` for tracking shots |
| `moves` | `[t0, t1, fromName, toName, ease]` per move; the gaps between moves are holds. Eases: `lin in2 out2 io2 in3 out3 io3 sine back` |
| `timeline(tl)` | GSAP tweens on the root timeline (the label waterfall in and out) |
| `devCam` | Pass `DEV_CAM` (from `dev.js`); non-null locks the camera for snapshots only |
| `seed` | Seeds `Math.random` in the page and the part schedule |

## Parts (`ctx.M`)

Units are studs (8 mm). A plate is 0.4, a brick 1.2 (`G.PL = 0.4`), and y is up.

- `M.brick(x, y, z, w, d, plates, colour, opts)` places a brick, plate or tile with its min corner at (x, y, z); w runs along x and d along z. `opts`:
  - `top: 'stud' | 'tile'`, and `mat`
  - `group`, `tier`
  - `land`: a fixed landing time
  - `noCount`: leave it out of the label count
- `M.add({ geo, mat, color, pos, rot, group, conn, land, tier, noCount })` places any custom geometry, centred at `pos`. `rot` is Euler YXZ; `conn` is the connections it contributes; `noCount` keeps pop-in props out of the label.
- **Materials**: `plastic` (default), `chrome`, `glass`, `glassLt`, `lightW` (white emissive) and `lightR` (red emissive), plus anything added through `mats`.
- **Tiers**: `tier: 0` builds first (the ground cascade). Parts with a `land` time build at exactly that time, which suits props that assemble during the action.

## Geometry (`G`, from `kit/parts.js`)

| Function | Shape |
|---|---|
| `boxGeo(w, h, d)` | Rounded brick body (every brick, plate, tile) |
| `studGeo()` | Stud (drawn automatically on `top: 'stud'` bricks) |
| `slopeGeo(L, H, w, flat, lip)` | Straight slope, downhill along +x |
| `curveGeo(L, H, w, flat, lip, 'sin' \| 'ell')` | Curved slope; `'ell'` rounds over to vertical (noses, fenders); `curveY()` returns its surface height for placing details on it |
| `invSlopeGeo`, `panelGeo(key, pts, t)` | Inverted slope; any polygon extruded by `t` |
| `roofGeo(L, hw, h, t)` | Moulded car roof shell |
| `screenGeo(L, rise, w)` | Raked windscreen |
| `cylGeo(r, h, seg)` | Round brick / bar / plate (axis y) |
| `tyreGeo(R, r, w)`, `rimGeos(R)` | Wheel parts (axis z) |
| `moldedHair(opts)` | One-piece hair shell (see `HAIR` presets in `fig.js`) |

## Voxels (`Vox`, from `kit/vox.js`)

```js
const v = new Vox({ lp: 3, origin: [x, y, z], group: 'static', k: 1, exposedStudsOnly: false, tier: 1 });
v.set(ix, iy, iz, { c: '#rrggbb', top: 'stud' | 'tile', m: 'glass' });   // one cell (spec null removes it)
v.fill(x0, x1, y0, y1, z0, z1, spec);                                       // a box of cells, end-exclusive ranges
v.clear(x0, x1, y0, y1, z0, z1);                                            // remove a box (doors, windows)
v.emit(M);
```

A cell `(ix, iy, iz)` sits at `origin + (ix·k, iy·lp·0.4, iz·k)`.

- `lp` is the layer height in plates: 1 builds in plates, 3 in bricks.
- `emit` merges cells into real part sizes (1×1 up to 2×8), alternating the scan direction per layer so seams stagger. A tile top that another cell covers becomes a studded plate.
- `k: 2` makes each cell a 2×2 stud column, which suits terrain.
- `exposedStudsOnly` skips buried studs but still counts their connections.

## Minifigs (`makeFig`, from `kit/fig.js`)

```js
const F = makeFig({ skin, shirt, legs, hair, brow, hairStyle: 'curly' | 'wavy' | 'short' | 'crop' | 'long', hairOpts,
  mouth: 'grin' | 'smile', neck, lanyard, straps, tube, clip, backpack, shorts, shoes, shades, bracelet, longSleeve, seed });
ctx.figs.push({ F, land: [legs, torso, arms, head, hair], group: 'car', pose: (ta, t) => pose });
```

- Optional `group` makes the figure ride a moving group, such as sitting in a car. Figures without a `pose` take `still`.
- Pose object: `{ x, y, z, yaw, roll, legL, legR, aR: [rx, ry, rz], aL, hy, hz, headPitch, lean }`.
  - The root is on the ground under the feet, and the figure faces +z at yaw 0.
  - A negative arm `rx` raises the arm forward; `rz` swings it out from the body (its sign follows the side).
  - Legs at `-Math.PI / 2` sit.
  - `aR` is the arm on the figure's +x side.
- Dimensions are in `G.FIG`. The hip pivot is at `legH` (1.24), and total height is about 5 with hair.

## Cars (`kit/cars.js`)

- `buildTaycan(M, id)` builds an 8 × 18 sports car. Set `COL.taycan` before calling to change the body colour.
  - Groups: `id` (body), `id.roof` (greenhouse, lifts off), and `id.wFL`, `id.wFR`, `id.wRL`, `id.wRR` (wheels, origin at the wheel centre).
  - `TAY` exports the axles, wheel radius, seat and steering-wheel positions.
- `buildParked(M, o)` builds a generic car or SUV in a static group `o.id`.
  - Options: `L`, `W`, `R`, `fo`, `ro`, `belt`, `nose`, `cowlX`, `roofF`, `roofR`, `roofY`, `tailX`, `tailY`, `color`, `rim`, `spoke`, `lights: 'round' | 'bar'`.
  - Register its world matrix in `ctx.groups[o.id]`. Its wheel groups resolve through `M.groupsStatic`.

## Label

`index.html` holds `#label` with `.kick`, `.title` and `#lab-count`. The engine writes `N parts · M connections checked` into `#lab-count` every frame. The template's `timeline` waterfalls the label in, steps it out just after `alive` and brings it back for the pull-back; move those two times to match your beat.
