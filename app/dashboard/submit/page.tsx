"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import WorkspaceFooter from "@/components/WorkspaceFooter";
import { formatDate } from "@/lib/cases";
import {
  DIFFICULTIES,
  emptyLearnerCasePayload,
  LEARNER_CASE_LIMITS,
  LearnerCasePayload,
  MyCaseRequest,
  requestStatusMeta,
  validateLearnerCase,
} from "@/lib/learnerCases";

const inputClasses =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#69e2bd]";

export default function SubmitCasePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<LearnerCasePayload>(emptyLearnerCasePayload);
  const [requests, setRequests] = useState<MyCaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("my_case_requests");
    if (rpcError) {
      setListError(rpcError.message);
    } else {
      setListError("");
      setRequests((data ?? []) as MyCaseRequest[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  function setField(key: keyof LearnerCasePayload, value: string) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setMessage("");

    const validationError = validateLearnerCase(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const { error: rpcError } = await supabase.rpc("submit_learner_case", { p_payload: payload });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage("Case submitted. An expert can now pick it up. You can track its progress below.");
      setPayload(emptyLearnerCasePayload);
      await loadRequests();
    }
    setSaving(false);
  }

  const count = (key: keyof LearnerCasePayload) => `${payload[key].length}/${LEARNER_CASE_LIMITS[key][1]}`;

  return (
    <main className="flex min-h-screen flex-col bg-[#08111f] text-white">
      <WorkspaceHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">SUBMIT A CASE</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Bring a real problem to an expert.</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            Describe a real-world problem or learning challenge. An expert will work through it, an independent reviewer
            will check their reasoning, and approved answers become practice material for learners.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
            <label className="block text-sm font-medium text-slate-200">
              <span>
                Title <span className="text-[#69e2bd]">*</span>
              </span>
              <input required maxLength={200} value={payload.title} onChange={(e) => setField("title", e.target.value)} className={inputClasses} placeholder="e.g. Our API latency doubled after a release" />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">{count("title")}</span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-200">
                <span>
                  Domain <span className="text-[#69e2bd]">*</span>
                </span>
                <input required maxLength={100} value={payload.domain} onChange={(e) => setField("domain", e.target.value)} className={inputClasses} placeholder="e.g. Backend engineering" />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Difficulty
                <select value={payload.difficulty} onChange={(e) => setField("difficulty", e.target.value)} className={inputClasses}>
                  {DIFFICULTIES.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-200">
              <span>
                Learning objective <span className="text-[#69e2bd]">*</span>
              </span>
              <textarea required rows={3} maxLength={1000} value={payload.learning_objective} onChange={(e) => setField("learning_objective", e.target.value)} className={inputClasses} placeholder="What skill or decision do you want to get better at?" />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">{count("learning_objective")}</span>
            </label>

            <label className="block text-sm font-medium text-slate-200">
              <span>
                Context <span className="text-[#69e2bd]">*</span>
              </span>
              <textarea required rows={6} maxLength={4000} value={payload.context} onChange={(e) => setField("context", e.target.value)} className={inputClasses} placeholder="Describe the situation: who is involved, what happened, what is at stake." />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">At least 20 characters. {count("context")}</span>
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Constraints
              <textarea rows={3} maxLength={1500} value={payload.constraints} onChange={(e) => setField("constraints", e.target.value)} className={inputClasses} placeholder="Time, budget, tools, people, rules you must work within." />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">Optional. {count("constraints")}</span>
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Known facts
              <textarea rows={3} maxLength={1500} value={payload.known_facts} onChange={(e) => setField("known_facts", e.target.value)} className={inputClasses} placeholder="What do you already know for certain?" />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">Optional. {count("known_facts")}</span>
            </label>

            <label className="block text-sm font-medium text-slate-200">
              What you have tried
              <textarea rows={3} maxLength={1500} value={payload.attempted_approaches} onChange={(e) => setField("attempted_approaches", e.target.value)} className={inputClasses} placeholder="Approaches you tried and what happened." />
              <span className="mt-1.5 block text-xs font-normal text-slate-500">Optional. {count("attempted_approaches")}</span>
            </label>

            <p className="rounded-xl border border-white/10 bg-[#0b1523] p-4 text-xs leading-6 text-slate-400">
              Do not include passwords, personal data or confidential company information. Experts and reviewers will read
              what you write here.
            </p>

            {error && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-xl border border-[#69e2bd]/30 bg-[#69e2bd]/10 p-4 text-sm text-[#b6f7e3]">
                {message}
              </p>
            )}

            <button type="submit" disabled={saving} className="rounded-full bg-[#69e2bd] px-6 py-3 text-sm font-bold text-[#08111f] hover:bg-[#91f3d4] disabled:opacity-50">
              {saving ? "Submitting…" : "Submit case →"}
            </button>
          </form>
        </section>

        <aside className="xl:pt-24">
          <h2 className="text-lg font-semibold">Your submitted cases</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Status reflects the real state of the expert and review workflow.</p>

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading your cases…</p>
            ) : listError ? (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                Could not load your cases: {listError}. If this mentions a missing function, the latest database migration has not been applied yet.
              </p>
            ) : requests.length === 0 ? (
              <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">You have not submitted any cases yet.</p>
            ) : (
              requests.map((item) => {
                const meta = requestStatusMeta[item.status];
                return (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-[#101c2b] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.domain} · {item.difficulty}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${meta.className}`}>{meta.label}</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{meta.description}</p>
                    <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(item.created_at)}</p>
                    {item.status === "published" && item.published_case_id && (
                      <Link href={`/resources/${item.published_case_id}`} className="mt-3 inline-block text-sm font-semibold text-[#69e2bd] hover:text-[#b6f7e3]">
                        Open learning resource →
                      </Link>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </div>
      <WorkspaceFooter />
    </main>
  );
}
