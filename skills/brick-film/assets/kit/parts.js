// LEGO part geometry library. Units: 1 = one stud pitch (8 mm). Plate = 0.4, brick = 1.2.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const PL = 0.4;          // plate height
export const GAP = 0.024;       // total clearance between neighbouring parts
export const STUD_R = 0.3, STUD_H = 0.2;

const ni = (g) => (g.index ? g.toNonIndexed() : g);
const cache = new Map();
const cached = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

// Rounded rectangular body — every brick, plate and tile.
export function boxGeo(w, h, d) {
  return cached(`box:${w}:${h}:${d}`, () => {
    const r = Math.min(0.045, h / 4, w / 4, d / 4);
    return new RoundedBoxGeometry(w - GAP, h - GAP * 0.4, d - GAP, 2, r);
  });
}

export function studGeo() {
  return cached('stud', () => {
    const pts = [[0, 0], [STUD_R, 0], [STUD_R, STUD_H - 0.03], [STUD_R - 0.03, STUD_H], [0, STUD_H]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 20);
  });
}

// Extruded side profile. Profile lives in (u,v): u = along the part's downhill axis (0..L), v = up (0..H).
// Result: downhill = +x, width along z, centred on its bounding box.
function extrudeProfile(key, pts, width) {
  return cached(key, () => {
    const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const bev = 0.018;
    const g = new THREE.ExtrudeGeometry(s, { depth: width - GAP - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 10 });
    g.computeBoundingBox();
    const bb = g.boundingBox, c = new THREE.Vector3(); bb.getCenter(c);
    g.translate(-c.x, -c.y, -c.z);
    return toCreasedNormals(g, 0.5);
  });
}

// Straight slope: flat top of length `flat` (studs) then a straight ramp down to `lip`.
export function slopeGeo(L, H, w, flat = 0, lip = 0.12) {
  const g2 = GAP / 2;
  return extrudeProfile(`slope:${L}:${H}:${w}:${flat}:${lip}`,
    [[g2, g2], [L - g2, g2], [L - g2, lip], [flat + g2, H - g2], [g2, H - g2]], w);
}

// Curved slope. shape 'sin': soft shoulder (LEGO curved slope). 'ell': quarter ellipse — rounds over to vertical at the lip.
export const curveY = (u, L, H, flat, lip, shape = 'sin') => {
  if (u <= flat) return H;
  const t = (L - u) / (L - flat);
  return lip + (H - lip) * (shape === 'ell' ? Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) : Math.sin(t * Math.PI / 2));
};
export function curveGeo(L, H, w, flat = 0, lip = 0.1, shape = 'sin') {
  const g2 = GAP / 2, pts = [[g2, g2], [L - g2, g2], [L - g2, lip]];
  const n = 16;
  for (let i = 1; i < n; i++) {
    const t = shape === 'ell' ? 1 - Math.cos((i / n) * Math.PI / 2) : i / n;
    const u = L - g2 - t * (L - g2 - flat - g2);
    pts.push([u, curveY(u, L, H - g2, flat, lip, shape)]);
  }
  pts.push([flat + g2, H - g2], [g2, H - g2]);
  return extrudeProfile(`curve:${L}:${H}:${w}:${flat}:${lip}:${shape}`, pts, w);
}

// Inverted slope (underside ramps in) — used on bumpers.
export function invSlopeGeo(L, H, w) {
  const g2 = GAP / 2;
  return extrudeProfile(`inv:${L}:${H}:${w}`, [[g2, H * 0.55], [L - g2, H * 0.08 + 0.05], [L - g2, H - g2], [g2, H - g2]], w);
}

// Arbitrary flat panel: polygon in (x,y) extruded along z by thickness t, centred on its bbox.
export function panelGeo(key, pts, t) {
  return cached(`panel:${key}`, () => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z);
    return toCreasedNormals(g, 0.5);
  });
}

// Moulded roof shell: arch across z (half-width hw, crown height h over the eaves), extruded along x by length L.
export function roofGeo(L, hw, h, t = 0.36) {
  return cached(`roof:${L}:${hw}:${h}`, () => {
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) { const u = -1 + (2 * i) / n; const y = h * (1 - Math.pow(Math.abs(u), 3.2)); pts.push([u * hw, y]); }
    for (let i = n; i >= 0; i--) { const u = -1 + (2 * i) / n; const y = Math.max(0, h * (1 - Math.pow(Math.abs(u), 3.2)) - t); pts.push([u * (hw - 0.12), Math.min(y, h - t)]); }
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -L / 2); g.rotateY(Math.PI / 2);
    return toCreasedNormals(g, 0.6);
  });
}

// Sloped windscreen: a thin shell whose bottom edge is at u=0 (low) rising to u=L (high), width w.
export function screenGeo(L, rise, w, t = 0.12) {
  return cached(`screen:${L}:${rise}:${w}`, () => {
    const len = Math.hypot(L, rise), ang = Math.atan2(rise, L);
    const g = new RoundedBoxGeometry(len, t, w - GAP, 1, 0.03);
    g.rotateZ(ang);
    return g;
  });
}

export function cylGeo(r, h, seg = 24) {
  return cached(`cyl:${r}:${h}:${seg}`, () => {
    const c = 0.02;
    const pts = [[0, -h / 2], [r - c, -h / 2], [r, -h / 2 + c], [r, h / 2 - c], [r - c, h / 2], [0, h / 2]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, seg);
  });
}

// Tyre: axis along z. Radius R, inner r, width w.
export function tyreGeo(R, r, w) {
  return cached(`tyre:${R}:${r}:${w}`, () => {
    const pts = [];
    const n = 10;
    pts.push(new THREE.Vector2(r, -w / 2));
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; pts.push(new THREE.Vector2(R - 0.12 + Math.cos(a) * 0.12, Math.sin(a) * (w / 2))); }
    pts.push(new THREE.Vector2(r, w / 2));
    // tread profile: mostly flat, rounded shoulders
    const shaped = [new THREE.Vector2(r, -w / 2), new THREE.Vector2(R - 0.1, -w / 2), new THREE.Vector2(R - 0.02, -w / 2 + 0.06), new THREE.Vector2(R, -w / 2 + 0.16),
      new THREE.Vector2(R, w / 2 - 0.16), new THREE.Vector2(R - 0.02, w / 2 - 0.06), new THREE.Vector2(R - 0.1, w / 2), new THREE.Vector2(r, w / 2)];
    const g = new THREE.LatheGeometry(shaped, 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

// Rim face: disc ring + 5 twin spokes + hub. Axis along z, face toward +z. Returns {ring, spokes}.
export function rimGeos(R) {
  return cached(`rim:${R}`, () => {
    const ring = new THREE.LatheGeometry([[R * 0.86, -0.16], [R, -0.16], [R, 0.03], [R * 0.95, 0.06], [R * 0.86, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
    ring.rotateX(Math.PI / 2);
    const parts = [];
    for (let i = 0; i < 5; i++) {
      for (const off of [-0.075, 0.075]) {
        const b = new THREE.BoxGeometry(0.09, R * 0.72, 0.1);
        b.translate(off, R * 0.47, 0.0);
        b.rotateZ(i * Math.PI * 2 / 5 + off * 0.9);
        parts.push(b);
      }
    }
    const back = new THREE.CylinderGeometry(R * 0.87, R * 0.87, 0.1, 36); back.rotateX(Math.PI / 2); back.translate(0, 0, -0.12);
    parts.push(back);
    const hub = new THREE.CylinderGeometry(R * 0.18, R * 0.2, 0.16, 20); hub.rotateX(Math.PI / 2); hub.translate(0, 0, 0.02);
    return { ring, spokes: mergeGeometries(parts.map(p => ni(p))), hub };
  });
}

// ---------- Minifigure parts (real proportions: ~5 studs tall incl. hair) ----------
export const FIG = {
  hipH: 0.34, legH: 1.24, torsoH: 1.5, torsoWb: 1.95, torsoWt: 1.5, torsoD: 0.94,
  headR: 0.58, headH: 1.05, neckH: 0.12, legW: 0.94, legD: 0.94,
};

export function torsoGeo() {
  return cached('torso', () => {
    const { torsoH: h, torsoWb: wb, torsoWt: wt, torsoD: d } = FIG;
    const g = new THREE.BoxGeometry(1, h, d, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i);
      const w = y > 0 ? wt : wb;
      p.setX(i, x * w);
    }
    g.computeVertexNormals();
    // front face UVs are 0..1 by default on BoxGeometry groups — group 4 is +z (front)
    return g;
  });
}

export function headGeo() {
  return cached('head', () => {
    const { headR: r, headH: h } = FIG;
    const c = 0.16;
    const pts = [[0, -h / 2], [r - c, -h / 2]];
    for (let i = 1; i <= 5; i++) { const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2); pts.push([r - c + Math.cos(a) * c, -h / 2 + c + Math.sin(a) * c]); }
    for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); pts.push([r - c + Math.cos(a) * c, h / 2 - c + Math.sin(a) * c]); }
    pts.push([0, h / 2]);
    return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36);
  });
}

export function legGeo() {
  return cached('leg', () => {
    const { legH: h, legW: w, legD: d } = FIG;
    const leg = new RoundedBoxGeometry(w - 0.03, h, d, 2, 0.05);
    leg.translate(0, -h / 2, 0);
    const foot = new RoundedBoxGeometry(w - 0.03, 0.34, 0.22, 2, 0.05);
    foot.translate(0, -h + 0.17, d / 2 + 0.08);
    return mergeGeometries([ni(leg), ni(foot)]);
  });
}

// Leg split for printed shorts: upper (shorts colour), lower (skin), foot (shoe).
export function legGeos() {
  return cached('legs3', () => {
    const { legH: h, legW: w, legD: d } = FIG;
    const up = new RoundedBoxGeometry(w - 0.03, h * 0.5, d, 2, 0.05); up.translate(0, -h * 0.25, 0);
    const lo = new RoundedBoxGeometry(w - 0.1, h * 0.28, d - 0.08, 2, 0.04); lo.translate(0, -h * 0.64, 0);
    const shoe = new RoundedBoxGeometry(w - 0.03, h * 0.22, d, 2, 0.05); shoe.translate(0, -h * 0.89, 0);
    const toe = new RoundedBoxGeometry(w - 0.03, 0.3, 0.22, 2, 0.05); toe.translate(0, -h + 0.15, d / 2 + 0.08);
    return { upper: up, lower: lo, foot: mergeGeometries([ni(shoe), ni(toe)]) };
  });
}

export function hipGeo() {
  return cached('hip', () => {
    const g = new RoundedBoxGeometry(FIG.torsoWb - 0.02, FIG.hipH, FIG.legD, 2, 0.04);
    return g;
  });
}

// Arm: from the shoulder pivot (origin) down and slightly forward. Two pieces so the sleeve can be black.
export function armGeos() {
  return cached('arm', () => {
    const sleeve = new RoundedBoxGeometry(0.5, 0.5, 0.56, 2, 0.12); sleeve.translate(0, -0.2, 0);
    const fore = new RoundedBoxGeometry(0.44, 0.62, 0.5, 2, 0.12); fore.rotateX(-0.35); fore.translate(0, -0.66, 0.1);
    const wrist = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12); wrist.translate(0, -1.02, 0.2);
    const hand = new THREE.TorusGeometry(0.17, 0.085, 10, 18, Math.PI * 1.55); hand.rotateY(Math.PI / 2); hand.rotateX(-0.5); hand.translate(0, -1.2, 0.26);
    return { sleeve, fore: mergeGeometries([ni(fore), ni(wrist)]), hand };
  });
}

// Molded hair piece: ONE continuous plastic shell (like a real LEGO hair element), not a pile of balls.
// Ellipsoid cap over the head, cut at a hairline that sits high at the front, drops to the ears and low at the nape;
// sculpted curl relief (max of soft bumps → crisp creases between curls), an optional scalloped fringe, and a
// moulded lip at the hairline so the edge reads as a thick plastic rim.
// o: { R, vol, cy, cz, front, side, back, fringe, fringeDepth, curl, cr, n, seed, part }
export function moldedHair(o) {
  return cached('mh:' + JSON.stringify(o), () => {
    let sd = o.seed || 11; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const { R, vol, cy = 0.08, cz = -0.03 } = o;
    const C = [];
    for (let i = 0; i < o.n; i++) {
      const y = 1 - ((i + 0.5) / o.n) * 2, rad = Math.sqrt(1 - y * y), a = i * 2.39996 + r() * 0.6;
      C.push(new THREE.Vector3(Math.cos(a) * rad + (r() - 0.5) * 0.1, y + (r() - 0.5) * 0.1, Math.sin(a) * rad + (r() - 0.5) * 0.1).normalize());
    }
    const hairline = (th) => {
      const c = Math.cos(th);
      let y = c > 0 ? o.side + (o.front - o.side) * Math.pow(c, 1.3) : o.side + (o.back - o.side) * Math.pow(-c, 1.1);
      if (o.fringe) y -= o.fringeDepth * Math.pow(Math.max(0, c), 3) * (0.5 + 0.5 * Math.cos(th * o.fringe));
      if (o.part) y += o.part * Math.exp(-Math.pow((th - 0.55) / 0.12, 2));      // side-part notch
      return y;
    };
    const NT = 144, NS = 52, cr2 = o.cr * o.cr;
    const pos = [];
    const e = o.e ?? 1;                                                              // superellipse squareness (<1 = boxier, hugs a cylinder)
    const sp = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
    const P = (th, s, shrink) => {
      const yl = Math.max(-0.97, Math.min(0.97, (hairline(th) - cy) / (R * vol)));
      const cmax = Math.sign(yl) * Math.pow(Math.abs(yl), 1 / e);
      const ph = s * Math.acos(cmax);
      const d = new THREE.Vector3(sp(Math.sin(ph)) * Math.sin(th), sp(Math.cos(ph)), sp(Math.sin(ph)) * Math.cos(th));
      let b = 0;
      const du = d.clone().normalize();
      if (!shrink && o.curl) for (const c of C) { const dd = du.distanceToSquared(c); if (dd < cr2) { const w = 1 - dd / cr2; if (w * w > b) b = w * w; } }
      const edge = Math.min(1, (1 - s) / 0.1);                                        // relief fades into a clean rim
      const rr = shrink ? R * shrink : R * (1 + o.curl * b * (0.35 + 0.65 * edge));
      return [d.x * rr, cy + d.y * rr * vol, cz + d.z * rr];
    };
    for (let j = 0; j <= NS; j++) for (let i = 0; i < NT; i++) pos.push(...P((i / NT) * Math.PI * 2, j / NS));          // outer
    for (let i = 0; i < NT; i++) { const q = P((i / NT) * Math.PI * 2, 1); const k = 1 - 0.1 / Math.hypot(q[0], q[2] - cz); pos.push(q[0] * k, q[1] + 0.02, cz + (q[2] - cz) * k); }   // lip
    for (let j = NS; j >= 0; j--) for (let i = 0; i < NT; i++) pos.push(...P((i / NT) * Math.PI * 2, j / NS, 0.86));   // inner
    const idx = [];
    const rows = 2 * (NS + 1) + 1;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < NT; i++) {
      const a = j * NT + i, b = j * NT + (i + 1) % NT, c = (j + 1) * NT + i, d = (j + 1) * NT + (i + 1) % NT;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
}

// legacy ball-cluster hair (unused)
export function hairGeo(rng) {
  return cached('hair', () => {
    const lumps = [];
    const R = FIG.headR;
    const add = (x, y, z, r) => { const s = new THREE.IcosahedronGeometry(r, 2); s.translate(x, y, z); lumps.push(s); };
    for (let i = 0; i < 12; i++) add(Math.sin(i) * 0.5, 0.4, Math.cos(i) * 0.5, 0.3);
    const g = mergeGeometries(lumps.map(l => ni(l)));
    g.scale(R / 0.58, 1, R / 0.58);
    return g;
  });
}
