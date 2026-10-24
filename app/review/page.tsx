"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpertCase, formatDate } from "@/lib/cases";
import { CaseStatusBadge } from "@/components/CaseStatusBadge";
import { supabase } from "@/lib/supabase";

export default function ReviewPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ExpertCase[]>([]);
  const [selected, setSelected] = useState<ExpertCase | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({ clarity: 0, accuracy: 0, practical_value: 0, learning_value: 0 });

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    const { data: canReview, error: roleError } = await supabase.rpc("has_case_role", { p_role: "reviewer" });
    if (roleError || !canReview) { setError("This account is not provisioned as a reviewer. Ask an administrator to assign the reviewer role."); setLoading(false); return; }
    const { data, error: casesError } = await supabase.from("expert_cases")
      .select("id, title, domain, difficulty, situation, question, options, case_context, initial_conditions, attempted_approaches, final_solution, reasoning_tradeoffs, lessons_learned, experience_level, workflow_status, review_feedback, submitted_at, reviewed_at, revision_number, created_at")
      .eq("workflow_status", "submitted")
      .order("submitted_at", { ascending: true });
    if (casesError) setError(casesError.message);
    else { const queue = (data ?? []) as ExpertCase[]; setCases(queue); setSelected((current) => queue.find((item) => item.id === current?.id) ?? queue[0] ?? null); }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function decide(decision: "approved" | "rejected") {
    if (!selected || saving) return;
    if (decision === "rejected" && !feedback.trim()) { setError("Explain what the expert should revise before rejecting a case."); return; }
    if (Object.values(scores).some((value) => value < 1)) { setError("Score all four rubric criteria from 1 to 5 before deciding."); return; }
    setSaving(true); setError(""); setMessage("");
    const { error: rpcError } = await supabase.rpc("review_case_scored", { p_case_id: selected.id, p_decision: decision, p_feedback: feedback, p_scores: scores });
    if (rpcError) setError(rpcError.message);
    else { setMessage(`Case ${decision}. The author can now see this decision.`); setFeedback(""); setScores({ clarity: 0, accuracy: 0, practical_value: 0, learning_value: 0 }); await load(); }
    setSaving(false);
  }

  if (loading) return <Shell><p className="text-slate-300">Loading the review queue…</p></Shell>;
  if (error && !selected && cases.length === 0) return <Shell><h1 className="text-2xl font-semibold">Reviewer access required</h1><p className="mt-3 max-w-xl leading-7 text-slate-400">{error}</p><Link href="/dashboard" className="mt-6 inline-block rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f]">Go to learner workspace</Link></Shell>;

  return <Shell>
    <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">EXPERT CASE REVIEW</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Review submitted knowledge.</h1>
    <p className="mt-3 max-w-3xl leading-7 text-slate-400">Assess clarity, practical judgment, and learning value. Only approved cases become available to learners.</p>
    {message && <p role="status" className="mt-6 rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/10 p-4 text-sm text-[#b6f7e3]">{message}</p>}
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {cases.length === 0 ? <div className="mt-8 rounded-2xl border border-white/10 bg-[#101c2b] p-7"><h2 className="text-lg font-semibold">Queue is clear</h2><p className="mt-2 text-sm leading-6 text-slate-400">There are no submitted cases waiting for review.</p></div> : <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"><aside className="space-y-3">{cases.map((item) => <button key={item.id} onClick={() => { setSelected(item); setFeedback(""); setError(""); }} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === item.id ? "border-[#69e2bd]/60 bg-[#69e2bd]/10" : "border-white/10 bg-[#101c2b] hover:border-white/25"}`}><div className="flex items-start justify-between gap-2"><span className="font-semibold">{item.title}</span><CaseStatusBadge status={item.workflow_status} /></div><p className="mt-2 text-xs text-slate-400">{item.domain} · submitted {formatDate(item.submitted_at)}</p></button>)}</aside>{selected && <CaseReview caseItem={selected} feedback={feedback} setFeedback={setFeedback} scores={scores} setScores={setScores} saving={saving} decide={decide} />}</div>}
  </Shell>;
}

function CaseReview({ caseItem, feedback, setFeedback, scores, setScores, saving, decide }: { caseItem: ExpertCase; feedback: string; setFeedback: (value: string) => void; scores: Record<string, number>; setScores: (value: Record<string, number>) => void; saving: boolean; decide: (decision: "approved" | "rejected") => Promise<void> }) {
  const sections = [
    ["Context", caseItem.case_context], ["Initial conditions", caseItem.initial_conditions], ["Situation", caseItem.situation], ["Approaches considered", caseItem.attempted_approaches], ["Learner prompt", caseItem.question], ["Final solution", caseItem.final_solution], ["Reasoning and trade-offs", caseItem.reasoning_tradeoffs], ["Lessons learned", caseItem.lessons_learned],
  ].filter(([, value]) => value.trim());
  return <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-[#69e2bd]/25 bg-[#69e2bd]/10 px-3 py-1 text-xs text-[#69e2bd]">{caseItem.domain}</span><span className="text-sm text-slate-400">{caseItem.difficulty}</span>{caseItem.experience_level && <span className="text-sm text-slate-400">{caseItem.experience_level}</span>}</div><h2 className="mt-4 text-2xl font-semibold">{caseItem.title}</h2></div><p className="text-xs text-slate-500">Revision {caseItem.revision_number}</p></div><div className="mt-6 space-y-6">{sections.map(([heading, value]) => <article key={heading}><h3 className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">{heading.toUpperCase()}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{value}</p></article>)}{Array.isArray(caseItem.options) && caseItem.options.length > 0 && <article><h3 className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">SCORED DECISION OPTIONS</h3><ul className="mt-2 space-y-3">{caseItem.options.map((option, index) => <li key={index} className="rounded-lg border border-white/10 p-3 text-sm leading-6 text-slate-300"><p><strong>{String.fromCharCode(65 + index)}. {option.text}</strong> <span className="text-[#69e2bd]">({option.score}/100)</span></p><p className="mt-1 text-slate-400">{option.feedback}</p></li>)}</ul></article>}</div><fieldset className="mt-8 border-t border-white/10 pt-6"><legend className="text-sm font-semibold">Quality rubric <span className="font-normal text-slate-500">(1 = poor, 5 = excellent; approval needs 3 or more on each)</span></legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([["clarity", "Clarity"], ["accuracy", "Technical accuracy"], ["practical_value", "Practical value"], ["learning_value", "Learning value"]] as const).map(([key, label]) => <label key={key} className="block text-sm text-slate-200">{label}<select value={scores[key]} onChange={(event) => setScores({ ...scores, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1523] px-3 py-2 text-sm text-white outline-none focus:border-[#69e2bd]"><option value={0}>Choose a score</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>)}</div></fieldset><div className="mt-6 border-t border-white/10 pt-6"><label className="block text-sm font-semibold">Reviewer feedback <span className="font-normal text-slate-500">(required when rejecting)</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={5000} rows={5} placeholder="Explain what is strong, what is missing, or how to improve this case." className="mt-3 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[#69e2bd]" /></label><div className="mt-4 flex flex-wrap gap-3"><button disabled={saving} onClick={() => void decide("approved")} className="rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] hover:bg-[#91f3d4] disabled:opacity-50">{saving ? "Saving…" : "Approve for learners"}</button><button disabled={saving} onClick={() => void decide("rejected")} className="rounded-full border border-red-400/40 px-5 py-3 text-sm font-semibold text-red-100 hover:border-red-300 disabled:opacity-50">Request revision</button></div></div></section>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#08111f] text-white"><header className="border-b border-white/10 bg-[#0b1523]"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><Link href="/" className="font-bold tracking-wide">EXPERIENCE <span className="text-[#69e2bd]">ENGINE</span></Link><nav className="flex gap-3 text-sm"><Link className="text-slate-300 hover:text-[#69e2bd]" href="/expert">Capture a case</Link><Link className="text-slate-300 hover:text-[#69e2bd]" href="/dashboard">Learner workspace</Link></nav></div></header><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">{children}</div></main>; }
