"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function EmployeeRegistrationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const invitationToken = params.get("invite") ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!invitationToken) {
      setError("An employee account requires a company invitation. Ask your manager for the invitation link.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        setMessage("Account created. Confirm your email, then return to this invitation link and sign in to finish joining your company.");
        return;
      }
      const { error: inviteError } = await supabase.rpc("accept_company_invitation", { p_token: invitationToken });
      if (inviteError) throw inviteError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  }

  async function finishInvitation() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sign in first using the email you registered with.");
      const { error: inviteError } = await supabase.rpc("accept_company_invitation", { p_token: invitationToken });
      if (inviteError) throw inviteError;
      router.replace("/dashboard"); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept invitation.");
    } finally { setBusy(false); }
  }

  return (
    <main className="ece-auth-shell flex min-h-screen items-center justify-center px-5 py-10 text-white">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0d1929] p-6 shadow-2xl sm:p-10">
        <Link href="/login" className="text-sm text-slate-400 hover:text-white">← Back to sign in</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-[#8ee2c4]">Employee onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold">Create your employee account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Join your company’s Experience Compression Engine workspace through a manager-issued invitation.</p>
        {!invitationToken && <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">You need an invitation link from your company manager to register. This prevents unapproved users from joining a company or choosing privileged roles.</p>}
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div><label htmlFor="fullName" className="mb-2 block text-sm font-medium">Full name</label><input id="fullName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          <div><label htmlFor="employeeEmail" className="mb-2 block text-sm font-medium">Work email</label><input id="employeeEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          <div><label htmlFor="employeePassword" className="mb-2 block text-sm font-medium">Password</label><div className="relative"><input id="employeePassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="ece-auth-input w-full rounded-xl px-4 py-3.5 pr-20 text-sm outline-none" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-4 text-xs text-slate-400 hover:text-white">{showPassword ? "Hide" : "Show"}</button></div></div>
          <div><label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">Confirm password</label><input id="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-200">{message}</p>}
          <button type="submit" disabled={busy || !invitationToken} className="w-full rounded-xl bg-[#baf4dc] px-4 py-3.5 text-sm font-bold text-[#0a2525] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Creating account…" : "Create employee account"}</button>
        </form>
        {invitationToken && <button type="button" onClick={finishInvitation} disabled={busy} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-50">Already signed in? Accept invitation</button>}
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-[#8ee2c4] hover:text-white">Sign in</Link></p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<main className="ece-auth-shell min-h-screen p-10 text-white">Loading registration…</main>}><EmployeeRegistrationForm /></Suspense>;
}
