# Recipes

Excerpts from working builds. They're techniques, not beats to reuse. `A` is the alive time, `T(x) = A + x`, and every function takes `ta` (on-twos time).

## Minifig: wave, waddle, snap turn

```js
function heroPose(ta) {
  const s = { x: 0, y: 0, z: 0, yaw: FACE_CAM, aR: [0, 0, 0], aL: [0, 0, 0] };
  if (ta < A) return s;
  if (ta >= T(0.35) && ta < T(1.3)) {                                   // wave: raise, three flicks, lower
    const raise = kf([[T(0.35), 0], [T(0.5), 1, 'out3'], [T(1.1), 1], [T(1.25), 0]], ta);
    const flick = ta < T(0.5) || ta > T(1.1) ? 0 : Math.sin((ta - T(0.5)) / 0.133 * Math.PI) * 0.35;
    s.aR = [-2.9 * raise, 0, 0.45 * raise + flick];
  }
  s.yaw = FACE_CAM + (WALK_YAW - FACE_CAM) * kf([[T(1.35), 0], [T(1.5), 1, 'out2']], ta);   // snap turn, 2 frames on twos
  if (ta >= T(1.55)) {                                                  // waddle: 3 steps, legs ±0.5, hop 0.16
    const u = clamp01((ta - T(1.55)) / 0.9), ph = u * 3 * Math.PI, sw = u < 1 ? Math.sin(ph) : 0;
    s.x = X0 + (X1 - X0) * u;
    s.legL = 0.5 * sw; s.legR = -0.5 * sw; s.aR = [-0.45 * sw, 0, 0]; s.aL = [0.45 * sw, 0, 0];
    s.y = Math.abs(Math.sin(ph)) * 0.16; s.roll = 0.06 * sw;
  }
  return s;
}
```

## Minifig: jump into a seat

Arc from the standing spot to the seat. Rotate to face forward and swing the legs to sitting mid-air. Use arms-up "yay", then hands on the wheel.

```js
const u = clamp01((ta - J0) / (J1 - J0));
s.x = from.x + (seat.x - from.x) * u; s.z = from.z + (seat.z - from.z) * E.io2(u);
s.y = seatRootY * u + Math.sin(u * Math.PI) * 3.6;                       // seatRootY = hipPivotY − G.FIG.legH
s.yaw = kf([[J0, 0], [J1 - 0.1, Math.PI / 2]], ta);
s.legL = s.legR = -Math.PI / 2 * kf([[J0 + 0.1, 0], [J0 + 0.33, 1, 'out2']], ta);
```

Parent the figure to the car's group (`group: 'car'`) and express the pose in car-local coordinates, so it rides along.

## Lid that pops (roof, hatch, box)

```js
const up = ta < CLOSE ? kf([[TAP, 0], [TAP + 0.2, 2.5, 'back']], ta) : kf([[CLOSE, 2.5], [CLOSE + 0.2, 0, 'in2']], ta);
const tilt = ta < CLOSE ? kf([[TAP, 0], [TAP + 0.2, 1, 'back']], ta) : kf([[CLOSE, 1], [CLOSE + 0.2, 0, 'in2']], ta);
groups.roof = carM.clone().multiply(composeM([0, up, 0], [-tilt * 0.34, -tilt * 0.06, tilt * 0.1]));
```

Tip the lid so its top faces the lens; an underside facing the camera blocks the cabin. Put a suspension dip on the slam frame.

## Vehicle drive-off

Integrate the path from a heading function, steer with a bicycle model, and dip the suspension on impacts.

```js
const yawAt = (s) => YAW0 + (YAW_END - YAW0) * E.out2(clamp01((s - 0.6) / TURN));
function pathAt(s) {                                      // s = distance travelled; small fixed steps → deterministic
  let x = X0, z = Z0;
  for (let d = 0; d < s; d += 0.2) { const st = Math.min(0.2, s - d), yaw = yawAt(d + st / 2); x += Math.cos(yaw) * st; z -= Math.sin(yaw) * st; }
  return { x, z, yaw: yawAt(s) };
}
const lt = Math.max(0, ta - LAUNCH), s = Math.min(160, 0.5 * ACC * lt * lt);            // accelerate, then cap far off-frame
const steer = Math.max(-0.45, Math.min(0.45, (yawAt(s + 0.5) - yawAt(s - 0.5)) * 11)); // front wheels: rotateY(steer)
const dip = (t0, amp, dur = 0.33) => { const u = (ta - t0) / dur; return u < 0 || u > 1 ? 0 : -amp * Math.sin(u * Math.PI * 2) * (1 - u); };
// wheel spin = -(distance / radius) about the axle; burnout = rear spin before launch; nose-up pitch for 0.55 s after launch
```

Turn early so the car swings across the frame instead of into the lens. Burnout smoke is round plates spawned at the rear tyres. Skid marks are dark 1×2 tiles laid where the rear wheels were at each spawn time.

## Prop that assembles on camera

Give each piece a fixed `land` time in its own group. The engine drops each piece in along the group's local up, so the prop snaps together wherever the group sits. Paraglider canopy (cells along an arc, rotated tangent):

```js
for (let i = 0; i < 15; i++) {
  const th = -span / 2 + (i + 0.5) * (span / 15);
  M.add({ geo: G.curveGeo(3.6, 0.6, arc + 0.06, 0.9, 0.12, 'ell'), color: i % 2 ? ORANGE : BLUE,
    pos: [Math.sin(th) * R, Math.cos(th) * R, 0], rot: [th, Math.PI / 2, 0], group: 'glider', land: T(1.95) + Math.abs(i - 7) * 0.05, tier: 2 });
}
```

## Pop-in props (music notes, puffs)

Parts with `land: 0, noCount: true` in per-prop groups. The group matrix is a zero scale until the prop's time, then position + scale. The scale pops in over about 0.12 of its life and out over the last 0.15.

## Tracking camera

```js
cams.FOLLOW = (t) => { const f = flight(t); return { tgt: [f.x * 0.75, 3 + (f.y - 3) * 0.6, f.z * 0.75], az: 14, el: 3, dist: 16, fov: 52 }; };
```

## Terrain chunks

```js
const ridge = new Vox({ lp: 3, origin: [0, BASE, 0], k: 2, exposedStudsOnly: true });
for (let ix = ...) for (let iz = ...) {
  const h = heightAt(ix * 2 + 1, iz * 2 + 1), n = Math.round((h - BASE) / 1.2);
  for (let iy = 0; iy < n; iy++) ridge.set(ix, iy, iz, { c: colourFor(BASE + (iy + 1) * 1.2, iy === n - 1), top: 'stud' });
}
ridge.emit(M);
```

Peaks are `max` over broad cones (radius 20 to 35 studs, exponent about 0.9), with a snow line above a height. Keep void between the chunks.

## Object sculpture from a trace

1. Write a spec: hand polygons for low-contrast regions, colour masks for saturated ones. The header of `scripts/trace_object.py` lists every key and how to choose the grid.
2. Run the tracer, then stack its rows bottom-up in plates. A flat or wall-hung object becomes a relief a few studs deep:

```js
TRACE.rows.forEach((line, ri) => [...line].forEach((ch, ci) => {
  const iy = TRACE.rows.length - 1 - ri;
  if (ch === 'B') for (let iz = 0; iz < 3; iz++) v.set(ci, iy, iz, { c: BODY, top: 'tile' });   // body 3 studs deep
}));
```

3. A round object (mug, bottle, vase, lamp) should be revolved, or it looks flat from the wide angles. Per plate row, take the traced half-width as a radius and fill a ring of cells around the axis. Leave attached parts (handles, spouts) as a relief on one side.

```js
TRACE.rows.forEach((line, ri) => {
  const iy = TRACE.rows.length - 1 - ri, xs = [...line].flatMap((ch, ci) => (ch === 'B' ? [ci] : []));
  if (!xs.length) return;
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, R = (Math.max(...xs) - Math.min(...xs) + 1) / 2;
  for (let ix = -Math.ceil(R); ix < Math.ceil(R); ix++) for (let iz = -Math.ceil(R); iz < Math.ceil(R); iz++) {
    const d = Math.hypot(ix + 0.5, iz + 0.5);
    if (d <= R && (d >= R - WALL || iy < BASE_PLATES)) v.set(ix, iy, iz, { c: BODY, top: 'tile' });   // hollow wall, solid base
  }
});
```

4. Bridge small gaps the trace leaves between parts that belong together, such as a handle that stops one column short of the body, with an extra cell or a bar.
5. Put surface detail on the face as thin boxes one layer proud (the SNOT look): pickguards, labels, frets, outlines.
6. Map photo pixels to studs with the trace's own scale:

```js
const PX = (px) => (px - TRACE.X0) / TRACE.SX - COL0;                          // studs across (COL0 = column placed on x = 0)
const PY = (py) => BASE_Y + (TRACE.Y0 + TRACE.rows.length * TRACE.SY - py) / TRACE.SX;   // studs up; SY = 0.4·SX keeps plates 0.4 tall
```

7. A photo taken from slightly above adds the rim's ellipse to the silhouette, which makes a round object a few plates too tall. Trim the top rows, or trace the side profile only.
