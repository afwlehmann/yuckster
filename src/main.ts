// Bootstraps the canvas, audio, and the screen machine, then runs the RAF loop.

import { createCanvasView } from './render/canvas.js';
import { createAudioEngine } from './audio.js';
import { installInput } from './input.js';
import { createApp, draw, handleIntent, update, type App } from './screen.js';

const main = (): void => {
  const view = createCanvasView();
  const audio = createAudioEngine();
  const app: App = createApp(view, audio);
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
