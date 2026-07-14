# syntax=docker/dockerfile:1
# ---------- web builder (React SPA) ----------
# Builds the Vite app to static files that FastAPI serves at the root, so the
# whole banking UI + API ship as one image behind a single URL.
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json ./
# package-lock is intentionally not committed (npm optional-dep bug), so install
# rather than ci. node_modules/dist are excluded via .dockerignore.
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- builder ----------
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ---------- runtime ----------
FROM python:3.12-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8081

# Non-root runtime user.
RUN groupadd --system app && useradd --system --gid app --home /app app \
    && apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
WORKDIR /app
COPY src/ ./src/
# Bundled React SPA (served by FastAPI at "/"; see main._mount_web_ui).
COPY --from=web /web/dist /app/web
ENV PYTHONPATH=/app/src \
    WEB_DIST_DIR=/app/web

USER app
EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8081/health || exit 1

CMD ["uvicorn", "banking.main:app", "--host", "0.0.0.0", "--port", "8081"]
