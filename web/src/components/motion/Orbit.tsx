"use client";

// Orbit diagram — UI.md §7 Loop illustration. predict → measure → update, with the gate at the center.

import { useEffect, useRef } from "react";
import { useInView, usePrefersReducedMotion } from "./useInView";

const RINGS = [
  { rx: 70, ry: 26, dur: 24, color: "var(--color-cobalt)", label: "PREDICT", phase: 0.2 },
  { rx: 120, ry: 46, dur: 32, color: "var(--color-cyan)", label: "MEASURE", phase: 2.1 },
  { rx: 170, ry: 66, dur: 40, color: "var(--color-violet)", label: "UPDATE", phase: 4.0 },
];

export function Orbit() {
  const { ref, inView } = useInView<SVGSVGElement>("0px");
  const reduced = usePrefersReducedMotion();
  const nodes = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    const place = (t: number) => {
      RINGS.forEach((r, i) => {
        const a = r.phase + (t / r.dur) * Math.PI * 2;
        const n = nodes.current[i];
        n?.setAttribute("cx", String(Math.cos(a) * r.rx));
        n?.setAttribute("cy", String(Math.sin(a) * r.ry));
      });
    };
    if (reduced || !inView) {
      place(0);
      return;
    }
    let raf = 0;
    const loop = (now: number) => {
      place(now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced]);

  return (
    <svg ref={ref} viewBox="-200 -100 400 200" className="block w-full" aria-hidden>
      {RINGS.map((r) => (
        <g key={r.label}>
          <ellipse rx={r.rx} ry={r.ry} fill="none" stroke="var(--color-line)" strokeDasharray="3 4" />
          <text x={0} y={-r.ry - 5} textAnchor="middle" className="font-mono" fontSize={8} letterSpacing="0.08em" fill="var(--color-muted)">
            {r.label}
          </text>
        </g>
      ))}
      {RINGS.map((r, i) => (
        <circle
          key={r.label}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          r={5}
          fill={r.color}
          stroke="var(--color-ink)"
          strokeWidth={1}
        />
      ))}
      {/* The gate sits at the center: every loop passes through it. */}
      <rect x={-11} y={-11} width={22} height={22} rx={3} fill="var(--color-white)" stroke="var(--color-ink)" />
      <circle r={3} fill="var(--color-live)" />
      <text y={26} textAnchor="middle" className="font-mono" fontSize={8} letterSpacing="0.08em" fill="var(--color-ink)">
        GATE
      </text>
    </svg>
  );
}
