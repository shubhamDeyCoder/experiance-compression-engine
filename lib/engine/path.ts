import { EngineMatch, PathStep, RELEVANCE_WEIGHTS } from "./types";

const pct = (value: number) => `${Math.round(value * 100)}%`;

// Every reason maps to a number returned by the database, so nothing here is invented.
export function explainMatch(match: EngineMatch): string[] {
  const reasons: string[] = [];

  if (match.matched_terms.length > 0) {
    reasons.push(
      `Text match: your description shares ${match.matched_terms.length} key term(s) with this case (${match.matched_terms.slice(0, 8).join(", ")}). Text score ${pct(match.text_score)}, weighted ${pct(RELEVANCE_WEIGHTS.text)}.`,
    );
  } else {
    reasons.push("No shared key terms; this case surfaced through domain match.");
  }
  if (match.domain_score === 1) reasons.push(`Same domain as the one you entered (${match.domain}).`);
  else if (match.domain_score > 0) reasons.push(`Related domain to the one you entered (${match.domain}).`);
  if (match.difficulty_score === 1) reasons.push(`Same difficulty level (${match.difficulty}).`);
  if (match.weak_area_score > 0.5) {
    reasons.push(
      `Weak-area signal: your saved results in this domain are lower so far, so it is ranked higher (signal ${pct(match.weak_area_score)}, weighted ${pct(RELEVANCE_WEIGHTS.weakArea)}).`,
    );
  } else if (match.weak_area_score === 0.5) {
    reasons.push("No practice history in this domain yet, so the weak-area signal is neutral (50%).");
  }
  if (match.mastered_penalty > 0) {
    reasons.push("You already scored 90 or more on this case, so it is ranked lower.");
  }
  return reasons;
}

export function buildLearningPath(matches: EngineMatch[]): PathStep[] {
  const steps: PathStep[] = matches.slice(0, 3).map((match, index) => ({
    order: index + 1,
    title: `Work through “${match.title}”`,
    detail:
      "Read the situation, write your own answer to the decision prompt first, then compare it with the reviewed expert reasoning.",
    href: `/resources/${match.case_id}`,
  }));

  if (steps.length > 0) {
    steps.push({
      order: steps.length + 1,
      title: "Test your decisions with scored practice",
      detail: "Answer the scored decision questions in your workspace. Your attempts are saved and shown in your progress.",
      href: "/dashboard",
    });
    steps.push({
      order: steps.length + 1,
      title: "Review your progress and weak areas",
      detail: "Check which domains and cases need more practice, based on your saved results only.",
      href: "/progress",
    });
  }
  return steps;
}

export const ENGINE_LIMITATIONS = [
  "Retrieval uses approved cases and manager-curated knowledge visible to your company membership; the corpus may not cover every problem.",
  "With OPENAI_API_KEY, retrieval combines vector similarity and PostgreSQL full-text search. Without it, retrieval falls back to keyword search.",
  "AI scenarios and evaluations are grounded in retrieved sources but can still be wrong; compare them with the cited reviewer-approved evidence.",
  "Saved scores adapt practice difficulty but are not a validated competency measure. Manager validation is required before feedback becomes searchable knowledge.",
  "Retrieval and feedback do not train or fine-tune a model. Saved outcomes can support a future curated evaluation dataset.",
  "Cases marked “Demo seed example” were written by the development team for demonstration and are not real verified industry experience.",
];
