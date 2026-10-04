import Link from "next/link";
import Image from "next/image";
import GameGallery from "@/components/GameGallery";
import ProfilePhoto from "@/components/ProfilePhoto";
import RandomGameButton from "@/components/RandomGameButton";
import { getAllGames } from "@/lib/games";
import { site } from "@/lib/site";

export default function Home() {
  const games = getAllGames();
  const featured = games.find((g) => g.slug === site.featured) ?? games[0];
  const genres = new Set(games.flatMap((g) => g.tags ?? []));
  const galleryGames = games.map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
    thumbnailUrl: g.thumbnailUrl,
    tags: g.tags ?? [],
  }));

  return (
    <>
      <section className="hero">
        <div className="hero-background" aria-hidden="true">
          <Image src="/images/arcade-room.webp" alt="" fill sizes="100vw" preload />
        </div>
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="pulse" aria-hidden="true" /> Now playing · {games.length} games
            </p>
            <h1>
              <span className="hero-line">Press start.</span>
              <span className="hero-line gradient-text">Play anything.</span>
            </h1>
            <p className="lede">{site.tagline}</p>
            <div className="cta-row">
              <Link href="#games" className="btn btn-primary">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play now
              </Link>
              <RandomGameButton slugs={games.map((g) => g.slug)} />
            </div>
            <dl className="stats">
              <div>
                <dt>Games</dt>
                <dd>{games.length}</dd>
              </div>
              <div>
                <dt>Genres</dt>
                <dd>{genres.size}</dd>
              </div>
              <div>
                <dt>Installs</dt>
                <dd>0</dd>
              </div>
            </dl>
          </div>
          <ProfilePhoto />
        </div>
        <a href="#games" className="scroll-hint" aria-label="Scroll to games">
          <span />
        </a>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy}>
              {games.map((g) => (
                <span key={g.slug}>
                  {g.title} <i>✦</i>{" "}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="container">
        {featured && (
          <section className="featured reveal" aria-labelledby="featured-title">
            <div className="featured-art">
              <img src={featured.thumbnailUrl} alt="" width={320} height={200} />
            </div>
            <div className="featured-copy">
              <p className="eyebrow">Featured game</p>
              <h2 id="featured-title">{featured.title}</h2>
              <p>{featured.description}</p>
              <Link href={`/play/${featured.slug}`} className="btn btn-primary">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play {featured.title}
              </Link>
            </div>
          </section>
        )}

        <section id="games" className="games-section" aria-labelledby="games-title">
          <div className="section-head">
            <p className="eyebrow">The arcade</p>
            <h2 id="games-title">Pick your game</h2>
          </div>
          <GameGallery games={galleryGames} />
        </section>
      </div>
    </>
  );
}
