export type CaseWorkflowStatus = "draft" | "submitted" | "approved" | "rejected";

export type CaseOption = {
  text: string;
  score: number;
  feedback: string;
};

export type ExpertCase = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  situation: string;
  question: string;
  options: CaseOption[];
  case_context: string;
  initial_conditions: string;
  attempted_approaches: string;
  final_solution: string;
  reasoning_tradeoffs: string;
  lessons_learned: string;
  experience_level: string | null;
  workflow_status: CaseWorkflowStatus;
  review_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  revision_number: number;
  created_at: string;
};

export type CasePayload = Omit<
  ExpertCase,
  | "id"
  | "workflow_status"
  | "review_feedback"
  | "submitted_at"
  | "reviewed_at"
  | "revision_number"
  | "created_at"
>;

export const emptyCasePayload: CasePayload = {
  title: "",
  domain: "",
  difficulty: "Intermediate",
  situation: "",
  question: "",
  options: [],
  case_context: "",
  initial_conditions: "",
  attempted_approaches: "",
  final_solution: "",
  reasoning_tradeoffs: "",
  lessons_learned: "",
  experience_level: "",
};

export function statusLabel(status: CaseWorkflowStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}
