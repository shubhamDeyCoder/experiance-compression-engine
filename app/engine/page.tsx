"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DIFFICULTY_LEVELS, EngineResponse, RELEVANCE_WEIGHTS } from "@/lib/engine/types";

const inputClasses =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#69e2bd]";

export default function EnginePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EngineResponse | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setResult(null);
    if (query.trim().length < 10) {
      setError("Describe your problem in at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ query, domain, difficulty }),
      });
      const json = (await response.json()) as EngineResponse & { error?: string };
      if (!response.ok) setError(json.error ?? "The engine request failed.");
      else {
        setResult(json);
        setOpenId(json.matches[0]?.case_id ?? null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The engine request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1523]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-bold tracking-wide">
            EXPERIENCE <span className="text-[#69e2bd]">ENGINE</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link className="text-slate-300 hover:text-[#69e2bd]" href="/dashboard">Workspace</Link>
            <Link className="text-slate-300 hover:text-[#69e2bd]" href="/progress">My progress</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">EXPERIENCE MATCHING</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Find verified experience for your problem.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-400">
          Describe a problem you face. The engine searches only reviewer-approved expert cases, ranks them with a transparent
          formula, and shows exactly why each one was selected.
        </p>

        <form onSubmit={run} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <label className="block text-sm font-medium text-slate-200">
            Your problem
            <textarea required rows={5} maxLength={4000} value={query} onChange={(e) => setQuery(e.target.value)} className={inputClasses} placeholder="e.g. Our website became slow right after we released a new feature and customers are complaining." />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-200">
              Domain (optional)
              <input value={domain} maxLength={100} onChange={(e) => setDomain(e.target.value)} className={inputClasses} placeholder="e.g. Backend engineering" />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Difficulty (optional)
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClasses}>
                <option value="">Any</option>
                {DIFFICULTY_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
          <button disabled={loading} className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] hover:bg-[#91f3d4] disabled:opacity-50">
            {loading ? "Searching verified cases…" : "Find matching experience →"}
          </button>
        </form>

        {result && (
          <section className="mt-10 space-y-8" aria-live="polite">
            {result.matches.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-6">
                <h2 className="text-lg font-semibold">No approved case matched</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Nothing in the verified corpus is close to this description yet. You can{" "}
                  <Link href="/dashboard/submit" className="font-semibold text-[#69e2bd]">submit it as a case</Link> so an expert can work on it.
                </p>
              </div>
            ) : (
              <>
                {result.narrative.used && result.narrative.text && (
                  <div className="rounded-2xl border border-[#69e2bd]/25 bg-[#69e2bd]/[0.05] p-5 sm:p-6">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">AI SUMMARY (BASED ONLY ON THE CASES BELOW)</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{result.narrative.text}</p>
                  </div>
                )}
                {!result.narrative.used && result.narrative.reason && (
                  <p className="text-xs text-slate-500">{result.narrative.reason}</p>
                )}

                <div>
                  <h2 className="text-xl font-semibold">Suggested learning path</h2>
                  <ol className="mt-4 space-y-3">
                    {result.path.map((step) => (
                      <li key={step.order} className="flex gap-4 rounded-xl border border-white/10 bg-[#101c2b] p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#69e2bd]/15 text-sm font-semibold text-[#69e2bd]">{step.order}</span>
                        <div>
                          <Link href={step.href} className="font-semibold hover:text-[#69e2bd]">{step.title}</Link>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h2 className="text-xl font-semibold">Why these cases?</h2>
                  <div className="mt-4 space-y-3">
                    {result.matches.map((match) => {
                      const open = openId === match.case_id;
                      const parts = [
                        ["Text match", match.text_score, RELEVANCE_WEIGHTS.text],
                        ["Domain", match.domain_score, RELEVANCE_WEIGHTS.domain],
                        ["Difficulty", match.difficulty_score, RELEVANCE_WEIGHTS.difficulty],
                        ["Weak-area signal", match.weak_area_score, RELEVANCE_WEIGHTS.weakArea],
                      ] as const;
                      return (
                        <article key={match.case_id} className="rounded-xl border border-white/10 bg-[#101c2b] p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <Link href={`/resources/${match.case_id}`} className="font-semibold hover:text-[#69e2bd]">{match.title}</Link>
                              <p className="mt-1 text-xs text-slate-400">{match.domain} · {match.difficulty}</p>
                              {match.is_seed && <span className="mt-2 inline-block rounded-full border border-amber-300/30 px-2.5 py-1 text-xs text-amber-200">Demo seed example — not real expert experience</span>}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-semibold text-[#69e2bd]">{Math.round(match.relevance * 100)}</p>
                              <p className="text-[10px] tracking-wider text-slate-500">RELEVANCE / 100</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setOpenId(open ? null : match.case_id)} aria-expanded={open} className="mt-3 text-sm font-semibold text-[#69e2bd] hover:text-[#b6f7e3]">
                            {open ? "Hide explanation" : "Why this recommendation?"}
                          </button>
                          {open && (
                            <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                              <ul className="space-y-2 text-sm leading-6 text-slate-300">
                                {(result.reasons[match.case_id] ?? []).map((reason) => (
                                  <li key={reason} className="flex gap-2"><span className="text-[#69e2bd]">•</span>{reason}</li>
                                ))}
                              </ul>
                              <div className="space-y-2">
                                {parts.map(([label, score, weight]) => (
                                  <div key={label}>
                                    <div className="flex justify-between text-xs text-slate-400">
                                      <span>{label} (weight {Math.round(weight * 100)}%)</span>
                                      <span>{Math.round(score * 100)}%</span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                      <div className="h-full rounded-full bg-[#69e2bd]" style={{ width: `${Math.min(100, Math.round(score * 100))}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs leading-5 text-slate-500">
                                Evidence: case ID {match.case_id}. Relevance = 0.60 × text + 0.15 × domain + 0.05 × difficulty + 0.20 × weak-area − mastered penalty.
                              </p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#0b1523] p-5">
              <h2 className="text-sm font-semibold">Limitations</h2>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-400">
                {result.limitations.map((item) => (<li key={item}>• {item}</li>))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">How the engine works</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li><strong>1. Verified corpus.</strong> Experts document how they solved a real problem; a different reviewer scores it on a rubric and approves it. Only approved cases are searched.</li>
            <li><strong>2. Structured knowledge.</strong> Each case stores context, constraints, approaches considered, solution, trade-offs, lessons and scored decision options.</li>
            <li><strong>3. Retrieval.</strong> PostgreSQL full-text search ranks cases against your description, then adds domain, difficulty and a weak-area signal from your own saved results.</li>
            <li><strong>4. Guided practice.</strong> You attempt the decision first, then compare with the expert&apos;s reasoning. Scores are computed on the server and saved.</li>
            <li><strong>5. Optional AI summary.</strong> If a server-side key is configured, an LLM writes a short note using only the retrieved cases. Without a key, everything above still works.</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-slate-500">Compress the learning curve, not the truth: this practises expert-style decisions faster, it does not replace years of experience.</p>
        </section>
      </div>
    </main>
  );
}
