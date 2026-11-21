// quality.js: device tier, resolution governor, visibility. No dependencies.
//
// low  = phones and weak machines (a Galaxy A51 lives here): smaller buffer, lighter lines, smaller textures and shadows
// mid  = tablets, recent flagship phones, small laptops
// high = desktop class: everything as drawn
//
// URL: ?q=low|mid|high forces the tier, ?dpr=1.5 pins the resolution and switches the governor off.

const P = new URLSearchParams(location.search);

const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
const mem = navigator.deviceMemory || 8;
const cores = navigator.hardwareConcurrency || 8;

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return s;
  } catch (e) { return ''; }
}

export const tier = (() => {
  const f = P.get('q');
  if (f === 'low' || f === 'mid' || f === 'high') return f;
  if (touch) {
    const g = gpuName();
    const strong = /Apple (A1[5-9]|M\d)|Adreno \(TM\) (7[3-9]\d|8\d\d)|Mali-G(71[05]|72\d|9\d\d)|Immortalis|Xclipse/i.test(g);
    if (shortSide > 600) return strong || mem >= 6 ? 'mid' : 'low';   // tablet
    return strong && mem >= 8 ? 'mid' : 'low';                         // phone
  }
  if (mem <= 4 && cores <= 4) return 'mid';
  return 'high';
})();
export const low = tier === 'low', mid = tier === 'mid', high = tier === 'high';
export const isTouch = touch;

// Resolution. Phones and tablets get a pixel budget instead of a fixed DPR cap, so a 412x915 phone ends up near
// DPR 1.4 instead of 2. Desktop renders at min(devicePixelRatio, 2) as before and may step down to 1.
const BUDGET = { low: [0.45e6, 0.75e6, 1.3e6], mid: [0.7e6, 1.6e6, 2.6e6], high: null }[tier];   // [floor, start, ceiling] in pixels
let area = Math.max(1, innerWidth * innerHeight);
export const setArea = (w, h) => { area = Math.max(1, w * h); };   // the canvas in CSS pixels
const dprFor = (px) => Math.sqrt(px / area);
const native = () => Math.min(window.devicePixelRatio || 1, 2);
export const pinnedDpr = P.has('dpr') ? Math.max(0.5, +P.get('dpr') || 1) : null;
export const startDpr = () => pinnedDpr ?? (BUDGET ? Math.min(native(), Math.max(0.6, dprFor(BUDGET[1]))) : native());

// governor({ apply }) -> { frame(now, active), dpr, hold(ms), refit() }
// Call frame() once per animation frame; active = this frame is rendered at full cadence.
// Steps the resolution down when frames are slow and carefully back up when there is headroom.
export function governor({ apply, step = 0.125 }) {
  let dpr = startDpr();
  let ema = 16.7, n = 0, last = 0, wasActive = false, changed = 0, heldUntil = 0, cap = Infinity, capSet = 0;
  const lo = () => Math.min(dpr, BUDGET ? Math.max(0.6, dprFor(BUDGET[0])) : Math.min(1, native()));
  const hi = () => Math.min(native(), BUDGET ? dprFor(BUDGET[2]) : Infinity, cap);
  apply(dpr);
  const set = (v, now) => { v = Math.round(v / step) * step; if (Math.abs(v - dpr) < 1e-3) return; dpr = v; changed = now; n = 0; ema = 16.7; apply(dpr); };
  return {
    get dpr() { return dpr; },
    hold(ms = 1500) { heldUntil = performance.now() + ms; },          // call around loading, phase swaps, resizes
    refit() { if (pinnedDpr == null) { dpr = Math.min(Math.max(dpr, lo()), hi()); apply(dpr); } }, // after a real resize
    frame(now, active) {
      const dt = now - last; last = now;
      const counted = active && wasActive && dt > 0 && dt < 250 && now > heldUntil;
      wasActive = active;
      if (pinnedDpr != null || !counted) return;
      ema += (dt - ema) * 0.08; n++;
      if (n < 40 || now - changed < 1200) return;
      if (cap !== Infinity && now - capSet > 20000) { cap += step; capSet = now; }   // let the ceiling recover slowly
      if (ema > 23.5 && dpr > lo() + 1e-3) { cap = Math.max(lo(), dpr - step); capSet = now; set(Math.max(lo(), dpr - (ema > 40 ? 2 * step : step)), now); }
      else if (ema < 17.6 && dpr < hi() - 1e-3 && now - changed > 6000) set(Math.min(hi(), dpr + step), now);
    },
  };
}

// Page / iframe visibility.
export const visible = () => document.visibilityState !== 'hidden';
