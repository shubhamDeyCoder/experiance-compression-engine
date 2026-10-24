"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  DIFFICULTY_LEVELS,
  EngineResponse,
  RELEVANCE_WEIGHTS,
  ModelReviewSignal,
  ScenarioEvaluation,
  ScenarioResponse,
} from "@/lib/engine/types";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import WorkspaceFooter from "@/components/WorkspaceFooter";

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
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [scenarioAnswer, setScenarioAnswer] = useState("");
  const [scenarioEvaluation, setScenarioEvaluation] = useState<ScenarioEvaluation | null>(null);
  const [modelReviewSignal, setModelReviewSignal] = useState<ModelReviewSignal | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setResult(null);
    setScenario(null);
    setScenarioEvaluation(null);
    setModelReviewSignal(null);
    setScenarioError("");
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

  async function generateScenario() {
    if (!result || scenarioLoading) return;
    setScenarioLoading(true);
    setScenarioError("");
    setScenario(null);
    setScenarioEvaluation(null);
    setModelReviewSignal(null);
    setFeedbackSubmitted(false);
    setFeedbackComment("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ action: "scenario", query, domain, difficulty }),
      });
      const json = await response.json() as ScenarioResponse & { error?: string };
      if (!response.ok) setScenarioError(json.error ?? "The scenario could not be generated.");
      else setScenario(json);
    } catch (caught) {
      setScenarioError(caught instanceof Error ? caught.message : "The scenario could not be generated.");
    } finally {
      setScenarioLoading(false);
    }
  }

  async function evaluateScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scenario || evaluationLoading) return;
    setEvaluationLoading(true);
    setScenarioError("");
    setScenarioEvaluation(null);
    setFeedbackSubmitted(false);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ action: "evaluate", scenario_id: scenario.scenario_id, answer: scenarioAnswer }),
      });
      const json = await response.json() as { evaluation?: ScenarioEvaluation; ml_review_signal?: ModelReviewSignal; error?: string };
      if (!response.ok || !json.evaluation) setScenarioError(json.error ?? "Your answer could not be evaluated.");
      else {
        setScenarioEvaluation(json.evaluation);
        setModelReviewSignal(json.ml_review_signal ?? null);
      }
    } catch (caught) {
      setScenarioError(caught instanceof Error ? caught.message : "Your answer could not be evaluated.");
    } finally {
      setEvaluationLoading(false);
    }
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scenario || feedbackSubmitted || feedbackLoading) return;
    setScenarioError("");
    setFeedbackLoading(true);
    try {
      const { error: feedbackError } = await supabase.rpc("submit_engine_feedback", {
        p_scenario_id: scenario.scenario_id,
        p_category: "evaluation",
        p_rating: feedbackRating,
        p_comment: feedbackComment.trim(),
      });
      if (feedbackError) setScenarioError(feedbackError.message);
      else setFeedbackSubmitted(true);
    } catch (caught) {
      setScenarioError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#08111f] text-white">
      <WorkspaceHeader />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">EXPERIENCE MATCHING</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Find verified experience for your problem.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-400">
          Describe a problem you face. The engine combines reviewer-approved cases with your company&apos;s validated knowledge,
          cites its sources, and adapts practice difficulty using your saved results.
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
            <p className="text-xs text-slate-500">
              Retrieval: {result.retrievalMode === "hybrid" ? "semantic + keyword hybrid search" : "keyword search (configure OPENAI_API_KEY for semantic search)"}.
            </p>
            {result.matches.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-6">
                <h2 className="text-lg font-semibold">No approved case matched</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Nothing in the verified corpus is close to this description yet. You can{" "}
                  <Link href="/dashboard/submit" className="font-semibold text-[#69e2bd]">submit it as a case</Link> so an expert can work on it.
                </p>
                {result.narrative.used && result.narrative.text && <p className="mt-4 text-sm leading-7 text-slate-300">{result.narrative.text}</p>}
                {result.sources.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold">Company knowledge citations</h3>
                    <ul className="mt-3 space-y-2 text-sm">
                      {result.sources.map((source) => <li key={`${source.source_type}:${source.source_id}`}>
                        {source.source_url || source.case_id
                          ? <a className="text-[#69e2bd] hover:text-[#b6f7e3]" href={source.citation} target={source.source_url ? "_blank" : undefined} rel={source.source_url ? "noreferrer" : undefined}>{source.title}</a>
                          : <span className="text-slate-300">{source.title} <span className="text-xs text-slate-500">({source.citation})</span></span>}
                        <span className="ml-2 text-xs text-slate-500">{source.source_type.replaceAll("_", " ")}</span>
                      </li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                {result.narrative.used && result.narrative.text && (
                  <div className="rounded-2xl border border-[#69e2bd]/25 bg-[#69e2bd]/[0.05] p-5 sm:p-6">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">AI SUMMARY (BASED ONLY ON THE CITED SOURCES)</p>
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

                {result.sources.length > 0 && (
                  <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
                    <h2 className="text-xl font-semibold">Evidence and citations</h2>
                    <ul className="mt-4 space-y-3">
                      {result.sources.map((source) => (
                        <li key={`${source.source_type}:${source.source_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4">
                          <div>
                            <p className="font-semibold">{source.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{source.source_type.replaceAll("_", " ")} · {source.domain} · relevance {Math.round(source.relevance * 100)}%</p>
                          </div>
                          {source.source_url || source.case_id
                            ? <a href={source.citation} target={source.source_url ? "_blank" : undefined} rel={source.source_url ? "noreferrer" : undefined} className="text-sm font-semibold text-[#69e2bd] hover:text-[#b6f7e3]">View source ↗</a>
                            : <span className="text-xs text-slate-500">{source.citation}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="rounded-2xl border border-[#69e2bd]/25 bg-[#69e2bd]/[0.04] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Practise with an AI-generated scenario</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        The scenario is grounded in the cited approved evidence, saved to your account, and evaluated against expert-scored decisions.
                      </p>
                    </div>
                    <button type="button" onClick={() => void generateScenario()} disabled={scenarioLoading || result.matches.length === 0} className="rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] disabled:opacity-50">
                      {scenarioLoading ? "Building scenario…" : "Generate scenario"}
                    </button>
                  </div>
                  {scenarioError && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{scenarioError}</p>}
                </section>
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

        {scenario && (
          <section className="mt-8 space-y-5" aria-live="polite">
            <article className="rounded-2xl border border-[#69e2bd]/25 bg-[#101c2b] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">GENERATED PRACTICE · {scenario.difficulty.toUpperCase()}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{scenario.scenario.title}</h2>
                </div>
                <span className="max-w-sm text-right text-xs leading-5 text-slate-400">{scenario.adaptation_note}</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-200">{scenario.scenario.situation}</p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
                {scenario.scenario.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
              </ul>
              <form onSubmit={(event) => void evaluateScenario(event)} className="mt-6 border-t border-white/10 pt-5">
                <p className="text-base font-semibold">{scenario.scenario.decision_prompt}</p>
                <label className="mt-4 block text-sm font-medium text-slate-200">
                  Your decision and reasoning
                  <textarea required minLength={20} maxLength={4000} rows={6} value={scenarioAnswer} onChange={(event) => setScenarioAnswer(event.target.value)} className={inputClasses} placeholder="Explain your decision, the evidence you would use, the risks, and how you would check whether it worked." />
                </label>
                <button type="submit" disabled={evaluationLoading || scenarioAnswer.trim().length < 20} className="mt-4 rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] disabled:opacity-50">
                  {evaluationLoading ? "Evaluating against expert rubrics…" : "Evaluate my decision"}
                </button>
              </form>
              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="text-sm font-semibold">Scenario sources</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {scenario.citations.map((source) => <li key={`${source.source_type}:${source.source_id}`}>
                    {source.source_url || source.case_id
                      ? <a className="text-[#69e2bd] hover:text-[#b6f7e3]" href={source.citation} target={source.source_url ? "_blank" : undefined} rel={source.source_url ? "noreferrer" : undefined}>{source.title}</a>
                      : <span className="text-slate-300">{source.title} <span className="text-xs text-slate-500">({source.citation})</span></span>}
                    <span className="text-xs text-slate-500"> · {source.source_type.replaceAll("_", " ")}</span>
                  </li>)}
                </ul>
              </div>
            </article>

            {scenarioError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{scenarioError}</p>}
            {scenarioEvaluation && (
              <article className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Expert-rubric evaluation</h2>
                  <p className="text-2xl font-bold text-[#69e2bd]">{scenarioEvaluation.overall_score}%</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([
                    ["Decision quality", scenarioEvaluation.decision_quality],
                    ["Use of evidence", scenarioEvaluation.evidence_use],
                    ["Risk awareness", scenarioEvaluation.risk_awareness],
                    ["Feasibility", scenarioEvaluation.feasibility],
                  ] as const).map(([label, score]) => <p key={label} className="rounded-lg border border-white/10 p-3 text-sm">{label}<strong className="float-right text-[#69e2bd]">{score}%</strong></p>)}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{scenarioEvaluation.feedback}</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div><h3 className="text-sm font-semibold text-[#69e2bd]">What worked</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{scenarioEvaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  <div><h3 className="text-sm font-semibold text-amber-200">Gaps to consider</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{scenarioEvaluation.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300"><strong>Next practice:</strong> {scenarioEvaluation.next_step}</p>
                {modelReviewSignal && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1523] p-4">
                    <p className="text-sm font-semibold">Historical manager-review signal</p>
                    {modelReviewSignal.available && modelReviewSignal.estimated_manager_acceptance !== undefined
                      ? <p className="mt-2 text-sm text-slate-300">Uncalibrated classifier score: {Math.round(modelReviewSignal.estimated_manager_acceptance * 100)}/100, based on manager-reviewed examples. Model version {modelReviewSignal.model_version}.</p>
                      : <p className="mt-2 text-sm text-slate-400">{modelReviewSignal.reason ?? "No company model is available yet."}</p>}
                    <p className="mt-2 text-xs leading-5 text-slate-500">{modelReviewSignal.caution}</p>
                  </div>
                )}
                <p className="mt-4 text-xs leading-5 text-slate-500">This AI-generated practice signal is not a certified competency assessment. It is saved to your account and grounded in the citations above.</p>
                <form onSubmit={(event) => void submitFeedback(event)} className="mt-5 flex flex-wrap items-end gap-3 border-t border-white/10 pt-5">
                  <label className="text-sm">Feedback rating
                    <select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))} className={`${inputClasses} min-w-36`}>
                      {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                    </select>
                  </label>
                  <label className="min-w-64 flex-1 text-sm">Feedback (optional)
                    <input maxLength={2000} value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} className={inputClasses} placeholder="Was the evaluation useful and evidence-based?" />
                  </label>
                  <button type="submit" disabled={feedbackSubmitted || feedbackLoading} className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold hover:border-[#69e2bd] disabled:opacity-50">{feedbackSubmitted ? "Feedback saved" : feedbackLoading ? "Saving feedback…" : "Send feedback"}</button>
                </form>
              </article>
            )}
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">How the engine works</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li><strong>1. Verified corpus.</strong> Experts document how they solved a real problem; a different reviewer scores it on a rubric and approves it. Only approved cases are searched.</li>
            <li><strong>2. Structured knowledge.</strong> Each case stores context, constraints, approaches considered, solution, trade-offs, lessons and scored decision options.</li>
            <li><strong>3. Hybrid retrieval.</strong> PostgreSQL combines full-text and, when configured, vector similarity. Company knowledge is filtered by your memberships and every result is cited.</li>
            <li><strong>4. Scenario and evaluation.</strong> The server generates a fictional scenario from retrieved evidence, adjusts difficulty using your saved results, and evaluates your response against reviewer-approved decision options.</li>
            <li><strong>5. Validated improvement.</strong> Managers can contribute decisions, trusted web sources, and review learner feedback before it becomes company-searchable knowledge. Stored evaluation data supports future dataset curation; this is not model fine-tuning.</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-slate-500">Compress the learning curve, not the truth: this practises expert-style decisions faster, it does not replace years of experience.</p>
        </section>
      </div>
      <WorkspaceFooter />
    </main>
  );
}
