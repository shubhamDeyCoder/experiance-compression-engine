"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import WorkspaceFooter from "@/components/WorkspaceFooter";

type ScenarioOption = { text: string };
type AttemptResult = { out_score: number; out_feedback: string; out_best_option: number; out_best_feedback: string };
type Scenario = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  situation: string;
  question: string;
  options: ScenarioOption[];
  is_seed: boolean;
};
type LearnerAttempt = {
  case_id: string;
  selected_option: number;
  score: number;
  feedback: string;
  created_at: string;
};

function getLatestAttempts(attempts: LearnerAttempt[]) {
  const latestByCase = new Map<string, LearnerAttempt>();
  for (const attempt of attempts) {
    const current = latestByCase.get(attempt.case_id);
    if (!current || attempt.created_at > current.created_at) latestByCase.set(attempt.case_id, attempt);
  }
  return latestByCase;
}

export default function DashboardPage() {
  const router = useRouter();
  const isMounted = useRef(true);
  const learnerIdRef = useRef<string | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastBest, setLastBest] = useState<{ caseId: string; option: number; feedback: string } | null>(null);
  const [attempts, setAttempts] = useState<LearnerAttempt[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [scenarioError, setScenarioError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [learnerId, setLearnerId] = useState<string | null>(null);

  const latestAttempts = useMemo(() => getLatestAttempts(attempts), [attempts]);
  const scenario = scenarios[scenarioIndex];
  const restoredAttempt = scenario ? latestAttempts.get(scenario.id) : undefined;
  const caseCompleted = !retrying && (submitted || Boolean(restoredAttempt));
  const displayedOption = retrying ? selectedOption : (restoredAttempt?.selected_option ?? selectedOption);
  const selected = displayedOption === null || !scenario ? null : scenario.options[displayedOption];
  const latestResults = useMemo(
    () => scenarios.map((item) => {
      const attempt = latestAttempts.get(item.id);
      return attempt ? { ...attempt, title: item.title, domain: item.domain } : null;
    }).filter((result): result is LearnerAttempt & { title: string; domain: string } => result !== null),
    [latestAttempts, scenarios],
  );
  const averageScore = latestResults.length === 0 ? 0 : Math.round(latestResults.reduce((total, result) => total + result.score, 0) / latestResults.length);
  const averageAttemptScore = attempts.length === 0 ? 0 : Math.round(attempts.reduce((total, attempt) => total + attempt.score, 0) / attempts.length);
  const domainSummary = useMemo(() => {
    const domains = new Map<string, { total: number; count: number }>();
    for (const result of latestResults) {
      const current = domains.get(result.domain) ?? { total: 0, count: 0 };
      domains.set(result.domain, { total: current.total + result.score, count: current.count + 1 });
    }
    return [...domains.entries()].map(([domain, value]) => ({ domain, average: Math.round(value.total / value.count), count: value.count })).sort((a, b) => a.average - b.average);
  }, [latestResults]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadScenarios() {
      const { data, error } = await supabase.rpc("list_practice_cases");
      if (!active) return;
      if (error) setScenarioError(error.message);
      else setScenarios((data ?? []) as Scenario[]);
      setLoadingScenarios(false);
    }
    void loadScenarios();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProgress(userId: string) {
      if (active) { setLoadingProgress(true); setProgressError(""); }
      const { data, error } = await supabase.from("learner_attempts").select("case_id, selected_option, score, feedback, created_at").eq("learner_id", userId).order("created_at", { ascending: false });
      if (!active) return;
      if (error) { setProgressError(error.message); setAttempts([]); }
      else setAttempts((data ?? []) as LearnerAttempt[]);
      setLoadingProgress(false);
    }
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        setCheckingAuth(false);
        setLoadingProgress(false);
        router.replace("/login");
        return;
      }
      learnerIdRef.current = data.user.id;
      setLearnerId(data.user.id);
      setCheckingAuth(false);
      await loadProgress(data.user.id);
    }
    void checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        learnerIdRef.current = null;
        setLearnerId(null);
        setAttempts([]);
        setProgressError("");
        setLoadingProgress(false);
        router.replace("/login");
      } else if (event === "SIGNED_IN" && session.user.id !== learnerIdRef.current) {
        learnerIdRef.current = session.user.id;
        setLearnerId(session.user.id);
        void loadProgress(session.user.id);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router]);

  function openScenario(index: number) {
    const nextScenario = scenarios[index];
    const previousAttempt = nextScenario ? latestAttempts.get(nextScenario.id) : undefined;
    setScenarioIndex(index);
    setSelectedOption(previousAttempt?.selected_option ?? null);
    setSubmitted(Boolean(previousAttempt));
    setRetrying(false);
    setLastBest(null);
    setSaveError("");
  }
  function nextScenario() {
    if (scenarios.length > 0) openScenario((scenarioIndex + 1) % scenarios.length);
  }
  async function submitAnswer() {
    if (selectedOption === null || !selected || !scenario || caseCompleted || saving || !learnerId) return;
    setSaving(true);
    setSaveError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || user.id !== learnerId) {
        if (isMounted.current) setSaveError("Your session has expired. Please sign in again.");
        return;
      }
      // The score is calculated on the server from the expert's reviewed options.
      const { data: scored, error: insertError } = await supabase.rpc("submit_case_attempt", { p_case_id: scenario.id, p_selected_option: selectedOption });
      const result = ((scored ?? []) as AttemptResult[])[0];
      if (insertError || !result) {
        if (isMounted.current) setSaveError(insertError?.message ?? "The server did not return a result.");
        return;
      }
      if (isMounted.current) {
        setAttempts((previous) => [{ case_id: scenario.id, selected_option: selectedOption, score: result.out_score, feedback: result.out_feedback, created_at: new Date().toISOString() }, ...previous]);
        setLastBest({ caseId: scenario.id, option: result.out_best_option, feedback: result.out_best_feedback });
        setRetrying(false);
        setSubmitted(true);
      }
    } catch (error) {
      if (isMounted.current) setSaveError(error instanceof Error ? error.message : "An unexpected error occurred.");
    } finally {
      if (isMounted.current) setSaving(false);
    }
  }

  if (checkingAuth) return <LoadingScreen message="Checking your session..." />;
  if (loadingScenarios) return <LoadingScreen message="Loading scenarios from Supabase..." />;
  if (loadingProgress) return <LoadingScreen message="Restoring your learning progress..." />;
  if (scenarioError) return <ErrorScreen title="Could not load scenarios" error={scenarioError} />;
  if (scenarios.length === 0) return (
    <main className="flex min-h-screen flex-col bg-[#08111f] text-white">
      <WorkspaceHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 p-8">
        <h1 className="text-2xl font-semibold">No approved scenarios yet</h1>
        <p className="mt-3 leading-7 text-slate-400">Practice scenarios appear here once an expert has answered a case and an independent reviewer has approved it. You can start that process by submitting your own case.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/submit" className="rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4]">Submit a Case</Link>
          <Link href="/" className="rounded-xl border border-white/10 px-6 py-3.5 text-sm text-slate-300 hover:text-[#69e2bd]">← Home</Link>
        </div>
      </div>
      <WorkspaceFooter />
    </main>
  );

  
  return (
    <main className="flex min-h-screen flex-col bg-[#08111f] text-white">
      <WorkspaceHeader />
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10">
        {/* Welcome */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#101c2b] p-6 sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#69e2bd]/10 blur-[90px]" />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#69e2bd]/20 bg-[#69e2bd]/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#69e2bd]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#69e2bd]" />
                YOUR LEARNING WORKSPACE
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Turn experience into
                <span className="block text-[#69e2bd]">
                  practical expertise.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                Practise real-world decisions, learn from expert knowledge,
                and track your progress as you develop professional
                problem-solving skills.
              </p>

              <Link
                href="/dashboard/submit"
                className="mt-6 inline-block rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4]"
              >
                Submit a Case →
              </Link>
            </div>

            <div className="relative w-full rounded-2xl border border-white/[0.08] bg-[#08111f]/70 p-5 lg:max-w-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Overall case completion
                </span>
                <span className="text-sm font-semibold text-[#69e2bd]">
                  {Math.round((latestResults.length / scenarios.length) * 100)}%
                </span>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                role="progressbar"
                aria-label="Overall case completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  (latestResults.length / scenarios.length) * 100,
                )}
              >
                <div
                  className="h-full rounded-full bg-[#69e2bd] transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (latestResults.length / scenarios.length) * 100,
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {latestResults.length} of {scenarios.length} available cases
                have a saved result.
              </p>
            </div>
          </div>
        </section>

        {/* Overview metrics */}
        <section
          aria-label="Learning statistics"
          className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Cases completed"
            value={`${latestResults.length} / ${scenarios.length}`}
            detail="Cases with a saved result"
          />
          <StatCard
            label="Average score"
            value={`${averageScore}%`}
            detail="Latest result for each completed case"
          />
          <StatCard
            label="Total attempts"
            value={`${attempts.length}`}
            detail="All saved decision attempts"
          />
          <StatCard
            label="Cases to explore"
            value={`${scenarios.length - latestResults.length}`}
            detail="Cases without a saved result"
          />
        </section>

        {progressError && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-5 text-sm text-red-200"
          >
            <p className="font-semibold">Progress could not be restored</p>
            <p className="mt-2 leading-6">{progressError}</p>
            <p className="mt-2 text-red-200/70">
              Existing progress may be unavailable until the issue is resolved.
            </p>
          </div>
        )}

        {/* Main workspace */}
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
          {/* Scenario library */}
          <aside className="min-w-0 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Scenario library</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Select a challenge and practise your decision-making.
                </p>
              </div>
              <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400">
                {scenarios.length} cases
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {scenarios.map((item, index) => {
                const completed = latestAttempts.has(item.id);
                const active = scenarioIndex === index;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => openScenario(index)}
                    className={`w-full rounded-xl border p-4 text-left transition duration-200 ${
                      active
                        ? "border-[#69e2bd]/50 bg-[#69e2bd]/[0.08] shadow-lg shadow-black/10"
                        : "border-white/[0.08] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.035]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                          completed
                            ? "bg-[#69e2bd]/15 text-[#69e2bd]"
                            : active
                              ? "bg-white/10 text-white"
                              : "bg-white/[0.04] text-slate-500"
                        }`}
                      >
                        {completed ? "✓" : String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-6 text-slate-100">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">
                          {item.domain}
                        </span>
                      </span>

                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          completed ? "bg-[#69e2bd]" : "bg-slate-600"
                        }`}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                      <span className="text-[10px] text-slate-500">
                        {item.difficulty}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          completed ? "text-[#69e2bd]" : "text-slate-500"
                        }`}
                      >
                        {completed ? "Completed" : "Not attempted"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Latest results */}
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h3 className="text-sm font-semibold">Recent case results</h3>

              {latestResults.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Your results will appear here after your first saved decision.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {[...latestResults]
                    .sort((a, b) =>
                      b.created_at.localeCompare(a.created_at),
                    )
                    .slice(0, 5)
                    .map((result) => (
                      <div
                        key={result.case_id}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-5 text-slate-300">
                            {result.title}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {result.domain}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-[#69e2bd]">
                          {result.score}%
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <AnalyticsSummary
              attempts={attempts}
              averageAttemptScore={averageAttemptScore}
              domainSummary={domainSummary}
            />
          </aside>

          {/* Decision practice */}
          <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.17em] text-[#69e2bd]">
                  DECISION PRACTICE
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Case {String(scenarioIndex + 1).padStart(2, "0")} of{" "}
                  {String(scenarios.length).padStart(2, "0")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#69e2bd]/20 bg-[#69e2bd]/[0.06] px-3 py-1.5 text-xs text-[#69e2bd]">
                  {scenario.domain}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                  {scenario.difficulty}
                </span>
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {scenario.title}
            </h2>
            {scenario.is_seed && (
              <p className="mt-3 inline-block rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-200">Demo seed example — not real expert experience</p>
            )}

            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#08111f]/70 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#69e2bd]" />
                <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400">
                  INDUSTRY SITUATION
                </p>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                {scenario.situation}
              </p>
            </div>

            <div className="mt-8">
              <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-500">
                YOUR DECISION
              </p>
              <h3 className="mt-3 text-lg font-semibold leading-7 sm:text-xl">
                {scenario.question}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Consider the available evidence and choose the response you
                believe is most appropriate.
              </p>
            </div>

            {scenario.options.length === 0 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                This approved case does not have scored answer options yet.{" "}
                <Link href={`/resources/${scenario.id}`} className="font-semibold text-[#69e2bd] hover:text-[#b6f7e3]">
                  Open it as a learning resource →
                </Link>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {scenario.options.map((option, index) => {
                const isSelected = displayedOption === index;

                return (
                  <button
                    key={option.text}
                    type="button"
                    disabled={caseCompleted}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedOption(index)}
                    className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition duration-200 sm:p-5 ${
                      isSelected
                        ? "border-[#69e2bd]/60 bg-[#69e2bd]/[0.08]"
                        : "border-white/[0.08] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]"
                    } ${
                      caseCompleted
                        ? "cursor-default"
                        : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69e2bd]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                        isSelected
                          ? "border-[#69e2bd] bg-[#69e2bd] text-[#08111f]"
                          : "border-white/15 bg-white/[0.025] text-slate-400"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 pt-1 text-sm leading-6 text-slate-200">
                      {option.text}
                    </span>
                    {isSelected && (
                      <span className="pt-1 text-xs font-semibold text-[#69e2bd]">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {caseCompleted && selected && (
              <div className="mt-6 rounded-2xl border border-[#69e2bd]/25 bg-[#69e2bd]/[0.05] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.15em] text-[#69e2bd]">
                      EVALUATION FEEDBACK
                    </p>
                    <p className="mt-3 text-3xl font-semibold">
                      {restoredAttempt?.score ?? 0}
                      <span className="ml-1 text-base font-normal text-slate-500">
                        / 100
                      </span>
                    </p>
                  </div>
                  <span className="rounded-full border border-[#69e2bd]/20 px-3 py-1.5 text-xs text-[#69e2bd]">
                    Result recorded
                  </span>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {restoredAttempt?.feedback ?? ""}
                </p>

                {lastBest && lastBest.caseId === scenario.id && scenario.options[lastBest.option] && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#08111f]/60 p-4">
                    <p className="text-[10px] font-semibold tracking-[0.15em] text-[#69e2bd]">EXPERT-RECOMMENDED CHOICE</p>
                    <p className="mt-2 text-sm text-slate-200">{String.fromCharCode(65 + lastBest.option)}. {scenario.options[lastBest.option].text}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{lastBest.feedback}</p>
                  </div>
                )}

                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <p className="text-xs text-slate-500">
                    Competency area
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-200">
                    {scenario.domain}
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-500/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-200"
              >
                <p className="font-semibold">Your answer could not be saved.</p>
                <p className="mt-1">{saveError}</p>
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {!caseCompleted ? (
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={
                    selectedOption === null ||
                    saving ||
                    Boolean(progressError)
                  }
                  className="rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving your decision..." : "Submit decision →"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextScenario}
                  className="rounded-xl bg-[#69e2bd] px-6 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4]"
                >
                  Explore next case →
                </button>
              )}

              {caseCompleted && (
                <button
                  type="button"
                  onClick={() => { setRetrying(true); setSelectedOption(null); setSubmitted(false); setLastBest(null); setSaveError(""); }}
                  className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-[#69e2bd]/50 hover:text-[#69e2bd]"
                >
                  Practise this case again
                </button>
              )}

              {caseCompleted && (
                <span className="text-xs leading-5 text-slate-500">
                  Your latest saved response is displayed for this case.
                </span>
              )}
            </div>

            <p className="mt-7 border-t border-white/[0.08] pt-4 text-xs leading-6 text-slate-500">
              Each option score comes from the expert reviewed rubric and is
              calculated on the server. Results are learning aids, not a
              validated professional competency assessment.
            </p>
          </section>
        </div>
      </div>
      <WorkspaceFooter />
    </main>
  );
}

function AnalyticsSummary({ attempts, averageAttemptScore, domainSummary }: { attempts: LearnerAttempt[]; averageAttemptScore: number; domainSummary: { domain: string; average: number; count: number }[] }) {
  return <div className="mt-6 rounded-xl border border-white/10 p-4"><p className="text-xs font-semibold text-[#69e2bd]">PROGRESS SUMMARY</p>{attempts.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-400">Analytics will appear after your first saved decision.</p> : <><p className="mt-2 text-sm text-slate-300">{attempts.length} attempt{attempts.length === 1 ? "" : "s"} · {averageAttemptScore}% average across all attempts</p>{domainSummary.length > 0 && <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs"><p className="text-slate-400">Latest-result averages by domain:</p>{domainSummary.map((item) => <div key={item.domain} className="flex justify-between gap-2 text-slate-300"><span>{item.domain} ({item.count})</span><span className="font-semibold text-[#69e2bd]">{item.average}%</span></div>)}<p className="pt-1 leading-5 text-slate-500">Use the lowest average as a practice signal, not a validated competency diagnosis.</p></div>}</>}</div>;
}
function LoadingScreen({ message }: { message: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">{message}</main>; }
function ErrorScreen({ title, error }: { title: string; error: string }) { return <main className="min-h-screen bg-[#07111f] p-8 text-white"><h1 className="text-xl font-bold">{title}</h1><p className="mt-3 text-red-300">{error}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Try again</button></main>; }
function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold text-[#69e2bd]">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
