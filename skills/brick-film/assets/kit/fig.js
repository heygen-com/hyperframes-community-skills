// Minifigure rig. Faces +z by default; root sits on the ground under the feet.
import * as THREE from 'three';
import * as G from './parts.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const { FIG } = G;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

// Face print, in LEGO's pad-print language: flat inks only (black + white + one warm dark), small oval eyes with a
// white catch-light, thin tapered brows, crisp outlines. Lathe UVs: u wraps (face centred at u = 0.5), v = height.
// 2048 px ≈ the full circumference; 1024 px = the head's height.
function faceTex(skin, o) {
  return canvasTex(2048, 1024, (g, W, H) => {
    g.fillStyle = skin; g.fillRect(0, 0, W, H);
    const cx = W / 2, ink = '#161311', eyeY = 482, ex = 106;
    // brows: tapered crescents, inner ends slightly lower
    g.fillStyle = o.brow;
    for (const s of [-1, 1]) {
      const x0 = cx + s * 64, x1 = cx + s * 150, y0 = 380, y1 = 392;
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo(cx + s * 104, 344, x1, y1);
      g.quadraticCurveTo(cx + s * 104, 362, x0, y0 + 12);
      g.closePath(); g.fill();
    }
    // eyes: tall ovals + catch-light
    for (const s of [-1, 1]) {
      g.fillStyle = ink; g.beginPath(); g.ellipse(cx + s * ex, eyeY, 27, 40, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx + s * ex - 8, eyeY - 14, 8.5, 10, 0, 0, Math.PI * 2); g.fill();
    }
    if (o.mouth === 'grin') {
      // open grin: black crescent, white top teeth, warm tongue — the classic LEGO "big smile" print
      const my = 612, mw = 118;
      const mouth = () => { g.beginPath(); g.moveTo(cx - mw, my); g.quadraticCurveTo(cx, my + 22, cx + mw, my); g.quadraticCurveTo(cx + mw * 0.72, my + 118, cx, my + 124); g.quadraticCurveTo(cx - mw * 0.72, my + 118, cx - mw, my); g.closePath(); };
      g.fillStyle = ink; mouth(); g.fill();
      g.save(); mouth(); g.clip();
      g.fillStyle = '#7d2a26'; g.beginPath(); g.ellipse(cx, my + 132, 70, 46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx - mw, my - 4); g.quadraticCurveTo(cx, my + 26, cx + mw, my - 4); g.lineTo(cx + mw, my + 30); g.quadraticCurveTo(cx, my + 60, cx - mw, my + 30); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 9; g.lineJoin = 'round'; mouth(); g.stroke();
      // smile lines at the corners
      g.lineWidth = 7; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * (mw + 6), my - 20); g.quadraticCurveTo(cx + s * (mw + 22), my + 2, cx + s * (mw + 8), my + 26); g.stroke(); }
    } else {
      // classic smile: one thin arc with tiny dimples
      g.strokeStyle = ink; g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - 82, 612); g.quadraticCurveTo(cx, 690, cx + 82, 612); g.stroke();
      g.lineWidth = 6;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 76, 596); g.lineTo(cx + s * 92, 624); g.stroke(); }
    }
  });
}

// Torso front: black tee, crew neck, orange lanyard to a white badge.
function torsoTex(o) {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = o.shirt; g.fillRect(0, 0, W, H);
    if (o.neck) { g.fillStyle = o.skin; g.beginPath(); g.ellipse(W / 2, 0, 70, 46, 0, 0, Math.PI); g.fill(); g.strokeStyle = '#34363c'; g.lineWidth = 8; g.beginPath(); g.ellipse(W / 2, 0, 74, 50, 0, 0, Math.PI); g.stroke(); }
    // fabric folds
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(120, 330); g.quadraticCurveTo(200, 360, 260, 420); g.stroke();
    g.beginPath(); g.moveTo(400, 300); g.quadraticCurveTo(360, 380, 330, 460); g.stroke();
    if (o.straps) {   // backpack straps over the shoulders, chest strap, hydration tube
      g.fillStyle = o.straps;
      g.beginPath(); g.moveTo(96, 0); g.lineTo(150, 0); g.lineTo(170, 512); g.lineTo(118, 512); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(416, 0); g.lineTo(362, 0); g.lineTo(342, 512); g.lineTo(394, 512); g.closePath(); g.fill();
      g.fillRect(150, 230, 212, 26);
      g.fillStyle = '#9aa0a8'; g.fillRect(238, 224, 36, 38);
      if (o.tube) { g.strokeStyle = o.tube; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(132, 40); g.quadraticCurveTo(150, 190, 128, 300); g.stroke(); }
      if (o.clip) { g.fillStyle = o.clip; g.fillRect(168, 150, 30, 60); }
    }
    if (o.lanyard) {
      g.strokeStyle = o.lanyard; g.lineWidth = 22; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W / 2 - 62, 20); g.quadraticCurveTo(W / 2 - 40, 190, W / 2 + 6, 300); g.stroke();
      g.beginPath(); g.moveTo(W / 2 + 62, 20); g.quadraticCurveTo(W / 2 + 44, 190, W / 2 + 12, 300); g.stroke();
      g.fillStyle = '#26272b'; g.fillRect(W / 2 - 8, 296, 28, 24);
      g.fillStyle = '#f6f6f2'; g.fillRect(W / 2 - 38, 318, 92, 112);
      g.fillStyle = '#e25b1f'; g.fillRect(W / 2 - 38, 318, 92, 22);
      g.fillStyle = '#9aa0a8'; g.fillRect(W / 2 - 24, 356, 64, 8); g.fillRect(W / 2 - 24, 372, 44, 8);
    }
  });
}

// Molded hair presets (see parts.moldedHair). Any preset can be overridden with o.hairOpts.
export const HAIR = {
  curly: { R: 0.665, vol: 1.18, cy: 0.1, cz: -0.035, e: 0.8, front: 0.27, side: 0.0, back: -0.4, fringe: 9, fringeDepth: 0.075, curl: 0.16, cr: 0.28, n: 150, seed: 7279 },
  wavy: { R: 0.672, vol: 0.98, cy: 0.14, cz: -0.03, e: 0.66, front: 0.26, side: 0.04, back: -0.34, fringe: 5, fringeDepth: 0.06, curl: 0.07, cr: 0.34, n: 60, seed: 658 },
  short: { R: 0.665, vol: 0.86, cy: 0.18, cz: -0.02, e: 0.6, front: 0.3, side: 0.08, back: -0.32, fringe: 0, fringeDepth: 0, curl: 0.025, cr: 0.5, n: 24, part: 0.05, seed: 3 },
  crop: { R: 0.645, vol: 0.8, cy: 0.2, cz: -0.02, e: 0.55, front: 0.34, side: 0.12, back: -0.3, fringe: 0, fringeDepth: 0, curl: 0.0, cr: 0.5, n: 1, seed: 4 },
  long: { R: 0.69, vol: 1.0, cy: 0.12, cz: -0.06, e: 0.7, front: 0.3, side: -0.55, back: -0.9, fringe: 3, fringeDepth: 0.04, curl: 0.03, cr: 0.4, n: 40, seed: 5 },
};

export function makeFig(o) {
  // o: { skin, shirt, legs, hair, brow, lanyard, neck, bracelet, hairStyle: 'curly'|'short'|'none' }
  const plastic = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0, ...extra });
  const mSkin = plastic(o.skin), mShirt = plastic(o.shirt), mLegs = plastic(o.legs), mHair = plastic(o.hair, { roughness: 0.28 });
  const mTorsoFront = plastic('#ffffff', { map: torsoTex(o) });
  const mFace = plastic('#ffffff', { map: faceTex(o.skin, o), roughness: 0.26 });

  const root = new THREE.Group(); root.name = 'fig';
  const hips = new THREE.Group(); hips.position.y = FIG.legH; root.add(hips);
  const meshes = [];
  const mk = (geo, mat, parent, pos = [0, 0, 0], stage = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); meshes.push({ mesh: m, stage, base: m.position.clone() }); return m; };

  mk(G.hipGeo(), mLegs, hips, [0, 0, 0], 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-FIG.legW / 2 - 0.005, 0, 0); legR.position.set(FIG.legW / 2 + 0.005, 0, 0);
  hips.add(legL, legR);
  if (o.shorts) {
    const mShoe = plastic(o.shoes || '#3a3c42');
    const lg = G.legGeos();
    for (const L of [legL, legR]) { mk(lg.upper, mLegs, L, [0, 0, 0], 0); mk(lg.lower, mSkin, L, [0, 0, 0], 0); mk(lg.foot, mShoe, L, [0, 0, 0], 0); }
  } else { mk(G.legGeo(), mLegs, legL, [0, 0, 0], 0); mk(G.legGeo(), mLegs, legR, [0, 0, 0], 0); }

  const torso = new THREE.Group(); torso.position.y = FIG.hipH / 2 + FIG.torsoH / 2; hips.add(torso);
  const tg = G.torsoGeo();
  mk(tg, [mShirt, mShirt, mShirt, mShirt, mTorsoFront, mShirt], torso, [0, 0, 0], 1);

  const arms = {};
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * (FIG.torsoWt / 2 + 0.2), FIG.torsoH / 2 - 0.3, 0); piv.rotation.order = 'YXZ'; piv.rotation.z = s * 0.1;
    torso.add(piv);
    const a = G.armGeos();
    mk(a.sleeve, mShirt, piv, [0, 0, 0], 2);
    mk(a.fore, o.longSleeve ? mShirt : mSkin, piv, [0, 0, 0], 2);
    const hand = new THREE.Group(); hand.position.set(0, -1.2, 0.26); piv.add(hand);
    const hm = mk(a.hand, mSkin, hand, [0, 0, 0], 2); hm.geometry = a.hand.clone().translate(0, 1.2, -0.26);
    if (o.bracelet && s < 0) mk(new THREE.TorusGeometry(0.13, 0.035, 8, 20).rotateX(Math.PI / 2).translate(0, -1.0, 0.18), plastic('#2a2a2e'), piv, [0, 0, 0], 2);
    arms[s < 0 ? 'L' : 'R'] = { piv, hand };
  }

  const head = new THREE.Group(); head.position.y = FIG.torsoH / 2 + FIG.neckH + FIG.headH / 2; torso.add(head);
  const neck = new THREE.CylinderGeometry(0.34, 0.34, FIG.neckH + 0.05, 20);
  mk(neck, mSkin, head, [0, -FIG.headH / 2 - FIG.neckH / 2 + 0.02, 0], 3);
  // head with planar-v face UVs (face centred on +z)
  const hg = G.headGeo().clone();
  {
    const p = hg.attributes.position, uv = hg.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = 0.5 + Math.atan2(x, z) / (Math.PI * 2);
      uv.setXY(i, u, (y + FIG.headH / 2) / FIG.headH);
    }
    uv.needsUpdate = true;
  }
  mk(hg, mFace, head, [0, 0, 0], 3);
  mk(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 20), mSkin, head, [0, FIG.headH / 2 + 0.08, 0], 3);   // head stud

  let hair = null;
  if (o.hairStyle !== 'none') {
    hair = new THREE.Group(); head.add(hair);
    const hopts = { ...(HAIR[o.hairStyle] || HAIR.short), ...(o.hairOpts || {}) };
    if (o.seed != null && !o.hairOpts?.seed) hopts.seed = (hopts.seed || 1) + o.seed;
    mk(G.moldedHair(hopts), mHair, hair, [0, 0, 0], 4);
    if (o.shades) {    // sunglasses pushed up onto the hair
      const mS = plastic('#15161a', { roughness: 0.15 });
      const bar = new THREE.BoxGeometry(1.12, 0.07, 0.07); bar.translate(0, 0.56, 0.5); bar.rotateX(-0.25);
      mk(bar, mS, hair, [0, 0, 0], 4);
      for (const sx of [-1, 1]) { const l = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18); l.rotateX(Math.PI / 2 - 0.25); l.translate(sx * 0.27, 0.5, 0.58); mk(l, mS, hair, [0, 0, 0], 4); }
    }
  }
  if (o.backpack) {   // a moulded backpack clipped between torso and neck
    const mB = plastic(o.backpack, { roughness: 0.45 });
    const bp = new RoundedBoxGeometry(1.45, 1.35, 0.62, 3, 0.16); bp.translate(0, -0.1, -FIG.torsoD / 2 - 0.3);
    mk(bp, mB, torso, [0, 0, 0], 1);
    const pocket = new RoundedBoxGeometry(1.0, 0.55, 0.2, 2, 0.08); pocket.translate(0, -0.42, -FIG.torsoD / 2 - 0.66);
    mk(pocket, mB, torso, [0, 0, 0], 1);
    for (const sx of [-1, 1]) { const st = new THREE.BoxGeometry(0.24, 0.08, 1.0); st.translate(sx * 0.46, FIG.torsoH / 2 + 0.03, -0.02); mk(st, mB, torso, [0, 0, 0], 1); }
  }
  return { root, hips, legL, legR, torso, armL: arms.L, armR: arms.R, head, hair, meshes, mats: { mFace } };
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
