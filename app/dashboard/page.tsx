"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScenarioOption = { text: string; score: number; feedback: string };
type Scenario = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  situation: string;
  question: string;
  options: ScenarioOption[];
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
  const caseCompleted = submitted || Boolean(restoredAttempt);
  const displayedOption = restoredAttempt?.selected_option ?? selectedOption;
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
      const { data, error } = await supabase.from("expert_cases").select("id, title, domain, difficulty, situation, question, options").eq("is_approved", true).order("created_at", { ascending: true });
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
      const { error: insertError } = await supabase.from("learner_attempts").insert({ learner_id: user.id, case_id: scenario.id, selected_option: selectedOption, score: selected.score, feedback: selected.feedback });
      if (insertError) {
        if (isMounted.current) setSaveError(insertError.message);
        return;
      }
      if (isMounted.current) {
        setAttempts((previous) => [{ case_id: scenario.id, selected_option: selectedOption, score: selected.score, feedback: selected.feedback, created_at: new Date().toISOString() }, ...previous]);
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
  if (scenarios.length === 0) return <main className="min-h-screen bg-[#07111f] p-8 text-white">No approved scenarios are available yet.</main>;

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1523]"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#69e2bd] text-xl font-black text-[#08111f]">E</div><div><p className="text-sm font-bold tracking-wider">EXPERIENCE ENGINE</p><p className="mt-1 text-xs text-slate-400">Learner workspace</p></div></Link>
        <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-[#69e2bd] hover:text-[#69e2bd]">← Home</Link>
      </div></header>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div><p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">YOUR LEARNING WORKSPACE</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Competency dashboard</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Practise realistic industry decisions, learn from feedback, and identify the competencies you need to strengthen.</p></div>
        <section className="mt-8 grid gap-4 sm:grid-cols-3"><StatCard label="Cases completed" value={`${latestResults.length} / ${scenarios.length}`} detail="Latest recorded result for each case" /><StatCard label="Average score" value={`${averageScore}%`} detail="Across latest completed cases" /><StatCard label="Total attempts" value={`${attempts.length}`} detail={attempts.length === 1 ? "One submitted decision" : "All submitted decisions"} /></section>
        {progressError && <div role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><p>We could not restore your previous results: {progressError}</p><p className="mt-1 text-red-200/80">You can still view scenarios, but progress will remain unavailable until this is resolved.</p></div>}
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[0.75fr_1.5fr]">
          <aside className="rounded-2xl border border-white/10 bg-[#101c2b] p-5">
            <h2 className="text-lg font-semibold">Scenario library</h2><p className="mt-2 text-sm leading-6 text-slate-400">Choose a case to practise a different problem-solving skill.</p>
            <div className="mt-5 space-y-3">{scenarios.map((item, index) => { const completed = latestAttempts.has(item.id); return <button key={item.id} onClick={() => openScenario(index)} className={`w-full rounded-xl border p-4 text-left transition ${scenarioIndex === index ? "border-[#69e2bd]/60 bg-[#69e2bd]/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{item.title}</span><span className="text-xs text-[#69e2bd]">{completed ? "✓ Done" : `0${index + 1}`}</span></div><p className="mt-2 text-xs text-slate-400">{item.domain}</p></button>; })}</div>
            <div className="mt-6 rounded-xl border border-white/10 p-4"><p className="text-xs font-semibold text-[#69e2bd]">YOUR RESULTS</p>{latestResults.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-400">Complete your first scenario to start building your competency record.</p> : <div className="mt-3 space-y-3">{latestResults.map((result) => <div key={result.case_id} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-300">{result.title}</span><span className="font-semibold text-[#69e2bd]">{result.score}%</span></div>)}</div>}</div>
            <AnalyticsSummary attempts={attempts} averageAttemptScore={averageAttemptScore} domainSummary={domainSummary} />
          </aside>
          <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border border-[#69e2bd]/25 bg-[#69e2bd]/10 px-3 py-1.5 text-xs text-[#69e2bd]">{scenario.domain}</span><span className="text-xs text-slate-400">{scenario.difficulty}</span></div><h2 className="mt-6 text-2xl font-semibold">{scenario.title}</h2>
            <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1523] p-5"><p className="text-xs font-semibold tracking-wider text-slate-400">INDUSTRY SITUATION</p><p className="mt-3 text-sm leading-7 text-slate-300">{scenario.situation}</p></div><h3 className="mt-7 text-lg font-semibold">{scenario.question}</h3><p className="mt-2 text-sm text-slate-400">Select the best response based on the available evidence.</p>
            <div className="mt-5 space-y-3">{scenario.options.map((option, index) => { const isSelected = displayedOption === index; return <button key={option.text} disabled={caseCompleted} onClick={() => setSelectedOption(index)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm leading-6 transition ${isSelected ? "border-[#69e2bd] bg-[#69e2bd]/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"} ${caseCompleted ? "cursor-default" : ""}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${isSelected ? "border-[#69e2bd] bg-[#69e2bd] text-[#08111f]" : "border-white/20 text-slate-400"}`}>{String.fromCharCode(65 + index)}</span><span className="text-slate-200">{option.text}</span></button>; })}</div>
            {caseCompleted && selected && <div className="mt-6 rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/5 p-5"><p className="text-xs font-semibold tracking-wider text-[#69e2bd]">EVALUATION FEEDBACK</p><p className="mt-3 text-2xl font-semibold">{restoredAttempt?.score ?? selected.score} / 100</p><p className="mt-3 text-sm leading-7 text-slate-300">{restoredAttempt?.feedback ?? selected.feedback}</p><p className="mt-4 text-xs text-slate-400">Competency assessed: {scenario.domain}</p></div>}
            <div className="mt-7 flex flex-wrap gap-3">{!caseCompleted ? <button onClick={submitAnswer} disabled={selectedOption === null || saving || Boolean(progressError)} className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving score..." : "Submit decision →"}</button> : <button onClick={nextScenario} className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4]">Next scenario →</button>}{saveError && <p className="self-center text-sm text-red-300">Could not save your score: {saveError}</p>}{caseCompleted && restoredAttempt && <p className="self-center text-xs text-slate-400">Showing your latest saved response for this case.</p>}</div>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-6 text-slate-500">Scores are predefined for each choice. Your latest saved answer is shown for each case; the analytics summary includes every saved attempt. This is not an ML model or a validated professional competency assessment.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

function AnalyticsSummary({ attempts, averageAttemptScore, domainSummary }: { attempts: LearnerAttempt[]; averageAttemptScore: number; domainSummary: { domain: string; average: number; count: number }[] }) {
  return <div className="mt-6 rounded-xl border border-white/10 p-4"><p className="text-xs font-semibold text-[#69e2bd]">PROGRESS SUMMARY</p>{attempts.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-400">Analytics will appear after your first saved decision.</p> : <><p className="mt-2 text-sm text-slate-300">{attempts.length} attempt{attempts.length === 1 ? "" : "s"} · {averageAttemptScore}% average across all attempts</p>{domainSummary.length > 0 && <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs"><p className="text-slate-400">Latest-result averages by domain:</p>{domainSummary.map((item) => <div key={item.domain} className="flex justify-between gap-2 text-slate-300"><span>{item.domain} ({item.count})</span><span className="font-semibold text-[#69e2bd]">{item.average}%</span></div>)}<p className="pt-1 leading-5 text-slate-500">Use the lowest average as a practice signal, not a validated competency diagnosis.</p></div>}</>}</div>;
}
function LoadingScreen({ message }: { message: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">{message}</main>; }
function ErrorScreen({ title, error }: { title: string; error: string }) { return <main className="min-h-screen bg-[#07111f] p-8 text-white"><h1 className="text-xl font-bold">{title}</h1><p className="mt-3 text-red-300">{error}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Try again</button></main>; }
function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold text-[#69e2bd]">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
