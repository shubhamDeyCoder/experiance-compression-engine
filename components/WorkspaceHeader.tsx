"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resolveWorkspaceRole, WorkspaceRole, workspaceHome } from "@/lib/workspaceRole";

type WorkspaceLink = { label: string; href: string };

const linksByRole: Record<WorkspaceRole, WorkspaceLink[]> = {
  reviewer: [
    { label: "Review queue", href: "/review" },
    { label: "Learner workspace", href: "/dashboard" },
    { label: "Experience engine", href: "/engine" },
    { label: "My progress", href: "/progress" },
  ],
  expert: [
    { label: "Case studio", href: "/expert" },
    { label: "Learner workspace", href: "/dashboard" },
    { label: "Experience engine", href: "/engine" },
    { label: "My progress", href: "/progress" },
  ],
  learner: [
    { label: "Learn", href: "/dashboard" },
    { label: "Experience engine", href: "/engine" },
    { label: "My progress", href: "/progress" },
    { label: "Submit a case", href: "/dashboard/submit" },
    { label: "Explore demo", href: "/demo" },
  ],
};

const roleLabels: Record<WorkspaceRole, string> = {
  reviewer: "Reviewer",
  expert: "Expert",
  learner: "Learner",
};

export default function WorkspaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError) {
        setError(userError.message);
        return;
      }
      if (!data.user) {
        router.replace("/login");
        return;
      }

      setEmail(data.user.email ?? "");
      try {
        const userRole = await resolveWorkspaceRole();
        if (active) setRole(userRole);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not load your account role.");
        }
      }
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  const links = role ? linksByRole[role] : [];
  const home = role ? workspaceHome(role) : "/";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#08111f]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href={home} className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#69e2bd] text-lg font-black text-[#08111f]">
              E
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-wide">
                Experience<span className="text-[#69e2bd]">Engine</span>
              </span>
              <span className="mt-0.5 block text-[10px] tracking-[0.15em] text-slate-500">
                {role ? `${roleLabels[role].toUpperCase()} WORKSPACE` : "YOUR WORKSPACE"}
              </span>
            </span>
          </Link>

          {role && (
            <span className="shrink-0 rounded-full border border-[#69e2bd]/25 bg-[#69e2bd]/[0.08] px-3 py-1.5 text-xs font-medium text-[#9cf0d5] lg:hidden">
              {roleLabels[role]}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <nav
            aria-label="Workspace navigation"
            className="flex gap-1 overflow-x-auto pb-1 text-sm lg:pb-0"
          >
            {links.map((link) => {
              const isCurrent = pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-2 transition ${
                    isCurrent
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="hidden min-w-0 lg:block">
              <p className="text-xs font-medium text-slate-200">
                {role ? roleLabels[role] : "Loading account"}
              </p>
              <p className="max-w-40 truncate text-[11px] text-slate-500">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-300/30 hover:bg-red-400/[0.06] hover:text-red-100 disabled:cursor-wait disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="border-t border-red-400/20 bg-red-500/[0.08] px-5 py-2 text-center text-xs text-red-200">
          Account navigation could not be loaded: {error}
        </p>
      )}
    </header>
  );
}
