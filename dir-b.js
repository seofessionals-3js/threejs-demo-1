// Direction B, "The Unfolded Room": the interior designer's developed elevations. The floor plan in the
// middle, the four walls folded out flat around it, the ceiling beyond the window wall, all annotated like
// a real sheet: dimensions, material codes, elevation titles. Everything on the sheet is flat and washed
// out like a coloured drawing. Scroll folds it into a closed box, the colour comes in, the door opens and
// you walk into a small living room and study. At the end the camera swirls out, the ceiling slides back,
// the two near walls drop, and the room stands there as a cutaway model.
import {
  THREE, Part, bx, cyl, ball, beam, panel, M, V, clamp, lerp, ease, win,
  scene, renderer, camera, lineMat, stdMat, eyeKey, canvasTex, rng, DRAW, patchFill, INK, segs,
} from './core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const RX = 2.4, RZ = 2.4, H = 3.0, TH = 0.12, OX = RX + TH, OZ = RZ + TH;
const NZ = -OZ - H;                           // where the top of the window wall lies on the sheet
// a soft box: cushions, upholstery
function rb(x0, y0, z0, x1, y1, z1, r = 0.04) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
// turn a piece about a point
function tilt(g, c, rx = 0, ry = 0, rz = 0) {
  g.translate(-c[0], -c[1], -c[2]);
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(c[0], c[1], c[2]); return g;
}
// leaves: flat outlines, base at the origin, tipped outwards and turned to their heading
const ell = (w, h) => { const s = new THREE.Shape(); s.absellipse(0, h, w, h, 0, Math.PI * 2, false); return s; };
const LEAF = { olive: ell(0.022, 0.05), broad: ell(0.075, 0.11), herb: ell(0.018, 0.035) };
function leafGeo(shape, k, th, head, p) {
  const g = new THREE.ShapeGeometry(shape, 10);
  g.scale(k, k, k); g.rotateX(th); g.rotateY(Math.PI / 2 - head); g.translate(p.x, p.y, p.z); return g;
}
// a small tree: a trunk, branches into a crown, leaves along each branch
function tree(part, x, y0, z, o) {
  const r = rng(o.seed ?? 5), top = V(x + (o.lean ?? 0), y0 + o.trunk, z);
  part.add('stem', beam(V(x, y0, z), top, o.tw ?? 0.02, o.tw ?? 0.02));
  for (let b = 0; b < o.branches; b++) {
    const a = b * 2.399 + r(), rr = o.R * (0.45 + 0.55 * r());
    const end = V(top.x + Math.cos(a) * rr, top.y + o.H * (0.2 + 0.8 * r()), z + Math.sin(a) * rr);
    part.add('stem', beam(top, end, 0.007, 0.007));
    for (let j = 0; j < o.per; j++) {
      const t = Math.min(1, 0.28 + 0.72 * (j + r() * 0.6) / o.per), p = top.clone().lerp(end, t);
      part.add(o.key ?? 'leaf', leafGeo(o.shape, (o.k ?? 1) * (0.8 + 0.4 * r()), 0.5 + r() * 0.8, a + (j % 2 ? 1.3 : -1.3) + (r() - 0.5), p));
    }
  }
}
// a plant that carries one leaf on each stem
function broad(part, x, y0, z, o) {
  const r = rng(o.seed ?? 9);
  for (let i = 0; i < o.n; i++) {
    const a = i * 2.399 + (o.seed ?? 0), rr = o.R * (0.35 + 0.65 * r());
    const end = V(x + Math.cos(a) * rr, y0 + o.H * (0.45 + 0.55 * r()), z + Math.sin(a) * rr);
    part.add('stem', beam(V(x, y0, z), end, 0.006, 0.006));
    part.add(o.key ?? 'leaf', leafGeo(o.shape, (o.k ?? 1) * (0.8 + 0.4 * r()), 0.8 + r() * 0.6, a, end));
  }
}
// cut flowers in a vase
function blooms(part, x, y0, z, h, n, key = 'bloom', seed = 3) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399, rr = 0.02 + r() * 0.05, e = V(x + Math.cos(a) * rr, y0 + h * (0.7 + 0.3 * r()), z + Math.sin(a) * rr);
    part.add('stem', beam(V(x, y0, z), e, 0.004, 0.004));
    part.add(key, ball(0.018 + r() * 0.012, e.x, e.y, e.z, 1));
  }
}

export async function build(labels) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const hemi = new THREE.HemisphereLight('#ffffff', '#8f8f98', 2.3); scene.add(hemi);
  // a pendant over the middle of the room while you are inside
  const lamp = new THREE.SpotLight('#fff3e6', 0, 4.4, 0.7, 0.35, 1.2);
  lamp.position.set(0.3, 2.3, 0.1); lamp.target.position.set(0.4, 0, 0); scene.add(lamp, lamp.target);
  // the sun starts in the south-west, so shadows fall away from the copy, and comes round behind the window
  // wall: it reaches in through the window while the room is closed, and once the near walls are gone it
  // lights the brick wall and the front of the floor and leaves the sofa in the shade of the window wall
  const SUN_A = V(-7, 11, 8), SUN_B = V(9, 8.5, -6);
  // for the cutaway it drops lower and further round to the north-east: the window wall lays a long shadow
  // across the sofa, the table and half the rug, and the brick wall, the east end and the front of the floor stay lit
  const SUN_C = V(7.5, 17, -4.5);   // high and soft: both walls of the cutaway read bright, as in a studio render
  let swK = 0;
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.position.copy(SUN_A); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3; sun.target.position.set(0, 0, -1.5);
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.3 }));
  ground.position.y = -0.125; ground.receiveShadow = true; scene.add(ground);
  // in colour the box stands on a pale studio floor that runs out into the backdrop
  const studio = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), patchFill(new THREE.MeshBasicMaterial({ color: '#ffffff' }), { real: '#cfcdc9', wash: false, grain: 0, grade: false, island: [0, 0, 44, 44, 1] }));
  studio.position.y = -0.13; studio.renderOrder = -5; scene.add(studio);

  const T = buildTextures();
  const art = (map) => ({ mat: stdMat('#ffffff', { map, bumpMap: T.fabricBump, bumpScale: 0.006, rough: 0.8, flat: 0.7 }) });
  const book = (c) => ({ mat: stdMat(c, { rough: 0.7 }), w: 'mid' });
  const PAL = {
    plaster: { mat: stdMat('#2b2b30', { real: '#eceae6', rough: 0.92, map: T.plaster, bumpMap: T.plasterBump, bumpScale: 0.004, flat: 0.75 }), uvScale: 0.35 },
    ceiling: { mat: stdMat('#303035', { real: '#d2cec8', rough: 0.92, map: T.plaster, bumpMap: T.plasterBump, bumpScale: 0.003, emissive: '#1c1c20', emissiveIntensity: 0.22, flat: 0.75 }), uvScale: 0.35 },
    base: { mat: stdMat('#1b1b1e', { real: '#d3d0cb', rough: 0.88, bumpMap: T.plasterBump, bumpScale: 0.005, flat: 0.7 }), uvScale: 0.5 },
    brick: { mat: stdMat('#34343a', { real: '#f3f1ed', map: T.brick.map, bumpMap: T.brick.bump, bumpScale: 0.03, rough: 0.9, flat: 0.7 }), uvScale: 1 / 0.96, thr: 60 },
    floor: { mat: stdMat('#5c5c62', { real: '#ecebe8', map: T.floor.map, bumpMap: T.floor.bump, bumpScale: 0.012, rough: 0.55, env: 0.45, flat: 0.1 }), thr: 60 },
    oak: { mat: stdMat('#7c7c82', { map: T.oak.map, bumpMap: T.oak.bump, bumpScale: 0.014, rough: 0.56, env: 0.45, flat: 0.3 }), uvScale: 0.8 },
    woodL: { mat: stdMat('#9a9aa0', { map: T.birch.map, bumpMap: T.birch.bump, bumpScale: 0.01, rough: 0.6, env: 0.4, flat: 0.4 }), uvScale: 0.8 },
    white: { mat: stdMat('#d2d2d6', { real: '#d9d8d5', rough: 0.5, env: 0.5, flat: 0.45 }) },
    sofa: { mat: stdMat('#dcd9d4', { real: '#f2f1ee', rough: 0.94, bumpMap: T.fabricBump, bumpScale: 0.02, flat: 0.4 }), uvScale: 2.2, hull: 1, thr: 50 },
    pillow: { mat: stdMat('#c2202b', { real: '#dcdddd', rough: 0.9, bumpMap: T.fabricBump, bumpScale: 0.022, flat: 0.45 }), uvScale: 2.2, hull: 1, thr: 50 },
    chair: { mat: stdMat('#dcd9d4', { real: '#d2d1cf', rough: 0.92, bumpMap: T.fabricBump, bumpScale: 0.02, flat: 0.4 }), uvScale: 2.2, hull: 1, thr: 50 },
    ink: { mat: stdMat('#0f0f11', { real: '#26272a', rough: 0.42, metal: 0.3 }) },
    alu: { mat: stdMat('#8e8e94', { real: '#c9cbcd', rough: 0.34, metal: 0.5, env: 0.7 }) },
    screen: { mat: stdMat('#e9e9ee', { real: '#f1f2f3', rough: 0.2, env: 0.6, emissive: '#2a2a2e', emissiveIntensity: 0.5, flat: 0.8 }) },
    frame: { mat: stdMat('#141416', { real: '#24221f', rough: 0.5, metal: 0.2 }) },
    glass: { mat: stdMat('#dfe6ea', { real: '#e3ecef', opacity: 0.16, rough: 0.08, env: 0.8 }), cast: false, edges: false },
    rug: { mat: stdMat('#a0a0a0', { map: T.rug.map, bumpMap: T.rug.bump, bumpScale: 0.03, rough: 0.95, flat: 0.25 }), thr: 60 },
    blind: { mat: stdMat('#c9c9ce', { real: '#cdcdcc', rough: 0.9, bumpMap: T.fabricBump, bumpScale: 0.008, flat: 0.6 }), uvScale: 3 },
    shade: { mat: stdMat('#fff8ee', { real: '#f4efe6', emissive: '#f2ece2', emissiveIntensity: 0.4, bumpMap: T.fabricBump, bumpScale: 0.01 }), uvScale: 1.5, hull: 1, edges: false },
    leaf: { mat: stdMat('#2f3431', { real: '#6f7653', sway: 0.008, rough: 0.8, side: THREE.DoubleSide, flat: 0.45 }), w: 'mid', thr: 20 },
    leaf2: { mat: stdMat('#3a403c', { real: '#59653f', sway: 0.008, rough: 0.8, side: THREE.DoubleSide, flat: 0.45 }), w: 'mid', thr: 20 },
    stem: { mat: stdMat('#3a3a3e', { real: '#6b5a40', rough: 0.85 }), w: 'mid' },
    pot: { mat: stdMat('#d6d3ce', { real: '#d6d5d2', rough: 0.6, flat: 0.45 }), hull: 1 },
    potD: { mat: stdMat('#3a3a3e', { real: '#3b3b3c', rough: 0.6 }), hull: 1 },
    terra: { mat: stdMat('#c2202b', { real: '#b98564', rough: 0.85 }), hull: 1 },
    wicker: { mat: stdMat('#8a8a90', { real: '#b08b5c', rough: 0.95, bumpMap: T.fabricBump, bumpScale: 0.05 }), uvScale: 5, hull: 1, thr: 50 },
    pink: { mat: stdMat('#c2202b', { real: '#c9ada3', rough: 0.7 }), thr: 50 },
    tan: { mat: stdMat('#a8a8ae', { real: '#c3a27c', rough: 0.75 }), hull: 1, thr: 40 },
    vaseY: { mat: stdMat('#d6d3ce', { real: '#dcc98f', rough: 0.6 }), hull: 1 },
    bloom: { mat: stdMat('#c2202b', { real: '#d9a2a6', rough: 0.9 }), edges: false },
    bloomW: { mat: stdMat('#e6e6ea', { real: '#e8e2d6', rough: 0.9 }), edges: false },
    slipper: { mat: stdMat('#8a8a90', { real: '#b89468', rough: 0.9 }), thr: 50 },
    poster: art(T.poster), tapestry: art(T.tapestry), quote: art(T.quote), artY: art(T.artY), artC: art(T.artC), artD: art(T.artD),
    b1: book('#a14a33'), b2: book('#2f4b5e'), b3: book('#d9c8a1'), b4: book('#c9a3a0'), b5: book('#e6e1d8'),
  };
  const line = lineMat({ w: 0.95, color: INK, opacity: 0.88 });
  const W = { mid: lineMat({ w: 0.6, color: INK, opacity: 0.6 }) };
  const mkPart = g => new Part(g, PAL, line, W);

  // ---- floor and the things that stand on it
  const floor = new THREE.Group(); scene.add(floor);
  const fp = mkPart(floor);
  fp.add('base', bx(-OX, -0.12, -OZ, OX, -0.02, OZ));
  fp.add('floor', bx(-RX, -0.02, -RZ, RX, 0, RZ));
  const fItems = new THREE.Group(); floor.add(fItems); const fi = mkPart(fItems);

  // the rug and the low oak table on it, with baskets and boxes underneath
  fi.add('rug', bx(-0.72, 0, -0.67, 1.85, 0.012, 1.05));
  fi.add('oak', bx(-0.42, 0.36, -0.35, 1.32, 0.42, 0.41), bx(-0.4, 0.012, -0.33, -0.34, 0.36, 0.39), bx(1.24, 0.012, -0.33, 1.3, 0.36, 0.39));
  fi.add('wicker', rb(-0.28, 0.014, -0.2, 0.1, 0.26, 0.28, 0.03), cyl(0.17, 0.17, 0.4, 0.014, 0.06, 24, 0.15));
  fi.add('white', rb(0.64, 0.014, -0.06, 0.9, 0.26, 0.3, 0.015), rb(0.93, 0.014, -0.06, 1.19, 0.26, 0.3, 0.015));
  fi.add('ink', bx(0.72, 0.17, 0.3, 0.82, 0.185, 0.304), bx(1.01, 0.17, 0.3, 1.11, 0.185, 0.304));
  fi.add('pot', cyl(0.028, 0.13, 0.02, 0.42, -0.02, 20, 0.04));
  blooms(fi, 0.02, 0.5, -0.02, 0.2, 6, 'bloomW', 4);
  fi.add('b5', tilt(bx(0.72, 0.42, -0.02, 1.02, 0.434, 0.2), [0.87, 0.42, 0.09], 0, 0.3));
  fi.add('b4', tilt(bx(0.78, 0.434, 0.0, 1.0, 0.446, 0.17), [0.89, 0.43, 0.08], 0, -0.2));

  // the sofa under the window
  fi.add('sofa', rb(-1.05, 0.14, -2.25, 1.55, 0.32, -1.2, 0.05), rb(-1.05, 0.14, -2.27, 1.55, 0.84, -2.05, 0.07),
    rb(-1.05, 0.14, -2.25, -0.88, 0.62, -1.2, 0.07), rb(1.38, 0.14, -2.25, 1.55, 0.62, -1.2, 0.07),
    rb(-0.88, 0.3, -2.06, 0.245, 0.47, -1.18, 0.07), rb(0.255, 0.3, -2.06, 1.38, 0.47, -1.18, 0.07),
    tilt(rb(-0.87, 0.45, -2.1, 0.24, 0.9, -1.9, 0.09), [0, 0.45, -2.0], -0.1), tilt(rb(0.26, 0.45, -2.1, 1.37, 0.9, -1.9, 0.09), [0, 0.45, -2.0], -0.1));
  fi.add('pillow', tilt(rb(-0.84, 0.47, -1.86, -0.42, 0.87, -1.72, 0.07), [-0.63, 0.47, -1.79], -0.3, 0.2),
    tilt(rb(-0.5, 0.47, -1.76, -0.12, 0.83, -1.63, 0.065), [-0.31, 0.47, -1.7], -0.35, -0.15),
    tilt(rb(0.93, 0.47, -1.84, 1.34, 0.86, -1.7, 0.07), [1.13, 0.47, -1.77], -0.3, -0.25));
  for (const [x, z] of [[-0.98, -2.18], [1.48, -2.18], [-0.98, -1.27], [1.48, -1.27], [0.25, -1.27]]) fi.add('woodL', cyl(0.012, 0.14, x, 0, z, 10, 0.02));

  // the side table with the record player, and the olive tree in the corner
  fi.add('white', bx(-1.62, 0.47, -2.22, -1.12, 0.5, -1.72), bx(-1.6, 0.14, -2.2, -1.14, 0.165, -1.74));
  for (const [x, z] of [[-1.6, -2.2], [-1.14, -2.2], [-1.6, -1.74], [-1.14, -1.74]]) fi.add('white', bx(x - 0.016, 0, z - 0.016, x + 0.016, 0.47, z + 0.016));
  fi.add('b5', bx(-1.52, 0.165, -2.1, -1.24, 0.2, -1.86)); fi.add('b3', bx(-1.5, 0.2, -2.08, -1.26, 0.225, -1.88));
  fi.add('pink', rb(-1.57, 0.5, -2.16, -1.17, 0.6, -1.82, 0.015), tilt(rb(-1.57, 0.6, -2.19, -1.17, 0.9, -2.15, 0.012), [-1.37, 0.6, -2.17], -0.12));
  fi.add('ink', cyl(0.125, 0.008, -1.4, 0.6, -1.98, 32));
  fi.add('alu', cyl(0.02, 0.012, -1.4, 0.6, -1.98, 16), bx(-1.24, 0.61, -2.05, -1.225, 0.62, -1.88));
  fi.add('pot', cyl(0.13, 0.44, -1.99, 0, -1.66, 32, 0.15));
  tree(fi, -1.99, 0.42, -1.66, { trunk: 0.55, H: 0.75, R: 0.3, branches: 13, per: 10, shape: LEAF.olive, k: 1.15, seed: 21, lean: 0.03 });

  // the cabinet beside the desk
  fi.add('white', bx(-2.4, 0.08, -1.35, -2.0, 1.42, -0.77));
  fi.add('woodL', bx(-2.0, 0.52, -1.35, -1.992, 0.532, -0.77), bx(-2.0, 0.97, -1.35, -1.992, 0.982, -0.77));
  fi.add('white', bx(-2.4, 1.42, -1.36, -1.99, 1.435, -0.76));
  for (const y of [0.3, 0.75, 1.2]) fi.add('woodL', bx(-2.0, y - 0.05, -0.84, -1.985, y + 0.05, -0.825));
  for (const [x, z] of [[-2.36, -1.31], [-2.04, -1.31], [-2.36, -0.81], [-2.04, -0.81]]) fi.add('woodL', bx(x - 0.015, 0, z - 0.015, x + 0.015, 0.08, z + 0.015));

  // the desk along the brick wall: a top on two pedestals
  fi.add('white', bx(-2.4, 0.72, -0.75, -1.58, 0.76, 1.75));
  fi.add('white', bx(-2.36, 0.03, -0.73, -1.6, 0.72, -0.3), bx(-2.36, 0.03, 1.2, -1.6, 0.5, 1.73), bx(-2.36, 0.5, 1.2, -1.6, 0.72, 1.225), bx(-2.36, 0.5, 1.705, -1.6, 0.72, 1.73), bx(-2.36, 0.5, 1.2, -2.335, 0.72, 1.73));
  for (const [y0, y1] of [[0.05, 0.26], [0.28, 0.49], [0.51, 0.7]]) {
    fi.add('white', bx(-1.6, y0, -0.72, -1.585, y1, -0.31));
    fi.add('woodL', bx(-1.585, (y0 + y1) / 2 - 0.006, -0.58, -1.57, (y0 + y1) / 2 + 0.006, -0.45));
  }
  for (const [y0, y1] of [[0.05, 0.26], [0.28, 0.49]]) {
    fi.add('white', bx(-1.6, y0, 1.21, -1.585, y1, 1.72));
    fi.add('woodL', bx(-1.585, (y0 + y1) / 2 - 0.006, 1.4, -1.57, (y0 + y1) / 2 + 0.006, 1.53));
  }
  fi.add('terra', cyl(0.035, 0.07, -1.72, 0.5, 1.32, 16)); fi.add('ink', bx(-1.78, 0.5, 1.42, -1.66, 0.6, 1.5), bx(-1.76, 0.5, 1.55, -1.68, 0.56, 1.64));
  // on the desk: screen, keyboard, mouse, a rack of folders, a flask, a mug, a notebook, flowers
  fi.add('alu', bx(-2.24, 0.76, 0.3, -2.08, 0.77, 0.5), bx(-2.2, 0.77, 0.37, -2.175, 1.0, 0.43), bx(-2.175, 0.9, 0.08, -2.145, 1.3, 0.72),
    bx(-1.96, 0.76, 0.2, -1.84, 0.772, 0.6));
  fi.add('screen', bx(-2.146, 0.915, 0.095, -2.14, 1.285, 0.705));
  fi.add('white', rb(-1.93, 0.76, 0.04, -1.87, 0.785, 0.14, 0.012), cyl(0.04, 0.09, -1.9, 0.76, -0.14, 20));
  fi.add('ink', cyl(0.034, 0.22, -2.18, 0.76, -0.6, 20), cyl(0.02, 0.04, -2.18, 0.98, -0.6, 16));
  fi.add('ink', bx(-2.32, 0.76, -0.4, -2.12, 0.775, -0.08), bx(-2.32, 0.76, -0.4, -2.31, 0.98, -0.08));
  [['b4', -0.37], ['b5', -0.32], ['b2', -0.27], ['b3', -0.22], ['b4', -0.17], ['b5', -0.12]].forEach(([c, z], i) => fi.add(c, tilt(bx(-2.3, 0.775, z, -2.14, 1.03 - (i % 3) * 0.02, z + 0.03), [-2.3, 0.775, z], 0, 0, -0.12)));
  fi.add('b2', bx(-2.0, 0.76, -0.38, -1.8, 0.775, -0.22));
  fi.add('pot', cyl(0.035, 0.2, -2.18, 0.76, 1.5, 20, 0.028));
  blooms(fi, -2.18, 0.92, 1.5, 0.26, 7, 'bloom', 8);
  for (let i = 0; i < 4; i++) fi.add('white', bx(-2.3, 0.76, 0.98 + i * 0.075, -2.27, 0.84, 1.03 + i * 0.075));
  fi.add('alu', cyl(0.035, 0.1, -2.22, 0.76, 0.86, 16));

  fi.add('pot', cyl(0.12, 0.3, -1.98, 0, -0.02, 24));
  // the chair at the desk, slippers under it
  fi.add('chair', rb(-1.56, 0.4, 0.2, -1.06, 0.5, 0.7, 0.045), tilt(rb(-1.14, 0.44, 0.2, -1.05, 0.95, 0.7, 0.04), [-1.1, 0.44, 0.45], 0, 0, -0.12));
  for (const [x, z, a] of [[-1.5, 0.26, 0.1], [-1.5, 0.64, 0.1], [-1.12, 0.26, -0.1], [-1.12, 0.64, -0.1]]) fi.add('woodL', tilt(cyl(0.011, 0.41, x, 0, z, 10, 0.019), [x, 0.41, z], 0, 0, a));
  fi.add('slipper', rb(-1.92, 0, 0.82, -1.68, 0.035, 0.92, 0.015), rb(-1.9, 0, 0.96, -1.66, 0.035, 1.06, 0.015));

  // by the end of the brick wall: a plant on a rattan stand and a small white printer on the floor
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; fi.add('woodL', beam(V(-2.18 + Math.cos(a) * 0.12, 0, 2.12 + Math.sin(a) * 0.12), V(-2.18 + Math.cos(a) * 0.08, 0.24, 2.12 + Math.sin(a) * 0.08), 0.018, 0.018)); }
  fi.add('wicker', cyl(0.1, 0.2, -2.18, 0.22, 2.12, 24, 0.13));
  broad(fi, -2.18, 0.4, 2.12, { n: 9, H: 0.5, R: 0.2, shape: LEAF.broad, k: 1.0, seed: 2, key: 'leaf2' });
  fi.add('white', rb(-1.95, 0, 2.0, -1.5, 0.2, 2.33, 0.02)); fi.add('ink', bx(-1.5, 0.05, 2.05, -1.494, 0.12, 2.28));

  // the plants at the far end of the sofa
  fi.add('pot', cyl(0.12, 0.4, 1.94, 0, -1.65, 32, 0.17));
  tree(fi, 1.94, 0.38, -1.65, { trunk: 0.5, H: 0.8, R: 0.4, branches: 17, per: 11, shape: LEAF.olive, k: 1.3, seed: 33 });
  fi.add('potD', cyl(0.09, 0.2, 2.16, 0, -1.95, 24, 0.11));
  tree(fi, 2.16, 0.18, -1.95, { trunk: 0.35, H: 0.6, R: 0.27, branches: 13, per: 10, shape: LEAF.olive, k: 1.1, seed: 41, key: 'leaf2', tw: 0.014 });
  for (let i = 0; i < 3; i++) { const a = i * 2.094; fi.add('woodL', beam(V(2.0 + Math.cos(a) * 0.12, 0, -1.15 + Math.sin(a) * 0.12), V(2.0 + Math.cos(a) * 0.07, 0.28, -1.15 + Math.sin(a) * 0.07), 0.018, 0.018)); }
  fi.add('woodL', cyl(0.1, 0.02, 2.0, 0.27, -1.15, 20));
  fi.add('pot', cyl(0.07, 0.14, 2.0, 0.29, -1.15, 24, 0.09));
  broad(fi, 2.0, 0.42, -1.15, { n: 10, H: 0.44, R: 0.25, shape: LEAF.broad, k: 1.4, seed: 6 });
  fp.build(); fi.build();
  // soft contact shadows under the furniture and along the standing walls; they come and go with the colour
  const aoMat = patchFill(new THREE.MeshBasicMaterial({ map: contactShadows(), transparent: true, depthWrite: false }), { wash: false, grain: 0, grade: false, island: [0, 0, 44, 44, 1] });
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ).rotateX(-Math.PI / 2), aoMat);
  ao.position.y = 0.014; ao.renderOrder = 3; floor.add(ao);

  // ---- the walls, each hinged on its outer bottom edge
  const walls = {};
  function wall(id, pos) {
    const pivot = new THREE.Group(); pivot.position.set(...pos); scene.add(pivot);
    const items = new THREE.Group(); pivot.add(items);
    const w = { id, pivot, items, wp: mkPart(pivot), ip: mkPart(items) };
    walls[id] = w; return w;
  }
  const N = wall('north', [0, 0, -OZ]);
  const S = wall('south', [0, 0, OZ]);
  const Wst = wall('west', [-OX, 0, 0]);
  const E = wall('east', [OX, 0, 0]);
  N.items.position.z = TH; S.items.position.z = -TH; Wst.items.position.x = TH; E.items.position.x = -TH;

  // A the window wall: timber window with a half-drawn blind, two shelves, a framed print
  const WX0 = -0.9, WX1 = 1.3, WV0 = 0.92, WV1 = 2.1, f = 0.05;
  N.wp.add('plaster', panel([[-OX, 0], [OX, 0], [OX, H], [-OX, H]], [[[WX0, WV0], [WX1, WV0], [WX1, WV1], [WX0, WV1]]], TH));
  N.wp.add('woodL', bx(WX0, WV0, 0, WX1, WV0 + f, TH), bx(WX0, WV1 - f, 0, WX1, WV1, TH), bx(WX0, WV0, 0, WX0 + f, WV1, TH), bx(WX1 - f, WV0, 0, WX1, WV1, TH));
  for (const x of [WX0 + (WX1 - WX0) / 3, WX0 + (WX1 - WX0) * 2 / 3]) N.wp.add('woodL', bx(x - 0.02, WV0 + f, 0.02, x + 0.02, WV1 - f, TH - 0.02));
  for (const y of [1.33, 1.72]) N.wp.add('woodL', bx(WX0 + f, y - 0.02, 0.02, WX1 - f, y + 0.02, TH - 0.02));
  N.wp.add('glass', bx(WX0 + f, WV0 + f, 0.05, WX1 - f, WV1 - f, 0.07));
  const k = N.ip;
  k.add('white', bx(WX0 - 0.06, WV0 - 0.03, 0, WX1 + 0.06, WV0, 0.17));
  // the blind: a deep, soft fabric box over the top third of the window, running on past its left jamb
  k.add('blind', rb(WX0 - 0.26, 1.73, 0, WX1 + 0.1, 2.27, 0.2, 0.02));
  [[-0.72, 'terra', 0.2, 5], [-0.42, 'pot', 0.16, 12], [0.42, 'pot', 0.22, 17], [0.62, 'pot', 0.15, 23], [1.12, 'terra', 0.18, 29]].forEach(([x, pk, h, seed]) => {
    k.add(pk, cyl(0.035, 0.07, x, WV0, 0.085, 16, 0.045));
    tree(k, x, WV0 + 0.06, 0.085, { trunk: 0.03, H: h, R: 0.07, branches: 5, per: 4, shape: LEAF.herb, k: 1.1, seed, tw: 0.006, key: seed % 2 ? 'leaf' : 'leaf2' });
  });
  k.add('white', bx(-2.36, 2.05, 0, -1.3, 2.09, 0.22), bx(-2.36, 1.45, 0, -1.3, 1.49, 0.22));
  k.add('vaseY', cyl(0.04, 0.15, -2.12, 2.09, 0.11, 24, 0.055)); k.add('pot', cyl(0.035, 0.13, -1.86, 2.09, 0.11, 20), cyl(0.014, 0.06, -1.86, 2.22, 0.11, 12));
  k.add('glass', cyl(0.05, 0.07, -1.58, 2.09, 0.11, 24, 0.075));
  k.add('tan', ball(0.075, -2.1, 1.56, 0.11, 2), cyl(0.03, 0.03, -2.1, 1.62, 0.11, 16), new THREE.TorusGeometry(0.055, 0.024, 12, 28).translate(-1.82, 1.57, 0.11), cyl(0.04, 0.14, -1.55, 1.49, 0.11, 20, 0.05));
  k.add('frame', bx(1.45, 1.2, 0, 1.95, 2.0, 0.02)); k.add('quote', bx(1.475, 1.225, 0.004, 1.925, 1.975, 0.026));

  // B the east wall: plain plaster, two prints
  E.wp.add('plaster', panel([[-RZ, 0], [RZ, 0], [RZ, H], [-RZ, H]], [], TH).applyMatrix4(M.alongZ(0)));
  E.ip.add('frame', bx(-0.02, 1.25, -0.95, 0, 1.95, -0.45)); E.ip.add('artC', bx(-0.026, 1.275, -0.925, -0.004, 1.925, -0.475));
  E.ip.add('woodL', bx(-0.02, 1.4, 0.15, 0, 1.95, 0.95)); E.ip.add('artD', bx(-0.026, 1.425, 0.175, -0.004, 1.925, 0.925));

  // C the door wall: the door and a coat rail
  const DX0 = 1.0, DX1 = 1.9;
  S.wp.add('plaster', panel([[-OX, 0], [DX0, 0], [DX0, 2.2], [DX1, 2.2], [DX1, 0], [OX, 0], [OX, H], [-OX, H]], [], TH).applyMatrix4(M.alongX(-TH)));
  S.wp.add('oak', bx(DX0 - 0.04, 0, -TH - 0.01, DX0, 2.24, 0.01), bx(DX1, 0, -TH - 0.01, DX1 + 0.04, 2.24, 0.01), bx(DX0 - 0.04, 2.2, -TH - 0.01, DX1 + 0.04, 2.24, 0.01));
  // hung on the west jamb, opening inward, so from the south-east you see the leaf swing into the room
  const door = new THREE.Group(); door.position.set(DX0 + 0.02, 0, -0.07); S.pivot.add(door);
  const dp = mkPart(door);
  dp.add('oak', bx(0, 0.005, -0.02, 0.86, 2.18, 0.02));
  dp.add('ink', bx(0.74, 1.0, 0.02, 0.78, 1.04, 0.06), bx(0.64, 1.0, 0.04, 0.78, 1.03, 0.06), bx(0.74, 1.0, -0.06, 0.78, 1.04, -0.02), bx(0.64, 1.0, -0.06, 0.78, 1.03, -0.04));
  dp.build();
  S.ip.add('oak', bx(-1.7, 1.72, 0, -0.5, 1.8, -0.025));
  for (const x of [-1.55, -1.25, -0.95, -0.65]) S.ip.add('oak', bx(x - 0.015, 1.745, -0.025, x + 0.015, 1.775, -0.09));
  S.ip.add('woodL', bx(-0.1, 1.3, 0, 0.5, 1.95, -0.02)); S.ip.add('artY', bx(-0.075, 1.325, -0.004, 0.475, 1.925, -0.026));

  // D the brick wall: shelf unit with books and herbs, the large print, a wall hanging, three small frames
  Wst.wp.add('plaster', panel([[-RZ, 0], [RZ, 0], [RZ, H], [-RZ, H]], [], TH).applyMatrix4(M.alongZ(TH)));
  Wst.wp.add('brick', bx(TH, 0, -RZ, TH + 0.003, H, RZ));
  const wi = Wst.ip, SD = 0.24;
  wi.add('oak', bx(0, 1.5, 1.15, SD, 2.35, 1.18), bx(0, 1.5, 2.02, SD, 2.35, 2.05));
  const shelfY = [1.5, 1.92, 2.32];
  for (const y of shelfY) wi.add('oak', bx(0, y, 1.1, SD, y + 0.03, 2.1));
  const r = rng(7), bk = ['b1', 'b5', 'b3', 'b4', 'b5', 'b3', 'b1'];
  for (const y of shelfY.slice(0, 2)) {
    let z = 1.2 + r() * 0.08; const stop = 2.0 - r() * 0.3;
    while (z < stop) { const w = 0.022 + r() * 0.03, h = 0.2 + r() * 0.12, d = 0.13 + r() * 0.06; wi.add(bk[Math.floor(r() * bk.length)], bx(0.02, y + 0.03, z, 0.02 + d, y + 0.03 + h, z + w)); z += w + 0.004; }
  }
  wi.add('white', bx(0.04, 2.35, 1.3, 0.2, 2.42, 1.9));
  for (const [z, seed] of [[1.42, 3], [1.62, 9], [1.8, 14]]) tree(wi, 0.12, 2.42, z, { trunk: 0.02, H: 0.16, R: 0.08, branches: 5, per: 4, shape: LEAF.herb, k: 1.1, seed, tw: 0.005 });
  wi.add('white', bx(0, 1.78, -0.69, 0.014, 2.64, 0.77)); wi.add('poster', bx(0.004, 1.8, -0.67, 0.022, 2.62, 0.75));
  wi.add('oak', bx(0, 2.455, -1.6, 0.02, 2.475, -0.78)); wi.add('tapestry', bx(0.003, 1.74, -1.56, 0.014, 2.46, -0.82));
  for (const z of [-1.54, -0.84]) wi.add('b5', bx(0.004, 1.66, z - 0.012, 0.016, 1.74, z + 0.012));
  wi.add('woodL', bx(0, 1.3, 0.1, 0.014, 1.74, 0.44)); wi.add('artY', bx(0.004, 1.32, 0.12, 0.022, 1.72, 0.42));
  wi.add('frame', bx(0, 1.2, -0.54, 0.014, 1.74, -0.15)); wi.add('artC', bx(0.004, 1.225, -0.515, 0.022, 1.715, -0.175));
  wi.add('woodL', bx(0, 1.08, 0.62, 0.014, 1.46, 1.1)); wi.add('artD', bx(0.004, 1.1, 0.64, 0.022, 1.44, 1.08));

  // the ceiling, hinged on the window wall's top edge, and its pendant
  const lid = new THREE.Group(); lid.position.set(0, H, 0); N.pivot.add(lid);
  const lp = mkPart(lid); lp.add('ceiling', bx(-OX, 0, 0, OX, TH, 2 * OZ));
  const lItems = new THREE.Group(); lid.add(lItems); const li = mkPart(lItems);
  const LX = 0.3, lz = OZ + 0.1;
  li.add('ink', cyl(0.008, 0.5, LX, -0.5, lz, 8), cyl(0.06, 0.03, LX, -0.03, lz, 32));
  li.add('shade', new THREE.SphereGeometry(0.2, 48, 24).translate(LX, -0.68, lz));

  for (const w of Object.values(walls)) { w.wp.build(); w.ip.build(); }
  lp.build(); li.build();
  // in colour the ink steps back: the room should read as a model, not as an outlined drawing
  const hulls = Object.values(PAL).map(s => s.hullMat).filter(Boolean);
  for (const m of hulls) m.transparent = true;

  // ---- timing: it folds into a closed box, then you walk in through the door
  const FOLD = { west: [0.12, 0.24], north: [0.19, 0.31], east: [0.26, 0.38], south: [0.33, 0.45], lid: [0.42, 0.56] };
  const GROW = { floor: [0.06, 0.18], west: [0.16, 0.26], north: [0.23, 0.33], east: [0.3, 0.4], south: [0.37, 0.47], lid: [0.44, 0.52] };
  const sheets = [];
  let S_tags = () => {};
  const g = (k, p) => lerp(0.015, 1, ease(win(p, ...GROW[k])));

  const keys = [
    { at: 0, t: [0.0, 0, -2.5], az: 90, el: 89.3, fov: 2.2, h: 19.8, sx: 0.2, ph: { h: 46, sx: 0, sy: -0.22 } },
    { at: 0.06, t: [0.0, 0, -2.5], az: 90, el: 89.3, fov: 2.2, h: 19.8, sx: 0.2, ph: { h: 46, sx: 0, sy: -0.22 } },
    { at: 0.3, t: [0.3, 0.8, -1.4], az: 104, el: 42, fov: 2.2, h: 14.5, sx: 0.2, ph: { h: 30, sx: 0, sy: -0.3 } },
    { at: 0.56, t: [0.3, 1.4, 0], az: 112, el: 34, fov: 2.6, h: 10.5, sx: 0.14, ph: { h: 21, sx: 0, sy: -0.22 } },
    { at: 0.62, t: [0.3, 1.4, 0], az: 112, el: 34, fov: 2.6, h: 10.5, sx: 0.14, ph: { h: 21, sx: 0, sy: -0.22 } },
    eyeKey(0.72, [6.0, 3.8, 8.6], [1.0, 1.3, 2.2], 36, { ph: eyeKey(0.72, [7.2, 4.4, 10.4], [0.9, 1.3, 1.8], 50) }),
    eyeKey(0.80, [1.45, 1.6, 4.4], [1.45, 1.58, 0], 52, { sy: -0.04, ph: eyeKey(0.80, [1.45, 1.6, 5.6], [1.45, 1.58, 0], 72, { sy: -0.02 }) }),
    eyeKey(0.87, [1.45, 1.64, 1.75], [-2.4, 1.25, 0.35], 58, { sy: 0.06, ph: eyeKey(0.87, [1.45, 1.64, 1.75], [-2.4, 1.3, 0.35], 74, { sy: 0.14 }) }),
    eyeKey(0.94, [1.0, 1.56, 1.45], [-1.7, 1.3, -2.4], 58, { sy: 0.05, ph: eyeKey(0.94, [1.0, 1.56, 1.45], [-1.7, 1.3, -2.4], 74, { sy: 0.1 }) }),
    eyeKey(1.0, [0.1, 1.5, 1.6], [0.45, 1.1, -2.4], 58, { sy: 0.04, ph: eyeKey(1.0, [0.1, 1.5, 1.6], [0.45, 1.1, -2.4], 74, { sy: 0.08 }) }),
  ];

  function update(p, _T, sw = 0) {
    const fold = {};
    for (const [id, w] of Object.entries(FOLD)) fold[id] = 1 - ease(win(p, ...w));     // 1 = lying flat
    N.pivot.rotation.x = -Math.PI / 2 * fold.north;
    S.pivot.rotation.x = Math.PI / 2 * fold.south;
    Wst.pivot.rotation.z = Math.PI / 2 * fold.west;
    E.pivot.rotation.z = -Math.PI / 2 * fold.east;
    lid.rotation.x = -Math.PI / 2 * fold.lid;
    fItems.scale.y = g('floor', p);
    N.items.scale.z = g('north', p); S.items.scale.z = g('south', p);
    Wst.items.scale.x = g('west', p); E.items.scale.x = g('east', p);
    lItems.scale.y = g('lid', p);
    // the way out: the ceiling slides back over the window wall, the door wall and the east wall sink into
    // the floor, and the room is left standing as a cutaway
    const cutL = ease(clamp(((sw || 0) - 0.03) / 0.32)), cutW = ease(clamp(((sw || 0) - 0.12) / 0.4));
    lid.scale.z = Math.max(0.001, 1 - cutL); lid.visible = cutL < 0.999;
    S.pivot.scale.y = E.pivot.scale.y = Math.max(0.001, 1 - cutW); S.pivot.visible = E.pivot.visible = cutW < 0.999;
    // half open while you look at the box, then right back against the wall as you walk through
    door.rotation.y = 1.0 * ease(win(p, 0.56, 0.65)) + 1.6 * ease(win(p, 0.78, 0.85));
    for (const [m, a, b] of sheets) { m.opacity = 1 - win(p, a, b); }
    S_tags(p);
    DRAW.uWash.value = 1 - ease(win(p, 0.2, 0.5));
    sun.position.lerpVectors(SUN_A, SUN_B, ease(win(p, 0.56, 0.7)));
    if (sw > 0) sun.position.lerp(SUN_C, ease(clamp(sw * 1.6)));
    swK = ease(clamp((sw || 0) * 1.6));
    lamp.intensity = 3.2 * win(p, 0.66, 0.84) * (1 - cutL);
    const up = ['west', 'north', 'east', 'south', 'lid'].filter(id => fold[id] < 0.02).length;
    const stop = p < 0.16 ? 'sheet' : p < 0.64 ? 'fold' : p < 0.83 ? 'door' : p < 0.95 ? 'desk' : 'sofa';
    let cap = '', capOp = 0;
    if (p < 0.83) {
      cap = '<span class="lv">ANSICHT C // EINGANG</span><span class="t">C · DIE TÜRWAND</span><span class="m">OK-02 Eichentür &nbsp;·&nbsp; 900 × 2 200 &nbsp;·&nbsp; Wand 5 040</span>';
      capOp = win(p, 0.66, 0.70) * (1 - win(p, 0.79, 0.82));
    } else if (p < 0.95) {
      cap = '<span class="lv">ANSICHT D // ZIEGELWAND</span><span class="t">DER ARBEITSPLATZ</span><span class="m">KL-01 Klinker geschlämmt &nbsp;·&nbsp; OK-02 Eichenregal &nbsp;·&nbsp; BI-08 Bilder</span>';
      capOp = win(p, 0.84, 0.87) * (1 - win(p, 0.92, 0.95));
    } else {
      cap = '<span class="lv">ANSICHT A // FENSTERWAND</span><span class="t">SOFA &amp; FENSTER</span><span class="m">HZ-03 Holzfenster &nbsp;·&nbsp; RO-07 Rollo &nbsp;·&nbsp; SF-10 Sofa &nbsp;·&nbsp; TP-11 Wollteppich</span>';
      capOp = win(p, 0.95, 0.98) * (1 - clamp((sw || 0) * 5));
    }
    return {
      hero: 1 - clamp((p - 0.5) / 0.06),
      counter: p < 0.58 ? `Fläche <b>${String(1 + up).padStart(2, '0')}</b> / 06` : '',
      hint: p < 0.5 ? 'Zum Zusammenfalten scrollen' : p < 0.85 ? 'Zum Eintreten scrollen' : '',
      legend: '<b>A</b> Fenster &nbsp;<b>B</b> Ostwand &nbsp;<b>C</b> Tür &nbsp;<b>D</b> Arbeitsplatz &nbsp;<b>E</b> Decke',
      legendOp: 1 - win(p, 0.06, 0.1),
      cap,
      capOp,
      stop,
    };
  }

  // item codes, in sheet coordinates (the walls lying flat): [x, z, code]
  const CODE = {
    north: [[1.2, -OZ - 1.0, 'HZ-03'], [0.2, -OZ - 1.95, 'RO-07'], [-1.8, -OZ - 1.47, 'RG-05'], [1.7, -OZ - 1.6, 'BI-08']],
    east: [[OX + 1.6, -0.7, 'BI-08'], [OX + 2.5, 1.6, 'KP-04']],
    south: [[1.45, OZ + 1.1, 'OK-02'], [-1.1, OZ + 2.3, 'KP-04']],
    west: [[-OX - 2.7, -2.0, 'KL-01'], [-OX - 1.95, 1.6, 'OK-02'], [-OX - 2.2, 0.0, 'BI-08'], [-OX - 2.1, -1.2, 'TX-09']],
    lid: [[LX + 0.2, NZ - lz - 0.2, 'PD-06']],
  };
  update(0); scene.updateMatrixWorld(true);
  const SH = { x0: -8.6, z0: -11.6, w: 17.2, d: 18.4, s: 150 };
  const dots = Object.values(CODE).flat(), pend = [LX, NZ - lz];
  const panelTex = drawSheet(SH, 'panel', dots, pend), groundTex = drawSheet(SH, 'ground', dots, pend);
  const decalMat = (map, a, b) => { const m = patchFill(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), { wash: false }); sheets.push([m, a, b]); return m; };
  const panelMat = decalMat(panelTex, 0.48, 0.56), groundMat = decalMat(groundTex, 0.1, 0.18);
  function decal(mat, x0, z0, x1, z1, y, parent) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = x0 + uv.getX(i) * (x1 - x0), z = z1 - uv.getY(i) * (z1 - z0);
      uv.setXY(i, (x - SH.x0) / SH.w, 1 - (z - SH.z0) / SH.d);
    }
    const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.renderOrder = 4;
    scene.add(m); m.updateMatrixWorld(); if (parent) parent.attach(m); return m;
  }
  // what rides up: dimensions and item codes, one strip per surface
  decal(panelMat, -OX, -OZ, OX, OZ, 0.03, floor);
  decal(panelMat, SH.x0, NZ, SH.x0 + SH.w, -OZ, 0.145, N.pivot);
  decal(panelMat, SH.x0, SH.z0, SH.x0 + SH.w, NZ, 0.03, lid);
  decal(panelMat, SH.x0, -OZ, -OX, 3.0, 0.145, Wst.pivot);
  decal(panelMat, OX, -OZ, SH.x0 + SH.w, 3.3, 0.145, E.pivot);
  decal(panelMat, -OX, OZ, OX, SH.z0 + SH.d, 0.145, S.pivot);
  decal(panelMat, OX, 3.3, SH.x0 + SH.w, SH.z0 + SH.d, 0.145, S.pivot);
  // item codes: upright tags that ride with their surface and hide when it turns away from you
  const CODES = [
    [N.pivot, V(0, 0, 1), 0.12, CODE.north], [E.pivot, V(-1, 0, 0), 0.12, CODE.east], [S.pivot, V(0, 0, -1), 0.12, CODE.south],
    [Wst.pivot, V(1, 0, 0), 0.12, CODE.west], [lid, V(0, -1, 0), 0.0, CODE.lid],
  ];
  const tags = [];
  for (const [obj, n, y, list] of CODES) for (const [x, z, c] of list) {
    const at = obj.worldToLocal(V(x, y, z));
    tags.push({ obj, n, item: labels.add({ no: c, name: '', obj, at, mode: 'tag', cls: 'code', tx: 12, ty: -16 }) });
  }
  const tw = new THREE.Vector3(), tn = new THREE.Vector3(), tq = new THREE.Quaternion();
  S_tags = (p) => {
    const life = win(p, 0.0, 0.02) * (1 - win(p, 0.46, 0.52));
    for (const t of tags) {
      t.obj.getWorldQuaternion(tq); tn.copy(t.n).applyQuaternion(tq);
      tw.copy(t.item.at).applyMatrix4(t.obj.matrixWorld); tw.sub(camera.position).negate().normalize();
      t.item.op = life * clamp((tn.dot(tw) - 0.3) / 0.3);
    }
  };
  // the closed box keeps its drawing on the outside: dimension strings and wall titles
  const outMat = lineMat({ w: 1.0, color: INK, opacity: 0 });
  const tk = (x, y, z, ax) => ax === 'x' ? [x - 0.07, y - 0.07, z, x + 0.07, y + 0.07, z] : [x, y - 0.07, z - 0.07, x, y + 0.07, z + 0.07];
  segs(S.pivot, [[-OX, 0.25, 0.015, OX, 0.25, 0.015], tk(-OX, 0.25, 0.015, 'x'), tk(OX, 0.25, 0.015, 'x'),
    [DX0, 2.42, 0.015, DX1, 2.42, 0.015], tk(DX0, 2.42, 0.015, 'x'), tk(DX1, 2.42, 0.015, 'x'),
    [DX1 + 0.2, 0.02, 0.015, DX1 + 0.2, 2.2, 0.015], [DX1 + 0.13, 0.02, 0.015, DX1 + 0.27, 0.02, 0.015], [DX1 + 0.13, 2.2, 0.015, DX1 + 0.27, 2.2, 0.015]], outMat);
  segs(E.pivot, [[0.015, 0.25, -RZ, 0.015, 0.25, RZ], tk(0.015, 0.25, -RZ, 'z'), tk(0.015, 0.25, RZ, 'z'),
    [0.015, 0.02, RZ - 0.3, 0.015, H, RZ - 0.3], [0.015, 0.02, RZ - 0.37, 0.015, 0.02, RZ - 0.23], [0.015, H, RZ - 0.37, 0.015, H, RZ - 0.23]], outMat);
  const OUT = [
    [S.pivot, V(0, 0, 1), V(-0.4, 0.42, 0.015), '5 040', ''], [S.pivot, V(0, 0, 1), V((DX0 + DX1) / 2, 2.58, 0.015), '900', ''],
    [S.pivot, V(0, 0, 1), V(DX1 + 0.2, 1.1, 0.015), '2 200', ''], [S.pivot, V(0, 0, 1), V(-1.4, 1.5, 0.015), 'C', 'Türwand'],
    [E.pivot, V(1, 0, 0), V(0.015, 0.42, 0), '4 800', ''], [E.pivot, V(1, 0, 0), V(0.015, 1.5, RZ - 0.3), '3 000', ''],
    [E.pivot, V(1, 0, 0), V(0.015, 1.7, -0.9), 'B', 'Ostwand'],
  ];
  const outs = OUT.map(([obj, n, at, no, name]) => ({ obj, n, item: labels.add({ no, name, obj, at, mode: 'tag', cls: name ? '' : 'code', tx: 0, ty: 0 }) }));
  const prevTags = S_tags;
  S_tags = (p) => {
    prevTags(p);
    const life = win(p, 0.58, 0.63) * (1 - win(p, 0.77, 0.81));
    outMat.opacity = life * 0.9;
    for (const t of outs) {
      t.obj.getWorldQuaternion(tq); tn.copy(t.n).applyQuaternion(tq);
      tw.copy(t.item.at).applyMatrix4(t.obj.matrixWorld); tw.sub(camera.position).negate().normalize();
      t.item.op = life * clamp((tn.dot(tw) - 0.05) / 0.15);
    }
  };
  // what stays on the paper: titles, the finishes schedules, the title block
  decal(groundMat, SH.x0, SH.z0, SH.x0 + SH.w, SH.z0 + SH.d, 0.16, null);

  const C = c => new THREE.Color(c);
  const W0 = { hemi: C('#ffffff'), ground: C('#8f8f98'), sun: C('#ffffff'), sh: C('#000000') }, W1 = { hemi: C('#ffffff'), ground: C('#dedcd9'), sun: C('#fff4e4'), sh: C('#5a7f96') };
  return {
    update, keys, R: 40,
    // daylight pours in through the window and fills the room, the box and the studio floor around it;
    // at the end it leaves the way it came, back out through the window
    live: {
      at: 0.7, soft: 1.6,
      in: { dir: [0, 0, 0], radial: 1, c: [0.2, 1.5, -2.4], min: 0, max: 30, noise: 1.4, dur: 3.5, pow: 1.3 },
      // the cutaway keeps its colour until the swirl is all but home, then drains quickly: the whole way out takes
      // about as long as on the other two sheets (0.4 hold + 2.9 + 1.3, then the hand-over)
      out: { dir: [0, 0, 0], radial: -1, c: [0.2, 1.5, -2.4], min: -27, max: 0.6, noise: 1.2, dur: 1.3, pow: 0.5, delay: 2.9 },
      sun: [0.62, 0.55, -0.56], groundY: -0.125,
      // a photo studio, not a garden: a pale seamless backdrop
      zenith: '#c9c8c5', mid: '#cfcdc9', horizon: '#d3d1cd',
      motes: { n: 140, min: [-2.3, 0.15, -2.3], max: [2.3, 2.8, 2.3], size: 0.01, color: '#fff2da' },
    },
    liveHook: (g) => {
      hemi.color.copy(W0.hemi).lerp(W1.hemi, g); hemi.groundColor.copy(W0.ground).lerp(W1.ground, g);
      // in colour the light is modelled: a soft ambient and a clear sun, so shade reads as shade
      sun.color.copy(W0.sun).lerp(W1.sun, g); sun.intensity = lerp(2.6, 2.3 - 0.5 * swK, g); hemi.intensity = lerp(2.3, 1.45 + 0.85 * swK, g);
      ground.material.color.copy(W0.sh).lerp(W1.sh, g); ground.material.opacity = lerp(0.3, 0.34, g);
      line.opacity = lerp(0.88, 0.24, g); W.mid.opacity = lerp(0.6, 0.14, g);
      for (const m of hulls) m.opacity = lerp(1, 0.25, g);
    },
    // in: an iris opens on the sheet; out: the picture is wiped away like a turned page
    xfer: { in: { mode: 'iris', c: [0.5, 0.5] }, out: { mode: 'wipe', dir: [1, 0] } },
    // the sheet turns into place under the long lens; on the way out you turn towards the window
    camFx: (c, inU, outU) => {
      if (inU > 0 && !c.pos) { c.az -= 75 * inU * inU; c.h *= 1 + 0.32 * inU; }
      if (outU > 0 && c.pos) {
        const a = 0.42 * outU, dx = c.t[0] - c.pos[0], dz = c.t[2] - c.pos[2];
        c.t[0] = c.pos[0] + dx * Math.cos(a) - dz * Math.sin(a); c.t[2] = c.pos[2] + dx * Math.sin(a) + dz * Math.cos(a);
      }
    },
    play: { dur: 62 },
    // from the sofa the camera spirals round and far out to the south-east, on to a long lens: the cutaway
    // model seen from above, the brick wall on the left and the window wall on the right
    swirl: { c: [0, 1.3, 0], pos: [27.8, 21.4, 27.8], look: [0, 1.4, 0], fov: 9.3, lift: 2, sy: 0, dur: 3.4 },
    // shadows arrive with the fills, so nothing casts a shadow before it has been drawn
    introHook: (T) => { sun.shadow.intensity = win(T, 3.3, 3.9); },
    draw: { dir: [0, 0, 0], radial: 1, c: [0, 0, 0], min: 0, max: 12, soft: 1.0 },
    radar: {
      scale: '1:50',
      viewBox: '-4.2 -3.4 8.4 6.8',
      plan: 'M-2.4 -2.4 H2.4 V2.4 H-2.4 Z M-2.4 -0.75 H-1.58 V1.75 H-2.4 M-1.05 -2.25 H1.55 V-1.2 H-1.05 Z M-0.4 -0.33 H1.3 V0.39 H-0.4 Z M1.0 2.4 H1.9',
      strokeW: 0.12, dotR: 0.35, coneW: 0.10, coneLen: 1.8,
      clampX: [-2.6, 2.6], clampZ: [-2.6, 2.8],
      axoDot: [1.45, 2.3], axoAng: -1.95,
      zones: [
        { stop: 'desk', p: 0.91, tag: 'ANS. D // ARBEITSPLATZ', x: -2.4, y: -1.4, w: 1.5, h: 3.8 },
        { stop: 'sofa', p: 0.99, tag: 'ANS. A // SOFA & FENSTER', x: -0.9, y: -2.4, w: 3.3, h: 1.6 },
        { stop: 'door', p: 0.78, tag: 'ANS. C // TÜRWAND', x: -0.9, y: 1.4, w: 3.3, h: 1.0 },
      ],
      stops: [
        { stop: 'sheet', p: 0.02, tag: 'ABWICKLUNG // 1:50', label: 'BLATT' },
        { stop: 'fold', p: 0.56, tag: 'GESCHLOSSENE BOX // 6 SEITEN', label: 'FALTEN' },
        { stop: 'door', p: 0.78, tag: 'ANS. C // TÜRWAND', label: 'TÜR' },
        { stop: 'desk', p: 0.91, tag: 'ANS. D // ARBEITSPLATZ', label: 'ARBEIT' },
        { stop: 'sofa', p: 0.99, tag: 'ANS. A // SOFA & FENSTER', label: 'SOFA' },
      ],
    },
    chrome: {
      title: 'three.js Demo 1 · Abwicklung',
      dwg: 'ELEV.02',
      brand: 'Field', brandSub: 'Innenausbau und Schreinerei',
      nav: 'Räume     Schreinerei     Studio', cta: 'Termin vereinbaren',
      kicker: 'Wandabwicklung · Blatt I-02',
      loader: 'Zeichne Blatt I-02',
      h1: 'Wir zeichnen alle sechs<br>Seiten eines <em>Raums.</em>',
      lede: 'Boden, vier Wände und Decke, flach ausgelegt, so wie wir sie zeichnen. Scrollen Sie, und das Zimmer faltet sich zu. Dann gehen Sie hinein.',
      spec: [['Raum', 'Wohnen und Arbeiten'], ['Größe', '4.8 × 4.8 m'], ['Raumhöhe', '3.00 m']],
      hint: 'Zum Zusammenfalten scrollen',
    },
  };
}

// ---- the sheet, in plan coordinates (window wall up). Two layers: 'panel' (dimensions and item codes, which ride
// up with their wall) and 'ground' (elevation titles, finishes schedules, title block, which stay on the paper).
function drawSheet(SH, layer, dots, pend) {
  const S = SH.s, X = x => (x - SH.x0) * S, Y = z => (z - SH.z0) * S;
  const ACC = '#ff3b47';
  return canvasTex(Math.round(SH.w * S), Math.round(SH.d * S), (g) => {
    g.strokeStyle = INK; g.fillStyle = INK; g.lineCap = 'round';
    const font = (m, wt = 500) => { g.font = `${wt} ${Math.round(m * S)}px "IBM Plex Mono"`; };
    const ln = (x0, z0, x1, z1, w = 2) => { g.lineWidth = w; g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.stroke(); };
    const txt = (t, x, z, m = 0.18, align = 'center', rot = 0, wt = 600, col = INK) => {
      g.save(); g.translate(X(x), Y(z)); g.rotate(rot); font(m, wt); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
    };
    const tick = (x, z) => ln(x - 0.07, z + 0.07, x + 0.07, z - 0.07, 3);
    const dimH = (x0, x1, z, t) => { ln(x0, z, x1, z, 1.8); tick(x0, z); tick(x1, z); ln(x0, z - 0.12, x0, z + 0.12, 1.4); ln(x1, z - 0.12, x1, z + 0.12, 1.4); txt(t, (x0 + x1) / 2, z - 0.19); };
    const dimV = (z0, z1, x, t) => { ln(x, z0, x, z1, 1.8); tick(x, z0); tick(x, z1); ln(x - 0.12, z0, x + 0.12, z0, 1.4); ln(x - 0.12, z1, x + 0.12, z1, 1.4); txt(t, x - 0.19, (z0 + z1) / 2, 0.18, 'center', -Math.PI / 2); };
    const title = (l, t, x, z) => {
      font(0.3, 600); g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = ACC; g.fillText(l, X(x), Y(z)); const lw = g.measureText(l + '  ').width;
      g.fillStyle = INK; g.fillText(t, X(x) + lw, Y(z));
    };
    const schedule = (x, z, rows, right = false) => rows.forEach(([c, d], i) => {
      font(0.17, 600); g.textBaseline = 'middle';
      const zz = Y(z + i * 0.32), cw = g.measureText(c + '  ').width;
      if (right) { font(0.17, 500); const dw = g.measureText(d).width; g.textAlign = 'left'; g.fillStyle = INK; g.fillText(d, X(x) - dw, zz); font(0.17, 600); g.fillStyle = ACC; g.fillText(c, X(x) - dw - cw, zz); }
      else { g.textAlign = 'left'; g.fillStyle = ACC; g.fillText(c, X(x), zz); font(0.17, 500); g.fillStyle = INK; g.fillText(d, X(x) + cw, zz); }
    });

    if (layer === 'panel') {
      // an item code: a dot on the thing (the code itself is an upright tag)
      for (const [dx, dz] of dots) { g.beginPath(); g.arc(X(dx), Y(dz), 0.045 * S, 0, 7); g.fillStyle = ACC; g.fill(); }
      g.fillStyle = INK;
      // P plan
      dimH(-RX, RX, 2.2, '4 800'); dimV(-RZ, RZ, 2.26, '4 800');
      txt('WOHNEN · ARBEITEN', 0.35, 1.38, 0.2); txt('23.0 M²  ·  OK-02 EICHE 180', 0.35, 1.68, 0.14, 'center', 0, 500);
      // A window wall (top, z = -OZ - height on the wall)
      dimV(-OZ, NZ, -OX - 0.33, '3 000'); dimH(-0.9, 1.3, -OZ - 2.5, '2 200');
      // B east wall (right, x = OX + height)
      dimV(-RZ, RZ, OX + H + 0.32, '4 800'); dimH(OX, OX + H, 2.25, '3 000');
      // C door wall (bottom, z = OZ + height)
      dimH(1.0, 1.9, OZ + 2.46, '900'); dimV(OZ, OZ + 2.2, 2.16, '2 200'); dimH(-OX, OX, OZ + H + 0.25, '5 040');
      // D brick wall (left, x = -OX - height)
      dimV(-RZ, RZ, -OX - H - 0.14, '4 800');
      // E ceiling (beyond the window wall)
      g.setLineDash([0.1 * S, 0.07 * S]); g.lineWidth = 1.6; g.strokeStyle = INK; g.strokeRect(X(-RX + 0.05), Y(NZ - 2 * OZ + 0.16), (2 * RX - 0.1) * S, (2 * OZ - 0.32) * S); g.setLineDash([]);
      const [px, pz] = pend;
      g.beginPath(); g.arc(X(px), Y(pz), 0.2 * S, 0, 7); g.lineWidth = 1.8; g.stroke(); ln(px - 0.3, pz, px + 0.3, pz, 1.4); ln(px, pz - 0.3, px, pz + 0.3, 1.4);
      txt('KALKPUTZ  ·  3 000 ÜBER OKFF', 0, NZ - 2 * OZ + 0.6, 0.18);
    } else {
      title('A', 'FENSTERWAND', 2.95, -5.1);
      schedule(2.95, -4.55, [['HZ-03', 'HOLZFENSTER BIRKE'], ['RO-07', 'ROLLO LEINEN'], ['RG-05', 'WANDBORD WEISS'], ['KP-04', 'KALKPUTZ']]);
      title('B', 'OSTWAND', 2.95, 2.98);
      schedule(6.05, -1.2, [['KP-04', 'KALKPUTZ'], ['BI-08', 'BILD GERAHMT']]);
      title('C', 'TÜRWAND', -1.4, 6.35);
      schedule(2.95, 3.7, [['OK-02', 'EICHE GEÖLT'], ['KP-04', 'KALKPUTZ']]);
      title('D', 'ZIEGELWAND', -8.3, 2.98);
      schedule(-5.95, -1.6, [['KL-01', 'KLINKER GESCHLÄMMT'], ['OK-02', 'EICHE GEÖLT'], ['BI-08', 'BILD GERAHMT'], ['TX-09', 'WANDBEHANG']], true);
      title('E', 'DECKE', 2.95, -10.0);
      schedule(2.95, -9.45, [['PD-06', 'PENDELLEUCHTE Ø 400'], ['KP-04', 'KALKPUTZ']]);
      title('P', 'GRUNDRISS', -8.3, -5.1);
      schedule(-8.3, -4.55, [['OK-02', 'EICHE GEÖLT 180'], ['SF-10', 'SOFA BOUCLÉ'], ['TP-11', 'WOLLTEPPICH']]);
      // title block, scale bar, north point
      ln(-8.3, 5.2, -4.6, 5.2, 2.6);
      font(0.24, 600); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('FIELD  ·  WOHNEN', X(-8.3), Y(5.52));
      font(0.16, 500); g.fillText('BLATT I-02  ·  WANDABWICKLUNG  ·  1:50', X(-8.3), Y(5.88));
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0)' : INK; g.fillRect(X(-8.3 + i * 0.5), Y(6.12), 0.5 * S, 0.07 * S); g.lineWidth = 1.4; g.strokeRect(X(-8.3 + i * 0.5), Y(6.12), 0.5 * S, 0.07 * S); }
      g.fillStyle = INK; font(0.13); g.fillText('0', X(-8.32), Y(6.38)); g.fillText('2 M', X(-6.45), Y(6.38));
      g.beginPath(); g.arc(X(-4.0), Y(4.0), 0.32 * S, 0, 7); g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(X(-4.0), Y(3.6)); g.lineTo(X(-4.13), Y(4.1)); g.lineTo(X(-3.87), Y(4.1)); g.closePath(); g.fill();
      txt('N', -4.0, 4.55, 0.16);
    }
  });
}

// ---- procedural material textures & bump maps
function buildTextures() {
  const r = rng(17);
  const woodVeneer = (baseRgb, streakRgb, rows = 8) => {
    const s = 512, cb = document.createElement('canvas'); cb.width = cb.height = s;
    const gb = cb.getContext('2d');
    const map = canvasTex(s, s, (g) => {
      const h = s / rows;
      gb.fillStyle = '#808080'; gb.fillRect(0, 0, s, s);
      for (let row = 0; row < rows; row++) {
        const v = (r() - 0.5) * 14;
        const c = baseRgb.map(ch => Math.round(clamp(ch + v, 0, 255)));
        g.fillStyle = `rgb(${c})`; g.fillRect(0, row * h, s, h);
        const bv = Math.round(120 + (r() - 0.5) * 28);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(0, row * h, s, h);
        for (let k = 0; k < 42; k++) {
          const yy = row * h + r() * h, gh = 0.7 + r() * 1.6;
          g.fillStyle = `rgba(${streakRgb},${0.05 + r() * 0.08})`; g.fillRect(0, yy, s, gh);
          gb.fillStyle = 'rgba(30,30,30,0.28)'; gb.fillRect(0, yy, s, gh);
        }
        g.fillStyle = `rgba(${streakRgb},0.16)`; g.fillRect(0, row * h, s, 1.2);
        gb.fillStyle = '#404040'; gb.fillRect(0, row * h, s, 1.5);
      }
    }, { repeat: true });
    const bump = new THREE.CanvasTexture(cb);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.anisotropy = 8;
    return { map, bump };
  };

  const plaster = canvasTex(512, 512, (g, s) => {
    g.fillStyle = '#fcfbf9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 65; i++) {
      const x = r() * s, y = r() * s, rad = 28 + r() * 76;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, i % 2 ? 'rgba(255,253,250,0.03)' : 'rgba(175,170,160,0.024)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: true });

  const plasterBump = canvasTex(256, 256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 45; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 52;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, i % 2 ? 'rgba(210,210,210,0.09)' : 'rgba(50,50,50,0.09)');
      gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: true });

  const fabricBump = canvasTex(128, 128, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = 'rgba(235,235,235,0.28)'; g.fillRect(0, y, s, 1.5); }
    for (let x = 0; x < s; x += 4) { g.fillStyle = 'rgba(25,25,25,0.28)'; g.fillRect(x, 0, 1.5, s); }
  }, { repeat: true });

  const blob = (g, x, y, rad, col, a = 0.6) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.6, `rgba(${col},${a * 0.55})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  const petals = (g, x, y, rad, n, col, heart = '214,170,90') => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * rad * 0.6, y + Math.sin(a) * rad * 0.6, rad * 0.55, rad * 0.3, a, 0, 7); g.fill(); }
    g.fillStyle = `rgb(${heart})`; g.beginPath(); g.arc(x, y, rad * 0.24, 0, 7); g.fill();
  };
  // the large print: a pale watercolour, lilac and rose clouds with small yellow flowers
  const poster = canvasTex(852, 492, (g, w, h) => {
    g.fillStyle = '#d9cdc4'; g.fillRect(0, 0, w, h);
    const q = rng(5);
    for (let i = 0; i < 26; i++) blob(g, q() * w, q() * h, 90 + q() * 150, ['196,178,205', '222,186,186', '226,208,170', '205,190,215', '232,214,200'][i % 5], 0.5);
    for (let i = 0; i < 9; i++) petals(g, 60 + q() * (w - 120), 60 + q() * (h - 120), 14 + q() * 16, 6, i % 3 ? 'rgba(232,206,120,0.9)' : 'rgba(238,232,224,0.9)');
    g.strokeStyle = 'rgba(120,140,105,0.55)'; g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { const x = 80 + q() * (w - 160); g.beginPath(); g.moveTo(x, h - 20); g.quadraticCurveTo(x + 30 - q() * 60, h * 0.7, x + 20 - q() * 40, h * (0.35 + q() * 0.25)); g.stroke(); }
    g.strokeStyle = 'rgba(236,230,222,0.9)'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  });
  // the wall hanging: unbleached cloth with one stem and a red bloom
  const tapestry = canvasTex(444, 432, (g, w, h) => {
    g.fillStyle = '#e6e3de'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(90,80,70,0.05)'; g.fillRect(0, y, w, 1.5); }
    g.strokeStyle = '#6f7a5a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.5, h * 0.92); g.quadraticCurveTo(w * 0.42, h * 0.6, w * 0.55, h * 0.36); g.stroke();
    g.fillStyle = '#75805d';
    for (const [x, y, a] of [[0.4, 0.68, -0.7], [0.56, 0.6, 0.6], [0.43, 0.5, -0.9]]) { g.beginPath(); g.ellipse(w * x, h * y, 34, 12, a, 0, 7); g.fill(); }
    petals(g, w * 0.56, h * 0.3, 52, 7, '#b4766c', '120,70,60');
    petals(g, w * 0.36, h * 0.4, 22, 6, '#c99a8c', '120,70,60');
  });
  // the framed print by the window: a few lines of handwriting
  const quote = canvasTex(360, 600, (g, w, h) => {
    g.fillStyle = '#e4e1dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2a28'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 600 58px "Segoe Script", "Brush Script MT", cursive';
    ['Glaub', 'an dich'].forEach((t, i) => g.fillText(t, w / 2, 190 + i * 74));
    g.font = 'italic 400 34px "Segoe Script", "Brush Script MT", cursive';
    ['und alles', 'ist möglich'].forEach((t, i) => g.fillText(t, w / 2, 360 + i * 48));
    g.strokeStyle = '#2b2a28'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.36, 300); g.lineTo(w * 0.64, 300); g.stroke();
  });
  const artY = canvasTex(360, 480, (g, w, h) => {
    g.fillStyle = '#e2dccf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9b869'; g.beginPath(); g.arc(w * 0.5, h * 0.42, w * 0.27, 0, 7); g.fill();
    g.fillStyle = '#c99d6c'; g.beginPath(); g.ellipse(w * 0.5, h * 0.8, w * 0.36, h * 0.09, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,80,60,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.2, h * 0.66); g.lineTo(w * 0.8, h * 0.66); g.stroke();
  });
  const artC = canvasTex(360, 500, (g, w, h) => {
    g.fillStyle = '#e6e2dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7a79a'; g.beginPath(); g.ellipse(w * 0.56, h * 0.42, w * 0.2, h * 0.2, 0.3, 0, 7); g.fill();
    g.fillStyle = '#8f9a80'; g.beginPath(); g.ellipse(w * 0.36, h * 0.62, w * 0.16, h * 0.1, -0.5, 0, 7); g.fill();
    g.strokeStyle = '#2b2a28'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.3, h * 0.2); g.bezierCurveTo(w * 0.7, h * 0.16, w * 0.72, h * 0.5, w * 0.46, h * 0.56); g.bezierCurveTo(w * 0.3, h * 0.6, w * 0.4, h * 0.8, w * 0.68, h * 0.8); g.stroke();
  });
  const artD = canvasTex(520, 380, (g, w, h) => {
    g.fillStyle = '#e6e3dd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f8c68';
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 110, 26, 9, a + 1.0, 0, 7); g.fill(); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; g.fillStyle = '#d3a5a0'; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 110, 9, 0, 7); g.fill(); }
  });

  return {
    plaster, plasterBump, fabricBump,
    oak: woodVeneer([184, 138, 78], '112,70,28', 8),
    birch: woodVeneer([214, 188, 156], '150,112,74', 8),
    floor: oakFloor(),
    brick: brickWall(),
    rug: rug(),
    poster, tapestry, quote, artY, artC, artD,
  };
}

// soft shadows where things stand on the floor, in plan: canvas x is room x, canvas y is room z
function contactShadows() {
  const k = 200, s = Math.round(2 * RX * k), OFF = 4000;
  return canvasTex(s, s, (g) => {
    // only the blurred shadow of each shape lands on the canvas; the shape itself is drawn far off to the left
    const cast = (a, blur, dx, dz, draw) => {
      g.save(); g.shadowColor = `rgba(40,27,16,${a})`; g.shadowBlur = blur * k; g.shadowOffsetX = OFF + dx * k; g.shadowOffsetY = dz * k;
      g.fillStyle = '#000'; g.translate(-OFF, 0); draw(); g.restore();
    };
    const box = (x0, z0, x1, z1) => () => g.fillRect((x0 + RX) * k, (z0 + RZ) * k, (x1 - x0) * k, (z1 - z0) * k);
    const disc = (x, z, r) => () => { g.beginPath(); g.arc((x + RX) * k, (z + RZ) * k, r * k, 0, 7); g.fill(); };
    // the brick wall and the window wall darken the floor at their feet
    cast(0.3, 0.5, 0, 0, box(-RX - 0.5, -RZ - 0.5, -RX, RZ + 0.5)); cast(0.34, 0.6, 0, 0, box(-RX - 0.5, -RZ - 0.5, RX + 0.5, -RZ));
    const things = [
      [box(-1.05, -2.25, 1.55, -1.2), 1], [box(-0.42, -0.35, 1.32, 0.41), 1.25], [box(-1.62, -2.22, -1.12, -1.72), 0.8],
      [box(-2.4, -1.35, -2.0, -0.77), 1], [box(-2.4, -0.75, -1.58, 1.75), 1], [box(-1.56, 0.2, -1.05, 0.7), 0.7],
      [box(-1.95, 2.0, -1.5, 2.33), 0.9], [box(-1.92, 0.82, -1.66, 1.06), 0.5],
      [disc(-1.99, -1.66, 0.15), 1], [disc(-1.98, -0.02, 0.13), 0.8], [disc(1.94, -1.65, 0.17), 1], [disc(2.16, -1.95, 0.11), 1],
      [disc(2.0, -1.15, 0.13), 0.9], [disc(-2.18, 2.12, 0.14), 0.9],
    ];
    // a long soft shadow thrown forward and to the left, away from the window, and a tight dark one right underneath
    for (const [d, w] of things) cast(0.3 * w, 0.42, -0.2, 0.26, d);
    for (const [d, w] of things) cast(0.46 * w, 0.12, -0.04, 0.05, d);
    cast(0.3, 0.3, -0.5, 0.6, disc(1.94, -1.65, 0.34)); cast(0.24, 0.3, -0.45, 0.5, disc(-1.99, -1.66, 0.28));     // the crowns of the trees
  });
}
// oiled oak strip parquet: narrow staves, 75 wide, running from the door wall to the window wall
function oakFloor() {
  const r = rng(3), S = 300, W = Math.round(2 * RX * S), HH = Math.round(2 * RZ * S);
  const cb = document.createElement('canvas'); cb.width = W; cb.height = HH;
  const gb = cb.getContext('2d');
  const map = canvasTex(W, HH, (g, w, h) => {
    const bw = 0.075 * S;
    gb.fillStyle = '#888888'; gb.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += bw) {
      let y = -r() * 0.6 * S;
      while (y < h) {
        const L = (0.32 + r() * 0.6) * S, t = r(), u = r();
        const c = [170 + t * 20 - 10 + u * 4, 139 + t * 17 - 8, 104 + t * 14 - 7 - u * 4].map(Math.round);
        g.fillStyle = `rgb(${c})`; g.fillRect(x, y, bw, L);
        const bv = Math.round(122 + t * 18);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(x, y, bw, L);
        g.strokeStyle = `rgba(104,70,40,${0.06 + r() * 0.07})`; g.lineWidth = 1.1;
        gb.strokeStyle = 'rgba(40,40,40,0.16)'; gb.lineWidth = 1.1;
        for (let k = 0; k < 3; k++) {
          const xx = x + 3 + r() * (bw - 6);
          g.beginPath(); gb.beginPath(); g.moveTo(xx, y); gb.moveTo(xx, y);
          for (let yy = y; yy < y + L; yy += 36) {
            const wx = xx + Math.sin(yy * 0.012 + k + x) * 1.4;
            g.lineTo(wx, yy); gb.lineTo(wx, yy);
          }
          g.stroke(); gb.stroke();
        }
        g.fillStyle = 'rgba(70,45,25,.3)'; g.fillRect(x, y + L - 1.2, bw, 1.2);
        gb.fillStyle = '#3a3a3a'; gb.fillRect(x, y + L - 1.5, bw, 1.5);
        y += L;
      }
      g.fillStyle = 'rgba(70,45,25,.24)'; g.fillRect(x + bw - 1.2, 0, 1.2, h);
      gb.fillStyle = '#3a3a3a'; gb.fillRect(x + bw - 1.5, 0, 1.5, h);
    }
  });
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump };
}
// brick under a coat of white: 240 x 80 courses, half bond. The tile is 0.96 m square.
function brickWall() {
  const r = rng(29), s = 768, rows = 12, cols = 4, bh = s / rows, bw = s / cols, j = 5;
  const cb = document.createElement('canvas'); cb.width = cb.height = s;
  const gb = cb.getContext('2d');
  const map = canvasTex(s, s, (g) => {
    g.fillStyle = '#d6d2cc'; g.fillRect(0, 0, s, s);
    gb.fillStyle = '#3c3c3c'; gb.fillRect(0, 0, s, s);
    for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
      const x = c * bw + (row % 2 ? bw / 2 : 0), y = row * bh, v = (r() - 0.5) * 16;
      const col = [236 + v, 233 + v, 228 + v].map(n => Math.round(clamp(n, 0, 255)));
      const bv = Math.round(190 + (r() - 0.5) * 40);
      for (const dx of [0, -s]) {                             // the half-bond rows wrap round the tile
        g.fillStyle = `rgb(${col})`; g.fillRect(x + dx + j / 2, y + j / 2, bw - j, bh - j);
        gb.fillStyle = `rgb(${bv},${bv},${bv})`; gb.fillRect(x + dx + j / 2, y + j / 2, bw - j, bh - j);
      }
      for (let k = 0; k < 3; k++) {
        const px = x + r() * bw * 0.8, py = y + j + r() * (bh - 2 * j), rad = 6 + r() * 12;
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, k % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(150,140,128,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
    }
  }, { repeat: true });
  const bump = new THREE.CanvasTexture(cb); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.anisotropy = 8;
  return { map, bump };
}
// a flat-woven wool rug, sand with a charcoal diamond trellis
function rug() {
  const S = 300, W = Math.round(2.57 * S), HH = Math.round(1.72 * S);
  const cb = document.createElement('canvas'); cb.width = W; cb.height = HH;
  const gb = cb.getContext('2d');
  const map = canvasTex(W, HH, (g, w, h) => {
    g.fillStyle = '#bfab92'; g.fillRect(0, 0, w, h);
    gb.fillStyle = '#787878'; gb.fillRect(0, 0, w, h);
    // two chains of diamonds along the rug, drawn with a broad line, a short bar across every crossing
    const m = 0.2 * S, nx = 6, nz = 2, cw = (w - 2 * m) / nx, ch = (h - 2 * m) / nz;
    g.strokeStyle = '#2f2d2a'; g.lineJoin = 'miter'; g.lineCap = 'butt';
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const cx = m + (i + 0.5) * cw, cy = m + (k + 0.5) * ch;
      g.lineWidth = 7.5; g.beginPath(); g.moveTo(cx, cy - ch / 2); g.lineTo(cx + cw / 2, cy); g.lineTo(cx, cy + ch / 2); g.lineTo(cx - cw / 2, cy); g.closePath(); g.stroke();
      g.lineWidth = 6.5;
      for (const [px, py] of [[cx, cy - ch / 2], [cx, cy + ch / 2], [cx - cw / 2, cy], [cx + cw / 2, cy]]) { g.beginPath(); g.moveTo(px - cw * 0.09, py); g.lineTo(px + cw * 0.09, py); g.stroke(); }
    }
    g.fillStyle = 'rgba(240,234,224,0.55)'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    for (let y = 0; y < h; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(255,248,236,0.08)' : 'rgba(50,30,15,0.06)';
      g.fillRect(0, y, w, 2.2);
      gb.fillStyle = y % 10 === 0 ? '#c4c4c4' : '#424242';
      gb.fillRect(0, y, w, 2.5);
    }
  });
  const bump = new THREE.CanvasTexture(cb); bump.anisotropy = 8;
  return { map, bump };
}
