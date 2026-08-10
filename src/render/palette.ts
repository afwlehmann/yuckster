// Shared color palette for the whole game. Kept in one place so every renderer
// (sprites, HUD, menus, parallax) draws from the same dirty-industrial scheme.

export const PALETTE = {
  // Background / ground
  void: '#0a0a0a',
  mudDark: '#1a140e',
  mud: '#241a10',
  mudLight: '#3a2a1a',
  gravel: '#2a2218',
  gravelLight: '#3d3326',
  // Pipes (steel body + copper accents)
  pipeShadow: '#1a1a22',
  pipeDark: '#3a3a4a',
  pipe: '#6a6a7a',
  pipeLight: '#9a9aaa',
  pipeRim: '#b8a080',
  copper: '#b87333',
  copperLight: '#d8a050',
  copperDark: '#7a4a2a',
  rust: '#7a4a2a',
  rustDark: '#4a2a18',
  // Yuck (green goo)
  yuckDark: '#1a5a1a',
  yuck: '#5fbf3a',
  yuckLight: '#a8ff5a',
  yuckGlow: '#cfff8a',
  // Start / end
  nozzle: '#6a6a6a',
  nozzleLight: '#a8a8a8',
  drainDark: '#1a1a1a',
  drain: '#3a3a3a',
  // HUD / text
  hudBg: '#0e1410',
  hudText: '#8aff6a',
  hudTextDim: '#5a7a5a',
  hudAccent: '#7fff5a',
  hudWarn: '#ff7a3a',
  hudDanger: '#ff3a3a',
  // Cursor
  cursor: '#bfffa8',
  cursorGhost: '#5a8a5a',
} as const;

export type Color = (typeof PALETTE)[keyof typeof PALETTE];
