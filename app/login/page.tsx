"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WorkspaceFooter from "@/components/WorkspaceFooter";
import { resolveWorkspaceRole, workspaceHome } from "@/lib/workspaceRole";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        if (authError && authError.message !== "Auth session missing!") {
          setError(authError.message);
        }
        setCheckingSession(false);
        return;
      }
      try {
        const role = await resolveWorkspaceRole();
        if (active) {
          router.replace(workspaceHome(role));
          router.refresh();
        }
      } catch {
        if (active) setCheckingSession(false);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      const role = await resolveWorkspaceRole();
      router.replace(workspaceHome(role));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your work email first, then select Forgot password.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, a password reset link will be sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="ece-auth-shell flex min-h-screen flex-col text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1929] shadow-2xl lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-[#102b35] p-10 lg:flex xl:p-14">
            <div className="ece-orb ece-orb-one" />
            <div className="ece-orb ece-orb-two" />
            <Link href="/" className="relative z-10 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#baf4dc] text-lg font-black text-[#0b2027]">E</span>
              <span className="text-sm font-semibold tracking-wide">EXPERIENCE COMPRESSION ENGINE</span>
            </Link>
            <div className="relative z-10 max-w-lg py-12">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-[#a7e9d2]">Experience, transferred</p>
              <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">Turn real work into faster learning.</h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-300">A company learning workspace where expert judgement becomes reviewed cases, practical mentorship, and measurable competency.</p>
              <div className="mt-10 grid grid-cols-3 gap-3">
                {[ ["01", "Capture expertise"], ["02", "Practice cases"], ["03", "Prove skills"] ].map(([number, label]) => (
                  <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="text-xs font-bold text-[#a7e9d2]">{number}</span>
                    <p className="mt-3 text-sm leading-5 text-slate-200">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="relative z-10 text-xs text-slate-400">Built for teams that learn by doing.</p>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
            <div className="w-full max-w-md">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white lg:hidden">
                <span aria-hidden="true">←</span> Back to home
              </Link>
              <div className="mb-8 mt-8 lg:mt-0">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#baf4dc] font-black text-[#0b2027] lg:hidden">E</div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8ee2c4]">Your workspace</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Sign in with the work email associated with your company account.</p>
              </div>

              {checkingSession ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">Checking your session…</div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Work email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none transition" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="password" className="block text-sm font-medium text-slate-200">Password</label>
                      <button type="button" onClick={handleForgotPassword} disabled={loading} className="text-xs font-semibold text-[#8ee2c4] hover:text-white disabled:opacity-50">Forgot password?</button>
                    </div>
                    <div className="relative">
                      <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="ece-auth-input w-full rounded-xl px-4 py-3.5 pr-20 text-sm outline-none transition" />
                      <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-400 hover:text-white">{showPassword ? "Hide" : "Show"}</button>
                    </div>
                  </div>
                  {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm leading-5 text-rose-200">{error}</p>}
                  {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm leading-5 text-emerald-200">{message}</p>}
                  <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#baf4dc] px-4 py-3.5 text-sm font-bold text-[#0a2525] shadow-lg shadow-emerald-950/20 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? "Please wait…" : "Sign in to your workspace"}
                  </button>
                </form>
              )}

              <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">New to ECE?</span><span className="h-px flex-1 bg-white/10" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/company/register" className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-[#8ee2c4]/60 hover:bg-white/[0.04]">Register a company</Link>
                <Link href="/register" className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-[#8ee2c4]/60 hover:bg-white/[0.04]">Join a company</Link>
              </div>
              <p className="mt-6 text-center text-xs leading-5 text-slate-500">Access is linked to your company membership and assigned permissions.</p>
            </div>
          </section>
        </div>
      </div>
      <WorkspaceFooter />
    </main>
  );
}
