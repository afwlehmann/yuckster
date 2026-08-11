// A small pixelated rat that wanders the playfield grid, avoiding cells with
// pipes, the start nozzle, and the end drain. If the player places a piece on
// the rat's cell, boing.mp3 plays and the rat dies for 75 bonus points.

import type { Board, Position, Direction } from '../game/types.js';
import { getCell, neighbor, GRID_SIZE } from '../game/board.js';
import { TILE, GRID_X, GRID_Y } from './canvas.js';

export interface Rat {
  readonly x: number;
  readonly y: number;
  readonly dir: Direction;
  readonly t: number;
  readonly alive: boolean;
  readonly pauseTimer: number;
  readonly fromCell: Position;
}

const SPEED = 1.5;
const PICK_TIME = 1.2;
const PAUSE_CHANCE = 0.25;

export const createRat = (board: Board): Rat => {
  const empties: Position[] = [];
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size; x += 1) {
      const c = getCell(board, { x, y });
      if (c.kind === 'empty' && c.piece === null && !c.fixed) {
        empties.push({ x, y });
      }
    }
  }
  const pos = empties[Math.floor(Math.random() * empties.length)] ?? { x: 0, y: 0 };
  const dirs: Direction[] = ['N', 'E', 'S', 'W'];
  return {
    x: pos.x,
    y: pos.y,
    dir: dirs[Math.floor(Math.random() * 4)],
    t: 0,
    alive: true,
    pauseTimer: 0,
    fromCell: pos,
  };
};

const canWalkTo = (board: Board, pos: Position): boolean => {
  if (pos.x < 0 || pos.x >= board.size || pos.y < 0 || pos.y >= board.size) return false;
  const c = getCell(board, pos);
  return c.kind === 'empty' && c.piece === null && !c.fixed;
};

const tryDir = (board: Board, pos: Position, dir: Direction): Position | null => {
  const n = neighbor(pos, dir, board.size);
  if (n !== null && canWalkTo(board, n)) return n;
  return null;
};

export const updateRat = (rat: Rat, dt: number, board: Board): Rat => {
  if (!rat.alive) return rat;

  if (rat.pauseTimer > 0) {
    const pt = rat.pauseTimer - dt;
    if (pt > 0) return { ...rat, pauseTimer: pt };
    return { ...rat, pauseTimer: 0, t: PICK_TIME };
  }

  const t = rat.t + dt;
  const { x, y } = rat;
  let { dir } = rat;

  if (t >= PICK_TIME) {
    const cell: Position = { x: Math.round(x), y: Math.round(y) };
    const dirs: Direction[] = ['N', 'E', 'S', 'W'];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      const n = tryDir(board, cell, d);
      if (n !== null) {
        dir = d;
        break;
      }
    }
    if (Math.random() < PAUSE_CHANCE) {
      return { ...rat, dir, t: 0, pauseTimer: 1 + Math.random() * 1 };
    }
    return { ...rat, dir, t: 0, fromCell: cell };
  }

  const target = tryDir(board, rat.fromCell, dir);
  if (target === null) {
    return { ...rat, x: rat.fromCell.x, y: rat.fromCell.y, t: PICK_TIME };
  }

  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.02) {
    return { ...rat, x: target.x, y: target.y, t: PICK_TIME, fromCell: target };
  }

  const step = SPEED * dt;
  if (step >= dist) {
    return { ...rat, x: target.x, y: target.y, t: 0, fromCell: target };
  }
  return { ...rat, x: x + (dx / dist) * step, y: y + (dy / dist) * step, t };
};

export const ratCell = (rat: Rat): Position => ({
  x: Math.round(rat.x),
  y: Math.round(rat.y),
});

export const killRat = (rat: Rat): Rat => ({ ...rat, alive: false });

const RAT_W = 14;
const RAT_H = 10;

const drawRatSprite = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  dir: Direction,
  t: number,
): void => {
  const ix = Math.round(px);
  const iy = Math.round(py);
  const facingRight = dir === 'E' || dir === 'N';
  const p = (x: number, y: number, w: number, h: number): void => {
    ctx.fillRect(ix + (facingRight ? x : RAT_W - x - w), iy + y, w, h);
  };
  const bob = Math.round(Math.sin(t * 8) * 1);
  // Body (dark brown)
  ctx.fillStyle = '#4a3a28';
  p(3, 3 + bob, 8, 5);
  // Head
  ctx.fillStyle = '#5a4a38';
  p(10, 4 + bob, 4, 4);
  // Ear
  ctx.fillStyle = '#3a2a18';
  p(11, 3 + bob, 2, 2);
  // Eye
  ctx.fillStyle = '#ff3030';
  p(12, 5 + bob, 1, 1);
  // Snout
  ctx.fillStyle = '#4a3a28';
  p(14, 6 + bob, 1, 1);
  // Tail (pink, long)
  ctx.fillStyle = '#aa7a6a';
  const tailWag = Math.round(Math.sin(t * 10) * 2);
  p(0, 5 + bob + tailWag, 3, 1);
  // Legs (animated)
  const legPhase = Math.floor(t * 12) % 2;
  ctx.fillStyle = '#3a2a18';
  p(4, 8 + bob, 2, 1 + (legPhase === 0 ? 1 : 0));
  p(8, 8 + bob, 2, 1 + (legPhase === 1 ? 1 : 0));
};

export const drawRat = (ctx: CanvasRenderingContext2D, rat: Rat): void => {
  if (!rat.alive) return;
  const px = GRID_X + rat.x * TILE + (TILE - RAT_W) / 2;
  const py = GRID_Y + rat.y * TILE + (TILE - RAT_H) / 2;
  drawRatSprite(ctx, px, py, rat.dir, rat.t);
};

void GRID_SIZE;
