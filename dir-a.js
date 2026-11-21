// Direction A, "The Board": the competition-board exploded axo of a two-storey house, white ink on a black sheet.
// Seven layers land in building order, then the long lens widens, the glass door slides open and the drawing
// becomes a place: in over the terrace, through the ground floor, up the stair and under the ridge.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  THREE, Part, bx, cyl, ball, panel, M, V, D2R, clamp, lerp, ease, ease2, win,
  scene, lineMat, toneMat, segs, liveLine, eyeKey, camAt, canvasTex, ctx, ACCENT, INK, PAPER, patchFill, low,
} from './core.js';
import { oakPlanks, oakBoard, whiteBrick, latticeRug } from './tex-a.js';

// ---- the house (metres). x runs east, z south, y up. The glass front faces east onto a terrace.
const FL = 0.3, F = FL + 0.03;                                          // slab top, finished ground floor
const EH = 2.6, Y1 = FL + EH, CS = 0.2, Y2 = Y1 + CS, F2 = Y2 + 0.03;   // clear height, ceiling slab, upper floor
const KH = 1.4, PL = 0.1, YP = Y2 + KH;                                 // knee wall, wall plate
const TP = Math.tan(40 * D2R), CP = Math.cos(40 * D2R), SP = Math.sin(40 * D2R);
const XW = -5, XE = 5, ZO = 3.6, TH = 0.16, XI = XE - TH, ZI = ZO - TH;
const RISE = ZO * TP;
const UL = z => YP + PL + (ZO - Math.min(Math.abs(z), ZO)) * TP;        // underside of the rafters
const Y0 = YP + PL + RISE;                                              // that line at the ridge
const OH = 0.5, T = (ZO + OH) / CP, XR = 5.45;                          // eave overhang, rafter length, roof ends

// the stair along the west gable: 15 risers from the south landing up to the north
const SX0 = XW + TH, SX1 = SX0 + 1.0, SZ = 2.4, GO = 0.27, NR = 15, RS = (F2 - F) / NR, STOP = SZ - (NR - 1) * GO;
// the glass front: two sliding leaves between two posts, a fixed pane either side
const DW = 1.7, LINT = 0.32, YL = Y1 - LINT;
// the chimney block against the north wall and its flue
const BX0 = 0.2, BX1 = 0.8, BZ = -1.0, PIPE = [0.5, -1.3];

// openings as (a0, y0, a1, y1): metres along the wall, absolute heights
const S1 = [[1.5, FL + 0.45, 4.1, FL + 2.4], [-2.7, FL + 0.9, -0.5, FL + 2.4]];
const N1 = [[-3.4, FL + 1.1, -1.0, FL + 2.25], [3.1, FL + 0.9, 4.3, FL + 2.3]];
const W1 = [[2.5, FL + 1.0, 3.2, FL + 2.3]];
const S2 = [[-2.7, Y2 + 0.82, -0.7, Y2 + 1.26], [2.0, Y2 + 0.55, 4.0, Y2 + 1.26]];
const N2 = [[2.0, Y2 + 0.85, 4.0, Y2 + 1.26]];
const W2 = [[-0.9, Y2 + 1.0, 0.9, Y2 + 3.0]];
const E2 = [[-1.5, Y2 + 0.85, 1.5, Y2 + 2.85]];
const hole = (y) => ([a, b, c, d]) => [[a, b - y], [c, b - y], [c, d - y], [a, d - y]];

function rb(x0, y0, z0, x1, y1, z1, r = 0.04) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  // on a phone the soft corners of the cushions are a little coarser (they are a few pixels there)
  const g = new RoundedBoxGeometry(w, h, d, low && r >= 0.03 ? 3 : 4, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
// a rectangular bar from a to b whose width always stays horizontal (rails, lounger backs, handrails)
function bar(a, b, w, d) {
  const dir = b.clone().sub(a), L = dir.length(); dir.normalize();
  let ax = V(0, 1, 0).cross(dir); if (ax.lengthSq() < 1e-6) ax = V(1, 0, 0); ax.normalize();
  const ay = dir.clone().cross(ax);
  const g = new THREE.BoxGeometry(w, d, L);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(ax, ay, dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
}
const lying = (r, len, x, y, z, along = 'z', seg = 14) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (along === 'z') g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
  g.translate(x, y, z); return g;
};
// a piece of one roof slope between x0 and x1: w0..w1 above the rafter line, cut plumb at z0, square at the eave
function slope(side, x0, x1, w0, w1, z0, tEnd) {
  const pts = [[z0, Y0 + w0 / CP - z0 * TP], [w0 * SP + tEnd * CP, Y0 + w0 * CP - tEnd * SP], [w1 * SP + tEnd * CP, Y0 + w1 * CP - tEnd * SP], [z0, Y0 + w1 / CP - z0 * TP]];
  return panel(pts.map(([z, y]) => [side * z, y]), [], x1 - x0).applyMatrix4(M.alongZ(x1, 0));
}

export async function build(labels, dims) {
  const dk = lineMat({ w: 0.95, color: '#a9d2f2', opacity: 0.9 });       // the tint line for the light things
  const light = { line: dk, hullColor: '#a9d2f2' };
  // every material has its drawn tone and, after "real", the surface it has when the house comes alive: warm
  // oiled oak boards on the floors, the ceilings and all round the outside, white plaster and white painted brick
  // inside, white joinery, a cream rug with a black lattice, light zinc on top, warm lamps
  const swayLine = lineMat({ w: 0.9, sway: 0.016 });
  const TX = { planks: oakPlanks(), pale: oakPlanks({ seed: 7, base: [224, 195, 152], seams: 0.3 }), deck: oakPlanks({ seed: 11, w: 0.14, tile: 2.24, base: [196, 154, 102], seams: 0.6 }), board: oakBoard(), brick: whiteBrick(), rug: latticeRug() };
  const wood = (t, m, o = {}) => ({ real: '#ffffff', realMap: t, mapM: m, realTex: 0, ...o });
  const PAL = {
    wall: { mat: toneMat('#26262a', { mode: 0, scale: 1.0, tex: 1.6, real: '#f3f0e9', realMode: 0, realTex: 1.0 }) },
    ceil: { mat: toneMat('#2c2c30', { mode: 1, scale: 0.9, tex: 1.4, ...wood(TX.pale, 2.28) }) },
    floor: { mat: toneMat('#3f3b37', { mode: 1, scale: 1.2, ...wood(TX.planks, 2.28) }) },
    deck: { mat: toneMat('#2a2826', { mode: 1, scale: 1.8, ...wood(TX.deck, 2.24, { mapRot: 1 }) }) },
    pool: { mat: toneMat('#8a8178', { mode: 0, opacity: 0.22, tex: 0, real: '#c5dadf', realOp: 0.16 }), edges: false },
    firepool: { mat: toneMat('#c02a2a', { mode: 0, opacity: 0.11, tex: 0, real: '#e0c398', realOp: 0.14 }), edges: false },
    oak: { mat: toneMat('#57514b', { mode: 1, scale: 1.6, ...wood(TX.board, 0.9) }) },
    concrete: { mat: toneMat('#58585d', { mode: 2, scale: 1.0, tex: 1.8, real: '#ece8df', realTex: 1.0 }) },
    brick: { mat: toneMat('#58585d', { mode: 2, scale: 1.0, tex: 1.8, ...wood(TX.brick, 1.2) }) },
    glass: { mat: toneMat('#e6ecf0', { opacity: 0.085, mode: 5, real: '#c5dadf', realOp: 0.34 }) },
    clad: { mat: toneMat('#161618', { mode: 1, scale: 2.2, tex: 3.2, ...wood(TX.board, 1.2) }), w: 'thin' },
    seam: { mat: toneMat('#1c1c1f', { mode: 3, scale: 1.5, tex: 3.0, real: '#5f6a73', realTex: 1.6 }), w: 'thin' },
    under: { mat: toneMat('#34343a', { mode: 1, scale: 1.0, tex: 1.6, ...wood(TX.pale, 2.28) }) },
    rafter: { mat: toneMat('#6a645d', { mode: 1, scale: 2.0, ...wood(TX.board, 1.2, { real: '#e0c398', mapRot: 1 }) }), w: 'mid' },
    steel: { mat: toneMat('#2b2b30', { mode: 3, scale: 2.0, real: '#2d3033' }), w: 'thin' },
    pipe: { mat: toneMat('#222226', { mode: 3, scale: 2.0, real: '#2d3033' }), w: 'thin', hull: 1 },
    rod: { mat: toneMat('#3a3a40', { mode: 3, scale: 2.0, tex: 1, real: '#4b5257' }), edges: false, hull: 0.8 },
    kfront: { mat: toneMat('#19191c', { mode: 0, scale: 1.0, tex: 1.2, real: '#f3f0e9', realTex: 0.6 }) },
    bright: { mat: toneMat('#e7e4df', { mode: 0, tex: 0.9, real: '#f3f0e9', realMode: 2, realTex: 0.6 }), ...light },
    leaf: { mat: toneMat('#2b2f2c', { side: THREE.DoubleSide, mode: 0, real: '#8fa46f', sway: 0.016 }), line: swayLine, thr: 20 },
    frame: { mat: toneMat('#17171a', { mode: 1, scale: 2.0, real: '#2d3033' }) },
    redframe: { mat: toneMat('#b8914a', { mode: 3, scale: 2.0, tex: 1.2, real: '#c9973a' }) },
    rug: { mat: toneMat('#4b4b51', { mode: 4, scale: 1.0, tex: 1.8, ...wood(TX.rug, 1.2, { realTex: 0.8 }) }) },
    soft: { mat: toneMat('#dcd9d3', { mode: 4, scale: 1.0, tex: 0.9, real: '#e9e2d2' }), hull: 1, ...light },
    cushion: { mat: toneMat('#e2dfd9', { mode: 4, scale: 1.4, tex: 0.9, real: '#e9e2d2' }), hull: 1, thr: 50, ...light },
    rouge: { mat: toneMat('#7c8a73', { mode: 4, scale: 1.4, tex: 1.3, real: '#9aaa90' }), hull: 1, thr: 50, ...light },
    shade: { mat: toneMat('#fff3e2', { mode: 4, scale: 1.5, tex: 0.5, glow: '#262019', real: '#f3f0e9', realGlow: '#8a6a2a' }), hull: 1, ...light },
    ember: { mat: toneMat('#d9a443', { mode: 0, tex: 0, glow: '#2a1f08', real: '#c9973a', realGlow: '#a87a22' }), edges: false },
    book1: { mat: toneMat('#b08a58', { mode: 0, tex: 1, real: '#c49a66' }), w: 'thin' },
    book2: { mat: toneMat('#e7e4df', { mode: 0, tex: 1, real: '#f3f0e9' }), w: 'thin', ...light },
    book3: { mat: toneMat('#6c6c72', { mode: 0, tex: 1, real: '#9aaa90' }), w: 'thin' },
  };
  const flameMat = toneMat('#e0b050', { mode: 0, tex: 0, glow: '#2a1f08', side: THREE.DoubleSide, opacity: 0.92, real: '#e0c398', realGlow: '#c9973a' });
  const hatchMat = lineMat({ w: 0.6, color: '#a9d2f2', opacity: 0.5 });
  const dashMat = lineMat({ w: 0.9, color: INK, dashed: true, dash: 0.22, gap: 0.2, opacity: 0.7 });

  // ---- the plan the house stands on
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(24, 16).rotateX(-Math.PI / 2), patchFill(new THREE.MeshBasicMaterial({ map: drawPlan() }), { wash: false, grain: 0, grade: false, ground: true, island: [1.6, 0, 12, 8, 0] }));
  plan.position.y = -0.01; scene.add(plan);

  const layers = [];
  function layer(id, no, name, sub, level) {
    const g = new THREE.Group(); scene.add(g);
    const line = lineMat({ w: 1.3 }), mid = lineMat({ w: 0.9 }), thin = lineMat({ w: 0.55, opacity: 0.5 });
    const W = { mid, thin };
    const L = { id, no, name, sub, level, g, line, lines: [line, mid, thin], subs: [] };
    L.part = new Part(g, PAL, line, W);
    // a piece of the layer that is pulled out sideways; lv is the storey it rides with
    L.side = (dir, lv = level) => { const sg = new THREE.Group(); g.add(sg); const s = { g: sg, dir, lv, part: new Part(sg, PAL, line, W) }; L.subs.push(s); return s; };
    layers.push(L); return L;
  }

  // =====================================================================================================
  // 01 Floor: slab on strip footings, the smoked-oak boards, the terrace deck, everything that stands loose
  const L1 = layer('floor', '01', 'Boden', 'Betonplatte auf Streifenfundamenten', 1);
  L1.lines.push(swayLine);
  {
    const P = L1.part;
    P.add('concrete', bx(XW, 0, -ZO, XE, FL, ZO),
      bx(XW, -0.7, -ZO, XE, 0, -ZO + 0.5), bx(XW, -0.7, ZO - 0.5, XE, 0, ZO),
      bx(XW, -0.7, -ZO + 0.5, XW + 0.5, 0, ZO - 0.5), bx(XE - 0.5, -0.7, -ZO + 0.5, XE, 0, ZO - 0.5));
    // galvanised hold-down angles between slab and wall, in the batten gap
    for (const x of [-4.6, -2.3, 0, 2.3, 4.6]) {
      P.add('steel', bx(x - 0.06, FL - 0.08, ZO, x + 0.06, FL + 0.04, ZO + 0.022),
        bx(x - 0.06, FL - 0.08, -ZO - 0.022, x + 0.06, FL + 0.04, -ZO));
    }
    P.add('floor', bx(XW + TH, FL, -ZI, XI + 0.02, F, ZI));
    // the terrace: joists on pad footings, charred decking, one wide step
    for (const x of [5.3, 6.02, 6.76, 7.5, 8.12]) P.add('oak', bx(x - 0.04, FL - 0.2, -ZO, x + 0.04, FL - 0.04, ZO));
    for (const x of [5.3, 6.76, 8.12]) for (const z of [-3.3, 0, 3.3]) P.add('concrete', bx(x - 0.15, -0.3, z - 0.15, x + 0.15, FL - 0.2, z + 0.15));
    P.add('deck', bx(XE + 0.02, FL - 0.04, -ZO, 8.2, FL, ZO), bx(8.24, 0.03, -1.9, 8.66, 0.15, 1.9));
    P.add('concrete', bx(8.26, -0.3, -1.8, 8.64, 0.03, -1.5), bx(8.26, -0.3, 1.5, 8.64, 0.03, 1.8));
    // a concrete trough with grasses on the north side of the terrace, a lounger on the south
    P.add('concrete', bx(5.5, FL, -3.42, 7.7, FL + 0.46, -3.32), bx(5.5, FL, -2.9, 7.7, FL + 0.46, -2.8),
      bx(5.5, FL, -3.32, 5.6, FL + 0.46, -2.9), bx(7.6, FL, -3.32, 7.7, FL + 0.46, -2.9));
    P.add('deck', bx(5.6, FL, -3.32, 7.6, FL + 0.4, -2.9));
    const blade = new THREE.Shape(); blade.absellipse(0, 0.3, 0.022, 0.3, 0, Math.PI * 2, false);
    for (let c = 0; c < 4; c++) for (let i = 0; i < 9; i++) {
      const k = 0.75 + ((i * 7 + c * 3) % 5) * 0.11, a = i * 0.7 + c, th = 0.12 + (i % 4) * 0.13;
      const g = new THREE.ExtrudeGeometry(blade, { depth: 0.003, bevelEnabled: false, curveSegments: 10 });
      g.scale(1, k, 1); g.applyMatrix4(new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(th)));
      g.translate(5.9 + c * 0.47, FL + 0.4, -3.11); P.add('leaf', g);
    }
    P.add('oak', bx(5.95, FL + 0.2, 2.05, 7.75, FL + 0.25, 2.75));
    for (const x of [6.02, 7.62]) for (const z of [2.09, 2.67]) P.add('oak', bx(x - 0.03, FL, z - 0.03, x + 0.03, FL + 0.2, z + 0.03));
    P.add('cushion', rb(6.66, FL + 0.25, 2.08, 7.72, FL + 0.33, 2.72, 0.035));
    P.add('oak', bar(V(6.6, FL + 0.272, 2.4), V(6.05, FL + 0.622, 2.4), 0.7, 0.04));
    P.add('cushion', bar(V(6.634, FL + 0.324, 2.4), V(6.084, FL + 0.674, 2.4), 0.62, 0.065));
    P.add('rouge', rb(6.9, FL + 0.33, 2.2, 7.2, FL + 0.41, 2.6, 0.035));

    // -- living: a rug, a corner sofa with its back to the south window, two round tables, a red lounge chair
    P.add('rug', bx(1.25, F, 0.2, 4.45, F + 0.012, 3.05));
    P.add('steel', bx(1.64, F + 0.07, 1.99, 3.96, F + 0.2, 2.9), bx(3.24, F + 0.07, 1.04, 3.96, F + 0.2, 1.99));
    for (const [x, z] of [[1.7, 2.05], [1.7, 2.84], [3.9, 2.84], [3.9, 1.1], [3.3, 1.1]]) P.add('steel', bx(x - 0.025, F + 0.012, z - 0.025, x + 0.025, F + 0.07, z + 0.025));
    P.add('cushion',
      rb(1.62, F + 0.2, 1.95, 2.41, F + 0.44, 2.66, 0.07), rb(2.43, F + 0.2, 1.95, 3.21, F + 0.44, 2.66, 0.07),
      rb(3.23, F + 0.2, 1.0, 3.98, F + 0.44, 2.66, 0.07),
      rb(1.62, F + 0.2, 2.66, 3.98, F + 0.82, 2.92, 0.08),
      rb(1.42, F + 0.2, 1.95, 1.62, F + 0.6, 2.92, 0.07), rb(3.98, F + 0.2, 1.0, 4.18, F + 0.6, 2.92, 0.07),
      rb(2.5, F + 0.44, 2.48, 3.14, F + 0.76, 2.66, 0.07), rb(3.28, F + 0.44, 2.48, 3.92, F + 0.76, 2.66, 0.07));
    P.add('rouge', rb(1.68, F + 0.44, 2.26, 2.04, F + 0.74, 2.5, 0.06));
    P.add('rug', rb(3.3, F + 0.44, 1.06, 3.92, F + 0.475, 1.52, 0.015));
    // two round tables: stone tops on three steel legs each
    for (const [x, z, r, h] of [[2.45, 1.05, 0.44, 0.34], [3.2, 0.5, 0.29, 0.26]]) {
      P.add('bright', cyl(r, 0.028, x, F + h, z, 48));
      for (const a of [0.5, 2.6, 4.7]) P.add('steel', cyl(0.012, h - 0.012, x + Math.cos(a) * r * 0.62, F + 0.012, z + Math.sin(a) * r * 0.62, 8));
    }
    P.add('book1', bx(2.22, F + 0.368, 0.9, 2.5, F + 0.4, 1.1));
    P.add('book2', bx(2.25, F + 0.4, 0.92, 2.48, F + 0.425, 1.08));
    P.add('soft', cyl(0.07, 0.06, 2.72, F + 0.368, 1.18, 24, 0.11), cyl(0.045, 0.07, 3.2, F + 0.288, 0.5, 16));
    // the lounge chair: steel sled frame, oak arm pads, red upholstery
    for (const z of [1.57, 2.21]) {
      P.add('steel', bx(0.62, F + 0.012, z, 1.3, F + 0.04, z + 0.03), bx(0.62, F + 0.04, z, 0.65, F + 0.56, z + 0.03), bx(1.27, F + 0.04, z, 1.3, F + 0.56, z + 0.03));
      P.add('oak', bx(0.6, F + 0.56, z - 0.015, 1.32, F + 0.595, z + 0.045));
    }
    P.add('steel', bx(0.7, F + 0.22, 1.6, 1.26, F + 0.26, 2.21));
    P.add('rouge', rb(0.72, F + 0.26, 1.61, 1.28, F + 0.43, 2.2, 0.06), rb(0.64, F + 0.3, 1.61, 0.82, F + 0.9, 2.2, 0.07));
    // a lamp beside the sofa and the pool of light it throws; the glow of the fire on the boards
    P.add('steel', cyl(0.15, 0.02, 1.16, F + 0.012, 2.72, 24), cyl(0.012, 1.42, 1.16, F + 0.032, 2.72, 12));
    P.add('shade', cyl(0.17, 0.24, 1.16, F + 1.36, 2.72, 28, 0.12));
    P.add('pool', cyl(0.85, 0.002, 1.3, F + 0.013, 2.4, 40));
    for (const [rx, rz] of [[0.85, 1.25], [0.6, 0.95], [0.36, 0.62]]) P.add('firepool', new THREE.CylinderGeometry(1, 1, 0.002, 40).scale(rx, 1, rz).translate(1.7, F + 0.002, -2.1));
    // sideboard on the north wall: a turntable, books, a lamp
    P.add('oak', bx(1.7, F + 0.16, -ZI, 3.0, F + 0.62, -2.98));
    for (const x of [1.78, 2.92]) for (const z of [-3.36, -3.06]) P.add('steel', bx(x - 0.02, F, z - 0.02, x + 0.02, F + 0.16, z + 0.02));
    P.add('steel', bx(1.8, F + 0.62, -3.36, 2.24, F + 0.67, -3.04), cyl(0.15, 0.012, 2.02, F + 0.67, -3.2, 32));
    P.add('book1', bx(2.36, F + 0.62, -3.34, 2.42, F + 0.86, -3.12));
    P.add('book2', bx(2.42, F + 0.62, -3.34, 2.47, F + 0.9, -3.12), bx(2.52, F + 0.62, -3.34, 2.56, F + 0.84, -3.12));
    P.add('book3', bx(2.47, F + 0.62, -3.34, 2.52, F + 0.88, -3.12));
    P.add('soft', cyl(0.05, 0.14, 2.82, F + 0.62, -3.2, 18));
    P.add('shade', cyl(0.13, 0.17, 2.82, F + 0.76, -3.2, 28, 0.085));
    // a rubber tree by the glass, drawn leaf by leaf
    P.add('bright', cyl(0.16, 0.4, 4.32, F, -2.92, 40, 0.22));
    P.add('oak', cyl(0.016, 1.35, 4.32, F + 0.38, -2.92, 8));
    const leaf = new THREE.Shape(); leaf.absellipse(0, 0.2, 0.095, 0.2, 0, Math.PI * 2, false);
    for (let i = 0; i < 12; i++) {
      const h = F + 0.72 + i * 0.09, a = i * 2.2 + 0.4, th = 0.95 - (i % 3) * 0.18, k = 0.8 + ((i * 5) % 4) * 0.09;
      const g = new THREE.ExtrudeGeometry(leaf, { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
      g.scale(k, k, 1); g.applyMatrix4(new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(th)));
      g.translate(4.32, h, -2.92); P.add('leaf', g);
    }

    // -- dining: an oak top on two steel frames, six chairs, a few things on the table
    P.add('oak', bx(-2.6, F + 0.71, 1.4, -0.4, F + 0.75, 2.4));
    for (const x of [-2.3, -0.7]) {
      P.add('steel', bx(x - 0.02, F, 1.52, x + 0.02, F + 0.03, 2.28), bx(x - 0.02, F + 0.68, 1.52, x + 0.02, F + 0.71, 2.28),
        bx(x - 0.02, F + 0.03, 1.52, x + 0.02, F + 0.68, 1.56), bx(x - 0.02, F + 0.03, 2.24, x + 0.02, F + 0.68, 2.28));
    }
    const chair = (cx, cz, s) => {          // s = +1: the sitter looks south
      const zb = cz - s * 0.185;
      P.add('oak', bx(cx - 0.21, F + 0.43, cz - 0.2, cx + 0.21, F + 0.46, cz + 0.2), bx(cx - 0.2, F + 0.63, zb + s * 0.011, cx + 0.2, F + 0.85, zb + s * 0.03));
      for (const dx of [-0.185, 0.185]) {
        P.add('steel', bx(cx + dx - 0.011, F, cz + s * 0.17 - 0.011, cx + dx + 0.011, F + 0.43, cz + s * 0.17 + 0.011),
          bx(cx + dx - 0.011, F, zb - 0.011, cx + dx + 0.011, F + 0.43, zb + 0.011), bx(cx + dx - 0.011, F + 0.46, zb - 0.011, cx + dx + 0.011, F + 0.86, zb + 0.011));
      }
    };
    for (const x of [-2.15, -1.5, -0.85]) { chair(x, 1.16, 1); chair(x, 2.64, -1); }
    P.add('bright', cyl(0.1, 0.07, -1.5, F + 0.75, 1.9, 32, 0.19));
    P.add('soft', cyl(0.045, 0.2, -1.02, F + 0.75, 1.78, 18, 0.03), cyl(0.035, 0.09, -0.9, F + 0.75, 1.98, 14), cyl(0.035, 0.09, -2.0, F + 0.75, 1.82, 14));
    P.add('book1', bx(-2.32, F + 0.75, 1.96, -2.06, F + 0.78, 2.16));
    // three stools under the overhang of the island
    for (const x of [-2.7, -2.1, -1.5]) {
      P.add('oak', cyl(0.165, 0.035, x, F + 0.63, -0.44, 28));
      P.add('steel', cyl(0.016, 0.61, x, F + 0.02, -0.44, 10), cyl(0.15, 0.02, x, F, -0.44, 24));
    }
    // floor boards, drawn as hatching; the deck boards run across the terrace
    const boards = [];
    for (let z = -ZI + 0.18; z < ZI; z += 0.18) for (let x = XW + TH; x < XI; x += 2.42) boards.push([x, F + 0.001, z, Math.min(x + 2.42, XI), F + 0.001, z]);
    for (let z = -ZO + 0.14; z < ZO; z += 0.14) boards.push([XE + 0.03, FL + 0.001, z, 8.2, FL + 0.001, z]);
    segs(L1.g, boards, hatchMat);
  }

  // =====================================================================================================
  // 02 Ground floor: CLT walls, the glulam portal of the glass front, the chimney block, the kitchen, the stair
  const L2 = layer('eg', '02', 'Erdgeschoss', 'Brettsperrholz, 160 mm', 2);
  const flames = [];
  {
    const P = L2.part, joints = [];
    const long = [[XW + TH, 0], [XE, 0], [XE, EH], [XW + TH, EH]];
    P.add('wall', panel(long, S1.map(hole(FL)), TH).applyMatrix4(M.alongX(ZI, FL)));
    P.add('wall', panel(long, N1.map(hole(FL)), TH).applyMatrix4(M.alongX(-ZO, FL)));
    P.add('wall', panel([[-ZO, 0], [ZO, 0], [ZO, EH], [-ZO, EH]], W1.map(hole(FL)), TH).applyMatrix4(M.alongZ(XW + TH, FL)));
    // the east front is a glulam portal: a lintel on two posts
    P.add('rafter', bx(XI, YL, -ZI, XE, Y1, ZI), bx(XI, FL, DW, XE, YL, DW + 0.12), bx(XI, FL, -DW - 0.12, XE, YL, -DW));
    P.add('steel', bx(XI - 0.012, YL - 0.1, DW - 0.01, XI, YL + 0.12, DW + 0.13), bx(XI - 0.012, YL - 0.1, -DW - 0.13, XI, YL + 0.12, -DW + 0.01));

    // the chimney block: white painted brick with a fire chamber in its east face, a bench in front
    P.add('brick', bx(BX0, F, -ZI, 0.5, Y1, BZ),
      bx(0.5, F, -ZI, BX1, F + 0.5, BZ), bx(0.5, F + 1.05, -ZI, BX1, Y1, BZ),
      bx(0.5, F + 0.5, -ZI, BX1, F + 1.05, -2.7), bx(0.5, F + 0.5, -1.5, BX1, F + 1.05, BZ),
      bx(BX1, F, -ZI, 1.3, F + 0.4, BZ));
    P.add('steel', bx(0.5, F + 0.5, -2.7, 0.512, F + 1.05, -1.5), bx(0.512, F + 0.5, -2.7, BX1, F + 0.512, -1.5));
    P.add('ember', bx(0.56, F + 0.512, -2.56, 0.74, F + 0.535, -1.64));
    P.add('oak', lying(0.045, 0.62, 0.62, F + 0.58, -2.3), lying(0.04, 0.55, 0.69, F + 0.575, -1.95), lying(0.04, 0.7, 0.65, F + 0.665, -2.1));
    const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.bezierCurveTo(0.075, 0.02, 0.07, 0.14, 0.012, 0.3); fl.bezierCurveTo(-0.06, 0.15, -0.075, 0.03, 0, 0);
    [[-2.42, 0.95, 0.62], [-2.26, 1.25, 0.66], [-2.1, 1.05, 0.6], [-1.96, 1.3, 0.68], [-1.82, 0.9, 0.63], [-2.18, 0.8, 0.72], [-2.02, 0.75, 0.57]].forEach(([z, k, x], i) => {
      const g = new THREE.ExtrudeGeometry(fl, { depth: 0.003, bevelEnabled: false, curveSegments: 14 });
      g.rotateY(-Math.PI / 2);
      const m = new THREE.Mesh(g, flameMat); m.position.set(x, F + 0.535, z); m.userData = { k, i }; L2.g.add(m); flames.push(m);
    });
    P.add('cushion', rb(0.84, F + 0.4, -3.36, 1.26, F + 0.47, -2.2, 0.03));
    for (const [y, z] of [[0.045, -1.36], [0.045, -1.26], [0.045, -1.16], [0.125, -1.31], [0.125, -1.21], [0.205, -1.26]]) P.add('oak', lying(0.045, 0.4, 1.05, F + 0.4 + y, z, 'x'));

    // kitchen: a tall wall of fronts under the landing, a base run along the north wall, the island
    P.add('steel', bx(XW + TH, F, -ZI, -4.28, F + 0.08, -1.44), bx(-4.24, F, -ZI, BX0, F + 0.08, -2.88), bx(-3.06, F, -1.71, -1.14, F + 0.08, -0.89));
    P.add('kfront', bx(XW + TH, F + 0.08, -ZI, -4.24, F + 2.3, -1.44), bx(-4.24, F + 0.08, -ZI, BX0, F + 0.86, -2.84), bx(-3.1, F + 0.08, -1.75, -1.1, F + 0.86, -0.85));
    P.add('bright', bx(-4.24, F + 0.86, -ZI, BX0, F + 0.9, -2.82), bx(-3.16, F + 0.86, -1.8, -1.04, F + 0.9, -0.52));
    P.add('steel', bx(-4.24, F + 0.92, -2.92, -4.228, F + 1.48, -2.36), bx(-4.228, F + 1.5, -2.9, -4.2, F + 1.515, -2.38),
      bx(-2.6, F + 0.9, -3.3, -1.95, F + 0.906, -2.94), cyl(0.014, 0.27, -2.28, F + 0.9, -3.36, 12), bar(V(-2.28, F + 1.16, -3.371), V(-2.28, F + 1.16, -3.14), 0.022, 0.022),
      bx(-2.55, F + 0.9, -1.6, -1.7, F + 0.906, -1.08));
    P.add('oak', bx(-0.95, F + 1.5, -ZI, 0.15, F + 1.535, -3.2), bx(-1.5, F + 0.9, -1.5, -1.18, F + 0.925, -1.06));
    P.add('soft', cyl(0.06, 0.15, -0.72, F + 1.535, -3.31, 20), cyl(0.05, 0.12, -0.54, F + 1.535, -3.31, 20), cyl(0.075, 0.19, -0.1, F + 1.535, -3.31, 24, 0.04),
      cyl(0.09, 0.07, -2.86, F + 0.9, -1.22, 32, 0.16));
    P.add('rouge', cyl(0.085, 0.13, -0.5, F + 0.9, -3.14, 24, 0.07), ball(0.043, -2.9, F + 0.99, -1.25), ball(0.043, -2.81, F + 0.99, -1.2), ball(0.043, -2.86, F + 1.0, -1.15));
    for (const z of [-2.94, -2.36, -1.94]) joints.push([-4.239, F + 0.1, z, -4.239, F + 2.28, z]);
    joints.push([-4.239, F + 0.9, -2.94, -4.239, F + 0.9, -2.36]);
    for (let x = -3.64; x < 0.1; x += 0.6) joints.push([x, F + 0.1, -2.839, x, F + 0.84, -2.839]);
    joints.push([-4.24, F + 0.72, -2.839, BX0, F + 0.72, -2.839]);
    for (const x of [-2.6, -2.1, -1.6]) joints.push([x, F + 0.1, -0.849, x, F + 0.84, -0.849], [x, F + 0.1, -1.751, x, F + 0.84, -1.751]);

    // the stair: a folded oak flight on a closed cupboard, steel rods from the treads up past the ceiling
    const prof = [[SZ, F]];
    for (let i = 1; i < NR; i++) prof.push([SZ - (i - 1) * GO, F + i * RS], [SZ - i * GO, F + i * RS]);
    const SL = RS / GO, soff = F + (NR - 1) * RS - 0.24, zf = STOP + (soff - F) / SL;
    prof.push([STOP, soff], [zf, F]);
    P.add('oak', panel(prof, [], SX1 - SX0).applyMatrix4(M.alongZ(SX1, 0)));
    P.add('ceil', panel([[zf, F], [STOP, F], [STOP, soff]], [], 0.05).applyMatrix4(M.alongZ(SX1, 0)), bx(SX0, F, STOP - 0.05, SX1, soff, STOP));
    for (let k = 1; k <= 4; k++) { const z = lerp(zf, STOP, k / 5); joints.push([SX1 + 0.002, F + 0.03, z, SX1 + 0.002, F + (zf - z) * SL - 0.03, z]); }
    for (let i = 1; i <= 12; i++) for (const d of [0.07, 0.2]) P.add('rod', bx(SX1 - 0.039, F + i * RS, SZ - (i - 1) * GO - d - 0.008, SX1 - 0.023, Y2, SZ - (i - 1) * GO - d + 0.008));
    P.add('steel', bar(V(SX0 + 0.06, F + 0.95, SZ + 0.1), V(SX0 + 0.06, F2 + 0.95, STOP - 0.1), 0.04, 0.04));
    for (const u of [0.04, 0.5, 0.96]) { const z = lerp(SZ + 0.1, STOP - 0.1, u), y = lerp(F + 0.95, F2 + 0.95, u); P.add('steel', bx(SX0, y - 0.05, z - 0.012, SX0 + 0.06, y - 0.03, z + 0.012)); }

    // panel joints of the CLT walls
    for (const x of [-2.4, 0.05, 2.5]) joints.push([x, FL, ZO + 0.002, x, Y1, ZO + 0.002], [x, FL, -ZO - 0.002, x, Y1, -ZO - 0.002]);
    segs(L2.g, joints, hatchMat);
  }

  // =====================================================================================================
  // 03 Upper floor: the CLT ceiling with its stair opening, knee walls and gables, the studio under the roof
  const L3 = layer('og', '03', 'Obergeschoss', 'BSP-Decke 200 mm, Kniestock 1,40 m', 3);
  {
    const P = L3.part, joints = [];
    P.add('ceil', panel([[XW, -ZO], [XE, -ZO], [XE, ZO], [XW, ZO]], [[[SX0, -ZI], [SX1, -ZI], [SX1, -STOP], [SX0, -STOP]]], CS).applyMatrix4(M.flat(Y1)));
    P.add('floor', panel([[SX1, -ZI], [XI, -ZI], [XI, ZI], [SX0, ZI], [SX0, -STOP], [SX1, -STOP]], [], F2 - Y2).applyMatrix4(M.flat(Y2)));
    const knee = [[XW + TH, 0], [XI, 0], [XI, KH], [XW + TH, KH]];
    P.add('wall', panel(knee, S2.map(hole(Y2)), TH).applyMatrix4(M.alongX(ZI, Y2)));
    P.add('wall', panel(knee, N2.map(hole(Y2)), TH).applyMatrix4(M.alongX(-ZO, Y2)));
    // gables with a pocket for the ridge beam
    const gt = z => UL(z) - Y2;
    const gable = [[-ZO, 0], [ZO, 0], [ZO, gt(ZO)], [0.09, gt(0.09)], [0.09, gt(0) - 0.3], [-0.09, gt(0) - 0.3], [-0.09, gt(0.09)], [-ZO, gt(ZO)]];
    P.add('wall', panel(gable, W2.map(hole(Y2)), TH).applyMatrix4(M.alongZ(XW + TH, Y2)));
    P.add('wall', panel(gable, E2.map(hole(Y2)), TH).applyMatrix4(M.alongZ(XE, Y2)));
    P.add('rafter', bx(XW + TH, YP, ZI, XI, YP + PL, ZO), bx(XW + TH, YP, -ZO, XI, YP + PL, -ZI));

    // the guard along the stair opening
    for (let z = STOP + 0.09; z < ZI - 0.02; z += 0.13) P.add('rod', bx(SX1 + 0.03, F2, z - 0.008, SX1 + 0.046, F2 + 0.98, z + 0.008));
    P.add('steel', bx(SX1 + 0.014, F2 + 0.98, STOP - 0.02, SX1 + 0.062, F2 + 1.02, ZI), bx(SX1 + 0.014, F2, STOP - 0.02, SX1 + 0.062, F2 + 0.98, STOP + 0.028));
    // the flue of the chimney block comes up through the room
    P.add('pipe', cyl(0.11, UL(PIPE[1]) - 0.03 - F2, PIPE[0], F2, PIPE[1], 28), cyl(0.17, 0.02, PIPE[0], F2, PIPE[1], 28));

    // sleeping, east: the bed stands under the gable window on a rug, two side tables, a dresser under the eave
    P.add('rug', bx(2.1, F2, -1.75, 4.7, F2 + 0.012, 1.75));
    P.add('oak', bx(4.66, F2 + 0.012, -1.1, 4.78, F2 + 0.8, 1.1), bx(2.56, F2 + 0.012, -0.97, 4.66, F2 + 0.24, 0.97));
    P.add('cushion', rb(2.6, F2 + 0.24, -0.92, 4.62, F2 + 0.47, 0.92, 0.07),
      rb(4.14, F2 + 0.47, -0.84, 4.58, F2 + 0.64, -0.06, 0.06), rb(4.14, F2 + 0.47, 0.06, 4.58, F2 + 0.64, 0.84, 0.06));
    P.add('rouge', rb(2.72, F2 + 0.25, -0.95, 3.3, F2 + 0.5, 0.95, 0.05), rb(3.84, F2 + 0.47, -0.3, 4.1, F2 + 0.62, 0.3, 0.05));
    for (const s of [-1, 1]) {
      P.add('oak', cyl(0.2, 0.03, 4.46, F2 + 0.42, s * 1.32, 32));
      P.add('steel', cyl(0.018, 0.4, 4.46, F2 + 0.02, s * 1.32, 10), cyl(0.14, 0.012, 4.46, F2 + 0.012, s * 1.32, 24));
    }
    P.add('soft', cyl(0.05, 0.14, 4.46, F2 + 0.45, -1.32, 18));
    P.add('shade', cyl(0.13, 0.17, 4.46, F2 + 0.59, -1.32, 28, 0.085));
    P.add('book1', bx(4.34, F2 + 0.45, 1.22, 4.58, F2 + 0.48, 1.42));
    P.add('book2', bx(4.36, F2 + 0.48, 1.24, 4.57, F2 + 0.505, 1.4));
    P.add('oak', bx(1.9, F2 + 0.012, -ZI, 4.1, F2 + 0.72, -2.96));
    for (const x of [2.63, 3.37]) joints.push([x, F2 + 0.03, -2.959, x, F2 + 0.7, -2.959]);
    joints.push([1.9, F2 + 0.37, -2.959, 4.1, F2 + 0.37, -2.959]);
    P.add('soft', cyl(0.09, 0.22, 2.2, F2 + 0.72, -3.2, 24, 0.05), cyl(0.08, 0.05, 3.7, F2 + 0.72, -3.2, 28, 0.12));
    P.add('book3', bx(2.9, F2 + 0.72, -3.32, 3.2, F2 + 0.75, -3.1));
    P.add('book1', bx(2.92, F2 + 0.75, -3.31, 3.18, F2 + 0.775, -3.11));

    // working, south: a desk under the strip window, a red chair, a lamp, an open laptop
    P.add('oak', bx(-2.8, F2 + 0.71, 2.55, -0.6, F2 + 0.75, 3.36));
    for (const x of [-2.6, -0.8]) P.add('steel', bx(x - 0.02, F2 + 0.012, 2.62, x + 0.02, F2 + 0.04, 3.3), bx(x - 0.02, F2 + 0.68, 2.62, x + 0.02, F2 + 0.71, 3.3),
      bx(x - 0.02, F2 + 0.04, 2.62, x + 0.02, F2 + 0.68, 2.66), bx(x - 0.02, F2 + 0.04, 3.26, x + 0.02, F2 + 0.68, 3.3));
    P.add('steel', bx(-1.98, F2 + 0.75, 2.84, -1.42, F2 + 0.764, 3.18), bar(V(-1.7, F2 + 0.766, 3.19), V(-1.7, F2 + 1.08, 3.28), 0.56, 0.012),
      cyl(0.075, 0.015, -0.86, F2 + 0.75, 3.12, 20), cyl(0.008, 0.36, -0.86, F2 + 0.765, 3.12, 8), bar(V(-0.86, F2 + 1.125, 3.12), V(-1.1, F2 + 1.2, 2.95), 0.014, 0.014));
    P.add('shade', cyl(0.085, 0.1, -1.14, F2 + 1.09, 2.92, 24, 0.045));
    P.add('book2', bx(-2.6, F2 + 0.75, 2.9, -2.3, F2 + 0.78, 3.14));
    P.add('book1', bx(-2.58, F2 + 0.78, 2.92, -2.33, F2 + 0.805, 3.12));
    P.add('soft', cyl(0.04, 0.09, -2.16, F2 + 0.75, 3.14, 14));
    P.add('steel', cyl(0.24, 0.02, -1.7, F2 + 0.012, 2.1, 5), cyl(0.02, 0.4, -1.7, F2 + 0.03, 2.1, 10));
    P.add('rouge', rb(-1.93, F2 + 0.43, 1.88, -1.47, F2 + 0.5, 2.32, 0.03), rb(-1.92, F2 + 0.5, 1.84, -1.48, F2 + 0.92, 1.9, 0.025));

    // reading: a long bookcase under the north eave, an easy chair and a side table by the stair
    const BS = [-3.1, 0.9];
    for (const y of [0.012, 0.42, 0.82, 1.21]) P.add('oak', bx(BS[0], F2 + y, -ZI, BS[1], F2 + y + 0.035, -3.08));
    for (const x of [BS[0], -2.1, -1.1, -0.1, BS[1] - 0.035]) P.add('oak', bx(x, F2 + 0.047, -ZI, x + 0.035, F2 + 1.21, -3.08));
    const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    for (const [x0, x1] of [[-3.065, -2.1], [-2.065, -1.1], [-1.065, -0.1], [-0.065, 0.865]]) for (const y of [0.047, 0.455, 0.855]) {
      let x = x0 + 0.02; const end = x1 - 0.12 - rnd() * 0.35;
      while (x < end) { const w = 0.035 + rnd() * 0.04, h = 0.22 + rnd() * 0.11, k = rnd(); P.add(k < 0.2 ? 'book1' : k < 0.62 ? 'book2' : 'book3', bx(x, F2 + y, -3.38, x + w, F2 + y + h, -3.13)); x += w + 0.004; }
    }
    P.add('soft', cyl(0.075, 0.2, 0.4, F2 + 1.245, -3.26, 22, 0.045), cyl(0.07, 0.05, -2.6, F2 + 1.245, -3.26, 24, 0.1));
    for (const z of [0.2, 0.86]) {
      P.add('steel', bx(-3.42, F2 + 0.012, z, -2.72, F2 + 0.04, z + 0.03), bx(-3.42, F2 + 0.04, z, -3.39, F2 + 0.54, z + 0.03), bx(-2.75, F2 + 0.04, z, -2.72, F2 + 0.54, z + 0.03));
      P.add('oak', bx(-3.44, F2 + 0.54, z - 0.015, -2.7, F2 + 0.575, z + 0.045));
    }
    P.add('steel', bx(-3.36, F2 + 0.21, 0.23, -2.8, F2 + 0.25, 0.86));
    P.add('cushion', rb(-3.34, F2 + 0.25, 0.24, -2.78, F2 + 0.42, 0.85, 0.06), rb(-3.4, F2 + 0.29, 0.24, -3.22, F2 + 0.88, 0.85, 0.07));
    P.add('oak', cyl(0.19, 0.03, -3.0, F2 + 0.44, 1.4, 32));
    P.add('steel', cyl(0.018, 0.42, -3.0, F2 + 0.02, 1.4, 10), cyl(0.13, 0.012, -3.0, F2 + 0.012, 1.4, 24));
    P.add('book1', bx(-3.1, F2 + 0.47, 1.32, -2.88, F2 + 0.5, 1.5));

    // two globes hang from the ceiling over the dining table and ride with it
    for (const x of [-2.05, -0.95]) {
      P.add('steel', cyl(0.006, Y1 - (F + 1.62), x, F + 1.62, 1.9, 8), cyl(0.045, 0.02, x, Y1 - 0.02, 1.9, 16));
      P.add('shade', ball(0.15, x, F + 1.5, 1.9, 3));
    }
    // upper floor boards, drawn as hatching
    const boards = [];
    for (let z = -ZI + 0.18; z < ZI; z += 0.18) {
      const x0 = z > STOP ? SX1 : SX0;
      for (let x = x0; x < XI; x += 2.42) boards.push([x, F2 + 0.001, z, Math.min(x + 2.42, XI), F2 + 0.001, z]);
    }
    for (const x of [-2.4, 0.05, 2.5]) joints.push([x, Y2, ZO + 0.002, x, YP, ZO + 0.002], [x, Y2, -ZO - 0.002, x, YP, -ZO - 0.002]);
    for (const x of [-3.2, -1.2, 0.95, 2.9]) joints.push([x, Y1 - 0.002, -ZI, x, Y1 - 0.002, 0], [x, Y1 - 0.002, 0, x, Y1 - 0.002, ZI]);
    segs(L3.g, [...boards, ...joints], hatchMat);
  }

  // =====================================================================================================
  // 04 Glazing, pulled out sideways from its own storey: the sliding glass front, the windows
  const L4 = layer('glazing', '04', 'Verglasung', 'Hebeschiebetür 3,40 m, Dreifachglas', null);
  const gE1 = L4.side(V(1, 0, 0), 2), gS1 = L4.side(V(0, 0, 1), 2), gN1 = L4.side(V(0, 0, -1), 2), gW1 = L4.side(V(-1, 0, 0), 2);
  const gE2 = L4.side(V(1, 0, 0), 3), gS2 = L4.side(V(0, 0, 1), 3), gN2 = L4.side(V(0, 0, -1), 3), gW2 = L4.side(V(-1, 0, 0), 3);
  const leafN = L4.side(V(1, 0, 0), 2), leafS = L4.side(V(1, 0, 0), 2);
  {
    // fixed panes either side of the posts, a steel track below and a rail above for the leaves
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? DW + 0.12 : -ZI, z1 = s > 0 ? ZI : -DW - 0.12;
      gE1.part.add('frame', bx(XI + 0.03, FL, z0, XI + 0.11, FL + 0.07, z1), bx(XI + 0.03, YL - 0.06, z0, XI + 0.11, YL, z1),
        bx(XI + 0.03, FL + 0.07, z0, XI + 0.11, YL - 0.06, z0 + 0.05), bx(XI + 0.03, FL + 0.07, z1 - 0.05, XI + 0.11, YL - 0.06, z1));
      gE1.part.add('glass', bx(XI + 0.06, FL + 0.07, z0 + 0.05, XI + 0.08, YL - 0.06, z1 - 0.05));
    }
    gE1.part.add('steel', bx(XE + 0.004, FL, -ZI, XE + 0.1, FL + 0.012, ZI), bx(XE + 0.004, YL - 0.03, -ZI, XE + 0.11, YL + 0.07, ZI));
    for (const [side, s] of [[leafN, -1], [leafS, 1]]) {
      const z0 = s > 0 ? 0.003 : -DW - 0.06, z1 = s > 0 ? DW + 0.06 : -0.003, y0 = FL + 0.014, y1 = YL - 0.032, f = 0.07;
      side.part.add('redframe', bx(XE + 0.03, y0, z0, XE + 0.085, y0 + f, z1), bx(XE + 0.03, y1 - f, z0, XE + 0.085, y1, z1),
        bx(XE + 0.03, y0 + f, z0, XE + 0.085, y1 - f, z0 + f), bx(XE + 0.03, y0 + f, z1 - f, XE + 0.085, y1 - f, z1));
      side.part.add('glass', bx(XE + 0.048, y0 + f, z0 + f, XE + 0.068, y1 - f, z1 - f));
      const hz = s > 0 ? z0 + 0.035 : z1 - 0.035;
      side.part.add('steel', bx(XE + 0.085, FL + 0.85, hz - 0.012, XE + 0.1, FL + 1.35, hz + 0.012));
    }
    // windows: a frame in the wall's thickness, mullions, the pane, a steel cill on the outside
    function win4(part, axis, w0, w1, [a0, y0, a1, y1], out, mull = 0) {
      const f = 0.06;
      const B = axis === 'x' ? (p0, q0, p1, q1, r0, r1) => bx(p0, q0, r0, p1, q1, r1) : (p0, q0, p1, q1, r0, r1) => bx(r0, q0, p0, r1, q1, p1);
      part.add('frame', B(a0, y0, a1, y0 + f, w0, w1), B(a0, y1 - f, a1, y1, w0, w1), B(a0, y0 + f, a0 + f, y1 - f, w0, w1), B(a1 - f, y0 + f, a1, y1 - f, w0, w1));
      for (let k = 1; k <= mull; k++) { const a = lerp(a0, a1, k / (mull + 1)); part.add('frame', B(a - 0.025, y0 + f, a + 0.025, y1 - f, w0 + 0.02, w1 - 0.02)); }
      const m = (w0 + w1) / 2; part.add('glass', B(a0 + f, y0 + f, a1 - f, y1 - f, m - 0.01, m + 0.01));
      const e = out > 0 ? w1 : w0; part.add('steel', B(a0, y0 - 0.026, a1, y0 - 0.004, Math.min(e, e + out * 0.075), Math.max(e, e + out * 0.075)));
    }
    S1.forEach((o, i) => win4(gS1.part, 'x', ZI, ZO, o, 1, i ? 1 : 2));
    N1.forEach((o, i) => win4(gN1.part, 'x', -ZO, -ZI, o, -1, i ? 0 : 1));
    for (const o of W1) win4(gW1.part, 'z', XW, XW + TH, o, -1);
    for (const o of S2) win4(gS2.part, 'x', ZI, ZO, o, 1, 1);
    for (const o of N2) win4(gN2.part, 'x', -ZO, -ZI, o, -1, 1);
    for (const o of W2) win4(gW2.part, 'z', XW, XW + TH, o, -1, 1);
    for (const o of E2) win4(gE2.part, 'z', XI, XE, o, 1, 2);
  }

  // =====================================================================================================
  // 05 Cladding: vertical charred larch boards, one band per storey, pulled out from each wall
  const L5 = layer('cladding', '05', 'Fassade', 'Eiche geölt senkrecht, 22 × 140', null);
  const cS1 = L5.side(V(0, 0, 1), 2), cN1 = L5.side(V(0, 0, -1), 2), cW1 = L5.side(V(-1, 0, 0), 2);
  const cS2 = L5.side(V(0, 0, 1), 3), cN2 = L5.side(V(0, 0, -1), 3), cW2 = L5.side(V(-1, 0, 0), 3), cE2 = L5.side(V(1, 0, 0), 3);
  const BW = 0.14, BG = 0.026, C0 = FL - 0.25, CM = Y1 + 0.1, CT = YP + PL - 0.06, D0 = 0.03, D1 = 0.052;
  {
    function boards(holes, a0, a1, base, top) {
      const out = [];
      for (let a = a0; a + BW <= a1 + 1e-6; a += BW + BG) {
        const b = a + BW; let spans = [[base, top(a, b)]];
        for (const [u0, v0, u1, v1] of holes) {
          if (b > u0 && a < u1) spans = spans.flatMap(([s, e]) => [[s, Math.min(e, v0 - 0.03)], [Math.max(s, v1 + 0.03), e]]).filter(([s, e]) => e - s > 0.05);
        }
        for (const [s, e] of spans) out.push([a, b, s, e]);
      }
      return out;
    }
    const X0 = XW - D1;
    for (const [a, b, s, e] of boards(S1, X0, XE, C0, () => CM)) cS1.part.add('clad', bx(a, s, ZO + D0, b, e, ZO + D1));
    for (const [a, b, s, e] of boards(N1, X0, XE, C0, () => CM)) cN1.part.add('clad', bx(a, s, -ZO - D1, b, e, -ZO - D0));
    for (const [a, b, s, e] of boards(W1, -ZO - D0, ZO + D0, C0, () => CM)) cW1.part.add('clad', bx(XW - D1, s, a, XW - D0, e, b));
    for (const [a, b, s, e] of boards(S2, X0, XE + D1, CM + 0.02, () => CT)) cS2.part.add('clad', bx(a, s, ZO + D0, b, e, ZO + D1));
    for (const [a, b, s, e] of boards(N2, X0, XE + D1, CM + 0.02, () => CT)) cN2.part.add('clad', bx(a, s, -ZO - D1, b, e, -ZO - D0));
    const gTop = (a, b) => UL(Math.max(Math.abs(a), Math.abs(b))) - 0.05;
    for (const [a, b, s, e] of boards(W2, -ZO - D0, ZO + D0, CM + 0.02, gTop)) cW2.part.add('clad', bx(XW - D1, s, a, XW - D0, e, b));
    for (const [a, b, s, e] of boards(E2, -ZO - D0, ZO + D0, Y1 + 0.006, gTop)) cE2.part.add('clad', bx(XE + D0, s, a, XE + D1, e, b));
    // drip flashings close the joint between the two bands and sit over the glass front
    cS2.part.add('steel', bx(X0, CM - 0.004, ZO + D0, XE + D1, CM + 0.016, ZO + 0.07));
    cN2.part.add('steel', bx(X0, CM - 0.004, -ZO - 0.07, XE + D1, CM + 0.016, -ZO - D0));
    cW2.part.add('steel', bx(XW - 0.07, CM - 0.004, -ZO - D0, XW - D0, CM + 0.016, ZO + D0));
    cE2.part.add('steel', bx(XE + 0.004, Y1 - 0.018, -ZO - D0, XE + 0.075, Y1 + 0.002, ZO + D0));
  }

  // =====================================================================================================
  // 06 Roof structure and 07 Roof: every piece is cut plumb at the ridge and square at the eave
  // a box in the plane of a slope: w above the rafter line, t down the slope from the ridge
  const sb = (side, x0, x1, w0, w1, t0, t1) => {
    const m = new THREE.Matrix4();
    if (side > 0) m.makeBasis(V(1, 0, 0), V(0, CP, SP), V(0, -SP, CP)); else m.makeBasis(V(-1, 0, 0), V(0, CP, -SP), V(0, -SP, -CP));
    return (side > 0 ? bx(x0, w0, t0, x1, w1, t1) : bx(-x1, w0, t0, -x0, w1, t1)).applyMatrix4(m.setPosition(0, Y0, 0));
  };
  const L6 = layer('rafters', '06', 'Dachtragwerk', 'BSH-Firstpfette, Sparren alle 600 mm', 4);
  {
    const RX = [-XR + 0.04, XR - 0.04, -4.92, 4.92]; for (let k = 0; k <= 15; k++) RX.push(-4.6 + 0.6 * k);
    for (const x of RX) for (const side of [1, -1]) L6.part.add('rafter', slope(side, x - 0.04, x + 0.04, 0, 0.22, 0.08, T));
    for (const side of [1, -1]) L6.part.add('rafter', sb(side, -XR, XR, 0, 0.22, T, T + 0.035));     // fascia
    L6.part.add('rafter', bx(-XR, Y0 - 0.3, -0.08, XR, Y0 + 0.14, 0.08));
    for (const x of [-2.42, 0.02, 2.42]) L6.part.add('steel', bx(x - 0.05, Y0 - 0.31, -0.09, x + 0.05, Y0 - 0.3, 0.09));
    // the flue passes between two rafters; two paper lanterns hang from the ridge beam
    L6.part.add('pipe', cyl(0.11, 0.22 / CP + 0.03, PIPE[0], UL(PIPE[1]) - 0.03, PIPE[1], 28));
    for (const [x, r] of [[3.7, 0.28], [-1.8, 0.22]]) {
      const y0 = F2 + 2.35;
      L6.part.add('steel', cyl(0.006, Y0 - 0.3 - y0, x, y0, 0, 8));
      L6.part.add('shade', ball(r, x, y0 - r + 0.02, 0, 3));
    }
  }
  const L7 = layer('roof', '07', 'Dach', 'Dämmpaneele, Zink-Stehfalz', 5);
  {
    const tS = (0.2 - 0.44 * SP) / CP;                 // where the standing seams start, clear of the ridge cap
    for (const side of [1, -1]) {
      L7.part.add('under', slope(side, -XR, XR, 0.22, 0.42, 0, T + 0.035));
      L7.part.add('seam', slope(side, -XR - 0.02, XR + 0.02, 0.42, 0.44, 0, T + 0.06));
      for (let x = -XR + 0.2; x < XR; x += 0.45) L7.part.add('seam', sb(side, x - 0.012, x + 0.012, 0.44, 0.48, tS, T + 0.06));
      // zinc gutter along each eave
      L7.part.add('steel', sb(side, -XR - 0.02, XR + 0.02, 0.34, 0.42, T + 0.06, T + 0.14));
    }
    // the ridge cap folds over both slopes
    const YT = Y0 + 0.44 / CP, a = YT - 0.2 * TP;
    L7.part.add('seam', panel([[-0.2, a], [0, YT], [0.2, a], [0.2, a + 0.04], [0, YT + 0.04], [-0.2, a + 0.04]], [], 2 * XR + 0.06).applyMatrix4(M.alongZ(XR + 0.03, 0)));
    // the flue leaves through the north slope under a rain cap
    const yr = UL(PIPE[1]) + 0.22 / CP + 0.03;
    L7.part.add('pipe', cyl(0.11, YT + 0.75 - yr, PIPE[0], yr, PIPE[1], 28), cyl(0.2, 0.02, PIPE[0], UL(PIPE[1]) + 0.44 / CP + 0.16, PIPE[1], 28, 0.13),
      cyl(0.17, 0.03, PIPE[0], YT + 0.8, PIPE[1], 28), cyl(0.012, 0.05, PIPE[0], YT + 0.75, PIPE[1], 6));
  }

  for (const L of layers) { L.part.build(); for (const s of L.subs) s.part.build(); }

  // ---- the roof, measured: what it is built from and how big, in the secondary tint, riding with each floating layer.
  // A point on the south slope: x along the ridge, w square off the rafter line, t down the slope from the ridge.
  const PS = (x, w, t) => V(x, Y0 + w * CP - t * SP, w * SP + t * CP);
  const SLD = V(0, -SP, CP), SLN = V(0, CP, SP);
  if (dims) {
    // 06 roof structure
    dims.add('rafters', L6.g, PS(3.2, 0.22, T), PS(3.8, 0.22, T), SLD.clone().multiplyScalar(0.55), 'e = 600', { sub: 'Sparren KVH 80/220' });
    dims.add('rafters', L6.g, PS(XR, 0, 0.08), PS(XR, 0, T), SLN.clone().multiplyScalar(-0.42).add(V(0.02, 0, 0)), '5 350', { sub: 'Sparrenlänge', below: true });
    dims.add('rafters', L6.g, V(XR, Y0 - 0.3, 0.08), V(XR, Y0 + 0.14, 0.08), V(0.5, 0, 0.35), '440', { sub: 'Firstpfette BSH 160/440' });
    dims.angle('rafters', L6.g, V(XR + 0.02, Y0 - T * SP, T * CP), V(0, 0, -1), V(0, SP, -CP), 1.15, '40°', { sub: 'Dachneigung' });
    // 07 roof: the seam spacing on the zinc itself, the length along the eave, and the build-up from outside in
    dims.add('roof', L7.g, PS(-0.85, 0.485, 1.6), PS(-0.4, 0.485, 1.6), SLN.clone().multiplyScalar(0.01), 'e = 450', { sub: 'Stehfalz', ext: false });
    dims.add('roof', L7.g, PS(-XR, 0.42, T + 0.14), PS(XR, 0.42, T + 0.14), SLD.clone().multiplyScalar(0.75), '10 900', { sub: 'Dachlänge über Ortgang', below: true });
    dims.panel('roof', L7.g, PS(-XR - 0.02, 0.33, T + 0.035), `
      <div class="dp-h"><i>07 + 06</i>Dachaufbau · von außen</div>
      <table>
        <tr><td>0,7</td><td>Zink-Stehfalz · Falz 40 · e 450</td></tr>
        <tr><td>—</td><td>Strukturierte Trennlage</td></tr>
        <tr><td>200</td><td>Holzfaser-Dämmpaneel λ 0,040</td></tr>
        <tr><td>220</td><td>Sparren KVH 80/220 · e 600</td></tr>
        <tr><td>440</td><td>Firstpfette BSH GL24h 160/440</td></tr>
      </table>
      <div class="dp-f">Neigung 40° · Überstand 500 · U ≈ 0,19 W/m²K</div>`);
  }

  // ---- the stack: how far each level floats, and the order things land
  const LIFT = { 1: 2.0, 2: 4.3, 3: 9.3, 4: 14.6, 5: 19.6 };
  const PULL = { glazing: 3.2, cladding: 5.6 };
  const ORDER = ['floor', 'eg', 'og', 'glazing', 'cladding', 'rafters', 'roof'];
  const T0 = 0.045, STEP = 0.049, DUR = 0.064;
  const landAt = id => { const i = ORDER.indexOf(id); return [T0 + i * STEP, T0 + i * STEP + DUR]; };

  // ---- labels in a column right of the drawing, each on a corner of its layer
  const anchor = {
    floor: [L1.g, V(8.2, FL - 0.1, -ZO)],
    eg: [L2.g, V(XE, Y1, ZO)],
    og: [L3.g, V(XE, YP + PL, -ZO)],
    glazing: [gN2.g, V(N2[0][2], N2[0][3], -ZO)],
    cladding: [cN2.g, V(XE, CT, -ZO - D1)],
    rafters: [L6.g, V(XR, Y0 + 0.11 * CP - T * SP, -0.11 * SP - T * CP)],
    roof: [L7.g, V(XR, Y0 + 0.44 * CP - T * SP, -0.44 * SP - T * CP)],
  };
  const SHORT = { rafters: 'Sparren', eg: 'EG', og: 'OG', glazing: 'Glas' };
  for (const L of layers) { const [obj, at] = anchor[L.id]; L.label = labels.add({ no: L.no, name: L.name, short: SHORT[L.id], sub: L.sub, obj, at, rank: 10 - Number(L.no) }); }

  // ---- dotted lines between the floating layers
  const dash = liveLine(dashMat);
  const corners = [[XW, -ZO], [XE, -ZO], [XE, ZO], [XW, ZO]];

  // ---- camera: the long lens over the whole stack (0.00..0.40), dolly-zoom to the terrace (0.40..0.62),
  // then the walk: threshold, kitchen, stair foot, up the flight, the studio, and back along the ridge.
  const E1 = F + 1.42, E2Y = F2 + 1.5;
  const WALK = [
    { at: 0.620, e: [16.4, E1, 0.1], l: [XE, E1, 0], fov: 46, sy: -0.5, stop: 1, pe: [27.5, E1, 0.1], pf: 50, ps: -0.42 },
    { at: 0.660, e: [9.2, E1, -0.25], l: [1.0, 1.55, 0.2], fov: 50, sy: -0.24, pe: [11.5, E1, -0.25] },
    { at: 0.695, e: [5.75, E1, -0.6], l: [0.4, 1.2, 0.7], fov: 56, sy: -0.08, stop: 1 },
    { at: 0.735, e: [3.0, E1, -0.55], l: [-2.6, 1.2, -0.6], fov: 56, sy: -0.07 },
    { at: 0.770, e: [1.0, E1, 0.45], l: [-3.4, 1.15, -1.3], fov: 57, sy: -0.06, stop: 1 },
    { at: 0.800, e: [-1.7, E1, 0.36], l: [-4.4, 1.7, 1.4], fov: 57, sy: -0.06 },
    { at: 0.818, e: [-3.12, E1, 1.25], l: [-4.4, 1.6, 2.6], fov: 57, sy: -0.05 },
    { at: 0.832, e: [-3.3, E1, 2.62], l: [-4.6, 2.2, 2.1], fov: 57, sy: -0.05 },
    { at: 0.848, e: [-4.26, E1 + 0.08, 2.95], l: [-4.36, 3.45, -1.2], fov: 58, sy: -0.05, stop: 1 },
    { at: 0.880, e: [-4.27, 3.12, 0.6], l: [-3.2, 4.2, -2.6], fov: 58, sy: -0.05 },
    { at: 0.905, e: [-4.2, E2Y + 0.03, -2.05], l: [0.6, 4.25, -1.2], fov: 57, sy: -0.05 },
    { at: 0.925, e: [-2.9, E2Y, -1.3], l: [2.6, 4.05, 0.25], fov: 57, sy: -0.05, stop: 1 },
    { at: 0.948, e: [-0.4, E2Y, -0.2], l: [3.8, 3.95, 0.3], fov: 57, sy: -0.05 },
    { at: 0.962, e: [1.75, E2Y, -1.0], l: [4.0, 3.9, 0.6], fov: 57, sy: -0.05 },
    { at: 0.975, e: [3.4, E2Y, -1.95], l: [2.2, 3.9, 1.2], fov: 58, sy: -0.05 },
    { at: 0.988, e: [4.2, E2Y - 0.02, -1.95], l: [-4.6, 4.4, 1.4], fov: 60, sy: -0.06, stop: 1 },
    { at: 1.0, e: [4.2, E2Y - 0.02, -1.95], l: [-4.6, 4.4, 1.4], fov: 60, sy: -0.06, stop: 1 },
  ];
  const AX = { t: [0.9, 12.6, 0], az: 45, el: 27, fov: 1.5, h: 39.5, sx: -0.03, ph: { h: 74, sx: -0.2, sy: -0.15 } };
  const keys = [
    { at: 0, ...AX },
    { at: 0.40, ...AX },
    { at: 0.48, t: [0.9, 4.1, 0], az: 45, el: 27, fov: 1.5, h: 17, sx: 0.2, ph: { h: 40, sx: 0, sy: -0.3 } },
    { at: 0.52, t: [1.1, 4.0, 0], az: 42, el: 24, fov: 1.6, h: 16, sx: 0.16, ph: { h: 38, sx: 0, sy: -0.24 } },
    ...walkKeys(WALK),
  ];

  const STOPS = [
    { id: 'terrace', a: 0.53, b: 0.655, lv: 'PHASE 00 // MONTAGE ABGESCHLOSSEN', t: 'HÜLLE DICHT · TAG ELF', m: 'Sieben Schichten  ·  zwei Krantage  ·  kein Nassbau' },
    { id: 'living', a: 0.665, b: 0.74, lv: 'STATION 01 // OSTEINGANG · +0.33M', t: 'WOHNEN AM KAMIN', m: 'Glasschiebetür 3,40 m  ·  Kaminblock in weißem Ziegel  ·  Ecksofa' },
    { id: 'kitchen', a: 0.745, b: 0.805, lv: 'STATION 02 // KÜCHE & ESSEN · +0.33M', t: 'KÜCHE & KOCHINSEL', m: 'Steinplatte  ·  Esstisch für sechs  ·  zwei Glaskugeln' },
    { id: 'stair', a: 0.815, b: 0.89, lv: 'STATION 03 // TREPPE · 15 STEIGUNGEN', t: 'DIE HARFENTREPPE', m: 'Faltwerk aus geölter Eiche  ·  Stahlstäbe bis zur Decke' },
    { id: 'studio', a: 0.90, b: 0.955, lv: 'STATION 04 // OBERGESCHOSS · +3.13M', t: 'DAS DACHSTUDIO', m: 'Kniestock 1,40 m  ·  Bücherwand  ·  Arbeitsplatz am Bandfenster' },
    { id: 'ridge', a: 0.965, b: 1.01, lv: 'STATION 05 // UNTER DEM FIRST · 128 M²', t: 'DER GIEBELRAUM', m: '10,0 × 7,2 m  ·  First +7,90 m  ·  BSP, Eiche & Zink' },
  ];

  // the radar shows the floor the camera is on
  const RAD = {
    eg: `M${XW} ${-ZO} H${XE} V${ZO} H${XW} Z M${SX1} ${STOP} V${ZO} M${SX0} ${SZ} H${SX1} M${BX0} ${-ZO} H${BX1} V${BZ} H${BX0} Z M-3.1 -1.75 H-1.1 V-0.85 H-3.1 Z M-4.24 -3.44 H${BX0} V-2.84 H-4.24 Z M-2.6 1.4 H-0.4 V2.4 H-2.6 Z M1.62 1.95 H3.98 V2.9 H1.62 Z M5 -3.6 H8.2 V3.6 H5`,
    og: `M${XW} ${-ZO} H${XE} V${ZO} H${XW} Z M${SX1} ${STOP} V${ZO} M${SX0} ${STOP} H${SX1} M2.56 -0.97 H4.66 V0.97 H2.56 Z M4.66 -1.1 H4.78 V1.1 H4.66 Z M-2.8 2.55 H-0.6 V3.36 H-2.8 Z M-3.1 -3.44 H0.9 V-3.08 H-3.1 Z M1.9 -3.44 H4.1 V-2.96 H1.9 Z`,
  };
  const cmPlan = document.getElementById('cm-plan'), cmZones = document.getElementById('cm-zones'), cmScale = document.getElementById('cm-scale');
  let radFloor = '';

  function update(p, Tm = 99) {
    const land = {};
    for (const id of ORDER) { const [a, b] = landAt(id); land[id] = ease(win(p, a, b)); }
    // the roof's dimensions come up once the sheet is plotted and leave as each layer lands
    if (dims) {
      const d0 = win(Tm, 3.5, 4.3);
      dims.setOp('rafters', d0 * (1 - win(p, 0.33, 0.36)));
      dims.setOp('roof', d0 * (1 - win(p, 0.405, 0.43)));
    }
    const lv = { 1: 1 - land.floor, 2: 1 - land.eg, 3: 1 - land.og, 4: 1 - land.rafters, 5: 1 - land.roof };
    const lift = {}; let acc = 0, prev = 0;
    for (const k of [1, 2, 3, 4, 5]) { acc += (LIFT[k] - prev) * lv[k]; prev = LIFT[k]; lift[k] = acc; }
    const cur = ORDER.reduce((c, id) => p >= landAt(id)[0] - 0.006 ? id : c, null);
    for (const L of layers) {
      L.g.position.y = L.level ? lift[L.level] : 0;
      const pull = PULL[L.id] ? PULL[L.id] * (1 - land[L.id]) : 0;
      for (const s of L.subs) { s.g.position.copy(s.dir).multiplyScalar(pull); if (!L.level) s.g.position.y = lift[s.lv]; }
      // the layer in the air while it lands is drawn in the accent colour
      const [, b] = landAt(L.id);
      const on = L.id === cur && p < b + 0.012;
      for (const m of L.lines) m.color.set(on ? ACCENT : INK);
      L.label.on = on;
      L.label.op = (p > b + 0.012 ? 0.5 : 1) * (1 - win(p, 0.41, 0.455));
      L.label.dy = 0;
    }
    // the two glass leaves slide apart as the camera reaches the terrace
    const open = 1.66 * ease(win(p, 0.55, 0.655));
    leafN.g.position.z = -open; leafS.g.position.z = open;

    // dotted lines: plan to floor, floor to walls, storey to storey, walls to rafters, rafters to roof, and the sideways pulls
    const ls = [];
    const [y1, y2, y3, y4, y5] = [lift[1], lift[2], lift[3], lift[4], lift[5]];
    for (const [x, z] of corners) {
      if (y1 > 0.05) ls.push([x, -0.7 + y1, z, x, 0, z]);
      if (y2 - y1 > 0.05) ls.push([x, FL + y2, z, x, FL + y1, z]);
      if (y3 - y2 > 0.05) ls.push([x, Y1 + y3, z, x, Y1 + y2, z]);
      if (y4 - y3 > 0.05) ls.push([x, YP + PL + y4, z, x, YP + PL + y3, z]);
      const ez = Math.sign(z) * (T * CP), ey = Y0 - T * SP, sx = Math.sign(x) * XR;
      if (y5 - y4 > 0.05) ls.push([sx, ey + 0.22 * CP + y5, ez + Math.sign(z) * 0.22 * SP, sx, ey + 0.22 * CP + y4, ez + Math.sign(z) * 0.22 * SP]);
    }
    const gp = PULL.glazing * (1 - land.glazing), cp = PULL.cladding * (1 - land.cladding);
    if (gp > 0.05) {
      for (const z of [-ZI, ZI]) for (const y of [FL, YL]) ls.push([XE + gp, y + y2, z, XE, y + y2, z]);
      for (const z of [E2[0][0], E2[0][2]]) for (const y of [E2[0][1], E2[0][3]]) ls.push([XI + gp, y + y3, z, XE, y + y3, z]);
    }
    if (cp > 0.05) {
      for (const x of [XW - 0.05, XE]) for (const [ya, yb, yl] of [[C0, CM, y2], [CM + 0.02, CT, y3]]) for (const y of [ya, yb]) {
        ls.push([x, y + yl, ZO + 0.05 + cp, x, y + yl, ZO]); ls.push([x, y + yl, -ZO - 0.05 - cp, x, y + yl, -ZO]);
      }
      for (const z of [-ZO, ZO]) ls.push([XE + cp, CM + y3, z, XE, CM + y3, z]);
    }
    dash.set(ls);

    const landed = ORDER.filter(id => land[id] > 0.98).length;
    let cap = '', capOp = 0, activeStop = p < 0.52 ? 'axo' : 'terrace';
    for (const s of STOPS) {
      const fadeOut = s.id === 'ridge' ? 1 : (1 - win(p, s.b - 0.02, s.b));
      const v = win(p, s.a, s.a + 0.02) * fadeOut;
      if (v > capOp) { capOp = v; cap = `<span class="lv">${s.lv}</span><span class="t">${s.t}</span><span class="m">${s.m}</span>`; }
      if (p >= s.a - 0.01) activeStop = s.id;
    }
    const floor = p > 0.8 && camAt(keys, p).pos[1] > F2 + 0.4 ? 'og' : 'eg';
    if (floor !== radFloor && cmPlan) {
      radFloor = floor; cmPlan.setAttribute('d', RAD[floor]);
      if (cmScale) cmScale.textContent = floor === 'og' ? 'OG · 1:100' : 'EG · 1:100';
      cmZones?.querySelectorAll('.cm-zone').forEach(z => { z.style.display = z.dataset.floor === floor ? '' : 'none'; });
    }

    return {
      hero: 1 - clamp((p - 0.43) / 0.05),
      counter: p < 0.54 ? `Schicht <b>${String(Math.min(7, landed + (p > T0 ? 1 : 0))).padStart(2, '0')}</b> / 07` : '',
      hint: p < 0.42 ? 'Zum Aufbauen scrollen' : p < 0.66 ? 'Zum Hineingehen scrollen' : p < 0.96 ? 'Durch das Haus scrollen' : '',
      cap, capOp, stop: activeStop,
    };
  }
  // the fire is the only thing that moves on its own
  function introHook(Tm) {
    for (const m of flames) {
      const { k, i } = m.userData, a = Tm * (5.2 + i * 0.7) + i * 1.9;
      m.scale.set(1, k * (1 + 0.16 * Math.sin(a) + 0.07 * Math.sin(a * 2.3 + 1)), 1 + 0.25 * Math.sin(a * 0.8 + 2));
      m.rotation.x = 0.07 * Math.sin(a * 0.6);
    }
  }

  return {
    update, keys, R: 80, introHook,
    restFps: 12,          // a sheet at rest is still drawn now and then: the fire flickers
    // the house comes alive from its hearth: the colour spreads from the fire through the rooms, out over the
    // meadow and up into the sky. At the end it drains away from the top, the sky first, the floor last.
    live: {
      at: 0.6, soft: 1.8,
      in: { dir: [0, 0, 0], radial: 1, c: [0.65, 1.0, -2.0], min: 0, max: 30, noise: 2.0, dur: 3.5, pow: 1.3 },
      out: { dir: [0, -1, 0], radial: 0, min: -23, max: 1.0, noise: 1.4, dur: 4.0, pow: 0.5 },
      sun: [-0.55, 0.5, 0.67],
      room: [XW + 0.03, XE - 0.03, -ZO + 0.03, ZO - 0.03], roomY: [-0.5, YP + PL + 0.12, TP, 1],
      foot: [XW - 0.06, -ZO - 0.06, XE + 0.06, ZO + 0.06], foot2: [3.2, 1.8],
      groundY: -0.02,
      motes: { n: 300, min: [-4.7, 0.5, -3.3], max: [4.7, 7.4, 3.3], size: 0.018, color: '#f3f0e9' },
    },
    // in: the sheet is uncovered from the bottom up, the way it is plotted; out: it breaks up into cells
    xfer: { in: { mode: 'wipe', dir: [0, -1] }, out: { mode: 'dissolve' } },
    // the long lens comes down onto the board from high above; on the way out the eye goes up to the ridge
    camFx: (c, inU, outU) => {
      if (inU > 0 && !c.pos) { c.el += 30 * inU * inU; c.az -= 14 * inU; c.h *= 1 + 0.6 * inU; }
      if (outU > 0 && c.pos) { c.t[1] += 2.2 * outU; c.fov *= 1 + 0.1 * outU; }
    },
    play: { dur: 80 },
    // after the ridge room the camera swirls out to a three-quarter view of the front, the glass door and terrace
    swirl: { c: [0.5, 3.2, 0], pos: [13.5, 5.6, 12.0], look: [0.8, 3.4, 0], fov: 40, lift: 3 },
    colX: () => ctx.phone ? ctx.W - 100 : ctx.W * 0.725,
    draw: { dir: [0, 1, 0], radial: 0, min: -1, max: 29, soft: 1.5 },
    radar: {
      scale: 'EG · 1:100',
      viewBox: '-6.3 -4.4 16.2 8.8',
      plan: RAD.eg,
      strokeW: 0.16, dotR: 0.5, coneW: 0.14, coneLen: 2.6,
      clampX: [-5.6, 9.2], clampZ: [-3.5, 3.5],
      axoDot: [7.4, 2.9], axoAng: -2.35,
      zones: [
        { stop: 'stair', p: 0.848, tag: '03 // HARFENTREPPE', x: XW, y: -1.4, w: 1.3, h: 5.0, floor: 'eg' },
        { stop: 'kitchen', p: 0.77, tag: '02 // KÜCHE & ESSEN', x: -3.7, y: -ZO, w: 3.9, h: 7.2, floor: 'eg' },
        { stop: 'living', p: 0.695, tag: '01 // WOHNEN AM KAMIN', x: 0.2, y: -ZO, w: 4.8, h: 7.2, floor: 'eg' },
        { stop: 'terrace', p: 0.62, tag: 'TERRASSE // +0.30M', x: 5.0, y: -ZO, w: 3.2, h: 7.2, floor: 'eg' },
        { stop: 'studio', p: 0.925, tag: '04 // DACHSTUDIO +3.13M', x: XW, y: -ZO, w: 6.5, h: 7.2, floor: 'og' },
        { stop: 'ridge', p: 0.99, tag: '05 // GIEBELRAUM', x: 1.5, y: -ZO, w: 3.5, h: 7.2, floor: 'og' },
      ],
      stops: [
        { stop: 'axo', p: 0.18, tag: 'AXO-STAPEL // 01-07', label: 'AXO' },
        { stop: 'terrace', p: 0.62, tag: 'TERRASSE // +0.30M', label: 'TERR' },
        { stop: 'living', p: 0.695, tag: '01 // WOHNEN AM KAMIN', label: 'WOHNEN' },
        { stop: 'kitchen', p: 0.77, tag: '02 // KÜCHE & ESSEN', label: 'KÜCHE' },
        { stop: 'stair', p: 0.848, tag: '03 // HARFENTREPPE', label: 'TREPPE' },
        { stop: 'studio', p: 0.925, tag: '04 // DACHSTUDIO +3.13M', label: 'STUDIO' },
        { stop: 'ridge', p: 0.99, tag: '05 // GIEBELRAUM', label: 'FIRST' },
      ],
    },
    chrome: {
      title: 'three.js Demo 1 · Das Planblatt',
      dwg: 'AXO.04',
      brand: 'Purlin', brandSub: 'Holzhäuser',
      nav: 'Häuser     Werkstatt     Journal', cta: 'Haus anfragen',
      kicker: 'Axonometrie · Blatt A-04 · 1:100',
      loader: 'Plotte Blatt A-04',
      h1: 'Zwei Geschosse.<br>Sieben <em>Schichten.</em>',
      lede: 'Sieben Schichten, in unserer Werkstatt vorgefertigt und in elf Tagen auf der Baustelle geschlossen. Scrollen Sie, um das Haus zusammenzusetzen, und gehen Sie dann durch die große Glastür hinein und die Treppe hinauf bis unter den First.',
      spec: [['Haus', 'Haus Karbon'], ['Fläche', '128 m² · zwei Ebenen'], ['Hülle', 'BSP, Eiche geölt, Zink']],
      hint: 'Zum Aufbauen scrollen',
    },
  };
}

// ---- the walk. The stations are joined by a smooth curve instead of straight legs, so the camera rounds
// its corners; between two stops the pace eases in and out, and it flows through the points in between.
function walkKeys(st) {
  const n = st.length - 1;
  const eyes = new THREE.CatmullRomCurve3(st.map(s => V(...s.e)), false, 'centripetal');
  const looks = new THREE.CatmullRomCurve3(st.map(s => V(...s.l)), false, 'centripetal');
  const eyesP = new THREE.CatmullRomCurve3(st.map(s => V(...(s.pe || s.e))), false, 'centripetal');      // a phone stands further back outside
  const pf = s => s.pf ?? Math.min(s.fov + 15, 76), ps = s => s.ps ?? s.sy * 0.7;
  const stops = st.map((s, i) => s.stop ? i : -1).filter(i => i >= 0);
  const out = [], SUB = 10;
  for (let i = 0; i < n; i++) {
    const a = st[i], b = st[i + 1];
    const i0 = stops.filter(k => k <= i).pop(), i1 = stops.find(k => k > i);
    for (let k = i === 0 ? 0 : 1; k <= SUB; k++) {
      const t = k / SUB, at = lerp(a.at, b.at, t);
      const u = Math.min(1, (i0 + (i1 - i0) * ease2((i + t - i0) / (i1 - i0))) / n);     // position along the curve, 0..1
      const j = Math.min(n - 1, Math.floor(u * n)), f = u * n - j;
      const fov = Math.exp(lerp(Math.log(st[j].fov), Math.log(st[j + 1].fov), f)), sy = lerp(st[j].sy, st[j + 1].sy, f);
      const e = eyes.getPoint(u).toArray(), l = looks.getPoint(u).toArray();
      const fovP = Math.exp(lerp(Math.log(pf(st[j])), Math.log(pf(st[j + 1])), f)), syP = lerp(ps(st[j]), ps(st[j + 1]), f);
      out.push(eyeKey(at, e, l, fov, { sy, easeFn: x => x, ph: eyeKey(at, eyesP.getPoint(u).toArray(), l, fovP, { sy: syP }) }));
    }
  }
  delete out[0].easeFn;       // the dolly-zoom into the first station keeps its ease
  return out;
}

// ---- the ground floor plan, drawn once into a canvas: white ink on the black sheet
function drawPlan() {
  const S = 100, X = x => (x + 12) * S, Y = z => (z + 8) * S;
  return canvasTex(2400, 1600, (g) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, 2400, 1600);
    g.strokeStyle = INK; g.lineWidth = 2.2; g.strokeRect(36, 36, 2328, 1528);
    g.lineWidth = 1; g.strokeRect(46, 46, 2308, 1508);
    const line = (x0, z0, x1, z1, w = 2, dash = []) => { g.setLineDash(dash); g.lineWidth = w; g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.stroke(); g.setLineDash([]); };
    const box = (x0, z0, x1, z1, w = 2, fill) => { if (fill) { g.fillStyle = fill; g.fillRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0)); } g.lineWidth = w; g.strokeRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0)); };
    const circ = (x, z, r, w = 1.5) => { g.lineWidth = w; g.beginPath(); g.arc(X(x), Y(z), r * S, 0, 7); g.stroke(); };
    const tri = (x0, z0, x1, z1, x2, z2) => { g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.lineTo(X(x2), Y(z2)); g.closePath(); g.fill(); };
    g.strokeStyle = INK; g.fillStyle = INK;
    // grid with bubbles
    g.font = '500 26px "IBM Plex Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [[XW, 'A'], [BX0, 'B'], [XE, 'C'], [8.2, 'D']].forEach(([x, n]) => { line(x, -6.6, x, 6.0, 1.2, [24, 8, 4, 8]); g.beginPath(); g.arc(X(x), Y(-6.95), 24, 0, 7); g.stroke(); g.fillText(n, X(x), Y(-6.95)); });
    [[-ZO, '1'], [0, '2'], [ZO, '3']].forEach(([z, n]) => { line(-10.2, z, 10.2, z, 1.2, [24, 8, 4, 8]); g.beginPath(); g.arc(X(-10.55), Y(z), 24, 0, 7); g.stroke(); g.fillText(n, X(-10.55), Y(z)); });
    // roof line
    const ze = ZO + OH; line(-XR, -ze, XR, -ze, 1.5, [14, 10]); line(-XR, ze, XR, ze, 1.5, [14, 10]); line(-XR, -ze, -XR, ze, 1.5, [14, 10]); line(XR, -ze, XR, ze, 1.5, [14, 10]);
    // walls in poché, openings left open
    g.fillStyle = INK;
    const wallX = (z0, z1, holes) => { let a = XW; for (const [u0, u1] of holes.map(h => [h[0], h[2]]).sort((p, q) => p[0] - q[0])) { g.fillRect(X(a), Y(z0), X(u0) - X(a), Y(z1) - Y(z0)); a = u1; } g.fillRect(X(a), Y(z0), X(XE) - X(a), Y(z1) - Y(z0)); };
    wallX(ZI, ZO, S1); wallX(-ZO, -ZI, N1);
    { let a = -ZO; for (const [u0, , u1] of W1) { g.fillRect(X(XW), Y(a), X(XW + TH) - X(XW), Y(u0) - Y(a)); a = u1; } g.fillRect(X(XW), Y(a), X(XW + TH) - X(XW), Y(ZO) - Y(a)); }
    g.fillRect(X(XI), Y(DW), X(XE) - X(XI), 0.12 * S); g.fillRect(X(XI), Y(-DW - 0.12), X(XE) - X(XI), 0.12 * S);
    // glazing as thin double lines, the two leaves on their rail with the way they slide
    const glz = (a0, a1, w0, w1, alongX) => { for (const w of [w0 + 0.04, w1 - 0.04]) alongX ? line(a0, w, a1, w, 1.5) : line(w, a0, w, a1, 1.5); };
    for (const [u0, , u1] of S1) glz(u0, u1, ZI, ZO, true);
    for (const [u0, , u1] of N1) glz(u0, u1, -ZO, -ZI, true);
    for (const [u0, , u1] of W1) glz(u0, u1, XW, XW + TH, false);
    glz(DW + 0.12, ZI, XI, XE, false); glz(-ZI, -DW - 0.12, XI, XE, false);
    line(XE + 0.06, -DW, XE + 0.06, -0.02, 3.5); line(XE + 0.06, 0.02, XE + 0.06, DW, 3.5); line(XE + 0.06, -ZI, XE + 0.06, ZI, 0.8, [10, 8]);
    for (const s of [-1, 1]) { line(XE + 0.32, s * 0.2, XE + 0.32, s * 1.3, 1.2); tri(XE + 0.32, s * 1.48, XE + 0.24, s * 1.26, XE + 0.4, s * 1.26); }
    // chimney block (hatched), bench, kitchen
    g.save(); g.beginPath(); g.rect(X(BX0), Y(-ZI), (BX1 - BX0) * S, (BZ + ZI) * S); g.clip();
    for (let k = -4; k < 22; k++) line(BX0 - 0.1, -ZI + k * 0.16 + 0.7, BX1 + 0.1, -ZI + k * 0.16 - 0.1, 0.8);
    g.restore(); box(BX0, -ZI, BX1, BZ, 1.8); box(0.56, -2.56, 0.74, -1.64, 1, PAPER);
    box(BX1, -ZI, 1.3, BZ, 1.2);
    box(XW + TH, -ZI, -4.24, -1.44, 1.5); line(XW + TH, -ZI, -4.24, -1.44, 0.8); line(-4.24, -ZI, XW + TH, -1.44, 0.8);
    box(-4.24, -ZI, BX0, -2.84, 1.5); box(-2.6, -3.3, -1.95, -2.94, 1); circ(-2.28, -3.12, 0.1, 1);
    box(-3.16, -1.8, -1.04, -0.52, 1.5); box(-2.55, -1.6, -1.7, -1.08, 1); for (const [x, z] of [[-2.34, -1.47], [-1.92, -1.47], [-2.34, -1.21], [-1.92, -1.21]]) circ(x, z, 0.08, 1);
    for (const x of [-2.7, -2.1, -1.5]) circ(x, -0.44, 0.165, 1.2);
    // stair with its walking line, cut after the eighth riser
    box(SX0, STOP, SX1, SZ, 1.5);
    for (let i = 1; i < 9; i++) line(SX0, SZ - i * GO, SX1, SZ - i * GO, 1);
    for (let i = 9; i < NR - 1; i++) line(SX0, SZ - i * GO, SX1, SZ - i * GO, 0.8, [6, 6]);
    line(SX0 - 0.1, SZ - 8.2 * GO, SX1 + 0.1, SZ - 8.9 * GO, 1.5);
    const sm = (SX0 + SX1) / 2; line(sm, SZ + 0.25, sm, SZ - 7.4 * GO, 1.2); circ(sm, SZ + 0.25, 0.05, 1.2);
    tri(sm, SZ - 7.9 * GO, sm - 0.09, SZ - 7.2 * GO, sm + 0.09, SZ - 7.2 * GO);
    // table and chairs, sofa, tables, chair, sideboard, rug
    box(-2.6, 1.4, -0.4, 2.4, 1.5); for (const x of [-2.15, -1.5, -0.85]) { box(x - 0.21, 0.96, x + 0.21, 1.36, 1); box(x - 0.21, 2.44, x + 0.21, 2.84, 1); }
    box(1.42, 1.95, 4.18, 2.92, 1.5); box(3.23, 1.0, 4.18, 1.95, 1.5); line(1.62, 2.66, 3.98, 2.66, 1); line(1.25, 0.2, 4.45, 0.2, 1, [8, 6]); line(1.25, 0.2, 1.25, 1.5, 1, [8, 6]); line(4.45, 0.2, 4.45, 1.0, 1, [8, 6]);
    circ(2.45, 1.05, 0.44); circ(3.2, 0.5, 0.29); box(0.6, 1.56, 1.32, 2.25, 1.5); line(0.82, 1.6, 0.82, 2.2, 1); box(1.7, -ZI, 3.0, -2.98, 1.5); circ(4.32, -2.92, 0.21); circ(1.16, 2.72, 0.17, 1);
    // terrace boards, step, trough, lounger
    for (let z = -ZO + 0.14; z < ZO; z += 0.14) line(XE + 0.12, z, 8.2, z, 0.7);
    box(XE, -ZO, 8.2, ZO, 1.5); box(8.24, -1.9, 8.66, 1.9, 1.2); box(5.5, -3.42, 7.7, -2.8, 1.5, PAPER); box(5.95, 2.05, 7.75, 2.75, 1.2, PAPER);
    // room names and levels
    const label = (t, x, z, f) => { g.font = f; const w = g.measureText(t).width + 16; g.fillStyle = PAPER; g.fillRect(X(x) - w / 2, Y(z) - 17, w, 34); g.fillStyle = INK; g.fillText(t, X(x), Y(z)); };
    label('WOHNEN', 2.6, -0.85, '700 32px "Chakra Petch"'); label('KÜCHE', -2.1, -2.3, '700 32px "Chakra Petch"'); label('TERRASSE', 6.6, -0.4, '700 32px "Chakra Petch"');
    label('ESSEN', -1.5, 0.5, '600 26px "Chakra Petch"');
    label('66 M² · OKFF +0.33', 2.6, -0.5, '400 20px "IBM Plex Mono"'); label('DECK +0.30', 6.6, -0.05, '400 20px "IBM Plex Mono"');
    label('15 STG 18.7/27', -4.34, 3.02, '500 15px "IBM Plex Mono"');
    // dimensions along the south side and the east
    const dim = (x0, x1, z, t) => { line(x0, z, x1, z, 1.2); for (const x of [x0, x1]) line(x - 0.12, z + 0.12, x + 0.12, z - 0.12, 2); g.font = '400 22px "IBM Plex Mono"'; g.fillText(t, X((x0 + x1) / 2), Y(z) - 18); };
    dim(XW, XE, 5.0, '10 000'); dim(XW, BX0, 5.7, '5 200'); dim(BX0, XE, 5.7, '4 800'); dim(XE, 8.2, 5.7, '3 200');
    g.save(); g.translate(X(9.6), Y(0)); g.rotate(-Math.PI / 2); g.font = '400 22px "IBM Plex Mono"'; g.fillText('7 200', 0, -18); g.restore();
    line(9.6, -ZO, 9.6, ZO, 1.2); for (const z of [-ZO, ZO]) line(9.48, z + 0.12, 9.72, z - 0.12, 2);
    // north arrow, scale bar, title block
    g.lineWidth = 1.5; g.beginPath(); g.arc(X(10.6), Y(-6.4), 34, 0, 7); g.stroke(); g.beginPath(); g.moveTo(X(10.6), Y(-6.4) - 44); g.lineTo(X(10.6) - 12, Y(-6.4) + 10); g.lineTo(X(10.6) + 12, Y(-6.4) + 10); g.closePath(); g.fill();
    g.textAlign = 'left'; g.font = '700 30px "Chakra Petch"'; g.fillText('ERDGESCHOSS', X(-10.9), Y(6.95)); g.font = '400 20px "IBM Plex Mono"'; g.fillText('HAUS KARBON · 1:100 · PLAN A-01', X(-10.9), Y(7.3));
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 === 0 ? INK : PAPER;
      g.fillRect(X(6.5 + i * 0.8), Y(7.02), 0.8 * S, 10); g.lineWidth = 1.2;
      g.strokeRect(X(6.5 + i * 0.8), Y(7.02), 0.8 * S, 10);
    }
    g.fillStyle = INK; g.font = '500 18px "IBM Plex Mono"'; g.fillText('0', X(6.5), Y(7.32)); g.fillText('5 M', X(10.2), Y(7.32));
  });
}
