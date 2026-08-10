// Difficulty presets for the Yuckster menu. Names are Doom-ish; numbers tune the
// countdown, flow speed, and fixed-piece ramp. Pure data — selection and
// persistence live in the screen layer.

import type { Difficulty, DifficultyName } from './types.js';

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    name: 'SLUDGE PUPPY',
    countdownSeconds: 15,
    flowCellsPerSecond: 0.3,
    fixedFromLevel: 4,
    fixedMax: 5,
    speedRampPerLevel: 0.03,
  },
  {
    name: 'GOO TROOPER',
    countdownSeconds: 10,
    flowCellsPerSecond: 0.45,
    fixedFromLevel: 2,
    fixedMax: 5,
    speedRampPerLevel: 0.04,
  },
  {
    name: 'ULTRA-OILER',
    countdownSeconds: 7,
    flowCellsPerSecond: 0.65,
    fixedFromLevel: 1,
    fixedMax: 5,
    speedRampPerLevel: 0.06,
  },
  {
    name: 'NIGHTMARE CRUDE',
    countdownSeconds: 5,
    flowCellsPerSecond: 0.9,
    fixedFromLevel: 1,
    fixedMax: 5,
    speedRampPerLevel: 0.08,
  },
];

export const DEFAULT_DIFFICULTY_NAME: DifficultyName = 'GOO TROOPER';

export const findDifficulty = (name: DifficultyName): Difficulty =>
  DIFFICULTIES.find((d) => d.name === name) ?? DIFFICULTIES[1];

/** Number of fixed pre-placed pieces for a level under a difficulty (capped at fixedMax, ≤5). */
export const fixedPieceCount = (difficulty: Difficulty, level: number): number => {
  if (level < difficulty.fixedFromLevel) {
    return 0;
  }
  const ramp = level - difficulty.fixedFromLevel + 1;
  return Math.min(ramp, difficulty.fixedMax, 5);
};
