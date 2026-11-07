// Placeholder landing page. Styling follows /UI.md.

const PALETTE = ["#F2C247", "#D14F35", "#BDDDD0", "#E599BB", "#E9C1AC", "#F5F2EC"];

function BlockTerrain() {
  // Original flat "token brick" field: cells colored by a simple height map.
  const cols = 30;
  const rows = 6;
  const w = 48;
  const h = 28;
  const cells = [];
  for (let c = 0; c < cols; c++) {
    const height = Math.round(3 + 2.5 * Math.sin(c / 3) + 1.5 * Math.cos(c / 1.7));
    for (let r = 0; r < rows; r++) {
      if (rows - r > height) continue;
      const color = PALETTE[(Math.floor(c / 4) + r) % PALETTE.length];
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={c * w}
          y={r * h}
          width={w}
          height={h}
          fill={color}
          stroke="#202020"
          strokeWidth={1}
        />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols * w} ${rows * h}`}
      className="block w-full"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      {cells}
    </svg>
  );
}

const STATS = [
  { value: "01", label: "Day to build" },
  { value: "$0", label: "Spent so far" },
  { value: "∞", label: "Ideas in the backlog" },
  { value: "<24h", label: "Until demo" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-stone bg-cream">
        <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-10">
          <span className="flex items-center gap-2 text-[20px] font-medium tracking-[-0.02em]">
            <span className="inline-block h-3 w-3 bg-ink" aria-hidden />
            glassbox
          </span>
          <div className="hidden gap-8 text-sm md:flex">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#results" className="hover:underline">Results</a>
          </div>
          <a
            href="#"
            className="inline-flex h-[30px] items-center rounded-full bg-ink px-4 text-sm text-cream transition-colors hover:bg-black"
          >
            Get started
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-sand to-white">
        <div className="mx-auto max-w-[1200px] px-4 pt-20 pb-16 md:px-10 md:pt-28">
          <h1 className="max-w-[620px] text-[36px] leading-none tracking-[-0.02em] md:text-[50px]">
            Something great is being built here today.
          </h1>
          <p className="mt-6 max-w-[520px] text-base text-ink">
            This is the placeholder for the Glassbox demo. Specs are on the way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex h-12 items-center rounded-full bg-ink px-7 text-base text-cream transition-colors hover:bg-black"
            >
              Get started
            </a>
            <a
              href="#"
              className="inline-flex h-12 items-center rounded-full border border-ink bg-white px-7 text-base transition-colors hover:bg-sand"
            >
              Book demo
            </a>
          </div>
          <ul className="mt-5 flex gap-6 text-sm">
            <li><span className="text-emerald">✓</span> Built in one day</li>
            <li><span className="text-emerald">✓</span> Deployed on Vercel</li>
          </ul>
        </div>
        <BlockTerrain />
      </section>

      {/* Features */}
      <section id="features" className="bg-white px-4 py-12 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="max-w-[800px] text-[28px] leading-[1.15] tracking-[-0.035em]">
            Observe. <span className="text-muted">See what is happening, what it costs, and where the value is.</span>
          </h2>
          <ul className="mt-10 border-t border-stone">
            {["Feature one", "Feature two", "Feature three", "And more"].map((f) => (
              <li key={f} className="border-b border-stone py-3">{f}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Results (accent section) */}
      <section id="results" className="bg-accent text-cream">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-[640px] p-4 py-10 md:p-10">
            <p className="text-sm uppercase tracking-[0.14em] text-cream/70">Results</p>
            <h2 className="mt-4 text-[28px] leading-[1.15] tracking-[-0.035em] md:text-[35px]">
              What we will have by the end of the day.
            </h2>
          </div>
          <div className="grid grid-cols-2 border-t border-cream/20">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`border-b border-cream/20 p-4 py-8 md:p-10 ${i % 2 === 0 ? "border-r" : ""}`}
              >
                <div className="num text-[30px] tracking-[-0.03em] md:text-[37px]">{s.value}</div>
                <div className="mt-2 text-cream/85">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone bg-cream px-4 py-10 text-sm text-muted md:px-10">
        <div className="mx-auto max-w-[1200px]">Glassbox · Nov 2026</div>
      </footer>
    </div>
  );
}
