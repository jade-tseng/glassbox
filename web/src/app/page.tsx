// Glassbox live specimen. Styling and motion follow /UI.md; the words and their order follow UI.md §9 (Copy & story).
// All belief data is a REPLAY of a real run, pushed through the same belief engine as the /run view.

import Link from "next/link";
import { BeliefSection } from "@/components/belief/BeliefSection";
import { ReplayProvider } from "@/components/belief/Replay";
import {
  Calibration,
  CalibrationLead,
  HeroInstrument,
  HypothesisMarquee,
  ImpactLead,
  RegionImpact,
  RunVerdict,
} from "@/components/belief/RunSummary";
import { GlassCube } from "@/components/motion/GlassCube";
import { Orbit } from "@/components/motion/Orbit";
import { PulseDot, Reveal } from "@/components/motion/primitives";
import { SignalGrid } from "@/components/motion/SignalGrid";

const label = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted";
const h2 = "text-[24px] font-medium leading-[1.15] tracking-[-0.025em] md:text-[28px]";
const body = "max-w-[65ch] text-[16px] leading-[26px] text-ink";
const lead = "max-w-[65ch] text-[16px] leading-[26px] text-muted";

function SectionLabel({ n, children, dark = false }: { n: string; children: string; dark?: boolean }) {
  return (
    <p className={`font-mono text-[12px] uppercase tracking-[0.08em] ${dark ? "text-scope-muted" : "text-muted"}`}>
      {n} / {children}
    </p>
  );
}

const FACTS = [
  { k: "Autoresearch gives you", v: "keep / discard" },
  { k: "Glassbox adds", v: "hypothesis → prediction → measured result → belief" },
  { k: "Enforced by", v: "a gate: no benchmark runs without a stated prediction" },
];

const RUN_SPEC = [
  {
    k: "Task",
    v: (
      <>
        Change the table definition (<code className="font-mono text-[14px]">schema.sql</code>) and rewrite queries (
        <code className="font-mono text-[14px]">queries/*.sql</code>). Nothing else.
      </>
    ),
  },
  {
    k: "Verifier",
    v: "The harness rebuilds the table, runs every query, and reads rows scanned from ClickHouse's own query log. Any changed result, SQL error or timeout is a failure, never a win.",
  },
  {
    k: "Baseline → target",
    v: (
      <span className="font-mono text-[14px]">
        20,000,000 rows → as low as it goes, same answers
      </span>
    ),
  },
];

const UNDERNEATH = [
  {
    k: "Tools",
    v: "The agent gets five tools: propose a hypothesis (claim, reason, predicted direction, confidence 0–1, the code it'll touch), link it to earlier ones (refines, depends on, contradicts), record what it learned, close it, and read its current beliefs.",
  },
  {
    k: "Gate",
    v: "A pre-tool hook denies any benchmark run until a hypothesis with a prediction is armed. A second hook blocks edits outside the allowed files.",
  },
  {
    k: "Harness",
    v: "The evaluator rebuilds the data, runs the queries, and checks every result against the baseline hash. The agent can't edit it, and it never reports its own numbers.",
  },
  {
    k: "Event log",
    v: "Every proposal, result, block and conclusion is an append-only, sequence-numbered event, mirrored to a database. That's what makes any run replayable to the exact step.",
  },
  {
    k: "Belief math",
    v: "Confidence starts from the agent's stated prior and updates with each measured result, weighted by how much the metric moved. Moves under 1% count as weak, and invalid runs count as no evidence. It's deterministic, with no model in the loop.",
  },
  {
    k: "Drop-in",
    v: "It runs inside Claude Code via the Agent SDK; other agents can use the same tools.",
  },
];

function SpecList({ rows }: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="border-t border-line">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
          <dt className={label}>{r.k}</dt>
          <dd className="max-w-[72ch] text-[15px] leading-6">{r.v}</dd>
        </div>
      ))}
    </dl>
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
            <div className="hidden gap-6 font-mono text-[12px] uppercase tracking-[0.08em] text-muted lg:flex">
              <a href="#context" className="transition-colors duration-150 hover:text-signal">Context</a>
              <a href="#run" className="transition-colors duration-150 hover:text-signal">The run</a>
              <a href="#beliefs" className="transition-colors duration-150 hover:text-signal">Beliefs</a>
              <a href="#impact" className="transition-colors duration-150 hover:text-signal">Impact</a>
              <a href="#why" className="transition-colors duration-150 hover:text-signal">Why</a>
              <Link href="/run/bg2" className="transition-colors duration-150 hover:text-signal">Run view</Link>
            </div>
            <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em]">
              <PulseDot />
              Real run · replayed
            </span>
          </nav>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <SignalGrid className="absolute inset-0" />
          <div className="relative mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-10 md:py-24">
            <Reveal>
              <h1 className="max-w-[520px] text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">
                Autoresearch shows what worked. Glassbox shows why.
              </h1>
              <p className="mt-6 max-w-[48ch] text-[16px] leading-[26px]">
                Glassbox plugs into an agent&apos;s research loop. Before every experiment, the agent must state a
                hypothesis and a prediction. The harness measures the result, and you see what it believed, what
                happened, and what it learned.
              </p>
              <p className={`mt-6 ${label}`}>Predict · measure · update</p>
            </Reveal>
            <Reveal index={2}>
              <HeroInstrument />
            </Reveal>
          </div>
        </section>

        {/* 00 Context */}
        <section id="context" className="bg-white px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="00">Context</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>A scoreboard isn&apos;t a research log.</h2>
              <p className={`mt-6 ${body}`}>
                Agents can now run research loops on their own: change something, run the benchmark, keep or revert,
                repeat. What they leave behind is a list of experiments that stuck. It doesn&apos;t say what the agent
                expected, why it tried each idea, or what the failures taught it.
              </p>
              <p className={`mt-4 ${lead}`}>
                The open question is no longer whether agents can do the engineering of research. It&apos;s whether
                they have <span className="text-ink">research taste</span>: choosing which ideas are worth testing,
                predicting what will happen, and changing their mind when they&apos;re wrong. Taste doesn&apos;t show
                up on a leaderboard. It shows up in the reasoning.
              </p>
            </Reveal>
            <Reveal index={1}>
              <dl className="mt-10 grid grid-cols-[minmax(0,1fr)] border-y border-line md:grid-cols-3">
                {FACTS.map((f, i) => (
                  <div key={f.k} className={`py-5 md:px-5 ${i ? "border-t border-line md:border-t-0 md:border-l" : "md:pl-0"}`}>
                    <dt className={label}>{f.k}</dt>
                    <dd className="mt-2 font-mono text-[14px] leading-5">{f.v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* 01 The run — main hypothesis first */}
        <section id="run" className="border-t border-line bg-frost px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="01">The run</SectionLabel>
              <p className={`mt-8 ${label}`}>Main hypothesis</p>
              <p className="mt-3 max-w-[30ch] text-[24px] font-medium leading-[1.2] tracking-[-0.02em] md:max-w-[38ch] md:text-[30px]">
                This dashboard&apos;s 10 queries can return exactly the same results while scanning a small fraction
                of the 20,000,000 rows they scan today.
              </p>
            </Reveal>
            <Reveal index={1} className="mt-10">
              <SpecList rows={[...RUN_SPEC, { k: "Verdict", v: <RunVerdict /> }]} />
            </Reveal>
            <Reveal index={2}>
              <p className={`mt-8 ${lead}`}>
                On the way, the agent proposes smaller hypotheses. Each one must carry a prediction before it&apos;s
                tested.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 02 Beliefs — the scope band */}
        <section id="beliefs" className="relative bg-scope px-4 py-14 text-scope-text md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="02" dark>Beliefs</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Same run. Now with its reasoning.</h2>
            </Reveal>
            <Reveal index={2} className="mt-8">
              <BeliefSection />
            </Reveal>
          </div>
        </section>

        {/* 03 Impact */}
        <section id="impact" className="bg-frost px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="03">Impact</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Which ideas actually paid off.</h2>
            </Reveal>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Reveal className="bg-white p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <p className={label}>Rows saved by code region</p>
                  <PulseDot size={6} />
                </div>
                <p className="mt-3 text-[15px] leading-6">
                  <ImpactLead />
                </p>
                <div className="mt-4">
                  <RegionImpact />
                </div>
              </Reveal>
              <Reveal index={1} className="bg-white p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <p className={label}>Calibration</p>
                  <PulseDot size={6} />
                </div>
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
        <section id="loop" className="border-t border-line bg-white px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Reveal>
              <SectionLabel n="04">Loop</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>No measurement without a prediction.</h2>
              <p className={`mt-6 ${lead}`}>
                The agent states what it expects. A hook blocks the benchmark until it does. The harness, not the
                agent, reports the numbers, and the belief moves.
              </p>
            </Reveal>
            <Reveal index={2}>
              <Orbit />
            </Reveal>
          </div>
        </section>

        {/* 05 Why it matters — argument, then how it works underneath */}
        <section id="why" className="border-t border-line bg-frost px-4 py-14 md:px-10 md:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <SectionLabel n="05">Why it matters</SectionLabel>
              <h2 className={`mt-4 ${h2}`}>Pass/fail says whether. Beliefs say how.</h2>
              <p className={`mt-6 ${body}`}>
                Every autoresearch loop is an RL environment: a task, a state, and a verifier. When a score jumps and
                no hypothesis explains it, or a claim is confirmed that the numbers don&apos;t support, that&apos;s the
                signal environment builders need. Every belief here was stated before the experiment, measured by the
                harness, and can be replayed.
              </p>
            </Reveal>
            <Reveal index={1} className="mt-12">
              <p className={`mb-4 ${label}`}>How it works underneath</p>
              <SpecList rows={UNDERNEATH} />
            </Reveal>
          </div>
        </section>

        {/* Every hypothesis the run considered */}
        <div className="border-y border-line bg-frost py-4">
          <HypothesisMarquee />
        </div>

        {/* Footer */}
        <footer className="mt-auto bg-frost px-4 py-8 md:px-10">
          <div className={`mx-auto flex max-w-[1200px] items-center justify-between gap-4 ${label}`}>
            <span className="flex items-center gap-2 normal-case tracking-normal text-ink">
              <GlassCube size={14} /> glassbox
            </span>
            <span className="text-right">Replay of a real Claude Code run · Nov 7, 2026</span>
          </div>
        </footer>
      </div>
    </ReplayProvider>
  );
}
