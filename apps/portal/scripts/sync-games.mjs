// Copies every games/<slug>/ folder into public/games/<slug>/ so Next.js
// serves each game as a static bundle at /games/<slug>/.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const portalDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const gamesDir = join(portalDir, "..", "..", "games");
const outDir = join(portalDir, "public", "games");

rmSync(outDir, { recursive: true, force: true });

const slugs = readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(gamesDir, d.name, "game.json")))
  .map((d) => d.name);

for (const slug of slugs) {
  cpSync(join(gamesDir, slug), join(outDir, slug), { recursive: true });
}

console.log(`sync-games: copied ${slugs.length} game(s) to public/games/`);
