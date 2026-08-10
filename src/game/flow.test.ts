import { describe, it, expect } from 'vitest';
import { startFlow, completeHeadCell, type FlowState } from './flow.js';
import { createLevel, getCell, place, updateCell } from './board.js';
import { findDifficulty } from './difficulty.js';
import { createRng } from './rng.js';
import type { Board, Piece } from './types.js';

// Build a board where the start is on the left edge and the end is directly to
// its right, connected by a single horizontal straight piece between them is
// impossible (only one cell between border cells on an 8x8). Instead we craft a
// minimal board by hand: a 1-row corridor from start to end.
const horizontalCorridor = (): Board => {
  // Start at (0,0) facing east; end at (7,0) facing west. Cells (1..6,0) get
  // horizontal straight pieces. This guarantees a complete path.
  const rng = createRng(1);
  const board = createLevel(findDifficulty('GOO TROOPER'), 1, rng);
  // Reset to a clean corridor: clear all pieces, set start/end on the top row.
  const cells = board.cells.map(() => ({
    kind: 'empty' as const,
    piece: null,
    fixed: false,
    fill: 0,
    entryDir: null,
    sourceDir: null,
  }));
  let corridor: Board = { ...board, cells, start: { x: 0, y: 0 }, end: { x: 7, y: 0 } };
  corridor = updateCell(
    corridor,
    { x: 0, y: 0 },
    {
      kind: 'start',
      sourceDir: 'E',
      fill: 1,
      entryDir: 'W',
    },
  );
  corridor = updateCell(corridor, { x: 7, y: 0 }, { kind: 'end', sourceDir: 'W' });
  const straight: Piece = { kind: 'straight', rotation: 0 };
  for (let x = 1; x <= 6; x += 1) {
    corridor = place(corridor, { x, y: 0 }, straight) ?? corridor;
  }
  return corridor;
};

describe('flow', () => {
  it('startFlow seeds the head at the start cell', () => {
    const board = horizontalCorridor();
    const state = startFlow(board);
    expect(state.head).toEqual({ x: 0, y: 0 });
    expect(state.filledCells).toHaveLength(1);
  });

  it('flows along a complete horizontal corridor and wins', () => {
    const board = horizontalCorridor();
    let state: FlowState = startFlow(board);
    let outcome = 'flowing';
    let steps = 0;
    do {
      const result = completeHeadCell(state);
      state = result.state;
      outcome = result.outcome;
      steps += 1;
    } while (outcome === 'flowing' && steps < 20);
    expect(outcome).toBe('won');
    expect(getCell(state.board, { x: 7, y: 0 }).fill).toBe(1); // end cell fills on win
  });

  it('loses when the yuck hits a dead end', () => {
    const board = horizontalCorridor();
    // Remove the piece at (6,0) so the corridor breaks before the end.
    const broken = {
      ...board,
      cells: board.cells.map((c, i) => (i === 6 ? { ...c, piece: null } : c)),
    } as Board;
    let state: FlowState = startFlow(broken);
    let outcome = 'flowing';
    let steps = 0;
    do {
      const result = completeHeadCell(state);
      state = result.state;
      outcome = result.outcome;
      steps += 1;
    } while (outcome === 'flowing' && steps < 20);
    expect(outcome).toBe('lost');
  });

  it('loses when exiting toward a neighbor with no matching opening', () => {
    const board = horizontalCorridor();
    // Rotate the piece at (1,0) to vertical so the yuck entering from the west
    // finds a closed side.
    const blocked = {
      ...board,
      cells: board.cells.map((c, i) =>
        i === 1 ? { ...c, piece: { kind: 'straight', rotation: 1 } } : c,
      ),
    } as Board;
    const state: FlowState = startFlow(blocked);
    const result = completeHeadCell(state);
    expect(result.outcome).toBe('lost');
  });

  it('awards bonus score for traversing a fixed piece', () => {
    const board = horizontalCorridor();
    // Make (3,0) a fixed piece — the corridor piece is already there; mark fixed.
    const fixed = {
      ...board,
      cells: board.cells.map((c, i) => (i === 3 ? { ...c, fixed: true } : c)),
    } as Board;
    let state: FlowState = startFlow(fixed);
    let steps = 0;
    let outcome = 'flowing';
    while (outcome === 'flowing' && steps < 20) {
      const r = completeHeadCell(state);
      state = r.state;
      outcome = r.outcome;
      steps += 1;
    }
    // 6 straight cells (10 each) + 1 fixed bonus (50) = 110.
    expect(state.score).toBe(110);
  });

  it('handles a crossing as straight-through', () => {
    const board = horizontalCorridor();
    // Replace (3,0) with a cross; the yuck should pass straight E→W.
    const crossed = {
      ...board,
      cells: board.cells.map((c, i) =>
        i === 3 ? { ...c, piece: { kind: 'cross', rotation: 0 } } : c,
      ),
    } as Board;
    let state: FlowState = startFlow(crossed);
    let outcome = 'flowing';
    let steps = 0;
    while (outcome === 'flowing' && steps < 20) {
      const r = completeHeadCell(state);
      state = r.state;
      outcome = r.outcome;
      steps += 1;
    }
    expect(outcome).toBe('won');
  });
});
