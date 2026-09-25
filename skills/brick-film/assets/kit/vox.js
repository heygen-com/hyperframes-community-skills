// Model (a flat list of LEGO parts) + Vox (voxels → real brick sizes). Units: studs; y up; plate = 0.4.
import * as THREE from 'three';
import * as G from './parts.js';
const { PL } = G;

// seeded rng — everything procedural is deterministic
export function rng(seed) { let s = seed >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A small LEGO-ish palette (sRGB). Scenes add their own sampled colours freely.
export const LEGO = {
  white: '#f2f2ee', black: '#1c1e22', ltgrey: '#a6abb0', dkgrey: '#5b6068', red: '#c4281c', blue: '#1e5aa8',
  yellow: '#f2cd37', green: '#237841', bright: '#4b9f4a', tan: '#e4cd9e', dktan: '#958a73', brown: '#582a12',
  dkbrown: '#352100', nougat: '#e7b18a', ltnougat: '#f0c9a8', orange: '#fe8a18', sand: '#a0bcac', trans: '#dfe8ee',
};

export class Model {
  constructor(seed = 7279) { this.parts = []; this.r = rng(seed); this.staticMats = {}; this.groupsStatic = {}; }

  // Generic part. pos = centre in group space. studs = offsets from centre (part-local).
  add({ geo, mat = 'plastic', color, pos, rot = [0, 0, 0], group = 'static', studs = [], tier = 1, conn = 1, box = null, tag = '', land = null, noCount = false }) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const p = { geo, mat, color, local: m, pos: new THREE.Vector3(...pos), group, studs, tier, conn, box, tag, landFixed: land, noCount, bottom: box ? pos[1] - box.h / 2 : pos[1] };
    this.parts.push(p);
    return p;
  }

  // Rectangular brick / plate / tile, min corner at (x, y, z); w along x, d along z, h in plates.
  brick(x, y, z, w, d, hPl, color, o = {}) {
    const h = hPl * PL;
    const cx = x + w / 2, cy = y + h / 2, cz = z + d / 2;
    const studs = [], tops = [];                 // tops = every stud position (for connection counting), studs = the ones drawn
    if (o.top !== 'tile' && o.mat !== 'glass' && o.mat !== 'glassLt') {
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
        const s = [x + i + 0.5 - cx, h / 2, z + j + 0.5 - cz];
        tops.push(s);
        if (!o.studMask || o.studMask(i, j)) studs.push(s);
      }
    }
    const p = this.add({ geo: G.boxGeo(w, h, d), mat: o.mat || 'plastic', color, pos: [cx, cy, cz], group: o.group || 'static', studs, tier: o.tier ?? 1, box: { x, z, w, d, h }, tag: o.tag || '', land: o.land ?? null, noCount: !!o.noCount });
    p.tops = tops;
    return p;
  }
}

// ---------- voxel → real bricks ----------
// Greedy per layer into real sizes (1×1 … 2×8), alternating scan direction per layer so seams stagger.
// A 'tile' top becomes a studded plate wherever another voxel sits on it (so connections are honest).
// opts.exposedStudsOnly: skip studs that another voxel covers (big terrain — keeps the instance count sane).
const SIZES = [[8, 2], [2, 8], [6, 2], [2, 6], [4, 2], [2, 4], [8, 1], [1, 8], [6, 1], [1, 6], [4, 1], [1, 4], [3, 2], [2, 3], [3, 1], [1, 3], [2, 2], [2, 1], [1, 2], [1, 1]];
export class Vox {
  // k = horizontal cell size in studs (k = 2 builds terrain from 2×2 columns — a quarter of the parts)
  constructor({ lp = 1, origin = [0, 0, 0], group = 'static', tier = 1, exposedStudsOnly = false, k = 1 } = {}) { Object.assign(this, { lp, o: origin, group, tier, exposedStudsOnly, cs: k }); this.cells = new Map(); }
  k(ix, iy, iz) { return ix + ',' + iy + ',' + iz; }
  set(ix, iy, iz, spec) { const k = this.k(ix, iy, iz); if (spec) this.cells.set(k, { ix, iy, iz, spec, sk: spec.c + '|' + (spec.m || '') + '|' + (spec.top || '') + '|' + (spec.tag || '') }); else this.cells.delete(k); }
  get(ix, iy, iz) { return this.cells.get(this.k(ix, iy, iz)); }
  fill(x0, x1, y0, y1, z0, z1, spec) { for (let ix = x0; ix < x1; ix++) for (let iy = y0; iy < y1; iy++) for (let iz = z0; iz < z1; iz++) this.set(ix, iy, iz, spec); }
  clear(x0, x1, y0, y1, z0, z1) { this.fill(x0, x1, y0, y1, z0, z1, null); }
  emit(M) {
    for (const c of this.cells.values()) {
      if (c.spec.top === 'tile' && this.get(c.ix, c.iy + 1, c.iz) && !c.spec.m) { c.spec = { ...c.spec, top: 'stud' }; c.sk = c.spec.c + '|' + (c.spec.m || '') + '|stud|' + (c.spec.tag || ''); }
    }
    const layers = new Map();
    for (const c of this.cells.values()) { if (!layers.has(c.iy)) layers.set(c.iy, []); layers.get(c.iy).push(c); }
    for (const [iy, cells] of layers) {
      const odd = iy % 2 !== 0, s = odd ? -1 : 1;
      cells.sort((a, b) => (a.iz - b.iz) * s || (a.ix - b.ix) * s);
      const used = new Set();
      for (const c of cells) {
        if (used.has(c)) continue;
        for (const [sa, sb] of SIZES) {
          const [a, b] = odd ? [sb, sa] : [sa, sb];
          const rect = [];
          let ok = true;
          for (let i = 0; i < a && ok; i++) for (let j = 0; j < b && ok; j++) {
            const q = this.get(c.ix + i * s, iy, c.iz + j * s);
            if (!q || used.has(q) || q.sk !== c.sk) ok = false; else rect.push(q);
          }
          if (!ok) continue;
          rect.forEach(q => used.add(q));
          const x0 = Math.min(...rect.map(q => q.ix)), z0 = Math.min(...rect.map(q => q.iz));
          const K = this.cs;
          const studMask = this.exposedStudsOnly ? (i, j) => !this.get(x0 + Math.floor(i / K), iy + 1, z0 + Math.floor(j / K)) : null;
          M.brick(this.o[0] + x0 * K, this.o[1] + iy * this.lp * PL, this.o[2] + z0 * K, a * K, b * K, this.lp, c.spec.c,
            { top: c.spec.top, mat: c.spec.m, group: this.group, tier: this.tier, tag: c.spec.tag, studMask });
          break;
        }
      }
    }
  }
}
