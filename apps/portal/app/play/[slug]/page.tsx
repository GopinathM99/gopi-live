import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllGames, getGame } from "@/lib/games";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGames().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getGame((await params).slug);
  return game ? { title: game.title, description: game.description } : {};
}

export default async function PlayPage({ params }: Props) {
  const game = getGame((await params).slug);
  if (!game) notFound();

  return (
    <div className="play">
      <Link href="/" className="back">
        ← All games
      </Link>
      <h1>{game.title}</h1>
      <div className="frame">
        {/* Games run sandboxed: scripts only, no access to the portal's origin. */}
        <iframe
          src={game.url}
          title={game.title}
          sandbox="allow-scripts allow-pointer-lock"
          allow="fullscreen; gamepad; autoplay"
        />
      </div>
      <section className="controls">
        <h2>Controls</h2>
        <ul>
          {game.controls.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
