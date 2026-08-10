// Bootstraps the canvas and the game loop. The first iteration draws a placeholder
// using the pixel font so the render core builds and runs; subsequent commits wire
// the real screens (menu, game, pause, overlays).

import { clear, createCanvasView, VIEW_W } from './render/canvas.js';
import { drawText, drawTextCenter } from './render/font.js';

const view = createCanvasView();
clear(view, '#101820');
const { ctx } = view;
ctx.fillStyle = '#7fff5a';
drawTextCenter(ctx, 'YUCKSTER', VIEW_W / 2, 40, '#7fff5a', 2);
drawText(ctx, 'PIPE DREAM-STYLE GOO GAME', 60, 70, '#7ab8a0', 1);
drawText(ctx, 'loading...', 100, 120, '#5a7a6a', 1);
