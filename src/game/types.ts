// Core domain types for the Yuckster pipe puzzle. All types are immutable records;
// state transitions produce new values rather than mutating in place (see board.ts/flow.ts).

export type Direction = 'N' | 'E' | 'S' | 'W';

export type PieceKind = 'straight' | 'elbow' | 'cross';

export type Rotation = 0 | 1 | 2 | 3;

export interface Piece {
  readonly kind: PieceKind;
  readonly rotation: Rotation;
}

export type CellKind = 'empty' | 'start' | 'end';

/**
 * A single grid cell. `fill` is yuck fill progress in [0,1]; `entryDir` records the
 * edge the yuck entered from (used to render flow direction and to stop backflow).
 * `sourceDir` is meaningful only for start cells (the nozzle's outward direction)
 * and end cells (the required entry direction).
 */
export interface Cell {
  readonly kind: CellKind;
  readonly piece: Piece | null;
  readonly fixed: boolean;
  readonly fill: number;
  readonly entryDir: Direction | null;
  readonly sourceDir: Direction | null;
}

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface Board {
  readonly size: number;
  readonly cells: readonly Cell[];
  readonly start: Position;
  readonly end: Position;
}

export type DifficultyName = 'SLUDGE PUPPY' | 'GOO TROOPER' | 'ULTRA-OILER' | 'NIGHTMARE CRUDE';

export interface Difficulty {
  readonly name: DifficultyName;
  readonly countdownSeconds: number;
  readonly flowCellsPerSecond: number;
  readonly fixedFromLevel: number;
  readonly fixedMax: number;
  readonly speedRampPerLevel: number;
}

export type Phase = 'countdown' | 'flowing' | 'won' | 'lost';
