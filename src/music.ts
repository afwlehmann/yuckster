// Streaming music playback via HTMLAudioElement. Two looping MP3 tracks
// (menu and in-game) are crossfaded on screen transitions. Like the WebAudio
// SFX engine, playback must be unlocked by a user gesture due to browser
// autoplay policy; until then calls are deferred.

export interface Music {
  /** Begin menu track, fading out any other track. */
  readonly playMenu: () => void;
  /** Begin in-game track, fading out any other track. */
  readonly playGame: () => void;
  /** Stop all music (fades out). */
  readonly stop: () => void;
  /** Suspend playback (pause element) — used when game is paused. */
  readonly suspend: () => void;
  /** Resume suspended playback. */
  readonly resume: () => void;
  /** Unlock audio on first user gesture; starts the menu track if queued. */
  readonly unlock: () => void;
  /** Toggle music on/off. Returns true if now enabled. */
  readonly toggle: () => boolean;
  /** True if music is currently muted. */
  readonly isMuted: () => boolean;
}

const BASE = import.meta.env.BASE_URL;
const MENU_SRC = `${BASE}slime-pipe-relay-main-menu.mp3`;
const GAME_SRC = `${BASE}slime-pipe-relay-in-game.mp3`;
const FADE_MS = 800;
const TARGET_VOL = 0.5;

type Track = 'menu' | 'game';

const buildMusic = (): Music => {
  const menuEl = new Audio(MENU_SRC);
  const gameEl = new Audio(GAME_SRC);
  menuEl.loop = true;
  gameEl.loop = true;
  menuEl.preload = 'auto';
  gameEl.preload = 'auto';

  let unlocked = false;
  let current: Track | null = null;
  let pending: Track | null = 'menu';
  let suspended = false;
  let muted = false;
  let mutedTrack: Track | null = null;

  const fadeTo = (el: HTMLAudioElement, target: number): void => {
    const start = el.volume;
    const steps = 16;
    let i = 0;
    const tick = (): void => {
      i += 1;
      el.volume = start + (target - start) * (i / steps);
      if (i < steps) {
        window.setTimeout(tick, FADE_MS / steps);
      }
    };
    tick();
  };

  const startTrack = (track: Track): void => {
    const el = track === 'menu' ? menuEl : gameEl;
    const other = track === 'menu' ? gameEl : menuEl;
    if (current === track) return;
    if (current !== null) {
      fadeTo(other, 0);
      window.setTimeout(() => {
        other.pause();
        other.currentTime = 0;
      }, FADE_MS + 50);
    }
    el.volume = 0;
    void el.play().catch(() => {
      // Autoplay blocked — will retry on unlock.
    });
    fadeTo(el, TARGET_VOL);
    current = track;
  };

  const playMenu = (): void => {
    if (muted) {
      mutedTrack = 'menu';
      return;
    }
    if (!unlocked) {
      pending = 'menu';
      return;
    }
    suspended = false;
    startTrack('menu');
  };

  const playGame = (): void => {
    if (muted) {
      mutedTrack = 'game';
      return;
    }
    if (!unlocked) {
      pending = 'game';
      return;
    }
    suspended = false;
    startTrack('game');
  };

  const stop = (): void => {
    if (current !== null) {
      const el = current === 'menu' ? menuEl : gameEl;
      fadeTo(el, 0);
      window.setTimeout(() => {
        el.pause();
        el.currentTime = 0;
      }, FADE_MS + 50);
    }
    current = null;
    pending = null;
  };

  const suspend = (): void => {
    if (current !== null) {
      const el = current === 'menu' ? menuEl : gameEl;
      el.pause();
    }
    suspended = true;
  };

  const resume = (): void => {
    if (current !== null && suspended) {
      const el = current === 'menu' ? menuEl : gameEl;
      void el.play().catch(() => {});
    }
    suspended = false;
  };

  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    if (pending !== null) {
      const track = pending;
      pending = null;
      startTrack(track);
    }
  };

  const toggle = (): boolean => {
    muted = !muted;
    if (muted) {
      mutedTrack = current;
      menuEl.pause();
      gameEl.pause();
      current = null;
    } else if (mutedTrack !== null) {
      const track = mutedTrack;
      mutedTrack = null;
      if (unlocked) {
        startTrack(track);
      }
    }
    return !muted;
  };

  const isMuted = (): boolean => muted;

  return { playMenu, playGame, stop, suspend, resume, unlock, toggle, isMuted };
};

export const createMusic = (): Music => buildMusic();
