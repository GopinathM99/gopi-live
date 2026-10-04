import { site } from "@/lib/site";

// Hero portrait inside an animated neon ring. Shows a placeholder until
// site.photo is set (see lib/site.ts).
export default function ProfilePhoto() {
  return (
    <div className="portrait">
      <div className="portrait-ring" aria-hidden="true" />
      <div className="portrait-inner">
        {site.photo ? (
          <img src={site.photo} alt={`Photo of ${site.name}`} width={640} height={640} />
        ) : (
          <div className="portrait-placeholder" role="img" aria-label="Photo coming soon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
            <span>Photo coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
