// A tiny seeded PRNG (mulberry32) so levels are reproducible from a seed while
// remaining pure: every call advances the internal state and returns a new Rng.
// The Rng value is an opaque record holding the 32-bit state; functions return a
// new Rng alongside the produced value, in classic generator style.

export interface RngState {
  readonly seed: number;
}

export interface RngNext<T> {
  readonly value: T;
  readonly rng: RngState;
}

const mulberry32Step = (state: number): { readonly value: number; readonly next: number } => {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: a };
};

export const createRng = (seed: number): RngState => ({ seed: seed >>> 0 });

export const nextFloat = (rng: RngState): RngNext<number> => {
  const { value, next } = mulberry32Step(rng.seed);
  return { value, rng: { seed: next } };
};

export const nextInt =
  (max: number) =>
  (rng: RngState): RngNext<number> => {
    const { value, rng: next } = nextFloat(rng);
    return { value: Math.floor(value * max), rng: next };
  };

export const pick =
  <T>(items: readonly T[]) =>
  (rng: RngState): RngNext<T> => {
    const { value, rng: next } = nextInt(items.length)(rng);
    return { value: items[value], rng: next };
  };

/** Fisher–Yates shuffle producing a new array; the original is untouched. */
export const shuffle =
  <T>(items: readonly T[]) =>
  (rng: RngState): RngNext<readonly T[]> => {
    const out = [...items];
    let state = rng;
    for (let i = out.length - 1; i > 0; i -= 1) {
      const stepped = nextInt(i + 1)(state);
      state = stepped.rng;
      const j = stepped.value;
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return { value: out, rng: state };
  };
