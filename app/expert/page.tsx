"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaseStatusBadge } from "@/components/CaseStatusBadge";
import { emptyCasePayload, ExpertCase, CasePayload, formatDate } from "@/lib/cases";
import { supabase } from "@/lib/supabase";

const fields: Array<{ key: keyof CasePayload; label: string; hint: string; required?: boolean; rows?: number }> = [
  { key: "title", label: "Case title", hint: "A concise, searchable name.", required: true },
  { key: "domain", label: "Domain", hint: "For example: project management or quality assurance.", required: true },
  { key: "case_context", label: "Case context", hint: "What environment, team, customer, or operational setting mattered?", rows: 4 },
  { key: "initial_conditions", label: "Initial conditions", hint: "What did you know at the outset? Include constraints and signals.", rows: 4 },
  { key: "situation", label: "The situation", hint: "Describe the challenge in enough detail for a learner to understand it.", required: true, rows: 5 },
  { key: "attempted_approaches", label: "Approaches considered", hint: "What did you try or rule out, and why?", rows: 4 },
  { key: "question", label: "Learner decision prompt", hint: "Ask the learner what they should do, decide, or prioritize.", required: true, rows: 3 },
  { key: "final_solution", label: "Final solution", hint: "Explain what you decided and what happened. Required before submission.", rows: 5 },
  { key: "reasoning_tradeoffs", label: "Reasoning and trade-offs", hint: "Make your judgment visible: risks, alternatives, and compromises.", rows: 4 },
  { key: "lessons_learned", label: "Lessons learned", hint: "What should another practitioner carry forward? Required before submission.", rows: 4 },
];

export default function ExpertCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ExpertCase[]>([]);
  const [payload, setPayload] = useState<CasePayload>(emptyCasePayload);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    const { data: canCapture, error: roleError } = await supabase.rpc("has_case_role", { p_role: "expert" });
    if (roleError || !canCapture) { setError("This account is not provisioned as an expert. Ask an administrator to assign the expert role."); setLoading(false); return; }
    const { data, error: casesError } = await supabase.from("expert_cases")
      .select("id, title, domain, difficulty, situation, question, options, case_context, initial_conditions, attempted_approaches, final_solution, reasoning_tradeoffs, lessons_learned, experience_level, workflow_status, review_feedback, submitted_at, reviewed_at, revision_number, created_at")
      .order("created_at", { ascending: false });
    if (casesError) setError(casesError.message);
    else setCases((data ?? []) as ExpertCase[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setField(key: keyof CasePayload, value: string) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  function startEdit(item: ExpertCase) {
    if (item.workflow_status === "submitted" || item.workflow_status === "approved") return;
    setEditingId(item.id);
    setPayload({ title: item.title, domain: item.domain, difficulty: item.difficulty, situation: item.situation, question: item.question, options: item.options, case_context: item.case_context, initial_conditions: item.initial_conditions, attempted_approaches: item.attempted_approaches, final_solution: item.final_solution, reasoning_tradeoffs: item.reasoning_tradeoffs, lessons_learned: item.lessons_learned, experience_level: item.experience_level });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() { setEditingId(null); setPayload(emptyCasePayload); setMessage(""); setError(""); }

  async function saveDraft() {
    setSaving(true); setMessage(""); setError("");
    const { data, error: rpcError } = editingId
      ? await supabase.rpc("update_case_draft", { p_case_id: editingId, p_payload: payload })
      : await supabase.rpc("create_case_draft", { p_payload: payload });
    if (rpcError) setError(rpcError.message);
    else { setMessage(editingId ? "Draft updated." : "Draft saved. Add the solution and lessons when you are ready to submit it."); setEditingId(editingId ?? (data as string)); await load(); }
    setSaving(false);
  }

  async function submitForReview() {
    if (!editingId) { setError("Save the case as a draft first, then submit it for review."); return; }
    setSaving(true); setMessage(""); setError("");
    const { error: rpcError } = await supabase.rpc("update_case_draft", { p_case_id: editingId, p_payload: payload });
    if (rpcError) setError(rpcError.message);
    else {
      const { error: submitError } = await supabase.rpc("submit_case", { p_case_id: editingId });
      if (submitError) setError(submitError.message);
      else { setMessage("Case submitted for review. It is now read-only while a reviewer assesses it."); resetForm(); await load(); }
    }
    setSaving(false);
  }

  if (loading) return <PageShell><p className="text-slate-300">Loading your case workspace…</p></PageShell>;
  if (error && cases.length === 0) return <PageShell><AccessError error={error} /></PageShell>;

  return <PageShell>
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">EXPERT CASE CAPTURE</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Turn experience into a teachable case.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-400">Capture the decision context, not only the final answer. Drafts remain private; submitted cases enter reviewer assessment before learners can see them.</p>
        <form onSubmit={(event) => { event.preventDefault(); void saveDraft(); }} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2"><TextField label="Case title" required value={payload.title} onChange={(value) => setField("title", value)} hint="A concise, searchable name." /><TextField label="Domain" required value={payload.domain} onChange={(value) => setField("domain", value)} hint="For example: project management or quality assurance." />
            <SelectField label="Difficulty" value={payload.difficulty} onChange={(value) => setField("difficulty", value)} options={["Foundational", "Intermediate", "Advanced"]} /><SelectField label="Your experience level" value={payload.experience_level ?? ""} onChange={(value) => setField("experience_level", value)} options={["", "Early career", "Experienced", "Senior", "Subject-matter expert"]} /></div>
          {fields.slice(2).map((field) => <TextField key={field.key} label={field.label} hint={field.hint} required={field.required} rows={field.rows} value={String(payload[field.key] ?? "")} onChange={(value) => setField(field.key, value)} />)}
          <p className="rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/5 p-4 text-sm leading-6 text-slate-300">Learner answer choices are intentionally not captured here. This milestone preserves expert judgment and review; a later scenario-design step can turn an approved case into scored practice options.</p>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/10 p-4 text-sm text-[#b6f7e3]">{message}</p>}
          <div className="flex flex-wrap gap-3"><button disabled={saving} className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold hover:border-[#69e2bd] disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Save draft"}</button><button type="button" onClick={() => void submitForReview()} disabled={saving} className="rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] hover:bg-[#91f3d4] disabled:opacity-50">Submit for review →</button>{editingId && <button type="button" onClick={resetForm} className="px-4 text-sm text-slate-400 hover:text-white">Start a new case</button>}</div>
        </form>
      </section>
      <aside className="xl:pt-24"><h2 className="text-lg font-semibold">Your cases</h2><p className="mt-2 text-sm leading-6 text-slate-400">A reviewer’s rejection includes feedback and can be revised into a new submission.</p><div className="mt-5 space-y-3">{cases.length === 0 ? <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">No cases saved yet.</p> : cases.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-[#101c2b] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{item.domain} · revision {item.revision_number}</p></div><CaseStatusBadge status={item.workflow_status} /></div>{item.review_feedback && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm leading-6 text-red-100">Reviewer: {item.review_feedback}</p>}<p className="mt-3 text-xs text-slate-500">Updated {formatDate(item.reviewed_at ?? item.submitted_at ?? item.created_at)}</p>{["draft", "rejected"].includes(item.workflow_status) && <button onClick={() => startEdit(item)} className="mt-4 text-sm font-semibold text-[#69e2bd] hover:text-[#b6f7e3]">Edit case →</button>}</article>)}</div></aside>
    </div>
  </PageShell>;
}

function PageShell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#08111f] text-white"><header className="border-b border-white/10 bg-[#0b1523]"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><Link href="/" className="font-bold tracking-wide">EXPERIENCE <span className="text-[#69e2bd]">ENGINE</span></Link><nav className="flex gap-3 text-sm"><Link className="text-slate-300 hover:text-[#69e2bd]" href="/dashboard">Learner workspace</Link><Link className="text-slate-300 hover:text-[#69e2bd]" href="/review">Review queue</Link></nav></div></header><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">{children}</div></main>; }
function TextField({ label, hint, value, onChange, required, rows }: { label: string; hint: string; value: string; onChange: (value: string) => void; required?: boolean; rows?: number }) { const classes = "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#69e2bd]"; return <label className="block text-sm font-medium text-slate-200"><span>{label}{required && <span className="text-[#69e2bd]"> *</span>}</span>{rows ? <textarea rows={rows} required={required} value={value} onChange={(event) => onChange(event.target.value)} className={classes} /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className={classes} />}<span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="block text-sm font-medium text-slate-200">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none focus:border-[#69e2bd]">{options.map((option) => <option key={option} value={option}>{option || "Choose an experience level"}</option>)}</select></label>; }
function AccessError({ error }: { error: string }) { return <><h1 className="text-2xl font-semibold">Expert access required</h1><p className="mt-3 max-w-xl leading-7 text-slate-400">{error}</p><Link href="/dashboard" className="mt-6 inline-block rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f]">Go to learner workspace</Link></>; }
