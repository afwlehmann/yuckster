// Bootstraps the canvas and the game loop. The first iteration draws a placeholder
// so the scaffold builds and runs; subsequent commits wire the real screens.
const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d') ?? null;

if (canvas !== null && ctx !== null) {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7fff5a';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('YUCKSTER', canvas.width / 2, canvas.height / 2);
}

console.warn('yuckster: scaffold boot');
