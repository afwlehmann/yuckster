// App-level screen machine: MENU ↔ GAME ↔ PAUSE, plus GAMEOVER/LEVELWON banners
// drawn over the game. Owns the mutable Loop (canvas, sprites, audio, shake) and
// dispatches input intents per active screen. The RAF loop lives in main.ts and
// calls update()/draw() here each frame.

import { clear, type CanvasView, VIEW_W, VIEW_H } from './render/canvas.js';
import { type SpriteStore, createSpriteStore, drawBoard, type Cursor } from './render/board.js';
import { drawHud, type HudState } from './render/hud.js';
import { PALETTE } from './render/palette.js';
import { drawText, drawTextCenter, textWidth } from './render/font.js';
import { type Audio } from './audio.js';
import { type Music } from './music.js';
import { createShakeState, type Shake } from './render/shake.js';
import { createParallax, updateParallax, drawParallax, type Parallax } from './render/parallax.js';
import { createBiplane, updateBiplane, drawBiplane, type Biplane } from './render/biplane.js';
import { drawBlurredFrame } from './render/blur.js';
import { type Intent } from './input.js';
import { DIFFICULTIES, findDifficulty } from './game/difficulty.js';
import type { DifficultyName } from './game/types.js';
import type { GameState } from './game/state.js';
import {
  moveCursor,
  newGame,
  nextLevel,
  placeHeld,
  rotateHeldCw,
  rotateHeldCcw,
  tick,
} from './game/state.js';

export type Screen = 'menu' | 'keybindings' | 'game' | 'pause';

const STORAGE_KEY = 'yuckster.difficulty';

const loadDifficulty = (): DifficultyName => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null && DIFFICULTIES.some((d) => d.name === v)) {
      return v as DifficultyName;
    }
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return 'GOO TROOPER';
};

const saveDifficulty = (name: DifficultyName): void => {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore
  }
};

export interface App {
  readonly view: CanvasView;
  readonly store: SpriteStore;
  readonly audio: Audio;
  readonly music: Music;
  screen: Screen;
  state: GameState;
  lastTs: number;
  blink: number;
  shake: Shake;
  lastCountdownWhole: number;
  lastPhase: GameState['phase'];
  parallax: Parallax;
  menuIndex: number;
  difficultyIndex: number;
  pauseIndex: number;
  frozenFrame: HTMLCanvasElement | null;
  fade: number; // 0..1 menu→game crossfade
  biplane: Biplane;
  titleImage: HTMLImageElement | null;
  titleImageReady: boolean;
  audioUnlocked: boolean;
}

export const createApp = (view: CanvasView, audio: Audio, music: Music): App => {
  const store = createSpriteStore();
  const diffName = loadDifficulty();
  const difficultyIndex = Math.max(
    0,
    DIFFICULTIES.findIndex((d) => d.name === diffName),
  );
  const titleImage = new Image();
  titleImage.src = `${import.meta.env.BASE_URL}title.png`;
  const app: App = {
    view,
    store,
    audio,
    music,
    screen: 'menu',
    state: newGame(findDifficulty(diffName)),
    lastTs: 0,
    blink: 0,
    shake: createShakeState(),
    lastCountdownWhole: 0,
    lastPhase: 'countdown',
    parallax: createParallax(),
    menuIndex: 0,
    difficultyIndex,
    pauseIndex: 0,
    frozenFrame: null,
    fade: 0,
    biplane: createBiplane(),
    titleImage,
    titleImageReady: false,
    audioUnlocked: false,
  };
  titleImage.addEventListener('load', () => {
    app.titleImageReady = true;
  });
  return app;
};

const MENU_ITEMS = ['START MISSION', 'DIFFICULTY', 'KEYBINDINGS'] as const;

const startGame = (app: App): void => {
  const diff = DIFFICULTIES[app.difficultyIndex];
  app.state = newGame(diff);
  app.lastPhase = app.state.phase;
  app.lastCountdownWhole = Math.ceil(app.state.countdownRemaining);
  app.screen = 'game';
  app.audio.play('menuSelect');
  app.music.playGame();
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

const drawMenu = (app: App): void => {
  const { view, parallax } = app;
  clear(view, PALETTE.void);
  drawParallax(view, parallax);
  drawBiplane(view.ctx, app.biplane);
  const { ctx } = view;
  // Title banner image (if loaded), scaled to fit; else fallback to text.
  if (app.titleImageReady && app.titleImage !== null) {
    const img = app.titleImage;
    const maxW = 440;
    const scale = Math.min(maxW / img.width, 1);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (VIEW_W - dw) / 2;
    const dy = 16;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    const title = 'YUCKSTER';
    drawTextCenter(ctx, title, VIEW_W / 2, 70, PALETTE.yuckDark, 6);
    drawTextCenter(ctx, title, VIEW_W / 2, 66, PALETTE.yuck, 6);
    drawTextCenter(ctx, title, VIEW_W / 2, 64, PALETTE.yuckLight, 6);
  }
  // Menu items (scale 1), clustered below the logo with even visual gaps
  const labelH = 8;
  const diffSubH = 12;
  const gap = 16;
  const totalH = MENU_ITEMS.length * labelH + diffSubH + (MENU_ITEMS.length - 1) * gap;
  const menuStart = Math.round((VIEW_H - totalH) / 2 + 40);
  const menuSlots = [menuStart];
  {
    let y = menuStart;
    MENU_ITEMS.forEach((item, i) => {
      y += labelH + (item === 'DIFFICULTY' ? diffSubH : 0) + gap;
      if (i + 1 < MENU_ITEMS.length) menuSlots.push(y);
    });
  }
  MENU_ITEMS.forEach((item, i) => {
    const y = menuSlots[i];
    const selected = i === app.menuIndex;
    const color = selected ? PALETTE.hudAccent : PALETTE.hudTextDim;
    drawTextCenter(ctx, item, VIEW_W / 2, y, color, 1);
    if (item === 'DIFFICULTY' && i === 1) {
      const name = DIFFICULTIES[app.difficultyIndex].name;
      const diffColor = selected ? PALETTE.hudAccent : PALETTE.hudTextDim;
      drawTextCenter(ctx, `< ${name} >`, VIEW_W / 2, y + 12, diffColor, 1);
    }
  });
  // Footer hint
  drawTextCenter(
    ctx,
    'UP/DOWN SELECT  ENTER CONFIRM',
    VIEW_W / 2,
    VIEW_H - 24,
    PALETTE.hudTextDim,
    2,
  );
  // Blinking "press key for music" note until audio is unlocked
  if (!app.audioUnlocked) {
    const blinkOn = Math.floor(app.blink * 2) % 2 === 0;
    if (blinkOn) {
      drawTextCenter(
        ctx,
        'PRESS ANY KEY TO ENABLE MUSIC',
        VIEW_W / 2,
        VIEW_H - 44,
        PALETTE.hudWarn,
        1,
      );
    }
  }
};

const KEYBINDING_LINES = [
  'MOVE          \u2190 \u2191 \u2193 \u2192  HJKL',
  'ROTATE CW     D',
  'ROTATE CCW    A',
  'PLACE         SPACE',
  'PAUSE         P / ESC',
] as const;

const drawKeybindings = (app: App): void => {
  const { view, parallax } = app;
  const ctx = view.ctx;
  clear(view, PALETTE.void);
  drawParallax(view, parallax);
  ctx.fillStyle = 'rgba(8,12,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawTextCenter(ctx, 'KEYBINDINGS', VIEW_W / 2, 70, PALETTE.hudAccent, 4);
  const maxLineW = Math.max(...KEYBINDING_LINES.map((l) => textWidth(l, 2)));
  const blockX = (VIEW_W - maxLineW) / 2;
  KEYBINDING_LINES.forEach((line, i) => {
    drawText(ctx, line, blockX, 140 + i * 28, PALETTE.hudText, 2);
  });
  drawTextCenter(ctx, 'ESC/ENTER BACK', VIEW_W / 2, VIEW_H - 30, PALETTE.hudTextDim, 2);
};

const drawGameScreen = (app: App): void => {
  const { view, store, state } = app;
  clear(view, PALETTE.void);
  const [sx, sy] = app.shake.offset();
  view.ctx.save();
  view.ctx.translate(sx, sy);
  drawHud(view, store, hudFor(state));
  drawBoard(view, store, state.board, cursorFor(state, app.blink));
  if (state.phase === 'won') {
    drawTextCenter(view.ctx, 'LEVEL CLEAR', VIEW_W / 2, VIEW_H / 2 - 20, PALETTE.hudAccent, 4);
    drawTextCenter(
      view.ctx,
      'ENTER NEXT  /  ESC MENU',
      VIEW_W / 2,
      VIEW_H / 2 + 20,
      PALETTE.hudText,
      2,
    );
  } else if (state.phase === 'lost') {
    drawTextCenter(view.ctx, 'SPILL!', VIEW_W / 2, VIEW_H / 2 - 20, PALETTE.hudDanger, 4);
    drawTextCenter(
      view.ctx,
      'ENTER RETRY  /  ESC MENU',
      VIEW_W / 2,
      VIEW_H / 2 + 20,
      PALETTE.hudText,
      2,
    );
  }
  view.ctx.restore();
};

const PAUSE_ITEMS = ['RESUME', 'QUIT TO MAIN MENU'] as const;

const drawPause = (app: App): void => {
  const { view } = app;
  const ctx = view.ctx;
  if (app.frozenFrame !== null) {
    view.ctx.imageSmoothingEnabled = false;
    ctx.drawImage(app.frozenFrame, 0, 0);
    drawBlurredFrame(view, app.frozenFrame);
  } else {
    clear(view, PALETTE.void);
  }
  drawTextCenter(ctx, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 50, PALETTE.hudAccent, 4);
  PAUSE_ITEMS.forEach((item, i) => {
    const y = VIEW_H / 2 + i * 32;
    const selected = i === app.pauseIndex;
    const color = selected ? PALETTE.hudAccent : PALETTE.hudTextDim;
    drawTextCenter(ctx, item, VIEW_W / 2, y, color, 2);
  });
  drawTextCenter(ctx, 'ESC RESUME  /  ENTER QUIT', VIEW_W / 2, VIEW_H - 30, PALETTE.hudTextDim, 2);
};

const captureFrame = (app: App): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    ctx.drawImage(app.view.canvas, 0, 0);
  }
  return canvas;
};

const updateAudioForPhase = (app: App): void => {
  const { state, audio, lastPhase, lastCountdownWhole } = app;
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
    app.lastCountdownWhole = whole;
  }
  app.lastPhase = state.phase;
};

const handleGameIntent = (app: App, intent: Intent): void => {
  const state = app.state;
  if (state.phase === 'won' || state.phase === 'lost') {
    if (intent.kind === 'confirm') {
      app.state = state.phase === 'won' ? nextLevel(state) : newGame(state.difficulty);
      app.lastPhase = app.state.phase;
      app.lastCountdownWhole = Math.ceil(app.state.countdownRemaining);
    } else if (intent.kind === 'pause') {
      app.screen = 'menu';
      app.audio.stopFlowLoop();
      app.music.stop();
      app.music.playMenu();
    }
    return;
  }
  switch (intent.kind) {
    case 'move':
      app.state = moveCursor(state, intent.dx, intent.dy);
      break;
    case 'rotate':
      app.audio.play('rotate');
      app.state = intent.dir === 'cw' ? rotateHeldCw(state) : rotateHeldCcw(state);
      break;
    case 'place': {
      const result = placeHeld(state);
      if (result.status === 'placed') {
        app.audio.play('place');
        app.shake = app.shake.trigger();
      } else {
        app.audio.play('blocked');
      }
      app.state = result.state;
      break;
    }
    case 'pause':
      app.frozenFrame = captureFrame(app);
      app.screen = 'pause';
      app.pauseIndex = 0;
      app.audio.suspend();
      app.music.suspend();
      break;
    default:
      break;
  }
};

const handleMenuIntent = (app: App, intent: Intent): void => {
  switch (intent.kind) {
    case 'move':
      if (intent.dy < 0) {
        app.menuIndex = (app.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
        app.audio.play('menuMove');
      } else if (intent.dy > 0) {
        app.menuIndex = (app.menuIndex + 1) % MENU_ITEMS.length;
        app.audio.play('menuMove');
      } else if (intent.dx < 0) {
        if (MENU_ITEMS[app.menuIndex] === 'DIFFICULTY') {
          app.difficultyIndex =
            (app.difficultyIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
          saveDifficulty(DIFFICULTIES[app.difficultyIndex].name);
          app.audio.play('rotate');
        }
      } else if (intent.dx > 0) {
        if (MENU_ITEMS[app.menuIndex] === 'DIFFICULTY') {
          app.difficultyIndex = (app.difficultyIndex + 1) % DIFFICULTIES.length;
          saveDifficulty(DIFFICULTIES[app.difficultyIndex].name);
          app.audio.play('rotate');
        }
      }
      break;
    case 'up':
      app.menuIndex = (app.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      app.audio.play('menuMove');
      break;
    case 'down':
      app.menuIndex = (app.menuIndex + 1) % MENU_ITEMS.length;
      app.audio.play('menuMove');
      break;
    case 'left':
      if (MENU_ITEMS[app.menuIndex] === 'DIFFICULTY') {
        app.difficultyIndex = (app.difficultyIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
        saveDifficulty(DIFFICULTIES[app.difficultyIndex].name);
        app.audio.play('rotate');
      }
      break;
    case 'right':
      if (MENU_ITEMS[app.menuIndex] === 'DIFFICULTY') {
        app.difficultyIndex = (app.difficultyIndex + 1) % DIFFICULTIES.length;
        saveDifficulty(DIFFICULTIES[app.difficultyIndex].name);
        app.audio.play('rotate');
      }
      break;
    case 'confirm':
      if (MENU_ITEMS[app.menuIndex] === 'START MISSION') {
        startGame(app);
      } else if (MENU_ITEMS[app.menuIndex] === 'KEYBINDINGS') {
        app.screen = 'keybindings';
        app.biplane = createBiplane();
        app.audio.play('menuSelect');
      } else {
        app.audio.play('rotate');
      }
      break;
    default:
      break;
  }
};

const handleKeybindingsIntent = (app: App, intent: Intent): void => {
  if (intent.kind === 'confirm' || intent.kind === 'pause') {
    app.screen = 'menu';
    app.biplane = createBiplane();
    app.audio.play('menuMove');
  }
};

const handlePauseIntent = (app: App, intent: Intent): void => {
  switch (intent.kind) {
    case 'up':
      app.pauseIndex = (app.pauseIndex + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
      app.audio.play('menuMove');
      break;
    case 'down':
      app.pauseIndex = (app.pauseIndex + 1) % PAUSE_ITEMS.length;
      app.audio.play('menuMove');
      break;
    case 'pause':
      app.screen = 'game';
      app.frozenFrame = null;
      app.audio.resume();
      app.music.resume();
      app.audio.play('menuSelect');
      break;
    case 'confirm':
      app.screen = 'menu';
      app.frozenFrame = null;
      app.audio.stopFlowLoop();
      app.audio.resume();
      app.audio.play('menuSelect');
      app.music.stop();
      app.music.playMenu();
      break;
    default:
      break;
  }
};

export const handleIntent = (app: App, intent: Intent): void => {
  app.audio.unlock();
  if (!app.audioUnlocked) {
    app.audioUnlocked = true;
    app.music.unlock();
    app.music.playMenu();
  }
  switch (app.screen) {
    case 'menu':
      handleMenuIntent(app, intent);
      break;
    case 'keybindings':
      handleKeybindingsIntent(app, intent);
      break;
    case 'game':
      handleGameIntent(app, intent);
      break;
    case 'pause':
      handlePauseIntent(app, intent);
      break;
  }
};

export const update = (app: App, dt: number): void => {
  app.blink += dt;
  app.shake = app.shake.update(dt);
  if (app.screen === 'menu' || app.screen === 'keybindings') {
    app.parallax = updateParallax(app.parallax, dt);
    app.biplane = updateBiplane(app.biplane, dt);
  }
  if (app.screen === 'game') {
    app.state = tick(app.state, dt);
    updateAudioForPhase(app);
  }
};

export const draw = (app: App): void => {
  switch (app.screen) {
    case 'menu':
      drawMenu(app);
      break;
    case 'keybindings':
      drawKeybindings(app);
      break;
    case 'game':
      drawGameScreen(app);
      break;
    case 'pause':
      drawPause(app);
      break;
  }
};
