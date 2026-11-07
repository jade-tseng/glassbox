"use client";

// Ambient hero background — UI.md §6.3 SignalGrid. A dot field crossed by a slow diagonal wave.

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./useInView";

const PITCH = 24;
const BASE = [201, 207, 211]; // --color-line
const PEAK = [58, 75, 255]; // --color-signal
const LIVE = [184, 242, 58]; // --color-live

export function SignalGrid({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      for (let y = PITCH / 2; y < h; y += PITCH) {
        for (let x = PITCH / 2; x < w; x += PITCH) {
          const phase = (x + y * 0.6) / 140 - t * 0.8;
          const s = Math.pow(Math.max(0, Math.sin(phase)), 10);
          // A sparse second frequency picks a few peaks to flash lime.
          const spark = s > 0.92 && Math.sin(x * 12.9898 + y * 78.233) > 0.85;
          const c = spark ? LIVE : PEAK;
          const r = Math.round(BASE[0] + (c[0] - BASE[0]) * s);
          const g = Math.round(BASE[1] + (c[1] - BASE[1]) * s);
          const b = Math.round(BASE[2] + (c[2] - BASE[2]) * s);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          const size = 1.2 + s * 1.3;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    };

    const loop = (time: number) => {
      draw(time);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced) draw(2000);
      else raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && document.visibilityState === "visible";
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    const onVis = () => {
      visible = document.visibilityState === "visible";
      if (visible) start();
      else cancelAnimationFrame(raf);
    };

    resize();
    start();
    io.observe(el);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return <canvas ref={canvas} className={`pointer-events-none block h-full w-full ${className}`} aria-hidden />;
}
