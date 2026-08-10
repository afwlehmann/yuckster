// Auto-scrolling industrial-wasteland parallax background for the main menu.
// Four layers (smog sky → refinery skyline → derricks + drips → muddy foreground)
// drift at different speeds; each is a tileable offscreen strip drawn once and
// blitted twice per frame for seamless wrap. The update() advances only while
// the menu is active; draw() is pure compositing.

import { makeSprite, type CanvasView, VIEW_W, VIEW_H } from './canvas.js';
import { PALETTE } from './palette.js';
import { createRng, nextInt, type RngState } from '../game/rng.js';

const LAYER_W = VIEW_W + 64; // a bit wider than the viewport for wrap slack

interface Window {
  readonly x: number;
  readonly y: number;
  readonly on: number; // phase offset for blink
}

interface Drip {
  readonly x: number;
  y: number;
  delay: number;
}

interface Layer {
  readonly canvas: HTMLCanvasElement;
  speed: number; // px per second
  scroll: number;
}

export interface Parallax {
  readonly layers: readonly Layer[];
  readonly stars: readonly { readonly x: number; readonly y: number; readonly phase: number }[];
  readonly windows: readonly Window[];
  readonly flares: readonly { readonly x: number; readonly y: number; readonly phase: number }[];
  readonly drips: Drip[];
  elapsed: number;
}

const drawSky = (): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(LAYER_W, VIEW_H);
  // Smog gradient: dark purple-brown at top to near-black at horizon
  for (let y = 0; y < VIEW_H; y += 1) {
    const t = y / VIEW_H;
    const r = Math.round(10 + 18 * (1 - t));
    const g = Math.round(8 + 12 * (1 - t));
    const b = Math.round(14 + 10 * (1 - t));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, LAYER_W, 1);
  }
  // Moon
  const moonX = LAYER_W - 60;
  const moonY = 32;
  ctx.fillStyle = '#6a6a7a';
  for (let dy = -8; dy <= 8; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      if (dx * dx + dy * dy <= 64) {
        if ((dx + dy) % 3 === 0) ctx.fillStyle = '#5a5a6a';
        else ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(moonX + dx, moonY + dy, 1, 1);
      }
    }
  }
  return canvas;
};

const drawFarSkyline = (
  rng: RngState,
): { readonly canvas: HTMLCanvasElement; readonly windows: readonly Window[] } => {
  const { canvas, ctx } = makeSprite(LAYER_W, VIEW_H);
  ctx.fillStyle = '#1a1410';
  let state = rng;
  const windows: Window[] = [];
  let x = 0;
  while (x < LAYER_W) {
    const wStep = nextInt(3)(state);
    state = wStep.rng;
    const width = 14 + wStep.value * 8;
    const hStep = nextInt(4)(state);
    state = hStep.rng;
    const height = 30 + hStep.value * 20;
    const y = VIEW_H - height - 20;
    ctx.fillStyle = '#15110d';
    ctx.fillRect(x, y, width, height);
    // Stack
    if (width > 20) {
      ctx.fillRect(x + width / 2 - 2, y - 12, 4, 12);
    }
    // Windows
    for (let wy = y + 4; wy < y + height - 4; wy += 4) {
      for (let wx = x + 3; wx < x + width - 3; wx += 4) {
        const onStep = nextInt(2)(state);
        state = onStep.rng;
        windows.push({ x: wx, y: wy, on: onStep.value * 4 });
      }
    }
    x += width + 2;
  }
  return { canvas, windows };
};

const drawMid = (
  rng: RngState,
): { readonly canvas: HTMLCanvasElement; readonly drips: readonly Drip[] } => {
  const { canvas, ctx } = makeSprite(LAYER_W, VIEW_H);
  ctx.fillStyle = '#241a10';
  let state = rng;
  const drips: Drip[] = [];
  let x = 0;
  while (x < LAYER_W) {
    const typeStep = nextInt(2)(state);
    state = typeStep.rng;
    if (typeStep.value === 0) {
      // Oil derrick: triangular lattice tower
      const wStep = nextInt(2)(state);
      state = wStep.rng;
      const width = 16 + wStep.value * 6;
      const height = 40;
      const y = VIEW_H - height - 14;
      ctx.fillStyle = '#2a2014';
      ctx.fillRect(x, y, width, height);
      // Lattice diagonals
      ctx.fillStyle = '#3a2a1a';
      for (let i = 0; i < height; i += 4) {
        ctx.fillRect(x, y + i, 1, 1);
        ctx.fillRect(x + width - 1, y + i, 1, 1);
      }
      drips.push({ x: x + width / 2, y: VIEW_H - 14, delay: nextInt(40)(state).value });
      state = nextInt(40)(state).rng;
      x += width + 6;
    } else {
      // Pipe rack: horizontal pipe
      const yStep = nextInt(3)(state);
      state = yStep.rng;
      const y = VIEW_H - 30 - yStep.value * 8;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x, y, 30, 6);
      ctx.fillStyle = '#4a3a26';
      ctx.fillRect(x, y, 30, 1);
      x += 32;
    }
  }
  return { canvas, drips };
};

const drawForeground = (
  rng: RngState,
): {
  readonly canvas: HTMLCanvasElement;
  readonly puddles: readonly { readonly x: number; readonly y: number }[];
} => {
  const { canvas, ctx } = makeSprite(LAYER_W, VIEW_H);
  // Muddy ground band
  ctx.fillStyle = PALETTE.mud;
  ctx.fillRect(0, VIEW_H - 14, LAYER_W, 14);
  let state = rng;
  for (let i = 0; i < 200; i += 1) {
    const xStep = nextInt(LAYER_W)(state);
    state = xStep.rng;
    const yStep = nextInt(14)(state);
    state = yStep.rng;
    const cStep = nextInt(2)(state);
    state = cStep.rng;
    ctx.fillStyle = cStep.value === 0 ? PALETTE.mudDark : PALETTE.gravel;
    ctx.fillRect(xStep.value, VIEW_H - 14 + yStep.value, 1, 1);
  }
  const puddles: { readonly x: number; readonly y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const xStep = nextInt(LAYER_W - 16)(state);
    state = xStep.rng;
    puddles.push({ x: xStep.value, y: VIEW_H - 8 });
  }
  return { canvas, puddles };
};

export const createParallax = (): Parallax => {
  const rng = createRng(1337);
  const sky = drawSky();
  const far = drawFarSkyline(rng);
  const mid = drawMid(far.windows.length > 0 ? createRng(99) : rng);
  const fg = drawForeground(createRng(7));
  const layers: readonly Layer[] = [
    { canvas: sky, speed: 2, scroll: 0 },
    { canvas: far.canvas, speed: 4, scroll: 0 },
    { canvas: mid.canvas, speed: 9, scroll: 0 },
    { canvas: fg.canvas, speed: 16, scroll: 0 },
  ];
  const stars = Array.from({ length: 20 }, (_, i) => ({
    x: (i * 13 + 7) % LAYER_W,
    y: (i * 5 + 3) % 60,
    phase: i,
  }));
  const flares = Array.from({ length: 4 }, (_, i) => ({
    x: 40 + i * 60,
    y: VIEW_H - 60,
    phase: i,
  }));
  return {
    layers,
    stars,
    windows: far.windows,
    flares,
    drips: [...mid.drips],
    elapsed: 0,
  };
};

export const updateParallax = (p: Parallax, dt: number): Parallax => {
  const layers = p.layers.map((l) => ({ ...l, scroll: (l.scroll + l.speed * dt) % LAYER_W }));
  const drips = p.drips.map((d) => {
    const delay = d.delay - dt;
    if (delay > 0) return { ...d, delay };
    const y = d.y + 30 * dt;
    if (y > VIEW_H) return { ...d, y: VIEW_H - 14, delay: 2 + Math.random() * 3 };
    return { ...d, y };
  });
  return { ...p, layers, drips, elapsed: p.elapsed + dt };
};

const blitLayer = (view: CanvasView, layer: Layer): void => {
  const { ctx } = view;
  const x = -layer.scroll;
  ctx.drawImage(layer.canvas, x, 0);
  ctx.drawImage(layer.canvas, x + LAYER_W, 0);
  if (x + LAYER_W < VIEW_W) {
    ctx.drawImage(layer.canvas, x + LAYER_W * 2, 0);
  }
};

export const drawParallax = (view: CanvasView, p: Parallax): void => {
  const { ctx } = view;
  blitLayer(view, p.layers[0]);
  // Twinkling stars
  for (const s of p.stars) {
    const on = Math.floor(p.elapsed * 2 + s.phase) % 4 < 2;
    if (on) {
      ctx.fillStyle = '#5a5a7a';
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }
  blitLayer(view, p.layers[1]);
  // Blinking windows
  for (const w of p.windows) {
    const on = Math.floor(p.elapsed * 3 + w.on) % 5 < 3;
    if (on) {
      ctx.fillStyle = '#ffaa3a';
      ctx.fillRect(w.x, w.y, 1, 1);
    }
  }
  // Flickering flares
  for (const f of p.flares) {
    const on = Math.floor(p.elapsed * 8 + f.phase) % 3 < 2;
    if (on) {
      ctx.fillStyle = '#ff7a3a';
      ctx.fillRect(f.x, f.y, 2, 2);
      ctx.fillStyle = '#ffcc5a';
      ctx.fillRect(f.x, f.y, 1, 1);
    }
  }
  blitLayer(view, p.layers[2]);
  // Falling drips
  for (const d of p.drips) {
    if (d.delay <= 0) {
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(d.x, d.y, 2, 2);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(d.x, d.y, 1, 1);
    }
  }
  blitLayer(view, p.layers[3]);
  // Shimmering puddles
  for (let i = 0; i < 6; i += 1) {
    const on = Math.floor(p.elapsed * 4 + i) % 3 < 2;
    const px = (i * 40 + 10) % LAYER_W;
    if (on) {
      ctx.fillStyle = PALETTE.yuckDark;
      ctx.fillRect(px, VIEW_H - 8, 8, 2);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(px + 1, VIEW_H - 8, 6, 1);
    }
  }
};
