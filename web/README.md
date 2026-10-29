# StarqERP web application

This directory contains the StarqERP React and Vite application.

## Requirements

- Node.js 22 or later
- npm

## Run locally

```sh
npm ci
npm run dev
```

The development server listens on port `3001`. Set `VITE_SUPABASE_URL` in a
local `.env.local` when the API is hosted by Supabase. Vite proxies `/api`
through the configured Starq API function. `VITE_API_URL` may be set when a
different API base is required. Leave backend secrets outside the browser
application; only public client configuration belongs in `VITE_*` variables.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

The Playwright suite starts its own Vite server and uses the local test gateway.
