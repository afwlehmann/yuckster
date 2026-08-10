// Procedural pixel-art sprite cache. Sprites are drawn once into offscreen
// canvases at TILE resolution and blitted by the board renderer. At 56px tiles
// the pipes carry real detail: a beveled rim, a mid body, an inner shadow
// channel, rivets at the hub, rust clusters, and a glossy yuck highlight.

import type { Direction, Piece } from '../game/types.js';
import { GRID_SIZE, makeSprite } from './canvas.js';
import { PALETTE } from './palette.js';
import { createRng, nextInt, type RngState } from '../game/rng.js';

export const SPRITE_SIZE = 56; // matches TILE

type SpriteKey = string;

export interface SpriteStore {
  readonly gravel: readonly HTMLCanvasElement[];
  readonly pipes: ReadonlyMap<SpriteKey, HTMLCanvasElement>;
  readonly yuck: ReadonlyMap<SpriteKey, HTMLCanvasElement>;
  readonly start: HTMLCanvasElement;
  readonly end: HTMLCanvasElement;
}

const key = (parts: readonly unknown[]): string => parts.join(':');

// Pipe geometry constants (56px tile). The interior channel is CHANNEL_HALF
// (6px) wide on each side of center; the body extends to BODY_HALF (12px); the
// outer rim to RIM_HALF (14px).
const PIPE_HALF = SPRITE_SIZE / 2;
const RIM_HALF = 14;
const BODY_HALF = 12;
const CHANNEL_HALF = 6;

// --- Gravel / mud ground tiles -------------------------------------------------

const drawGravelTile = (index: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.mud;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const rng = createRng(1000 + index);
  let state: RngState = rng;
  // Base gravel speckle
  for (let i = 0; i < 180; i += 1) {
    const xStep = nextInt(SPRITE_SIZE)(state);
    state = xStep.rng;
    const yStep = nextInt(SPRITE_SIZE)(state);
    state = yStep.rng;
    const cStep = nextInt(4)(state);
    state = cStep.rng;
    const color = [PALETTE.mudDark, PALETTE.gravel, PALETTE.gravelLight, PALETTE.mudLight][
      cStep.value
    ];
    ctx.fillStyle = color;
    ctx.fillRect(xStep.value, yStep.value, 1, 1);
  }
  // A few larger pebbles (2x2 clusters)
  for (let i = 0; i < 12; i += 1) {
    const xStep = nextInt(SPRITE_SIZE - 2)(state);
    state = xStep.rng;
    const yStep = nextInt(SPRITE_SIZE - 2)(state);
    state = yStep.rng;
    const cStep = nextInt(2)(state);
    state = cStep.rng;
    ctx.fillStyle = cStep.value === 0 ? PALETTE.gravelLight : PALETTE.gravel;
    ctx.fillRect(xStep.value, yStep.value, 2, 2);
  }
  return canvas;
};

// --- Pipe body -----------------------------------------------------------------
// Pipes are drawn as cylindrical tubes with flanged joints. Each arm has:
//   - a flange ring at the tile edge (where it meets the neighbor)
//   - a 3-band cylindrical body gradient (light top → mid → dark bottom)
//   - an inner channel (the hollow the yuck flows through)
// The hub is a square flange plate with bolts.

/** Fill a horizontal or vertical strip with a 3-step gradient for a tube look. */
const fillTubeH = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  half: number,
): void => {
  const top = y - half;
  const h = half * 2;
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(x, top, w, 4);
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(x, top + 4, w, h - 8);
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(x, top + h - 4, w, 4);
};

const fillTubeV = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  half: number,
): void => {
  const left = x - half;
  const w = half * 2;
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(left, y, 4, h);
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(left + 4, y, w - 8, h);
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(left + w - 4, y, 4, h);
};

/** Draw a flange ring at the pipe end (the tile edge). */
const drawFlangeH = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(x - 3, y - RIM_HALF, 6, RIM_HALF * 2);
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(x - 3, y - RIM_HALF, 6, 2);
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(x - 3, y + RIM_HALF - 2, 6, 2);
  // Bolts
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(x - 2, y - RIM_HALF + 2, 1, 1);
  ctx.fillRect(x + 1, y - RIM_HALF + 2, 1, 1);
  ctx.fillRect(x - 2, y + RIM_HALF - 3, 1, 1);
  ctx.fillRect(x + 1, y + RIM_HALF - 3, 1, 1);
};

const drawFlangeV = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(x - RIM_HALF, y - 3, RIM_HALF * 2, 6);
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(x - RIM_HALF, y - 3, 2, 6);
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(x + RIM_HALF - 2, y - 3, 2, 6);
  // Bolts
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(x - RIM_HALF + 2, y - 2, 1, 1);
  ctx.fillRect(x - RIM_HALF + 2, y + 1, 1, 1);
  ctx.fillRect(x + RIM_HALF - 3, y - 2, 1, 1);
  ctx.fillRect(x + RIM_HALF - 3, y + 1, 1, 1);
};

/**
 * Draw a single pipe arm from the center toward the given opening edge, with a
 * flange at the edge end and a cylindrical body gradient.
 */
const drawArm = (ctx: CanvasRenderingContext2D, dir: Direction): void => {
  switch (dir) {
    case 'N': {
      fillTubeV(ctx, PIPE_HALF, 0, PIPE_HALF, BODY_HALF);
      drawFlangeV(ctx, PIPE_HALF, 2);
      ctx.fillStyle = PALETTE.pipeShadow;
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, 0, CHANNEL_HALF * 2, PIPE_HALF);
      break;
    }
    case 'S': {
      fillTubeV(ctx, PIPE_HALF, PIPE_HALF, PIPE_HALF, BODY_HALF);
      drawFlangeV(ctx, PIPE_HALF, SPRITE_SIZE - 2);
      ctx.fillStyle = PALETTE.pipeShadow;
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2, PIPE_HALF);
      break;
    }
    case 'E': {
      fillTubeH(ctx, PIPE_HALF, PIPE_HALF, PIPE_HALF, BODY_HALF);
      drawFlangeH(ctx, SPRITE_SIZE - 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.pipeShadow;
      ctx.fillRect(PIPE_HALF, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      break;
    }
    case 'W': {
      fillTubeH(ctx, 0, PIPE_HALF, PIPE_HALF, BODY_HALF);
      drawFlangeH(ctx, 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.pipeShadow;
      ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      break;
    }
  }
};

/** Draw the center hub as a square flange plate with bolts. */
const drawHub = (ctx: CanvasRenderingContext2D): void => {
  // Flange plate
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - RIM_HALF, PIPE_HALF - RIM_HALF, RIM_HALF * 2, RIM_HALF * 2);
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - BODY_HALF, BODY_HALF * 2, BODY_HALF * 2);
  // Highlight (top-left)
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - BODY_HALF, BODY_HALF * 2, 2);
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - BODY_HALF, 2, BODY_HALF * 2);
  // Shadow (bottom-right)
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF + BODY_HALF - 2, BODY_HALF * 2, 2);
  ctx.fillRect(PIPE_HALF + BODY_HALF - 2, PIPE_HALF - BODY_HALF, 2, BODY_HALF * 2);
  // Inner channel
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(
    PIPE_HALF - CHANNEL_HALF,
    PIPE_HALF - CHANNEL_HALF,
    CHANNEL_HALF * 2,
    CHANNEL_HALF * 2,
  );
  // Bolts at corners
  ctx.fillStyle = PALETTE.pipeShadow;
  const b = 3;
  const off = BODY_HALF - b - 1;
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF - off, b, b);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF - off, b, b);
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF + off - b + 1, b, b);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF + off - b + 1, b, b);
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF - off, 1, 1);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF - off, 1, 1);
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF + off - b + 1, 1, 1);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF + off - b + 1, 1, 1);
  // Rust
  ctx.fillStyle = PALETTE.rust;
  ctx.fillRect(PIPE_HALF - BODY_HALF + 3, PIPE_HALF - 2, 3, 1);
  ctx.fillRect(PIPE_HALF + 2, PIPE_HALF + BODY_HALF - 4, 1, 3);
  ctx.fillStyle = PALETTE.rustDark;
  ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - BODY_HALF + 4, 2, 1);
};

const drawPipeBand = (ctx: CanvasRenderingContext2D, from: Direction, to: Direction): void => {
  drawArm(ctx, from);
  drawArm(ctx, to);
  drawHub(ctx);
};

const drawStraight = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const [from, to]: Direction[] = rotation % 2 === 0 ? ['E', 'W'] : ['N', 'S'];
  drawPipeBand(ctx, from, to);
  return canvas;
};

const drawElbow = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const pairs: readonly [Direction, Direction][] = [
    ['N', 'E'],
    ['E', 'S'],
    ['S', 'W'],
    ['W', 'N'],
  ];
  const [from, to] = pairs[rotation % 4];
  drawPipeBand(ctx, from, to);
  return canvas;
};

const drawCross = (): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  // Both bands; the hub unifies them.
  drawArm(ctx, 'E');
  drawArm(ctx, 'W');
  drawArm(ctx, 'N');
  drawArm(ctx, 'S');
  drawHub(ctx);
  return canvas;
};

const pipeSprite = (piece: Piece): HTMLCanvasElement => {
  switch (piece.kind) {
    case 'straight':
      return drawStraight(piece.rotation);
    case 'elbow':
      return drawElbow(piece.rotation);
    case 'cross':
      return drawCross();
  }
};

// --- Yuck fill overlays --------------------------------------------------------
// The yuck fills the inner channel with a green gradient (dark edges, bright
// center) plus a glossy 1px highlight stripe, giving the goo a wet, bubbling
// look rather than a flat fill.

const drawYuckBandH = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = PALETTE.yuckDark;
  ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF, SPRITE_SIZE, CHANNEL_HALF * 2);
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF + 1, SPRITE_SIZE, CHANNEL_HALF * 2 - 2);
  ctx.fillStyle = PALETTE.yuckLight;
  ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF + 2, SPRITE_SIZE, CHANNEL_HALF * 2 - 4);
  // Glossy highlight
  ctx.fillStyle = PALETTE.yuckGlow;
  ctx.fillRect(0, PIPE_HALF - 1, SPRITE_SIZE, 1);
};

const drawYuckBandV = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = PALETTE.yuckDark;
  ctx.fillRect(PIPE_HALF - CHANNEL_HALF, 0, CHANNEL_HALF * 2, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(PIPE_HALF - CHANNEL_HALF + 1, 0, CHANNEL_HALF * 2 - 2, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.yuckLight;
  ctx.fillRect(PIPE_HALF - CHANNEL_HALF + 2, 0, CHANNEL_HALF * 2 - 4, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.yuckGlow;
  ctx.fillRect(PIPE_HALF - 1, 0, 1, SPRITE_SIZE);
};

const drawYuckArm = (ctx: CanvasRenderingContext2D, dir: Direction): void => {
  ctx.fillStyle = PALETTE.yuckDark;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, 0, CHANNEL_HALF * 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF + 1, 0, CHANNEL_HALF * 2 - 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(PIPE_HALF - 1, 0, 1, PIPE_HALF);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF + 1, PIPE_HALF, CHANNEL_HALF * 2 - 2, PIPE_HALF);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(PIPE_HALF - 1, PIPE_HALF, 1, PIPE_HALF);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(PIPE_HALF, PIPE_HALF - CHANNEL_HALF + 1, PIPE_HALF, CHANNEL_HALF * 2 - 2);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(PIPE_HALF, PIPE_HALF - 1, PIPE_HALF, 1);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      ctx.fillStyle = PALETTE.yuck;
      ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF + 1, PIPE_HALF, CHANNEL_HALF * 2 - 2);
      ctx.fillStyle = PALETTE.yuckLight;
      ctx.fillRect(0, PIPE_HALF - 1, PIPE_HALF, 1);
      break;
  }
};

const drawYuckHub = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = PALETTE.yuckDark;
  ctx.fillRect(
    PIPE_HALF - CHANNEL_HALF,
    PIPE_HALF - CHANNEL_HALF,
    CHANNEL_HALF * 2,
    CHANNEL_HALF * 2,
  );
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(
    PIPE_HALF - CHANNEL_HALF + 1,
    PIPE_HALF - CHANNEL_HALF + 1,
    CHANNEL_HALF * 2 - 2,
    CHANNEL_HALF * 2 - 2,
  );
  ctx.fillStyle = PALETTE.yuckGlow;
  ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - 1, 2, 2);
};

const drawYuckStraight = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  if (rotation % 2 === 0) {
    drawYuckBandH(ctx);
  } else {
    drawYuckBandV(ctx);
  }
  return canvas;
};

const drawYuckElbow = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const pairs: readonly [Direction, Direction][] = [
    ['N', 'E'],
    ['E', 'S'],
    ['S', 'W'],
    ['W', 'N'],
  ];
  const [from, to] = pairs[rotation % 4];
  drawYuckArm(ctx, from);
  drawYuckArm(ctx, to);
  drawYuckHub(ctx);
  return canvas;
};

const drawYuckCross = (): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  drawYuckBandH(ctx);
  drawYuckBandV(ctx);
  drawYuckHub(ctx);
  return canvas;
};

const yuckSprite = (piece: Piece): HTMLCanvasElement => {
  switch (piece.kind) {
    case 'straight':
      return drawYuckStraight(piece.rotation);
    case 'elbow':
      return drawYuckElbow(piece.rotation);
    case 'cross':
      return drawYuckCross();
  }
};

// --- Start nozzle and end drain ------------------------------------------------

const drawOpening = (ctx: CanvasRenderingContext2D, dir: Direction, color: string): void => {
  ctx.fillStyle = color;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, 0, CHANNEL_HALF * 2, PIPE_HALF);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2, PIPE_HALF);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - CHANNEL_HALF, PIPE_HALF, CHANNEL_HALF * 2);
      break;
  }
};

const drawStart = (dir: Direction): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  // Nozzle housing
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(PIPE_HALF - 20, PIPE_HALF - 20, 40, 40);
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF - 18, 36, 36);
  ctx.fillStyle = PALETTE.nozzle;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 32, 32);
  ctx.fillStyle = PALETTE.nozzleLight;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 32, 2);
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 2, 32);
  // Bolts
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(PIPE_HALF - 14, PIPE_HALF - 14, 3, 3);
  ctx.fillRect(PIPE_HALF + 11, PIPE_HALF - 14, 3, 3);
  ctx.fillRect(PIPE_HALF - 14, PIPE_HALF + 11, 3, 3);
  ctx.fillRect(PIPE_HALF + 11, PIPE_HALF + 11, 3, 3);
  // Opening toward sourceDir, oozing yuck
  drawOpening(ctx, dir, PALETTE.yuckDark);
  drawOpening(ctx, dir, PALETTE.yuck);
  // Central yuck pool
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(PIPE_HALF - 6, PIPE_HALF - 6, 12, 12);
  ctx.fillStyle = PALETTE.yuckLight;
  ctx.fillRect(PIPE_HALF - 4, PIPE_HALF - 4, 8, 8);
  ctx.fillStyle = PALETTE.yuckGlow;
  ctx.fillRect(PIPE_HALF - 2, PIPE_HALF - 2, 4, 4);
  return canvas;
};

const drawEnd = (dir: Direction): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  // Drain housing
  ctx.fillStyle = PALETTE.drainDark;
  ctx.fillRect(PIPE_HALF - 20, PIPE_HALF - 20, 40, 40);
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF - 18, 36, 36);
  ctx.fillStyle = PALETTE.drain;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 32, 32);
  ctx.fillStyle = PALETTE.nozzleLight;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 32, 1);
  // Grate bars (vertical)
  ctx.fillStyle = PALETTE.drainDark;
  for (let i = -12; i <= 12; i += 4) {
    ctx.fillRect(PIPE_HALF + i - 1, PIPE_HALF - 12, 2, 24);
  }
  // Grate crossbars (horizontal)
  ctx.fillRect(PIPE_HALF - 12, PIPE_HALF - 1, 24, 2);
  // Opening
  drawOpening(ctx, dir, PALETTE.drainDark);
  return canvas;
};

// --- Cache build ---------------------------------------------------------------

export const buildSprites = (): SpriteStore => {
  const gravel = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => drawGravelTile(i));
  const pipes = new Map<SpriteKey, HTMLCanvasElement>();
  const yuck = new Map<SpriteKey, HTMLCanvasElement>();
  for (const kind of ['straight', 'elbow', 'cross'] as const) {
    for (let r = 0; r < 4; r += 1) {
      const piece: Piece = { kind, rotation: r as 0 | 1 | 2 | 3 };
      pipes.set(key([kind, r]), pipeSprite(piece));
      yuck.set(key([kind, r]), yuckSprite(piece));
    }
  }
  const start = drawStart('E');
  const end = drawEnd('W');
  return { gravel, pipes, yuck, start, end };
};

export const gravelSprite = (store: SpriteStore, index: number): HTMLCanvasElement =>
  store.gravel[index % store.gravel.length];

export const pipeSpriteFor = (store: SpriteStore, piece: Piece): HTMLCanvasElement =>
  store.pipes.get(key([piece.kind, piece.rotation])) ?? drawStraight(0);

export const yuckSpriteFor = (store: SpriteStore, piece: Piece): HTMLCanvasElement =>
  store.yuck.get(key([piece.kind, piece.rotation])) ?? drawYuckStraight(0);

export const startSprite = (store: SpriteStore, dir: Direction): HTMLCanvasElement => {
  void store;
  return drawStart(dir);
};

export const endSprite = (store: SpriteStore, dir: Direction): HTMLCanvasElement => {
  void store;
  return drawEnd(dir);
};
