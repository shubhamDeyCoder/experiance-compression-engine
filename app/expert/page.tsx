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

 
  return (
    <PageShell>
      <div className="space-y-8">
        {/* Workspace introduction */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#101c2b] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#69e2bd]/10 blur-[90px]" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#69e2bd]/20 bg-[#69e2bd]/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-[#69e2bd]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#69e2bd]" />
                EXPERT KNOWLEDGE CAPTURE
              </span>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Your experience can become
                <span className="block text-[#69e2bd]">
                  someone else's advantage.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                Capture real workplace challenges, the decisions behind
                successful outcomes, and the lessons that other professionals
                can learn from. Submitted cases go through expert review
                before becoming available to learners.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="relative shrink-0 self-start rounded-xl bg-[#69e2bd] px-5 py-3.5 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] lg:self-auto"
            >
              + Create a new case
            </button>
          </div>
        </section>

        {/* Real workflow counts */}
        <section
          aria-label="Your case statistics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            {
              label: "Total cases",
              value: cases.length,
              note: "All your saved cases",
            },
            {
              label: "Drafts",
              value: cases.filter((item) => item.workflow_status === "draft").length,
              note: "Work in progress",
            },
            {
              label: "Under review",
              value: cases.filter((item) => item.workflow_status === "submitted").length,
              note: "Awaiting a decision",
            },
            {
              label: "Approved",
              value: cases.filter((item) => item.workflow_status === "approved").length,
              note: "Approved for learners",
            },
          ].map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-[#101c2b] p-5"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
            </article>
          ))}
        </section>

        {/* Authoring workspace */}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101c2b]">
            <div className="border-b border-white/[0.08] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.17em] text-[#69e2bd]">
                    CASE AUTHORING
                  </p>
                  <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                    {editingId ? "Refine your case" : "Capture a new experience"}
                  </h2>
                </div>

                <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                  {editingId ? "Editing existing case" : "New draft"}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Explain the context, the decision, the reasoning, and the
                lessons learned. Clear details help reviewers assess the
                case's value for practical learning.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveDraft();
              }}
              className="space-y-8 p-5 sm:p-7"
            >
              {/* Section 1 */}
              <section>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/[0.07] text-sm font-semibold text-[#69e2bd]">
                    01
                  </span>
                  <div>
                    <h3 className="font-semibold">Case overview</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Define what happened and the expertise involved.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="Case title"
                    required
                    value={payload.title}
                    onChange={(value) => setField("title", value)}
                    hint="Use a specific, searchable title."
                  />
                  <TextField
                    label="Domain"
                    required
                    value={payload.domain}
                    onChange={(value) => setField("domain", value)}
                    hint="For example, project management or quality assurance."
                  />
                  <SelectField
                    label="Difficulty"
                    value={payload.difficulty}
                    onChange={(value) => setField("difficulty", value)}
                    options={["Foundational", "Intermediate", "Advanced"]}
                  />
                  <SelectField
                    label="Experience level"
                    value={payload.experience_level ?? ""}
                    onChange={(value) => setField("experience_level", value)}
                    options={[
                      "",
                      "Early career",
                      "Experienced",
                      "Senior",
                      "Subject-matter expert",
                    ]}
                  />
                </div>
              </section>

              <div className="border-t border-white/[0.08]" />

              {/* Section 2 */}
              <section>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/[0.07] text-sm font-semibold text-[#69e2bd]">
                    02
                  </span>
                  <div>
                    <h3 className="font-semibold">The real-world situation</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Give the learner enough context to understand the challenge.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {fields.slice(2, 5).map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      required={field.required}
                      rows={field.rows}
                      value={String(payload[field.key] ?? "")}
                      onChange={(value) => setField(field.key, value)}
                    />
                  ))}
                </div>
              </section>

              <div className="border-t border-white/[0.08]" />

              {/* Section 3 */}
              <section>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/[0.07] text-sm font-semibold text-[#69e2bd]">
                    03
                  </span>
                  <div>
                    <h3 className="font-semibold">The decision-making process</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Capture alternatives and the question the learner must answer.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {fields.slice(5, 7).map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      required={field.required}
                      rows={field.rows}
                      value={String(payload[field.key] ?? "")}
                      onChange={(value) => setField(field.key, value)}
                    />
                  ))}
                </div>
              </section>

              <div className="border-t border-white/[0.08]" />

              {/* Section 4 */}
              <section>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#69e2bd]/20 bg-[#69e2bd]/[0.07] text-sm font-semibold text-[#69e2bd]">
                    04
                  </span>
                  <div>
                    <h3 className="font-semibold">Expert reasoning and lessons</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Explain the solution, trade-offs, and transferable insights.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {fields.slice(7).map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      required={field.required}
                      rows={field.rows}
                      value={String(payload[field.key] ?? "")}
                      onChange={(value) => setField(field.key, value)}
                    />
                  ))}
                </div>
              </section>

              <div className="rounded-xl border border-[#69e2bd]/15 bg-[#69e2bd]/[0.04] p-4">
                <p className="text-sm font-semibold text-slate-200">
                  What happens after submission?
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  Your case enters the reviewer queue. Reviewers can approve it
                  or request revisions with feedback. Saving a draft does not
                  publish the case to learners.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                >
                  {error}
                </p>
              )}

              {message && (
                <p
                  role="status"
                  className="rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/10 p-4 text-sm leading-6 text-[#b6f7e3]"
                >
                  {message}
                </p>
              )}

              <div className="flex flex-wrap gap-3 border-t border-white/[0.08] pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-[#69e2bd]/50 hover:text-[#69e2bd] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Save as draft"}
                </button>

                <button
                  type="button"
                  onClick={() => void submitForReview()}
                  disabled={saving}
                  className="rounded-xl bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Processing..." : "Submit for review →"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:text-white disabled:opacity-50"
                  >
                    Cancel editing
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Case library */}
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-[#69e2bd]">
                    KNOWLEDGE LIBRARY
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">Your cases</h2>
                </div>
                <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                  {cases.length}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Track your drafts, review decisions, and approved cases.
              </p>

              <div className="mt-5 space-y-3">
                {cases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
                    <span className="text-2xl text-slate-500">◈</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      Your library is empty
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Create your first case to start capturing industry knowledge.
                    </p>
                  </div>
                ) : (
                  cases.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-white/[0.08] bg-[#08111f]/50 p-4 transition hover:border-white/15"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 text-sm font-semibold leading-6 text-slate-200">
                          {item.title}
                        </h3>
                        <CaseStatusBadge status={item.workflow_status} />
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {item.domain}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                        <span className="text-[10px] text-slate-500">
                          Revision {item.revision_number}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(
                            item.reviewed_at ??
                              item.submitted_at ??
                              item.created_at,
                          )}
                        </span>
                      </div>

                      {item.review_feedback && (
                        <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3">
                          <p className="text-[10px] font-semibold tracking-wide text-amber-200">
                            REVIEWER FEEDBACK
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">
                            {item.review_feedback}
                          </p>
                        </div>
                      )}

                      {["draft", "rejected"].includes(item.workflow_status) && (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="mt-4 text-xs font-semibold text-[#69e2bd] transition hover:text-[#b6f7e3]"
                        >
                          Edit case →
                        </button>
                      )}

                      {item.workflow_status === "submitted" && (
                        <p className="mt-4 text-xs text-slate-500">
                          Awaiting reviewer assessment
                        </p>
                      )}

                      {item.workflow_status === "approved" && (
                        <p className="mt-4 text-xs text-[#69e2bd]">
                          Approved for learner access
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#69e2bd]/15 bg-[#69e2bd]/[0.04] p-5">
              <p className="text-sm font-semibold text-slate-200">
                The expert advantage
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-400">
                The most useful case does more than describe the final answer.
                It explains the constraints, alternatives, judgment, and
                lessons that made the outcome possible.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </PageShell>);

}


function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#08111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#69e2bd] text-xl font-black text-[#08111f]">
              E
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide">
                Experience<span className="text-[#69e2bd]">Engine</span>
              </span>
              <span className="mt-1 block text-[10px] tracking-[0.15em] text-slate-500">
                EXPERT WORKSPACE
              </span>
            </span>
          </Link>

          <nav
            aria-label="Workspace navigation"
            className="flex flex-wrap items-center gap-2 sm:gap-4"
          >
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white sm:text-sm"
            >
              Learner workspace
            </Link>
            <Link
              href="/review"
              className="rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white sm:text-sm"
            >
              Review queue
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {children}
      </div>
    </main>
  );
}

function TextField({ label, hint, value, onChange, required, rows }: { label: string; hint: string; value: string; onChange: (value: string) => void; required?: boolean; rows?: number }) { const classes = "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#69e2bd]"; return <label className="block text-sm font-medium text-slate-200"><span>{label}{required && <span className="text-[#69e2bd]"> *</span>}</span>{rows ? <textarea rows={rows} required={required} value={value} onChange={(event) => onChange(event.target.value)} className={classes} /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className={classes} />}<span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="block text-sm font-medium text-slate-200">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none focus:border-[#69e2bd]">{options.map((option) => <option key={option} value={option}>{option || "Choose an experience level"}</option>)}</select></label>; }
function AccessError({ error }: { error: string }) { return <><h1 className="text-2xl font-semibold">Expert access required</h1><p className="mt-3 max-w-xl leading-7 text-slate-400">{error}</p><Link href="/dashboard" className="mt-6 inline-block rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f]">Go to learner workspace</Link></>; }
