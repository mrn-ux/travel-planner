---
description: "Task list for Trip Intake and Conversation Flow (plus agent runtime)"
---

# Tasks: Trip Intake and Conversation Flow (plus agent runtime)

**Input**: `/specs/003-trip-intake-conversation/` (plan.md, spec.md, research.md, data-model.md, contracts/trip-api.md, contracts/agent.md, quickstart.md)

**Prerequisites**: plan 001 Phases 1-2; plan 002 T004-T006 (`optionalUser`, `requireUser`) for authenticated trips.

**Tests**: None (manual `quickstart.md`).

**Format**: `- [ ] T### [P?] [US#?] Description with file path`

---

## Phase 1: Setup

- [X] T001 Append the 003 DDL fragment from `data-model.md` (`trips`, `conversation_messages`) to `db/init.sql`
- [X] T002 [P] Add `OLLAMA_NUM_CTX` (default 32768) to `api/src/config.ts` and confirm `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL` are required there and never exposed by any route

---

## Phase 2: Foundational (agent runtime and trip service)

**CRITICAL**: complete before any user story.

- [X] T003 Implement `api/src/agent/ollama.ts`: `chat({ messages, tools, format? })` posting to `${OLLAMA_BASE_URL}/api/chat` with `stream: false`, `options.num_ctx`, 120 s timeout; and `embed(texts)` posting to `/api/embed` (used by plan 004); map failures to typed errors
- [X] T004 [P] Implement `api/src/agent/envelope.ts`: the `ToolResult<T>` type, `Certainty`, `unavailable(reason, source)` and `wrap(data, provenance)` helpers per `contracts/agent.md`
- [X] T005 [P] Implement `api/src/agent/prompt.ts`: system prompt builder (role, trip brief as data, rules from research R3) and `untrusted(source, certainty, payload)` that wraps tool results in `<untrusted_data ...>` with `<` and `>` escaped and length caps for provider text
- [X] T006 Implement `api/src/agent/registry.ts`: `ToolDef` type, a `registerTool` function and the 12 tool names from `contracts/agent.md` with `chatCallable` flags (`create_hotel_booking` false); handlers are registered by later plans; arguments validated with `zod` before the handler runs
- [X] T007 Implement `api/src/trips/service.ts`: `createTrip`, `getTripForOwner(tripId, owner)` (owner = `{ userId }` or `{ anonKeyHash }`), `applyBriefPatch(tripId, patch)` with the validation rules from `data-model.md` (no past dates, adults >= 1, positive budget, ISO currency, dates/duration agree), `missingMinimum(trip)`, `claimTrip(tripKey, userId)`
- [X] T008 Implement `api/src/trips/routes.ts`: `POST /api/trips`, `GET /api/trips/:id`, `PATCH /api/trips/:id`, `POST /api/trips/claim` per `contracts/trip-api.md`; (anonymous callers and `X-Trip-Key` are no longer used: login comes first); non-owners get 404; mount under `/api` in `api/src/index.ts`
- [X] T009 [P] Implement `web/src/lib/trip.ts`: trip store (current trip, missing fields), (the anonymous `tripKey` is no longer used) API calls for create/get/patch/claim

---

## Phase 3: User Story 2 - Fill and edit the trip form (Priority: P1) MVP

**Goal**: the always-editable trip form with the proceed button.

**Independent Test**: fill the form without chatting; **See results** enables exactly when the minimum set is complete.

- [X] T010 [US2] Build `web/src/pages/home/HomePage.tsx` layout per `docs/UI-SPEC.md` 2.3 and `docs/design/HomeForm.dc.html`: two columns, trip form 360 px on the left, chat flexible (min 480 px) on the right, stacking with the form above the chat on narrow screens
- [X] T011 [US2] Build `web/src/pages/home/TripForm.tsx`: Card titled "Trip details" with fields in order Destination (Updated 2026-10-13: Destination country and Destination city dropdowns, see T035), Dates (two date inputs, both required), Duration, Travelers (adults, children number inputs, plus child ages when needed), Budget (currency select + number input), Transport preference, Accommodation preference, Activities / interests, Special requirements, using the ported design components
- [X] T012 [US2] Commit field edits from `TripForm.tsx` with `PATCH /api/trips/:id` on blur/change, show inline validation messages from 400/409 responses, keep typed values on failure
- [X] T013 [US2] Render the **See results** button beneath the form in `TripForm.tsx`: disabled with a hint listing `missing` (`destinationOrRecommend`, `datesOrDuration`, `travelers`, `budget`, and since 2026-10-13 `transport`, `accommodation`, plus each child's age), enabled otherwise, navigating to `/search`
- [X] T014 [US2] Pre-fill the budget currency from the signed-in user's preferred currency (`GET /api/auth/me`) in `TripForm.tsx`, else `USD` (Updated 2026-10-13: the destination country's currency takes precedence until a budget is saved, see T036)

---

## Phase 4: User Story 1 - Describe a trip in conversation (Priority: P1)

**Goal**: the chat that fills the same trip.

**Independent Test**: send a multi-field message; the form fills; only missing fields are asked for.

- [X] T015 [US1] Implement brief extraction in `api/src/agent/extract.ts`: one separate Ollama call with `format` = JSON Schema of the brief, `temperature: 0`, validated with `zod`, merged via `applyBriefPatch` without overwriting a field with null (research R2)
- [X] T016 [US1] Implement `api/src/agent/run.ts` `runAgentTurn(tripId, text)`: persist the user message, run extraction, build prompt with the updated brief, run the tool loop (max 6 rounds, only `chatCallable` tools), persist the agent message with `cards`, return `{ userMessage, agentMessage, trip, missing }`
- [X] T017 [US1] Implement the message routes (built in `api/src/trips/routes.ts`; no separate `chatRoutes.ts` exists): `GET /api/trips/:id/messages`, `POST /api/trips/:id/messages` (1-4000 chars, not blank), `POST /api/trips/:id/messages/retry`; on agent failure store the user message and return 502/504 with a retryable error
- [X] T018 [P] [US1] Build `web/src/pages/home/StarterChips.tsx`: headline "Where do you want to go?" (`3xl`, Spectral, centred) with chips **I know my destination**, **Recommend somewhere for me** (also sets `recommendRequested`), **Just exploring** that send fixed opening messages
- [X] T019 [US1] Build `web/src/pages/home/ChatPanel.tsx`: chips before the first message, then history (agent left on `surface-muted`, user right on `accent-soft`), follow-up questions rendered as a list, pinned input row with **Send**, "agent is working" state, error message with **Retry** that loses no message
- [X] T020 [US1] After each agent reply in `ChatPanel.tsx`, refresh the trip so `TripForm.tsx` shows extracted values immediately
- [X] T021 [US1] Render `cards` from agent messages beneath the bubble in `ChatPanel.tsx` using `Provenance` and `CertaintyBadge`

---

## Phase 5: User Story 3 - Trip context persists (Priority: P2)

**Goal**: brief survives navigation, sign-in and new sessions.

**Independent Test**: navigate away and back; sign in; restart the browser; brief and chat restored.

- [X] T022 [US3] Load the current trip and message history on `HomePage.tsx` mount (reuse the stored trip id; Updated 2026-10-13: the user's latest trip is reused only when it is still blank, otherwise a new empty trip is created, so the form is empty after re-login)
- [X] T023 [US3] (superseded 2026-10-13: login comes first, no drafts to claim) Call `POST /api/trips/claim` with the stored `tripKey` right after login or signup in `web/src/pages/login/LoginPage.tsx` flow (or via plan 002's hand-over) and replace the local draft with the claimed trip
- [X] T024 [US3] Implement **Edit in chat** support: `HomePage.tsx` accepts a `tripId` query parameter and loads that trip's brief and messages
- [X] T025 [US3] (no drafts are created any more) Add a scheduled cleanup deleting draft trips idle for 7 days to `api/src/index.ts` (called again by plan 004's scheduler)

---

## Phase 6: User Story 4 - Start a new trip (Priority: P3)

**Goal**: a **New trip** action that opens a blank trip without losing the previous one (signed in).

**Independent Test**: fill part of a trip, choose **New trip**, confirm; form and chat are blank; the first trip is still in the account.

- [X] T030 [US4] Add the **New trip** button (now solid primary, "+ New trip"; Updated 2026-10-13) to the header row of the trip form card in `web/src/pages/home/TripForm.tsx` (title "Trip details" left, button right), disabled while the trip is empty or a chat reply is pending, matching `docs/design/HomeForm.dc.html`
- [X] T031 [US4] Add a confirmation `Modal` in `web/src/pages/home/TripForm.tsx` ("Start a new trip?"): the current trip stays in My trips (no visitor case: login comes first); **Cancel** and **Start new trip** actions
- [X] T032 [US4] Implement `startNewTrip()` in `web/src/pages/home/HomePage.tsx`: call `createTrip()` (stores the new trip id), reset the form state and messages, drop any `?tripId=` parameter, and on failure keep the current trip open and show an error with Retry
- [X] T033 [P] [US4] Update the mobile layout so the button uses the 44 px touch target in the Trip details header, matching frame M2 in `docs/design/Mobile Screens.dc.html`
- [X] T034 [US4] Verify: a signed-in user's previous trip remains retrievable via `GET /api/trips/:id`; reload shows the new trip

---

## Phase 7: Polish

- [X] T026 [P] Verify no response or built asset contains `OLLAMA_*` values (search `web/dist` and network responses)
- [X] T027 Run every step of `specs/003-trip-intake-conversation/quickstart.md`, including the prompt-injection and Ollama-down checks, and fix failures (all steps run against llama3.1:8b, including reload persistence, sign-up hand-over, mobile layout, injection and assistant-down/retry)
- [X] T028 [P] Compare the built home screen with `docs/design/HomeForm.dc.html` and `Mobile Screens.dc.html` frame M2 and fix layout differences
- [X] T029 [P] Run `scripts/check-tokens.sh` and fix any literal colours or px sizes in `web/src/pages/home/`

## Phase 8: Implementation sync (Updated 2026-10-13)

- [X] T035 [US2] Destination country and city dropdowns in `TripForm.tsx` (lists from `/api/places/countries` and `/api/places/cities`, city list follows the country, "Whole country (no city)" option); trips store `dest_city`, `dest_country_name`, `origin_city`, `origin_country_name` (`db/init.sql`, `api/src/trips/service.ts` `settleLocation`)
- [X] T036 [US2] Required-field markers (*), budget validation (positive amount, no minus sign, 2 decimals), children's ages 0-17, and a budget currency that follows the destination country (`api/src/search/countryCurrency.ts`, `/api/places/currencies`) until an amount is saved
- [X] T037 [US1] Fixed-question intake script (`api/src/agent/intake.ts`, `children.ts`, `run.ts`): one question at a time, model used only for fact questions; `missingMinimum` extended with transport and accommodation
- [X] T038 [US3] Login first: no anonymous drafts; empty form after re-login (see T022); New trip creates a blank trip and keeps the previous one in My trips

---

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> Phase 3 (US2) and Phase 4 (US1) (US2 first as MVP; US1 depends on T003-T008) -> Phase 5 -> Phase 6 (US4) -> Phase 7.
- T015 and T016 need plan 004/005/006/007 tool handlers only to expose those tools; the chat works with zero tools registered.
- Plans 004-008 depend on T006-T008.

## Parallel Opportunities

T002; T004, T005, T009; T018 with T015-T017; T026, T028, T029.

## Implementation Strategy

MVP = Phases 1-3: a working form that creates and saves a trip. Then add chat (Phase 4), then persistence (Phase 5).
