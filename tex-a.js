// Surfaces for the house in colour, painted once on canvas: warm oak boards like a well-oiled floor, the same oak
// as a single board for cladding and joinery, white painted brick and a cream rug with a black lattice.
// Every texture tiles in both directions and covers a square of `tile` metres (core.js toneMat o.realMap / o.mapM).
import { THREE, rng, clamp, TEXK, ANISO } from './core.js';

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// every painter below works in its own px; on the phone tier the canvas behind it is half that size each way
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.round(w * TEXK); c.height = Math.round(h * TEXK); const g = c.getContext('2d'); g.scale(TEXK, TEXK); return [c, g]; };
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// fine grain noise over the whole sheet, so nothing reads as flat paint up close
function grain(g, amt, seed) {
  const w = g.canvas.width, h = g.canvas.height;
  const r = rng(seed), d = g.getImageData(0, 0, w, h), px = d.data;
  for (let i = 0; i < px.length; i += 4) { const n = (r() - 0.5) * amt; px[i] += n; px[i + 1] += n * 0.92; px[i + 2] += n * 0.8; }
  g.putImageData(d, 0, 0);
}

// one oak board: base tone, long wavy grain lines, now and then a cathedral figure or a small knot. Drawn in the
// board's own frame (u along the grain, v across), so a board that wraps round the tile edge draws the same twice.
function board(g, x, y, L, H, seed, base, horizontal) {
  const r = rng(seed);
  g.save();
  if (horizontal) { g.translate(x, y); } else { g.translate(x + H, y); g.rotate(Math.PI / 2); }
  g.beginPath(); g.rect(0, 0, L, H); g.clip();
  const t = r(), warm = r();
  const c0 = mix(mix(base, [base[0] * 0.9, base[1] * 0.87, base[2] * 0.84], t * 0.55), [base[0] * 1.04, base[1] * 1.01, base[2] * 0.94], warm * 0.35);
  const gr = g.createLinearGradient(0, 0, L, 0);
  gr.addColorStop(0, rgb(mix(c0, [c0[0] * 0.95, c0[1] * 0.94, c0[2] * 0.92], r())));
  gr.addColorStop(0.5, rgb(c0));
  gr.addColorStop(1, rgb(mix(c0, [c0[0] * 1.04, c0[1] * 1.03, c0[2] * 1.0], r())));
  g.fillStyle = gr; g.fillRect(0, 0, L, H);
  // soft bands across the width: heartwood and sapwood
  for (let k = 0; k < 4; k++) {
    const v = r() * H, bw = H * (0.15 + r() * 0.35);
    const b = g.createLinearGradient(0, v - bw, 0, v + bw);
    const dark = r() < 0.6;
    b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(0.5, dark ? 'rgba(96,58,26,0.10)' : 'rgba(255,232,190,0.10)'); b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b; g.fillRect(0, v - bw, L, bw * 2);
  }
  // grain lines
  const n = Math.round(H / 2.6);
  for (let k = 0; k < n; k++) {
    const v0 = r() * H, amp = 0.6 + r() * 2.2, f = 0.002 + r() * 0.006, ph = r() * 6.3;
    const dark = r() < 0.72;
    g.strokeStyle = dark ? `rgba(84,50,22,${0.05 + r() * 0.13})` : `rgba(255,236,200,${0.05 + r() * 0.1})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    for (let u = -4; u <= L + 8; u += 8) { const v = v0 + Math.sin(u * f + ph) * amp + Math.sin(u * f * 3.1 + ph * 2) * amp * 0.3; u < 0 ? g.moveTo(u, v) : g.lineTo(u, v); }
    g.stroke();
  }
  // cathedral figure: nested arches pointing along the board
  if (r() < 0.55) {
    const cu = L * (0.2 + r() * 0.6), cv = H * (0.3 + r() * 0.4), len = L * (0.18 + r() * 0.25);
    for (let k = 1; k < 7; k++) {
      const w = H * 0.07 * k, l = len * (0.45 + k * 0.12);
      g.strokeStyle = `rgba(92,56,24,${0.16 - k * 0.016})`; g.lineWidth = 1.2 + r();
      g.beginPath(); g.moveTo(cu - l, cv - w);
      g.bezierCurveTo(cu - l * 0.2, cv - w, cu + l * 0.35, cv - w * 0.35, cu + l * 0.45, cv);
      g.bezierCurveTo(cu + l * 0.35, cv + w * 0.35, cu - l * 0.2, cv + w, cu - l, cv + w);
      g.stroke();
    }
  }
  // a small knot, rarely
  if (r() < 0.22) {
    const ku = L * (0.1 + r() * 0.8), kv = H * (0.25 + r() * 0.5), kr = H * (0.04 + r() * 0.05);
    for (let k = 4; k >= 1; k--) {
      g.fillStyle = `rgba(${78 + k * 12},${46 + k * 9},${22 + k * 5},${0.1 + (4 - k) * 0.1})`;
      g.beginPath(); g.ellipse(ku, kv, kr * k * 0.9, kr * k * 0.45, 0, 0, 7); g.fill();
    }
  }
  g.restore();
}

// boards laid in rows, staggered ends; tile metres square, rows of `w` metres. horizontal: rows run along u.
export function oakPlanks({ px = 2048, tile = 2.28, w = 0.19, seed = 5, base = [184, 142, 102], seams = 0.5 } = {}) {
  const [c, g] = canvas(px), S = px / tile, H = w * S, rows = Math.round(tile / w), r = rng(seed);
  g.fillStyle = rgb(base); g.fillRect(0, 0, px, px);
  const ends = [];
  for (let row = 0; row < rows; row++) {
    const y = row * H;
    let x = r() * px, used = 0;
    while (used < px - 2) {
      const L = Math.min(px - used, (0.9 + r() * 1.2) * S), s = Math.floor(r() * 1e9);
      board(g, x % px, y, L, H, s, base, true);
      if (x % px + L > px) board(g, x % px - px, y, L, H, s, base, true);
      ends.push([(x + L) % px, y]);
      x += L; used += L;
    }
  }
  grain(g, 9, seed + 1);
  // seams: a dark hairline with a lit lip below it, and the board ends
  for (let row = 0; row < rows; row++) {
    const y = Math.round(row * H);
    g.fillStyle = `rgba(58,36,18,${seams})`; g.fillRect(0, y - 1, px, 2);
    g.fillStyle = 'rgba(255,240,215,0.12)'; g.fillRect(0, y + 1, px, 1);
  }
  for (const [x, y] of ends) {
    g.fillStyle = `rgba(58,36,18,${seams * 0.9})`; g.fillRect(Math.round(x) - 1, y, 2, H);
    if (x < 2) g.fillRect(px - 1, y, 1, H);
  }
  return tex(c);
}

// one continuous board face, grain running up the texture (v), broad tone bands so neighbouring boards differ
export function oakBoard({ px = 1024, tile = 1.2, seed = 9, base = [190, 148, 106] } = {}) {
  const [c, g] = canvas(px), r = rng(seed);
  g.fillStyle = rgb(base); g.fillRect(0, 0, px, px);
  // vertical strips of slightly different wood, so cut boards don't all match; each strip wraps top to bottom
  const strips = 7, sw = px / strips;
  for (let k = 0; k < strips; k++) {
    const s = Math.floor(r() * 1e9);
    board(g, k * sw, -px * 0.5, px * 2, sw, s, base, false);
  }
  // blend the strip edges so no seam shows within one board
  for (let k = 0; k <= strips; k++) {
    const x = k * sw, b = g.createLinearGradient(x - 10, 0, x + 10, 0);
    b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(0.5, rgb(base, 0.35)); b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b; g.fillRect(x - 10, 0, 20, px);
  }
  // make it tile top to bottom: near the edges, fade to a copy shifted by half a tile (continuous across the wrap)
  const [c2, g2] = canvas(px);
  g2.drawImage(c, 0, -px / 2, px, px); g2.drawImage(c, 0, px / 2, px, px);
  const m = g2.createLinearGradient(0, 0, 0, px);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.18, 'rgba(0,0,0,0)'); m.addColorStop(0.82, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  g2.globalCompositeOperation = 'destination-in'; g2.fillStyle = m; g2.fillRect(0, 0, px, px);
  g.drawImage(c2, 0, 0, px, px);
  grain(g, 8, seed + 3);
  return tex(c);
}

// white painted brick in running bond: 16 courses and 5 bricks to the 1.2 m tile
export function whiteBrick({ px = 1024, tile = 1.2, seed = 13 } = {}) {
  const [c, g] = canvas(px), r = rng(seed), S = px / tile;
  const ch = 0.075 * S, bw = 0.24 * S, j = 0.011 * S;
  g.fillStyle = '#cfc9bf'; g.fillRect(0, 0, px, px);               // the joints, a little in shadow
  const rows = Math.round(px / ch);
  for (let row = 0; row < rows; row++) {
    const y = row * ch, off = (row % 2) * bw / 2;
    for (let k = -1; k <= 5; k++) {
      const x = k * bw + off, t = r();
      const col = mix([238, 235, 229], [247, 245, 240], t);
      const draw = (xx) => {
        g.fillStyle = rgb(col); g.fillRect(xx + j / 2, y + j / 2, bw - j, ch - j);
        // the paint pools a little at the bottom edge, and the top catches the light
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(xx + j / 2, y + j / 2, bw - j, 1.5);
        g.fillStyle = 'rgba(150,140,125,0.22)'; g.fillRect(xx + j / 2, y + ch - j / 2 - 2, bw - j, 2);
        // a few chips and soft dents
        for (let d = 0; d < 3; d++) {
          const dx = xx + j + r() * (bw - 2 * j), dy = y + j + r() * (ch - 2 * j), dr = 1 + r() * 4;
          g.fillStyle = `rgba(170,160,145,${0.08 + r() * 0.12})`; g.beginPath(); g.arc(dx, dy, dr, 0, 7); g.fill();
        }
      };
      draw(x); if (x + bw > px) draw(x - px); if (x < 0) draw(x + px);
    }
  }
  grain(g, 10, seed + 5);
  return tex(c);
}

// cream wool with a black hand-drawn lattice of diamonds
export function latticeRug({ px = 1024, tile = 1.2, seed = 21 } = {}) {
  const [c, g] = canvas(px), r = rng(seed);
  g.fillStyle = '#e9e0cf'; g.fillRect(0, 0, px, px);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,240,0.18)' : 'rgba(150,130,100,0.10)'; g.fillRect(r() * px, r() * px, 1.5, 3 + r() * 4); }
  const n = 4, cw = px / n;
  g.strokeStyle = 'rgba(30,28,26,0.92)'; g.lineCap = 'round';
  for (let a = -n; a <= 2 * n; a++) {
    for (const s of [1, -1]) {
      g.lineWidth = 9 + r() * 2;
      g.beginPath(); g.moveTo(a * cw, 0);
      for (let k = 1; k <= 16; k++) { const u = k / 16; g.lineTo(a * cw + s * u * px * 0.5 + (r() - 0.5) * 3, u * px * 0.5 * 2 + (r() - 0.5) * 3); }
      g.stroke();
    }
  }
  // little ticks along the lines, like the reference rug
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = (a + 0.5) * cw, y = (b + 0.5) * cw;
    g.lineWidth = 6; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.stroke();
  }
  grain(g, 12, seed + 7);
  return tex(c);
}
