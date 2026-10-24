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
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

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
