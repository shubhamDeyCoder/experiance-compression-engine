from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from ai_engine.auth import (
    AuthenticatedUser,
    authenticate_request,
    fetch_current_company,
    fetch_training_dataset,
)
from ai_engine.config import Settings, get_settings
from ai_engine.schemas import CalibrationRequest, CompanyDataset, ReviewSignal
from ai_engine.training import company_model_status, load_model, train_company

logger = logging.getLogger("ece.ai_engine")


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.http = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        yield
        await application.state.http.aclose()

    application = FastAPI(
        title="Experience Compression Engine AI service",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    application.state.settings = configured

    async def require_user(request: Request) -> AuthenticatedUser:
        return await authenticate_request(request, configured, request.app.state.http)

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "ece-ai-engine"}

    @application.get("/v1/model/status")
    async def model_status(request: Request) -> dict:
        identity = await require_user(request)
        company_id = await fetch_current_company(
            configured, request.app.state.http, identity.access_token
        )
        if not company_id:
            return {"available": False, "reason": "No company membership is associated with this account."}
        return company_model_status(configured, company_id)

    @application.post("/v1/model/train")
    async def train(request: Request) -> dict:
        identity = await require_user(request)
        dataset_payload = await fetch_training_dataset(
            configured, request.app.state.http, identity.access_token
        )
        try:
            CompanyDataset.model_validate(dataset_payload)
            return await run_in_threadpool(train_company, configured, dataset_payload)
        except (ValueError, OSError) as error:
            logger.exception("Training failed for authenticated manager %s", identity.user_id)
            raise HTTPException(status_code=422, detail=str(error)) from error

    @application.post("/v1/model/calibrate", response_model=ReviewSignal)
    async def calibrate(request: Request, body: CalibrationRequest) -> ReviewSignal:
        identity = await require_user(request)
        try:
            company_id = await fetch_current_company(
                configured, request.app.state.http, identity.access_token
            )
            if not company_id:
                return ReviewSignal(available=False, reason="No company membership is associated with this account.")
            model, metadata = load_model(configured, company_id, "manager_review_quality")
        except (ValueError, RuntimeError) as error:
            logger.exception("Could not load company review model for user %s", identity.user_id)
            raise HTTPException(status_code=500, detail="The company review model could not be loaded.") from error
        if model is None or metadata is None:
            return ReviewSignal(
                available=False,
                reason="No manager-reviewed company model has passed its evaluation and promotion checks.",
            )
        from ai_engine.training import evaluation_inference_text

        try:
            probability = float(model.predict_proba([
                evaluation_inference_text(body.scenario, body.answer, body.evaluation)
            ])[0][1])
        except (ValueError, KeyError) as error:
            logger.exception("Company review model inference failed for version %s", metadata["version"])
            raise HTTPException(status_code=500, detail="The company review model could not score this example.") from error
        return ReviewSignal(
            available=True,
            model_version=metadata["version"],
            estimated_manager_acceptance=round(probability, 4),
        )

    return application


app = create_app()
