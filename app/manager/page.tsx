"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import WorkspaceFooter from "@/components/WorkspaceFooter";
import { supabase } from "@/lib/supabase";

type Company = { id: string; name: string; industry: string; created_at: string };
type Member = { user_id: string; role: string; created_at: string; email: string | null; full_name: string };
type Invitation = { id: string; email: string; role: string; created_at: string; expires_at: string; accepted_at: string | null; expired: boolean };
type Overview = { company: Company; members: Member[]; invitations: Invitation[] };
type EngineFeedback = { id: string; scenario_id: string; category: string; rating: number; comment: string; created_at: string };
type EvaluationExample = {
  id: string;
  scenario_id: string;
  scenario: { title?: string; situation?: string; decision_prompt?: string };
  citations: { title: string; citation: string; source_url: string | null; case_id: string | null }[];
  source_case_ids: string[];
  learner_answer: string;
  model_evaluation: Record<string, unknown>;
  created_at: string;
};
type EngineApiResponse = {
  error?: string;
  indexed?: number;
  dataset?: unknown;
  status?: string;
  available?: boolean;
  reason?: string;
  version?: string;
  created_at?: string;
  models?: Record<string, { status?: string; examples?: number; holdout?: { macro_f1?: number }; reason?: string }>;
  training_sources?: Record<string, number>;
};
type CompanyModelStatus = EngineApiResponse;
type ModelTrainingResult = EngineApiResponse;

function makeToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function roleName(role: string) {
  return role === "beginner" ? "Beginner" : role === "expert" ? "Expert" : role === "reviewer" ? "Reviewer" : "Manager";
}

export default function ManagerPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("beginner");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [knowledgeKind, setKnowledgeKind] = useState<"manager_decision" | "trusted_web">("manager_decision");
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineFeedback, setEngineFeedback] = useState<EngineFeedback[]>([]);
  const [evaluationExamples, setEvaluationExamples] = useState<EvaluationExample[]>([]);
  const [modelStatus, setModelStatus] = useState<CompanyModelStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState("");
  const [trainingResult, setTrainingResult] = useState<ModelTrainingResult | null>(null);

  const engineRequest = useCallback(async (body: Record<string, unknown>): Promise<EngineApiResponse> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      throw new Error("Your session has expired. Please sign in again.");
    }
    const response = await fetch("/api/engine", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(body),
    });
    const result = await response.json() as EngineApiResponse;
    if (!response.ok) throw new Error(result.error ?? "The engine request failed.");
    return result;
  }, [router]);

  const loadOverview = useCallback(async () => {
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data, error: overviewError } = await supabase.rpc("manager_workspace_overview");
    if (overviewError) {
      if (/manager permission|required/i.test(overviewError.message)) {
        router.replace("/company/register");
        return;
      }
      setError(overviewError.message);
    } else if (data) {
      setOverview(data as Overview);
      const [feedbackResult, evaluationResult] = await Promise.all([
        supabase.rpc("list_engine_feedback_for_review"),
        supabase.rpc("list_engine_evaluation_examples_for_review"),
      ]);
      if (feedbackResult.error) setError(feedbackResult.error.message);
      else setEngineFeedback((feedbackResult.data ?? []) as EngineFeedback[]);
      if (evaluationResult.error) setError(evaluationResult.error.message);
      else setEvaluationExamples((evaluationResult.data ?? []) as EvaluationExample[]);
      try {
        const status = await engineRequest({ action: "model_status" });
        setModelStatus(status);
        setModelStatusError("");
      } catch (caught) {
        setModelStatus(null);
        setModelStatusError(caught instanceof Error ? caught.message : "The Python AI service status could not be loaded.");
      }
    }
    setLoading(false);
  }, [engineRequest, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOverview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setInviteLink("");
    try {
      const token = makeToken();
      const { error: inviteError } = await supabase.rpc("create_company_invitation", {
        p_email: email.trim().toLowerCase(),
        p_role: role,
        p_token: token,
      });
      if (inviteError) throw inviteError;
      const link = `${window.location.origin}/register?invite=${encodeURIComponent(token)}`;
      setInviteLink(link);
      setNotice(`Invitation created for ${email.trim().toLowerCase()}. Copy the secure link and send it to that person. The link expires in 7 days.`);
      setEmail("");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice("Invitation link copied. Send it only to the invited work email address.");
    } catch {
      setNotice("Copy is unavailable in this browser. Select and copy the invitation link below.");
    }
  }

  async function trainModels() {
    setEngineBusy(true); setError(""); setNotice(""); setTrainingResult(null);
    try {
      const result = await engineRequest({ action: "train_model" });
      setTrainingResult(result);
      const trained = result.status === "trained";
      setNotice(trained
        ? `Company model training finished and passed promotion checks${result.version ? ` (version ${result.version})` : ""}.`
        : `Training status: ${result.status ?? "unknown"}.${result.reason ? ` ${result.reason}` : ""}`);
      const status = await engineRequest({ action: "model_status" });
      setModelStatus(status);
      setModelStatusError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Company models could not be trained.");
    } finally {
      setEngineBusy(false);
    }
  }

  async function addKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEngineBusy(true); setError(""); setNotice("");
    try {
      const result = knowledgeKind === "trusted_web"
        ? await engineRequest({ action: "ingest_source", source_url: sourceUrl, title: knowledgeTitle || undefined })
        : await engineRequest({ action: "contribute", kind: knowledgeKind, title: knowledgeTitle, content: knowledgeContent });
      setNotice(`Knowledge saved${result.indexed === undefined ? "." : `; indexed ${result.indexed} approved cases.`}`);
      setKnowledgeTitle(""); setKnowledgeContent(""); setSourceUrl("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save company knowledge.");
    } finally {
      setEngineBusy(false);
    }
  }

  async function indexCorpus() {
    setEngineBusy(true); setError(""); setNotice("");
    try {
      const result = await engineRequest({ action: "index_corpus" });
      setNotice(`Indexed ${result.indexed ?? 0} approved cases. Run again to process another batch if needed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not index approved cases.");
    } finally {
      setEngineBusy(false);
    }
  }

  async function downloadEvaluationDataset() {
    setEngineBusy(true); setError(""); setNotice("");
    try {
      const result = await engineRequest({ action: "export_dataset" });
      const blob = new Blob([JSON.stringify(result.dataset ?? {}, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "experience-compression-evaluation-dataset.json";
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setNotice("Downloaded the company-scoped dataset containing only manager-validated feedback and evaluation examples.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export the validated dataset.");
    } finally {
      setEngineBusy(false);
    }
  }

  async function reviewFeedback(feedbackId: string, decision: "validated" | "rejected") {
    setEngineBusy(true); setError(""); setNotice("");
    try {
      await engineRequest({ action: "review_feedback", feedback_id: feedbackId, decision });
      setNotice(decision === "validated" ? "Feedback validated and added to company knowledge." : "Feedback rejected; it will not be used as knowledge.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not review feedback.");
    } finally {
      setEngineBusy(false);
    }
  }

  async function reviewEvaluation(exampleId: string, decision: "validated" | "rejected") {
    setEngineBusy(true); setError(""); setNotice("");
    try {
      await engineRequest({ action: "review_evaluation", example_id: exampleId, decision });
      setNotice(decision === "validated" ? "Evaluation example validated for the company evaluation dataset." : "Evaluation example rejected from the curated dataset.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not review the evaluation example.");
    } finally {
      setEngineBusy(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#08111f] p-8 text-slate-300">Loading your company workspace…</main>;

  return (
    <main className="flex min-h-screen flex-col bg-[#08111f] text-white">
      <WorkspaceHeader />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#69e2bd]">Manager workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{overview?.company?.name ?? "Company workspace"}</h1>
            <p className="mt-2 text-sm text-slate-400">{overview?.company?.industry ?? "Manage people, expert knowledge, and learning access."}</p>
          </div>
          <Link href="/" className="w-fit rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">View public home ↗</Link>
        </div>

        {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">{notice}</p>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Workspace members" value={overview?.members?.length ?? 0} detail="People with company access" />
          <Metric label="Experts" value={overview?.members?.filter((member) => member.role === "expert").length ?? 0} detail="Capture real-world decisions" />
          <Metric label="Reviewers" value={overview?.members?.filter((member) => member.role === "reviewer").length ?? 0} detail="Validate cases before release" />
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#69e2bd]">Company learning engine</p>
              <h2 className="mt-2 text-xl font-semibold">Add trusted experience and improve the evidence base</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Manager decisions and validated feedback are private to this company. Web pages can be ingested only from domains explicitly allow-listed by your Supabase administrator. Configure OPENAI_API_KEY to create searchable embeddings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void indexCorpus()} disabled={engineBusy} className="rounded-xl border border-[#69e2bd]/30 px-4 py-2.5 text-sm font-semibold text-[#91f3d4] disabled:opacity-50">{engineBusy ? "Working…" : "Index approved cases"}</button>
              <button type="button" onClick={() => void downloadEvaluationDataset()} disabled={engineBusy} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50">Export validated dataset</button>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0b1523] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Company-specific supervised models</h3>
                {modelStatus?.available
                  ? <p className="mt-1 text-xs leading-5 text-slate-400">Active version {modelStatus.version} · trained {modelStatus.created_at ? new Date(modelStatus.created_at).toLocaleString() : "date unavailable"}</p>
                  : <p className="mt-1 text-xs leading-5 text-slate-400">{modelStatusError || modelStatus?.reason || "No promoted model is available yet."}</p>}
              </div>
              <button type="button" onClick={() => void trainModels()} disabled={engineBusy} className="rounded-xl border border-[#69e2bd]/30 px-4 py-2.5 text-sm font-semibold text-[#91f3d4] disabled:opacity-50">{engineBusy ? "Training…" : "Train / refresh models"}</button>
            </div>
            {modelStatus?.available && modelStatus.models && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(modelStatus.models).map(([name, details]) => (
                  <p key={name} className="rounded-lg border border-white/[0.06] p-3 text-xs leading-5 text-slate-400">
                    <span className="font-semibold text-slate-200">{name.replaceAll("_", " ")}</span>
                    {` · ${details.examples ?? 0} reviewed examples · holdout macro F1 ${details.holdout?.macro_f1?.toFixed(3) ?? "not measured"}`}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">Training uses only authorized company data, including reviewed evaluation examples and expert-scored attempts. RAG and learner personalization are not training. Candidates without sufficient group-separated data or acceptable holdout quality are not promoted.</p>
            {trainingResult?.models && Object.entries(trainingResult.models).some(([, model]) => model.reason) && (
              <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200/80">
                {Object.entries(trainingResult.models).filter(([, model]) => model.reason).map(([name, model]) => <li key={name}>{name.replaceAll("_", " ")}: {model.reason}</li>)}
              </ul>
            )}
          </div>
          <form onSubmit={(event) => void addKnowledge(event)} className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium">Knowledge source
              <select value={knowledgeKind} onChange={(event) => setKnowledgeKind(event.target.value as "manager_decision" | "trusted_web")} className="ece-auth-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none">
                <option value="manager_decision">Manager decision / operating practice</option>
                <option value="trusted_web">Trusted web source</option>
              </select>
            </label>
            <label className="text-sm font-medium">Title
              <input required minLength={3} maxLength={200} value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} className="ece-auth-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none" placeholder="Decision or source title" />
            </label>
            {knowledgeKind === "trusted_web" ? (
              <label className="text-sm font-medium lg:col-span-2">HTTPS source URL
                <input required type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="ece-auth-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none" placeholder="https://trusted.example.org/guidance" />
                <span className="mt-2 block text-xs font-normal text-slate-500">Only allow-listed domains are fetched. Redirects and pages over 1 MB are rejected.</span>
              </label>
            ) : (
              <label className="text-sm font-medium lg:col-span-2">Decision context, rationale, and outcome
                <textarea required minLength={30} maxLength={12000} rows={5} value={knowledgeContent} onChange={(event) => setKnowledgeContent(event.target.value)} className="ece-auth-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none" placeholder="Record the situation, decision, alternatives, constraints, outcome, and lessons that another team can reuse." />
              </label>
            )}
            <button type="submit" disabled={engineBusy} className="w-fit rounded-xl bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] disabled:opacity-50">{engineBusy ? "Saving and indexing…" : "Save company knowledge"}</button>
          </form>
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Learner feedback awaiting review</h3>
              <button type="button" onClick={() => void loadOverview()} className="text-xs font-semibold text-[#91f3d4] hover:text-white">Refresh</button>
            </div>
            {engineFeedback.length === 0 ? <p className="mt-3 text-sm text-slate-500">No feedback is waiting for validation.</p> : (
              <ul className="mt-4 space-y-3">
                {engineFeedback.map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/[0.07] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.category} feedback · {item.rating}/5</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.comment || "No written comment."}</p>
                    <p className="mt-2 text-xs text-slate-500">Scenario {item.scenario_id} · {new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void reviewFeedback(item.id, "validated")} disabled={engineBusy || item.comment.length < 30} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50">Validate as knowledge</button>
                    <button type="button" onClick={() => void reviewFeedback(item.id, "rejected")} disabled={engineBusy} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50">Reject</button>
                  </div>
                </li>)}
              </ul>
            )}
          </div>
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Evaluation dataset candidates</h3>
              <span className="text-xs text-slate-500">Manager validation required</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Validated rows are retained as company evaluation examples for quality benchmarking and future curation. This does not fine-tune the model.</p>
            {evaluationExamples.length === 0 ? <p className="mt-3 text-sm text-slate-500">No generated evaluations are waiting for validation.</p> : (
              <ul className="mt-4 space-y-3">
                {evaluationExamples.map((item) => <li key={item.id} className="rounded-xl border border-white/[0.07] p-4">
                  <p className="text-xs text-slate-500">Scenario {item.scenario_id} · {item.source_case_ids.length} approved source case(s) · {new Date(item.created_at).toLocaleString()}</p>
                  <p className="mt-3 text-sm font-semibold">{item.scenario.title ?? "Generated scenario"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">{item.scenario.situation ?? ""}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.scenario.decision_prompt ?? ""}</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {item.citations.map((source) => <li key={`${source.title}:${source.citation}`}>
                      {source.case_id || source.source_url
                        ? <a className="text-[#91f3d4]" href={source.citation} target={source.source_url ? "_blank" : undefined} rel={source.source_url ? "noreferrer" : undefined}>{source.title}</a>
                        : <span className="text-slate-300">{source.title}</span>}
                      <span className="ml-2 text-slate-500">citation</span>
                    </li>)}
                  </ul>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Learner response</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.learner_answer}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Model assessment</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{typeof item.model_evaluation.feedback === "string" ? item.model_evaluation.feedback : "No assessment summary was returned."}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void reviewEvaluation(item.id, "validated")} disabled={engineBusy} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50">Validate for dataset</button>
                    <button type="button" onClick={() => void reviewEvaluation(item.id, "rejected")} disabled={engineBusy} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50">Reject</button>
                  </div>
                </li>)}
              </ul>
            )}
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#69e2bd]">Access management</p>
            <h2 className="mt-2 text-xl font-semibold">Invite a teammate</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Each invitation is tied to one email and role. Expert and Reviewer permissions can be granted through separate invitations to the same person.</p>
            <form onSubmit={createInvitation} className="mt-6 space-y-4">
              <div>
                <label htmlFor="inviteEmail" className="mb-2 block text-sm font-medium">Work email</label>
                <input id="inviteEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@company.com" className="ece-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none" />
              </div>
              <div>
                <label htmlFor="inviteRole" className="mb-2 block text-sm font-medium">Workspace role</label>
                <select id="inviteRole" value={role} onChange={(event) => setRole(event.target.value)} className="ece-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none">
                  <option value="beginner">Beginner — practise and learn</option>
                  <option value="expert">Expert — contribute industry cases</option>
                  <option value="reviewer">Reviewer — validate submitted cases</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#69e2bd] px-4 py-3 text-sm font-bold text-[#08111f] transition hover:bg-[#91f3d4] disabled:cursor-wait disabled:opacity-50">{busy ? "Creating invitation…" : "Create secure invitation"}</button>
            </form>
            {inviteLink && <div className="mt-5 rounded-xl border border-white/10 bg-[#07111f] p-4">
              <p className="text-sm font-semibold">Invitation link</p>
              <p className="mt-2 break-all text-xs leading-5 text-slate-400">{inviteLink}</p>
              <button type="button" onClick={() => void copyInvite()} className="mt-3 rounded-lg border border-[#69e2bd]/30 px-3 py-2 text-sm font-semibold text-[#91f3d4] hover:bg-[#69e2bd]/10">Copy link</button>
              <p className="mt-2 text-xs text-slate-500">The token is shown only when created. Share it privately with the invited person.</p>
            </div>}
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Team members</h2><span className="text-xs text-slate-500">{overview?.members?.length ?? 0} total</span></div>
              <div className="mt-5 space-y-3">
                {(overview?.members ?? []).map((member) => <div key={`${member.user_id}-${member.role}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#69e2bd]/10 text-sm font-bold text-[#91f3d4]">{(member.full_name || member.email || "U").slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.full_name || member.email || "Workspace member"}</p><p className="truncate text-xs text-slate-500">{member.email ?? member.user_id}</p></div>
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">{roleName(member.role)}</span>
                </div>)}
                {!overview?.members?.length && <p className="text-sm text-slate-500">No members found.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Recent invitations</h2><button type="button" onClick={() => void loadOverview()} className="text-xs font-semibold text-[#91f3d4] hover:text-white">Refresh</button></div>
              <div className="mt-5 space-y-3">
                {(overview?.invitations ?? []).map((invite) => {
                  const status = invite.accepted_at ? "Accepted" : invite.expired ? "Expired" : "Awaiting signup";
                  return <div key={invite.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{invite.email}</p><p className="mt-1 text-xs text-slate-500">{roleName(invite.role)} · expires {new Date(invite.expires_at).toLocaleDateString()}</p></div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] ${invite.accepted_at ? "bg-emerald-400/10 text-emerald-200" : invite.expired ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-100"}`}>{status}</span>
                  </div>;
                })}
                {!overview?.invitations?.length && <p className="text-sm text-slate-500">No invitations yet. Create one above to onboard your team.</p>}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Recommended next steps</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <NextStep number="01" title="Invite experts" body="Bring in experienced teammates to document real decisions, trade-offs, and lessons learned." />
            <NextStep number="02" title="Assign reviewers" body="Use independent review to check accuracy and learning value before cases reach beginners." />
            <NextStep number="03" title="Track learning" body="Learners practise approved cases and build a record of evidence-backed progress." />
          </div>
        </section>
      </div>
      <WorkspaceFooter />
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-[#101c2b] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
}

function NextStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-xs font-bold tracking-[0.16em] text-[#69e2bd]">{number}</p><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{body}</p></div>;
}
