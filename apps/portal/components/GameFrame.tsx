"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; title: string };

// Wraps a game's iframe with a maximize/restore button. Uses the Fullscreen API
// when the browser allows it, and otherwise (e.g. iPhone Safari) fills the window.
export default function GameFrame({ src, title }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [windowFill, setWindowFill] = useState(false);
  const maximized = fullscreen || windowFill;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // In window-fill mode, Esc restores and the page behind must not scroll.
  useEffect(() => {
    if (!windowFill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWindowFill(false);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [windowFill]);

  // Hand keyboard focus back to the game after resizing.
  useEffect(() => {
    iframeRef.current?.focus();
  }, [maximized]);

  async function toggle() {
    if (fullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (windowFill) {
      setWindowFill(false);
      return;
    }
    const el = frameRef.current;
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // Fall through to window fill.
      }
    }
    setWindowFill(true);
  }

  return (
    <div ref={frameRef} className={windowFill ? "frame frame-fill" : "frame"}>
      {/* Games run sandboxed: scripts only, no access to the portal's origin. */}
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        sandbox="allow-scripts allow-pointer-lock"
        allow="fullscreen; gamepad; autoplay"
      />
      <button
        type="button"
        className="frame-toggle"
        onClick={toggle}
        aria-label={maximized ? "Restore game size" : "Maximize game"}
        title={maximized ? "Restore (Esc)" : "Maximize"}
      >
        {maximized ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        )}
      </button>
    </div>
  );
}
