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
};

export const DIFFICULTY_LEVELS = ["Foundational", "Intermediate", "Advanced"] as const;
