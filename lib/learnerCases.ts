export const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"] as const;

export type LearnerCasePayload = {
  title: string;
  domain: string;
  difficulty: string;
  learning_objective: string;
  context: string;
  constraints: string;
  known_facts: string;
  attempted_approaches: string;
};

export const emptyLearnerCasePayload: LearnerCasePayload = {
  title: "",
  domain: "",
  difficulty: "Intermediate",
  learning_objective: "",
  context: "",
  constraints: "",
  known_facts: "",
  attempted_approaches: "",
};

// [min, max] character limits. These MUST match the checks in
// supabase/migrations/20261024120000_learner_case_requests.sql.
export const LEARNER_CASE_LIMITS: Record<keyof LearnerCasePayload, [number, number]> = {
  title: [5, 200],
  domain: [2, 100],
  difficulty: [1, 50],
  learning_objective: [10, 1000],
  context: [20, 4000],
  constraints: [0, 1500],
  known_facts: [0, 1500],
  attempted_approaches: [0, 1500],
};

const FIELD_LABELS: Record<keyof LearnerCasePayload, string> = {
  title: "Title",
  domain: "Domain",
  difficulty: "Difficulty",
  learning_objective: "Learning objective",
  context: "Context",
  constraints: "Constraints",
  known_facts: "Known facts",
  attempted_approaches: "What you have tried",
};

// Client-side check for fast feedback only. The database function is the real gate.
export function validateLearnerCase(payload: LearnerCasePayload): string | null {
  if (!(DIFFICULTIES as readonly string[]).includes(payload.difficulty)) {
    return "Choose a difficulty level.";
  }
  for (const key of Object.keys(LEARNER_CASE_LIMITS) as Array<keyof LearnerCasePayload>) {
    const [min, max] = LEARNER_CASE_LIMITS[key];
    const length = payload[key].trim().length;
    if (length < min) return `${FIELD_LABELS[key]} must be at least ${min} characters.`;
    if (length > max) return `${FIELD_LABELS[key]} must be at most ${max} characters.`;
  }
  return null;
}

export type RequestStatus = "submitted" | "in_progress" | "in_review" | "published";

export type MyCaseRequest = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  learning_objective: string;
  created_at: string;
  status: RequestStatus;
  published_case_id: string | null;
};

export type OpenCaseRequest = {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  learning_objective: string;
  context: string;
  constraints_text: string;
  known_facts: string;
  attempted_approaches: string;
  created_at: string;
};

export const requestStatusMeta: Record<RequestStatus, { label: string; description: string; className: string }> = {
  submitted: { label: "Waiting for an expert", description: "No expert has picked this up yet.", className: "border-slate-500/40 text-slate-300" },
  in_progress: { label: "Expert working", description: "An expert is preparing a verified answer.", className: "border-sky-300/30 text-sky-200" },
  in_review: { label: "In independent review", description: "The expert's answer is being reviewed.", className: "border-amber-300/30 text-amber-200" },
  published: { label: "Published", description: "A reviewer-approved learning resource is ready.", className: "border-[#69e2bd]/40 text-[#69e2bd]" },
};
