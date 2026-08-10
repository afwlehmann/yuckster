// Game-over reveal: the game-over image is split into a grid of quadratic tiles
// that fly in straight from the distance (scaling up in place from a vanishing
// point), randomly bounce a bit closer to the viewer, then settle into the
// plane. Pure state — update() returns a new state record each frame.

import { VIEW_W, VIEW_H, type CanvasView, clear } from './canvas.js';
import { PALETTE } from './palette.js';
import { drawTextCenter } from './font.js';

const BASE = import.meta.env.BASE_URL;
const IMG_SRC = `${BASE}game-over.png`;

const GRID_COLS = 10;
const GRID_ROWS = 9;
const T_FLY = 0.35;
const T_BOUNCE = 0.3;
const MAX_DELAY = 0.6;

export interface GameOverTile {
  readonly index: number;
  readonly delay: number;
  readonly bounceAmp: number;
  readonly t: number;
}

export interface GameOverState {
  readonly image: HTMLImageElement;
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly GameOverTile[];
}

export interface GameOverLayout {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tileW: number;
  readonly tileH: number;
  readonly srcTileW: number;
  readonly srcTileH: number;
}

export const createGameOverState = (): GameOverState => {
  const image = new Image();
  image.src = IMG_SRC;
  const tiles: readonly GameOverTile[] = Array.from(
    { length: GRID_COLS * GRID_ROWS },
    (_, i): GameOverTile => ({
      index: i,
      delay: Math.random() * MAX_DELAY,
      bounceAmp: 0.12 + Math.random() * 0.18,
      t: 0,
    }),
  );
  return { image, cols: GRID_COLS, rows: GRID_ROWS, tiles };
};

export const imageReady = (s: GameOverState): boolean =>
  s.image.complete && s.image.naturalWidth > 0;

const computeLayout = (s: GameOverState): GameOverLayout => {
  const imgW = s.image.naturalWidth || 990;
  const imgH = s.image.naturalHeight || 919;
  const maxW = VIEW_W - 40;
  const maxH = VIEW_H - 80;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: Math.round((VIEW_W - w) / 2),
    y: Math.round((VIEW_H - h) / 2),
    w,
    h,
    tileW: w / s.cols,
    tileH: h / s.rows,
    srcTileW: imgW / s.cols,
    srcTileH: imgH / s.rows,
  };
};

const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;

const tileScale = (tile: GameOverTile): number => {
  if (tile.t < tile.delay) return 0;
  const e = tile.t - tile.delay;
  if (e < T_FLY) return easeOutCubic(e / T_FLY);
  if (e < T_FLY + T_BOUNCE) {
    const bt = (e - T_FLY) / T_BOUNCE;
    return 1 + tile.bounceAmp * Math.sin(Math.PI * bt);
  }
  return 1;
};

export const allSettled = (s: GameOverState): boolean =>
  s.tiles.every((t) => t.t >= t.delay + T_FLY + T_BOUNCE);

export const updateGameOver = (s: GameOverState, dt: number): GameOverState => ({
  ...s,
  tiles: s.tiles.map((t): GameOverTile => ({ ...t, t: t.t + dt })),
});

export const drawGameOver = (view: CanvasView, s: GameOverState): void => {
  clear(view, PALETTE.void);
  if (!imageReady(s)) return;
  const { ctx } = view;
  ctx.imageSmoothingEnabled = false;
  const layout = computeLayout(s);
  s.tiles.forEach((tile) => {
    const scale = tileScale(tile);
    if (scale <= 0) return;
    const col = tile.index % s.cols;
    const row = Math.floor(tile.index / s.cols);
    const centerX = layout.x + col * layout.tileW + layout.tileW / 2;
    const centerY = layout.y + row * layout.tileH + layout.tileH / 2;
    const dw = layout.tileW * scale;
    const dh = layout.tileH * scale;
    const dx = centerX - dw / 2;
    const dy = centerY - dh / 2;
    ctx.drawImage(
      s.image,
      col * layout.srcTileW,
      row * layout.srcTileH,
      layout.srcTileW,
      layout.srcTileH,
      dx,
      dy,
      dw,
      dh,
    );
  });
  if (allSettled(s)) {
    drawTextCenter(ctx, 'ENTER RETRY  /  ESC MENU', VIEW_W / 2, VIEW_H - 24, PALETTE.hudText, 2);
  }
};
