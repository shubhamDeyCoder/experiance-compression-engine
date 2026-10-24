"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Resource = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  case_context: string;
  initial_conditions: string;
  situation: string;
  attempted_approaches: string;
  question: string;
  final_solution: string;
  reasoning_tradeoffs: string;
  lessons_learned: string;
  is_seed: boolean;
};

type TextCheck = { out_coverage: number; out_covered: string[]; out_missing: string[]; out_expected_count: number };

export default function ResourcePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reflection, setReflection] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<TextCheck | null>(null);
  const [checkError, setCheckError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      // Row Level Security only returns approved cases (or the author's own).
      const { data, error: queryError } = await supabase
        .from("expert_cases")
        .select("id, title, domain, difficulty, case_context, initial_conditions, situation, attempted_approaches, question, final_solution, reasoning_tradeoffs, lessons_learned, is_seed")
        .eq("id", params.id)
        .eq("workflow_status", "approved")
        .maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (!data) setError("This learning resource was not found or has not been approved.");
      else setResource(data as Resource);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [params.id, router]);

  async function checkAnswer() {
    if (!resource || checking) return;
    setChecking(true); setCheckError(""); setCheck(null);
    const { data, error: rpcError } = await supabase.rpc("evaluate_free_text", { p_case_id: resource.id, p_answer: reflection });
    const row = ((data ?? []) as TextCheck[])[0];
    if (rpcError || !row) setCheckError(rpcError?.message ?? "No result was returned.");
    else setCheck(row);
    setChecking(false);
  }

  const problemSections = resource
    ? [
        ["Context", resource.case_context],
        ["Initial conditions", resource.initial_conditions],
        ["Situation", resource.situation],
        ["Approaches considered", resource.attempted_approaches],
      ].filter(([, value]) => value.trim())
    : [];

  const solutionSections = resource
    ? [
        ["Verified solution", resource.final_solution],
        ["Reasoning and trade-offs", resource.reasoning_tradeoffs],
        ["Lessons learned", resource.lessons_learned],
      ].filter(([, value]) => value.trim())
    : [];

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1523]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-bold tracking-wide">
            EXPERIENCE <span className="text-[#69e2bd]">ENGINE</span>
          </Link>
          <Link href="/dashboard/submit" className="text-sm text-slate-300 hover:text-[#69e2bd]">
            ← My cases
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
        {loading && <p className="text-slate-300">Loading learning resource…</p>}
        {!loading && error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}
        {resource && (
          <article>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#69e2bd]">REVIEWER-APPROVED LEARNING RESOURCE</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{resource.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {resource.domain} · {resource.difficulty}
            </p>
            {resource.is_seed && <p className="mt-3 inline-block rounded-full border border-amber-300/30 px-3 py-1 text-xs text-amber-200">Demo seed example — written by the development team, not real expert experience</p>}

            <div className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
              {problemSections.map(([heading, value]) => (
                <section key={heading}>
                  <h2 className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">{heading.toUpperCase()}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{value}</p>
                </section>
              ))}
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-[#101c2b] p-5 sm:p-7">
              <h2 className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">TRY IT FIRST</h2>
              <p className="mt-3 text-base leading-7 text-slate-200">{resource.question}</p>
              <label className="mt-4 block text-sm font-medium text-slate-200">
                Write your own answer before reading the expert&apos;s
                <textarea
                  rows={5}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1523] px-4 py-3 text-sm text-white outline-none focus:border-[#69e2bd]"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void checkAnswer()} disabled={checking || reflection.trim().length < 20} className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:border-[#69e2bd] disabled:opacity-50">{checking ? "Checking…" : "Check my answer"}</button>
                <span className="text-xs text-slate-500">At least 20 characters. Each check is saved to your progress.</span>
              </div>
              {checkError && <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{checkError}</p>}
              {check && (
                <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1523] p-4 text-sm leading-6 text-slate-300">
                  <p><strong className="text-[#69e2bd]">{check.out_coverage}%</strong> of the {check.out_expected_count} key concepts in the expert reasoning appear in your answer.</p>
                  {check.out_covered.length > 0 && <p className="mt-2">Covered: {check.out_covered.join(", ")}</p>}
                  {check.out_missing.length > 0 && <p className="mt-2">Not yet mentioned: {check.out_missing.join(", ")}</p>}
                  <p className="mt-3 text-xs text-slate-500">This is a keyword-coverage heuristic on word stems. It is not a grade, and a good answer can use different words.</p>
                </div>
              )}
              {!revealed && (
                <button type="button" onClick={() => setRevealed(true)} className="mt-4 rounded-full bg-[#69e2bd] px-5 py-3 text-sm font-bold text-[#08111f] hover:bg-[#91f3d4]">
                  Reveal expert reasoning →
                </button>
              )}
            </section>

            {revealed && (
              <div className="mt-6 space-y-6 rounded-2xl border border-[#69e2bd]/25 bg-[#69e2bd]/[0.04] p-5 sm:p-7">
                {solutionSections.map(([heading, value]) => (
                  <section key={heading}>
                    <h2 className="text-xs font-semibold tracking-[0.16em] text-[#69e2bd]">{heading.toUpperCase()}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{value}</p>
                  </section>
                ))}
                <p className="border-t border-white/10 pt-4 text-xs leading-6 text-slate-500">
                  This is one expert&apos;s reviewed approach, not the only valid one. It does not replace professional experience.
                </p>
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
