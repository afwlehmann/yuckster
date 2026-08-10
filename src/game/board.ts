// Board geometry, level generation, and placement rules. Pure and immutable:
// every operation returns a new Board rather than mutating. The 8x8 grid is
// stored as a flat readonly array indexed by y*size + x.

import type { Board, Cell, Difficulty, Direction, Piece, Position } from './types.js';
import { pick, shuffle, type RngState, nextInt } from './rng.js';
import { randomPiece } from './pieces.js';

export const GRID_SIZE = 8;
export const MAX_FIXED_PIECES = 5;

const emptyCell: Cell = {
  kind: 'empty',
  piece: null,
  fixed: false,
  fill: 0,
  entryDir: null,
  sourceDir: null,
};

const cellAt = (board: Board, x: number, y: number): Cell => board.cells[y * board.size + x];

export const getCell = (board: Board, pos: Position): Cell => cellAt(board, pos.x, pos.y);

const replaceCell = (board: Board, index: number, cell: Cell): Board => {
  const cells = [...board.cells];
  cells[index] = cell;
  return { ...board, cells };
};

export const updateCell = (board: Board, pos: Position, patch: Partial<Cell>): Board => {
  const current = cellAt(board, pos.x, pos.y);
  return replaceCell(board, pos.y * board.size + pos.x, { ...current, ...patch });
};

const borderPositions = (size: number): readonly Position[] => {
  const positions: Position[] = [];
  for (let x = 0; x < size; x += 1) {
    positions.push({ x, y: 0 });
    positions.push({ x, y: size - 1 });
  }
  for (let y = 1; y < size - 1; y += 1) {
    positions.push({ x: 0, y });
    positions.push({ x: size - 1, y });
  }
  return positions;
};

/** The inward-facing direction for a border cell (toward the grid interior). */
const inwardDir = (pos: Position, size: number): Direction => {
  if (pos.x === 0) return 'E';
  if (pos.x === size - 1) return 'W';
  if (pos.y === 0) return 'S';
  return 'N';
};

/** Manhattan distance between two positions. */
const manhattan = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const chooseStartEnd = (size: number, rng: RngState) => {
  const borders = borderPositions(size);
  let state = rng;
  const startStep = pick(borders)(state);
  state = startStep.rng;
  const farEnough = borders.filter((p) => manhattan(p, startStep.value) >= size);
  const endPool = farEnough.length > 0 ? farEnough : borders.filter((p) => p !== startStep.value);
  const endStep = pick(endPool)(state);
  state = endStep.rng;
  return { start: startStep.value, end: endStep.value, rng: state };
};

const withStartEnd = (board: Board, start: Position, end: Position): Board => {
  const startDir = inwardDir(start, board.size);
  const endDir = inwardDir(end, board.size);
  let next = updateCell(board, start, {
    kind: 'start',
    sourceDir: startDir,
    fill: 1,
    entryDir: opposite(startDir),
  });
  next = updateCell(next, end, { kind: 'end', sourceDir: endDir });
  return next;
};

/** All grid positions except start and end. */
const interiorPositions = (size: number, start: Position, end: Position): readonly Position[] => {
  const out: Position[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if ((x === start.x && y === start.y) || (x === end.x && y === end.y)) continue;
      out.push({ x, y });
    }
  }
  return out;
};

const placeFixedPieces = (
  board: Board,
  start: Position,
  end: Position,
  count: number,
  rng: RngState,
): { readonly board: Board; readonly rng: RngState } => {
  if (count <= 0) return { board, rng };
  const slots = shuffle(interiorPositions(board.size, start, end))(rng);
  let state = slots.rng;
  let current = board;
  for (let i = 0; i < Math.min(count, slots.value.length); i += 1) {
    const pos = slots.value[i];
    const pieceStep = randomPiece(state);
    state = pieceStep.rng;
    current = updateCell(current, pos, { piece: pieceStep.value, fixed: true });
  }
  return { board: current, rng: state };
};

export const createLevel = (difficulty: Difficulty, level: number, rng: RngState): Board => {
  const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => emptyCell);
  const { start, end, rng: afterSe } = chooseStartEnd(GRID_SIZE, rng);
  const base: Board = { size: GRID_SIZE, cells, start, end };
  const seeded = withStartEnd(base, start, end);
  const fixedCount = Math.min(
    MAX_FIXED_PIECES,
    Math.max(0, level - difficulty.fixedFromLevel + 1),
    difficulty.fixedMax,
  );
  const { board, rng: _afterFixed } = placeFixedPieces(seeded, start, end, fixedCount, afterSe);
  void _afterFixed;
  return board;
};

/** True if the player may place the held piece on this cell (empty, non-fixed, not start/end). */
export const canPlace = (board: Board, pos: Position): boolean => {
  const cell = getCell(board, pos);
  return cell.kind === 'empty' && cell.piece === null && !cell.fixed;
};

/** Place a piece; returns a new board or null if the cell is occupied/locked. */
export const place = (board: Board, pos: Position, piece: Piece): Board | null => {
  if (!canPlace(board, pos)) return null;
  return updateCell(board, pos, { piece, fixed: false });
};

export const opposite = (dir: Direction): Direction => {
  switch (dir) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
  }
};

export const neighbor = (pos: Position, dir: Direction, size: number): Position | null => {
  switch (dir) {
    case 'N':
      return pos.y > 0 ? { x: pos.x, y: pos.y - 1 } : null;
    case 'S':
      return pos.y < size - 1 ? { x: pos.x, y: pos.y + 1 } : null;
    case 'E':
      return pos.x < size - 1 ? { x: pos.x + 1, y: pos.y } : null;
    case 'W':
      return pos.x > 0 ? { x: pos.x - 1, y: pos.y } : null;
  }
};

export const clampToBoard = (pos: Position, size: number): Position => ({
  x: Math.max(0, Math.min(size - 1, pos.x)),
  y: Math.max(0, Math.min(size - 1, pos.y)),
});

// Re-exported for tests that need a deterministic random index.
export const _nextInt = nextInt;
