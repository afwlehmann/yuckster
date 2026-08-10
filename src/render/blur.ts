// Pause blur effect: downscale the last game frame to 1/8 with smoothing, then
// upscale it back, and lay a dark veil + scanlines on top. Gives the frozen
// game a soft, out-of-focus CRT feel.

import { makeSprite, type CanvasView, VIEW_W, VIEW_H } from './canvas.js';
import { PALETTE } from './palette.js';

const SCALE = 1 / 16;

export const drawBlurredFrame = (view: CanvasView, source: HTMLCanvasElement): void => {
  const { ctx } = view;
  const small = makeSprite(
    Math.max(1, Math.round(VIEW_W * SCALE)),
    Math.max(1, Math.round(VIEW_H * SCALE)),
  );
  small.ctx.imageSmoothingEnabled = true;
  small.ctx.drawImage(source, 0, 0, small.canvas.width, small.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small.canvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;
  // Dark veil
  ctx.fillStyle = 'rgba(8,12,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Scanlines
  ctx.fillStyle = PALETTE.void;
  for (let y = 0; y < VIEW_H; y += 2) {
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, y, VIEW_W, 1);
  }
  ctx.globalAlpha = 1;
  // Vignette
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, VIEW_W, 4);
  ctx.fillRect(0, VIEW_H - 4, VIEW_W, 4);
  ctx.fillRect(0, 0, 4, VIEW_H);
  ctx.fillRect(VIEW_W - 4, 0, 4, VIEW_H);
};
