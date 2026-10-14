# Implementation Plan: Trip Intake and Conversation Flow (plus agent runtime)

**Branch**: `003-trip-intake-conversation` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-trip-intake-conversation/spec.md`. Shared stack and conventions: [plan 001](../001-app-shell-navigation/plan.md).

## Summary

The home screen (UI-SPEC §2.3: 360px editable trip form beside the chat), the `trips` record that holds the brief, the conversation store, and the **agent runtime** every other feature plugs into: an Ollama chat loop on the server with a fixed 12-tool registry, tool results wrapped as untrusted data, and provenance (`source`, `source_url`, `fetched_at`, `certainty`) passed through to the UI. (Anonymous draft trips are no longer created: login comes first, constitution 3.4.0.)

*Updated 2026-10-13 (implementation sync)*: the form uses Destination country and city dropdowns (lists from the hotel provider via `/api/places/countries` and `/api/places/cities`), marks required fields, and follows the destination country's currency for the budget. The chat asks the intake questions from a fixed script (`api/src/agent/intake.ts`) one at a time; the model answers only the traveler's own questions.

## Technical Context

**Language/Version**: TypeScript 5, Node 20, React 18

**Primary Dependencies**: Ollama HTTP API via `fetch` (no SDK), `zod` for tool-argument and form validation

**Storage**: PostgreSQL tables `trips`, `conversation_messages`

**Testing**: None; manual quickstart (including a prompt-injection check)

**Target Platform**: Podman compose; Ollama runs on the host

**Project Type**: Web application

**Performance Goals**: First agent reply visible within ~10s on a local mid-size model; form edits saved in under 300 ms

**Constraints**: Ollama URL and model names never leave the API; the model never states a fact that did not come from a tool result; `num_ctx` set explicitly (`OLLAMA_NUM_CTX`)

**Scale/Scope**: One conversation per trip

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I Simplicity | Pass | A single loop function `runAgentTurn()`; tools are plain functions in a record; no agent framework. |
| II Multi-user | Pass with note | Saved trips always have `user_id`. Anonymous drafts (`user_id NULL` plus a hashed `anon_key`) are no longer created: login comes first (constitution 3.4.0); `/api` requires a signed-in user before `tripsRouter` is reached. The columns and the dormant anon helpers in `service.ts` remain unused. |
| III Agent discipline | Pass | Fixed tool set; every fact comes from a tool; untrusted-data wrapping (research R3). |
| IV Provider abstraction | Pass | Agent imports tools only; tools import provider interfaces, never implementations. |
| V Money | Pass | Budget stored `NUMERIC(14,2)` with currency, source `user`, certainty `confirmed`. |
| VI Certainty | Pass | Envelope carries `certainty`; UI renders it. |
| VII Design fidelity | Pass | Home layout per UI-SPEC §2.3. |
| VIII No silent failure | Pass | Agent errors become a visible message with Retry; no lost messages. |

## Project Structure

### Documentation (this feature)

```text
specs/003-trip-intake-conversation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── trip-api.md
    └── agent.md
```

### Source Code

```text
api/src/agent/
├── run.ts            # runAgentTurn(input): extraction, fixed intake script, tool loop, limits, persistence
├── ollama.ts         # chat() and embed() over fetch, num_ctx, timeouts
├── prompt.ts         # system prompt + untrusted-data wrapper
├── registry.ts       # the 12 tool definitions (JSON schema) -> handler
├── envelope.ts       # ToolResult type + provenance helpers
├── extract.ts        # structured-output brief extraction (research R2)
├── intake.ts         # the fixed intake question script (Updated 2026-10-13)
└── children.ts       # spots "travelling with children" so the ages question is asked
api/src/trips/
├── routes.ts         # /api/trips (create, list, latest, get, patch, delete) and /api/trips/:id/messages (+ retry)
├── service.ts        # createTrip, applyBriefPatch (+ lenient), settleLocation, missingMinimum, deleteTrip
└── listTrips.ts      # My trips listing
api/src/search/countryCurrency.ts   # country -> currency map (Wikidata, cached 30 days)
web/src/pages/home/
├── HomePage.tsx, TripForm.tsx, ChatPanel.tsx, StarterChips.tsx, ResultCards.tsx
web/src/lib/trip.ts   # trip API calls and types; web/src/lib/places.ts country, city and currency lists
# (chatRoutes.ts was never created: the message routes live in routes.ts. Updated 2026-10-13.)
```

**Structure Decision**: The agent runtime lives here because the conversation is the feature that needs it first; tools themselves live in the plans that own their data (listed in `contracts/agent.md`).

## Reconciliations With Other Documents

- Spec 003 was updated to match `docs/UI-SPEC.md` §2.3 (form left at 360px, chat right at ≥480px, form stacks above chat on mobile, starter chips, **See results** beneath the form). The earlier "trip-so-far panel" wording is gone.
- **New trip (owner decision, 2026-10-11)**: a **New trip** button in the trip form header (now a solid primary button, "+ New trip"; Updated 2026-10-13), disabled while the trip is empty or a reply is pending, with a confirmation modal. It uses the existing `POST /api/trips`; no new endpoint. UI-SPEC §2.3, the mockups (`HomeForm`, `Mobile Screens` M2) and spec 003 (User Story 4, FR-014 to FR-016) were updated to match.
- UI-SPEC enables **See results** when Destination *or* "recommend one", Dates *or* Duration, Travelers and Budget are set; this is FR-006. *Updated 2026-10-13*: the code now also requires both start and end dates (a duration alone no longer suffices), a transport preference and an accommodation preference; each required field is marked * in the form, and every child's age must be entered (0 to 17).
- *Updated 2026-10-13*: the destination is stored as `dest_city` + `dest_country_name` (and the free-text `destination` is "City, Country"); the optional start place is `origin_city` + `origin_country_name` (edited on the Transport tab). The budget currency follows the destination country (mapping in `api/src/search/countryCurrency.ts` and `/api/places/currencies`) until an amount is saved.
- *Updated 2026-10-13*: opening Home after sign-in shows an empty form: the user's latest trip is reused only when it is still blank (no details, no messages); otherwise a new trip is created and the earlier one stays in My trips.
- UI-SPEC's mockup has the form always editable and the chat optional; the API therefore treats form PATCH and chat extraction as two writers to one trip row.
- The agent's 12 tools are implemented across plans 003–007 (table in `contracts/agent.md`).

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `anon_key_hash` on `trips` | Spec 002 (superseded by login first; column now unused, no new rows use it) | Browser-only storage would lose the trip server-side state the agent needs |
