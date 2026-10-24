export const RELEVANCE_WEIGHTS = {
  text: 0.6,
  domain: 0.15,
  difficulty: 0.05,
  weakArea: 0.2,
} as const;

// Shape returned by the SQL function public.find_similar_cases.
export type EngineMatch = {
  case_id: string;
  title: string;
  domain: string;
  difficulty: string;
  is_seed: boolean;
  relevance: number;
  text_score: number;
  domain_score: number;
  difficulty_score: number;
  weak_area_score: number;
  mastered_penalty: number;
  matched_terms: string[];
};

export type PathStep = {
  order: number;
  title: string;
  detail: string;
  href: string;
};

export type EngineResponse = {
  matches: EngineMatch[];
  path: PathStep[];
  reasons: Record<string, string[]>;
  narrative: { used: boolean; text?: string; reason?: string };
  limitations: string[];
  sources: EngineSource[];
  retrievalMode: "hybrid" | "keyword";
};

export type EngineSource = {
  source_type: string;
  source_id: string;
  case_id: string | null;
  title: string;
  domain: string;
  difficulty: string;
  source_url: string | null;
  relevance: number;
  citation: string;
};

export type GeneratedScenario = {
  title: string;
  situation: string;
  decision_prompt: string;
  constraints: string[];
};

export type ScenarioResponse = {
  scenario_id: string;
  scenario: GeneratedScenario;
  citations: EngineSource[];
  difficulty: string;
  adaptation_note: string;
};

export type ScenarioEvaluation = {
  overall_score: number;
  decision_quality: number;
  evidence_use: number;
  risk_awareness: number;
  feasibility: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
  next_step: string;
};

export type ModelReviewSignal = {
  available: boolean;
  reason?: string;
  model_version?: string;
  estimated_manager_acceptance?: number;
  caution: string;
};

export const DIFFICULTY_LEVELS = ["Foundational", "Intermediate", "Advanced"] as const;
