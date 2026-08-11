// Game-over reveal: the game-over image is split into a grid of quadratic tiles
// that fly in straight from the distance (scaling up in place from a vanishing
// point), randomly bounce a bit closer to the viewer, then settle into the
// plane. Once settled, tiles bump in sync with the bass beats from the
// pre-analyzed game-over MP3. Pure state — update() returns a new state record
// each frame.

import { VIEW_W, VIEW_H, type CanvasView, clear } from './canvas.js';
import { PALETTE } from './palette.js';
import { drawTextCenter } from './font.js';

const BASE = import.meta.env.BASE_URL;
const IMG_SRC = `${BASE}game-over.png`;
const BEATS_SRC = `${BASE}game-over-beats.json`;

const GRID_COLS = 10;
const GRID_ROWS = 9;
const T_FLY = 0.35;
const T_BOUNCE = 0.3;
const MAX_DELAY = 0.6;
const BUMP_AMP = 0.25;
const BUMP_DECAY = 0.4;

export interface GameOverTile {
  readonly index: number;
  readonly delay: number;
  readonly bounceAmp: number;
  readonly t: number;
  readonly bump: number;
}

export interface GameOverState {
  readonly image: HTMLImageElement;
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly GameOverTile[];
  readonly beats: readonly number[];
  readonly beatIndex: number;
  readonly elapsed: number;
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

export const createGameOverState = (beats: readonly number[]): GameOverState => {
  const image = new Image();
  image.src = IMG_SRC;
  const tiles: readonly GameOverTile[] = Array.from(
    { length: GRID_COLS * GRID_ROWS },
    (_, i): GameOverTile => ({
      index: i,
      delay: Math.random() * MAX_DELAY,
      bounceAmp: 0.12 + Math.random() * 0.18,
      t: 0,
      bump: 0,
    }),
  );
  return { image, cols: GRID_COLS, rows: GRID_ROWS, tiles, beats, beatIndex: 0, elapsed: 0 };
};

/** Pre-load bass-beat timestamps from the analyzed JSON file. */
export const loadBeats = async (): Promise<readonly number[]> => {
  try {
    const resp = await fetch(BEATS_SRC);
    return (await resp.json()) as readonly number[];
  } catch {
    return [];
  }
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
  let scale: number;
  if (e < T_FLY) {
    scale = easeOutCubic(e / T_FLY);
  } else if (e < T_FLY + T_BOUNCE) {
    const bt = (e - T_FLY) / T_BOUNCE;
    scale = 1 + tile.bounceAmp * Math.sin(Math.PI * bt);
  } else {
    scale = 1;
  }
  return scale * (1 + tile.bump);
};

export const allSettled = (s: GameOverState): boolean =>
  s.tiles.every((t) => t.t >= t.delay + T_FLY + T_BOUNCE);

export const updateGameOver = (s: GameOverState, dt: number, audioTime: number): GameOverState => {
  const elapsed = audioTime > 0 ? audioTime : s.elapsed + dt;
  let beatIndex = s.beatIndex;
  let bumpTriggered = false;
  while (beatIndex < s.beats.length && s.beats[beatIndex] <= elapsed) {
    beatIndex += 1;
    bumpTriggered = true;
  }
  const tiles = s.tiles.map((t): GameOverTile => {
    const settled = t.t >= t.delay + T_FLY + T_BOUNCE;
    const newBump = bumpTriggered && settled ? BUMP_AMP : t.bump;
    return {
      ...t,
      t: t.t + dt,
      bump: Math.max(0, newBump - (dt / BUMP_DECAY) * BUMP_AMP),
    };
  });
  return { ...s, tiles, beatIndex, elapsed };
};

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
