# Nexus Studio Frontend

Nexus Studio is the React/Vite frontend. It is deployed as a static Nginx application and communicates with the API under `/api/v1`.

## Requirements

- Node.js 22
- pnpm 10 or newer
- A running Nexus Studio backend for interactive development

## Local Development

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

The application is available at `http://localhost:5173`. By default, Vite proxies `/api` to `http://localhost:8000`. Set `DEV_API_PROXY_TARGET` in `.env.local` when the local backend uses another address.

`VITE_API_ORIGIN` controls browser API requests. Keep it empty for local proxying and same-origin production. For a separate API domain, set only its origin, for example `https://api.example.com`; do not append `/api/v1`. A non-empty value is embedded at build time, and the backend must allow the frontend origin through CORS.

## Commands

```bash
pnpm test
pnpm run contracts:check
pnpm run build
pnpm run preview
```

## API Contracts

The backend owns the Pydantic contracts. This repository vendors released JSON Schemas in `contracts/schema` and commits the generated TypeScript declarations in `src/api/generated`, so normal frontend builds do not need Python or backend source code.

To regenerate declarations from the vendored schemas:

```bash
pnpm run contracts:generate
```

To sync from a local backend checkout or its `contracts/schema` directory:

```bash
CONTRACTS_SOURCE=../nexus-studio-backend pnpm run contracts:sync
pnpm run contracts:check
```

Contract changes should be delivered as a dedicated frontend change tied to a backend tag or commit. Breaking changes require a two-phase backend/frontend rollout so either side can be rolled back independently.

## Container

```bash
make docker-build
# 或独立 API 域：
# make docker-build VITE_API_ORIGIN=https://api.example.com
```

镜像名默认 `nexus-studio-prod-frontend`，与后端 Compose 一致。生产由后端仓 `make docker-up` 拉起；Nginx 默认把 `/api/` 反代到 `backend:8000`。

## Deployment Checks

Before promoting an image, verify authentication and token refresh, chat and canvas SSE, Gate images, all upload paths, generation polling, asset previews, and direct browser refreshes of nested routes. Keep the previous frontend image tag available for rollback.
