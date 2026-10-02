"use client";

import { useRouter } from "next/navigation";

export default function RandomGameButton({ slugs }: { slugs: string[] }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => router.push(`/play/${slugs[Math.floor(Math.random() * slugs.length)]}`)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
        <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      </svg>
      Surprise me
    </button>
  );
}
