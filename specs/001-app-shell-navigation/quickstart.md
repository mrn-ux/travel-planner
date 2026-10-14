# Quickstart: App Shell and Platform Foundation

## Prerequisites
- Podman with `podman compose`; Ollama running on the host with the chat and embedding models pulled.
- A local `.env` copied from `.env.example` with `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL`, `LITEAPI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `DATA_USER_AGENT` set.

## Run
```bash
podman compose up --build
```
Open the URL printed in the README (default `http://localhost:8080`).

## Validate
1. **Start-up**: three containers start; `api` waits for a healthy `postgres`; `GET /api/health` returns ok through the web origin.
2. **Missing config**: remove `DATA_USER_AGENT` from `.env` and restart; the API exits naming the variable.
3. **Shell**: signed in, visit `/`, `/search`, `/trips`; confirm the same bar, the correct active item, the four theme dots (choosing one recolours the app and survives a reload), avatar menu entries (see [ui-shell](contracts/ui-shell.md)), the **Back** button and solid content panel on every screen except `/`, and no bar on `/login`. Signed out, each URL redirects to `/login`.
4. **Formatting**: check the table in [ui-shell](contracts/ui-shell.md) against the Money/Date/Duration components with sample and invalid values; no NaN/undefined/null/Invalid Date anywhere.
5. **States**: throttle the network; each screen shows loading; stop the `api` container; each screen shows an error with Retry and the bar stays.
6. **Tokens**: run `scripts/check-tokens.sh`, or search `web/src` for `#[0-9a-fA-F]{3,8}` and for `px` literals; none outside `tailwind.config.ts`.
7. **Secrets**: `git status` never lists `.env`; `.env.example` has placeholders only.
