from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    internal_api_key: str
    artifact_dir: Path
    minimum_examples_per_class: int
    minimum_macro_f1: float
    retrain_interval_hours: int


def get_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_anon_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        internal_api_key=os.getenv("AI_ENGINE_INTERNAL_KEY", ""),
        artifact_dir=Path(
            os.getenv("AI_ENGINE_ARTIFACT_DIR", str(Path(__file__).resolve().parents[1] / "artifacts"))
        ).resolve(),
        minimum_examples_per_class=max(5, int(os.getenv("AI_ENGINE_MINIMUM_PER_CLASS", "10"))),
        minimum_macro_f1=min(1.0, max(0.0, float(os.getenv("AI_ENGINE_MINIMUM_MACRO_F1", "0.55")))),
        retrain_interval_hours=max(1, int(os.getenv("AI_ENGINE_RETRAIN_INTERVAL_HOURS", "24"))),
    )
