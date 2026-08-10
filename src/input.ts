// Keyboard input. Translates key presses into a small set of intents so the
// screen layer can dispatch per current screen. Arrow keys and hjkl move the
// cursor; q/e rotate; space places; p/esc pause/resume; enter confirms in menus.

export type Intent =
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'rotate'; readonly dir: 'cw' | 'ccw' }
  | { readonly kind: 'place' }
  | { readonly kind: 'pause' }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'musicToggle' }
  | { readonly kind: 'up' }
  | { readonly kind: 'down' }
  | { readonly kind: 'left' }
  | { readonly kind: 'right' };

const MOVE = new Map<string, { readonly dx: number; readonly dy: number }>([
  ['ArrowLeft', { dx: -1, dy: 0 }],
  ['ArrowRight', { dx: 1, dy: 0 }],
  ['ArrowUp', { dx: 0, dy: -1 }],
  ['ArrowDown', { dx: 0, dy: 1 }],
  ['h', { dx: -1, dy: 0 }],
  ['l', { dx: 1, dy: 0 }],
  ['k', { dx: 0, dy: -1 }],
  ['j', { dx: 0, dy: 1 }],
]);

const MENU_NAV = new Map<string, Intent['kind']>([
  ['ArrowUp', 'up'],
  ['k', 'up'],
  ['ArrowDown', 'down'],
  ['j', 'down'],
  ['ArrowLeft', 'left'],
  ['h', 'left'],
  ['ArrowRight', 'right'],
  ['l', 'right'],
]);

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Space']);

export type IntentHandler = (intent: Intent) => void;

/**
 * Install a keydown listener on window. Returns a disposer. Both gameplay and
 * menu intents are produced; the screen layer ignores irrelevant ones. Key
 * repeat is left to the browser's natural repeat for simplicity; the game loop
 * rate-limits movement internally.
 */
export const installInput = (handler: IntentHandler): (() => void) => {
  const onKey = (e: KeyboardEvent) => {
    if (PREVENT.has(e.key)) {
      e.preventDefault();
    }
    const intent = translate(e.key);
    if (intent !== null) {
      handler(intent);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};

const translate = (key: string): Intent | null => {
  const move = MOVE.get(key);
  if (move !== undefined) {
    return { kind: 'move', dx: move.dx, dy: move.dy };
  }
  switch (key) {
    case 'w':
      return { kind: 'rotate', dir: 'ccw' };
    case 'e':
      return { kind: 'rotate', dir: 'cw' };
    case ' ':
    case 'Space':
      return { kind: 'place' };
    case 'p':
    case 'P':
    case 'Escape':
      return { kind: 'pause' };
    case 'm':
    case 'M':
      return { kind: 'musicToggle' };
    case 'Enter':
      return { kind: 'confirm' };
  }
  const nav = MENU_NAV.get(key);
  if (nav !== undefined) {
    switch (nav) {
      case 'up':
        return { kind: 'up' };
      case 'down':
        return { kind: 'down' };
      case 'left':
        return { kind: 'left' };
      case 'right':
        return { kind: 'right' };
    }
  }
  return null;
};
