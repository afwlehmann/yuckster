import { describe, it, expect } from 'vitest';
import type { Piece } from './types.js';
import { rotateCw, rotateCcw, openings, hasOpening, randomPiece } from './pieces.js';
import { createRng, nextInt, shuffle, pick, nextFloat } from './rng.js';

const sorted = <T>(xs: readonly T[]): readonly T[] => [...xs].sort();

describe('pieces', () => {
  describe('rotateCw / rotateCcw', () => {
    it('rotates clockwise four times back to rotation 0', () => {
      const start = { kind: 'elbow' as const, rotation: 0 as const };
      const after4 = rotateCw(rotateCw(rotateCw(rotateCw(start))));
      expect(after4).toEqual(start);
    });

    it('rotates counter-clockwise once is equivalent to three clockwise', () => {
      const piece = { kind: 'straight' as const, rotation: 1 as const };
      expect(rotateCcw(piece)).toEqual({ kind: 'straight', rotation: 0 });
    });

    it('keeps the kind unchanged', () => {
      const piece = { kind: 'cross' as const, rotation: 2 as const };
      expect(rotateCw(piece).kind).toBe('cross');
      expect(rotateCcw(piece).kind).toBe('cross');
    });
  });

  describe('openings', () => {
    it('straight at rotation 0 opens east and west', () => {
      const piece = { kind: 'straight' as const, rotation: 0 as const };
      expect(sorted(openings(piece))).toEqual(['E', 'W']);
    });

    it('straight at rotation 1 opens north and south', () => {
      const piece = { kind: 'straight' as const, rotation: 1 as const };
      expect(sorted(openings(piece))).toEqual(['N', 'S']);
    });

    it('elbow at rotation 0 opens north and east', () => {
      const piece = { kind: 'elbow' as const, rotation: 0 as const };
      expect(sorted(openings(piece))).toEqual(['E', 'N']);
    });

    it('elbow at rotation 1 opens east and south', () => {
      const piece = { kind: 'elbow' as const, rotation: 1 as const };
      expect(sorted(openings(piece))).toEqual(['E', 'S']);
    });

    it('cross always opens all four sides regardless of rotation', () => {
      const rotations = [0, 1, 2, 3] as const;
      rotations.forEach((r) => {
        const piece = { kind: 'cross' as const, rotation: r };
        expect(sorted(openings(piece))).toEqual(['E', 'N', 'S', 'W']);
      });
    });
  });

  describe('hasOpening', () => {
    it('reflects openings()', () => {
      const piece = { kind: 'elbow' as const, rotation: 0 as const };
      expect(hasOpening(piece, 'N')).toBe(true);
      expect(hasOpening(piece, 'E')).toBe(true);
      expect(hasOpening(piece, 'S')).toBe(false);
      expect(hasOpening(piece, 'W')).toBe(false);
    });
  });

  describe('randomPiece', () => {
    it('produces valid kinds and rotations', () => {
      const rng = createRng(42);
      const kinds = new Set<Piece['kind']>();
      const rotations = new Set<Piece['rotation']>();
      let state = rng;
      for (let i = 0; i < 100; i += 1) {
        const step = randomPiece(state);
        state = step.rng;
        kinds.add(step.value.kind);
        rotations.add(step.value.rotation);
      }
      expect(kinds.size).toBe(3);
      expect(rotations.size).toBe(4);
    });

    it('is deterministic for a fixed seed', () => {
      const a = randomPiece(createRng(7));
      const b = randomPiece(createRng(7));
      expect(a.value).toEqual(b.value);
    });
  });
});

describe('rng', () => {
  it('nextFloat produces values in [0,1)', () => {
    const rng = createRng(1);
    let state = rng;
    for (let i = 0; i < 1000; i += 1) {
      const step = nextFloat(state);
      state = step.rng;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(1);
    }
  });

  it('nextInt(max) is bounded by max', () => {
    const rng = createRng(99);
    let state = rng;
    for (let i = 0; i < 500; i += 1) {
      const step = nextInt(8)(state);
      state = step.rng;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(8);
    }
  });

  it('pick returns a member of the array', () => {
    const items = ['a', 'b', 'c'] as const;
    const step = pick(items)(createRng(3));
    expect(items).toContain(step.value);
  });

  it('shuffle returns all elements once', () => {
    const items = [1, 2, 3, 4, 5];
    const step = shuffle(items)(createRng(5));
    expect(step.value.slice().sort()).toEqual(items);
    expect(step.value).not.toBe(items);
  });

  it('is deterministic for a fixed seed', () => {
    const a = nextFloat(createRng(123));
    const b = nextFloat(createRng(123));
    expect(a.value).toBe(b.value);
  });
});
