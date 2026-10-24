import { supabase } from "@/lib/supabase";

export type WorkspaceRole = "reviewer" | "expert" | "learner";

export async function resolveWorkspaceRole(): Promise<WorkspaceRole> {
  const { data: isReviewer, error: reviewerError } = await supabase.rpc(
    "has_case_role",
    { p_role: "reviewer" },
  );
  if (reviewerError) throw reviewerError;
  if (isReviewer) return "reviewer";

  const { data: isExpert, error: expertError } = await supabase.rpc(
    "has_case_role",
    { p_role: "expert" },
  );
  if (expertError) throw expertError;
  return isExpert ? "expert" : "learner";
}

export function workspaceHome(role: WorkspaceRole): string {
  if (role === "reviewer") return "/review";
  if (role === "expert") return "/expert";
  return "/dashboard";
}
