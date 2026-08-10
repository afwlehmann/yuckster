// Canvas setup: owns the 2D context, the logical resolution, and the
// integer-scaled presentation to the CSS viewport. `image-rendering: pixelated`
// (set in index.html) keeps the upscale crisp.

export const VIEW_W = 256;
export const VIEW_H = 224;
export const HUD_H = 24;
export const GRID_SIZE = 8;
export const TILE = 24;
export const GRID_PX = GRID_SIZE * TILE;
export const GRID_X = (VIEW_W - GRID_PX) / 2;
export const GRID_Y = HUD_H + 4;

export interface CanvasView {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

const acquire = (): CanvasView => {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('canvas#game not found');
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx === null) {
    throw new Error('2D context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
};

export const createCanvasView = (): CanvasView => acquire();

/** Clear the whole logical viewport to a solid backdrop color. */
export const clear = (view: CanvasView, color: string): void => {
  const { ctx } = view;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
};

/** Pixel-perfect blit of a sprite canvas at integer coordinates. */
export const blit = (
  view: CanvasView,
  src: CanvasImageSource,
  dx: number,
  dy: number,
  dw?: number,
  dh?: number,
): void => {
  if (dw !== undefined && dh !== undefined) {
    view.ctx.drawImage(src, dx, dy, dw, dh);
  } else {
    view.ctx.drawImage(src, dx, dy);
  }
};

/** Make an offscreen canvas of the given pixel size. */
export const makeSprite = (
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (ctx === null) {
    throw new Error('2D context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
};
