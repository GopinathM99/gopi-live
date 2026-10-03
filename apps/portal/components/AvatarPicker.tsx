"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AVATAR_KEY, avatarSrc, avatars, chosenAvatar, type AvatarId } from "@/lib/avatars";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Grid of gamer avatars. Saves the pick on the Supabase user, then returns to `next`. */
export default function AvatarPicker({ next }: { next: string }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<AvatarId | null>(null);
  const [selected, setSelected] = useState<AvatarId | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent(`/avatar?next=${encodeURIComponent(next)}`)}`);
        return;
      }
      const current = chosenAvatar(data.user);
      setSaved(current);
      setSelected(current);
      setReady(true);
    });
  }, [supabase, router, next]);

  async function save() {
    if (!supabase || !selected) return;
    setSaving(true);
    setFailed(false);
    const { error } = await supabase.auth.updateUser({ data: { [AVATAR_KEY]: selected } });
    if (error) {
      setSaving(false);
      setFailed(true);
      return;
    }
    router.push(next);
  }

  if (!ready) return <p className="auth-note">Loading…</p>;

  return (
    <div className="avatar-picker">
      <div className="avatar-grid" role="radiogroup" aria-label="Avatars">
        {avatars.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected === a.id}
            className="avatar-option"
            onClick={() => setSelected(a.id)}
          >
            <img src={avatarSrc(a.id)} alt="" width={72} height={72} />
            <span>{a.name}</span>
          </button>
        ))}
      </div>

      {failed && (
        <p className="auth-error" role="alert">
          Couldn&apos;t save your avatar. Please try again.
        </p>
      )}

      <div className="avatar-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!selected || saving || selected === saved}
          onClick={save}
        >
          {saving ? "Saving…" : saved ? "Save avatar" : "Choose avatar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.push(next)}>
          {saved ? "Cancel" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
