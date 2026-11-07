"use client";

// Motion primitives — UI.md §6.3. Only transform/opacity/filter/stroke are animated.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useInView, usePrefersReducedMotion } from "./useInView";

/** Fade + rise + unblur on first scroll into view. */
export function Reveal({
  children,
  index = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const { ref, seen } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`}
      data-shown={seen ? "" : undefined}
      style={{ "--reveal-delay": `calc(${index} * var(--stagger))` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Pauses CSS loops inside it when offscreen or the tab is hidden. */
export function Paused({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>("0px");
  return (
    <div ref={ref} className={className} data-paused={inView ? undefined : ""}>
      {children}
    </div>
  );
}

/** Live indicator. Lime + ring when live, grey and still when idle. */
export function PulseDot({ live = true, size = 8 }: { live?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      {live && <span className="anim-pulse absolute inset-0 rounded-full bg-live" />}
      <span className={`relative inline-flex h-full w-full rounded-full ${live ? "bg-live" : "bg-subtle"}`} />
    </span>
  );
}

/** Ticks a number from its previous value to `value`. Tabular mono so width never jitters. */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 600,
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!seen || reduced) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, seen, reduced, duration]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {prefix}
      {(reduced ? value : shown).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Ambient lime sweep for scope surfaces. Parent must be `relative overflow-hidden`. */
export function Scanline({ distance = 400 }: { distance?: number }) {
  return (
    <div
      className="anim-scan pointer-events-none absolute inset-x-0 top-0 h-12 opacity-35"
      style={{ "--scan-distance": `${distance}px` } as CSSProperties}
      aria-hidden
    >
      <div className="h-full bg-gradient-to-b from-transparent to-live/25" />
      <div className="h-px bg-live" />
    </div>
  );
}

/** Text appearing at ~30 chars/s with a blinking lime block caret. Restarts when `text` changes. */
export function Typewriter({ text, cps = 30, className = "" }: { text: string; cps?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useInView<HTMLParagraphElement>();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    const start = performance.now();
    const id = setInterval(() => {
      const c = Math.min(text.length, Math.floor(((performance.now() - start) * cps) / 1000));
      setN(c);
      if (c >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps, seen, reduced]);

  return (
    <p ref={ref} className={className}>
      {reduced ? text : text.slice(0, n)}
      <span className="anim-caret ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-live" aria-hidden />
    </p>
  );
}

/** Slow horizontal drift, edge-faded, pauses on hover. Children are rendered twice for the loop. */
export function Marquee({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Paused className={`mask-fade-x overflow-hidden ${className}`}>
      <div className="anim-marquee flex w-max">
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </div>
    </Paused>
  );
}
