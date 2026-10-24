from __future__ import annotations

import argparse
import asyncio
import json

import httpx

from ai_engine.auth import fetch_training_dataset
from ai_engine.config import get_settings
from ai_engine.training import train_company


async def _train_company(company_id: str) -> dict:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Scheduled training needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        dataset = await fetch_training_dataset(
            settings,
            client,
            access_token="",
            company_id=company_id,
            service_role=True,
        )
    return train_company(settings, dataset)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train only on the specified company's authorized, reviewed data.")
    parser.add_argument("--company-id", required=True, help="UUID of the company to train a tenant-specific model for.")
    arguments = parser.parse_args()
    result = asyncio.run(_train_company(arguments.company_id))
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
