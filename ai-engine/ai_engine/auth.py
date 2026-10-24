from __future__ import annotations

import hmac
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request

from ai_engine.config import Settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    access_token: str


def _bearer_token(request: Request) -> str:
    value = request.headers.get("authorization", "")
    if not value.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A Supabase access token is required.")
    token = value[7:].strip()
    if not token or len(token) > 8192:
        raise HTTPException(status_code=401, detail="The access token is invalid.")
    return token


def _check_internal_key(request: Request, settings: Settings) -> None:
    provided = request.headers.get("x-engine-internal-key", "")
    if not settings.internal_api_key or not hmac.compare_digest(provided, settings.internal_api_key):
        raise HTTPException(status_code=403, detail="The engine service is not available to this caller.")


async def authenticate_request(
    request: Request,
    settings: Settings,
    client: httpx.AsyncClient,
) -> AuthenticatedUser:
    _check_internal_key(request, settings)
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")
    token = _bearer_token(request)
    try:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Supabase authentication could not be reached.") from error
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your Supabase session is invalid or expired.")
    user = response.json()
    if not isinstance(user, dict) or not isinstance(user.get("id"), str):
        raise HTTPException(status_code=401, detail="Supabase returned an invalid user.")
    return AuthenticatedUser(user_id=user["id"], access_token=token)


async def fetch_training_dataset(
    settings: Settings,
    client: httpx.AsyncClient,
    access_token: str,
    company_id: str | None = None,
    service_role: bool = False,
) -> dict:
    if not settings.supabase_url:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")
    if service_role:
        if not settings.supabase_service_role_key:
            raise HTTPException(status_code=503, detail="Scheduled training requires SUPABASE_SERVICE_ROLE_KEY.")
        api_key = settings.supabase_service_role_key
        bearer = settings.supabase_service_role_key
    else:
        api_key = settings.supabase_anon_key
        bearer = access_token
    if not api_key:
        raise HTTPException(status_code=503, detail="Supabase API credentials are not configured.")

    try:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/export_engine_training_dataset",
            headers={"apikey": api_key, "authorization": f"Bearer {bearer}"},
            json={"p_company_id": company_id},
        )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="The authorized training dataset could not be fetched.") from error
    if response.status_code != 200:
        raise HTTPException(
            status_code=403 if response.status_code in (401, 403) else 502,
            detail="Supabase denied or could not complete the authorized training-data export.",
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Supabase returned an invalid training dataset.")
    return payload


async def fetch_current_company(
    settings: Settings,
    client: httpx.AsyncClient,
    access_token: str,
) -> str | None:
    response = await client.post(
        f"{settings.supabase_url}/rest/v1/rpc/engine_current_company",
        headers={
            "apikey": settings.supabase_anon_key,
            "authorization": f"Bearer {access_token}",
        },
        json={},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=403, detail="Your company membership could not be verified.")
    company_id = response.json()
    if company_id is not None and not isinstance(company_id, str):
        raise HTTPException(status_code=502, detail="Supabase returned an invalid company membership.")
    return company_id


async def list_training_companies(
    settings: Settings,
    client: httpx.AsyncClient,
) -> list[str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Scheduled training requires Supabase URL and service-role credentials.")
    response = await client.post(
        f"{settings.supabase_url}/rest/v1/rpc/list_engine_training_companies",
        headers={
            "apikey": settings.supabase_service_role_key,
            "authorization": f"Bearer {settings.supabase_service_role_key}",
        },
        json={},
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise RuntimeError("Supabase returned an invalid company list for scheduled training.")
    return [item["company_id"] for item in data if isinstance(item, dict) and isinstance(item.get("company_id"), str)]
