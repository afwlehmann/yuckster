// Top HUD bar: score, level, countdown, difficulty name, and the current/next
// piece previews. Pure draw — reads game state, writes pixels.

import type { Difficulty, Piece } from '../game/types.js';
import { HUD_H, VIEW_W, type CanvasView, blit } from './canvas.js';
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

export const drawHud = (view: CanvasView, store: SpriteStore, hud: HudState): void => {
  const { ctx } = view;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  // Score
  drawText(ctx, `SCORE ${pad(hud.score, 6)}`, 4, 4, PALETTE.hudText, 1);
  // Level (right of score)
  drawText(ctx, `LV ${pad(hud.level, 2)}`, 86, 4, PALETTE.hudTextDim, 1);
  // Difficulty (center)
  const diff = hud.difficulty.name;
  drawText(ctx, diff, VIEW_W / 2 - textWidth(diff) / 2, 4, PALETTE.hudAccent, 1);
  // Countdown or FLOWING
  if (hud.flowing) {
    drawText(ctx, 'FLOW', VIEW_W - 60, 4, PALETTE.yuck, 1);
  } else {
    const secs = Math.max(0, Math.ceil(hud.countdownSeconds));
    const color = secs <= 3 ? PALETTE.hudDanger : secs <= 5 ? PALETTE.hudWarn : PALETTE.hudText;
    drawTextRight(ctx, `${secs}s`, VIEW_W - 4, 4, color, 1);
  }
  // Piece previews on the second row
  drawText(ctx, 'NOW', 4, 15, PALETTE.hudTextDim, 1);
  blit(view, pipeSpriteFor(store, hud.currentPiece), 28, 13);
  drawText(ctx, 'NEXT', 50, 15, PALETTE.hudTextDim, 1);
  blit(view, pipeSpriteFor(store, hud.nextPiece), 80, 13);
};
