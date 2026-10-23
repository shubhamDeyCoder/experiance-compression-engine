import { CaseWorkflowStatus, statusLabel } from "@/lib/cases";

export function CaseStatusBadge({ status }: { status: CaseWorkflowStatus }) {
  const colors = {
    draft: "border-slate-500/40 text-slate-300",
    submitted: "border-amber-300/30 text-amber-200",
    approved: "border-[#69e2bd]/40 text-[#69e2bd]",
    rejected: "border-red-400/30 text-red-200",
  };

  return <span className={`rounded-full border px-2.5 py-1 text-xs ${colors[status]}`}>{statusLabel(status)}</span>;
}
