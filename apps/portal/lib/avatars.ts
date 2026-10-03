import type { User } from "@supabase/supabase-js";

/**
 * Gamer avatars players can pick after signing in. The artwork lives in
 * public/avatars/<id>.svg. The chosen id is saved on the Supabase user
 * (user_metadata.gamer_avatar), so it follows the player across devices
 * and stays put until they pick another one.
 */
export const avatars = [
  { id: "pixel-knight", name: "Pixel Knight" },
  { id: "neon-ninja", name: "Neon Ninja" },
  { id: "robo", name: "Robo" },
  { id: "alien", name: "Alien" },
  { id: "space-ace", name: "Space Ace" },
  { id: "dragon", name: "Dragon" },
  { id: "cyber-cat", name: "Cyber Cat" },
  { id: "glitch-skull", name: "Glitch Skull" },
  { id: "wizard", name: "Wizard" },
  { id: "slime", name: "Slime" },
  { id: "fox-ranger", name: "Fox Ranger" },
  { id: "ghost", name: "Ghost" },
  { id: "viking", name: "Viking" },
  { id: "panda-gamer", name: "Panda Gamer" },
  { id: "pixel-pad", name: "Pixel Pad" },
] as const;

export type AvatarId = (typeof avatars)[number]["id"];

/** user_metadata key. Kept apart from avatar_url, which Google and GitHub overwrite on every sign-in. */
export const AVATAR_KEY = "gamer_avatar";

export function avatarSrc(id: AvatarId): string {
  return `/avatars/${id}.svg`;
}

/** The player's saved avatar, or null if they haven't picked one (or it's no longer offered). */
export function chosenAvatar(user: User | null | undefined): AvatarId | null {
  const id = user?.user_metadata?.[AVATAR_KEY];
  return avatars.some((a) => a.id === id) ? (id as AvatarId) : null;
}
