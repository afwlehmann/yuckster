// Bootstraps the canvas, audio, and the screen machine, then runs the RAF loop.

import { createCanvasView, VIEW_W, VIEW_H } from './render/canvas.js';
import { createAudioEngine } from './audio.js';
import { createMusic } from './music.js';
import { installInput } from './input.js';
import { createApp, draw, handleIntent, update, type App } from './screen.js';

const fitCanvas = (app: App): void => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / VIEW_W, vh / VIEW_H);
  const w = Math.floor(VIEW_W * scale);
  const h = Math.floor(VIEW_H * scale);
  app.view.canvas.style.width = `${w}px`;
  app.view.canvas.style.height = `${h}px`;
};

const main = (): void => {
  const view = createCanvasView();
  const audio = createAudioEngine();
  const music = createMusic();
  const app: App = createApp(view, audio, music);
  fitCanvas(app);
  window.addEventListener('resize', () => fitCanvas(app));
  installInput((intent) => handleIntent(app, intent));
  let lastTs = 0;
  const frame = (ts: number): void => {
    const dt = lastTs === 0 ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(app, dt);
    draw(app);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

main();
