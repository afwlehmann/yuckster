// A small pixelated police helicopter that orbits the title logo on the main
// menu. It flies in an elliptical path around the logo center, alternating
// between appearing behind and in front of the title based on its angle.

export interface Helicopter {
  readonly t: number;
}

export const createHelicopter = (): Helicopter => ({ t: 0 });

const ANGLE_SPEED = 0.8;
const RADIUS_X = 140;
const RADIUS_Y = 50;

export const updateHelicopter = (h: Helicopter, dt: number): Helicopter => ({
  t: h.t + dt * ANGLE_SPEED,
});

const HELI_W = 18;
const HELI_H = 12;

export const helicopterPos = (
  h: Helicopter,
  cx: number,
  cy: number,
): {
  readonly x: number;
  readonly y: number;
  readonly front: boolean;
  readonly facing: number;
} => {
  const a = h.t;
  const x = cx + Math.cos(a) * RADIUS_X;
  const y = cy + Math.sin(a) * RADIUS_Y;
  const front = Math.sin(a) > 0;
  const facing = Math.cos(a) >= 0 ? 1 : -1;
  return { x, y, front, facing };
};

const drawHelicopterBody = (
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  facing: number,
  t: number,
): void => {
  const ix = Math.round(ox);
  const iy = Math.round(oy);
  const p = (x: number, y: number, w: number, h: number): void => {
    ctx.fillRect(ix + (facing > 0 ? x : HELI_W - x - w), iy + y, w, h);
  };
  // Body (dark blue, police colors)
  ctx.fillStyle = '#1a2a4a';
  p(4, 4, 8, 4);
  // Nose
  ctx.fillStyle = '#2a3a5a';
  p(12, 5, 3, 2);
  // Cockpit window
  ctx.fillStyle = '#5a8aaa';
  p(6, 4, 4, 2);
  // Tail boom
  ctx.fillStyle = '#1a2a4a';
  p(0, 5, 4, 2);
  // Tail fin
  ctx.fillStyle = '#2a3a5a';
  p(0, 3, 2, 2);
  // Skids
  ctx.fillStyle = '#3a3a3a';
  p(3, 9, 9, 1);
  p(3, 8, 1, 1);
  p(11, 8, 1, 1);
  // Red/blue police light bar (alternating flash)
  const flash = Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2020' : '#2020ff';
  p(5, 3, 3, 1);
  ctx.fillStyle = flash ? '#2020ff' : '#ff2020';
  p(8, 3, 3, 1);
  // Main rotor (spinning — drawn as a blur line)
  const rotorPhase = (t * 30) % (Math.PI * 2);
  const rotorLen = 9;
  ctx.fillStyle = '#2a2a2a';
  const rotorY = 2;
  const rotorOffset = Math.abs(Math.cos(rotorPhase)) * 2;
  p(4, rotorY, rotorLen - rotorOffset, 1);
  // Tail rotor (spinning)
  const tailPhase = (t * 35) % (Math.PI * 2);
  if (Math.cos(tailPhase) > 0) {
    ctx.fillStyle = '#3a3a3a';
    p(0, 4, 1, 3);
  }
};

export const drawHelicopter = (
  ctx: CanvasRenderingContext2D,
  h: Helicopter,
  cx: number,
  cy: number,
): void => {
  const { x, y, front, facing } = helicopterPos(h, cx, cy);
  const ox = x - HELI_W / 2;
  const oy = y - HELI_H / 2;
  // Shadow on the ground (always behind everything)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(Math.round(ox + 2), Math.round(cy + RADIUS_Y + 8), HELI_W - 4, 2);
  drawHelicopterBody(ctx, ox, oy, facing, h.t);
  void front;
};
