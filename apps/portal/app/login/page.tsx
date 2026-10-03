import type { Metadata } from "next";
import Link from "next/link";
import SignInButtons from "@/components/SignInButtons";
import { authEnabled, safeNext } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="container auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="logo-mark auth-mark" aria-hidden="true" />
        <h1 id="auth-title">Sign in to gopi.live</h1>
        <p className="auth-lede">Save your progress and get on the leaderboards. Every game still plays without an account.</p>

        {error && (
          <p className="auth-error" role="alert">
            Sign-in didn&apos;t go through. Please try again.
          </p>
        )}

        {authEnabled ? (
          <SignInButtons next={safeNext(next)} />
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
