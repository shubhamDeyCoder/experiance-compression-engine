"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CompanyRegistrationPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.session) {
        setMessage("Your account request was created. Confirm your email, then sign in and return here to finish company setup. For security, the company is not created until you have a verified session.");
        return;
      }
      const { error: companyError } = await supabase.rpc("create_company_workspace", {
        p_name: companyName.trim(),
        p_industry: industry.trim(),
      });
      if (companyError) throw companyError;
      router.replace("/dashboard"); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register the company.");
    } finally { setBusy(false); }
  }

  async function finishSetup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sign in with the account you registered, then return to this page.");
      const { error: companyError } = await supabase.rpc("create_company_workspace", { p_name: companyName.trim(), p_industry: industry.trim() });
      if (companyError) throw companyError;
      router.replace("/dashboard"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not finish company setup."); }
    finally { setBusy(false); }
  }

  return (
    <main className="ece-auth-shell flex min-h-screen items-center justify-center px-5 py-10 text-white">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0d1929] p-6 shadow-2xl sm:p-10">
        <Link href="/login" className="text-sm text-slate-400 hover:text-white">← Back to sign in</Link>
        <div className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8ee2c4]">Company onboarding</p><h1 className="mt-3 text-3xl font-semibold">Create your company workspace</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Set up your organization on ECE. The account that creates the workspace becomes its first manager. You can invite employees after onboarding is connected to the manager dashboard.</p></div>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="companyName" className="mb-2 block text-sm font-medium">Company name</label><input id="companyName" required maxLength={120} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Example Technologies" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
            <div><label htmlFor="industry" className="mb-2 block text-sm font-medium">Industry</label><input id="industry" required maxLength={100} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Software, manufacturing…" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          </div>
          <div className="border-t border-white/10 pt-5"><h2 className="text-base font-semibold">Manager account</h2><p className="mt-1 text-sm text-slate-400">Use your work email. This account will own the company workspace.</p></div>
          <div><label htmlFor="managerName" className="mb-2 block text-sm font-medium">Manager full name</label><input id="managerName" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          <div><label htmlFor="managerEmail" className="mb-2 block text-sm font-medium">Work email</label><input id="managerEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          <div><label htmlFor="managerPassword" className="mb-2 block text-sm font-medium">Password</label><input id="managerPassword" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="ece-auth-input w-full rounded-xl px-4 py-3.5 text-sm outline-none" /></div>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-200">{message}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#baf4dc] px-4 py-3.5 text-sm font-bold text-[#0a2525] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Setting up workspace…" : "Register company and manager"}</button>
        </form>
        <button type="button" onClick={finishSetup} disabled={busy || !companyName.trim() || !industry.trim()} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-40">Already confirmed your email? Finish setup</button>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">Company creation is performed by a database function; the browser cannot assign itself manager permissions directly.</p>
      </div>
    </main>
  );
}
