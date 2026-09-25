// Brick-built cars. Car-local space: +x = forward, +z = the car's right side, y up, ground at y = 0.
import * as THREE from 'three';
import * as G from './parts.js';
import { Vox } from './vox.js';
// palette used by the builders; override COL.taycan (body colour) before calling buildTaycan
export const COL = { taycan: '#526275', black: '#1c1e22', silver: '#c7cbd0', amber: '#f08a24', gold: '#c9a24a', dkgrey: '#565b62', white: '#f1f1ec' };
const { PL } = G;

export const TAY = {
  xF: 5.5, xR: -5.5, R: 1.15, wz: 3.45, wW: 0.95,        // axles, wheel radius, wheel track (centre z), width
  seat: { x: -1.45, y: 0.95, z: -2.0 },                   // driver hip pivot (car's left = −z)
  wheel: { x: 0.45, y: 2.4, z: -2.0 },
};

// ---------------- sports car (built for a Taycan), 8 wide × 18 long ----------------
// groups: <id> (body), <id>.roof (greenhouse — lifts off), <id>.wFL/wFR/wRL/wRR (wheels, origin at wheel centre)
// Side profile: sill 0.4, beltline 2.8, fender domes 3.2, roof crown 4.4, fastback to a ducktail at 3.2.
export function buildTaycan(M, id = 'tay') {
  const body = { c: COL.taycan, top: 'tile' }, blk = { c: COL.black, top: 'tile' };
  const V = new Vox({ lp: 1, origin: [0, 0, 0], group: id });
  const { xF, xR } = TAY;
  for (let ix = -9; ix < 9; ix++) for (let iz = -4; iz < 4; iz++) {
    const cx = ix + 0.5, cz = iz + 0.5, az = Math.abs(cz);
    const arch = az > 2.9 && (Math.abs(cx - xF) < 1.2 || Math.abs(cx - xR) < 1.2);
    const front = cx > 8, rear = cx < -8;
    for (let iy = 1; iy <= 7; iy++) {
      let s = null;
      if (arch && iy <= 5) s = null;
      else if (iy === 1) s = Math.abs(cx) < 8.6 || az < 3.5 ? blk : null;              // floor pan, sills, front lip, diffuser
      else if (front && iy === 2) s = az < 2.5 ? null : az > 3 ? blk : body;            // recessed lower intake + corner slits
      else if (front && iy === 3) s = az > 3 ? blk : body;                              // air-curtain slits at the corners
      else if (rear && iy === 2) s = az < 3 ? blk : body;                                // diffuser
      else if (iy === 4) s = cx > 5 && az < 2 ? null : cx > 7 ? null : body;            // under the hood + fender-nose curves
      else if (iy <= 3) s = body;
      else if (iy <= 6) {
        if (az < 2) s = cx < 5 ? body : null;                                            // hood centre drops under its curve
        else s = cx < 7 ? body : null;                                                   // fender front drops under its curve
        if (iy === 5 && cx > 5 && az < 2) s = null;
      } else if (iy === 7) {
        if (cx < -7) s = body;                                                           // ducktail
      }
      if (s && iy >= 2 && az < 3 && cx > -4.6 && cx < 2.6) s = null;                    // hollow cabin
      if (s) V.set(ix, iy, iz, s);
    }
  }
  // cabin furniture: dashboard, seat backs, rear bench
  V.fill(2, 3, 2, 7, -3, 3, blk);
  V.fill(-3, -2, 2, 8, -3, -1, blk); V.fill(-3, -2, 2, 8, 1, 3, blk);
  V.fill(-5, -3, 2, 5, -3, 3, blk);
  V.emit(M);

  const add = (o) => M.add({ group: id, ...o });
  // hood: one long curve from the cowl (2.8) down to the nose (2.0)
  add({ geo: G.curveGeo(4, 1.2, 4, 0.6, 0.1, 'ell'), color: COL.taycan, pos: [7, 1.6 + 0.6, 0], conn: 8 });
  for (const sz of [-1, 1]) {
    add({ geo: G.curveGeo(4, 0.4, 2, 1.4, 0.04), color: COL.taycan, pos: [5, 2.8 + 0.2, sz * 3], conn: 4 });   // fender dome 3.2 → 2.8
    add({ geo: G.curveGeo(2, 1.2, 2, 0, 0.1, 'ell'), color: COL.taycan, pos: [8, 1.6 + 0.6, sz * 3], conn: 2 });   // fender nose 2.8 → 1.6, rounded
    // 4-point LED headlight, flush on the rounded fender nose
    const u = 1.45, hx = 7 + u, hy = 1.6 + G.curveY(u, 2, 1.2, 0, 0.1, 'ell');
    const du = 0.02, ang = Math.atan2(G.curveY(u + du, 2, 1.2, 0, 0.1, 'ell') - G.curveY(u - du, 2, 1.2, 0, 0.1, 'ell'), 2 * du);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    add({ geo: G.boxGeo(0.8, 0.05, 1.6), mat: 'glass', color: '#0e1219', pos: [hx + nx * 0.02, hy + ny * 0.02, sz * 2.95], rot: [0, 0, ang], conn: 1 });
    for (const [dv, dz] of [[-0.17, -0.34], [-0.17, 0.34], [0.17, -0.34], [0.17, 0.34]])
      add({ geo: G.boxGeo(0.1, 0.05, 0.46), mat: 'lightW', color: '#ffffff', pos: [hx + nx * 0.05 + Math.cos(ang) * dv, hy + ny * 0.05 + Math.sin(ang) * dv, sz * 2.95 + dz], rot: [0, 0, ang], conn: 0 });
    add({ geo: G.boxGeo(0.55, 0.16, 0.06), mat: 'glass', color: COL.amber, pos: [7.3, 1.95, sz * 4.02], conn: 1 });   // side marker
    // mirror on a black arm
    add({ geo: G.boxGeo(0.35, 0.2, 0.45), color: COL.black, pos: [2.95, 2.9, sz * 4.1], conn: 1 });
    add({ geo: G.curveGeo(0.8, 0.42, 0.72, 0, 0.12), color: COL.taycan, pos: [2.9, 3.2, sz * 4.45], rot: [0, Math.PI, 0], conn: 1 });
  }
  // recessed intake: black grille set back behind the bumper face, with two slats
  add({ geo: G.boxGeo(0.25, 0.4, 5.0), color: COL.black, pos: [8.35, 1.0, 0], conn: 2 });
  for (const y of [0.9, 1.1]) add({ geo: G.boxGeo(0.12, 0.05, 4.9), color: '#2c2f35', pos: [8.55, y, 0], conn: 0 });
  add({ geo: G.cylGeo(0.2, 0.05, 18), color: COL.gold, pos: [8.4, 1.6 + G.curveY(3.4, 4, 1.2, 0.6, 0.1, 'ell') + 0.03, 0], rot: [0, 0, -0.95], conn: 1 });    // crest
  add({ geo: G.boxGeo(0.1, 0.34, 7.7), mat: 'lightR', color: '#b3140e', pos: [-9.03, 2.62, 0], conn: 2 });     // light bar
  // steering wheel + column
  const sw = new THREE.TorusGeometry(0.36, 0.07, 10, 24); sw.rotateY(Math.PI / 2);
  add({ geo: sw, color: COL.black, pos: [TAY.wheel.x, TAY.wheel.y, TAY.wheel.z], rot: [0, 0, -0.45], conn: 1 });
  add({ geo: G.cylGeo(0.09, 1.9, 8), color: COL.black, pos: [TAY.wheel.x + 0.85, TAY.wheel.y + 0.12, TAY.wheel.z], rot: [0, 0, 1.3], conn: 1 });

  // greenhouse — its own group so it can lift off like a Speed Champions roof
  const rg = id + '.roof';
  const radd = (o) => M.add({ group: rg, ...o });
  radd({ geo: G.screenGeo(3.2, 1.5, 6.2), mat: 'glass', color: '#161b24', pos: [1.8, 3.55, 0], rot: [0, Math.PI, 0], conn: 2 });
  radd({ geo: G.screenGeo(4.0, 1.05, 6.0), mat: 'glass', color: '#161b24', pos: [-5.2, 3.72, 0], conn: 2 });
  radd({ geo: G.roofGeo(3.6, 3.25, 0.52, 0.34), color: COL.taycan, pos: [-1.5, 3.88, 0], conn: 6 });
  const dlo = [[3.35, 2.85], [0.3, 4.18], [-3.2, 4.2], [-7.1, 3.22], [-7.1, 2.85]];
  const side = G.panelGeo('tay-dlo', dlo, 0.1);
  for (const sz of [-1, 1]) {
    radd({ geo: side, mat: 'glass', color: '#161b24', pos: [-1.875, 3.525, sz * 3.1], conn: 2 });
    radd({ geo: G.boxGeo(3.55, 0.16, 0.18), color: COL.black, pos: [1.8, 3.55, sz * 3.16], rot: [0, 0, -Math.atan2(1.5, 3.2)], conn: 1 });   // A-pillar
    radd({ geo: G.boxGeo(0.3, 1.3, 0.16), color: COL.black, pos: [-1.2, 3.52, sz * 3.17], conn: 1 });                                     // B-pillar
  }

  // wheels — one group each, parts at the group origin (wheel centre)
  for (const [n, x, sz] of [['FL', xF, -1], ['FR', xF, 1], ['RL', xR, -1], ['RR', xR, 1]]) wheelParts(M, `${id}.w${n}`, sz, COL.silver, COL.black);
}

export function wheelParts(M, group, sz, ringCol, spokeCol, R = TAY.R, W = TAY.wW) {
  const flip = sz < 0 ? Math.PI : 0;
  const rim = G.rimGeos(R * 0.74);
  M.add({ geo: G.tyreGeo(R, R * 0.7, W), color: '#141518', pos: [0, 0, 0], group, conn: 1, tag: 'tyre' });
  M.add({ geo: rim.ring, color: ringCol, pos: [0, 0, sz * (W / 2 - 0.04)], rot: [0, flip, 0], group, conn: 0 });
  M.add({ geo: rim.spokes, color: spokeCol, pos: [0, 0, sz * (W / 2 - 0.1)], rot: [0, flip, 0], group, conn: 1 });
  M.add({ geo: rim.hub, color: '#b9bec4', pos: [0, 0, sz * (W / 2 - 0.1)], rot: [0, flip, 0], group, conn: 0 });
}

// ---------------- generic parked car (Cayenne, 911s) ----------------
// o: { id, L, W, R, fo, ro, belt, nose, cowlX, roofF, roofR, roofY, tailX, tailY, color, rim, spoke, lights: 'round'|'bar' }
export function buildParked(M, o) {
  const body = { c: o.color, top: 'tile' }, blk = { c: COL.black, top: 'tile' };
  const V = new Vox({ lp: 1, origin: [0, 0, 0], group: o.id });
  const hl = o.L / 2, hw = o.W / 2;
  const xF = hl - o.fo, xR = -hl + o.ro;
  const beltL = Math.round(o.belt / PL), noseL = Math.round(o.nose / PL);
  for (let ix = -hl; ix < hl; ix++) for (let iz = -hw; iz < hw; iz++) {
    const cx = ix + 0.5, cz = iz + 0.5, az = Math.abs(cz);
    const arch = az > hw - 1.1 && (Math.abs(cx - xF) < 1.2 || Math.abs(cx - xR) < 1.2);
    const top = cx > hl - 2 ? noseL : beltL;
    for (let iy = 1; iy <= top; iy++) {
      if (arch && iy * PL < o.R * 2 + 0.2) continue;
      let s = iy === 1 ? blk : body;
      if (cx > hl - 1 && iy === 2 && az < hw - 1.5) s = blk;       // grille
      if (cx < -hl + 1 && iy === 2) s = blk;                        // rear valance
      V.set(ix, iy, iz, s);
    }
  }
  V.emit(M);
  const g = o.id, add = (p) => M.add({ group: g, ...p });
  const nH = o.belt - o.nose;
  add({ geo: G.curveGeo(2, nH, o.W, 0, 0.1, 'ell'), color: o.color, pos: [hl - 1, o.nose + nH / 2, 0], conn: o.W });
  // greenhouse
  const gw = o.W - 1.4;
  const glass = { mat: 'glass', color: '#161b24' };
  add({ geo: G.screenGeo(o.cowlX - o.roofF, o.roofY - o.belt, gw), ...glass, pos: [(o.cowlX + o.roofF) / 2, (o.roofY + o.belt) / 2, 0], rot: [0, Math.PI, 0], conn: 2 });
  add({ geo: G.screenGeo(o.roofR - o.tailX, o.roofY - o.tailY, gw), ...glass, pos: [(o.roofR + o.tailX) / 2, (o.roofY + o.tailY) / 2, 0], conn: 2 });
  add({ geo: G.roofGeo(o.roofF - o.roofR + 0.2, gw / 2 + 0.15, 0.42, 0.3), color: o.color, pos: [(o.roofF + o.roofR) / 2, o.roofY - 0.4, 0], conn: 4 });
  if (o.tailY > o.belt + 0.2) {   // SUV: tailgate panel behind the rear glass
    add({ geo: G.boxGeo(hl + o.tailX + 0.02, o.tailY - o.belt, o.W - 0.4), color: o.color, pos: [(-hl + o.tailX) / 2, (o.tailY + o.belt) / 2, 0], conn: 2 });
  }
  const dlo = [[o.cowlX - 0.05, o.belt + 0.04], [o.roofF, o.roofY - 0.06], [o.roofR, o.roofY - 0.06], [o.tailX + 0.05, o.tailY], [o.tailX + 0.05, o.belt + 0.04]];
  const side = G.panelGeo(o.id + '-dlo', dlo, 0.1);
  const bx = (Math.max(...dlo.map(p => p[0])) + Math.min(...dlo.map(p => p[0]))) / 2, by = (Math.max(...dlo.map(p => p[1])) + Math.min(...dlo.map(p => p[1]))) / 2;
  for (const sz of [-1, 1]) {
    add({ geo: side, ...glass, pos: [bx, by, sz * (gw / 2 + 0.02)], conn: 2 });
    add({ geo: G.boxGeo(0.3, o.roofY - o.belt - 0.1, 0.14), color: COL.black, pos: [(o.roofF + o.roofR) / 2 + 0.3, (o.roofY + o.belt) / 2, sz * (gw / 2 + 0.06)], conn: 1 });
    if (o.lights === 'round') {
      const u = 0.9, y = o.nose + G.curveY(u, 2, nH, 0, 0.1, 'ell');
      add({ geo: G.cylGeo(0.45, 0.16, 24), mat: 'lightW', color: '#ffffff', pos: [hl - 2 + u, y + 0.04, sz * (hw - 1.2)], rot: [0, 0, -0.55], conn: 1 });
    } else {
      add({ geo: G.boxGeo(0.12, 0.26, 1.7), mat: 'lightW', color: '#ffffff', pos: [hl + 0.01, o.nose - 0.3, sz * (hw - 1.15)], conn: 1 });
    }
    add({ geo: G.boxGeo(0.5, 0.26, 0.5), color: o.color, pos: [o.cowlX - 0.5, o.belt + 0.3, sz * (hw + 0.2)], conn: 1 });   // mirror
  }
  add({ geo: G.boxGeo(0.1, 0.3, o.W - 0.6), mat: 'lightR', color: '#b3140e', pos: [-hl - 0.02, o.belt - 0.35, 0], conn: 2 });
  for (const [x, sz] of [[xF, -1], [xF, 1], [xR, -1], [xR, 1]]) {
    const wg = `${o.id}.w${x > 0 ? 'F' : 'R'}${sz < 0 ? 'L' : 'R'}`;
    wheelParts(M, wg, sz, o.rim, o.spoke || o.rim, o.R, 0.9);
    M.groupsStatic = M.groupsStatic || {};
    M.groupsStatic[wg] = { parent: o.id, pos: [x, o.R, sz * (hw - 0.55)] };
  }
}
