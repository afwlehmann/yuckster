// Game bootstrap: canvas, sprite cache, RAF loop, input → state dispatch.
// The first playable iteration runs the GAME screen only (no menu/pause yet);
// subsequent commits add the screen machine and overlays.

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
import { createAudioEngine, type Audio } from './audio.js';
import { createShakeState, type Shake } from './render/shake.js';

interface Loop {
  readonly view: CanvasView;
  readonly store: SpriteStore;
  readonly audio: Audio;
  state: GameState;
  lastTs: number;
  blink: number;
  shake: Shake;
  lastCountdownWhole: number;
  lastPhase: GameState['phase'];
}

const startLoop = (): Loop => {
  const view = createCanvasView();
  const store = createSpriteStore();
  const audio = createAudioEngine();
  const state = newGame(findDifficulty('GOO TROOPER'));
  return {
    view,
    store,
    audio,
    state,
    lastTs: 0,
    blink: 0,
    shake: createShakeState(),
    lastCountdownWhole: Math.ceil(state.countdownRemaining),
    lastPhase: state.phase,
  };
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
  const [sx, sy] = loop.shake.offset();
  view.ctx.save();
  view.ctx.translate(sx, sy);
  drawHud(view, store, hudFor(state));
  drawBoard(view, store, state.board, cursorFor(state, loop.blink));
  if (state.phase === 'won') {
    drawTextCenter(view.ctx, 'LEVEL CLEAR', VIEW_W / 2, VIEW_H / 2 - 8, PALETTE.hudAccent, 2);
    drawTextCenter(view.ctx, 'ENTER FOR NEXT', VIEW_W / 2, VIEW_H / 2 + 8, PALETTE.hudText, 1);
  } else if (state.phase === 'lost') {
    drawTextCenter(view.ctx, 'SPILL!', VIEW_W / 2, VIEW_H / 2 - 8, PALETTE.hudDanger, 2);
    drawTextCenter(view.ctx, 'ENTER TO RETRY', VIEW_W / 2, VIEW_H / 2 + 8, PALETTE.hudText, 1);
  }
  view.ctx.restore();
};

const handleIntent = (loop: Loop, intent: Intent): void => {
  loop.audio.unlock();
  const state = loop.state;
  if (state.phase === 'won' || state.phase === 'lost') {
    if (intent.kind === 'confirm') {
      loop.audio.play('menuSelect');
      loop.state = state.phase === 'won' ? nextLevel(state) : newGame(state.difficulty);
      loop.lastPhase = loop.state.phase;
      loop.lastCountdownWhole = Math.ceil(loop.state.countdownRemaining);
    }
    return;
  }
  switch (intent.kind) {
    case 'move':
      loop.state = moveCursor(state, intent.dx, intent.dy);
      break;
    case 'rotate':
      loop.audio.play('rotate');
      loop.state = intent.dir === 'cw' ? rotateHeldCw(state) : rotateHeldCcw(state);
      break;
    case 'place': {
      const result = placeHeld(state);
      if (result.status === 'placed') {
        loop.audio.play('place');
        loop.shake = loop.shake.trigger();
      } else {
        loop.audio.play('blocked');
      }
      loop.state = result.state;
      break;
    }
    default:
      break;
  }
};

const updateAudioForPhase = (loop: Loop): void => {
  const { state, audio, lastPhase, lastCountdownWhole } = loop;
  if (lastPhase !== 'flowing' && state.phase === 'flowing') {
    audio.play('flowStart');
    audio.startFlowLoop();
  }
  if (lastPhase === 'flowing' && (state.phase === 'won' || state.phase === 'lost')) {
    audio.stopFlowLoop();
    audio.play(state.phase === 'won' ? 'win' : 'lose');
  }
  if (state.phase === 'countdown') {
    const whole = Math.ceil(state.countdownRemaining);
    if (whole < lastCountdownWhole && whole >= 0) {
      audio.play('tick');
    }
    loop.lastCountdownWhole = whole;
  }
  loop.lastPhase = state.phase;
};

const frame = (loop: Loop, ts: number): void => {
  const dt = loop.lastTs === 0 ? 0 : Math.min(0.05, (ts - loop.lastTs) / 1000);
  loop.lastTs = ts;
  loop.blink += dt;
  loop.shake = loop.shake.update(dt);
  loop.state = tick(loop.state, dt);
  updateAudioForPhase(loop);
  drawGame(loop);
  requestAnimationFrame((n) => frame(loop, n));
};

const main = (): void => {
  const loop = startLoop();
  installInput((intent) => handleIntent(loop, intent));
  requestAnimationFrame((ts) => frame(loop, ts));
};

main();
