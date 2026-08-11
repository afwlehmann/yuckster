// Board renderer: composites gravel ground, placed pipes, yuck fill, the start
// nozzle and end drain, and the placement cursor with a ghost preview of the
// held piece. Pure draw function — no game state mutation.

import type { Board, Piece, Position, Direction } from '../game/types.js';
import { getCell } from '../game/board.js';
import { GRID_SIZE, GRID_PX, GRID_X, GRID_Y, TILE, type CanvasView, blit } from './canvas.js';
import {
  buildSprites,
  endSprite,
  gravelSprite,
  pipeSpriteFor,
  startSprite,
  yuckSpriteFor,
  yuckEndSprite,
  CHANNEL_HALF,
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
    if (cell.fill > 0) {
      blit(view, yuckEndSprite(store, cell.sourceDir), px, py);
    }
    blit(view, endSprite(store, cell.sourceDir), px, py);
    return;
  }
  if (cell.piece !== null) {
    blit(view, pipeSpriteFor(store, cell.piece), px, py);
    if (cell.fill > 0) {
      const fill = Math.min(1, cell.fill);
      const dir = cell.entryDir;
      const piece = cell.piece;
      if (piece.kind === 'cross') {
        const hDone = cell.fillH >= 1;
        const vDone = cell.fillV >= 1;
        if (hDone && vDone) {
          blit(view, store.yuckCrossBoth, px, py);
        } else if (cell.fillH > 0 && cell.fillV > 0) {
          if (hDone) {
            blit(view, store.yuckCrossH, px, py);
          } else {
            blit(view, store.yuckCrossV, px, py);
          }
          const activeH = !hDone;
          const f = activeH ? cell.fillH : cell.fillV;
          view.ctx.save();
          view.ctx.beginPath();
          if (activeH) {
            if (dir === 'W') {
              view.ctx.rect(px, py + TILE / 2 - CHANNEL_HALF, TILE * f, CHANNEL_HALF * 2);
            } else {
              view.ctx.rect(
                px + TILE * (1 - f),
                py + TILE / 2 - CHANNEL_HALF,
                TILE * f,
                CHANNEL_HALF * 2,
              );
            }
          } else {
            if (dir === 'N') {
              view.ctx.rect(px + TILE / 2 - CHANNEL_HALF, py, CHANNEL_HALF * 2, TILE * f);
            } else {
              view.ctx.rect(
                px + TILE / 2 - CHANNEL_HALF,
                py + TILE * (1 - f),
                CHANNEL_HALF * 2,
                TILE * f,
              );
            }
          }
          view.ctx.clip();
          blit(view, activeH ? store.yuckCrossH : store.yuckCrossV, px, py);
          view.ctx.restore();
        } else if (cell.fillH > 0) {
          if (hDone) {
            blit(view, store.yuckCrossH, px, py);
          } else {
            view.ctx.save();
            view.ctx.beginPath();
            const hfill = cell.fillH;
            if (dir === 'W') {
              view.ctx.rect(px, py + TILE / 2 - CHANNEL_HALF, TILE * hfill, CHANNEL_HALF * 2);
            } else {
              view.ctx.rect(
                px + TILE * (1 - hfill),
                py + TILE / 2 - CHANNEL_HALF,
                TILE * hfill,
                CHANNEL_HALF * 2,
              );
            }
            view.ctx.clip();
            blit(view, store.yuckCrossH, px, py);
            view.ctx.restore();
          }
        } else if (cell.fillV > 0) {
          if (vDone) {
            blit(view, store.yuckCrossV, px, py);
          } else {
            view.ctx.save();
            view.ctx.beginPath();
            const vfill = cell.fillV;
            if (dir === 'N') {
              view.ctx.rect(px + TILE / 2 - CHANNEL_HALF, py, CHANNEL_HALF * 2, TILE * vfill);
            } else {
              view.ctx.rect(
                px + TILE / 2 - CHANNEL_HALF,
                py + TILE * (1 - vfill),
                CHANNEL_HALF * 2,
                TILE * vfill,
              );
            }
            view.ctx.clip();
            blit(view, store.yuckCrossV, px, py);
            view.ctx.restore();
          }
        }
      } else if (fill >= 1) {
        blit(view, yuckSpriteFor(store, piece), px, py);
      } else if (dir !== null) {
        view.ctx.save();
        view.ctx.beginPath();
        if (piece.kind === 'elbow') {
          const HALF = TILE / 2;
          const CH = CHANNEL_HALF;
          const bigR = HALF + CH;
          const pairs: readonly (readonly [
            Direction,
            Direction,
            readonly [number, number],
            number,
            number,
          ])[] = [
            ['N', 'E', [TILE, 0], Math.PI, Math.PI / 2],
            ['E', 'S', [TILE, TILE], -Math.PI / 2, Math.PI],
            ['S', 'W', [0, TILE], 0, -Math.PI / 2],
            ['W', 'N', [0, 0], Math.PI / 2, 0],
          ];
          const info = pairs[piece.rotation % 4];
          const [cx, cy] = info[2];
          const angA = info[3];
          const angB = info[4];
          const entryAtA = dir === info[0];
          const sweep = (Math.PI / 2) * fill;
          const acx = px + cx;
          const acy = py + cy;
          view.ctx.moveTo(acx, acy);
          if (entryAtA) {
            view.ctx.arc(acx, acy, bigR, angA - sweep, angA, false);
          } else {
            view.ctx.arc(acx, acy, bigR, angB, angB + sweep, false);
          }
          view.ctx.closePath();
        } else {
          switch (dir) {
            case 'N':
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
        }
        view.ctx.clip();
        blit(view, yuckSpriteFor(store, piece), px, py);
        view.ctx.restore();
      }
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
