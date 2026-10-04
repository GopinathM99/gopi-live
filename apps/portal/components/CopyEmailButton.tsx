"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "error";

export default function CopyEmailButton({ email }: { email: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  const visible = state === "copied" ? "Copied" : state === "error" ? "Try again" : "Copy";
  const label =
    state === "copied" ? "Email address copied" : state === "error" ? "Could not copy email address" : "Copy email address";

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost copy-email${state === "copied" ? " is-copied" : ""}`}
        onClick={copy}
        aria-label={label}
      >
        {state === "copied" ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="3" width="8" height="4" rx="1" />
            <path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v12A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 5H16" />
          </svg>
        )}
        <span aria-hidden="true">{visible}</span>
      </button>
      <span className="sr-only" role="status">
        {state === "copied" ? "Email address copied to clipboard." : state === "error" ? "Could not copy the email address." : ""}
      </span>
    </>
  );
}
