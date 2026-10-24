from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline

from ai_engine.config import Settings
from ai_engine.schemas import CompanyDataset


def _company_directory(settings: Settings, company_id: str) -> Path:
    # The value comes from auth.uid-scoped RPC output or UUID-validated service requests.
    if len(company_id) != 36 or any(character not in "0123456789abcdef-" for character in company_id.lower()):
        raise ValueError("Supabase returned an invalid company identifier.")
    return settings.artifact_dir / company_id


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _evaluation_text(record: dict[str, Any]) -> str:
    scenario = record.get("scenario", {})
    assessment = record.get("model_evaluation", {})
    pieces = [
        "Manager reviewed learner evaluation.",
        f"Scenario: {_json_text(scenario)}",
        f"Learner answer: {record.get('learner_answer', '')}",
        f"AI rubric evaluation: {_json_text(assessment)}",
    ]
    return "\n".join(pieces)


def evaluation_inference_text(
    scenario: dict[str, Any],
    answer: str,
    evaluation: dict[str, Any],
) -> str:
    return _evaluation_text(
        {
            "scenario": scenario,
            "learner_answer": answer,
            "model_evaluation": evaluation,
        },
    )


def _outcome_text(record: dict[str, Any], knowledge: str) -> str:
    pieces = [
        "Learner decision on an approved expert case.",
        f"Case title and domain: {record.get('title', '')} | {record.get('domain', '')}",
        f"Difficulty: {record.get('difficulty', '')}",
        f"Situation: {record.get('situation', '')}",
        f"Decision prompt: {record.get('question', '')}",
        f"Selected expert-authored option: {record.get('selected_option_text', '')}",
        f"Expert option rationale: {record.get('option_feedback', '')}",
        f"Authorized company knowledge and validated feedback: {knowledge}",
    ]
    return "\n".join(pieces)


def _split_indices(labels: np.ndarray, groups: np.ndarray) -> tuple[np.ndarray, np.ndarray, int] | None:
    for seed in range(40):
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed)
        train, test = next(splitter.split(np.zeros(len(labels)), labels, groups))
        if len(np.unique(labels[train])) == 2 and len(np.unique(labels[test])) == 2:
            return train, test, seed
    return None


def _new_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    stop_words="english",
                    ngram_range=(1, 2),
                    min_df=1,
                    max_features=30000,
                    sublinear_tf=True,
                ),
            ),
            ("classifier", LogisticRegression(class_weight="balanced", max_iter=1500, random_state=17)),
        ]
    )


def _metrics(model: Pipeline, texts: list[str], labels: np.ndarray) -> dict[str, float]:
    probabilities = model.predict_proba(texts)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "accuracy": round(float(accuracy_score(labels, predictions)), 4),
        "precision": round(float(precision_score(labels, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(labels, predictions, zero_division=0)), 4),
        "macro_f1": round(float(f1_score(labels, predictions, average="macro", zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(labels, probabilities)), 4),
    }


def _train_candidate(
    name: str,
    texts: list[str],
    labels: list[int],
    groups: list[str],
    min_per_class: int,
) -> tuple[Pipeline | None, dict[str, Any]]:
    y = np.asarray(labels, dtype=np.int8)
    counts = np.bincount(y, minlength=2)
    result: dict[str, Any] = {
        "examples": len(texts),
        "positive_examples": int(counts[1]),
        "negative_examples": int(counts[0]),
        "distinct_groups": len(set(groups)),
        "holdout": None,
    }
    if min(counts) < min_per_class:
        result["status"] = "insufficient_data"
        result["reason"] = (
            f"{name} needs at least {min_per_class} manager-reviewed examples in each class; "
            f"observed {int(counts[0])} rejected/low and {int(counts[1])} validated/high."
        )
        return None, result
    if len(set(groups)) < 4:
        result["status"] = "insufficient_data"
        result["reason"] = f"{name} needs at least four independent case/scenario groups for leakage-resistant evaluation."
        return None, result

    split = _split_indices(y, np.asarray(groups))
    if split is None:
        result["status"] = "insufficient_data"
        result["reason"] = f"{name} could not produce a group-separated holdout containing both labels."
        return None, result
    train_indices, test_indices, seed = split
    candidate = _new_pipeline()
    try:
        candidate.fit([texts[index] for index in train_indices], y[train_indices])
        result["holdout"] = _metrics(candidate, [texts[index] for index in test_indices], y[test_indices])
        candidate.fit(texts, y)
    except ValueError as error:
        result["status"] = "insufficient_data"
        result["reason"] = f"{name} could not be fitted to the observed text: {error}"
        result["holdout"] = None
        return None, result
    result["status"] = "candidate"
    result["split"] = {
        "method": "GroupShuffleSplit",
        "random_seed": seed,
        "train_examples": len(train_indices),
        "test_examples": len(test_indices),
        "held_out_groups": len(set(np.asarray(groups)[test_indices])),
    }
    return candidate, result


def _read_pointer(directory: Path) -> dict[str, Any] | None:
    pointer = directory / "current.json"
    if not pointer.is_file():
        return None
    try:
        return json.loads(pointer.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _atomic_write(path: Path, writer: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_path = tempfile.mkstemp(prefix=".candidate-", dir=str(path.parent))
    os.close(handle)
    try:
        writer(Path(temporary_path))
        os.replace(temporary_path, path)
    finally:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)


def train_company(settings: Settings, raw_dataset: dict[str, Any]) -> dict[str, Any]:
    dataset = CompanyDataset.model_validate(raw_dataset)
    knowledge_items = raw_dataset.get("knowledge", [])
    if not isinstance(knowledge_items, list):
        knowledge_items = []
    knowledge = "\n".join(
        f"{item.get('kind', '')}: {item.get('title', '')} — {item.get('content', '')[:1800]}"
        for item in knowledge_items
        if isinstance(item, dict) and isinstance(item.get("content"), str)
    )[:12000]

    evaluation_texts: list[str] = []
    evaluation_labels: list[int] = []
    evaluation_groups: list[str] = []
    for record in raw_dataset.get("evaluations", []):
        if not isinstance(record, dict) or record.get("status") not in ("validated", "rejected"):
            continue
        if not isinstance(record.get("scenario_id"), str) or not isinstance(record.get("learner_answer"), str):
            continue
        evaluation_texts.append(_evaluation_text(record))
        evaluation_labels.append(1 if record["status"] == "validated" else 0)
        evaluation_groups.append(record["scenario_id"])

    outcome_texts: list[str] = []
    outcome_labels: list[int] = []
    outcome_groups: list[str] = []
    for record in raw_dataset.get("outcomes", []):
        if not isinstance(record, dict) or not isinstance(record.get("case_id"), str):
            continue
        score = record.get("score")
        if not isinstance(score, int) or not 0 <= score <= 100:
            continue
        outcome_texts.append(_outcome_text(record, knowledge))
        outcome_labels.append(1 if score >= 80 else 0)
        outcome_groups.append(record["case_id"])

    training_data = {
        "manager_review_quality": (evaluation_texts, evaluation_labels, evaluation_groups),
        "learner_decision_success": (outcome_texts, outcome_labels, outcome_groups),
    }
    directory = _company_directory(settings, dataset.company_id)
    pointer = _read_pointer(directory)
    candidate_models: dict[str, Pipeline] = {}
    results: dict[str, dict[str, Any]] = {}

    for name, (texts, labels, groups) in training_data.items():
        model, evaluation = _train_candidate(
            name, texts, labels, groups, settings.minimum_examples_per_class
        )
        results[name] = evaluation
        if model is not None:
            candidate_models[name] = model

    if not candidate_models:
        return {
            "status": "insufficient_data",
            "company_id": dataset.company_id,
            "models": results,
            "reason": "No model met the minimum class counts and group-separated holdout requirements; no artifact was promoted.",
        }

    digest_payload = {
        "company_id": dataset.company_id,
        "evaluations": sorted(zip(evaluation_groups, evaluation_labels, evaluation_texts)),
        "outcomes": sorted(zip(outcome_groups, outcome_labels, outcome_texts)),
        "knowledge": sorted(
            (
                item.get("id", ""),
                item.get("kind", ""),
                item.get("title", ""),
                item.get("content", ""),
                item.get("created_at", ""),
            )
            for item in knowledge_items
            if isinstance(item, dict)
        ),
    }
    fingerprint = hashlib.sha256(_json_text(digest_payload).encode("utf-8")).hexdigest()
    if pointer and pointer.get("dataset_fingerprint") == fingerprint:
        return {
            "status": "unchanged",
            "company_id": dataset.company_id,
            "models": results,
            "reason": "The authorized training data has not changed since the active model version.",
        }

    old_models: dict[str, Any] = {}
    if pointer:
        try:
            old_models = joblib.load(directory / pointer["artifact"])
        except (OSError, KeyError, ValueError, EOFError):
            old_models = {}

    promoted_models: dict[str, Pipeline] = {}
    for name, model in candidate_models.items():
        metrics = results[name]["holdout"]
        threshold = settings.minimum_macro_f1
        old_metrics = (pointer or {}).get("metrics", {}).get(name, {}).get("holdout", {})
        if metrics["macro_f1"] < threshold:
            results[name]["status"] = "not_promoted"
            results[name]["reason"] = (
                f"Observed holdout macro F1 {metrics['macro_f1']:.4f} is below the configured "
                f"promotion floor {threshold:.4f}; candidate retained only as a report."
            )
        elif old_metrics and metrics["macro_f1"] < float(old_metrics.get("macro_f1", 0)) - 0.05:
            results[name]["status"] = "not_promoted"
            results[name]["reason"] = "The holdout macro F1 regressed by more than 0.05 versus the active model."
        else:
            results[name]["status"] = "promoted"
            promoted_models[name] = model

    if not promoted_models:
        return {
            "status": "not_promoted",
            "company_id": dataset.company_id,
            "models": results,
            "reason": "Candidate holdout evaluations did not pass promotion checks; the active model remains unchanged.",
        }

    active_models = dict(old_models)
    active_models.update(promoted_models)
    if pointer:
        for name, evaluation in results.items():
            if evaluation["status"] != "promoted" and name in pointer.get("metrics", {}):
                results[name] = pointer["metrics"][name]

    version = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:8]}"
    artifact_name = f"models-{version}-{fingerprint[:12]}.joblib"
    artifact_path = directory / artifact_name
    _atomic_write(artifact_path, lambda path: joblib.dump(active_models, path, compress=3))
    metadata = {
        "company_id": dataset.company_id,
        "version": version,
        "artifact": artifact_name,
        "dataset_fingerprint": fingerprint,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metrics": results,
        "training_sources": {
            "validated_and_rejected_manager_reviews": len(evaluation_texts),
            "expert_scored_learner_attempts": len(outcome_texts),
            "validated_feedback_records": dataset.validated_feedback_count,
            "authorized_company_knowledge_records": dataset.source_count,
        },
        "training_method": (
            "TF-IDF word and bigram features with class-balanced logistic regression; "
            "group-separated holdout; candidate promoted only after measured quality gates."
        ),
    }
    _atomic_write(
        directory / f"metadata-{version}.json",
        lambda path: path.write_text(_json_text(metadata), encoding="utf-8"),
    )
    _atomic_write(
        directory / "current.json",
        lambda path: path.write_text(_json_text(metadata), encoding="utf-8"),
    )
    return {
        "status": "trained",
        "company_id": dataset.company_id,
        "models": results,
        "version": version,
        "training_sources": metadata["training_sources"],
    }


def load_model(settings: Settings, company_id: str, model_name: str) -> tuple[Pipeline | None, dict[str, Any] | None]:
    directory = _company_directory(settings, company_id)
    pointer = _read_pointer(directory)
    if not pointer:
        return None, None
    try:
        models = joblib.load(directory / pointer["artifact"])
    except (OSError, KeyError, ValueError, EOFError) as error:
        raise RuntimeError("The active company model artifact could not be loaded.") from error
    model = models.get(model_name)
    return model, pointer


def company_model_status(settings: Settings, company_id: str) -> dict[str, Any]:
    pointer = _read_pointer(_company_directory(settings, company_id))
    if not pointer:
        return {
            "available": False,
            "reason": "No model has passed training and promotion requirements for this company.",
        }
    return {
        "available": True,
        "version": pointer["version"],
        "created_at": pointer["created_at"],
        "models": pointer["metrics"],
        "training_sources": pointer["training_sources"],
    }
