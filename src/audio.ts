// Procedural chiptune synth via WebAudio. No audio files — every sound is a short
// oscillator/noise burst shaped by an envelope. The AudioContext is created
// lazily on the first user gesture (browser autoplay policy) and suspended
// while the game is paused so background sound truly stops.

type SfxName =
  | 'menuMove'
  | 'menuSelect'
  | 'rotate'
  | 'place'
  | 'blocked'
  | 'tick'
  | 'flowStart'
  | 'cellFill'
  | 'win'
  | 'lose';

export interface Audio {
  /** Play a named one-shot effect. No-op if audio isn't unlocked yet. */
  readonly play: (name: SfxName) => void;
  /** Resume/start the audio context (call on first user gesture). */
  readonly unlock: () => void;
  /** Suspend the context (pauses all sound). */
  readonly suspend: () => void;
  /** Resume the context after suspend. */
  readonly resume: () => void;
  /** Start the bubbling flow loop. */
  readonly startFlowLoop: () => void;
  /** Stop the bubbling flow loop. */
  readonly stopFlowLoop: () => void;
}

const createAudio = (): Audio => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let flowLoop: { readonly osc: OscillatorNode; readonly gain: GainNode } | null = null;

  const ensure = (): AudioContext | null => {
    if (ctx !== null) {
      return ctx;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) {
      return null;
    }
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
    return ctx;
  };

  const tone = (
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void => {
    const context = ensure();
    if (context === null || master === null) return;
    const t = context.currentTime + delay;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  };

  const noise = (duration: number, gain: number, lowpass: number): void => {
    const context = ensure();
    if (context === null || master === null) return;
    const t = context.currentTime;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const env = context.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t);
    src.stop(t + duration);
  };

  const play = (name: SfxName): void => {
    const context = ensure();
    if (context === null) return;
    switch (name) {
      case 'menuMove':
        tone(440, 0.05, 'square', 0.15);
        break;
      case 'menuSelect':
        tone(660, 0.08, 'square', 0.2);
        tone(880, 0.08, 'square', 0.15, 0.06);
        break;
      case 'rotate':
        tone(520, 0.04, 'square', 0.12);
        break;
      case 'place':
        noise(0.08, 0.3, 1200);
        tone(120, 0.1, 'square', 0.2);
        break;
      case 'blocked':
        tone(140, 0.12, 'sawtooth', 0.2);
        break;
      case 'tick':
        tone(880, 0.03, 'square', 0.12);
        break;
      case 'flowStart':
        tone(220, 0.3, 'sawtooth', 0.15);
        tone(330, 0.3, 'sawtooth', 0.1, 0.1);
        break;
      case 'cellFill':
        tone(660, 0.05, 'triangle', 0.12);
        break;
      case 'win':
        tone(523, 0.12, 'square', 0.2);
        tone(659, 0.12, 'square', 0.2, 0.1);
        tone(784, 0.12, 'square', 0.2, 0.2);
        tone(1047, 0.2, 'square', 0.2, 0.3);
        break;
      case 'lose':
        tone(330, 0.2, 'sawtooth', 0.2);
        tone(220, 0.3, 'sawtooth', 0.2, 0.15);
        tone(110, 0.4, 'sawtooth', 0.2, 0.3);
        break;
    }
  };

  const unlock = (): void => {
    const context = ensure();
    if (context === null) return;
    void context.resume();
  };

  const suspend = (): void => {
    if (ctx !== null) {
      void ctx.suspend();
    }
  };

  const resume = (): void => {
    if (ctx !== null) {
      void ctx.resume();
    }
  };

  const startFlowLoop = (): void => {
    const context = ensure();
    if (context === null || master === null) return;
    if (flowLoop !== null) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, context.currentTime);
    gain.gain.setValueAtTime(0.06, context.currentTime);
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 6;
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    flowLoop = {
      osc,
      gain,
    };
  };

  const stopFlowLoop = (): void => {
    if (flowLoop === null) return;
    const t = ensure()?.currentTime ?? 0;
    flowLoop.osc.stop(t + 0.05);
    flowLoop = null;
  };

  return { play, unlock, suspend, resume, startFlowLoop, stopFlowLoop };
};

export const createAudioEngine = (): Audio => createAudio();
