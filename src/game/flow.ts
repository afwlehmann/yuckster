// Yuck flow simulation. The flow is modelled as a "head" that occupies one cell
// at a time, entering from a given edge and filling it over time. When the cell
// is full, the head advances to the next cell through the matching exit edge.
// Crossings pass straight through (L↔R / T↔B); straights and elbows turn.
//
// Everything here is pure: stepFlow takes the current FlowState and a dt and
// returns a new FlowState plus an outcome (`flowing | won | lost`).

import type { Board, Cell, Direction, Position } from './types.js';
import { getCell, neighbor, opposite } from './board.js';
import { hasOpening, openings as allOpenings } from './pieces.js';

export type FlowOutcome = 'flowing' | 'won' | 'lost';

export interface FlowState {
  readonly board: Board;
  /** Position of the cell currently being filled. */
  readonly head: Position;
  /** Edge the head entered the current cell from (points back toward source). */
  readonly entryDir: Direction;
  /** Cells fully traversed so far — used for scoring. */
  readonly filledCells: readonly Position[];
  /** Score accumulated during flow. */
  readonly score: number;
}

export interface StepResult {
  readonly state: FlowState;
  readonly outcome: FlowOutcome;
}

const SCORE_PER_CELL = 10;
const SCORE_FIXED_BONUS = 50;

/**
 * Initial flow state: the yuck has fully filled the start cell and is about to
 * advance into its outward neighbor. `entryDir` is set so the start cell's
 * sourceDir counts as the exit.
 */
export const startFlow = (board: Board): FlowState => {
  const start = getCell(board, board.start);
  const sourceDir = start.sourceDir;
  if (sourceDir === null) {
    throw new Error('start cell missing sourceDir');
  }
  return {
    board,
    head: board.start,
    entryDir: opposite(sourceDir),
    filledCells: [board.start],
    score: 0,
  };
};

/** Exit edge of a cell given where the yuck entered from. */
const exitDir = (cell: Cell, from: Direction): Direction | null => {
  if (cell.kind === 'start') {
    // Start cell: exit through its sourceDir (the nozzle direction).
    return cell.sourceDir;
  }
  if (cell.kind === 'end') {
    return null; // drain absorbs the yuck
  }
  const piece = cell.piece;
  if (piece === null) return null;
  if (!hasOpening(piece, from)) return null; // entered through a closed side
  if (piece.kind === 'cross') {
    return opposite(from); // straight-through crossing
  }
  const openings = [from] as readonly Direction[];
  // For straight/elbow there are exactly two openings; exit is the one != from.
  const exit = allOpenings(piece).find((d) => !openings.includes(d));
  return exit ?? null;
};

// Local re-import to keep the module self-contained; openings() is re-exported
// via pieces.ts and used only here.

/**
 * Advance the head one full cell if possible. Returns the new FlowState and
 * outcome. If the head's current cell isn't full yet, this is a no-op.
 */
const advance = (state: FlowState): StepResult => {
  const cell = getCell(state.board, state.head);
  const exit = exitDir(cell, state.entryDir);
  if (exit === null) {
    // End cell reached → win; otherwise a closed side → spill/lose.
    return cell.kind === 'end' ? { state, outcome: 'won' } : { state, outcome: 'lost' };
  }
  const nextPos = neighbor(state.head, exit, state.board.size);
  if (nextPos === null) {
    return { state, outcome: 'lost' };
  }
  const nextCell = getCell(state.board, nextPos);
  const nextEntry = opposite(exit);
  if (nextCell.kind === 'end') {
    // The drain must accept from this side; end.sourceDir is the inward dir.
    if (nextCell.sourceDir !== nextEntry) {
      return { state, outcome: 'lost' };
    }
    const filled = [...state.filledCells, nextPos];
    return {
      state: { ...state, head: nextPos, entryDir: nextEntry, filledCells: filled },
      outcome: 'won',
    };
  }
  if (nextCell.piece === null) {
    return { state, outcome: 'lost' };
  }
  if (!hasOpening(nextCell.piece, nextEntry)) {
    return { state, outcome: 'lost' };
  }
  const bonus = nextCell.fixed ? SCORE_FIXED_BONUS : 0;
  const filled = [...state.filledCells, nextPos];
  return {
    state: {
      ...state,
      head: nextPos,
      entryDir: nextEntry,
      filledCells: filled,
      score: state.score + SCORE_PER_CELL + bonus,
    },
    outcome: 'flowing',
  };
};

/**
 * Step the flow forward by `cellsToAdvance` full cells at once (used by tests
 * and by the renderer's per-cell tick). The live game loop instead fills the
 * current head cell gradually via fillProgress(); this function handles the
 * discrete "a cell just completed" transition.
 */
export const advanceCell = (state: FlowState): StepResult => advance(state);

/** Progress (0..1) of the current head cell's fill, derived from board state. */
export const headFillProgress = (state: FlowState): number => getCell(state.board, state.head).fill;

/**
 * Fill the current head cell to 1, then advance to the next cell. Returns the
 * updated FlowState (with the filled cell baked into the board) and outcome.
 */
export const completeHeadCell = (state: FlowState): StepResult => {
  const filledBoard = {
    ...state.board,
    cells: state.board.cells.map((c, i) =>
      i === state.head.y * state.board.size + state.head.x ? { ...c, fill: 1 } : c,
    ),
  } as Board;
  const updated: FlowState = { ...state, board: filledBoard };
  return advance(updated);
};

/** Set the current head cell's fill to a fractional value (0..1). Pure. */
export const setHeadFill = (state: FlowState, fill: number): FlowState => {
  const filledBoard = {
    ...state.board,
    cells: state.board.cells.map((c, i) =>
      i === state.head.y * state.board.size + state.head.x ? { ...c, fill } : c,
    ),
  } as Board;
  return { ...state, board: filledBoard };
};

/** Score earned so far (used by the HUD). */
export const flowScore = (state: FlowState): number => state.score;
