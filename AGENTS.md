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
- `src/render/` — canvas rendering (sprites, board, hud, parallax, biplane, font)
- `src/screen.ts` — screen machine (menu/game/pause/keybindings)
- `src/audio.ts` — WebAudio chiptune SFX
- `src/music.ts` — HTMLAudioElement streaming music
- `src/main.ts` — bootstrap (canvas + audio + RAF loop)
- `public/` — static assets (MP3s, PNGs)
- `src/game/*.test.ts` — vitest unit tests

## Conventions

- **Functional style**: `const` only (no `let`), array methods for iteration,
  pure functions, immutable state records.
- **No comments** unless explicitly requested.
- **No runtime dependencies** — vanilla Canvas 2D + WebAudio + HTMLAudioElement.
- Use `.js` extension in TypeScript imports (ESM).
