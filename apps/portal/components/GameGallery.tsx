"use client";

import Link from "next/link";
import { useMemo, useState, type PointerEvent } from "react";

export type GalleryGame = {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  tags: string[];
};

const ALL = "all";

// Tilts a card toward the pointer and moves its glare highlight. Skipped for
// touch input and when the user prefers reduced motion.
function tilt(e: PointerEvent<HTMLAnchorElement>) {
  if (e.pointerType !== "mouse") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
  el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
  el.style.setProperty("--mx", `${x * 100}%`);
  el.style.setProperty("--my", `${y * 100}%`);
}

function untilt(e: PointerEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}

export default function GameGallery({ games }: { games: GalleryGame[] }) {
  const [tag, setTag] = useState(ALL);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [games]);
  const shown = tag === ALL ? games : games.filter((g) => g.tags.includes(tag));

  return (
    <>
      <div className="filters" role="group" aria-label="Filter games by tag">
        {[ALL, ...tags].map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            aria-pressed={tag === t}
            onClick={() => setTag(t)}
          >
            {t === ALL ? "All games" : t}
          </button>
        ))}
      </div>

      <ul className="game-grid">
        {shown.map((game, i) => (
          <li key={game.slug} className="reveal" style={{ animationDelay: `${i * 60}ms` }}>
            <Link
              href={`/play/${game.slug}`}
              className="game-card"
              onPointerMove={tilt}
              onPointerLeave={untilt}
            >
              <div className="game-thumb">
                <img src={game.thumbnailUrl} alt="" width={320} height={200} />
                <span className="play-overlay" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
              <div className="game-body">
                <h3>{game.title}</h3>
                <p>{game.description}</p>
                {game.tags.length > 0 && (
                  <ul className="tags">
                    {game.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="glare" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
