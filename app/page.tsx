
import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Expert Knowledge",
    description:
      "Capture industry cases, expert decisions, workflows, and lessons learned.",
    icon: "◈",
  },
  {
    number: "02",
    title: "Adaptive Practice",
    description:
      "Turn real-world challenges into targeted exercises based on skill gaps.",
    icon: "⌘",
  },
  {
    number: "03",
    title: "Mentor Intelligence",
    description:
      "Connect learner decisions with expert feedback and supervised guidance.",
    icon: "◎",
  },
  {
    number: "04",
    title: "Competency Passport",
    description:
      "Measure demonstrated skills, recurring mistakes, and learning progress.",
    icon: "↗",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08111f] text-white">
      
<nav className="flex items-center justify-between border-b border-white/10 px-6 py-4 md:px-12">
  <Link href="/" className="text-lg font-bold tracking-tight text-white">
    Experience<span className="text-emerald-400">Engine</span>
  </Link>

  <div className="flex items-center gap-3">
    <Link
      href="/login"
      className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
    >
      Log in
    </Link>

    <Link
      href="/login"
      className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
    >
      Sign up
    </Link>
  </div>
</nav>


      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:pb-32 lg:pt-24">
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-[120px]" />

        <div className="relative z-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#69e2bd]/25 bg-[#69e2bd]/5 px-4 py-2 text-xs tracking-wide text-[#8cf0d0]">
            <span className="h-2 w-2 rounded-full bg-[#69e2bd]" />
            TECHNOLOGY × HUMAN EXPERIENCE
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Years of experience.
            <span className="mt-2 block text-[#69e2bd]">
              A smarter path to mastery.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
            Transform expert knowledge into practical challenges, personalized
            learning pathways, and measurable workforce capability.
          </p>

          
<div className="mt-8 flex flex-wrap gap-4">
  <Link
    href="/login"
    className="rounded-xl bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300"
  >
    Get Started →
  </Link>

  <Link
    href="/demo"
    className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
  >
    Explore Demo
  </Link>
</div>


          <div className="mt-14 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-7 text-xs tracking-wide text-slate-400">
            <span>01 / CAPTURE EXPERTISE</span>
            <span>02 / PRACTICE INTELLIGENTLY</span>
            <span>03 / PROVE COMPETENCY</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-[90px]" />

          <div className="relative rounded-3xl border border-white/10 bg-[#101c2b]/90 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs tracking-[0.18em] text-slate-400">
                  LEARNING INTELLIGENCE
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  Capability overview
                </h2>
              </div>
              <div className="rounded-xl bg-[#69e2bd]/10 p-3 text-xl text-[#69e2bd]">
                ↗
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b1523] p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Competency development
                </span>
                <span className="text-xs text-[#69e2bd]">ILLUSTRATIVE</span>
              </div>

              <div className="mt-5 space-y-5">
                {[
                  { label: "Problem analysis", progress: "85%" },
                  { label: "Decision making", progress: "68%" },
                  { label: "Risk awareness", progress: "76%" },
                ].map((skill) => (
                  <div key={skill.label}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-slate-300">{skill.label}</span>
                      <span className="text-[#69e2bd]">{skill.progress}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#69e2bd]"
                        style={{ width: skill.progress }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-400">Learning approach</p>
                <p className="mt-2 text-sm font-semibold">
                  Practice + feedback
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-400">Validation</p>
                <p className="mt-2 text-sm font-semibold">
                  Expert-reviewed
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-500">
              Concept preview · Sample values, not actual learner data
            </p>
          </div>
        </div>
        
      </section>

      <section
        id="platform"
        className="border-t border-white/10 bg-[#0b1523] px-6 py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#69e2bd]">
            THE PLATFORM
          </p>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
              Experience is earned.
              <span className="text-slate-400">
                {" "}Learning can be engineered.
              </span>
            </h2>
            <p className="max-w-md text-sm leading-7 text-slate-400">
              Connect expert knowledge, deliberate practice, and mentorship in
              one evidence-driven learning system.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#69e2bd]/40 hover:bg-white/[0.045]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl text-[#69e2bd]">
                    {feature.icon}
                  </span>
                  <span className="text-xs text-slate-500">
                    {feature.number}
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="method"
        className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24"
      >
        <p className="text-xs font-semibold tracking-[0.24em] text-[#69e2bd]">
          THE EXPERIENCE COMPRESSION LOOP
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">
          From expert insight to demonstrated capability.
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {[
            ["01", "Capture", "Document real cases and expert decisions."],
            ["02", "Structure", "Map skills, dependencies, and mistakes."],
            ["03", "Simulate", "Practice decisions in realistic scenarios."],
            ["04", "Validate", "Measure improvement and seek mentor review."],
          ].map(([number, title, description]) => (
            <div key={number} className="border-l border-[#69e2bd]/40 pl-5">
              <p className="text-sm text-[#69e2bd]">{number}</p>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <p>© 2026 Experience Compression Engine</p>
          <p>Human expertise. Intelligent practice. Measurable growth.</p>
        </div>
      </footer>
    </main>
  );
}
