from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class OutcomeRecord(BaseModel):
    attempt_id: str
    case_id: str
    score: int = Field(ge=0, le=100)


class EvaluationRecord(BaseModel):
    example_id: str
    scenario_id: str
    status: Literal["validated", "rejected"]
    scenario: dict[str, Any]
    learner_answer: str
    model_evaluation: dict[str, Any]
    reviewer_notes: Optional[str] = None
    source_cases: list[dict[str, Any]] = Field(default_factory=list)


class KnowledgeRecord(BaseModel):
    id: str
    kind: Literal["manager_decision", "trusted_web", "validated_feedback"]
    title: str
    content: str
    created_at: Optional[str] = None


class CompanyDataset(BaseModel):
    company_id: str
    evaluations: list[EvaluationRecord] = Field(default_factory=list)
    outcomes: list[OutcomeRecord] = Field(default_factory=list)
    knowledge: list[KnowledgeRecord] = Field(default_factory=list)
    validated_feedback_count: int = Field(default=0, ge=0)
    source_count: int = Field(default=0, ge=0)


class CalibrationRequest(BaseModel):
    scenario: dict[str, Any]
    answer: str = Field(min_length=20, max_length=4000)
    evaluation: dict[str, Any]


class ReviewSignal(BaseModel):
    available: bool
    reason: Optional[str] = None
    model_version: Optional[str] = None
    estimated_manager_acceptance: Optional[float] = None
    caution: str = (
        "An uncalibrated classifier score from manager-reviewed historical examples; "
        "not a grade and not a substitute for human review."
    )
