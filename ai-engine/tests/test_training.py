from __future__ import annotations

import json
from pathlib import Path

from ai_engine.config import Settings
from ai_engine.training import _evaluation_text, company_model_status, load_model, train_company

COMPANY_ID = "11111111-1111-4111-8111-111111111111"


def make_dataset(per_label: int = 12) -> dict:
    evaluations = []
    for label, status in ((1, "validated"), (0, "rejected")):
        for index in range(per_label):
            evaluations.append(
                {
                    "example_id": f"{status}-{index}",
                    "scenario_id": f"{status}-scenario-{index}",
                    "status": status,
                    "scenario": {
                        "situation": f"Independent operational scenario group {index} about reviewing customer impact."
                    },
                    "learner_answer": (
                        "Validated answers cite observed evidence, identify operational risk, "
                        "compare alternatives and propose a reversible test."
                        if label
                        else "Rejected answers assert unsupported assumptions, skip the risk analysis "
                        "and propose irreversible action without verification."
                    )
                    + f" variation {index}",
                    "model_evaluation": {
                        "overall_score": 85 if label else 30,
                        "feedback": "Evidence and risks are clear." if label else "Evidence and risks are missing.",
                    },
                    "source_cases": [{"title": f"Expert case {index}", "domain": "Operations"}],
                    "reviewer_notes": "Manager decision rationale.",
                }
            )
    return {
        "company_id": COMPANY_ID,
        "evaluations": evaluations,
        "outcomes": [],
        "knowledge": [{
            "id": "knowledge-1",
            "kind": "manager_decision",
            "title": "Evidence first",
            "content": "Use evidence before making operational decisions.",
        }],
        "validated_feedback_count": 1,
        "source_count": 1,
    }


def make_settings(tmp_path: Path) -> Settings:
    return Settings(
        supabase_url="https://project.supabase.co",
        supabase_anon_key="test-public-key",
        supabase_service_role_key="",
        internal_api_key="test-internal-key",
        artifact_dir=tmp_path,
        minimum_examples_per_class=8,
        minimum_macro_f1=0.5,
        retrain_interval_hours=24,
    )


def test_training_uses_real_labeled_examples_and_persists_evaluated_model(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    dataset = make_dataset()

    result = train_company(settings, dataset)

    assert result["status"] == "trained"
    quality = result["models"]["manager_review_quality"]
    assert quality["status"] == "promoted"
    assert quality["examples"] == 24
    assert quality["holdout"]["macro_f1"] >= 0.5
    model, metadata = load_model(settings, COMPANY_ID, "manager_review_quality")
    assert model is not None
    assert metadata is not None
    assert company_model_status(settings, COMPANY_ID)["version"] == result["version"]


def test_insufficient_data_never_saves_or_promotes_a_model(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    dataset = make_dataset(per_label=3)

    result = train_company(settings, dataset)

    assert result["status"] == "insufficient_data"
    assert "manager_review_quality" not in result["reason"]
    assert company_model_status(settings, COMPANY_ID)["available"] is False


def test_retraining_with_same_source_fingerprint_is_a_noop(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    dataset = make_dataset()

    first = train_company(settings, dataset)
    second = train_company(settings, dataset)

    assert first["status"] == "trained"
    assert second["status"] == "unchanged"


def test_manager_review_notes_are_not_leaked_into_inference_features() -> None:
    text = _evaluation_text({
        "scenario": {"situation": "An operational decision is needed."},
        "learner_answer": "Compare evidence and risks before choosing an action.",
        "model_evaluation": {"feedback": "The answer considered evidence."},
        "reviewer_notes": "PRIVATE_LABEL: approve this output",
        "source_cases": [{"title": "Reviewer-only private title"}],
    })

    assert "PRIVATE_LABEL" not in text
    assert "Reviewer-only private title" not in text


def test_model_artifacts_are_isolated_per_company(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    other_company = "22222222-2222-4222-8222-222222222222"
    train_company(settings, make_dataset())

    assert company_model_status(settings, COMPANY_ID)["available"] is True
    assert company_model_status(settings, other_company)["available"] is False
    assert not (tmp_path / other_company / "current.json").exists()
