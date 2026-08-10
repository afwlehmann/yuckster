// Game bootstrap: canvas, sprite cache, RAF loop, input → state dispatch.
// The first playable iteration runs the GAME screen only (no menu/pause yet);
// subsequent commits add the screen machine, audio, shake, and overlays.

import { clear, createCanvasView, VIEW_H, VIEW_W, type CanvasView } from './render/canvas.js';
import { drawBoard, createSpriteStore, type Cursor, type SpriteStore } from './render/board.js';
import { drawHud, type HudState } from './render/hud.js';
import { PALETTE } from './render/palette.js';
import { drawTextCenter } from './render/font.js';
import { installInput, type Intent } from './input.js';
import { findDifficulty } from './game/difficulty.js';
import {
  moveCursor,
  newGame,
  nextLevel,
  placeHeld,
  rotateHeldCw,
  rotateHeldCcw,
  tick,
  type GameState,
} from './game/state.js';

interface Loop {
  readonly view: CanvasView;
  readonly store: SpriteStore;
  state: GameState;
  lastTs: number;
  blink: number;
}

const startLoop = (): Loop => {
  const view = createCanvasView();
  const store = createSpriteStore();
  const state = newGame(findDifficulty('GOO TROOPER'));
  return { view, store, state, lastTs: 0, blink: 0 };
};

const cursorFor = (state: GameState, blink: number): Cursor => ({
  pos: state.cursor,
  held: state.currentPiece,
  blink,
});

const hudFor = (state: GameState): HudState => ({
  score: state.score,
  level: state.level,
  countdownSeconds: state.countdownRemaining,
  flowing: state.phase === 'flowing',
  difficulty: state.difficulty,
  currentPiece: state.currentPiece,
  nextPiece: state.nextPiece,
});

const drawGame = (loop: Loop): void => {
  const { view, store, state } = loop;
  clear(view, PALETTE.void);
  drawHud(view, store, hudFor(state));
  drawBoard(view, store, state.board, cursorFor(state, loop.blink));
  if (state.phase === 'won') {
    drawTextCenter(view.ctx, 'LEVEL CLEAR', VIEW_W / 2, VIEW_H / 2 - 8, PALETTE.hudAccent, 2);
    drawTextCenter(view.ctx, 'ENTER FOR NEXT', VIEW_W / 2, VIEW_H / 2 + 8, PALETTE.hudText, 1);
  } else if (state.phase === 'lost') {
    drawTextCenter(view.ctx, 'SPILL!', VIEW_W / 2, VIEW_H / 2 - 8, PALETTE.hudDanger, 2);
    drawTextCenter(view.ctx, 'ENTER TO RETRY', VIEW_W / 2, VIEW_H / 2 + 8, PALETTE.hudText, 1);
  }
};

const handleIntent = (loop: Loop, intent: Intent): void => {
  const state = loop.state;
  if (state.phase === 'won' || state.phase === 'lost') {
    if (intent.kind === 'confirm') {
      loop.state = state.phase === 'won' ? nextLevel(state) : newGame(state.difficulty);
    }
    return;
  }
  switch (intent.kind) {
    case 'move':
      loop.state = moveCursor(state, intent.dx, intent.dy);
      break;
    case 'rotate':
      loop.state = intent.dir === 'cw' ? rotateHeldCw(state) : rotateHeldCcw(state);
      break;
    case 'place': {
      const result = placeHeld(state);
      loop.state = result.state;
      break;
    }
    default:
      break;
  }
};

const frame = (loop: Loop, ts: number): void => {
  const dt = loop.lastTs === 0 ? 0 : Math.min(0.05, (ts - loop.lastTs) / 1000);
  loop.lastTs = ts;
  loop.blink += dt;
  loop.state = tick(loop.state, dt);
  drawGame(loop);
  requestAnimationFrame((n) => frame(loop, n));
};

const main = (): void => {
  const loop = startLoop();
  installInput((intent) => handleIntent(loop, intent));
  requestAnimationFrame((ts) => frame(loop, ts));
};

main();
