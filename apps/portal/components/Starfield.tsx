"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; hue: number };

const COLORS = [180, 280, 320, 48]; // cyan, violet, pink, gold

// Drifting, twinkling starfield behind the hero. Stars shift with the pointer
// for a parallax feel. With prefers-reduced-motion it draws one still frame.
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(220, (w * h) / 5000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1,
        hue: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      for (const s of stars) {
        const px = s.x + pointer.x * s.z * 24;
        const py = s.y + pointer.y * s.z * 24;
        const twinkle = 0.55 + 0.45 * Math.sin(t * 0.03 + s.x);
        const r = s.z * 1.6;
        ctx.globalAlpha = s.z * twinkle;
        ctx.fillStyle = `hsl(${s.hue} 90% 75%)`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      t++;
      for (const s of stars) {
        s.y -= s.z * 0.35;
        if (s.y < -4) {
          s.y = h + 4;
          s.x = Math.random() * w;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) draw();
      else raf = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };

    const onResize = () => {
      resize();
      if (reduce.matches) draw();
    };

    resize();
    start();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer);
    reduce.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      reduce.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
