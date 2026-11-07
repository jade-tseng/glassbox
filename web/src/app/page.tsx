// Glassbox live specimen. Styling and motion follow /UI.md (v3). All belief data is a REPLAY of runs/bg2,
// pushed through the same belief engine as the /run view.

import Link from "next/link";
import { BeliefSection } from "@/components/belief/BeliefSection";
import { ReplayProvider } from "@/components/belief/Replay";
import { Calibration, HeroInstrument, HypothesisMarquee, RegionImpact } from "@/components/belief/RunSummary";
import { GlassCube } from "@/components/motion/GlassCube";
import { Orbit } from "@/components/motion/Orbit";
import { PulseDot, Reveal } from "@/components/motion/primitives";
import { SignalGrid } from "@/components/motion/SignalGrid";

const label = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted";
const h2 = "text-[24px] font-medium leading-[1.15] tracking-[-0.025em] md:text-[28px]";

function SectionLabel({ n, children, dark = false }: { n: string; children: string; dark?: boolean }) {
  return (
    <p className={`font-mono text-[12px] uppercase tracking-[0.08em] ${dark ? "text-scope-muted" : "text-muted"}`}>
      {n} / {children}
    </p>
  );
}

export default function Home() {
  return (
    <ReplayProvider>
      <div className="flex min-h-full flex-col">
        {/* Nav */}
        <header className="sticky top-0 z-20 border-b border-line bg-frost/85 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-10">
            <span className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.02em]">
              <GlassCube size={18} />
              glassbox
            </span>
            <div className="hidden gap-6 font-mono text-[12px] uppercase tracking-[0.08em] text-muted md:flex">
              <a href="#beliefs" className="transition-colors duration-150 hover:text-signal">Beliefs</a>
              <a href="#impact" className="transition-colors duration-150 hover:text-signal">Impact</a>
              <a href="#loop" className="transition-colors duration-150 hover:text-signal">Loop</a>
              <Link href="/run/bg2" className="transition-colors duration-150 hover:text-signal">Run view</Link>
            </div>
            <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em]">
              <PulseDot />
              Replay · bg2
            </span>
          </nav>
        </header>

        {/* Hero / instrument */}
        <section className="relative overflow-hidden border-b border-line">
          <SignalGrid className="absolute inset-0" />
          <div className="relative mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:px-10 md:py-24">
            <Reveal>
              <h1 className="max-w-[480px] text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">
                What the agent believed, and why.
              </h1>
              <p className={`mt-6 ${label}`}>Prediction first · harness measures · belief updates</p>
            </Reveal>
            <Reveal index={2}>
              <HeroInstrument />
            </Reveal>
          </div>
        </section>

        {/* 01 Beliefs — the scope band */}
        <section id="beliefs" className="relative bg-scope px-4 py-14 text-scope-text md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="01" dark>Beliefs</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Every result, measured against its prediction.</h2>
            </Reveal>
            <Reveal index={2} className="mt-10">
              <BeliefSection />
            </Reveal>
          </div>
        </section>

        {/* 02 Impact */}
        <section id="impact" className="bg-frost px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="02">Impact</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Where in the schema it mattered.</h2>
            </Reveal>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Reveal className="bg-white p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <p className={label}>Rows saved by code region</p>
                  <PulseDot size={6} />
                </div>
                <div className="mt-4">
                  <RegionImpact />
                </div>
              </Reveal>
              <Reveal index={1} className="bg-white p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <p className={label}>Calibration</p>
                  <PulseDot size={6} />
                </div>
                <div className="mt-6">
                  <Calibration />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 03 Loop */}
        <section id="loop" className="border-t border-line bg-white px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Reveal>
              <SectionLabel n="03">Loop</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>No measurement without a prediction.</h2>
            </Reveal>
            <Reveal index={2}>
              <Orbit />
            </Reveal>
          </div>
        </section>

        {/* Every hypothesis the run considered */}
        <div className="border-y border-line bg-frost py-4">
          <HypothesisMarquee />
        </div>

        {/* Footer */}
        <footer className="mt-auto bg-frost px-4 py-8 md:px-10">
          <div className={`mx-auto flex max-w-[1200px] items-center justify-between ${label}`}>
            <span className="flex items-center gap-2 normal-case tracking-normal text-ink">
              <GlassCube size={14} /> glassbox
            </span>
            <span>Nov 2026 · replay of run bg2</span>
          </div>
        </footer>
      </div>
    </ReplayProvider>
  );
}
