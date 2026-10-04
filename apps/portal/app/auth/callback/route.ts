import { NextResponse, type NextRequest } from "next/server";
import { chosenAvatar } from "@/lib/avatars";
import { safeNext } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Google and GitHub send the player back here after they approve sign-in.
 * We swap the one-time code for a session cookie, then return them to
 * where they started. Players who haven't picked an avatar yet go to the
 * avatar picker first.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await getServerSupabase();
  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!chosenAvatar(data.user)) {
        return NextResponse.redirect(`${origin}/avatar?welcome=1&next=${encodeURIComponent(next)}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=1&next=${encodeURIComponent(next)}`);
}
