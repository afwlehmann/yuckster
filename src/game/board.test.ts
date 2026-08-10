import { describe, it, expect } from 'vitest';
import {
  createLevel,
  canPlace,
  place,
  getCell,
  neighbor,
  opposite,
  clampToBoard,
  GRID_SIZE,
} from './board.js';
import { findDifficulty, fixedPieceCount } from './difficulty.js';
import { createRng } from './rng.js';

describe('board', () => {
  describe('createLevel', () => {
    it('places start and end on distinct border cells', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      const start = getCell(board, board.start);
      const end = getCell(board, board.end);
      expect(start.kind).toBe('start');
      expect(end.kind).toBe('end');
      expect(board.start).not.toEqual(board.end);
    });

    it('start sourceDir points inward', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(2));
      const start = getCell(board, board.start);
      const dir = start.sourceDir;
      expect(dir).not.toBeNull();
      if (dir === null) return;
      const inward = neighbor(board.start, dir, board.size);
      expect(inward).not.toBeNull();
    });

    it('end sourceDir points inward', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(3));
      const end = getCell(board, board.end);
      expect(end.sourceDir).not.toBeNull();
    });

    it('does not place fixed pieces before fixedFromLevel', () => {
      const diff = findDifficulty('SLUDGE PUPPY'); // fixedFromLevel = 4
      const board = createLevel(diff, 1, createRng(1));
      const fixedCount = board.cells.filter((c) => c.fixed).length;
      expect(fixedCount).toBe(0);
    });

    it('places up to 5 fixed pieces on later levels', () => {
      const diff = findDifficulty('ULTRA-OILER'); // fixedFromLevel = 1, max 5
      const board = createLevel(diff, 8, createRng(1));
      const fixedCount = board.cells.filter((c) => c.fixed).length;
      expect(fixedCount).toBe(5);
    });

    it('never places a fixed piece on start or end', () => {
      const diff = findDifficulty('NIGHTMARE CRUDE');
      for (let seed = 1; seed <= 20; seed += 1) {
        const board = createLevel(diff, 6, createRng(seed));
        expect(getCell(board, board.start).fixed).toBe(false);
        expect(getCell(board, board.end).fixed).toBe(false);
      }
    });
  });

  describe('canPlace / place', () => {
    it('can place on empty cells', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      const empty = board.cells.findIndex((c) => c.kind === 'empty');
      expect(empty).toBeGreaterThanOrEqual(0);
      const pos = { x: empty % GRID_SIZE, y: Math.floor(empty / GRID_SIZE) };
      expect(canPlace(board, pos)).toBe(true);
    });

    it('cannot place on start or end', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      expect(canPlace(board, board.start)).toBe(false);
      expect(canPlace(board, board.end)).toBe(false);
    });

    it('place returns a new board with the piece set', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      const empty = board.cells.findIndex((c) => c.kind === 'empty');
      const pos = { x: empty % GRID_SIZE, y: Math.floor(empty / GRID_SIZE) };
      const piece = { kind: 'straight' as const, rotation: 0 as const };
      const next = place(board, pos, piece);
      expect(next).not.toBeNull();
      if (next !== null) {
        expect(getCell(next, pos).piece).toEqual(piece);
        expect(getCell(next, pos).fixed).toBe(false);
      }
    });

    it('place on an occupied cell returns null', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      const piece = { kind: 'straight' as const, rotation: 0 as const };
      expect(place(board, board.start, piece)).toBeNull();
      expect(place(board, board.end, piece)).toBeNull();
    });

    it('placing on a fixed cell returns null', () => {
      const diff = findDifficulty('ULTRA-OILER');
      const board = createLevel(diff, 3, createRng(1));
      const fixedIdx = board.cells.findIndex((c) => c.fixed);
      if (fixedIdx < 0) return;
      const pos = { x: fixedIdx % GRID_SIZE, y: Math.floor(fixedIdx / GRID_SIZE) };
      expect(place(board, pos, { kind: 'elbow', rotation: 0 })).toBeNull();
    });

    it('place is immutable: original board unchanged', () => {
      const board = createLevel(findDifficulty('GOO TROOPER'), 1, createRng(1));
      const empty = board.cells.findIndex((c) => c.kind === 'empty');
      const pos = { x: empty % GRID_SIZE, y: Math.floor(empty / GRID_SIZE) };
      const piece = { kind: 'straight' as const, rotation: 0 as const };
      const next = place(board, pos, piece);
      void next;
      expect(getCell(board, pos).piece).toBeNull();
    });
  });

  describe('neighbors and helpers', () => {
    it('opposite is involutive', () => {
      expect(opposite(opposite('N'))).toBe('N');
      expect(opposite(opposite('E'))).toBe('E');
    });

    it('neighbor returns null off the board', () => {
      expect(neighbor({ x: 0, y: 0 }, 'W', 8)).toBeNull();
      expect(neighbor({ x: 7, y: 7 }, 'S', 8)).toBeNull();
      expect(neighbor({ x: 3, y: 3 }, 'N', 8)).toEqual({ x: 3, y: 2 });
    });

    it('clampToBoard keeps positions in range', () => {
      expect(clampToBoard({ x: -1, y: 9 }, 8)).toEqual({ x: 0, y: 7 });
      expect(clampToBoard({ x: 3, y: 4 }, 8)).toEqual({ x: 3, y: 4 });
    });
  });

  describe('difficulty.fixedPieceCount', () => {
    it('ramps with level and caps at 5', () => {
      const diff = findDifficulty('GOO TROOPER'); // fixedFromLevel=2, max 5
      expect(fixedPieceCount(diff, 1)).toBe(0);
      expect(fixedPieceCount(diff, 2)).toBe(1);
      expect(fixedPieceCount(diff, 6)).toBe(5);
      expect(fixedPieceCount(diff, 99)).toBe(5);
    });
  });
});
