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
const HIGHLIGHT_HALF = 13; // a 1px light stripe just inside the rim

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

/**
 * Draw a single pipe arm from the center toward the given opening edge. Layers:
 * outer rim (light) → body (mid) → top highlight stripe → inner shadow channel.
 * The hub is drawn separately by drawPipeBand so arms just need to reach it.
 */
const drawArm = (ctx: CanvasRenderingContext2D, dir: Direction): void => {
  // Outer rim
  ctx.fillStyle = PALETTE.pipeRim;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - RIM_HALF, 0, RIM_HALF * 2, PIPE_HALF + 1);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - RIM_HALF, PIPE_HALF - 1, RIM_HALF * 2, PIPE_HALF + 1);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - RIM_HALF, PIPE_HALF + 1, RIM_HALF * 2);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - RIM_HALF, PIPE_HALF + 1, RIM_HALF * 2);
      break;
  }
  // Body
  ctx.fillStyle = PALETTE.pipe;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - BODY_HALF, 0, BODY_HALF * 2, PIPE_HALF + 1);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - 1, BODY_HALF * 2, PIPE_HALF + 1);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - BODY_HALF, PIPE_HALF + 1, BODY_HALF * 2);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - BODY_HALF, PIPE_HALF + 1, BODY_HALF * 2);
      break;
  }
  // Top highlight stripe (a thin light line just inside the rim on the
  // "upper" side of the pipe, giving a cylindrical sheen).
  ctx.fillStyle = PALETTE.pipeLight;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - HIGHLIGHT_HALF, 0, 1, PIPE_HALF);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF + HIGHLIGHT_HALF - 1, PIPE_HALF, 1, PIPE_HALF);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF, PIPE_HALF - HIGHLIGHT_HALF, PIPE_HALF, 1);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF + HIGHLIGHT_HALF - 1, PIPE_HALF, 1);
      break;
  }
  // Inner shadow channel (the hollow interior the yuck flows through)
  ctx.fillStyle = PALETTE.pipeShadow;
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

/** Draw the center hub: body square, channel square, rivets, and rust. */
const drawHub = (ctx: CanvasRenderingContext2D): void => {
  // Hub body
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - RIM_HALF, PIPE_HALF - RIM_HALF, RIM_HALF * 2, RIM_HALF * 2);
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - BODY_HALF, BODY_HALF * 2, BODY_HALF * 2);
  // Inner channel
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(
    PIPE_HALF - CHANNEL_HALF,
    PIPE_HALF - CHANNEL_HALF,
    CHANNEL_HALF * 2,
    CHANNEL_HALF * 2,
  );
  // Highlight on hub (top-left)
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(PIPE_HALF - HIGHLIGHT_HALF, PIPE_HALF - HIGHLIGHT_HALF, 1, BODY_HALF * 2);
  ctx.fillRect(PIPE_HALF - HIGHLIGHT_HALF, PIPE_HALF - HIGHLIGHT_HALF, BODY_HALF * 2, 1);
  // Rivets at the four hub corners
  ctx.fillStyle = PALETTE.pipeShadow;
  const r = 3;
  ctx.fillRect(PIPE_HALF - BODY_HALF + 1, PIPE_HALF - BODY_HALF + 1, r, r);
  ctx.fillRect(PIPE_HALF + BODY_HALF - r - 1, PIPE_HALF - BODY_HALF + 1, r, r);
  ctx.fillRect(PIPE_HALF - BODY_HALF + 1, PIPE_HALF + BODY_HALF - r - 1, r, r);
  ctx.fillRect(PIPE_HALF + BODY_HALF - r - 1, PIPE_HALF + BODY_HALF - r - 1, r, r);
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - BODY_HALF + 1, PIPE_HALF - BODY_HALF + 1, 1, 1);
  ctx.fillRect(PIPE_HALF + BODY_HALF - 2, PIPE_HALF - BODY_HALF + 1, 1, 1);
  ctx.fillRect(PIPE_HALF - BODY_HALF + 1, PIPE_HALF + BODY_HALF - 2, 1, 1);
  ctx.fillRect(PIPE_HALF + BODY_HALF - 2, PIPE_HALF + BODY_HALF - 2, 1, 1);
  // Rust clusters
  ctx.fillStyle = PALETTE.rust;
  ctx.fillRect(PIPE_HALF - BODY_HALF + 3, PIPE_HALF - 2, 3, 1);
  ctx.fillRect(PIPE_HALF + 2, PIPE_HALF + BODY_HALF - 4, 1, 3);
  ctx.fillStyle = PALETTE.rustDark;
  ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - BODY_HALF + 4, 2, 1);
  ctx.fillRect(PIPE_HALF + BODY_HALF - 5, PIPE_HALF + 1, 1, 2);
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
