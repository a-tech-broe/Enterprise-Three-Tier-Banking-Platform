# Stage 1 — compile TypeScript on the HOST platform (no QEMU needed for tsc).
# $BUILDPLATFORM is always the machine running the build (e.g. linux/amd64).
# This avoids the QEMU SIGILL crash that hits Node 22 when tsc runs under emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine3.21 AS builder
RUN apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2 — install production deps on the TARGET platform.
# Runs on the real target arch (arm64, amd64, etc.) so native modules
# (bcrypt, etc.) are built/downloaded for the correct architecture.
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3 — lean runtime image.
FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs skybroe
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=skybroe:nodejs --from=deps    /app/node_modules ./node_modules
COPY --chown=skybroe:nodejs --from=builder /app/dist         ./dist
USER skybroe
EXPOSE 3001
CMD ["node", "dist/index.js"]
