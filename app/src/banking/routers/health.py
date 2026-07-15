"""Liveness and readiness probes (used by nginx/ALB and Kubernetes-style checks)."""
from __future__ import annotations

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from ..config import get_settings
from ..database import get_session
from ..schemas import HealthOut, ReadyOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    s = get_settings()
    return HealthOut(status="ok", service=s.app_name, environment=s.environment)


@router.get("/health/ready", response_model=ReadyOut)
def ready(response: Response) -> ReadyOut:
    # Obtain the session inside the try (not via Depends) so a failure to build
    # the engine — e.g. credentials/secret unavailable — degrades to 503 rather
    # than surfacing as an unhandled 500.
    gen = get_session()
    try:
        db = next(gen)
        db.execute(text("SELECT 1"))
        return ReadyOut(status="ok", database="up")
    except Exception:  # noqa: BLE001 - readiness must never raise
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadyOut(status="degraded", database="down")
    finally:
        gen.close()
