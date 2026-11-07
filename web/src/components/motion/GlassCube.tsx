// Brand mark & illustration — UI.md §7 Glass cube. Isometric wireframe with translucent faces.

export function GlassCube({ size = 14, animated = false, stroke = "var(--color-ink)" }: { size?: number; animated?: boolean; stroke?: string }) {
  // Isometric hexagon outline of a cube, in a 24×24 box.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <polygon points="12,2 21,7 12,12 3,7" fill="var(--color-ice)" fillOpacity={0.55} />
      <polygon points="3,7 12,12 12,22 3,17" fill="var(--color-cyan)" fillOpacity={0.28} />
      <polygon points="21,7 12,12 12,22 21,17" fill="var(--color-cobalt)" fillOpacity={0.22} />
      <g fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round">
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
        <polyline points="3,7 12,12 21,7" />
        <line x1="12" y1="12" x2="12" y2="22" />
      </g>
      <circle cx="12" cy="12.5" r="2" fill="var(--color-live)" className={animated ? "anim-caret" : undefined} />
    </svg>
  );
}
