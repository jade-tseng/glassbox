// Glassbox. One visual first: a real autoresearch run, Before (what worked) → Beliefs (why).
// Styling and motion follow /UI.md. The graph replays a real recorded run through the shared belief engine.

import Link from "next/link";
import { BeliefSection } from "@/components/belief/BeliefSection";
import { MainHypothesis } from "@/components/belief/MainHypothesis";
import { ReplayProvider } from "@/components/belief/Replay";
import { Calibration, CalibrationLead, ImpactLead, RegionImpact } from "@/components/belief/RunSummary";
import { RunsPanel } from "@/components/belief/RunsPanel";
import { GlassCube } from "@/components/motion/GlassCube";
import { Orbit } from "@/components/motion/Orbit";
import { Reveal } from "@/components/motion/primitives";

const label = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted";
const h2 = "text-[24px] font-medium leading-[1.15] tracking-[-0.025em] md:text-[28px]";

function SectionLabel({ n, children }: { n: string; children: string }) {
  return (
    <p className={label}>
      {n} / {children}
    </p>
  );
}

export default function Home() {
  return (
    <ReplayProvider startAtEnd>
      <div className="flex min-h-full flex-col">
        {/* Nav */}
        <header className="sticky top-0 z-20 border-b border-scope-line bg-scope text-scope-text">
          <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="flex shrink-0 items-center gap-2 text-[18px] font-medium tracking-[-0.02em]">
                <GlassCube size={18} stroke="var(--color-scope-text)" />
                glassbox
              </Link>
              <span className="hidden h-4 w-px bg-scope-line md:block" aria-hidden />
              <span className="hidden truncate text-[14px] tracking-[-0.005em] text-scope-muted md:block">
                mapping agents&apos; belief system under uncertainty
              </span>
            </div>
            <Link href="/run" className="font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted transition-colors duration-150 hover:text-scope-text">
              Runs
            </Link>
          </nav>
        </header>

        {/* 01 — the one visual: Before → Beliefs */}
        <section id="beliefs" className="bg-scope px-4 pt-6 pb-14 text-scope-text md:px-10 md:pt-10 md:pb-20">
          <div className="mx-auto max-w-[1200px]">
            <h1 className="sr-only">Glassbox: mapping agents&apos; belief system under uncertainty</h1>
            <p className="mb-4 text-[14px] text-scope-muted md:hidden">mapping agents&apos; belief system under uncertainty</p>
            <div className="mb-8">
              <MainHypothesis text="A web-analytics dashboard's 10 queries can return exactly the same results while scanning a small fraction of the 20,000,000 rows they scan today. Claude Code may only change the table definition and rewrite the queries; a fixed harness counts rows scanned and rejects any changed result. Over 25 experiments it got to −96%." />
            </div>
            <BeliefSection />
          </div>
        </section>

        {/* 02 Runs — the other pages, from here */}
        <section id="runs" className="bg-frost px-4 py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <SectionLabel n="02">Runs</SectionLabel>
                  <h2 className={`mt-4 ${h2}`}>Every run, replayable.</h2>
                </div>
                <div className="flex gap-5 font-mono text-[12px] uppercase tracking-[0.08em]">
                  <Link href="/new" className="text-ink hover:text-signal">Describe a problem →</Link>
                  <Link href="/run" className="text-muted hover:text-signal">All runs →</Link>
                </div>
              </div>
            </Reveal>
            <Reveal index={1} className="mt-8">
              <RunsPanel />
            </Reveal>
          </div>
        </section>

        {/* 03 Impact */}
        <section id="impact" className="border-t border-line bg-white px-4 py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="03">Impact</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Which ideas paid off.</h2>
            </Reveal>
            <div className="mt-8 grid gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Reveal className="bg-white p-5 md:p-6">
                <p className={label}>Rows saved by code region</p>
                <p className="mt-3 text-[15px] leading-6">
                  <ImpactLead />
                </p>
                <div className="mt-4">
                  <RegionImpact />
                </div>
              </Reveal>
              <Reveal index={1} className="bg-white p-5 md:p-6">
                <p className={label}>Calibration</p>
                <p className="mt-3 text-[15px] leading-6">
                  <CalibrationLead />
                </p>
                <div className="mt-6">
                  <Calibration />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 04 Loop */}
        <section id="loop" className="border-t border-line bg-frost px-4 py-14 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Reveal>
              <SectionLabel n="04">Loop</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>From uncertainty to mapped hypotheses and updated beliefs.</h2>
            </Reveal>
            <Reveal index={2}>
              <Orbit />
            </Reveal>
          </div>
        </section>


        <footer className="mt-auto bg-frost px-4 py-8 md:px-10">
          <div className={`mx-auto flex max-w-[1200px] items-center justify-between gap-4 ${label}`}>
            <span className="flex items-center gap-2 normal-case tracking-normal text-ink">
              <GlassCube size={14} /> glassbox
            </span>
          </div>
        </footer>
      </div>
    </ReplayProvider>
  );
}
