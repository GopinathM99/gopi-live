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

Sudoku puzzle-generation checks run with `node --test tests/sudoku.test.cjs`.

## Home page photo

The hero shows a placeholder portrait until a photo is set. Drop a square
image (640x640 or larger) into `apps/portal/public/`, e.g.
`public/gopinath.jpg`, then set `photo: "/gopinath.jpg"` in
`apps/portal/lib/site.ts`. The same file picks the featured game.

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
   Games with vertically stacked controls can also set `"layout": "tall"`
   for a taller, responsive frame (see Sudoku).

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

## Sign-in (Google and GitHub)

Sign-in uses Supabase Auth. Until the two env vars below are set, the
"Sign in" link stays hidden and `/login` says sign-in isn't switched on, so
the site works without it.

1. Create a project at [supabase.com](https://supabase.com). From
   **Project Settings > API**, copy the Project URL and the publishable
   (anon) key.
2. In Supabase **Authentication > URL Configuration**, set Site URL to
   `https://www.gopi.live` and add these Redirect URLs:
   `https://www.gopi.live/auth/callback`,
   `https://*-gopinath-merugumalas-projects.vercel.app/auth/callback` (previews) and
   `http://localhost:3000/auth/callback` (local dev).
3. GitHub: create an OAuth App at GitHub **Settings > Developer settings >
   OAuth Apps**. Homepage URL `https://www.gopi.live`; Authorization callback
   URL `https://<project-ref>.supabase.co/auth/v1/callback`. Paste its Client
   ID and a new Client Secret into Supabase **Authentication > Providers >
   GitHub** and enable it.
4. Google: in Google Cloud Console, configure the OAuth consent screen, then
   create an OAuth client ID (type "Web application") with authorized
   redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Paste
   the Client ID and secret into Supabase **Authentication > Providers >
   Google** and enable it.
5. In Vercel (project gopi-live, **Settings > Environment Variables**), add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for
   Production and Preview, then redeploy. For local dev, put the same two
   lines in `apps/portal/.env.local`.

After their first sign-in, players are asked to pick a gamer avatar
(`/avatar`). The choice is saved on their Supabase user as
`user_metadata.gamer_avatar`, so it sticks across sign-ins and devices until
they change it by clicking their avatar in the header. The avatars are SVGs in
`apps/portal/public/avatars/`, listed in `apps/portal/lib/avatars.ts`.

## Not here yet

Saves and leaderboards (Supabase), WebAssembly builds for C++/Rust/Unity/
Godot games (GitHub Actions), large assets in object storage, multiplayer, and
serving games from a separate `play.gopi.live` origin.
