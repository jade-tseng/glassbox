"use client";

// Orbit diagram — UI.md §7 Loop illustration. hypothesis → observed → inferred → updated, through the gate (a portal).

import { useEffect, useRef } from "react";
import { useInView, usePrefersReducedMotion } from "./useInView";

const RINGS = [
  { rx: 58, ry: 22, dur: 22, color: "var(--color-cobalt)", label: "HYPOTHESIS", phase: 0.2 },
  { rx: 98, ry: 38, dur: 28, color: "var(--color-cyan)", label: "OBSERVED", phase: 1.7 },
  { rx: 138, ry: 54, dur: 34, color: "var(--color-violet)", label: "INFERRED", phase: 3.2 },
  { rx: 178, ry: 70, dur: 40, color: "var(--color-mint)", label: "UPDATED", phase: 4.7 },
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
      {/* The gate is a portal: an arch every loop has to pass through, with the live light inside. */}
      <path d="M-11,13 V-1 A11,11 0 0 1 11,-1 V13 Z" fill="var(--color-white)" stroke="var(--color-ink)" strokeLinejoin="round" />
      <path d="M-6.5,13 V0 A6.5,6.5 0 0 1 6.5,0 V13 Z" fill="var(--color-live)" fillOpacity={0.18} stroke="var(--color-ink)" strokeOpacity={0.5} strokeWidth={0.75} />
      <line x1={-14} x2={14} y1={13} y2={13} stroke="var(--color-ink)" />
      <circle cy={4} r={3} fill="var(--color-live)" />
      <text y={26} textAnchor="middle" className="font-mono" fontSize={8} letterSpacing="0.08em" fill="var(--color-ink)">
        GATE
      </text>
    </svg>
  );
}
