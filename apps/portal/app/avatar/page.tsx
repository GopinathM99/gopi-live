import type { Metadata } from "next";
import Link from "next/link";
import AvatarPicker from "@/components/AvatarPicker";
import { authEnabled, safeNext } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Choose your avatar" };

export default async function AvatarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; welcome?: string }>;
}) {
  const { next, welcome } = await searchParams;

  return (
    <div className="container auth-page">
      <section className="auth-card avatar-card" aria-labelledby="avatar-title">
        <h1 id="avatar-title">{welcome ? "Pick your avatar" : "Change your avatar"}</h1>
        <p className="auth-lede">
          {welcome
            ? "Choose who you play as. You can change it any time from the menu up top."
            : "Your avatar shows next to your name across gopi.live."}
        </p>

        {authEnabled ? (
          <AvatarPicker next={safeNext(next)} />
        ) : (
          <p className="auth-note">Sign-in isn&apos;t switched on yet. Check back soon.</p>
        )}

        <Link href="/" className="auth-back">
          Back to the games
        </Link>
      </section>
    </div>
  );
}
