// Game state for a single play session: the board, the held piece queue, the
// flow simulation, score, phase, and the countdown timer. Transitions produce
// new state records (immutable) so the render layer stays pure. The one bit of
// mutable, side-effecting state lives in main.ts (the RAF loop and audio).

import type { Board, Difficulty, Piece, Phase, Position } from './types.js';
import { createLevel, getCell, place, clampToBoard, neighbor, GRID_SIZE } from './board.js';
import {
  completeHeadCell,
  setHeadFill,
  startFlow,
  type FlowState,
  type StepResult,
} from './flow.js';
import { createRng, type RngState } from './rng.js';
import { drawPiece, rotateCw, rotateCcw } from './pieces.js';

export interface GameState {
  readonly difficulty: Difficulty;
  readonly level: number;
  readonly board: Board;
  readonly cursor: Position;
  readonly currentPiece: Piece;
  readonly nextPiece: Piece;
  readonly rng: RngState;
  readonly phase: Phase;
  readonly countdownRemaining: number; // seconds
  readonly flow: FlowState | null;
  readonly score: number;
  readonly flowCellAccumulator: number; // fractional cell progress
}

const flowSpeed = (difficulty: Difficulty, level: number): number =>
  difficulty.flowCellsPerSecond * (1 + difficulty.speedRampPerLevel * (level - 1));

const drawNext = (rng: RngState): { readonly piece: Piece; readonly rng: RngState } => {
  const step = drawPiece(rng);
  return { piece: step.value, rng: step.rng };
};

export const newGame = (difficulty: Difficulty): GameState => {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  let rng = createRng(seed);
  const board = createLevel(difficulty, 1, rng);
  const startCell = getCell(board, board.start);
  const startNeighbor =
    startCell.sourceDir !== null
      ? (neighbor(board.start, startCell.sourceDir, board.size) ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };
  const first = drawNext(rng);
  rng = first.rng;
  const second = drawNext(rng);
  rng = second.rng;
  return {
    difficulty,
    level: 1,
    board,
    cursor: startNeighbor,
    currentPiece: first.piece,
    nextPiece: second.piece,
    rng,
    phase: 'countdown',
    countdownRemaining: difficulty.countdownSeconds,
    flow: null,
    score: 0,
    flowCellAccumulator: 0,
  };
};

export const nextLevel = (state: GameState): GameState => {
  const level = state.level + 1;
  let rng = state.rng;
  const board = createLevel(state.difficulty, level, rng);
  const startCell = getCell(board, board.start);
  const startNeighbor =
    startCell.sourceDir !== null
      ? (neighbor(board.start, startCell.sourceDir, board.size) ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };
  const first = drawNext(rng);
  rng = first.rng;
  const second = drawNext(rng);
  rng = second.rng;
  return {
    ...state,
    level,
    board,
    cursor: startNeighbor,
    currentPiece: first.piece,
    nextPiece: second.piece,
    rng,
    phase: 'countdown',
    countdownRemaining: state.difficulty.countdownSeconds,
    flow: null,
    flowCellAccumulator: 0,
  };
};

export const moveCursor = (state: GameState, dx: number, dy: number): GameState => ({
  ...state,
  cursor: clampToBoard({ x: state.cursor.x + dx, y: state.cursor.y + dy }, GRID_SIZE),
});

export const rotateHeldCw = (state: GameState): GameState => ({
  ...state,
  currentPiece: rotateCw(state.currentPiece),
});

export const rotateHeldCcw = (state: GameState): GameState => ({
  ...state,
  currentPiece: rotateCcw(state.currentPiece),
});

export type PlaceResult =
  | { readonly status: 'placed'; readonly state: GameState }
  | { readonly status: 'blocked'; readonly state: GameState };

/** Attempt to place the held piece at the cursor. Returns a PlaceResult. */
export const placeHeld = (state: GameState): PlaceResult => {
  if (state.phase === 'won' || state.phase === 'lost') {
    return { status: 'blocked', state };
  }
  const next = place(state.board, state.cursor, state.currentPiece);
  if (next === null) {
    return { status: 'blocked', state };
  }
  const drawn = drawNext(state.rng);
  const flow = state.flow === null ? null : { ...state.flow, board: next };
  return {
    status: 'placed',
    state: {
      ...state,
      board: next,
      flow,
      currentPiece: state.nextPiece,
      nextPiece: drawn.piece,
      rng: drawn.rng,
    },
  };
};

/**
 * Advance the simulation by `dt` seconds. Handles the countdown→flow transition,
 * the gradual fill of the current head cell, and win/loss detection.
 */
export const tick = (state: GameState, dt: number): GameState => {
  if (state.phase === 'won' || state.phase === 'lost') {
    return state;
  }
  if (state.phase === 'countdown') {
    const remaining = state.countdownRemaining - dt;
    if (remaining > 0) {
      return { ...state, countdownRemaining: remaining };
    }
    // Start flowing.
    const flow = startFlow(state.board);
    return { ...state, phase: 'flowing', countdownRemaining: 0, flow, flowCellAccumulator: 0 };
  }
  // flowing — the head cell fills continuously; only when it reaches 1 do we
  // advance to the next cell. The accumulator tracks fractional cell progress.
  if (state.flow === null) {
    return state;
  }
  const speed = flowSpeed(state.difficulty, state.level);
  let acc = state.flowCellAccumulator + speed * dt;
  let flow: FlowState = state.flow;
  let outcome: StepResult['outcome'] = 'flowing';

  // Complete whole cells while the accumulator has >= 1 unit of progress.
  while (acc >= 1 && outcome === 'flowing') {
    const result = completeHeadCell(flow);
    flow = result.state;
    outcome = result.outcome;
    acc -= 1;
  }

  if (outcome === 'flowing') {
    // Apply the remaining fractional fill to the new head cell so the slime
    // creeps visibly across the pipe each frame instead of jumping. Skip cells
    // that are already full (e.g. the start nozzle). For crosses visited a
    // second time on the perpendicular axis, the overall `fill` is already 1
    // from the first pass but the active axis is still 0 — check that axis.
    const headCell = flow.board.cells[flow.head.y * flow.board.size + flow.head.x];
    const isCross = headCell?.piece !== null && headCell.piece.kind === 'cross';
    const isH = flow.entryDir === 'E' || flow.entryDir === 'W';
    const axisFill = isCross ? (isH ? headCell.fillH : headCell.fillV) : (headCell?.fill ?? 0);
    if (axisFill < 1) {
      flow = setHeadFill(flow, Math.min(1, acc));
    }
  }

  const extraScore = flow.score - (state.flow?.score ?? 0);
  if (outcome === 'won') {
    const levelBonus = state.level * 100;
    return {
      ...state,
      flow,
      flowCellAccumulator: acc,
      score: state.score + extraScore + levelBonus,
      phase: 'won',
      board: flow.board,
    };
  }
  if (outcome === 'lost') {
    return {
      ...state,
      flow,
      flowCellAccumulator: acc,
      score: state.score + extraScore,
      phase: 'lost',
      board: flow.board,
    };
  }
  return {
    ...state,
    flow,
    flowCellAccumulator: acc,
    score: state.score + extraScore,
    board: flow.board,
  };
};

/** True if the cursor currently sits on a placeable cell. */
export const cursorPlaceable = (state: GameState): boolean => {
  const cell = getCell(state.board, state.cursor);
  return cell.kind === 'empty' && cell.piece === null && !cell.fixed;
};
