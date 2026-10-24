from __future__ import annotations

import asyncio
import logging

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ai_engine.auth import fetch_training_dataset, list_training_companies
from ai_engine.config import get_settings
from ai_engine.training import train_company

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ece.ai_engine.scheduler")


async def retrain_eligible_companies() -> None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
        try:
            company_ids = await list_training_companies(settings, client)
        except (httpx.HTTPError, RuntimeError):
            logger.exception("Unable to discover companies eligible for scheduled retraining")
            return
        for company_id in company_ids:
            try:
                dataset = await fetch_training_dataset(
                    settings,
                    client,
                    access_token="",
                    company_id=company_id,
                    service_role=True,
                )
                result = await asyncio.to_thread(train_company, settings, dataset)
                logger.info(
                    "Scheduled retraining completed: company=%s status=%s",
                    company_id,
                    result["status"],
                )
            except (httpx.HTTPError, RuntimeError, ValueError, OSError):
                logger.exception("Scheduled retraining failed for company %s", company_id)


async def main() -> None:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        retrain_eligible_companies,
        "interval",
        hours=settings.retrain_interval_hours,
        id="tenant-retraining",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    await retrain_eligible_companies()
    logger.info("Scheduled retraining every %s hours.", settings.retrain_interval_hours)
    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    asyncio.run(main())
