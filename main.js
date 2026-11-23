import { THREE, renderer, scene, camera, ctx, camAt, applyCam, resize, Labels, clamp, lerp, ease, easeOut, win, DRAW, LIVE, ENV, FX, Dims, motes, dom, fxMesh, pace, holdPace, visible } from './core.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const Q = new URLSearchParams(location.search);
const DIR = (Q.get('dir') || 'a').toLowerCase();
const FIXED = Q.has('p') ? parseFloat(Q.get('p')) : null;
const DRIVE = Q.has('drive');                         // a recorder sets time and scroll for every frame
const T_FIXED = Q.has('t') ? parseFloat(Q.get('t')) : (FIXED != null ? 99 : null);
const CHAIN = Q.has('chain');                         // arrived from the sheet before
const LIVEONLY = FIXED != null || DRIVE;              // stills and recordings: no autoplay, no chaining
// the three sheets play one after another; after the last one the portfolio starts again with Nummer 1, the Kartonmodell
const SEQ = [{ dir: 'a', no: '01', name: 'Planblatt' }, { dir: 'b', no: '02', name: 'Abwicklung' }, { dir: 'c', no: '03', name: 'Geschossweise' }];
const SI = Math.max(0, SEQ.findIndex(s => s.dir === DIR));
const NEXT = SI < SEQ.length - 1 ? SEQ[SI + 1] : { href: '/threejs-demo-6/?autoplay=1', no: '01', name: 'three.js Demo 1', sub: 'Kartonmodell', kicker: 'three.js Portfolio · Weiter mit' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!LIVEONLY) scrollTo(0, 0);

await Promise.all([
  document.fonts.load('500 20px "IBM Plex Mono"'), document.fonts.load('600 20px "IBM Plex Mono"'),
  document.fonts.load('600 40px "Chakra Petch"'), document.fonts.load('700 20px "Chakra Petch"'),
]).catch(() => {});

resize();
const labels = new Labels();
const dims = new Dims();
const mod = await import(`./dir-${DIR}.js`);
const S = await mod.build(labels, dims);

// ---- page chrome from the direction. Headline lines sit in masks so they can slide up.
const $ = id => document.getElementById(id);
const C = S.chrome;
const DWG_CODES = { a: 'AXO.04', b: 'ELEV.02', c: 'SEC.500' };
if ($('dwgBadge')) $('dwgBadge').textContent = C.dwg || DWG_CODES[DIR] || 'AXO.04';
const dirLinks = [...document.querySelectorAll('#dirSwitch a')];
dirLinks.forEach(a => a.classList.toggle('active', a.dataset.dir === DIR));
const activeLink = dirLinks.find(a => a.dataset.dir === DIR);
$('brand').textContent = C.brand; $('brandSub').textContent = C.brandSub;
$('nav').textContent = C.nav; $('cta').textContent = C.cta;
$('kicker').textContent = C.kicker; $('lede').textContent = C.lede;
$('h1').innerHTML = C.h1.split('<br>').map(l => `<span class="ln"><span>${l}</span></span>`).join('');
$('spec').innerHTML = (C.spec || []).map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
$('hint').textContent = C.hint;
document.title = C.title || document.title;
// the scroll range is measured once per layout and against the canvas (the tallest the window gets on a phone),
// so the end of the sheet can always be reached and nothing is read from the layout inside a frame
let scrollMax = 1;
const measure = () => { resize(); scrollMax = Math.max(1, document.documentElement.scrollHeight - ctx.H); };
measure();
addEventListener('resize', measure, { passive: true });
new ResizeObserver(measure).observe(renderer.domElement);
document.addEventListener('visibilitychange', () => { ctx.dirty = true; });

// ---- the colour: where it comes from, where it goes, and the light it brings
const LV = S.live || { at: 2, in: { dir: [0, 0, 0], min: 0, max: 1, dur: 1 }, out: { dir: [0, 0, 0], min: 0, max: 1, dur: 1 } };
const V3 = (u, a) => u.value.set(...a);
LIVE.uInDir.value.set(...LV.in.dir, LV.in.radial ?? 0); V3(LIVE.uInC, LV.in.c ?? [0, 0, 0]);
LIVE.uOutDir.value.set(...LV.out.dir, LV.out.radial ?? 0); V3(LIVE.uOutC, LV.out.c ?? [0, 0, 0]);
LIVE.uLiveSoft.value = LV.soft ?? 2.5; LIVE.uInN.value = LV.in.noise ?? 2; LIVE.uOutN.value = LV.out.noise ?? 2;
const SUN0 = new THREE.Vector3(...(LV.sun || [-0.5, 0.55, 0.65])).normalize();
if (LV.room) LIVE.uRoom.value.set(...LV.room);
if (LV.roomY) LIVE.uRoomY.value.set(...LV.roomY);
if (LV.foot) { LIVE.uFoot.value.set(...LV.foot); LIVE.uFoot2.value.set(...(LV.foot2 || [3, 1.6])); }
ENV.uGroundY.value = LV.groundY ?? 0;
for (const [k, u] of [['zenith', ENV.uZenith], ['horizon', ENV.uHorizon], ['mid', ENV.uMid], ['sunCol', LIVE.uSunCol], ['skyCol', LIVE.uSkyCol], ['bounce', LIVE.uBounce], ['grass', LIVE.uGrass], ['grass2', LIVE.uGrass2]]) if (LV[k]) u.value.set(LV[k]);
if (LV.motes) motes(LV.motes);
const live = { state: 'off', a: 0, b: 0, fast: false };
function liveStep(dt, want) {
  if (want) {
    if (live.state === 'off') { live.state = 'in'; live.a = 0; live.b = 0; }
    live.b = Math.max(0, live.b - dt / 1.8);                       // brought back: the drain runs backwards
    live.a = Math.min(1, live.a + dt / LV.in.dur);
  } else if (live.state === 'in') {
    live.b = Math.min(1, live.b + dt / (LV.out.dur * (live.fast ? 0.28 : 1)));
    if (live.b >= 1) { live.state = 'off'; live.a = 0; live.b = 0; }
  }
  if (live.state === 'off') { LIVE.uInF.value = -1e5; LIVE.uOutF.value = -1e5; LIVE.uLive.value = 0; return; }
  const pad = (LV.soft ?? 2.5) + Math.max(LV.in.noise ?? 2, LV.out.noise ?? 2);
  LIVE.uInF.value = lerp(LV.in.min - pad, LV.in.max + pad, Math.pow(live.a, LV.in.pow ?? 1.7));
  LIVE.uOutF.value = lerp(LV.out.min - pad, LV.out.max + pad, Math.pow(live.b, LV.out.pow ?? 0.6));
  LIVE.uLive.value = clamp(live.a * 2.5) * (1 - clamp(live.b * 1.25));
}
const target = () => clamp(scrollY / scrollMax);

// ---- interactive CAD mini-radar (#cad-map)
const cadMap = $('cad-map'), cmLbl = $('cm-lbl'), cmScale = $('cm-scale');
const cmSvg = $('cm-svg'), cmZonesG = $('cm-zones'), cmPlan = $('cm-plan'), cmCone = $('cm-cone'), cmDot = $('cm-dot'), cmStops = $('cm-stops');
let hoverTag = '', cmStopEls = [];
if (S.radar && cadMap) {
  const R = S.radar;
  if (R.scale && cmScale) cmScale.textContent = R.scale;
  if (R.viewBox && cmSvg) cmSvg.setAttribute('viewBox', R.viewBox);
  if (R.plan && cmPlan) {
    cmPlan.setAttribute('d', R.plan);
    if (R.strokeW) cmPlan.setAttribute('stroke-width', String(R.strokeW));
  }
  if (R.dotR && cmDot) cmDot.setAttribute('r', String(R.dotR));
  if (R.coneW && cmCone) cmCone.setAttribute('stroke-width', String(R.coneW));
  if (R.zones && cmZonesG) {
    cmZonesG.innerHTML = R.zones.map(z =>
      `<rect class="cm-zone" data-stop="${z.stop}"${z.floor ? ` data-floor="${z.floor}"` : ''} data-p="${z.p}" data-tag="${z.tag}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"/>`
    ).join('');
  }
  if (R.stops && cmStops) {
    cmStops.style.gridTemplateColumns = `repeat(${R.stops.length}, minmax(0, 1fr))`;
    cadMap.classList.toggle('many', R.stops.length > 6);
    cmStops.innerHTML = R.stops.map(s =>
      `<button type="button" class="cm-btn" data-stop="${s.stop}" data-p="${s.p}" data-tag="${s.tag}">${s.label}</button>`
    ).join('');
  }
}
function jumpToP(targetP, smooth = true) {
  window.scrollTo({ top: clamp(targetP, 0, 1) * scrollMax, behavior: smooth ? 'smooth' : 'auto' });
}
window.__jumpTo = (stopOrP, smooth = true) => {
  if (typeof stopOrP === 'number') { jumpToP(stopOrP, smooth); return stopOrP; }
  const btn = document.querySelector(`#cad-map [data-stop="${stopOrP}"]`);
  if (btn) { const tp = parseFloat(btn.dataset.p); jumpToP(tp, smooth); return tp; }
  return null;
};
if (cadMap) {
  cmStopEls = [...cadMap.querySelectorAll('[data-stop]')];
  cadMap.querySelectorAll('[data-p]').forEach(el => {
    el.addEventListener('mouseenter', () => { hoverTag = el.dataset.tag || ''; ctx.dirty = true; });
    el.addEventListener('mouseleave', () => { hoverTag = ''; ctx.dirty = true; });
    el.addEventListener('click', e => { e.stopPropagation(); setPlaying(false); jumpToP(parseFloat(el.dataset.p)); });
  });
}

// ---- autoplay: the sheet plays itself at an even pace and lingers at every station. Any scroll of your own
// takes over; the button (or P) hands it back.
const playBtn = $('play');
let playing = !LIVEONLY && (Q.has('play') ? Q.get('play') !== '0' : !REDUCED);
let playP = 0;
const INTRO_END = S.introEnd ?? 4.0;
const PACE = [...(S.radar?.stops || []).map(s => s.p), LV.at].filter(v => v > 0.04 && v < 0.985);
const pacing = pp => PACE.reduce((k, s) => Math.min(k, 1 - 0.66 * Math.exp(-Math.pow((pp - s) / 0.016, 2))), 1);
function setPlaying(v) {
  playing = v && !LIVEONLY; ctx.dirty = true;
  if (playing) playP = target();
  if (playBtn) {
    playBtn.classList.toggle('on', playing);
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.querySelector('span').textContent = playing ? 'Pause' : 'Abspielen';
  }
}
setPlaying(playing);
playBtn?.addEventListener('click', e => { e.stopPropagation(); if (outT < 0) setPlaying(!playing); });
const takeOver = e => { if (playing && !(e.target instanceof Element && e.target.closest('#play'))) setPlaying(false); };
addEventListener('wheel', takeOver, { passive: true });
addEventListener('touchstart', takeOver, { passive: true });
addEventListener('pointerdown', takeOver);
addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') { if (outT < 0) setPlaying(!playing); return; }
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) setPlaying(false);
});

// ---- the hand-over to the next sheet: hold, let the colour drain, un-plot, cover, and go
const X = S.xfer || {};
const MODES = { wipe: 1, iris: 2, blinds: 3, dissolve: 4 };
const OUT_DUR = 1.7;
let endT = -1, outT = -1, goTo = NEXT, gone = false, forceGo = false;
const holdT = () => forceGo ? 0 : (playing ? 0.5 : 0.4);
const DRAIN_AT = () => holdT() + (forceGo ? 0 : (LV.out.delay ?? 0));     // a sheet can keep its colour a little into the swirl
// the way back out: from the last room the camera swirls round and out to the front of the building while the
// colour drains away, then the hand-over runs from there
const SW = S.swirl, SW_DUR = SW?.dur ?? 4.2;
const swirlU = () => (!forceGo && SW && endT >= 0) ? clamp((endT - holdT()) / SW_DUR) : 0;
function swirl(cs, u) {
  if (!cs.pos) return;
  const e = u * u * (3 - 2 * u), C = SW.c;
  const sx = cs.pos[0] - C[0], sz = cs.pos[2] - C[2], ex = SW.pos[0] - C[0], ez = SW.pos[2] - C[2];
  const a0 = Math.atan2(sz, sx), a1 = Math.atan2(ez, ex);
  let d = ((a1 - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  if (Math.abs(d) < 0.6) d -= Math.sign(d || 1) * Math.PI * 2;        // nearly in line: go once round instead
  const r = lerp(Math.hypot(sx, sz), Math.hypot(ex, ez), 1 - Math.pow(1 - u, 2.2));   // out of the rooms early
  const a = a0 + d * e, y = lerp(cs.pos[1], SW.pos[1], e) + Math.sin(Math.PI * u) * (SW.lift ?? 2.5);
  const pos = [C[0] + Math.cos(a) * r, y, C[2] + Math.sin(a) * r];
  const k = ease(clamp(u * 1.4)), mid = Math.sin(Math.PI * u) * 0.6;          // mid-swirl, keep the building in view
  const look = [0, 1, 2].map(i => lerp(lerp(cs.t[i], SW.look[i], k), C[i], mid));
  cs.fov = Math.exp(lerp(Math.log(cs.fov), Math.log(SW.fov), e));
  cs.pos = pos; cs.t = look;
  cs.h = 2 * Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) * Math.tan(cs.fov * Math.PI / 360);
  cs.sx = lerp(cs.sx || 0, 0, e); cs.sy = lerp(cs.sy || 0, SW.sy ?? -0.04, e);
}
const xfer = $('xfer'), xferK = xfer.querySelector('.xk'), XK0 = xferK?.textContent;
function setXfer(s) { xfer.classList.toggle('desk', !!s.href); $('xferNo').textContent = s.no; $('xferName').textContent = s.name; if (xferK) xferK.textContent = s.kicker || XK0; }
// the sheet tabs take the same way out, only quicker
dirLinks.forEach(a => a.addEventListener('click', e => {
  if (LIVEONLY) return;
  e.preventDefault();
  if (outT >= 0 || a.dataset.dir === DIR) return;
  goTo = SEQ.find(s => s.dir === a.dataset.dir) || NEXT;
  live.fast = true; forceGo = true; endT = 0;
}));
function go() {
  if (gone) return; gone = true;
  // the next sheet or demo always starts playing by itself; a tab you clicked keeps your choice
  location.href = goTo.href || `?dir=${goTo.dir}&chain=1&play=${!forceGo || playing ? 1 : 0}`;
}
const uiEls = ['ui', 'labels', 'leaders', 'dims', 'cad-frame'].map($).filter(Boolean);

// ---- the plotter loader: black lifts, the sheet is plotted, then the page arrives
const D = S.draw;
DRAW.uDrawDir.value.set(D.dir[0], D.dir[1], D.dir[2], D.radial || 0);
DRAW.uDrawC.value.set(...(D.c || [0, 0, 0]));
DRAW.uDrawSoft.value = D.soft || 1.2;
const lines = [...document.querySelectorAll('#h1 .ln > span')];
const EL = Object.fromEntries(['fade', 'loader', 'ltext', 'lbar', 'cad-frame', 'kicker', 'lede', 'spec', 'hero', 'counter', 'legend', 'hint', 'camReadout', 'caption'].map(id => [id, $(id)]));
EL.top = document.querySelector('.top'); EL.bottom = document.querySelector('.bottom'); EL.hintWrap = document.querySelector('.hint-wrap');
// when the last piece of the page has arrived (the labels come in one after another), the intro has nothing left to write
const INTRO_DONE = 3.45 + labels.items.reduce((m, it, i) => Math.max(m, it.order ?? i), 0) * 0.11 + 0.6;
const labOn = () => 1;
let introOver = false;
function intro(T) {
  if (introOver) return labOn;
  const sm = x => x * x * (3 - 2 * x);
  const plot = sm(win(T, 0.35, 3.0)), fill = sm(win(T, 0.8, 3.35));
  const span = D.max - D.min + 2;
  DRAW.uDraw.value = T > 3.6 ? 1e5 : D.min - 1 + plot * (span + DRAW.uDrawSoft.value);
  DRAW.uDrawFill.value = T > 3.6 ? 1e5 : D.min - 1 + fill * span;
  dom.op(EL.fade, 1 - win(T, 0, 0.7));
  const lo = 1 - win(T, 3.15, 3.55);
  dom.op(EL.loader, lo * win(T, 0.2, 0.5));
  dom.text(EL.ltext, `${C.loader} · ${String(Math.round(plot * 100)).padStart(3, '0')}%`);
  dom.sty(EL.lbar, 'transform', `scaleX(${plot.toFixed(3)})`);
  const o = (a, d = 0.5) => win(T, a, a + d);
  if (EL['cad-frame']) dom.op(EL['cad-frame'], o(1.8, 0.7));
  dom.op(EL.top, o(2.2, 0.6));
  dom.op(EL.kicker, o(2.5));
  lines.forEach((l, i) => {
    const u = easeOut(win(T, 2.65 + i * 0.12, 3.45 + i * 0.12));
    dom.sty(l, 'transform', `translateY(${((1 - u) * 125).toFixed(2)}%)`);
    dom.sty(l, 'opacity', u > 0.005 ? '1' : '0');
  });
  dom.op(EL.lede, o(3.25)); dom.sty(EL.lede, 'transform', `translateY(${((1 - easeOut(o(3.25, 0.7))) * 14).toFixed(2)}px)`);
  dom.op(EL.spec, o(3.45));
  if (cadMap) {
    const cmOp = o(3.55, 0.55);
    dom.op(cadMap, cmOp);
    dom.cls(cadMap, 'interactive', cmOp > 0.25);
  }
  dom.op(EL.bottom, o(3.7));
  // arriving from the sheet before: its title card lifts and this sheet's own way in opens the picture
  if (CHAIN && X.in) {
    FX.uMode.value = MODES[X.in.mode] || 1; FX.uT.value = 1 - easeOut(win(T, 0.25, 1.65));
    if (X.in.dir) FX.uDir.value.set(...X.in.dir); if (X.in.c) FX.uC.value.set(...X.in.c);
    dom.op(xfer, 1 - win(T, 0.15, 0.75));
  }
  if (T > INTRO_DONE) introOver = true;
  return (i) => o(3.0 + i * 0.11, 0.35);
}

let p = FIXED ?? 0, T = T_FIXED ?? 0, frames = 0, lastNow = performance.now(), dt = 0;
const t0 = performance.now();
let wantLive = false, swStill = null, shadowKey = null;
const SHADOWS = () => renderer.shadowMap.enabled;
function step() {
  // the colour comes in once the sheet reaches its moment and stays until the hand-over drains it
  const draining = endT >= 0 && endT >= DRAIN_AT();
  if (!wantLive && p >= LV.at && !draining) wantLive = true;
  if (wantLive && (p < LV.at - 0.03 || draining)) wantLive = false;
  if (FIXED != null && T_FIXED != null) {
    // stills: full colour past the moment, or a frozen point of the bloom (live=0..1) or of the drain (drain=0..1)
    const la = Q.has('live') ? parseFloat(Q.get('live')) : (p >= LV.at ? 1 : 0), lb = Q.has('drain') ? parseFloat(Q.get('drain')) : 0;
    live.state = la > 0 ? 'in' : 'off'; live.a = la; live.b = lb; liveStep(0, la > 0 && lb === 0);
    if (lb > 0) { live.state = 'in'; live.a = la; live.b = lb; liveStep(0, true); live.b = lb; liveStep(0, false); }
  }
  else liveStep(dt, wantLive);
  LIVE.uTime.value = T;
  const sw = Math.sin(T * 0.045) * 0.12;                                       // the sun wanders a little
  LIVE.uSunDir.value.set(SUN0.x * Math.cos(sw) - SUN0.z * Math.sin(sw), SUN0.y, SUN0.x * Math.sin(sw) + SUN0.z * Math.cos(sw));
  S.liveHook?.(LIVE.uLive.value, T);

  const swU = swStill != null ? swStill : LIVEONLY && Q.has('swirl') && SW ? parseFloat(Q.get('swirl')) : swirlU();   // stills can freeze the swirl
  const st = S.update(p, T, swU) || {};
  const lab = intro(T);
  S.introHook?.(T);
  if (lab !== labOn) labels.items.forEach((it, i) => { it.op *= lab(it.order ?? i); });
  const camState = camAt(S.keys, p);
  const inU = 1 - easeOut(win(T, 0.05, 3.7)), outU = outT >= 0 ? ease(win(outT, 0, OUT_DUR)) : 0;
  if (swU > 0) swirl(camState, swU);
  if (!LIVEONLY && (inU > 0 || outU > 0)) S.camFx?.(camState, inU, outU);
  window.__inspect?.(camState);                                                // a look closer, for checking details
  applyCam(camState, S.R);
  // fog is measured from the camera, which stands a kilometre off for the axo: keep it behind the model
  if (scene.fog) { const D = camera.userData.D; scene.fog.near = D + (S.fog?.[0] ?? 60); scene.fog.far = D + (S.fog?.[1] ?? 340); }
  labels.update(S.colX || (() => ctx.W * 0.7));
  dims.update();
  const ho = st.hero ?? 1;
  dom.op(EL.hero, ho); dom.sty(EL.hero, 'transform', `translateY(${((1 - ho) * -20).toFixed(1)}px)`);
  dom.html(EL.counter, st.counter || '');
  dom.html(EL.legend, st.legend || ''); dom.op(EL.legend, st.legendOp ?? 0);
  let hint = st.hint ?? C.hint;
  if (endT >= 0 && outT < 0) hint = goTo.href ? `Weiter: ${goTo.name} · ${goTo.sub}` : `Weiter: ${goTo.no} · ${goTo.name}`;
  else if (playing && T > INTRO_END && hint) hint = 'Läuft von selbst · Scrollen übernimmt';
  dom.text(EL.hint, hint);
  if (EL.hintWrap) dom.sty(EL.hintWrap, 'opacity', hint ? '1' : '0');
  if (activeLink) { const pr = p.toFixed(3); if (activeLink._pr !== pr) { activeLink._pr = pr; activeLink.style.setProperty('--prog', pr); } }
  const cr = EL.camReadout;
  if (cr && !ctx.phone) {
    const fov = camState.fov;
    const mode = fov < 6 ? 'PARALLEL-AXO' : fov < 28 ? 'ÜBERGANG' : 'PERSP. AUGENHÖHE';
    const pct = String(Math.round(p * 100)).padStart(3, '0');
    dom.html(cr, `PROJ <b>${mode}</b> (${fov.toFixed(1)}°) &nbsp;//&nbsp; SEQ <b>${pct}%</b>`);
  }
  if (cadMap) {
    const R = S.radar || {};
    const clampX = R.clampX || [-7.8, 7.8], clampZ = R.clampZ || [-3.8, 3.8];
    const isPersp = camState.fov >= 18;
    const cx = isPersp ? clamp(camera.position.x, clampX[0], clampX[1]) : (R.axoDot?.[0] ?? 6.5);
    const cz = isPersp ? clamp(camera.position.z, clampZ[0], clampZ[1]) : (R.axoDot?.[1] ?? 2.6);
    if (cmDot) { dom.attr(cmDot, 'cx', cx.toFixed(2)); dom.attr(cmDot, 'cy', cz.toFixed(2)); }
    if (cmCone) {
      const tx = camState.t[0], tz = camState.t[2];
      const ang = isPersp ? Math.atan2(tz - camera.position.z, tx - camera.position.x) : (R.axoAng ?? -2.35);
      const rad = R.coneLen ?? 3.2, sp = 0.42;
      const x1 = cx + Math.cos(ang - sp) * rad, z1 = cz + Math.sin(ang - sp) * rad;
      const x2 = cx + Math.cos(ang + sp) * rad, z2 = cz + Math.sin(ang + sp) * rad;
      dom.attr(cmCone, 'points', `${cx.toFixed(2)},${cz.toFixed(2)} ${x1.toFixed(2)},${z1.toFixed(2)} ${x2.toFixed(2)},${z2.toFixed(2)}`);
    }
    if (cmLbl) {
      dom.text(cmLbl, hoverTag
        ? `SPRUNG // ${hoverTag}`
        : st.radarLbl || (isPersp
          ? `POS X:${camera.position.x.toFixed(1)} Y:${camera.position.y.toFixed(1)}M`
          : `AXO // ${String(Math.round(p * 100)).padStart(3, '0')}%`));
    }
    const activeStop = st.stop || '';
    for (const el of cmStopEls) dom.cls(el, 'active', el.dataset.stop === activeStop);
  }
  const cap = EL.caption; dom.op(cap, (st.capOp || 0) * (1 - clamp(swU * 3))); if (st.cap && cap.dataset.k !== st.cap) { cap.dataset.k = st.cap; cap.innerHTML = st.cap; }

  // the way out: the page chrome steps back, the drawing un-plots itself, this sheet's cover closes, the
  // title of the next sheet comes up, and the next sheet loads under it
  if (outT >= 0) {
    const ui = 1 - win(outT, 0, 0.4);
    for (const el of uiEls) dom.op(el, ui);
    const span = D.max - D.min + 2;
    DRAW.uDrawFill.value = D.min - 1 + (1 - ease(win(outT, 0.05, 0.75))) * (span + 1);
    DRAW.uDraw.value = D.min - 1 + (1 - ease(win(outT, 0.25, 1.1))) * (span + DRAW.uDrawSoft.value + 1);
    FX.uMode.value = MODES[X.out?.mode] || 4; FX.uT.value = ease(win(outT, 0.6, 1.35));
    if (X.out?.dir) FX.uDir.value.set(...X.out.dir);
    if (X.out?.c) FX.uC.value.set(...X.out.c);
    setXfer(goTo); dom.op(xfer, win(outT, 1.25, 1.6));
  }
  FX.uAspect.value = ctx.W / ctx.H; FX.uFxTime.value = T;
  fxMesh.visible = FX.uT.value > 0.0001;                       // the cover is only drawn while it covers something
  // shadows are redrawn only when something that casts one has moved (the sheet tells us through shadowKey)
  if (SHADOWS()) {
    const k = S.shadowKey ? S.shadowKey(p, swU, T) : `${p.toFixed(4)}|${swU.toFixed(3)}`;
    if (k !== shadowKey || frames < 4) { shadowKey = k; renderer.shadowMap.needsUpdate = true; }
  }
  renderer.render(scene, camera);
  lastDrawn = performance.now(); pDrawn = p;
}

// ---- the loop. A frame is only drawn when something on the sheet changed: the scroll, the intro, the colour
// coming or going, the hand-over. A sheet at rest in colour (clouds, leaves, dust) is drawn at half the rate,
// a sheet at rest as a drawing only as often as its fire flickers, or not at all. A hidden page draws nothing.
let lastDrawn = 0, pDrawn = -1;
const AMBIENT_MS = 1000 / 31, REST_MS = S.restFps ? 1000 / S.restFps : Infinity;
function frame(now = performance.now(), loop = true) {
  if (loop) requestAnimationFrame(frame);
  dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
  if (T_FIXED == null) T = (now - t0) / 1000;
  if (loop && !visible()) { pace(now, false); return; }
  if (!LIVEONLY) {
    if (playing && T > INTRO_END && endT < 0) {
      playP = Math.min(1, playP + dt / (S.play?.dur ?? 70) * pacing(playP));
      jumpToP(playP, false);
    }
    // the end of the sheet: hold a moment, drain the colour, then hand over
    const atEnd = p > 0.99 && target() > 0.985;
    if (endT < 0 && atEnd && T > INTRO_END) { endT = 0; goTo = NEXT; }
    if (endT >= 0 && outT < 0) {
      const hold = holdT();
      if (!forceGo && endT < hold && target() < 0.965) endT = -1;     // scrolled back before the swirl began
      else {
        endT += dt;
        const sw = forceGo || !SW ? 0 : SW_DUR;
        const drainEnd = DRAIN_AT() + LV.out.dur * (live.fast ? 0.28 : 1);
        if (endT > hold + sw && (live.state === 'off' || endT > Math.max(hold + sw, drainEnd) + 0.6)) outT = 0;
      }
    }
    if (outT >= 0) { outT += dt; if (outT > OUT_DUR + 0.1) go(); }
  }
  if (FIXED == null) {
    const tg = target();
    // the same easing whatever the frame rate (0.12 of the way per 60 Hz frame)
    p += (tg - p) * (loop ? 1 - Math.pow(0.88, dt * 60) : 0.12);
    if (Math.abs(tg - p) < 2e-5) p = tg;
  }
  let draw = true, full = true;
  if (loop) {
    const wl = wantLive ? p >= LV.at - 0.03 : p >= LV.at;         // what step() will decide about the colour
    const busy = frames < 4 || ctx.dirty || !introOver || T < INTRO_END + 0.3 || p !== pDrawn || endT >= 0 || outT >= 0
      || wl !== wantLive || (wantLive && live.state === 'off') || (live.state === 'in' && (live.a < 1 || live.b > 0 || !wantLive));
    if (!busy) {
      full = false;
      const every = LIVE.uLive.value > 0.001 ? AMBIENT_MS : REST_MS;
      draw = now - lastDrawn >= every - 2;
    }
  }
  pace(now, draw && full);
  if (!draw) return;
  ctx.dirty = false;
  step();
  if (++frames === 3) window.__ready = true;
}
// for checking the timeline without watching it: run the page clock forward by some seconds
window.__advance = (sec, fps = 30) => {
  for (let i = 0; i < sec * fps; i++) frame(lastNow + 1000 / fps, false);
  return { T: +T.toFixed(2), p: +p.toFixed(3), endT: +endT.toFixed(2), outT: +outT.toFixed(2), swirl: +swirlU().toFixed(2), live: live.state, a: +live.a.toFixed(2), b: +live.b.toFixed(2), gone, playing };
};
window.__S = S;
window.__live = live;
window.__frame = (t, pp, o) => { T = t; p = pp; swStill = o?.swirl ?? null; step(); return true; };
holdPace(2500);
if (DRIVE) { step(); window.__ready = true; } else requestAnimationFrame(frame);
