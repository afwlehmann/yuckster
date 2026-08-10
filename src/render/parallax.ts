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
  const moonX = LAYER_W - 120;
  const moonY = 64;
  ctx.fillStyle = '#6a6a7a';
  for (let dy = -16; dy <= 16; dy += 1) {
    for (let dx = -16; dx <= 16; dx += 1) {
      if (dx * dx + dy * dy <= 256) {
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
    const width = 28 + wStep.value * 16;
    const hStep = nextInt(4)(state);
    state = hStep.rng;
    const height = 60 + hStep.value * 40;
    const y = VIEW_H - height - 40;
    ctx.fillStyle = '#15110d';
    ctx.fillRect(x, y, width, height);
    // Stack
    if (width > 40) {
      ctx.fillRect(x + width / 2 - 4, y - 24, 8, 24);
    }
    // Windows
    for (let wy = y + 8; wy < y + height - 8; wy += 8) {
      for (let wx = x + 6; wx < x + width - 6; wx += 8) {
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
      const width = 32 + wStep.value * 12;
      const height = 80;
      const y = VIEW_H - height - 28;
      ctx.fillStyle = '#2a2014';
      ctx.fillRect(x, y, width, height);
      // Lattice diagonals
      ctx.fillStyle = '#3a2a1a';
      for (let i = 0; i < height; i += 8) {
        ctx.fillRect(x, y + i, 2, 2);
        ctx.fillRect(x + width - 2, y + i, 2, 2);
      }
      drips.push({ x: x + width / 2, y: VIEW_H - 28, delay: nextInt(40)(state).value });
      state = nextInt(40)(state).rng;
      x += width + 12;
    } else {
      // Pipe rack: horizontal pipe
      const yStep = nextInt(3)(state);
      state = yStep.rng;
      const y = VIEW_H - 60 - yStep.value * 16;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x, y, 60, 12);
      ctx.fillStyle = '#4a3a26';
      ctx.fillRect(x, y, 60, 2);
      x += 64;
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
  ctx.fillRect(0, VIEW_H - 28, LAYER_W, 28);
  let state = rng;
  for (let i = 0; i < 400; i += 1) {
    const xStep = nextInt(LAYER_W)(state);
    state = xStep.rng;
    const yStep = nextInt(28)(state);
    state = yStep.rng;
    const cStep = nextInt(2)(state);
    state = cStep.rng;
    ctx.fillStyle = cStep.value === 0 ? PALETTE.mudDark : PALETTE.gravel;
    ctx.fillRect(xStep.value, VIEW_H - 28 + yStep.value, 1, 1);
  }
  const puddles: { readonly x: number; readonly y: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const xStep = nextInt(LAYER_W - 32)(state);
    state = xStep.rng;
    puddles.push({ x: xStep.value, y: VIEW_H - 16 });
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
    { canvas: sky, speed: 4, scroll: 0 },
    { canvas: far.canvas, speed: 8, scroll: 0 },
    { canvas: mid.canvas, speed: 18, scroll: 0 },
    { canvas: fg.canvas, speed: 32, scroll: 0 },
  ];
  const stars = Array.from({ length: 40 }, (_, i) => ({
    x: (i * 17 + 7) % LAYER_W,
    y: (i * 7 + 3) % 120,
    phase: i,
  }));
  const flares = Array.from({ length: 4 }, (_, i) => ({
    x: 80 + i * 120,
    y: VIEW_H - 120,
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
    const y = d.y + 60 * dt;
    if (y > VIEW_H) return { ...d, y: VIEW_H - 28, delay: 2 + Math.random() * 3 };
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
      ctx.fillStyle = '#6a6a8a';
      ctx.fillRect(s.x, s.y, 2, 2);
    }
  }
  blitLayer(view, p.layers[1]);
  // Blinking windows
  for (const w of p.windows) {
    const on = Math.floor(p.elapsed * 3 + w.on) % 5 < 3;
    if (on) {
      ctx.fillStyle = '#ffaa3a';
      ctx.fillRect(w.x, w.y, 2, 2);
    }
  }
  // Flickering flares
  for (const f of p.flares) {
    const on = Math.floor(p.elapsed * 8 + f.phase) % 3 < 2;
    if (on) {
      ctx.fillStyle = '#ff7a3a';
      ctx.fillRect(f.x, f.y, 4, 4);
      ctx.fillStyle = '#ffcc5a';
      ctx.fillRect(f.x, f.y, 2, 2);
    }
  }
  blitLayer(view, p.layers[2]);
  // Falling drips
  for (const d of p.drips) {
    if (d.delay <= 0) {
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(d.x, d.y, 4, 4);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(d.x, d.y, 2, 2);
    }
  }
  blitLayer(view, p.layers[3]);
  // Shimmering puddles
  for (let i = 0; i < 6; i += 1) {
    const on = Math.floor(p.elapsed * 4 + i) % 3 < 2;
    const px = (i * 80 + 20) % LAYER_W;
    if (on) {
      ctx.fillStyle = PALETTE.yuckDark;
      ctx.fillRect(px, VIEW_H - 16, 16, 4);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(px + 2, VIEW_H - 16, 12, 2);
    }
  }
};
