# Dream Drama Frontend

Nexus Studio is the React/Vite frontend for Dream Drama. It is deployed as a static Nginx application and communicates with the API under `/api/v1`.

## Requirements

- Node.js 22
- npm 10 or newer
- A running Dream Drama backend for interactive development

## Local Development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The application is available at `http://localhost:5173`. By default, Vite proxies `/api` to `http://localhost:8000`. Set `DEV_API_PROXY_TARGET` in `.env.local` when the local backend uses another address.

`VITE_API_ORIGIN` controls browser API requests. Keep it empty for local proxying and same-origin production. For a separate API domain, set only its origin, for example `https://api.example.com`; do not append `/api/v1`. A non-empty value is embedded at build time, and the backend must allow the frontend origin through CORS.

## Commands

```bash
npm test
npm run contracts:check
npm run build
npm run preview
```

## API Contracts

The backend owns the Pydantic contracts. This repository vendors released JSON Schemas in `contracts/schema` and commits the generated TypeScript declarations in `src/api/generated`, so normal frontend builds do not need Python or backend source code.

To regenerate declarations from the vendored schemas:

```bash
npm run contracts:generate
```

To sync from a local backend checkout or its `contracts/schema` directory:

```bash
CONTRACTS_SOURCE=../dream-drama-backend npm run contracts:sync
npm run contracts:check
```

Contract changes should be delivered as a dedicated frontend change tied to a backend tag or commit. Breaking changes require a two-phase backend/frontend rollout so either side can be rolled back independently.

## Container

Build the same-origin image:

```bash
docker build -t dream-drama-frontend .
```

For a separate API domain, pass the public build-time origin:

```bash
docker build --build-arg VITE_API_ORIGIN=https://api.example.com -t dream-drama-frontend .
```

Run the same-origin topology on the shared deployment network:

```bash
docker run -d \
  --name dream-drama-frontend \
  --network dream-drama-network \
  -e BACKEND_UPSTREAM=dream-drama-backend:8000 \
  -p 127.0.0.1:82:80 \
  dream-drama-frontend
```

`BACKEND_UPSTREAM` is a Docker DNS name and port without a scheme or path. It defaults to `backend:8000`. The Nginx proxy preserves the existing 100 MB upload limit, long-lived SSE timeouts, disabled response buffering, and SPA route fallback.

## Deployment Checks

Before promoting an image, verify authentication and token refresh, chat and canvas SSE, Gate images, all upload paths, generation polling, asset previews, and direct browser refreshes of nested routes. Keep the previous frontend image tag available for rollback.
