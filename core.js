// Shared pieces for the three direction sketches: renderer, materials, merged parts with ink edges,
// the long-lens camera, and the labels that follow the layers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { tier, low, high, governor, setArea, pinnedDpr, visible } from './quality.js';
export { THREE, LineSegments2, LineSegmentsGeometry };
export { tier, low, high, visible };

export const D2R = Math.PI / 180;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const ease2 = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const win = (p, a, b) => clamp((p - a) / (b - a));
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Cyanotype: the sheet is Prussian blue, the print lines are white, the pencil is yellow. The pale blue
// tint is the secondary line (dimensions); the yellow pencil also leads the colour in.
export const INK = '#f3f6fb';
export const PAPER = '#1e4a8c';
export const ACCENT = '#f4b63f';
export const ACCENT_HI = '#ffd27a';
export const ACCENT2 = '#a9d2f2';

// W, H: the canvas in CSS pixels (not the window: on a phone the canvas keeps its size while the URL bar slides).
// dpr: the resolution the governor has chosen. rev counts real resizes, for things that cache a layout.
export const ctx = { W: innerWidth, H: innerHeight, res: new THREE.Vector2(innerWidth, innerHeight), lineMats: new Set(), shadows: false, phone: innerWidth < 700, dpr: 1, rev: 0, dirty: true };
// what the phone tier leaves out: textures at half size, lighter filtering
export const TEXK = low ? 0.5 : 1, ANISO = low ? 4 : 8;

// ---------- the plotter. Everything is drawn in by a front that sweeps through the model: lines first
// (with an orange pen tip), then the fills behind them. order = dot(world, dir) + radial * distance from c.
export const DRAW = {
  uDraw: { value: 1e5 }, uDrawFill: { value: 1e5 }, uDrawSoft: { value: 1.2 },
  uDrawDir: { value: new THREE.Vector4(0, 1, 0, 0) }, uDrawC: { value: new THREE.Vector3() },
  uPen: { value: new THREE.Color('#f4b63f') },
  uBpLo: { value: new THREE.Color('#163a72') }, uBpHi: { value: new THREE.Color('#3a6db8') },   // the blueprint fills: shade and light
  uWash: { value: 0 },          // 1 = the fills are a light colour wash on paper, as on a drawing
};
const DRAW_GLSL = `uniform float uDraw; uniform float uDrawFill; uniform float uDrawSoft; uniform vec4 uDrawDir; uniform vec3 uDrawC; uniform vec3 uPen; uniform float uWash; uniform vec3 uBpLo; uniform vec3 uBpHi;
  varying vec3 vWD;
  float drawOrder(vec3 w) { return dot(w, uDrawDir.xyz) + uDrawDir.w * length(w.xz - uDrawC.xz); }
`;
const addDraw = (sh) => { Object.assign(sh.uniforms, DRAW); };

// ---------- the colour. Every material keeps its drawn tone and knows its real one. A front (planar, radial or
// both, with a little noise so it reads like paint soaking into paper) carries the real colours in, a second
// front carries them out again. The thin band at each front glows in the secondary tint.
export const LIVE = {
  uInF: { value: -1e5 }, uOutF: { value: -1e5 },
  uInDir: { value: new THREE.Vector4(0, 0, 0, 1) }, uInC: { value: new THREE.Vector3() },
  uOutDir: { value: new THREE.Vector4(0, -1, 0, 0) }, uOutC: { value: new THREE.Vector3() },
  uLiveSoft: { value: 2.5 }, uInN: { value: 2 }, uOutN: { value: 2 },
  uLive: { value: 0 },          // how much colour there is overall: sky light, motes, lamps
  uTime: { value: 0 },
  uEdge: { value: new THREE.Color(ACCENT) },
  uSunDir: { value: new THREE.Vector3(-0.5, 0.55, 0.65).normalize() },
  uSunCol: { value: new THREE.Color('#fff4e2') }, uSkyCol: { value: new THREE.Color('#dbe7f1') }, uBounce: { value: new THREE.Color('#ece8df') },
  uRoom: { value: new THREE.Vector4(0, 0, 0, 0) }, uRoomY: { value: new THREE.Vector4(0, 0, 0, 0) },
  uFoot: { value: new THREE.Vector4(0, 0, 0, 0) }, uFoot2: { value: new THREE.Vector2(0, 1.5) },
  uGrass: { value: new THREE.Color('#8fa46f') }, uGrass2: { value: new THREE.Color('#849965') },
};
const addLive = (sh) => { Object.assign(sh.uniforms, LIVE); };
const LIVE_GLSL = `uniform float uInF; uniform float uOutF; uniform vec4 uInDir; uniform vec3 uInC; uniform vec4 uOutDir; uniform vec3 uOutC;
  uniform float uLiveSoft; uniform float uInN; uniform float uOutN; uniform float uLive; uniform float uTime; uniform vec3 uEdge;
  uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uBounce; uniform vec4 uRoom; uniform vec4 uRoomY;
  uniform vec4 uFoot; uniform vec2 uFoot2; uniform vec3 uGrass; uniform vec3 uGrass2;
  float lvH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float lvN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(lvH(i), lvH(i + vec3(1, 0, 0)), f.x), mix(lvH(i + vec3(0, 1, 0)), lvH(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(lvH(i + vec3(0, 0, 1)), lvH(i + vec3(1, 0, 1)), f.x), mix(lvH(i + vec3(0, 1, 1)), lvH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  // x: how much real colour, y: the glow of a passing front
  vec2 liveAt(vec3 w) {
    if (uInF < -9e4) return vec2(0.0);
    float n = lvN(w * 0.45) * 0.65 + lvN(w * 1.7 + 3.1) * 0.35 - 0.5;
    float oi = dot(w, uInDir.xyz) + uInDir.w * length(w - uInC) + n * uInN;
    float oo = dot(w, uOutDir.xyz) + uOutDir.w * length(w - uOutC) + n * uOutN;
    float a = 1.0 - smoothstep(uInF - uLiveSoft, uInF, oi);
    float b = smoothstep(uOutF - uLiveSoft, uOutF, oo);
    float ea = smoothstep(0.0, 0.5, a) * (1.0 - smoothstep(0.5, 1.0, a));
    float eb = smoothstep(0.0, 0.5, b) * (1.0 - smoothstep(0.5, 1.0, b));
    return vec2(a * b, ea * b + eb * a);
  }
  vec3 swayOff(vec3 w, float amp) {
    return amp * (0.45 + 0.55 * uLive) * vec3(sin(uTime * 1.7 + w.x * 2.1 + w.z * 1.3 + w.y * 0.9), 0.0, cos(uTime * 1.3 + w.z * 2.3 + w.x * 0.7 + w.y * 1.1));
  }
  // the ground in colour: a meadow with a soft shadow of the building thrown away from the sun
  vec3 groundCol(vec2 xz, float ink) {
    float n = lvN(vec3(xz * 0.16, 0.0)) * 0.55 + lvN(vec3(xz * 0.8, 2.0)) * 0.3 + lvN(vec3(xz * 3.6, 5.0)) * 0.15;
    vec3 g = mix(uGrass2, uGrass, n);
    vec3 sd = normalize(uSunDir);
    vec3 L = vec3(1.0);
    float sh = 1.0;
    if (uFoot.z > uFoot.x) {
      vec2 off = -sd.xz / max(sd.y, 0.3) * uFoot2.x;
      vec2 c = (uFoot.xy + uFoot.zw) * 0.5 + off * 0.5, hs = (uFoot.zw - uFoot.xy) * 0.5 + abs(off) * 0.5;
      vec2 q = abs(xz - c) - hs; float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      sh = 1.0 - 0.28 * (1.0 - smoothstep(-0.6, uFoot2.y, d));
    }
    vec3 col = g * L * mix(vec3(0.82, 0.8, 0.92), vec3(1.0), sh);
    return mix(col, vec3(1.0), ink * 0.35);
  }
`;
function patchFill(m, o = {}) {
  const prev = m.onBeforeCompile;
  const grainAmt = o.grain ?? 0.022;
  const real = new THREE.Color(o.real ?? (m.map ? '#ffffff' : m.color));
  if (o.island) { m.transparent = true; m.depthWrite = false; }
  const base = m.color.clone();
  m.userData.real = real;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    addDraw(sh); addLive(sh);
    sh.uniforms.uGrain = { value: grainAmt };
    sh.uniforms.uFlat = { value: o.flat ?? 0.5 };      // how much of the flat local colour stays in the coloured picture
    sh.uniforms.uReal = { value: real }; sh.uniforms.uBase = { value: base }; sh.uniforms.uSway = { value: o.sway ?? 0 };
    sh.uniforms.uIsland = { value: new THREE.Vector4(...(o.island || [0, 0, 1, 1])) }; sh.uniforms.uIslandMode = { value: o.island?.[4] ?? -1 };
    sh.vertexShader = LIVE_GLSL + 'uniform float uSway; varying vec3 vWD; varying vec3 vLP;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n if (uSway > 0.0) transformed += swayOff((modelMatrix * vec4(transformed, 1.0)).xyz, uSway);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWD = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vLP = transformed;');
    const realCode = o.ground
      ? 'vec3 rc = groundCol(vWD.xz, clamp(dot(texel, vec3(0.333)) * 1.6 - 0.1, 0.0, 1.0));'
      : 'vec3 rc = texel * uReal;';
    sh.fragmentShader = DRAW_GLSL + LIVE_GLSL + 'uniform float uGrain; uniform float uFlat; uniform vec3 uReal; uniform vec3 uBase; uniform vec4 uIsland; uniform float uIslandMode; varying vec3 vLP; vec2 gLive;\nfloat hash3(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }\n' + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', 'if (drawOrder(vWD) > uDrawFill) discard;\n gLive = liveAt(vWD);\n#include <clipping_planes_fragment>')
      .replace('#include <map_fragment>', '#include <map_fragment>\n { vec3 texel = diffuseColor.rgb / max(uBase, vec3(1e-3)); ' + realCode + ' diffuseColor.rgb = mix(diffuseColor.rgb, rc, gLive.x); }'
        + (o.wash === false ? '' : '\n diffuseColor.rgb = mix(diffuseColor.rgb, mix(mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.5), uBpLo, 0.4), uWash);')
        + '\n diffuseColor.rgb *= 1.0 + (hash3(floor(vLP * 140.0)) - 0.5) * uGrain * (1.0 - 0.5 * uWash) * (1.0 - 0.6 * gLive.x);');
    // the blueprint grade: every drawn fill is a blue wash between shade and light; the real colour takes over where
    // the front has passed
    const grade = o.grade === false ? '' : `{ vec3 gc = gl_FragColor.rgb; float gl = dot(gc, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = mix(mix(uBpLo, uBpHi, smoothstep(0.02, 0.7, gl)), mix(gc * 1.12, diffuseColor.rgb * 0.95, uFlat), gLive.x); }`;
    const island = 'if (uIslandMode > -0.5) { float fd = 1.0 - smoothstep(0.5, 1.0, length((vWD.xz - uIsland.xy) / uIsland.zw)); gl_FragColor.a *= uIslandMode > 0.5 ? gLive.x * fd : mix(1.0, fd, gLive.x); }';
    sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', grade + '\n gl_FragColor.rgb += uEdge * gLive.y * 0.28;\n' + island + '\n #include <tonemapping_fragment>');
  };
  return m;
}
function patchLine(m, o = {}) {
  m.userData.liveK = o.live === false ? 0 : 1;
  m.onBeforeCompile = (sh) => {
    addDraw(sh); addLive(sh);
    sh.uniforms.uLiveK = { value: m.userData.liveK }; sh.uniforms.uSway = { value: o.sway ?? 0 };
    let vs = LIVE_GLSL + 'uniform float uSway;\n' + sh.vertexShader.replace('void main() {', 'varying vec3 vWD;\nvoid main() {\n vWD = (modelMatrix * vec4((position.y < 0.5) ? instanceStart : instanceEnd, 1.0)).xyz;');
    if (o.sway) vs = vs
      .replace('vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );', 'vec4 start = modelViewMatrix * vec4( instanceStart + swayOff((modelMatrix * vec4(instanceStart, 1.0)).xyz, uSway), 1.0 );')
      .replace('vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );', 'vec4 end = modelViewMatrix * vec4( instanceEnd + swayOff((modelMatrix * vec4(instanceEnd, 1.0)).xyz, uSway), 1.0 );');
    sh.vertexShader = vs;
    // in colour the ink steps back to a fine dark line, as on a coloured presentation drawing
    sh.fragmentShader = DRAW_GLSL + LIVE_GLSL + 'uniform float uLiveK;\n' + sh.fragmentShader.replace('#include <color_fragment>', `{ float k = uDraw - drawOrder(vWD); if (k < 0.0) discard;
        diffuseColor.rgb = mix(uPen, diffuseColor.rgb, smoothstep(0.0, uDrawSoft, k)); }
      if (uLiveK > 0.0) { vec2 lv = liveAt(vWD) * uLiveK; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.105, 0.11), lv.x) + uEdge * lv.y * 0.6; alpha *= 1.0 - 0.6 * lv.x; }
      #include <color_fragment>`);
  };
  return m;
}
export { patchFill };

// stills and recordings (?p, ?drive) read the canvas back and keep the device's resolution; the live page lets
// the governor choose it
const QS = new URLSearchParams(location.search);
export const REC = QS.has('p') || QS.has('drive');
const canvasEl = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, preserveDrawingBuffer: REC, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
export const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);

let _studioEnv = null;
export function ensureEnv() {
  if (_studioEnv) return _studioEnv;
  const envScene = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#dbe7f1'); gr.addColorStop(0.5, '#b9bec2'); gr.addColorStop(1, '#8c8a84');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
  const card = (w, h, p, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); envScene.add(m);
  };
  card(24, 14, [28, 18, 16], 0xffffff);
  card(20, 12, [-22, 16, 20], 0xf3eeee);
  _studioEnv = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.03).texture;
  return _studioEnv;
}

// ---------- geometry
export function bx(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
// a square-section member from a to b: w across (stays horizontal when it can), d the other way
export function beam(a, b, w, d) {
  const dir = b.clone().sub(a); const L = dir.length(); dir.normalize();
  const g = new THREE.BoxGeometry(w, d, L);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
export function cyl(r, h, x, y, z, seg = 28, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(x, y + h / 2, z); return g;
}
export function ball(r, x, y, z, detail = 3) { const g = new THREE.IcosahedronGeometry(r, detail); g.translate(x, y, z); return g; }

const pts = a => a.map(([u, v]) => new THREE.Vector2(u, v));
// a flat panel drawn in (u, v) and extruded th along +w. Holes are point lists or {c:[u,v], r}.
export function panel(outline, holes = [], th = 0.12) {
  const s = outline instanceof THREE.Shape ? outline : new THREE.Shape(pts(outline));
  for (const h of holes) {
    if (h.r) { const p = new THREE.Path(); p.absarc(h.c[0], h.c[1], h.r, 0, Math.PI * 2, true); s.holes.push(p); }
    else s.holes.push(new THREE.Path(pts(h)));
  }
  return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 40 });
}
export function ring(r0, r1, th) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 40 });
}
// placements for panels: u along x at z0 (w goes +z) / u along z with w going -x from x1 / lying flat (v = -z, w up)
export const M = {
  alongX: (z0, y0 = 0) => new THREE.Matrix4().makeTranslation(0, y0, z0),
  alongZ: (x1, y0 = 0) => new THREE.Matrix4().makeTranslation(x1, y0, 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)),
  flat: (y0 = 0) => new THREE.Matrix4().makeTranslation(0, y0, 0).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
};

// ---------- materials
// Line widths are CSS pixels. A phone draws them a little finer, but never thinner than about 0.8 of a pixel
// of the buffer, or the fine lines break up when the resolution steps down.
function fitLine(m) { m.linewidth = Math.max(m.userData.w * (ctx.phone ? 0.72 : 1), 0.8 / ctx.dpr); }
export function lineMat(o = {}) {
  const m = new LineMaterial({
    color: new THREE.Color(o.color ?? INK), linewidth: o.w ?? 1, dashed: !!o.dashed,
    dashSize: o.dash ?? 0.3, gapSize: o.gap ?? 0.22, transparent: true, opacity: o.opacity ?? 1,
    depthTest: o.depthTest ?? true, depthWrite: false,
  });
  m.userData.w = o.w ?? 1; m.resolution.copy(ctx.res); ctx.lineMats.add(m);
  fitLine(m);
  return patchLine(m, o);
}
// The drawing's own shading: directional sun + cool sky fill + procedural local-space architectural texture
// mode: 0 = paper/plaster, 1 = timber/oak/glulam, 2 = cast concrete, 3 = standing-seam zinc, 4 = woven textile, 5 = glass
// o.real: the colour it has in the world; o.realMode / o.realTex: the surface it shows then; o.realGlow: light it
// gives off in colour (lamp shades, embers); o.realOp: glass gets a touch more body; o.sway: leaves move in the air
export function toneMat(hex, o = {}) {
  const op = o.opacity ?? 1;
  const mode = o.mode ?? 0;
  const sc = o.scale ?? 1.0;
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(hex) },
      uOp: { value: op },
      uMode: { value: mode },
      uScale: { value: sc },
      uTex: { value: o.tex ?? 2.4 },
      uGlow: { value: new THREE.Color(o.glow ?? '#000000') },
      uReal: { value: new THREE.Color(o.real ?? hex) },
      uRealMode: { value: o.realMode ?? mode },
      uRealTex: { value: o.realTex ?? 2.2 },
      uRealGlow: { value: new THREE.Color(o.realGlow ?? '#000000') },
      uOpR: { value: o.realOp ?? op },
      uSway: { value: o.sway ?? 0 },
      // o.realMap: a picture of the surface it has in colour (wood, brick), laid on in metres: o.mapM is the
      // size of one tile, o.mapRot turns it a quarter on the walls (x: grain across, y: grain up)
      uRealMap: { value: o.realMap ?? null },
      uMapM: { value: new THREE.Vector3(1 / (o.mapM ?? 1), o.mapRot ?? 0, o.mapOff ?? 0) },
      ...DRAW, ...LIVE,
    },
    defines: o.realMap ? { REAL_MAP: '' } : {},
    vertexShader: LIVE_GLSL + `uniform float uSway; varying vec3 vN; varying vec3 vWD; varying vec3 vLP;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vLP = position;
        vec3 pos = position;
        if (uSway > 0.0) pos += swayOff((modelMatrix * vec4(position, 1.0)).xyz, uSway);
        vWD = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: DRAW_GLSL + LIVE_GLSL + `uniform vec3 uCol; uniform float uOp; uniform float uMode; uniform float uScale; uniform float uTex; uniform vec3 uGlow;
      uniform vec3 uReal; uniform float uRealMode; uniform float uRealTex; uniform vec3 uRealGlow; uniform float uOpR;
      varying vec3 vN; varying vec3 vLP;
      #ifdef REAL_MAP
      uniform sampler2D uRealMap; uniform vec3 uMapM;
      vec3 realSurf(vec3 n) {
        vec2 mv = abs(n.y) > 0.7 ? vec2(vLP.x, -vLP.z) : (abs(n.x) > 0.7 ? vec2(-vLP.z * sign(n.x), vLP.y) : vec2(vLP.x * sign(n.z), vLP.y));
        if (uMapM.y > 0.5) mv = vec2(mv.y, -mv.x);
        return texture2D(uRealMap, mv * uMapM.x + uMapM.z).rgb;
      }
      #endif
      // the drawn state is a blue wash: the authored tone only decides how light the fill is
      vec3 bpTone(vec3 c) { return mix(uBpLo, uBpHi, smoothstep(0.02, 0.7, dot(c, vec3(0.2126, 0.7152, 0.0722)))); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y);
      }
      float texOf(float mode, vec3 p, vec2 uv, float top) {
        if (mode > 0.5 && mode < 1.5) {
          // Mode 1: architectural timber / oak / glulam grain & plank variation
          float plankId = floor(uv.y * 5.0);
          float plankTone = (h2(vec2(plankId, floor(uv.x * 0.4))) - 0.5) * 0.045;
          float wave = sin(uv.x * 3.5 + n2(uv * 2.2) * 4.5);
          float grain = (n2(vec2(uv.x * 4.0, uv.y * 38.0 + wave * 1.8)) - 0.5) * 0.042;
          float seam = smoothstep(0.035, 0.0, fract(uv.y * 5.0)) * -0.045;
          return plankTone + grain + seam;
        } else if (mode >= 1.5 && mode < 2.5) {
          // Mode 2: cast concrete with lift lines and mineral aggregate stipple
          float lift = smoothstep(0.03, 0.0, fract(p.y * 2.5)) * -0.05;
          float blotch = (n2(uv * 3.2) - 0.5) * 0.045;
          float stipple = (h2(floor(uv * 65.0)) - 0.5) * 0.048;
          return lift + blotch + stipple;
        } else if (mode >= 2.5 && mode < 3.5) {
          // Mode 3: standing-seam zinc roof panels
          float pan = sin(uv.x * 14.0) * 0.018;
          float stria = (n2(vec2(uv.x * 45.0, uv.y * 3.0)) - 0.5) * 0.025;
          return pan + stria + 0.02 * top;
        } else if (mode >= 3.5 && mode < 4.5) {
          // Mode 4: woven textile / upholstery / rug
          float w1 = sin(uv.x * 90.0) * sin(uv.y * 90.0) * 0.022;
          float w2 = (n2(uv * 16.0) - 0.5) * 0.03;
          return w1 + w2;
        }
        // Mode 0: warm paper / lime plaster micro-grain
        return (n2(uv * 5.5) - 0.5) * 0.018 + (h2(floor(uv * 90.0)) - 0.5) * 0.016;
      }
      // daylight for the real colours: a warm sun, a cool sky and the bounce off the ground. Under the roof of
      // the house the sun only comes in through the glass, so the rooms go warm and quiet, lit by their lamps.
      vec3 dayLight(vec3 n) {
        // not a physical light: an illustrator's. Everything is bright and soft, the sun side a little warmer
        // and lifted, the shade side a little cooler, and the rooms a touch warmer still.
        vec3 sd = normalize(uSunDir);
        float sunL = max(dot(n, sd), 0.0), hemi = n.y * 0.5 + 0.5;
        vec3 L = mix(uBounce, uSkyCol, hemi) * 0.84 + uSunCol * sunL * 0.3;
        if (uRoomY.w > 0.5) {
          float inside = step(uRoom.x, vWD.x) * step(vWD.x, uRoom.y) * step(uRoom.z, vWD.z) * step(vWD.z, uRoom.w)
            * step(uRoomY.x, vWD.y) * step(vWD.y, uRoomY.y + (uRoom.w - abs(vWD.z)) * uRoomY.z);
          L = mix(L, L * 0.93 + vec3(0.07, 0.045, 0.015), inside);
        }
        return L;
      }
      void main(){
        if (drawOrder(vWD) > uDrawFill) discard;
        vec3 n = normalize(vN);
        vec3 L1 = normalize(vec3(-0.38, 1.0, 0.55));
        vec3 L2 = normalize(vec3(0.45, 0.35, -0.65));
        float sun = max(dot(n, L1), 0.0);
        float sky = max(dot(n, L2), 0.0);
        float top = clamp(n.y, 0.0, 1.0);
        float shade = 0.60 + 0.34 * sun + 0.08 * sky + 0.06 * top;
        vec3 p = vLP * uScale;
        vec2 uv = abs(n.y) > 0.7 ? p.xz : (abs(n.x) > 0.7 ? p.zy : p.xy);
        vec2 lv = liveAt(vWD);
        if (uMode >= 4.5) {
          // Mode 5: architectural triple glazing with diagonal skylight sheen; in colour it holds the sky
          float sheen = smoothstep(0.45, 0.55, sin((vLP.x + vLP.y * 1.35 + vLP.z) * 1.8)) * 0.08;
          vec3 c0 = bpTone(uCol * (shade + sheen));
          vec3 c1 = mix(uReal * (0.9 + 0.1 * top), vec3(1.0), sheen * 3.0);
          gl_FragColor = vec4(mix(c0, c1, lv.x) + uEdge * lv.y * 0.3, mix(uOp, uOpR, lv.x) + sheen * 0.45 + lv.y * 0.12);
          #include <colorspace_fragment>
          return;
        }
        vec3 col = bpTone(uCol * (shade + texOf(uMode, p, uv, top) * uTex)) + uGlow;
        if (lv.x > 0.002) {
          vec3 rc = uReal;
          #ifdef REAL_MAP
          rc *= realSurf(n);
          #endif
          vec3 cr = rc * dayLight(n) * (1.0 + texOf(uRealMode, p, uv, top) * uRealTex) + uRealGlow * (0.6 + 0.4 * uLive);
          col = mix(col, cr, lv.x);
        }
        gl_FragColor = vec4(col + uEdge * lv.y * 0.3, mix(uOp, uOpR, lv.x));
        #include <colorspace_fragment>
      }`,
    transparent: op < 1, depthWrite: op >= 1, side: o.side ?? THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}
export function stdMat(hex, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: hex, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0, map: o.map ?? null,
    bumpMap: low ? null : (o.bumpMap ?? null), bumpScale: o.bumpScale ?? 0.016,      // a phone does without the fine relief
    roughnessMap: o.roughnessMap ?? null,
    envMap: o.envMap ?? ensureEnv(), envMapIntensity: o.env ?? 0.42,
    transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null,
    side: o.side ?? THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
  });
  return patchFill(m, o);
}
// silhouettes for round things: the back faces pushed out a fixed number of pixels
const HULLS = new Map();
export function hullMat(px = 1, color = INK) {
  const hk = px + '|' + color;
  if (HULLS.has(hk)) return HULLS.get(hk);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  HULLS.set(hk, m);
  m.onBeforeCompile = s => {
    s.uniforms.uPx = { value: px }; s.uniforms.uRes = { value: ctx.res }; addDraw(s); addLive(s);
    s.fragmentShader = DRAW_GLSL + LIVE_GLSL + s.fragmentShader
      .replace('#include <clipping_planes_fragment>', 'if (drawOrder(vWD) > uDrawFill) discard;\n#include <clipping_planes_fragment>')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.42, 0.38, 0.34), liveAt(vWD).x);\n#include <tonemapping_fragment>');
    s.vertexShader = 'varying vec3 vWD;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWD = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.vertexShader = 'uniform float uPx; uniform vec2 uRes;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 cn = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
        vec2 d = cn.xy; float l = length(d); if (l > 1e-5) gl_Position.xy += d / l * uPx * 2.0 / uRes * gl_Position.w; }`);
  };
  return m;
}

// Long edges are cut into short runs. A segment that reaches behind the camera is trimmed at the near plane,
// and a very long one loses its depth there: it then shows through walls and ceilings as a stray line.
export function shortSegs(arr, max = 0.9) {
  const out = [], seen = new Set(), q = v => Math.round(v * 2000);
  for (let i = 0; i < arr.length; i += 6) {
    const dx = arr[i + 3] - arr[i], dy = arr[i + 4] - arr[i + 1], dz = arr[i + 5] - arr[i + 2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) continue;
    // where two boxes meet, both bring the same edge: draw it once
    const a = q(arr[i]) + ',' + q(arr[i + 1]) + ',' + q(arr[i + 2]), b = q(arr[i + 3]) + ',' + q(arr[i + 4]) + ',' + q(arr[i + 5]);
    const key = a < b ? a + '|' + b : b + '|' + a;
    if (seen.has(key)) continue; seen.add(key);
    const n = Math.max(1, Math.ceil(len / max));
    for (let k = 0; k < n; k++) out.push(arr[i] + dx * k / n, arr[i + 1] + dy * k / n, arr[i + 2] + dz * k / n, arr[i] + dx * (k + 1) / n, arr[i + 1] + dy * (k + 1) / n, arr[i + 2] + dz * (k + 1) / n);
  }
  return out;
}
// A fat line is a quad with a cap at either end: six triangles a segment. The lines here are a pixel or two wide,
// so below the desktop tier the caps are left off: two triangles a segment, a third of the work for the same picture.
const NOCAPS = [2, 4, 3, 4, 5, 3];
export function lineGeo(positions) {
  const g = new LineSegmentsGeometry(); g.setPositions(positions);
  if (!high) g.setIndex(NOCAPS);
  return g;
}

// ---------- parts: geometry collected per material, merged, with ink edges on top
// seg: the longest run a line is cut into. 0.9 m wherever the camera walks; things it only sees from afar can take more.
export class Part {
  constructor(parent, pal, line, weights = {}, seg = 0.9) { this.parent = parent; this.pal = pal; this.line = line; this.weights = weights; this.seg = seg; this.b = new Map(); }
  add(key, ...gs) {
    const spec = this.pal[key];
    for (let g of gs) {
      if (g.index) g = g.toNonIndexed();
      if (spec?.uvScale) boxUV(g, spec.uvScale, spec.uvAlong);
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!this.b.has(key)) this.b.set(key, []);
      this.b.get(key).push(g);
    }
    return this;
  }
  build() {
    // one mesh per material; the edges of everything that shares a pen go into one set of lines, and the
    // silhouettes that share a hull into one mesh
    const edges = new Map(), hulls = new Map();
    for (const [key, list] of this.b) {
      const spec = this.pal[key]; if (!spec) throw new Error('no material ' + key);
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, spec.mat);
      mesh.castShadow = spec.cast ?? true; mesh.receiveShadow = spec.receive ?? true;
      this.parent.add(mesh);
      if (spec.edges !== false) {
        const eg = new THREE.EdgesGeometry(geo, spec.thr ?? 30), lm = spec.line || (spec.w && this.weights[spec.w]) || this.line;
        if (!edges.has(lm)) edges.set(lm, []);
        edges.get(lm).push(eg.attributes.position.array);
      }
      if (spec.hull) {
        const hm = spec.hullMat || (spec.hullMat = hullMat(spec.hull === true ? 1 : spec.hull, spec.hullColor));
        if (!hulls.has(hm)) hulls.set(hm, []);
        hulls.get(hm).push(geo);
      }
    }
    for (const [lm, arrs] of edges) {
      const all = new Float32Array(arrs.reduce((n, a) => n + a.length, 0)); let o = 0;
      for (const a of arrs) { all.set(a, o); o += a.length; }
      this.parent.add(new LineSegments2(lineGeo(shortSegs(all, this.seg)), lm));
    }
    for (const [hm, geos] of hulls) {
      let geo = geos[0];
      if (geos.length > 1) {
        geo = new THREE.BufferGeometry();
        for (const name of ['position', 'normal']) {
          const all = new Float32Array(geos.reduce((n, g) => n + g.attributes[name].array.length, 0)); let o = 0;
          for (const g of geos) { all.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
          geo.setAttribute(name, new THREE.BufferAttribute(all, 3));
        }
      }
      const hull = new THREE.Mesh(geo, hm); hull.castShadow = false; hull.receiveShadow = false; this.parent.add(hull);
    }
    this.b.clear();
    return this;
  }
}
// loose line segments (hatching, board joints): [[x0,y0,z0,x1,y1,z1], ...]
export function segs(parent, list, mat, seg = 0.9) {
  if (!list.length) return null;
  const l = new LineSegments2(lineGeo(shortSegs(list.flat(), seg)), mat); parent.add(l); return l;
}
// a dashed line we move every frame: one buffer of fixed size, rewritten in place and only when it changed
export function liveLine(mat, cap = 96) {
  const g = lineGeo(new Float32Array(cap * 6));
  const l = new LineSegments2(g, mat); l.computeLineDistances(); l.frustumCulled = false; l.visible = false; scene.add(l);
  const pos = g.attributes.instanceStart.data, dist = g.attributes.instanceDistanceStart.data;
  pos.setUsage(THREE.DynamicDrawUsage); dist.setUsage(THREE.DynamicDrawUsage);
  let sig = NaN;
  l.set = (list) => {
    const n = Math.min(list.length, cap);
    if (!n) { l.visible = false; return; }
    l.visible = true;
    let s = n;
    for (let i = 0; i < n; i++) { const a = list[i]; s += (a[0] + a[1] * 1.7 + a[2] * 2.3 + a[3] * 3.1 + a[4] * 4.3 + a[5] * 5.9) * (i + 1); }
    if (s === sig) return; sig = s;
    let d = 0;
    for (let i = 0; i < n; i++) {
      const a = list[i]; pos.array.set(a, i * 6);
      dist.array[i * 2] = d; d += Math.hypot(a[3] - a[0], a[4] - a[1], a[5] - a[2]); dist.array[i * 2 + 1] = d;
    }
    pos.needsUpdate = true; dist.needsUpdate = true; g.instanceCount = n;
  };
  return l;
}

// ---------- camera. A key is a target, a direction (az, el), a lens and the height of the frame at the
// target. Between keys the lens is interpolated in log and the distance follows from the frame height,
// so widening the lens while holding the frame is a dolly zoom. A 1.5 degree lens from 1 km is an axo.
export function eyeKey(at, E, T, fov, extra = {}) {
  const d = V(...E).sub(V(...T)); const D = d.length();
  const v = V(...T).sub(V(...E));
  return {
    at, t: T, pos: E, look: T,
    laz: Math.atan2(v.z, v.x) / D2R, lel: Math.asin(v.y / D) / D2R, ldist: D,
    az: Math.atan2(d.z, d.x) / D2R, el: Math.asin(d.y / D) / D2R,
    fov, h: 2 * D * Math.tan(fov * D2R / 2), sx: 0, sy: 0, ...extra,
  };
}
const PHKEYS = new WeakMap();
export function camAt(keys0, p) {
  let keys = keys0;
  if (ctx.phone) { keys = PHKEYS.get(keys0); if (!keys) PHKEYS.set(keys0, keys = keys0.map(k => k.ph ? { ...k, ...k.ph } : k)); }
  let i = 0; while (i < keys.length - 1 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u = a === b ? 0 : (b.easeFn || ease)(clamp((p - a.at) / (b.at - a.at)));
  const L = (k) => lerp(a[k] ?? 0, b[k] ?? 0, u);
  const az = a.az + ((((b.az - a.az) % 360) + 540) % 360 - 180) * u;
  if (a.pos && b.pos) {
    const pos = [lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u)];
    const laz = (a.laz + ((((b.laz - a.laz) % 360) + 540) % 360 - 180) * u) * D2R;
    const lel = lerp(a.lel, b.lel, u) * D2R;
    const ldist = lerp(a.ldist, b.ldist, u);
    const t = [pos[0] + ldist * Math.cos(lel) * Math.cos(laz), pos[1] + ldist * Math.sin(lel), pos[2] + ldist * Math.cos(lel) * Math.sin(laz)];
    const fov = Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), u));
    return {
      pos, t, az, el: L('el'), fov,
      h: 2 * ldist * Math.tan(fov * D2R / 2), w: L('w'), sx: L('sx'), sy: L('sy'), roll: L('roll'),
    };
  }
  return {
    t: [lerp(a.t[0], b.t[0], u), lerp(a.t[1], b.t[1], u), lerp(a.t[2], b.t[2], u)],
    az, el: L('el'), fov: Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), u)),
    h: Math.exp(lerp(Math.log(a.h), Math.log(b.h), u)), w: L('w'), sx: L('sx'), sy: L('sy'), roll: L('roll'),
  };
}
export function applyCam(c, R = 80) {
  const aspect = ctx.W / ctx.H;
  const h = Math.max(c.h, (c.w || 0) / aspect);
  const D = h / (2 * Math.tan(c.fov * D2R / 2));
  if (c.pos) {
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
  } else {
    const az = c.az * D2R, el = c.el * D2R;
    camera.position.set(c.t[0] + D * Math.cos(el) * Math.cos(az), c.t[1] + D * Math.sin(el), c.t[2] + D * Math.cos(el) * Math.sin(az));
  }
  camera.up.set(0, 1, 0); camera.lookAt(c.t[0], c.t[1], c.t[2]);
  camera.fov = c.fov; camera.aspect = aspect;
  camera.near = Math.max(0.04, D - R); camera.far = D + R * 3;
  camera.updateProjectionMatrix();
  // lens shift, as an architectural camera does it: the picture slides, the lines stay parallel
  camera.projectionMatrix.elements[8] -= c.sx || 0;
  camera.projectionMatrix.elements[9] -= c.sy || 0;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.userData.D = D;
}

// ---------- the page over the canvas. Every write to the DOM goes through here and only happens when the value
// changed: a label that stands still costs nothing, and the browser has no styles to recalculate.
const r1 = v => Math.round(v * 10) / 10;
export const dom = {
  sty(el, k, v) { const c = el._s || (el._s = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } },
  op(el, v) { dom.sty(el, 'opacity', v <= 0.003 ? 0 : v >= 0.997 ? 1 : Math.round(v * 250) / 250); },
  attr(el, k, v) { const c = el._a || (el._a = {}); if (c[k] !== v) { c[k] = v; el.setAttribute(k, v); } },
  cls(el, k, on) { const c = el._k || (el._k = {}); if (c[k] !== on) { c[k] = on; el.classList.toggle(k, on); } },
  html(el, v) { if (el._h !== v) { el._h = v; el.innerHTML = v; } },
  text(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } },
};

// ---------- labels: a column to the right of the drawing, or tags beside their anchors
const tmp = new THREE.Vector3();
export class Labels {
  constructor() { this.root = document.getElementById('labels'); this.svg = document.getElementById('leaders'); this.items = []; this._rev = -1; this._w = 0; }
  add(o) {
    const el = document.createElement('div'); el.className = 'lab' + (o.mode === 'tag' ? ' tag' : '') + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = `<span class="no">${o.no}</span><span class="nm">${o.name}</span>${o.short ? `<span class="nm-s">${o.short}</span>` : ''}${o.sub ? `<span class="sb">${o.sub}</span>` : ''}`;
    if (o.short) el.classList.add('has-s');
    this.root.appendChild(el);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = '<polyline class="halo"/><polyline/><circle r="3.0" class="halo"/><circle r="2.2" class="dot"/><circle r="5.2" class="reticle"/><line class="tick"/>';
    this.svg.appendChild(g);
    const it = { ...o, el, g, op: 1, on: false, kids: [...g.children] }; this.items.push(it); this._rev = -1; return it;
  }
  // the widest label of the column, measured once per layout: the column may never run off the sheet
  colW() {
    if (this._rev !== ctx.rev) { this._rev = ctx.rev; this._w = 0; for (const it of this.items) if (it.mode !== 'tag') this._w = Math.max(this._w, it.el.offsetWidth); }
    return this._w;
  }
  update(colX) {
    const W = ctx.W, H = ctx.H;
    const vis = [];
    for (const it of this.items) {
      it.show = false;
      if (it.op <= 0.01) continue;
      it.obj.updateWorldMatrix(true, false);
      tmp.copy(it.at).applyMatrix4(it.obj.matrixWorld).project(camera);
      it.ax = (tmp.x * .5 + .5) * W; it.ay = (-tmp.y * .5 + .5) * H;
      it.ly = it.ay + (it.dy || 0);
      if (tmp.z < 1) { it.show = true; vis.push(it); }
    }
    // keep column labels apart: sort by height, push down, then pull the block back up if it ran off
    const col = vis.filter(i => i.mode !== 'tag').sort((a, b) => (a.rank ?? a.ly) - (b.rank ?? b.ly) || a.ly - b.ly);
    const gap = ctx.phone ? 26 : 48;
    for (let k = 1; k < col.length; k++) col[k].ly = Math.max(col[k].ly, col[k - 1].ly + gap);
    const over = col.length ? col[col.length - 1].ly - (H - (ctx.phone ? 125 : 222)) : 0;
    if (over > 0) { col.forEach(i => i.ly -= over); for (let k = col.length - 2; k >= 0; k--) col[k].ly = Math.min(col[k].ly, col[k + 1].ly - gap); }
    const xMax = col.length ? W - this.colW() - (ctx.phone ? 16 : 24) : W;
    for (const it of this.items) {
      const show = it.show;
      dom.op(it.el, show ? it.op : 0); dom.op(it.g, show ? it.op : 0);
      if (!show) continue;
      dom.cls(it.el, 'on', it.on); dom.cls(it.g, 'on', it.on);
      const [ph, pl, ch, c, ret, tick] = it.kids;
      const ax = r1(it.ax), ay = r1(it.ay);
      for (const e of [c, ch, ret]) { dom.attr(e, 'cx', ax); dom.attr(e, 'cy', ay); }
      if (it.mode === 'tag') {
        dom.sty(ret, 'display', 'none'); dom.sty(tick, 'display', 'none');
        const tk = ctx.phone ? 0.55 : 1, lx = r1(it.ax + (it.tx ?? 18) * tk), ly = r1(it.ay + (it.ty ?? -18) * tk);
        dom.sty(it.el, 'transform', (it.tx ?? 18) < 0 ? `translate(${lx - 6}px, ${ly - 8}px) translateX(-100%)` : `translate(${lx + 6}px, ${ly - 8}px)`);
        dom.sty(it.el, 'textAlign', (it.tx ?? 18) < 0 ? 'right' : 'left');
        const pts = `${ax},${ay} ${lx},${ly}`;
        dom.attr(pl, 'points', pts); dom.attr(ph, 'points', pts);
      } else {
        dom.sty(ret, 'display', ''); dom.sty(tick, 'display', '');
        const x = r1(Math.min(colX(it), xMax)), ly = r1(it.ly);
        dom.sty(it.el, 'transform', `translate(${x + 10}px, ${ly - 8}px)`);
        const elbow = r1(Math.max(it.ax + 16, x - 36));
        const pts = `${ax},${ay} ${elbow},${ay} ${x - 10},${ly} ${x + 2},${ly}`;
        dom.attr(pl, 'points', pts); dom.attr(ph, 'points', pts);
        dom.attr(tick, 'x1', x + 2); dom.attr(tick, 'y1', ly - 6);
        dom.attr(tick, 'x2', x + 2); dom.attr(tick, 'y2', ly + 6);
      }
    }
  }
}

// The renderer follows the canvas box, not the window. On a phone the canvas is as tall as the screen with the URL
// bar away (100vh), so the bar sliding in and out changes nothing here: no buffers are rebuilt and nothing stretches.
function setDpr(d) {
  ctx.dpr = d; ctx.dirty = true;
  renderer.setPixelRatio(d);                      // resizes the buffer to W x H x d
  for (const m of ctx.lineMats) fitLine(m);
}
let gov = null;
export function resize() {
  const W = canvasEl.clientWidth || innerWidth, H = canvasEl.clientHeight || innerHeight;
  if (gov && W === ctx.W && H === ctx.H) return;
  ctx.W = W; ctx.H = H; ctx.res.set(W, H); ctx.phone = W < 700; ctx.rev++; ctx.dirty = true;
  document.body.classList.toggle('phone', ctx.phone);
  setArea(W, H);
  renderer.setSize(W, H, false);
  for (const m of ctx.lineMats) m.resolution.copy(ctx.res);
  if (!gov) {
    // a still or a recording keeps the device's resolution; the live page starts from the tier's budget
    if (REC && pinnedDpr == null) { setDpr(Math.min(devicePixelRatio, 2)); gov = { frame() {}, hold() {}, refit() {}, dpr: ctx.dpr }; }
    else gov = governor({ apply: setDpr });
  } else { gov.refit(); gov.hold(600); for (const m of ctx.lineMats) fitLine(m); }
}
// once per animation frame: active = this frame is drawn at the full rate
export function pace(now, active) { gov?.frame(now, active); }
export function holdPace(ms) { gov?.hold(ms); }

// ---------- canvas textures
// draw() works in its own w x h pixels; on the phone tier the canvas behind it is half that size each way
export function canvasTex(w, h, draw, o = {}) {
  const k = o.full ? 1 : TEXK;
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d'); g.scale(c.width / w, c.height / h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// a small seeded random, so every load draws the same boards and books
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// UVs from world position, projected along each face's main axis (metres * scale). For hatches, grain and
// laminations that must keep the same spacing on every box.
export function boxUV(g, scale = 1, along = null) {
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    if (along === 'z' && ay >= ax && ay >= az) { const t = u; u = v; v = t; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------- the world around the drawing. One screen-sized quad behind everything: it casts each pixel's ray,
// finds the ground or the sky, and shows the blue sheet until the colour reaches that point.
const ASPECT = { value: 1 };
export const ENV = {
  uInvProj: { value: camera.projectionMatrixInverse }, uCamW: { value: camera.matrixWorld }, uCamPos: { value: camera.position },
  uGroundY: { value: 0 }, uPaper: { value: new THREE.Color(PAPER) }, uAspect: ASPECT,
  uZenith: { value: new THREE.Color('#dbe7f1') }, uMid: { value: new THREE.Color('#e7ecef') }, uHorizon: { value: new THREE.Color('#f3f1ea') },
};
// The colour is not a world but a picture laid over the whole screen, as in an architect's illustration: a clear
// blue sky, brighter towards the bottom, with soft white clouds drifting across. Where the colour has reached
// is still worked out in the world (the ground each pixel looks at, or a point in the sky), so it spreads from
// the building outwards across the screen.
export const envMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { ...ENV, ...LIVE },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
  fragmentShader: LIVE_GLSL + `varying vec2 vUv;
    uniform mat4 uInvProj; uniform mat4 uCamW; uniform vec3 uCamPos; uniform float uGroundY; uniform vec3 uPaper; uniform float uAspect;
    uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon;
    void main() {
      vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); v.xyz /= v.w;
      vec3 rd = normalize((uCamW * vec4(v.xyz, 0.0)).xyz), ro = uCamPos, P;
      if (rd.y < -0.0004 && ro.y > uGroundY) { P = ro + rd * ((uGroundY - ro.y) / rd.y); float d = length(P.xz); if (d > 20.0) P.xz *= 20.0 / d; }
      else { P = ro + rd * 18.0; if (length(P) > 21.0) P = normalize(P) * 21.0; }
      vec2 lv = liveAt(P);
      if (lv.x + lv.y < 0.001) { gl_FragColor = vec4(uPaper, 1.0);
        #include <colorspace_fragment>
        return; }
      vec2 q = vUv, a = vec2(uAspect, 1.0);
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.6, q.y));
      col = mix(col, uZenith, smoothstep(0.5, 1.08, q.y));
      col += vec3(1.0, 0.96, 0.88) * 0.08 * exp(-length((q - vec2(0.16, 0.95)) * a) * 2.4);
      vec2 cp = q * a * vec2(1.25, 3.0) + vec2(uTime * 0.007, 0.0);
      float c = lvN(vec3(cp, 0.0)) * 0.52 + lvN(vec3(cp * 2.2, 1.3)) * 0.3 + lvN(vec3(cp * 4.6, 2.7)) * 0.18;
      float band = smoothstep(0.18, 0.5, q.y) * (1.0 - smoothstep(0.92, 1.0, q.y));
      float cl = smoothstep(0.55, 0.7, c) * band;
      col = mix(col, mix(vec3(0.82, 0.87, 0.93), vec3(1.0), smoothstep(0.58, 0.78, c)), cl * 0.8);
      gl_FragColor = vec4(mix(uPaper, col, lv.x) + uEdge * lv.y * 0.22, 1.0);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
}));
envMesh.frustumCulled = false; envMesh.renderOrder = -1000; scene.add(envMesh);

// ---------- transitions between the sheets: a screen quad over everything. 1 wipe, 2 iris, 3 blinds, 4 dissolve.
// t = 0 shows the drawing, t = 1 covers it. Every edge is drawn in the secondary tint.
export const FX = {
  uMode: { value: 0 }, uT: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uDir: { value: new THREE.Vector2(0, 1) },
  uAspect: ASPECT, uCover: { value: new THREE.Color('#163a72') }, uFxEdge: { value: new THREE.Color(ACCENT) }, uFxTime: { value: 0 },
};
export const fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: FX,
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform float uMode; uniform float uT; uniform vec2 uC; uniform vec2 uDir; uniform float uAspect; uniform vec3 uCover; uniform vec3 uFxEdge; uniform float uFxTime;
    float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      if (uT <= 0.0001) discard;
      vec2 q = vUv, a = vec2(uAspect, 1.0);
      float n = fn(q * a * 7.0 + uFxTime * 0.3) * 0.65 + fn(q * a * 23.0) * 0.35 - 0.5;
      float cov = 0.0, edge = 0.0;
      if (uMode < 1.5) {
        // wipe: a straight front with a ragged edge and a scan line
        float s = dot((q - 0.5) * a, normalize(uDir)) / (0.5 * length(a)) * 0.5 + 0.5 + n * 0.035;
        float f = uT * 1.12 - 0.06;
        cov = 1.0 - smoothstep(f - 0.004, f + 0.004, s);
        edge = exp(-pow((s - f) * 70.0, 2.0)) + 0.35 * exp(-pow((s - f + 0.03) * 22.0, 2.0));
      } else if (uMode < 2.5) {
        // iris: a circle closes on a point
        float r = length((q - uC) * a) + n * 0.02, R = (1.0 - uT) * 1.25 * length(a);
        cov = smoothstep(R - 0.003, R + 0.003, r);
        edge = exp(-pow((r - R) * 90.0, 2.0)) + 0.3 * exp(-pow((r - R) * 25.0, 2.0));
      } else if (uMode < 3.5) {
        // blinds: slats close one after another, top to bottom
        float N = 9.0, k = floor((1.0 - q.y) * N), fy = fract((1.0 - q.y) * N);
        float t = clamp(uT * 1.7 - k / N * 0.7, 0.0, 1.0);
        cov = step(fy, t);
        edge = exp(-pow((fy - t) * N * 9.0, 2.0)) * step(0.001, t) * step(t, 0.999);
      } else {
        // dissolve: the drawing breaks up into soft cells
        float v = fn(q * a * 9.0) * 0.6 + fn(q * a * 31.0) * 0.4;
        float f = uT * 1.2 - 0.1;
        cov = 1.0 - smoothstep(f - 0.015, f + 0.015, v);
        edge = exp(-pow((v - f) * 40.0, 2.0));
      }
      edge *= 1.0 - smoothstep(0.85, 1.0, uT);
      vec3 col = mix(uCover, uFxEdge * 1.25, clamp(edge, 0.0, 1.0) * (1.0 - cov * 0.6));
      gl_FragColor = vec4(col, max(cov, clamp(edge, 0.0, 1.0) * 0.95));
    }`,
  transparent: true, depthTest: false, depthWrite: false,
}));
fxMesh.frustumCulled = false; fxMesh.renderOrder = 10000; scene.add(fxMesh);

const DPR = { get value() { return ctx.dpr; } };
// ---------- motes: specks of dust and pollen drifting in the light, only where the colour is
export function motes(o) {
  const n = o.n ?? 400, r = rng(o.seed ?? 11);
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = new Float32Array(n * 2);
  const [x0, y0, z0] = o.min, [x1, y1, z1] = o.max;
  for (let i = 0; i < n; i++) { pos.set([lerp(x0, x1, r()), lerp(y0, y1, r()), lerp(z0, z1, r())], i * 3); ph.set([r() * 6.283, 0.5 + r()], i * 2); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 2));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...LIVE, uSize: { value: o.size ?? 0.03 }, uRes: { value: ctx.res }, uDpr: DPR, uCol: { value: new THREE.Color(o.color ?? '#ffe2b0') },
      uMin: { value: new THREE.Vector3(x0, y0, z0) }, uSpan: { value: new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0) } },
    vertexShader: LIVE_GLSL + `attribute vec2 aPh; uniform float uSize; uniform vec2 uRes; uniform float uDpr; uniform vec3 uMin; uniform vec3 uSpan; varying float vA;
      void main() {
        vec3 p = position; float sp = aPh.y;
        p.y = uMin.y + mod(p.y - uMin.y + uTime * 0.05 * sp, uSpan.y);
        p.x += sin(uTime * 0.23 * sp + aPh.x) * 0.4; p.z += cos(uTime * 0.19 * sp + aPh.x * 1.3) * 0.4;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        float k = (p.y - uMin.y) / uSpan.y;
        float edgeFade = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.88, 1.0, k));
        vA = liveAt(wp.xyz).x * uLive * edgeFade * (0.45 + 0.55 * sin(uTime * 1.6 * sp + aPh.x * 3.0) * sin(uTime * 0.7 + aPh.x));
        vec4 mv = viewMatrix * wp; gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, clamp(uSize * projectionMatrix[1][1] * uRes.y * 0.5 / max(-mv.z, 0.01), 1.0, 9.0) * uDpr * 0.5);
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; if (vA * a < 0.003) discard;
        gl_FragColor = vec4(uCol * a * max(vA, 0.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return pts;
}

// ---------- dimensions: a dimension line with extension lines and ticks in the secondary tint, riding with its part,
// and its figure set along the line in the page font
const DPA = new THREE.Vector3(), DPB = new THREE.Vector3();
export class Dims {
  constructor(root = document.getElementById('dims')) { this.root = root; this.items = []; this.groups = new Map(); this.panels = []; }
  // a build-up schedule on the sheet, with a leader to the place it describes
  panel(key, obj, at, html) {
    const el = document.createElement('div'); el.className = 'dimpanel'; el.innerHTML = html; this.root.appendChild(el);
    const svg = document.getElementById('leaders'), NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'dimlead');
    g.innerHTML = '<polyline class="halo"/><polyline/><circle r="3.2" class="halo"/><circle r="2.3"/>';
    svg.appendChild(g);
    this.panels.push({ key, obj, at, el, g, op: 0 });
  }
  mat(key) {
    if (!this.groups.has(key)) this.groups.set(key, lineMat({ w: 1.05, color: ACCENT2, opacity: 0, depthTest: false, live: false }));
    return this.groups.get(key);
  }
  // a, b: the measured points (local to obj); off: where the dimension line runs, as an offset from them
  add(key, obj, a, b, off, text, o = {}) {
    const A = a.clone().add(off), B = b.clone().add(off), dir = B.clone().sub(A).normalize(), on = off.clone().normalize();
    const over = on.clone().multiplyScalar(o.over ?? 0.12), gap = on.clone().multiplyScalar(o.gap ?? 0.06);
    const t = dir.clone().add(on).normalize().multiplyScalar(o.tick ?? 0.09);
    const L = [];
    if (o.ext !== false) for (const [p, q] of [[a, A], [b, B]]) { const s = p.clone().add(gap), e = q.clone().add(over); L.push([s.x, s.y, s.z, e.x, e.y, e.z]); }
    L.push([A.x, A.y, A.z, B.x, B.y, B.z]);
    for (const p of [A, B]) L.push([p.x - t.x, p.y - t.y, p.z - t.z, p.x + t.x, p.y + t.y, p.z + t.z]);
    const line = segs(obj, L, this.mat(key)); line.renderOrder = 6;
    return this._item(key, obj, A, B, text, o);
  }
  // a pitch: an arc from a horizontal leg to the slope, the angle written beside it
  angle(key, obj, c, u, v, r, text, o = {}) {
    const L = [], n = 14;
    const ang = u.angleTo(v), ax = u.clone().cross(v).normalize();
    for (let i = 0; i < n; i++) {
      const p = u.clone().applyAxisAngle(ax, ang * i / n).multiplyScalar(r).add(c), q = u.clone().applyAxisAngle(ax, ang * (i + 1) / n).multiplyScalar(r).add(c);
      L.push([p.x, p.y, p.z, q.x, q.y, q.z]);
    }
    const e = u.clone().multiplyScalar(r * 1.35).add(c); L.push([c.x, c.y, c.z, e.x, e.y, e.z]);
    const line = segs(obj, L, this.mat(key)); line.renderOrder = 6;
    const mid = u.clone().applyAxisAngle(ax, ang / 2).multiplyScalar(r * 1.45).add(c);
    return this._item(key, obj, mid, mid, text, { ...o, flat: true });
  }
  _item(key, obj, A, B, text, o) {
    const el = document.createElement('div'); el.className = 'dim' + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = `<b>${text}</b>${o.sub ? `<span>${o.sub}</span>` : ''}`;
    this.root.appendChild(el);
    const it = { key, obj, A, B, el, o, op: 0 }; this.items.push(it); return it;
  }
  setOp(key, v) {
    const m = this.groups.get(key); if (m) m.opacity = v;
    for (const it of this.items) if (it.key === key) it.op = v;
    for (const pn of this.panels) if (pn.key === key) pn.op = v;
  }
  update() {
    const W = ctx.W, H = ctx.H, pa = DPA, pb = DPB;
    for (const pn of this.panels) {
      const show = pn.op > 0.01 && !ctx.phone;
      dom.op(pn.el, show ? pn.op : 0); dom.op(pn.g, show ? pn.op : 0);
      if (!show) continue;
      pn.obj.updateWorldMatrix(true, false);
      pa.copy(pn.at).applyMatrix4(pn.obj.matrixWorld).project(camera);
      // the panel stands still on the page: its box is measured once per layout, not every frame
      if (pn.rev !== ctx.rev) { pn.rev = ctx.rev; pn.rect = pn.el.getBoundingClientRect(); }
      const ax = r1((pa.x * .5 + .5) * W), ay = r1((-pa.y * .5 + .5) * H), r = pn.rect;
      // up from the panel's top edge, then a short diagonal into the point
      const sx = r1(clamp(ax - 36, r.left + 24, r.right - 16)), sy = r1(r.top - 1), ey = r1(Math.min(sy - 10, ay + 36));
      const pts = `${sx},${sy} ${sx},${ey} ${ax},${ay}`;
      const [h, l, ch, c] = pn.g.children;
      dom.attr(h, 'points', pts); dom.attr(l, 'points', pts);
      for (const e of [ch, c]) { dom.attr(e, 'cx', ax); dom.attr(e, 'cy', ay); }
    }
    for (const it of this.items) {
      if (it.op < 0.01) { dom.op(it.el, 0); continue; }
      it.obj.updateWorldMatrix(true, false);
      pa.copy(it.A).applyMatrix4(it.obj.matrixWorld).project(camera); pb.copy(it.B).applyMatrix4(it.obj.matrixWorld).project(camera);
      if (pa.z > 1 || pb.z > 1) { dom.op(it.el, 0); continue; }
      const ax = (pa.x * .5 + .5) * W, ay = (-pa.y * .5 + .5) * H, bx2 = (pb.x * .5 + .5) * W, by = (-pb.y * .5 + .5) * H;
      let ang = it.o.flat ? 0 : Math.atan2(by - ay, bx2 - ax);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      const side = it.o.below ? '4px' : 'calc(-100% - 3px)';
      dom.sty(it.el, 'transform', `translate(${r1((ax + bx2) / 2)}px, ${r1((ay + by) / 2)}px) rotate(${ang.toFixed(4)}rad) translate(-50%, ${side})`);
      dom.op(it.el, it.op);
    }
  }
}
