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
const BODY_HALF = 11;
const CHANNEL_HALF = 8;

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
  // White stripe highlight down the center
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(x, y - 1, w, 2);
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
  // White stripe highlight down the center
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(x - 1, y, 2, h);
};

/** Draw a copper flange ring at the pipe end (the tile edge). */
const drawFlangeH = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.fillStyle = PALETTE.copper;
  ctx.fillRect(x - 3, y - RIM_HALF, 6, RIM_HALF * 2);
  ctx.fillStyle = PALETTE.copperLight;
  ctx.fillRect(x - 3, y - RIM_HALF, 6, 2);
  ctx.fillStyle = PALETTE.copperDark;
  ctx.fillRect(x - 3, y + RIM_HALF - 2, 6, 2);
  // Bolts
  ctx.fillStyle = PALETTE.copperDark;
  ctx.fillRect(x - 2, y - RIM_HALF + 2, 1, 1);
  ctx.fillRect(x + 1, y - RIM_HALF + 2, 1, 1);
  ctx.fillRect(x - 2, y + RIM_HALF - 3, 1, 1);
  ctx.fillRect(x + 1, y + RIM_HALF - 3, 1, 1);
};

const drawFlangeV = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.fillStyle = PALETTE.copper;
  ctx.fillRect(x - RIM_HALF, y - 3, RIM_HALF * 2, 6);
  ctx.fillStyle = PALETTE.copperLight;
  ctx.fillRect(x - RIM_HALF, y - 3, 2, 6);
  ctx.fillStyle = PALETTE.copperDark;
  ctx.fillRect(x + RIM_HALF - 2, y - 3, 2, 6);
  // Bolts
  ctx.fillStyle = PALETTE.copperDark;
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
  // Copper flange plate
  ctx.fillStyle = PALETTE.copper;
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
  // White stripe highlight across center
  ctx.fillStyle = PALETTE.pipeRim;
  ctx.fillRect(PIPE_HALF - BODY_HALF, PIPE_HALF - 1, BODY_HALF * 2, 2);
  // Inner channel
  ctx.fillStyle = PALETTE.pipeShadow;
  ctx.fillRect(
    PIPE_HALF - CHANNEL_HALF,
    PIPE_HALF - CHANNEL_HALF,
    CHANNEL_HALF * 2,
    CHANNEL_HALF * 2,
  );
  // Copper bolts at corners
  ctx.fillStyle = PALETTE.copperDark;
  const b = 3;
  const off = BODY_HALF - b - 1;
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF - off, b, b);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF - off, b, b);
  ctx.fillRect(PIPE_HALF - off, PIPE_HALF + off - b + 1, b, b);
  ctx.fillRect(PIPE_HALF + off - b + 1, PIPE_HALF + off - b + 1, b, b);
  ctx.fillStyle = PALETTE.copperLight;
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

/**
 * Draw a rounded elbow as a quarter-circle arc. The arc center is at the
 * corner of the cell opposite the two openings. The pipe is built in 3
 * concentric layers: outer rim, body (with cylindrical shading), inner channel.
 */
const drawElbowCurve = (ctx: CanvasRenderingContext2D, from: Direction, to: Direction): void => {
  // The arc center is at the corner that connects the two arms.
  // For N+E: center at top-right corner (0,0), arc from right edge to bottom.
  // For E+S: center at bottom-right (56,0), arc from top to left.
  // For S+W: center at bottom-left (56,56), arc from left to top.
  // For W+N: center at top-left (0,56), arc from bottom to right.
  // Actually: the center is the corner where the two openings meet.
  // N+E: arms go to N (top) and E (right) → center is top-right area,
  //   but the arc should curve from the N edge to the E edge. The center
  //   of the arc is at the corner opposite to the two directions, i.e.
  //   the corner that the pipe bends around.
  // N+E: bend around bottom-left corner? No — the pipe enters from top
  //   center and exits right center. The arc center is at the corner
  //   where the two edges meet: top-right (0, 0)? No, top-right is (56, 0).
  //   N is top, E is right → the corner is (56, 0) top-right.
  //   But the pipe bends around the OPPOSITE corner (bottom-left = 0, 56).
  //   Wait — think of it as: N arm goes from center up to top edge,
  //   E arm goes from center right to right edge. The curve connects
  //   them, bending around the corner that's in the direction of
  //   the opening, i.e. the inner corner is the one nearest both openings.
  //   N+E → inner corner is top-right (56, 0). The arc center is there,
  //   radius = SPRITE_SIZE/2, sweeping from the N edge midpoint (28, 0)
  //   to the E edge midpoint (56, 28).
  //   Actually no — the arc center should be at the corner that the pipe
  //   curves AROUND. For N+E, the pipe goes up then turns right. The
  //   center of curvature is at the corner between the two openings:
  //   that's the top-right corner (56, 0). The radius is 28 (half the tile).
  //   The arc goes from angle 180° (left of center = the N edge midpoint)
  //   to 90° (below center = the E edge midpoint).
  //   Hmm, let me think in standard coords (y down):
  //   Center at (56, 0). Radius 28. Point at angle 180° = (56-28, 0) = (28, 0) = N edge midpoint. ✓
  //   Point at angle 90° = (56, 0+28) = (56, 28) = E edge midpoint. ✓
  //   Arc from 180° to 90° (clockwise = decreasing angle in screen coords).
  const cornerFor: Record<string, readonly [number, number]> = {
    NE: [SPRITE_SIZE, 0],
    ES: [SPRITE_SIZE, SPRITE_SIZE],
    SW: [0, SPRITE_SIZE],
    WN: [0, 0],
  };
  const dirPair = (from: Direction, to: Direction): string => {
    const set = new Set([from, to]);
    if (set.has('N') && set.has('E')) return 'NE';
    if (set.has('E') && set.has('S')) return 'ES';
    if (set.has('S') && set.has('W')) return 'SW';
    return 'WN';
  };
  const [cx, cy] = cornerFor[dirPair(from, to)];
  const r = PIPE_HALF;
  // Arc angles computed per corner so the arc connects the two edge midpoints.
  // In canvas coords, angle 0 is right, PI/2 is down, PI is left, -PI/2 is up.
  // NE (center 56,0, r 28): N midpoint (28,0) = 180°, E midpoint (56,28) = 90°
  // ES (center 56,56, r 28): E midpoint (56,28) = -90°, S midpoint (28,56) = 180°
  // SW (center 0,56, r 28): S midpoint (28,56) = 0°, W midpoint (0,28) = -90°
  // WN (center 0,0, r 28): W midpoint (0,28) = 90°, N midpoint (28,0) = 0°
  // The boolean `true` passed to arc() means draw counterclockwise (decreasing
  // screen-angle), which connects the two midpoints with a quarter-circle.
  const anglesFor: Record<string, readonly [number, number]> = {
    NE: [Math.PI, Math.PI / 2],
    ES: [-Math.PI / 2, Math.PI],
    SW: [0, -Math.PI / 2],
    WN: [Math.PI / 2, 0],
  };
  const [startAngle, endAngle] = anglesFor[dirPair(from, to)];
  // Also draw flanges at both ends
  const flangePosFor: Record<
    string,
    readonly [readonly [number, number], readonly [number, number]]
  > = {
    NE: [
      [PIPE_HALF, 2],
      [SPRITE_SIZE - 2, PIPE_HALF],
    ],
    ES: [
      [SPRITE_SIZE - 2, PIPE_HALF],
      [PIPE_HALF, SPRITE_SIZE - 2],
    ],
    SW: [
      [PIPE_HALF, SPRITE_SIZE - 2],
      [2, PIPE_HALF],
    ],
    WN: [
      [2, PIPE_HALF],
      [PIPE_HALF, 2],
    ],
  };
  const pair = dirPair(from, to);
  const isHorizontalFlangeFirst = from === 'E' || from === 'W';
  const isHorizontalFlangeSecond = to === 'E' || to === 'W';
  const [f1, f2] = flangePosFor[pair];

  // Draw 3 concentric arc layers (outer rim → body → channel) using strokes
  ctx.lineCap = 'butt';

  // Outer rim (light)
  ctx.strokeStyle = PALETTE.pipeRim;
  ctx.lineWidth = RIM_HALF * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Body (mid)
  ctx.strokeStyle = PALETTE.pipe;
  ctx.lineWidth = BODY_HALF * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Highlight (light inner band on the outer side of the curve)
  ctx.strokeStyle = PALETTE.pipeLight;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + BODY_HALF - 2, startAngle, endAngle, true);
  ctx.stroke();

  // Shadow (dark band on the inner side of the curve)
  ctx.strokeStyle = PALETTE.pipeDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r - BODY_HALF + 2, startAngle, endAngle, true);
  ctx.stroke();

  // Inner channel (dark)
  ctx.strokeStyle = PALETTE.pipeShadow;
  ctx.lineWidth = CHANNEL_HALF * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Flanges at both ends
  if (isHorizontalFlangeFirst) {
    drawFlangeH(ctx, f1[0], f1[1]);
  } else {
    drawFlangeV(ctx, f1[0], f1[1]);
  }
  if (isHorizontalFlangeSecond) {
    drawFlangeH(ctx, f2[0], f2[1]);
  } else {
    drawFlangeV(ctx, f2[0], f2[1]);
  }
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
  drawElbowCurve(ctx, from, to);
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

const drawYuckElbowCurve = (
  ctx: CanvasRenderingContext2D,
  from: Direction,
  to: Direction,
): void => {
  const dirPair = (from: Direction, to: Direction): string => {
    const set = new Set([from, to]);
    if (set.has('N') && set.has('E')) return 'NE';
    if (set.has('E') && set.has('S')) return 'ES';
    if (set.has('S') && set.has('W')) return 'SW';
    return 'WN';
  };
  const cornerFor: Record<string, readonly [number, number]> = {
    NE: [SPRITE_SIZE, 0],
    ES: [SPRITE_SIZE, SPRITE_SIZE],
    SW: [0, SPRITE_SIZE],
    WN: [0, 0],
  };
  const anglesFor: Record<string, readonly [number, number]> = {
    NE: [Math.PI, Math.PI / 2],
    ES: [-Math.PI / 2, Math.PI],
    SW: [0, -Math.PI / 2],
    WN: [Math.PI / 2, 0],
  };
  const [cx, cy] = cornerFor[dirPair(from, to)];
  const [startAngle, endAngle] = anglesFor[dirPair(from, to)];
  const r = PIPE_HALF;
  ctx.lineCap = 'butt';

  // Yuck dark edges
  ctx.strokeStyle = PALETTE.yuckDark;
  ctx.lineWidth = CHANNEL_HALF * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Yuck mid
  ctx.strokeStyle = PALETTE.yuck;
  ctx.lineWidth = CHANNEL_HALF * 2 - 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Yuck light
  ctx.strokeStyle = PALETTE.yuckLight;
  ctx.lineWidth = CHANNEL_HALF * 2 - 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();

  // Glossy highlight
  ctx.strokeStyle = PALETTE.yuckGlow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, true);
  ctx.stroke();
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
  drawYuckElbowCurve(ctx, from, to);
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
  // Steel body with copper flange plate — matches pipe visual language.
  ctx.fillStyle = PALETTE.copper;
  ctx.fillRect(PIPE_HALF - 22, PIPE_HALF - 22, 44, 44);
  ctx.fillStyle = PALETTE.pipe;
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF - 18, 36, 36);
  ctx.fillStyle = PALETTE.pipeLight;
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF - 18, 36, 2);
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF - 18, 2, 36);
  ctx.fillStyle = PALETTE.pipeDark;
  ctx.fillRect(PIPE_HALF - 18, PIPE_HALF + 16, 36, 2);
  ctx.fillRect(PIPE_HALF + 16, PIPE_HALF - 18, 2, 36);
  // Copper bolts at corners
  ctx.fillStyle = PALETTE.copperDark;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 3, 3);
  ctx.fillRect(PIPE_HALF + 13, PIPE_HALF - 16, 3, 3);
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF + 13, 3, 3);
  ctx.fillRect(PIPE_HALF + 13, PIPE_HALF + 13, 3, 3);
  ctx.fillStyle = PALETTE.copperLight;
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF - 16, 1, 1);
  ctx.fillRect(PIPE_HALF + 13, PIPE_HALF - 16, 1, 1);
  ctx.fillRect(PIPE_HALF - 16, PIPE_HALF + 13, 1, 1);
  ctx.fillRect(PIPE_HALF + 13, PIPE_HALF + 13, 1, 1);
  // Pipe stub extending toward sourceDir (matches pipe body style)
  drawOpening(ctx, dir, PALETTE.pipeDark);
  // White stripe on pipe stub
  switch (dir) {
    case 'N':
      ctx.fillStyle = PALETTE.pipeRim;
      ctx.fillRect(PIPE_HALF - 1, 0, 2, PIPE_HALF);
      break;
    case 'S':
      ctx.fillStyle = PALETTE.pipeRim;
      ctx.fillRect(PIPE_HALF - 1, PIPE_HALF, 2, PIPE_HALF);
      break;
    case 'E':
      ctx.fillStyle = PALETTE.pipeRim;
      ctx.fillRect(PIPE_HALF, PIPE_HALF - 1, PIPE_HALF, 2);
      break;
    case 'W':
      ctx.fillStyle = PALETTE.pipeRim;
      ctx.fillRect(0, PIPE_HALF - 1, PIPE_HALF, 2);
      break;
  }
  // Yuck pool in center
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
