// Screen shake: a small downward-biased impulse on tile placement, decaying over
// ~180ms. The game loop calls update(dt) each frame and reads offset() to
// translate the final composite. Pure math — no rendering side effects.

export const SHAKE_KICK_PX = 2;
export const SHAKE_DURATION_MS = 180;
const KICK_MS = 40;

export interface Shake {
  /** Advance the shake by dt seconds; returns a new Shake. */
  readonly update: (dt: number) => Shake;
  /** Current (dx, dy) integer offset to apply. */
  readonly offset: () => readonly [number, number];
  /** True while the shake is still animating. */
  readonly active: boolean;
  /** Trigger a new kick (cancels/overrides any in-progress shake). */
  readonly trigger: () => Shake;
}

interface ShakeState {
  readonly elapsedMs: number;
  readonly angle: number; // random kick direction
}

const createShake = (state: ShakeState | null): Shake => ({
  update: (dt) => {
    if (state === null) return createShake(null);
    const elapsed = state.elapsedMs + dt * 1000;
    if (elapsed >= SHAKE_DURATION_MS) return createShake(null);
    return createShake({ elapsedMs: elapsed, angle: state.angle });
  },
  offset: () => {
    if (state === null) return [0, 0] as const;
    if (state.elapsedMs < KICK_MS) {
      // Sharp kick phase: full magnitude in the chosen direction.
      const mag = SHAKE_KICK_PX;
      return [
        Math.round(Math.cos(state.angle) * mag),
        Math.round(Math.sin(state.angle) * mag),
      ] as const;
    }
    // Decay phase: damped wobble toward 0.
    const decay = (1 - (state.elapsedMs - KICK_MS) / (SHAKE_DURATION_MS - KICK_MS)) ** 2;
    const mag = SHAKE_KICK_PX * decay;
    const wobble = Math.sin(state.elapsedMs * 0.08) * 0.5;
    return [
      Math.round(Math.cos(state.angle + wobble) * mag),
      Math.round(Math.sin(state.angle + wobble) * mag),
    ] as const;
  },
  active: state !== null,
  trigger: () => {
    // Downward-biased random angle: pick from a cone around straight down.
    const base = Math.PI / 2; // pointing down (+y)
    const spread = Math.PI / 3;
    const angle = base + (Math.random() - 0.5) * spread;
    return createShake({ elapsedMs: 0, angle });
  },
});

export const createShakeState = (): Shake => createShake(null);
