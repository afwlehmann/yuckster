// Procedural pixel-art sprite cache. Sprites are drawn once into offscreen
// canvases at TILE resolution and blitted by the board renderer. Pipes are
// drawn on a transparent background so the gravel ground shows through the
// gaps; yuck is composited on top of the pipe interior.

import type { Direction, Piece } from '../game/types.js';
import { GRID_SIZE } from './canvas.js';
import { makeSprite } from './canvas.js';
import { PALETTE } from './palette.js';
import { createRng, nextInt, type RngState } from '../game/rng.js';

export const SPRITE_SIZE = 24; // matches TILE

type SpriteKey = string;

export interface SpriteStore {
  readonly gravel: readonly HTMLCanvasElement[];
  readonly pipes: ReadonlyMap<SpriteKey, HTMLCanvasElement>;
  readonly yuck: ReadonlyMap<SpriteKey, HTMLCanvasElement>;
  readonly start: HTMLCanvasElement;
  readonly end: HTMLCanvasElement;
}

const key = (parts: readonly unknown[]): string => parts.join(':');

// --- Gravel / mud ground tiles -------------------------------------------------

const drawGravelTile = (index: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.mud;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const rng = createRng(1000 + index);
  let state: RngState = rng;
  for (let i = 0; i < 40; i += 1) {
    const xStep = nextInt(SPRITE_SIZE)(state);
    state = xStep.rng;
    const yStep = nextInt(SPRITE_SIZE)(state);
    state = yStep.rng;
    const cStep = nextInt(3)(state);
    state = cStep.rng;
    const color = [PALETTE.mudDark, PALETTE.gravel, PALETTE.gravelLight][cStep.value];
    ctx.fillStyle = color;
    ctx.fillRect(xStep.value, yStep.value, 1, 1);
  }
  return canvas;
};

// --- Pipe body -----------------------------------------------------------------

const PIPE_THICK = 8; // half-width of pipe interior
const PIPE_HALF = SPRITE_SIZE / 2;

const drawPipeBand = (ctx: CanvasRenderingContext2D, from: Direction, to: Direction): void => {
  // Outer rim (light) then body (mid) then inner shadow, drawn as rounded bands
  // from the center toward each opening edge.
  const drawArm = (dir: Direction) => {
    const rim = PIPE_THICK + 3;
    ctx.fillStyle = PALETTE.pipeRim;
    switch (dir) {
      case 'N':
        ctx.fillRect(PIPE_HALF - rim, 0, rim * 2, PIPE_HALF + 1);
        break;
      case 'S':
        ctx.fillRect(PIPE_HALF - rim, PIPE_HALF - 1, rim * 2, PIPE_HALF + 1);
        break;
      case 'E':
        ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - rim, PIPE_HALF + 1, rim * 2);
        break;
      case 'W':
        ctx.fillRect(0, PIPE_HALF - rim, PIPE_HALF + 1, rim * 2);
        break;
    }
    ctx.fillStyle = PALETTE.pipe;
    switch (dir) {
      case 'N':
        ctx.fillRect(PIPE_HALF - PIPE_THICK, 0, PIPE_THICK * 2, PIPE_HALF + 1);
        break;
      case 'S':
        ctx.fillRect(PIPE_HALF - PIPE_THICK, PIPE_HALF - 1, PIPE_THICK * 2, PIPE_HALF + 1);
        break;
      case 'E':
        ctx.fillRect(PIPE_HALF - 1, PIPE_HALF - PIPE_THICK, PIPE_HALF + 1, PIPE_THICK * 2);
        break;
      case 'W':
        ctx.fillRect(0, PIPE_HALF - PIPE_THICK, PIPE_HALF + 1, PIPE_THICK * 2);
        break;
    }
    // Inner shadow channel
    ctx.fillStyle = PALETTE.pipeShadow;
    const inner = PIPE_THICK - 3;
    switch (dir) {
      case 'N':
        ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, PIPE_HALF);
        break;
      case 'S':
        ctx.fillRect(PIPE_HALF - inner, PIPE_HALF, inner * 2, PIPE_HALF);
        break;
      case 'E':
        ctx.fillRect(PIPE_HALF, PIPE_HALF - inner, PIPE_HALF, inner * 2);
        break;
      case 'W':
        ctx.fillRect(0, PIPE_HALF - inner, PIPE_HALF, inner * 2);
        break;
    }
  };
  drawArm(from);
  drawArm(to);
  // Center hub
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(PIPE_HALF - PIPE_THICK, PIPE_HALF - PIPE_THICK, PIPE_THICK * 2, PIPE_THICK * 2);
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(
    PIPE_HALF - (PIPE_THICK - 3),
    PIPE_HALF - (PIPE_THICK - 3),
    (PIPE_THICK - 3) * 2,
    (PIPE_THICK - 3) * 2,
  );
  // Rust speckles
  ctx.fillStyle = PALETTE.rust;
  ctx.fillRect(PIPE_HALF - 5, PIPE_HALF - 1, 2, 1);
  ctx.fillRect(PIPE_HALF + 3, PIPE_HALF + 2, 1, 1);
  ctx.fillStyle = PALETTE.rustDark;
  ctx.fillRect(PIPE_HALF - 2, PIPE_HALF + 4, 1, 1);
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
  // Horizontal band then vertical band, with the inner channel drawn for both.
  drawPipeBand(ctx, 'E', 'W');
  drawPipeBand(ctx, 'N', 'S');
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

const drawYuckStraight = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const inner = PIPE_THICK - 3;
  ctx.fillStyle = PALETTE.yuck;
  if (rotation % 2 === 0) {
    ctx.fillRect(0, PIPE_HALF - inner, SPRITE_SIZE, inner * 2);
  } else {
    ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, SPRITE_SIZE);
  }
  // Highlight stripe
  ctx.fillStyle = PALETTE.yuckLight;
  if (rotation % 2 === 0) {
    ctx.fillRect(0, PIPE_HALF - inner + 1, SPRITE_SIZE, 1);
  } else {
    ctx.fillRect(PIPE_HALF - inner + 1, 0, 1, SPRITE_SIZE);
  }
  return canvas;
};

const drawYuckElbow = (rotation: number): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const inner = PIPE_THICK - 3;
  const pairs: readonly [Direction, Direction][] = [
    ['N', 'E'],
    ['E', 'S'],
    ['S', 'W'],
    ['W', 'N'],
  ];
  const [from] = pairs[rotation % 4];
  ctx.fillStyle = PALETTE.yuck;
  const band = (dir: Direction) => {
    switch (dir) {
      case 'N':
        ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, PIPE_HALF);
        break;
      case 'S':
        ctx.fillRect(PIPE_HALF - inner, PIPE_HALF, inner * 2, PIPE_HALF);
        break;
      case 'E':
        ctx.fillRect(PIPE_HALF, PIPE_HALF - inner, PIPE_HALF, inner * 2);
        break;
      case 'W':
        ctx.fillRect(0, PIPE_HALF - inner, PIPE_HALF, inner * 2);
        break;
    }
  };
  void from;
  band(from);
  ctx.fillRect(PIPE_HALF - inner, PIPE_HALF - inner, inner * 2, inner * 2);
  return canvas;
};

const drawYuckCross = (): HTMLCanvasElement => {
  // For simplicity yuck in a crossing renders the active channel only when the
  // board renderer passes the entry direction; here we draw a full cross glow.
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  const inner = PIPE_THICK - 3;
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(0, PIPE_HALF - inner, SPRITE_SIZE, inner * 2);
  ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.yuckLight;
  ctx.fillRect(0, PIPE_HALF - inner + 1, SPRITE_SIZE, 1);
  ctx.fillRect(PIPE_HALF - inner + 1, 0, 1, SPRITE_SIZE);
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

const drawStart = (dir: Direction): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(PIPE_HALF - 9, PIPE_HALF - 9, 18, 18);
  ctx.fillStyle = PALETTE.nozzle;
  ctx.fillRect(PIPE_HALF - 7, PIPE_HALF - 7, 14, 14);
  ctx.fillStyle = PALETTE.nozzleLight;
  ctx.fillRect(PIPE_HALF - 7, PIPE_HALF - 7, 14, 2);
  // Opening toward sourceDir
  ctx.fillStyle = PALETTE.yuckDark;
  const inner = PIPE_THICK - 3;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, PIPE_HALF);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - inner, PIPE_HALF, inner * 2, PIPE_HALF);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF, PIPE_HALF - inner, PIPE_HALF, inner * 2);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - inner, PIPE_HALF, inner * 2);
      break;
  }
  ctx.fillStyle = PALETTE.yuck;
  ctx.fillRect(PIPE_HALF - 3, PIPE_HALF - 3, 6, 6);
  return canvas;
};

const drawEnd = (dir: Direction): HTMLCanvasElement => {
  const { canvas, ctx } = makeSprite(SPRITE_SIZE, SPRITE_SIZE);
  ctx.fillStyle = PALETTE.drainDark;
  ctx.fillRect(PIPE_HALF - 9, PIPE_HALF - 9, 18, 18);
  ctx.fillStyle = PALETTE.drain;
  ctx.fillRect(PIPE_HALF - 7, PIPE_HALF - 7, 14, 14);
  ctx.fillStyle = PALETTE.drainDark;
  // Grate bars
  for (let i = -5; i <= 5; i += 2) {
    ctx.fillRect(PIPE_HALF + i - 1, PIPE_HALF - 6, 1, 12);
  }
  // Opening toward sourceDir
  const inner = PIPE_THICK - 3;
  ctx.fillStyle = PALETTE.drainDark;
  switch (dir) {
    case 'N':
      ctx.fillRect(PIPE_HALF - inner, 0, inner * 2, PIPE_HALF);
      break;
    case 'S':
      ctx.fillRect(PIPE_HALF - inner, PIPE_HALF, inner * 2, PIPE_HALF);
      break;
    case 'E':
      ctx.fillRect(PIPE_HALF, PIPE_HALF - inner, PIPE_HALF, inner * 2);
      break;
    case 'W':
      ctx.fillRect(0, PIPE_HALF - inner, PIPE_HALF, inner * 2);
      break;
  }
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
  const start = drawStart('E'); // direction-agnostic base; renderer rotates if needed
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
