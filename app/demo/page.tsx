
"use client";

import { useState } from "react";
import Link from "next/link";

const scenarios = [
  {
    title: "The Delayed Project",
    domain: "Project Management",
    difficulty: "Intermediate",
    situation:
      "Your team is two days away from a client deadline. A critical component is delayed, and the team cannot complete every planned task on time.",
    question: "What should you do first?",
    options: [
      {
        text: "Ask the team to work overtime on every remaining task.",
        score: 25,
        feedback:
          "This may exhaust the team without solving the main bottleneck. Identify the critical dependency first.",
      },
      {
        text: "Identify critical tasks, assess the delay, and agree on priorities with stakeholders.",
        score: 100,
        feedback:
          "Strong decision. You assess the impact, prioritize critical work, and communicate early so stakeholders can make informed decisions.",
      },
      {
        text: "Wait until the component arrives before changing the plan.",
        score: 10,
        feedback:
          "Waiting reduces the time available to respond. Early assessment gives the team more options.",
      },
    ],
  },
  {
    title: "The Quality Warning",
    domain: "Quality & Safety",
    difficulty: "Intermediate",
    situation:
      "During a quality check, you notice that a deliverable may not meet the required specification. The deadline is close, and your supervisor is busy.",
    question: "What is the most responsible next step?",
    options: [
      {
        text: "Ignore the issue because the deadline is close.",
        score: 0,
        feedback:
          "Ignoring a potential defect can increase risk and rework. Quality concerns should be addressed, not concealed.",
      },
      {
        text: "Document the issue, assess its impact, and notify the appropriate supervisor.",
        score: 100,
        feedback:
          "Good judgment. Documenting evidence and escalating through the right channel supports traceability and safe decisions.",
      },
      {
        text: "Make an undocumented change and assume it will work.",
        score: 20,
        feedback:
          "Unapproved changes can introduce new problems. Follow the relevant review and change-control process.",
      },
    ],
  },
  {
    title: "The Recurring Failure",
    domain: "Problem Solving",
    difficulty: "Advanced",
    situation:
      "A process has failed three times this month. Each time, the team fixes the immediate problem, but the failure returns.",
    question: "How should you approach the next occurrence?",
    options: [
      {
        text: "Repeat the previous fix as quickly as possible.",
        score: 20,
        feedback:
          "A quick fix may restore operations temporarily, but it does not explain why the failure keeps returning.",
      },
      {
        text: "Blame the person who handled the last incident.",
        score: 0,
        feedback:
          "Blame does not establish the cause. Focus on evidence, process conditions, and contributing factors.",
      },
      {
        text: "Collect evidence, investigate root causes, and verify a corrective action.",
        score: 100,
        feedback:
          "Excellent. Root-cause analysis and verification help prevent recurrence instead of repeatedly treating symptoms.",
      },
    ],
  },
];

export default function DemoPage() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [totalScore, setTotalScore] = useState(0);

  const scenario = scenarios[scenarioIndex];
  const selectedOption =
    selected === null ? null : scenario.options[selected];

  function submitAnswer() {
    if (selected === null || submitted) return;

    setSubmitted(true);
    setCompleted((previous) =>
      previous.includes(scenarioIndex)
        ? previous
        : [...previous, scenarioIndex]
    );
    setTotalScore((previous) => previous + (selectedOption?.score ?? 0));
  }

  function nextScenario() {
    setScenarioIndex((previous) => (previous + 1) % scenarios.length);
    setSelected(null);
    setSubmitted(false);
  }

  const averageScore =
    completed.length > 0
      ? Math.round(totalScore / completed.length)
      : 0;

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-8 text-white md:px-12">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold">
          Experience<span className="text-emerald-400">Engine</span>
        </Link>

        <Link
          href="/login"
          className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          Sign up / Log in
        </Link>
      </header>

      <section className="mx-auto mt-12 max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Interactive product demo
        </p>

        <h1 className="mt-3 text-3xl font-bold md:text-5xl">
          Learn through decisions, not just theory.
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Explore realistic workplace situations, choose your response,
          and see feedback explaining the reasoning behind a stronger decision.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Scenarios completed</p>
            <p className="mt-2 text-3xl font-bold">
              {completed.length}/{scenarios.length}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Average score</p>
            <p className="mt-2 text-3xl font-bold">{averageScore}%</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Current scenario</p>
            <p className="mt-2 text-3xl font-bold">
              {scenarioIndex + 1}/{scenarios.length}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.5fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-bold">Scenario library</h2>

            <div className="mt-4 space-y-3">
              {scenarios.map((item, index) => (
                <button
                  key={item.title}
                  onClick={() => {
                    setScenarioIndex(index);
                    setSelected(null);
                    setSubmitted(false);
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    scenarioIndex === index
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span className="block font-semibold">{item.title}</span>
                  <span className="mt-1 block text-sm text-slate-400">
                    {item.domain}
                  </span>
                  <span className="mt-2 block text-xs text-emerald-300">
                    {completed.includes(index) ? "Completed" : item.difficulty}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                {scenario.domain}
              </span>
              <span className="text-sm text-slate-400">
                {scenario.difficulty}
              </span>
            </div>

            <h2 className="mt-5 text-2xl font-bold">{scenario.title}</h2>

            <p className="mt-4 leading-7 text-slate-300">
              {scenario.situation}
            </p>

            <h3 className="mt-7 font-semibold">{scenario.question}</h3>

            <div className="mt-4 space-y-3">
              {scenario.options.map((option, index) => (
                <button
                  key={option.text}
                  disabled={submitted}
                  onClick={() => setSelected(index)}
                  className={`w-full rounded-xl border p-4 text-left leading-6 transition ${
                    selected === index
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-white/10 hover:bg-white/5"
                  } disabled:cursor-default`}
                >
                  <span className="mr-3 font-bold text-emerald-300">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option.text}
                </button>
              ))}
            </div>

            {submitted && selectedOption && (
              <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <p className="font-bold text-emerald-300">
                  Your score: {selectedOption.score}/100
                </p>
                <p className="mt-3 leading-7 text-slate-200">
                  {selectedOption.feedback}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Demo feedback uses predefined example rules. It is not
                  generated by a trained machine-learning model.
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              {!submitted ? (
                <button
                  onClick={submitAnswer}
                  disabled={selected === null}
                  className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit decision
                </button>
              ) : (
                <button
                  onClick={nextScenario}
                  className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  Next scenario →
                </button>
              )}

              <Link
                href="/login"
                className="rounded-xl border border-white/15 px-5 py-3 font-semibold hover:bg-white/5"
              >
                Start learning
              </Link>
            </div>
          </section>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Public demo · Example scenarios · Progress resets when you refresh
        </p>
      </section>
    </main>
  );
}
