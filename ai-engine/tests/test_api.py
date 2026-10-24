from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from ai_engine.config import Settings
from ai_engine.service import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(
        supabase_url="https://project.supabase.co",
        supabase_anon_key="public-key",
        supabase_service_role_key="",
        internal_api_key="internal-secret",
        artifact_dir=tmp_path,
        minimum_examples_per_class=10,
        minimum_macro_f1=0.55,
        retrain_interval_hours=24,
    )


def test_health_is_available_without_auth(settings):
    with TestClient(create_app(settings)) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_training_requires_internal_key_and_user_token(settings):
    with TestClient(create_app(settings)) as client:
        missing_internal = client.post("/v1/model/train", json={"force": False})
        missing_bearer = client.post(
            "/v1/model/train",
            headers={"x-engine-internal-key": "internal-secret"},
            json={"force": False},
        )
    assert missing_internal.status_code == 403
    assert missing_bearer.status_code == 401


def test_training_rejects_unverified_supabase_session(settings, monkeypatch):
    app = create_app(settings)

    def mock_supabase(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "invalid token"})

    async_client = httpx.AsyncClient
    monkeypatch.setattr(
        "ai_engine.service.httpx.AsyncClient",
        lambda **kwargs: async_client(transport=httpx.MockTransport(mock_supabase), **kwargs),
    )
    with TestClient(app) as client:
        response = client.post(
            "/v1/model/train",
            headers={
                "x-engine-internal-key": "internal-secret",
                "authorization": "Bearer invalid-token",
            },
            json={"force": False},
        )
    assert response.status_code == 401


def test_manager_training_uses_the_user_scoped_supabase_export(settings, monkeypatch):
    requests: list[httpx.Request] = []

    def mock_supabase(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": "manager-user"})
        if request.url.path == "/rest/v1/rpc/export_engine_training_dataset":
            return httpx.Response(
                200,
                json={
                    "company_id": "11111111-1111-4111-8111-111111111111",
                    "evaluations": [],
                    "outcomes": [],
                    "knowledge": [],
                    "validated_feedback_count": 0,
                    "source_count": 0,
                },
            )
        return httpx.Response(404)

    async_client = httpx.AsyncClient
    monkeypatch.setattr(
        "ai_engine.service.httpx.AsyncClient",
        lambda **kwargs: async_client(transport=httpx.MockTransport(mock_supabase), **kwargs),
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/v1/model/train",
            headers={
                "x-engine-internal-key": "internal-secret",
                "authorization": "Bearer user-access-token",
            },
            json={},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "insufficient_data"
    rpc_request = next(request for request in requests if request.url.path.endswith("export_engine_training_dataset"))
    assert rpc_request.headers["authorization"] == "Bearer user-access-token"
    assert json.loads(rpc_request.content) == {"p_company_id": None}


def test_model_status_is_not_public(settings):
    with TestClient(create_app(settings)) as client:
        response = client.get("/v1/model/status")
    assert response.status_code == 403
