# gopi.live

A hub for browser games. The portal is a Next.js app; every game is a
self-contained static bundle served at `/games/<slug>/` and played inside a
sandboxed iframe.

## Layout

```
apps/portal/              Next.js portal (catalog + play pages), deployed to Vercel
  lib/games.ts            reads games/*/game.json at build time
  scripts/sync-games.mjs  copies games/ into public/games/ before dev and build
games/<slug>/             one folder per game
  game.json               manifest that drives the catalog
  index.html …            the game's static files
```

## Getting started

Requires Node 20+ and pnpm (`corepack enable` picks up the pinned version).

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build of the portal
pnpm typecheck
```

## Adding a game

1. Create `games/<slug>/` (lowercase letters, digits and dashes).
2. Put the game's static files in it, with an HTML entry point.
3. Add a `game.json`:

   ```json
   {
     "title": "Snake",
     "description": "One sentence shown on the catalog card.",
     "thumbnail": "thumbnail.svg",
     "entry": "index.html",
     "controls": ["Arrow keys to steer", "Space to pause"],
     "tags": ["arcade"]
   }
   ```

   `thumbnail` and `entry` are paths relative to the game folder. The build
   fails if a required field is missing or a referenced file doesn't exist.

4. Run `pnpm dev`; the game appears on the home page and plays at
   `/play/<slug>`.

### What a game can and can't do

Games run in `<iframe sandbox="allow-scripts allow-pointer-lock">`, so they
get an opaque origin: no access to the portal's cookies or DOM, and
`localStorage` throws. Wrap storage calls in `try/catch` (see
`games/snake/game.js`). Saves and leaderboards will come from a backend later.

Everything under `/games/*` is served with `Cross-Origin-Opener-Policy:
same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (see
`apps/portal/next.config.ts`), so games opened directly at `/games/<slug>/`
are cross-origin isolated. Load assets from the game's own folder, or from
hosts that send CORP/CORS headers. Note that a framed game only gets
`SharedArrayBuffer` if the page embedding it is isolated too; that gets
decided when the first threaded WebAssembly game lands.

## Deploying to Vercel

Import the repo and set the project's **Root Directory** to `apps/portal`.
Keep "Include source files outside of the Root Directory" enabled (the
default), since the build copies games from `../../games`.

## Not here yet

Auth, saves and leaderboards (Supabase), WebAssembly builds for C++/Rust/Unity/
Godot games (GitHub Actions), large assets in object storage, multiplayer, and
serving games from a separate `play.gopi.live` origin.
