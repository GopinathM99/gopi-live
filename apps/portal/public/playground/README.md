# gopi.playground

A separate, static prototype arcade for trying games before adding them to gopi.live. This directory is served as a standalone site on the branch’s Vercel preview URL; the production game catalog does not import these files.

## Play locally

From this directory, run `python3 -m http.server 4173`, then open the local server in a browser. There is no package install, build step, backend, or external CDN dependency.

- **Stack Attack:** tap the canvas, use Drop block, or press Space to stack. Overhang is trimmed; perfect streaks gradually recover width. P pauses. A best score is stored in this browser when storage is available.
- **Tiny Golf:** six courses with walls, sand, linked portals, bumpers, and a moving gate. Drag back anywhere on the course and release, or adjust the aim/power sliders and choose Putt. Arrow keys adjust aim and power; Space shoots; P pauses. Reset hole is available for practice.
- The catalog shortlist is local to the browser. Copy picks into chat to request promotion; nothing is submitted to a server.

## Test

Run `node --test tests/engines.test.cjs` here. The tests cover stacking overlap, perfect drops, collisions, friction, sand, portals, and complete playable shot sequences for every golf course.

Browser validation covers catalog navigation, persisted picks, Stack Attack placement/pause/restart, all six golf holes and the scorecard, touch dragging, and layouts at 320, 390, 768, and desktop widths.

## Hosting and review

The source lives in `apps/portal/public/playground/` on the `codex/game-playground-site` preview branch of `GopinathM99/gopi-live`. Its separate website is at the branch's Vercel preview address followed by `/playground/index.html`. Vercel's existing GitHub integration deploys the review branch automatically; no main-branch changes or production deployment are needed. Preview access follows the existing Vercel project's authentication settings.

Keep this preview-only PR in draft and unmerged. Do not merge an assistant-created PR. After a game is approved, open a separate integration PR for just that game. Keep the playground branch so its preview remains available.

GitHub repository creation and enabling Pages were unavailable to the connected integration, so this uses the existing Vercel preview workflow. No GitHub Pages site or new remote repository was created.

## Adding and promoting games

Each `games/<slug>/` directory is a self-contained browser bundle with an HTML entry point, scripts, styles, thumbnail, and `game.json`. All local URLs are relative so the site works beneath the preview’s `/playground/` path.

Plain canvas and JavaScript engine games (Three.js, Phaser, PixiJS, Babylon.js, PlayCanvas) can use this structure. Keep runtime assets with the bundle. Single-threaded Unity/Godot/C++/Rust WebAssembly exports can also be hosted after their export/build pipeline is prepared. Threaded WebAssembly requiring cross-origin isolation needs hosting that can supply the required COOP/COEP headers; the current standalone bundles do not configure these response headers. Backend multiplayer needs separate services and credentials; this playground has none.

After approval, copy the selected game bundle into the production `games/` directory in a separate integration PR, adapt its Playground navigation, and verify it inside the portal's sandboxed iframe. Storage failures are already handled. Assets and entry points are represented by the same manifest shape used by the production catalog.
