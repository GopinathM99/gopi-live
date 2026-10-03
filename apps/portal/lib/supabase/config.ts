/**
 * Supabase settings for sign-in. Both values come from Vercel env vars
 * (Project → Settings → Environment Variables). When either is missing,
 * sign-in is turned off and the site works exactly as before.
 *
 * They must be read as literal `process.env.NEXT_PUBLIC_*` expressions so
 * Next.js can inline them into the browser bundle at build time.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = url && key ? { url, key } : null;

export const authEnabled = supabaseConfig !== null;

export type OAuthProvider = "google" | "github";

/** Only same-site paths are allowed as post-sign-in destinations. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
