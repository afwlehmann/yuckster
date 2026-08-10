// Board renderer: composites gravel ground, placed pipes, yuck fill, the start
// nozzle and end drain, and the placement cursor with a ghost preview of the
// held piece. Pure draw function — no game state mutation.

import type { Board, Piece, Position } from '../game/types.js';
import { getCell } from '../game/board.js';
import { GRID_SIZE, GRID_PX, GRID_X, GRID_Y, TILE, type CanvasView, blit } from './canvas.js';
import {
  buildSprites,
  endSprite,
  gravelSprite,
  pipeSpriteFor,
  startSprite,
  yuckSpriteFor,
  type SpriteStore,
} from './sprites.js';
import { PALETTE } from './palette.js';

export type { SpriteStore };

export interface Cursor {
  readonly pos: Position;
  readonly held: Piece;
  readonly blink: number;
}

export const createSpriteStore = (): SpriteStore => buildSprites();

const drawGround = (view: CanvasView, store: SpriteStore, board: Board): void => {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const idx = y * GRID_SIZE + x;
      blit(view, gravelSprite(store, idx), GRID_X + x * TILE, GRID_Y + y * TILE);
      void board;
    }
  }
  // Grid seams
  const { ctx } = view;
  ctx.fillStyle = PALETTE.mudDark;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    ctx.fillRect(GRID_X + i * TILE, GRID_Y, 1, GRID_PX);
    ctx.fillRect(GRID_X, GRID_Y + i * TILE, GRID_PX, 1);
  }
};

const drawCell = (
  view: CanvasView,
  store: SpriteStore,
  board: Board,
  x: number,
  y: number,
): void => {
  const pos: Position = { x, y };
  const cell = getCell(board, pos);
  const px = GRID_X + x * TILE;
  const py = GRID_Y + y * TILE;
  if (cell.kind === 'start' && cell.sourceDir !== null) {
    blit(view, startSprite(store, cell.sourceDir), px, py);
    return;
  }
  if (cell.kind === 'end' && cell.sourceDir !== null) {
    blit(view, endSprite(store, cell.sourceDir), px, py);
    return;
  }
  if (cell.piece !== null) {
    blit(view, pipeSpriteFor(store, cell.piece), px, py);
    if (cell.fill > 0) {
      // Clip the yuck sprite so it appears to flow from entry to exit edge.
      // fill=0 → nothing visible, fill=1 → full sprite.
      const fill = Math.min(1, cell.fill);
      const dir = cell.entryDir;
      view.ctx.save();
      view.ctx.beginPath();
      if (dir !== null && cell.piece.kind !== 'cross') {
        // For straight/elbow: clip from entry edge growing toward exit.
        switch (dir) {
          case 'N':
            // Enters from top, flows down — reveal from top.
            view.ctx.rect(px, py, TILE, TILE * fill);
            break;
          case 'S':
            view.ctx.rect(px, py + TILE * (1 - fill), TILE, TILE * fill);
            break;
          case 'E':
            view.ctx.rect(px + TILE * (1 - fill), py, TILE * fill, TILE);
            break;
          case 'W':
            view.ctx.rect(px, py, TILE * fill, TILE);
            break;
        }
      } else {
        // For cross or unknown: just reveal from center outward (square).
        const half = (1 - fill) / 2;
        view.ctx.rect(px + TILE * half, py + TILE * half, TILE * fill, TILE * fill);
      }
      view.ctx.clip();
      blit(view, yuckSpriteFor(store, cell.piece), px, py);
      view.ctx.restore();
    }
  }
};

const drawCursor = (
  view: CanvasView,
  store: SpriteStore,
  cursor: Cursor,
  canPlaceHere: boolean,
): void => {
  const { ctx } = view;
  const px = GRID_X + cursor.pos.x * TILE;
  const py = GRID_Y + cursor.pos.y * TILE;
  // Ghost piece (semi-transparent)
  ctx.globalAlpha = 0.5;
  blit(view, pipeSpriteFor(store, cursor.held), px, py);
  ctx.globalAlpha = 1;
  // Blinking cursor outline
  const on = Math.floor(cursor.blink * 4) % 2 === 0;
  if (on) {
    ctx.strokeStyle = canPlaceHere ? PALETTE.cursor : PALETTE.hudDanger;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  }
};

export const drawBoard = (
  view: CanvasView,
  store: SpriteStore,
  board: Board,
  cursor: Cursor | null,
): void => {
  drawGround(view, store, board);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawCell(view, store, board, x, y);
    }
  }
  if (cursor !== null) {
    const cell = getCell(board, cursor.pos);
    const placeable = cell.kind === 'empty' && cell.piece === null && !cell.fixed;
    drawCursor(view, store, cursor, placeable);
  }
};

export const gridOrigin = (): readonly [number, number] => [GRID_X, GRID_Y];
