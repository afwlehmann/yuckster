// Top HUD bar: score, level, countdown, difficulty name, and the current/next
// piece previews. Pure draw — reads game state, writes pixels. At 640x480 the
// HUD is 48px tall with scale-2 text; piece previews are drawn at 1/2 scale
// (28px) so they fit the bar.

import type { Difficulty, Piece } from '../game/types.js';
import { HUD_H, VIEW_W, type CanvasView } from './canvas.js';
import { pipeSpriteFor, type SpriteStore } from './sprites.js';
import { PALETTE } from './palette.js';
import { drawText, drawTextRight, textWidth } from './font.js';

export interface HudState {
  readonly score: number;
  readonly level: number;
  readonly countdownSeconds: number; // whole seconds remaining, 0 once flowing
  readonly flowing: boolean;
  readonly difficulty: Difficulty;
  readonly currentPiece: Piece;
  readonly nextPiece: Piece;
}

const pad = (n: number, len: number): string => n.toString().padStart(len, '0');
const PREVIEW = 24; // piece preview sprite size (downscaled from 56)

export const drawHud = (view: CanvasView, store: SpriteStore, hud: HudState): void => {
  const { ctx } = view;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  // Row 1: score (left), difficulty (center), countdown (right) — scale 2
  drawText(ctx, `SCORE ${pad(hud.score, 6)}`, 8, 6, PALETTE.hudText, 2);
  const diff = hud.difficulty.name;
  drawText(ctx, diff, VIEW_W / 2 - textWidth(diff, 2) / 2, 6, PALETTE.hudAccent, 2);
  if (hud.flowing) {
    drawText(ctx, 'FLOW', VIEW_W - 72, 6, PALETTE.yuck, 2);
  } else {
    const secs = Math.max(0, Math.ceil(hud.countdownSeconds));
    const color = secs <= 3 ? PALETTE.hudDanger : secs <= 5 ? PALETTE.hudWarn : PALETTE.hudText;
    drawTextRight(ctx, `${secs}s`, VIEW_W - 8, 6, color, 2);
  }
  // Row 2: level + piece previews — scale 1, fits in the lower half of the bar
  drawText(ctx, `LV ${pad(hud.level, 2)}`, 8, 30, PALETTE.hudTextDim, 1);
  drawText(ctx, 'NOW', 120, 30, PALETTE.hudTextDim, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pipeSpriteFor(store, hud.currentPiece), 152, 24, PREVIEW, PREVIEW);
  drawText(ctx, 'NEXT', 188, 30, PALETTE.hudTextDim, 1);
  ctx.drawImage(pipeSpriteFor(store, hud.nextPiece), 232, 24, PREVIEW, PREVIEW);
};
