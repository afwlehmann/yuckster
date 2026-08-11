# AGENTS.md — Yuckster

## Development environment

All development tasks MUST run inside the Nix dev shell. Enter it with:

```
nix develop
```

Or run a one-off command without entering the interactive shell:

```
nix develop -c <command>
```

### Why

The flake provides a pinned Node.js 22, git, nixfmt, and pre-commit hooks
(prettier, eslint, nixfmt). Running `npm` or `npx` outside `nix develop` will
use whatever is on `$PATH` — which may be the wrong version or missing entirely.
The `opencode.json` permission config denies bare `npm` and `npx` commands and
only allows `nix develop -c *`.

## Common tasks

| Task        | Command                             |
| ----------- | ----------------------------------- |
| Dev server  | `nix develop -c npm run dev`        |
| Build       | `nix develop -c npm run build`      |
| Typecheck   | `nix develop -c npm run typecheck`  |
| Lint        | `nix develop -c npm run lint`       |
| Format      | `nix develop -c npm run format`     |
| Tests       | `nix develop -c npm run test`       |
| Watch tests | `nix develop -c npm run test:watch` |
| Flake check | `nix flake check`                   |
| Nix format  | `nix fmt`                           |

## Before committing

Run these (all via `nix develop -c`):

```
nix develop -c npm run typecheck
nix develop -c npm run lint
nix develop -c npm run build
nix develop -c npm run test
nix fmt
```

Pre-commit hooks (prettier, eslint, nixfmt) auto-install on `nix develop` via
`shellHook` and run on `git commit`.

## Project structure

- `src/game/` — pure game logic (pieces, board, flow, state, difficulty)
- `src/render/` — canvas rendering (sprites, board, hud, parallax, biplane, font, gameover)
- `src/screen.ts` — screen machine (menu/game/pause/keybindings/gameover)
- `src/audio.ts` — WebAudio chiptune SFX
- `src/music.ts` — HTMLAudioElement streaming music
- `src/main.ts` — bootstrap (canvas + audio + RAF loop)
- `public/` — static assets (MP3s, PNGs, beat data JSON)
- `src/game/*.test.ts` — vitest unit tests

## Conventions

- **Functional style**: `const` only (no `let`), array methods for iteration,
  pure functions, immutable state records.
- **No comments** unless explicitly requested.
- **No runtime dependencies** — vanilla Canvas 2D + WebAudio + HTMLAudioElement.
- Use `.js` extension in TypeScript imports (ESM).

## Render geometry

- `VIEW_W=640`, `VIEW_H=480`, `HUD_H=48`, `GRID_SIZE=8`, `TILE=48`
- `GRID_PX=384`, `GRID_X=128`, `GRID_Y=56` (HUD_H + 8), grid bottom at 440
- Sprite size = `TILE` = 48; `PIPE_HALF=24`, `RIM_HALF=12`, `BODY_HALF=9`,
  `CHANNEL_HALF=6` (all exported from `sprites.ts`)
- Board clip rects in `board.ts` import `CHANNEL_HALF` from `sprites.ts`

## Audio

- SFX: `master.gain.value = 0.4` in `audio.ts`
- Music: `TARGET_VOL = 0.5` in `music.ts`
- Game over: `game-over.mp3` played via `HTMLAudioElement`; bass-beat timestamps
  pre-analyzed with ffmpeg into `public/game-over-beats.json` (lowpass f=80,
  10ms frames, 2.5× energy threshold, absolute floor 0.14, 150ms min gap)
- `m`/`M` toggles music from any screen

## Commit rules

- commitlint: type ∈ [build,chore,ci,docs,feat,fix,perf,refactor,revert,style,test]
- subject must be lowercase (not sentence-case)
- commit cmd: `git add -A && PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "..."`
- lint-staged runs prettier + eslint on `*.ts`; nixfmt on `*.nix`
