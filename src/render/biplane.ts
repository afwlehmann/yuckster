// A small pixelated biplane that crosses the main menu sky from time to time,
// towing a banner with credits. The plane appears at random intervals, flies
// left-to-right (or right-to-left for variety) at a fixed altitude, then exits
// and schedules its next pass.

const BANNER_TEXT = ' 2026 BY ALEXANDER LEHMANN, GLM 5.2, SONNET, AND SUNO ';
const BANNER_FONT_W = 4; // 3px glyph + 1px gap
// 3x5 mini-font: A-Z, a-z, 0-9, (), space, comma, period, hyphen
const FONT: Readonly<Record<string, readonly number[]>> = {
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b011, 0b100, 0b100, 0b100, 0b011],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b011, 0b100, 0b101, 0b101, 0b011],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b010],
  K: [0b101, 0b110, 0b100, 0b110, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b101, 0b111, 0b111, 0b111, 0b101],
  O: [0b010, 0b101, 0b101, 0b101, 0b010],
  P: [0b110, 0b101, 0b110, 0b100, 0b100],
  Q: [0b010, 0b101, 0b101, 0b111, 0b011],
  R: [0b110, 0b101, 0b110, 0b110, 0b101],
  S: [0b011, 0b100, 0b010, 0b001, 0b110],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b011],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b110, 0b001, 0b010, 0b100, 0b111],
  '3': [0b110, 0b001, 0b110, 0b001, 0b110],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b110, 0b001, 0b110],
  '6': [0b011, 0b100, 0b110, 0b101, 0b010],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b010, 0b101, 0b010, 0b101, 0b010],
  '9': [0b010, 0b101, 0b011, 0b001, 0b110],
  '(': [0b010, 0b100, 0b100, 0b100, 0b010],
  ')': [0b010, 0b001, 0b001, 0b001, 0b010],
  ' ': [0, 0, 0, 0, 0],
  '-': [0, 0, 0b111, 0, 0],
  ',': [0, 0, 0, 0b110, 0b100],
  '.': [0, 0, 0, 0, 0b110],
  // Lowercase — 5-row mini glyphs (descenders fit within 5 rows)
  a: [0, 0, 0b011, 0b101, 0b111],
  b: [0b100, 0b100, 0b110, 0b101, 0b110],
  c: [0, 0, 0b011, 0b100, 0b011],
  d: [0b001, 0b001, 0b011, 0b101, 0b111],
  e: [0, 0, 0b010, 0b111, 0b011],
  f: [0b010, 0b100, 0b110, 0b100, 0b100],
  g: [0, 0, 0b011, 0b101, 0b111, 0b001],
  h: [0b100, 0b100, 0b110, 0b101, 0b101],
  i: [0b010, 0, 0b010, 0b010, 0b010],
  j: [0b001, 0, 0b001, 0b001, 0b101, 0b010],
  k: [0b100, 0b100, 0b101, 0b110, 0b101],
  l: [0b010, 0b010, 0b010, 0b010, 0b010],
  m: [0, 0, 0b101, 0b111, 0b101],
  n: [0, 0, 0b110, 0b101, 0b101],
  o: [0, 0, 0b010, 0b101, 0b010],
  p: [0, 0, 0b110, 0b101, 0b110, 0b100],
  q: [0, 0, 0b011, 0b101, 0b111, 0b001],
  r: [0, 0, 0b101, 0b110, 0b100],
  s: [0, 0, 0b011, 0b010, 0b110],
  t: [0b100, 0b100, 0b110, 0b100, 0b010],
  u: [0, 0, 0b101, 0b101, 0b111],
  v: [0, 0, 0b101, 0b101, 0b010],
  w: [0, 0, 0b101, 0b111, 0b101],
  x: [0, 0, 0b101, 0b010, 0b101],
  y: [0, 0, 0b101, 0b101, 0b010, 0b001],
  z: [0, 0, 0b111, 0b010, 0b111],
};

const PLANE_W = 20;
const BANNER_CHAR_H = 5;
const TOW_ROPE = 4;

const bannerPixelW = (): number => BANNER_TEXT.length * BANNER_FONT_W;

export interface Biplane {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly cooldown: number;
  readonly t: number;
}

export const createBiplane = (): Biplane => ({
  active: false,
  x: 0,
  y: 0,
  cooldown: 0,
  t: 0,
});

const SPEED = 80;
const ALTITUDE = 330;

export const updateBiplane = (plane: Biplane, dt: number): Biplane => {
  const t = plane.t + dt;
  if (plane.active) {
    const nx = plane.x - SPEED * dt;
    const totalW = PLANE_W + bannerPixelW() + TOW_ROPE;
    if (nx < -totalW) {
      return {
        ...plane,
        active: false,
        x: 0,
        cooldown: 6 + Math.random() * 10,
        t,
      };
    }
    return { ...plane, x: nx, t };
  }
  const nc = plane.cooldown - dt;
  if (nc <= 0) {
    const totalW = PLANE_W + bannerPixelW() + TOW_ROPE;
    return {
      ...plane,
      active: true,
      x: 640 + totalW,
      y: ALTITUDE + Math.floor(Math.random() * 20),
      cooldown: 0,
      t,
    };
  }
  return { ...plane, cooldown: nc, t };
};

const drawPlaneBody = (ctx: CanvasRenderingContext2D, ox: number, oy: number, t: number): void => {
  const ix = Math.round(ox);
  const iy = Math.round(oy);
  // Roll: slow swivel around the longitudinal (left-right) axis. The nose/tail
  // and top/bottom wings shift vertically in opposite directions to fake 3D
  // rotation. Amplitude ~2px, period ~2.5s.
  const roll = Math.round(Math.sin(t * 2.5) * 2);
  const topShift = -roll;
  const botShift = roll;
  // Plane faces left: x coordinates are mirrored (nose at left).
  const p = (x: number, y: number, w: number, h: number): void => {
    const sy = y < 6 ? topShift : y > 9 ? botShift : 0;
    ctx.fillRect(ix + (PLANE_W - x - w), iy + y + sy, w, h);
  };
  // Fuselage (dark red)
  ctx.fillStyle = '#8a3a2a';
  p(4, 6, 12, 3);
  // Nose
  ctx.fillStyle = '#6a2a1a';
  p(14, 7, 3, 2);
  p(16, 7, 2, 1);
  // Cockpit
  ctx.fillStyle = '#3a5a7a';
  p(9, 4, 3, 3);
  // Top wing
  ctx.fillStyle = '#9a4a3a';
  p(3, 2, 11, 2);
  // Bottom wing
  p(3, 10, 11, 2);
  // Struts
  ctx.fillStyle = '#5a2a1a';
  p(5, 4, 1, 6);
  p(11, 4, 1, 6);
  // Tail fin
  ctx.fillStyle = '#9a4a3a';
  p(1, 5, 3, 3);
  p(0, 6, 1, 2);
  // Propeller
  ctx.fillStyle = '#2a2a2a';
  p(18, 5, 1, 4);
  p(17, 7, 2, 1);
  // Tail wing
  ctx.fillStyle = '#7a3a2a';
  p(0, 9, 4, 2);
  // Highlight on top wing
  ctx.fillStyle = '#ba6a5a';
  p(4, 2, 9, 1);
  // Highlight on fuselage
  p(5, 6, 10, 1);
};

const drawBannerLetter = (
  ctx: CanvasRenderingContext2D,
  ch: string,
  ox: number,
  oy: number,
): void => {
  const glyph = FONT[ch];
  if (glyph === undefined) return;
  ctx.fillStyle = '#1a1a12';
  for (let row = 0; row < glyph.length; row += 1) {
    const bits = glyph[row];
    for (let col = 0; col < 3; col += 1) {
      if ((bits >> (3 - 1 - col)) & 1) {
        ctx.fillRect(ox + col, oy + row, 1, 1);
      }
    }
  }
};

const drawBanner = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  const ix = Math.round(x);
  const iy = Math.round(y);
  // Tow rope
  ctx.fillStyle = '#3a3a2a';
  ctx.fillRect(ix, iy + 8, TOW_ROPE, 1);
  // Banner starts after tow rope
  const bx = ix + TOW_ROPE;
  const bw = bannerPixelW();
  const bh = BANNER_CHAR_H + 2;
  // Banner cloth background — darker tone
  ctx.fillStyle = '#6a6a58';
  ctx.fillRect(bx, iy + 10, bw, bh);
  ctx.fillStyle = '#4a4a38';
  ctx.fillRect(bx, iy + 10 + bh - 1, bw, 1);
  // Letters on banner — centered vertically on the cloth
  const textY = iy + 11;
  for (let i = 0; i < BANNER_TEXT.length; i += 1) {
    const ch = BANNER_TEXT[i];
    const lx = bx + i * BANNER_FONT_W;
    drawBannerLetter(ctx, ch, lx, textY);
  }
};

export const drawBiplane = (ctx: CanvasRenderingContext2D, plane: Biplane): void => {
  if (!plane.active) return;
  // Plane always flies right-to-left: banner trails to the right, plane faces left.
  drawBanner(ctx, plane.x + PLANE_W, plane.y);
  drawPlaneBody(ctx, plane.x, plane.y, plane.t);
};
