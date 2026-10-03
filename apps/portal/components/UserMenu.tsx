"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Header sign-in control. Runs in the browser so every page can stay
 * statically rendered. Renders nothing when sign-in isn't configured.
 */
export default function UserMenu() {
  const supabase = getBrowserSupabase();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase || !ready) return null;

  if (!user) {
    if (pathname === "/login") return null;
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="nav-signin">
        Sign in
      </Link>
    );
  }

  const meta = user.user_metadata as { full_name?: string; name?: string; user_name?: string; avatar_url?: string };
  const name = meta.full_name ?? meta.name ?? meta.user_name ?? user.email ?? "Player";

  return (
    <div className="user-menu">
      {meta.avatar_url ? (
        <img src={meta.avatar_url} alt="" className="user-avatar" width={30} height={30} referrerPolicy="no-referrer" />
      ) : (
        <span className="user-avatar user-avatar-fallback" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="user-name">{name}</span>
      <button type="button" className="nav-signout" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}
