import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Shape of games/<slug>/game.json. */
export type GameManifest = {
  title: string;
  description: string;
  /** Path relative to the game folder, e.g. "thumbnail.svg". */
  thumbnail: string;
  /** HTML entry point relative to the game folder, e.g. "index.html". */
  entry: string;
  /** Extra room for games with a board and controls stacked on mobile. */
  layout?: "tall";
  /** Human-readable control hints shown next to the game. */
  controls: string[];
  tags?: string[];
};

export type Game = GameManifest & {
  slug: string;
  /** Public URL of the entry point, e.g. /games/snake/index.html. */
  url: string;
  thumbnailUrl: string;
};

const GAMES_DIR = path.join(process.cwd(), "..", "..", "games");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function parseManifest(slug: string, raw: unknown): GameManifest {
  const m = raw as Record<string, unknown>;
  const fail = (msg: string) => {
    throw new Error(`games/${slug}/game.json: ${msg}`);
  };
  for (const key of ["title", "description", "thumbnail", "entry"] as const) {
    if (typeof m?.[key] !== "string" || m[key] === "") fail(`"${key}" must be a non-empty string`);
  }
  if (!isStringArray(m.controls)) fail(`"controls" must be an array of strings`);
  if (m.tags !== undefined && !isStringArray(m.tags)) fail(`"tags" must be an array of strings`);
  if (m.layout !== undefined && m.layout !== "tall") fail(`"layout" must be "tall" when provided`);
  return m as unknown as GameManifest;
}

function loadGame(slug: string): Game {
  const dir = path.join(GAMES_DIR, slug);
  const manifest = parseManifest(slug, JSON.parse(readFileSync(path.join(dir, "game.json"), "utf8")));
  for (const file of [manifest.entry, manifest.thumbnail]) {
    if (!existsSync(path.join(dir, file))) {
      throw new Error(`games/${slug}/game.json references missing file "${file}"`);
    }
  }
  return {
    ...manifest,
    slug,
    url: `/games/${slug}/${manifest.entry}`,
    thumbnailUrl: `/games/${slug}/${manifest.thumbnail}`,
  };
}

/** Reads every games/<slug>/game.json at build time, sorted by title. */
export function getAllGames(): Game[] {
  return readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLUG_RE.test(d.name))
    .filter((d) => existsSync(path.join(GAMES_DIR, d.name, "game.json")))
    .map((d) => loadGame(d.name))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getGame(slug: string): Game | undefined {
  return getAllGames().find((g) => g.slug === slug);
}
