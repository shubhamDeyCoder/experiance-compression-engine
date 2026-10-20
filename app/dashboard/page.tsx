"use client";

import { useState } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScenarioOption = {
  text: string;
  score: number;
  feedback: string;
};

type Scenario = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  situation: string;
  question: string;
  options: ScenarioOption[];
};
export default function DashboardPage() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<
    { title: string; score: number; competency: string }[]
  >([]);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [scenarioError, setScenarioError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadScenarios() {
      const { data, error } = await supabase
        .from("expert_cases")
        .select("id, title, domain, difficulty, situation, question, options")
        .eq("is_approved", true)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setScenarioError(error.message);
      } else {
        setScenarios((data ?? []) as Scenario[]);
      }

      setLoadingScenarios(false);
    }

    loadScenarios();

    return () => {
      active = false;
    };
  }, []);
  const scenario = scenarios[scenarioIndex];

  const selected =
    selectedOption === null || !scenario
      ? null
      : scenario.options[selectedOption];
  const alreadyCompleted = results.some(
    (result) => result.title === scenario.title,
  );

  const averageScore =
    results.length === 0
      ? 0
      : Math.round(
          results.reduce((total, result) => total + result.score, 0) /
            results.length,
        );
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
      } else {
        setCheckingAuth(false);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);
  async function submitAnswer() {
    if (!selected || !scenario || submitted || saving) return;

    setSaving(true);
    setSaveError("");

    try {
      // Get the currently signed-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaveError("Your session has expired. Please sign in again.");
        return;
      }

      // Save the attempt in Supabase
      const { error: insertError } = await supabase
        .from("learner_attempts")
        .insert({
          learner_id: user.id,
          case_id: scenario.id,
          selected_option: selectedOption,
          score: selected.score,
          feedback: selected.feedback,
        });

      if (insertError) {
        console.error("Failed to save attempt:", insertError);
        setSaveError(insertError.message);
        return;
      }

      // Update the dashboard only after the database save succeeds
      setResults((previous) => [
        ...previous.filter((result) => result.title !== scenario.title),
        {
          title: scenario.title,
          score: selected.score,
          competency: scenario.domain,
        },
      ]);

      setSubmitted(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openScenario(index: number) {
    setScenarioIndex(index);
    setSelectedOption(null);
    setSubmitted(false);
  }

  function nextScenario() {
    const nextIndex = (scenarioIndex + 1) % scenarios.length;
    openScenario(nextIndex);
  }
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        Checking your session...
      </main>
    );
  }
  if (loadingScenarios) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        Loading scenarios from Supabase...
      </main>
    );
  }

  if (scenarioError) {
    return (
      <main className="min-h-screen bg-[#07111f] p-8 text-white">
        <h1 className="text-xl font-bold">Could not load scenarios</h1>
        <p className="mt-3 text-red-300">{scenarioError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
        >
          Try again
        </button>
      </main>
    );
  }

  if (scenarios.length === 0) {
    return (
      <main className="min-h-screen bg-[#07111f] p-8 text-white">
        No approved scenarios are available yet.
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1523]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#69e2bd] text-xl font-black text-[#08111f]">
              E
            </div>
            <div>
              <p className="text-sm font-bold tracking-wider">
                EXPERIENCE ENGINE
              </p>
              <p className="mt-1 text-xs text-slate-400">Learner workspace</p>
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-[#69e2bd] hover:text-[#69e2bd]"
          >
            ← Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">
            YOUR LEARNING WORKSPACE
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Competency dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Practise realistic industry decisions, learn from feedback, and
            identify the competencies you need to strengthen.
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Cases completed"
            value={`${results.length} / ${scenarios.length}`}
            detail="Unique scenarios assessed"
          />
          <StatCard
            label="Average score"
            value={`${averageScore}%`}
            detail="Based on completed cases"
          />
          <StatCard
            label="Current focus"
            value="Decision skills"
            detail="Practise before real-world application"
          />
        </section>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[0.75fr_1.5fr]">
          <aside className="rounded-2xl border border-white/10 bg-[#101c2b] p-5">
            <h2 className="text-lg font-semibold">Scenario library</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose a case to practise a different problem-solving skill.
            </p>

            <div className="mt-5 space-y-3">
              {scenarios.map((item, index) => {
                const completed = results.some(
                  (result) => result.title === item.title,
                );

                return (
                  <button
                    key={item.title}
                    onClick={() => openScenario(index)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      scenarioIndex === index
                        ? "border-[#69e2bd]/60 bg-[#69e2bd]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#69e2bd]">
                        {completed ? "✓ Done" : `0${index + 1}`}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{item.domain}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-white/10 p-4">
              <p className="text-xs font-semibold text-[#69e2bd]">
                YOUR RESULTS
              </p>

              {results.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Complete your first scenario to start building your competency
                  record.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.title}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-300">{result.title}</span>
                      <span className="font-semibold text-[#69e2bd]">
                        {result.score}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-[#69e2bd]/25 bg-[#69e2bd]/10 px-3 py-1.5 text-xs text-[#69e2bd]">
                {scenario.domain}
              </span>
              <span className="text-xs text-slate-400">
                {scenario.difficulty}
              </span>
            </div>

            <h2 className="mt-6 text-2xl font-semibold">{scenario.title}</h2>

            <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1523] p-5">
              <p className="text-xs font-semibold tracking-wider text-slate-400">
                INDUSTRY SITUATION
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {scenario.situation}
              </p>
            </div>

            <h3 className="mt-7 text-lg font-semibold">{scenario.question}</h3>
            <p className="mt-2 text-sm text-slate-400">
              Select the best response based on the available evidence.
            </p>

            <div className="mt-5 space-y-3">
              {scenario.options.map((option, index) => {
                const isSelected = selectedOption === index;

                return (
                  <button
                    key={option.text}
                    disabled={submitted}
                    onClick={() => setSelectedOption(index)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm leading-6 transition ${
                      isSelected
                        ? "border-[#69e2bd] bg-[#69e2bd]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    } ${submitted ? "cursor-default" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                        isSelected
                          ? "border-[#69e2bd] bg-[#69e2bd] text-[#08111f]"
                          : "border-white/20 text-slate-400"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-slate-200">{option.text}</span>
                  </button>
                );
              })}
            </div>

            {submitted && selected && (
              <div className="mt-6 rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/5 p-5">
                <p className="text-xs font-semibold tracking-wider text-[#69e2bd]">
                  EVALUATION FEEDBACK
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {selected.score} / 100
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {selected.feedback}
                </p>
                <p className="mt-4 text-xs text-slate-400">
                  Competency assessed: {scenario.domain}
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              {!submitted ? (
                <button
                  onClick={submitAnswer}
                  disabled={
                    selectedOption === null || alreadyCompleted || saving
                  }
                  className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving score..." : "Submit decision →"}
                </button>
              ) : (
                <button
                  onClick={nextScenario}
                  className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4]"
                >
                  Next scenario →
                </button>
              )}
              {saveError && (
                <p className="mt-4 text-sm text-red-300">
                  Could not save your score: {saveError}
                </p>
              )}

              {alreadyCompleted && !submitted && (
                <p className="self-center text-xs text-slate-400">
                  This case is already recorded in this session. Select another
                  case to continue.
                </p>
              )}
            </div>

            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-6 text-slate-500">
              Prototype evaluation: scores are predefined for each choice.
              Results are held in browser memory and reset when the page
              reloads. This is not yet an ML model or a validated professional
              competency assessment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#69e2bd]">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
