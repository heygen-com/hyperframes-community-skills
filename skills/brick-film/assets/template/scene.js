// __TITLE__ → bricks. Replace every TODO. API: references/scene-api.md; techniques: references/recipes.md.
import { film, THREE, G, makeFig, E, kf, clamp01, composeM, D2R, rng } from './kit/engine.js';
import { DEV_CAM } from './dev.js';

const A = 8.2, T = (x) => A + x;          // A = the model comes alive (brickfilm on twos from here)

function build(ctx) {
  const { M, Vox } = ctx;
  const r = rng(1);
  // TODO ground / terrain (tier 0 cascades first), structures (Vox), props, vehicles (kit/cars.js)
  // TODO minifigs: ctx.figs.push({ F: makeFig({...}), land: [6.55, 6.8, 7.0, 7.2, 7.45], pose: heroPose })
}

function heroPose(ta) {
  const s = { x: 0, y: 0, z: 0, yaw: 0, aR: [0, 0, 0], aL: [0, 0, 0] };
  if (ta < A) return s;                   // the photo pose until the model wakes
  // TODO the beat: kf([[T(0), a], [T(0.2), b, 'out3']], ta) per channel
  return s;
}

function groups(ta, t, ctx) {
  return {};                              // TODO moving groups (vehicles, lids, props): { name: Matrix4 }
}

film({
  dur: 17, alive: A,                       // keep equal to data-duration in index.html bg: '__BG__', seed: 1,
  build, groups, devCam: DEV_CAM,
  cams: {
    START: { tgt: [0, 0, 0], az: 40, el: 38, dist: 130, fov: 30 },   // wide 3/4 of the whole diorama
    PHOTO: { tgt: [0, 2, 0], az: 0, el: 6, dist: 20, fov: 57 },       // TODO match with shoot.sh onion/side (57 for phone snaps of people, 15–30 for flat product-style shots)
    CLOSE: { tgt: [0, 2.5, 0], az: 10, el: 8, dist: 14, fov: 50 },     // TODO push-in on the action
    END: { tgt: [0, 0, 0], az: -12, el: 30, dist: 125, fov: 30 },
  },
  // photo hold 7.8 → 8.3; start the pull-back as the beat's last move lands (no frozen stretch longer than ~0.75 s)
  moves: [[0, 7.8, 'START', 'PHOTO', 'io2'], [8.3, 10.8, 'PHOTO', 'CLOSE', 'sine'], [13.8, 16.2, 'CLOSE', 'END', 'io2']],
  timeline: (tl) => {
    tl.fromTo('#label .kick', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.3);
    tl.fromTo('#label .title', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0.42);
    tl.fromTo('#label .sub', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.56);
    tl.to('#label', { y: 28, opacity: 0, duration: 0.5, ease: 'power2.in' }, A + 0.2);      // steps aside for the action
    tl.to('#label', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 14.4);        // returns for the pull-back
  },
});
