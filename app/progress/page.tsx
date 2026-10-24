"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Progress = {
  attempts_total: number;
  cases_attempted: number;
  cases_available: number;
  cases_mastered: number;
  avg_latest_score: number | null;
  avg_all_attempts: number | null;
  domains: { domain: string; cases: number; avg_latest_score: number; attempts: number }[];
  repeated_mistakes: { case_id: string; title: string; low_attempts: number }[];
  improvement: { case_id: string; title: string; first_score: number; latest_score: number }[];
  reflections: number;
  avg_reflection_coverage: number | null;
};

export default function ProgressPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("learner_progress");
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setProgress(data as Progress);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const weakAreas = progress?.domains.filter((d) => d.avg_latest_score < 70) ?? [];

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1523]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-bold tracking-wide">EXPERIENCE <span className="text-[#69e2bd]">ENGINE</span></Link>
          <nav className="flex gap-4 text-sm">
            <Link className="text-slate-300 hover:text-[#69e2bd]" href="/dashboard">Workspace</Link>
            <Link className="text-slate-300 hover:text-[#69e2bd]" href="/engine">Engine</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">MY PROGRESS</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">What your saved results show.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-400">Every number below is computed from your own saved attempts. Nothing is estimated, and it is a practice signal, not a certified competency assessment.</p>

        {loading && <p className="mt-8 text-slate-300">Loading your progress…</p>}
        {error && <p role="alert" className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

        {progress && progress.attempts_total === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#101c2b] p-6">
            <h2 className="text-lg font-semibold">No attempts yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Answer a scored decision in your workspace and your progress will appear here.</p>
            <Link href="/dashboard" className="mt-4 inline-block rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f]">Start practising</Link>
          </div>
        )}

        {progress && progress.attempts_total > 0 && (
          <div className="mt-8 space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="Cases completed" value={`${progress.cases_attempted} / ${progress.cases_available}`} detail="Cases with at least one saved attempt" />
              <Card label="Practice accuracy" value={progress.avg_latest_score === null ? "—" : `${progress.avg_latest_score}%`} detail="Average of your latest score per case" />
              <Card label="Total attempts" value={String(progress.attempts_total)} detail={`Average across all attempts: ${progress.avg_all_attempts ?? "—"}%`} />
              <Card label="Cases at 80%+" value={String(progress.cases_mastered)} detail="Latest score of 80 or more" />
            </div>

            <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Skills by domain</h2>
              <div className="mt-4 space-y-4">
                {progress.domains.map((d) => (
                  <div key={d.domain}>
                    <div className="flex justify-between text-sm"><span>{d.domain} <span className="text-slate-500">({d.cases} case{d.cases === 1 ? "" : "s"}, {d.attempts} attempt{d.attempts === 1 ? "" : "s"})</span></span><span className="font-semibold text-[#69e2bd]">{d.avg_latest_score}%</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#69e2bd]" style={{ width: `${d.avg_latest_score}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Areas needing practice</h2>
                {weakAreas.length === 0 ? <p className="mt-3 text-sm text-slate-400">No domain is currently below 70%.</p> : (
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">{weakAreas.map((d) => <li key={d.domain}>{d.domain}: {d.avg_latest_score}% on latest results</li>)}</ul>
                )}
                <p className="mt-4 text-xs text-slate-500">Threshold: latest domain average below 70%.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Repeated mistakes</h2>
                {progress.repeated_mistakes.length === 0 ? <p className="mt-3 text-sm text-slate-400">No case has two or more attempts below 70.</p> : (
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">{progress.repeated_mistakes.map((m) => <li key={m.case_id}>{m.title}: {m.low_attempts} attempts below 70</li>)}</ul>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Progress across attempts</h2>
              {progress.improvement.length === 0 ? <p className="mt-3 text-sm text-slate-400">Practise a case more than once to see how your score changes.</p> : (
                <ul className="mt-3 space-y-2 text-sm text-slate-300">{progress.improvement.map((i) => <li key={i.case_id} className="flex justify-between gap-3"><span>{i.title}</span><span>{i.first_score}% → <strong className="text-[#69e2bd]">{i.latest_score}%</strong></span></li>)}</ul>
              )}
            </section>

            <p className="text-xs leading-6 text-slate-500">
              Written-answer checks: {progress.reflections}{progress.avg_reflection_coverage !== null ? `, average key-concept coverage ${progress.avg_reflection_coverage}%` : ""}. Coverage is a keyword heuristic, not a grade.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#69e2bd]">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
