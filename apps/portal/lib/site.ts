/** Site-wide settings for the home page. */
export const site = {
  name: "Gopinath",
  tagline: "Games built for the browser. No installs, no sign-ups, just press start.",
  /**
   * Profile photo shown in the hero. Leave null to show the placeholder.
   * To use a real photo, put it in apps/portal/public/ (e.g. public/gopinath.jpg)
   * and set this to its URL path, e.g. "/gopinath.jpg". A square image of at
   * least 640x640 looks best.
   */
  photo: "/images/gopinath.jpg" as string | null,
  /** Slug of the game shown in the "Featured" spotlight. */
  featured: "nebula-strike",
};
