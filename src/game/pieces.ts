// Pure piece geometry: how openings map to directions under rotation, and
// weighted random piece generation. No mutation anywhere — rotations return
// new Piece records.

import type { Direction, Piece, PieceKind, Rotation } from './types.js';
import { nextFloat, type RngState, type RngNext } from './rng.js';

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

const rotateDirCw = (dir: Direction): Direction => {
  switch (dir) {
    case 'N':
      return 'E';
    case 'E':
      return 'S';
    case 'S':
      return 'W';
    case 'W':
      return 'N';
  }
};

export const rotateCw = (piece: Piece): Piece => ({
  kind: piece.kind,
  rotation: ((piece.rotation + 1) % 4) as Rotation,
});

export const rotateCcw = (piece: Piece): Piece => ({
  kind: piece.kind,
  rotation: ((piece.rotation + 3) % 4) as Rotation,
});

/** Openings for the base (rotation 0) orientation of each kind. */
const baseOpenings = (kind: PieceKind): readonly Direction[] => {
  switch (kind) {
    case 'straight':
      return ['E', 'W'];
    case 'elbow':
      return ['N', 'E'];
    case 'cross':
      return ['N', 'E', 'S', 'W'];
  }
};

export const openings = (piece: Piece): readonly Direction[] => {
  if (piece.kind === 'cross') {
    return baseOpenings('cross');
  }
  let dirs = baseOpenings(piece.kind);
  for (let i = 0; i < piece.rotation; i += 1) {
    dirs = dirs.map(rotateDirCw);
  }
  return dirs;
};

/** True if the piece has an opening on the given side. */
export const hasOpening = (piece: Piece, dir: Direction): boolean => openings(piece).includes(dir);

/** Weighted random piece generation: straight 35 / elbow 40 / cross 15 / (rem 10 → elbow). */
const KIND_WEIGHTS: ReadonlyArray<readonly [PieceKind, number]> = [
  ['straight', 0.35],
  ['elbow', 0.4],
  ['cross', 0.15],
];

const randomKind = (rng: RngState): RngNext<PieceKind> => {
  const { value, rng: next } = nextFloat(rng);
  let acc = 0;
  for (const [kind, weight] of KIND_WEIGHTS) {
    acc += weight;
    if (value < acc) {
      return { value: kind, rng: next };
    }
  }
  return { value: 'elbow', rng: next };
};

const randomRotation = (rng: RngState): RngNext<Rotation> => {
  const stepped = nextFloat(rng);
  const rotation = Math.floor(stepped.value * 4) % 4;
  return { value: rotation as Rotation, rng: stepped.rng };
};

export const randomPiece = (rng: RngState): RngNext<Piece> => {
  const kindStep = randomKind(rng);
  const rotStep = randomRotation(kindStep.rng);
  return { value: { kind: kindStep.value, rotation: rotStep.value }, rng: rotStep.rng };
};

/** An infinite-but-lazily-consumed queue: draws a piece and returns the next Rng. */
export const drawPiece = randomPiece;

export const allRotations = (): readonly Rotation[] => ROTATIONS;
