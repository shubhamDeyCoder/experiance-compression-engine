import { supabase } from "@/lib/supabase";

export type WorkspaceRole = "manager" | "reviewer" | "expert" | "learner";

const priority: WorkspaceRole[] = ["manager", "reviewer", "expert", "learner"];

export async function resolveWorkspaceRoles(): Promise<WorkspaceRole[]> {
  const { data, error } = await supabase.rpc("get_my_workspace_roles");
  if (error) {
    // Existing installations may not have the company migration yet. Preserve legacy roles.
    const legacy: WorkspaceRole[] = [];
    const { data: reviewer, error: reviewerError } = await supabase.rpc("has_case_role", { p_role: "reviewer" });
    if (reviewerError) throw reviewerError;
    if (reviewer) legacy.push("reviewer");
    const { data: expert, error: expertError } = await supabase.rpc("has_case_role", { p_role: "expert" });
    if (expertError) throw expertError;
    if (expert) legacy.push("expert");
    return legacy.length ? legacy : ["learner"];
  }
  const roles = Array.isArray(data) ? data.filter((role): role is WorkspaceRole =>
    role === "manager" || role === "reviewer" || role === "expert" || role === "learner"
  ) : [];
  return roles.length ? priority.filter((role) => roles.includes(role)) : ["learner"];
}

export async function resolveWorkspaceRole(): Promise<WorkspaceRole> {
  const roles = await resolveWorkspaceRoles();
  return priority.find((role) => roles.includes(role)) ?? "learner";
}

export function workspaceHome(role: WorkspaceRole): string {
  if (role === "manager") return "/manager";
  if (role === "reviewer") return "/review";
  if (role === "expert") return "/expert";
  return "/dashboard";
}
