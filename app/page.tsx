
import Link from "next/link";

const pillars = [
  {
    number: "01",
    icon: "◈",
    title: "Breakthrough technology",
    description:
      "Transform expert knowledge into structured cases, digital simulations, and adaptive practice experiences.",
    tags: ["AI-assisted learning", "Digital scenarios"],
  },
  {
    number: "02",
    icon: "◎",
    title: "Behavioral transformation",
    description:
      "Build stronger judgment through deliberate practice, mentorship loops, reflection, and expert feedback.",
    tags: ["Expert mentorship", "Continuous learning"],
  },
];

const workflow = [
  {
    number: "01",
    title: "Capture",
    description:
      "Document real industry challenges, decisions, mistakes, and lessons learned.",
  },
  {
    number: "02",
    title: "Structure",
    description:
      "Organize knowledge into competencies, decision points, and practical exercises.",
  },
  {
    number: "03",
    title: "Practice",
    description:
      "Let learners tackle realistic situations and receive meaningful feedback.",
  },
  {
    number: "04",
    title: "Validate",
    description:
      "Track demonstrated performance and strengthen skills with expert guidance.",
  },
];

const capabilities = [
  {
    number: "01",
    title: "Expert knowledge",
    description:
      "Preserve the reasoning behind experienced professionals' decisions.",
  },
  {
    number: "02",
    title: "Real-world practice",
    description:
      "Turn workplace challenges into structured, repeatable learning.",
  },
  {
    number: "03",
    title: "Mentor feedback",
    description:
      "Connect learner decisions with guidance from experienced reviewers.",
  },
  {
    number: "04",
    title: "Competency evidence",
    description:
      "Build a record of performance, recurring mistakes, and improvement.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08111f] text-white selection:bg-[#69e2bd] selection:text-[#08111f]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#08111f]/90 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10"
        >
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#69e2bd] text-lg font-black text-[#08111f]">
              E
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide sm:text-base">
                Experience<span className="text-[#69e2bd]">Engine</span>
              </span>
              <span className="mt-0.5 block text-[10px] tracking-[0.18em] text-slate-500">
                INTELLIGENCE FOR GROWTH
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a className="transition hover:text-white" href="#platform">
              Platform
            </a>
            <a className="transition hover:text-white" href="#approach">
              Our approach
            </a>
            <a className="transition hover:text-white" href="#workflow">
              How it works
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-[#69e2bd] px-3 py-2.5 text-sm font-bold text-[#08111f] transition hover:bg-[#8cf0d0] sm:px-5"
            >
              Get started <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute -left-48 top-10 h-[450px] w-[450px] rounded-full bg-emerald-400/[0.09] blur-[120px]" />
        <div className="pointer-events-none absolute -right-48 top-24 h-[400px] w-[400px] rounded-full bg-cyan-400/[0.06] blur-[120px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:px-10 lg:pb-28 lg:pt-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#69e2bd]/20 bg-[#69e2bd]/[0.06] px-4 py-2 text-[10px] font-semibold tracking-[0.17em] text-[#8cf0d0] sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#69e2bd]" />
              COMPRESSING YEARS OF EXPERIENCE
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-6xl lg:text-[68px]">
              Experience that took years.
              <span className="mt-2 block text-[#69e2bd]">
                Mastered in months.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              What if people could learn from years of industry experience
              without spending years discovering every lesson themselves?
              Experience Compression Engine turns expert knowledge into
              practical challenges, guided practice, and measurable
              competency development.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center gap-3 rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:-translate-y-0.5 hover:bg-[#8cf0d0]"
              >
                Explore the experience
                <span aria-hidden="true">↗</span>
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center gap-3 rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.04]"
              >
                Discover the method
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-6 text-[10px] font-medium tracking-[0.12em] text-slate-500 sm:text-xs">
              <span>TECHNOLOGY</span>
              <span className="text-[#69e2bd]">×</span>
              <span>HUMAN BEHAVIOR</span>
              <span className="text-[#69e2bd]">×</span>
              <span>EXPERT KNOWLEDGE</span>
            </div>
          </div>

          {/* Illustrative product preview */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="pointer-events-none absolute inset-8 rounded-full bg-[#69e2bd]/10 blur-[90px]" />

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1928] shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/10 text-lg text-[#69e2bd]">
                    ◈
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Experience lab</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Interactive concept preview
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-slate-400">
                  DEMO
                </span>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold tracking-[0.17em] text-[#69e2bd]">
                    INDUSTRY CASE / 001
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Decision practice
                  </span>
                </div>

                <h2 className="mt-5 text-xl font-semibold leading-snug sm:text-2xl">
                  The decision behind the outcome.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  A project is falling behind schedule. The available data is
                  incomplete, and the team must decide what to investigate
                  before committing more resources.
                </p>

                <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#08111f] p-4 sm:p-5">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
                    YOUR CHALLENGE
                  </p>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-200">
                    What should the team do first?
                  </p>

                  <div className="mt-4 space-y-2">
                    {[
                      "Investigate the evidence and identify the main constraint",
                      "Increase resources immediately",
                      "Change the deadline without further analysis",
                    ].map((option, index) => (
                      <div
                        key={option}
                        className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[10px] text-slate-400">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-xs leading-5 text-slate-300">
                          {option}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-[10px] leading-5 text-slate-500">
                    Illustrative scenario. The live demo contains the
                    interactive practice experience.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.08] p-4">
                    <p className="text-[10px] text-slate-500">
                      LEARN THROUGH
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      Deliberate practice
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] p-4">
                    <p className="text-[10px] text-slate-500">
                      IMPROVE WITH
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#69e2bd]">
                      Expert feedback
                    </p>
                  </div>
                </div>
              </div>
            </div>

            
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="border-y border-white/[0.08] bg-[#0b1523]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[0.8fr_1.2fr] md:items-center lg:px-10 lg:py-16">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#69e2bd] sm:text-xs">
              THE CHALLENGE
            </p>
            <h2 className="mt-4 text-2xl font-semibold leading-snug sm:text-3xl">
              Experience is valuable.
              <span className="text-slate-400">
                {" "}Acquiring it takes time.
              </span>
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-8 text-slate-400 sm:text-base">
            Traditional learning can explain concepts, but workplace judgment
            develops through decisions, mistakes, feedback, and repetition.
            Valuable expertise often remains locked inside experienced
            professionals. Our goal is to make those lessons structured,
            accessible, and easier to practise.
          </p>
        </div>
      </section>

      {/* Two pillars */}
      <section
        id="approach"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#69e2bd] sm:text-xs">
            BUILT ON TWO PILLARS
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Technology accelerates learning.
            <span className="text-slate-400">
              {" "}Behavior makes it stick.
            </span>
          </h2>
          <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
            Meaningful experience compression requires more than a digital
            course. It combines structured knowledge with the human behaviors
            that turn practice into capability.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {pillars.map((pillar) => (
            <article
              key={pillar.number}
              className="group rounded-2xl border border-white/10 bg-[#0d1928] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#69e2bd]/30 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#69e2bd]/20 bg-[#69e2bd]/[0.07] text-2xl text-[#69e2bd]">
                  {pillar.icon}
                </span>
                <span className="text-xs tracking-widest text-slate-600">
                  {pillar.number}
                </span>
              </div>
              <h3 className="mt-7 text-xl font-semibold sm:text-2xl">
                {pillar.title}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">
                {pillar.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {pillar.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Platform capabilities */}
      <section
        id="platform"
        className="scroll-mt-24 border-y border-white/[0.08] bg-[#0b1523] px-5 py-20 sm:px-8 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#69e2bd] sm:text-xs">
                THE PLATFORM
              </p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                From knowledge to capability.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-400">
              A connected learning experience for capturing expertise,
              practising decisions, receiving feedback, and tracking progress.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <article
                key={item.number}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition duration-300 hover:border-[#69e2bd]/30 hover:bg-white/[0.04] sm:p-6"
              >
                <span className="text-xs font-medium tracking-widest text-[#69e2bd]">
                  {item.number}
                </span>
                <h3 className="mt-6 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section
        id="workflow"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
      >
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#69e2bd] sm:text-xs">
            THE EXPERIENCE COMPRESSION LOOP
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Learn from experience.
            <span className="text-slate-400"> Not just time.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((step) => (
            <article
              key={step.number}
              className="relative border-l border-[#69e2bd]/30 pl-5"
            >
              <span className="text-xs font-semibold tracking-widest text-[#69e2bd]">
                STEP {step.number}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20 sm:px-8 lg:px-10 lg:pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#69e2bd]/20 bg-[#0d1928] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[#69e2bd]/10 blur-[100px]" />
          <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#69e2bd] sm:text-xs">
                YOUR NEXT CHALLENGE STARTS HERE
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Turn experience into your next advantage.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Explore a scenario, practise your decisions, and discover how
                structured feedback can help develop real-world capability.
              </p>
            </div>
            <Link
              href="/demo"
              className="inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#8cf0d0] md:self-center"
            >
              Try the demo <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <Link href="/" className="text-sm font-bold tracking-wide">
            Experience<span className="text-[#69e2bd]">Engine</span>
            <span className="ml-2 font-normal text-slate-500">
              © 2026
            </span>
          </Link>
          <p className="text-xs leading-6 text-slate-500">
            Human expertise. Intelligent practice. Measurable growth.
          </p>
        </div>
      </footer>
    </main>
  );
}
