"""FastAPI application entrypoint for the banking-platform API.

Runs behind nginx on the app tier (listens on :8081). Serves account,
transaction, and transfer operations backed by PostgreSQL (RDS).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import errors
from .config import get_settings
from .database import create_all, init_engine
from .routers import accounts, health, transfers

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("banking")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_engine()
    create_all()
    log.info("banking-platform API started (env=%s)", settings.environment)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Banking Platform API",
        version="1.0.0",
        description="Accounts, transactions, and transfers for the three-tier banking platform.",
        lifespan=lifespan,
    )

    @app.exception_handler(errors.BankingError)
    async def _banking_error_handler(_: Request, exc: errors.BankingError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": exc.message},
        )

    @app.get("/", tags=["root"])
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.environment,
            "docs": "/docs",
            "health": "/health",
        }

    app.include_router(health.router)
    app.include_router(accounts.router)
    app.include_router(transfers.router)
    return app


app = create_app()
