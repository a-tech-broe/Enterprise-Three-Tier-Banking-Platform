"""FastAPI application entrypoint for the banking-platform API.

Runs behind nginx on the app tier (listens on :8081). Serves account,
transaction, and transfer operations backed by PostgreSQL (RDS).
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import errors
from .config import get_settings
from .database import create_all, init_engine
from .routers import accounts, health, transfers

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("banking")

# Directory holding the built React SPA (Vite `dist`). Baked into the container
# image at /app/web by the Dockerfile; absent in local/test runs (API-only).
WEB_DIST_DIR = Path(os.getenv("WEB_DIST_DIR", "/app/web"))


def _mount_web_ui(app: FastAPI) -> bool:
    """Serve the bundled single-page app at the root when it's present.

    Vite's hashed assets are served from /assets; every other non-API path
    falls back to index.html so client-side routing (deep links, refresh)
    works. Returns False when no build is bundled so callers can keep the
    API-only root handler. Registered LAST so real API routes match first.
    """
    index = WEB_DIST_DIR / "index.html"
    if not index.is_file():
        log.info("web UI not bundled (%s missing); serving API only", index)
        return False

    assets = WEB_DIST_DIR / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    root = WEB_DIST_DIR.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        # Unknown API/docs paths must 404 as usual, not fall back to HTML.
        if full_path.startswith(("api/", "health", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404)
        target = (WEB_DIST_DIR / full_path).resolve()
        if full_path and target.is_file() and root in target.parents:
            return FileResponse(str(target))  # favicon, static assets, etc.
        return FileResponse(str(index))       # SPA entrypoint / client routes

    log.info("serving bundled web UI from %s", WEB_DIST_DIR)
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Startup must not hard-fail on a transient DB problem: liveness (/health)
    # has to answer so the deploy/ALB health check passes and the container
    # stays up. DB reachability is surfaced separately by /health/ready.
    try:
        init_engine()
        create_all()
        log.info("banking-platform API started (env=%s)", settings.environment)
    except Exception:  # noqa: BLE001 - degraded start is better than a crash loop
        log.exception(
            "DB init failed at startup (env=%s); serving in degraded mode. "
            "Check /health/ready and DB connectivity.",
            settings.environment,
        )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Banking Platform API",
        version="1.0.0",
        description="Accounts, transactions, and transfers for the three-tier banking platform.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(errors.BankingError)
    async def _banking_error_handler(_: Request, exc: errors.BankingError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": exc.message},
        )

    app.include_router(health.router)
    app.include_router(accounts.router)
    app.include_router(transfers.router)

    # When the web build is bundled, the SPA owns "/" and all non-API routes.
    # Otherwise (local/test/API-only) keep a small JSON root for humans.
    if not _mount_web_ui(app):

        @app.get("/", tags=["root"])
        def root() -> dict[str, str]:
            return {
                "service": settings.app_name,
                "environment": settings.environment,
                "docs": "/docs",
                "health": "/health",
            }

    return app


app = create_app()
