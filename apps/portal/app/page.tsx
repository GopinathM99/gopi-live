import Link from "next/link";
import { getAllGames } from "@/lib/games";

export default function Home() {
  const games = getAllGames();
  return (
    <>
      <h1>Games</h1>
      <ul className="game-grid">
        {games.map((game) => (
          <li key={game.slug}>
            <Link href={`/play/${game.slug}`} className="game-card">
              <img src={game.thumbnailUrl} alt="" width={320} height={200} />
              <h2>{game.title}</h2>
              <p>{game.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
