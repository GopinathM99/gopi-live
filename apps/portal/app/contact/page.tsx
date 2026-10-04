import type { Metadata } from "next";
import Image from "next/image";
import CopyEmailButton from "@/components/CopyEmailButton";
import { contact, type ContactProfile } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Gopinath Merugumala by email, or find him on LinkedIn, GitHub, Salesforce Trailblazer, and his personal site.",
};

export default function ContactPage() {
  return (
    <>
    <section className="hero contact-hero">
      <div className="hero-background" aria-hidden="true">
        <Image src="/images/arcade-room.webp" alt="" fill sizes="100vw" preload />
      </div>
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Get in touch</p>
          <h1>
            <span className="hero-line">Say hello.</span>
            <span className="hero-line gradient-text wrap">{contact.name}</span>
          </h1>
          <p className="lede">
            Questions about the games, a collaboration, or just a hello. Email is the direct line. The profiles below are public.
          </p>
        </div>
        <div className="portrait">
          <div className="portrait-ring" aria-hidden="true" />
          <div className="portrait-inner">
            <Image
              src="/images/gopinath-profile.jpg"
              alt="Gopinath Merugumala"
              fill
              preload
              sizes="(max-width: 860px) 70vw, 380px"
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </div>
        </div>
      </div>
    </section>
    <div className="container contact-section">
        <ul className="contact-list">
          <li className="contact-item contact-item-email reveal" data-kind="email">
            <a className="contact-email-link" href={`mailto:${contact.email}`}>
              <span className="contact-icon" aria-hidden="true">
                <MailIcon />
              </span>
              <span className="contact-text">
                <span className="contact-label">Email</span>
                <span className="contact-value">{contact.email}</span>
              </span>
            </a>
            <CopyEmailButton email={contact.email} />
          </li>
          {contact.profiles.map((profile, index) => (
            <li
              key={profile.id}
              className="contact-item reveal"
              data-kind={profile.id}
              style={{ animationDelay: `${0.08 * (index + 1)}s` }}
            >
              <ProfileLink profile={profile} />
            </li>
          ))}
        </ul>
    </div>
    </>
  );
}

function ProfileLink({ profile }: { profile: ContactProfile }) {
  return (
    <a className="contact-row" href={profile.href} target="_blank" rel="noopener noreferrer">
      <span className="contact-icon" aria-hidden="true">
        <ProfileIcon id={profile.id} />
      </span>
      <span className="contact-text">
        <span className="contact-label">{profile.label}</span>
        <span className="contact-value">{profile.handle}</span>
      </span>
      <span className="contact-external" aria-hidden="true">
        <ExternalIcon />
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5" />
      <path d="M19 5 10 14" />
      <path d="M17 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5" />
    </svg>
  );
}

function ProfileIcon({ id }: { id: ContactProfile["id"] }) {
  switch (id) {
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.84v1.98h.05c.53-1.01 1.84-2.08 3.79-2.08 4.05 0 4.8 2.67 4.8 6.14V23h-4v-6.86c0-1.64-.03-3.75-2.28-3.75-2.28 0-2.63 1.78-2.63 3.62V23h-4V8.5z"
          />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
      );
    case "trailblazer":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7.2 18.5h9.4a4.15 4.15 0 0 0 .55-8.26 5.35 5.35 0 0 0-10.28 1.55A3.7 3.7 0 0 0 7.2 18.5z"
          />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.25" />
          <path d="M3.75 12h16.5" />
          <path d="M12 3.75c2.2 2.35 3.3 5.15 3.3 8.25s-1.1 5.9-3.3 8.25c-2.2-2.35-3.3-5.15-3.3-8.25s1.1-5.9 3.3-8.25z" />
        </svg>
      );
  }
}
