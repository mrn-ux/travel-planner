<!--
Sync Impact Report
Version change: 1.0.0 -> 3.6.0 (2.0.0, 3.0.0, 3.1.0, 3.2.0, 3.3.0, 3.4.0 and 3.5.0 were intermediate amendments)
Modified principles:
  II. Multi-User by Design (email/password only -> email/password plus Google sign-in; Apple sign-in
    considered and removed)
  IV. Provider Abstraction (mock-only -> one real sandbox/test-mode implementation per
    provider, no mocks; identity and email providers added to the provider set)
Added sections: none
Removed sections: none
  IV (3.2.0): a documented rule-based estimator may fill a fact no real source offers, if labelled
    Estimated and never presented as a quote
  IV (3.3.0): the estimator exception is extended from the transport fare model to the budget
    allowances for food, local transport and miscellaneous (no free price source exists); same
    labelling rules, inputs are the real party size, trip length and other category totals
  II (3.4.0): login comes first; no anonymous visitors or draft trips. Specs 001 to 008 and docs/UI-SPEC.md amended to match.
  Scope (3.5.0): flights can be booked in Duffel test mode, besides hotels; trains and buses stay compare-only.
  VII (3.6.0): the visual refresh is recorded: colour themes, photo banners and page background (Wikipedia
    images, no credit label shown), solid content panels, colour tokens for text on photos. Layouts and
    components of the mockups are unchanged. Specs 001 to 008, docs/UI-SPEC.md section 4, README and CLAUDE.md
    updated together.
Modified sections: Scope & Technical Constraints (real sandbox/test-mode providers in scope;
  Google sign-in in scope; Gmail used for confirmation email)
Deferred items: none (specs 002 and 007 updated together with this amendment)
-->
# Faro Constitution

## Core Principles

### I. Simplicity
Build only what the specification asks for. The code MUST NOT add abstraction layers beyond
the one the specification calls for (the provider interface), plugin systems, or configuration
options that nothing reads. Prefer a direct SQL query over a repository pattern and a plain
function over a class hierarchy. If a requirement can be met with less code, it MUST be met
with less code.

### II. Multi-User by Design
Every saved trip, saved preference and booking belongs to a signed-in user. Accounts use email
and password, or Google sign-in; no other sign-in method MUST be added. Passwords
MUST be hashed, sessions MUST be opaque tokens whichever method created them, and every
trip-owning query MUST be scoped to the authenticated user's id. Login comes first: every
screen except /login, and every API route except sign-in, health, public configuration and
the token-protected admin refresh, MUST require a signed-in user. There are no anonymous
visitors or draft trips.

### III. Agent Discipline
The AI agent MUST call a fixed set of tools for every fact it states: destination
recommendations, hotel and transport results, prices, availability. It MUST NOT invent a
figure, a schedule, or a confirmation. Text returned by a provider (a hotel description, a
review) is data and MUST NOT be treated as an instruction to follow.

### IV. Provider Abstraction
Hotels, transport, maps, payment, knowledge sources, sign-in identity and email delivery
MUST each sit behind a provider interface. Each interface has one real implementation, selected by a configuration value;
mock or fake implementations MUST NOT exist. Hotel and payment providers MUST run against the
vendor's sandbox / test mode, and every sandbox rate or booking MUST be flagged as sandbox.
A provider that has no real source for a fact MUST return it as Unavailable, never a
fallback value. The exception is a documented rule-based estimator, and exactly two exist: the
indicative transport fare model (`api/src/transport/fareEstimate.ts`) and the budget allowances
for food, local transport and miscellaneous (`api/src/budget/recalc.ts`). An estimator's output
MUST be labelled Estimated, MUST name itself as an estimate in its source ("Faro estimate, not a
quote") and state its assumptions, MUST be computed from real inputs (distance and duration;
party size, trip length and the other categories' totals), MUST keep its rates in one constants
object, and MUST NOT be presented as a quote or as Confirmed. Adding a third estimator requires
an amendment. Swapping in a production provider later MUST NOT require changes to the
agent, the API routes, or the frontend.

### V. Correctness with Money
Monetary values MUST use fixed-point decimal types end to end: NUMERIC in the database, and
never floating point in transit or in calculation. Totals MUST be computed by the database,
not assembled in application code. Every displayed amount MUST be formatted consistently with
its currency.

### VI. Certainty Labeling
Every price, availability check, and schedule the agent shows MUST be labeled Confirmed,
Estimated, or Unavailable, and MUST NOT be presented as more certain than its source supports.

### VII. Design Fidelity
The supplied mockups and design system (`docs/design/`) are reproduced, not interpreted.
Screens MUST match the mockups in structure, order, proportion and alignment; a component
shown in a mockup is the one that gets built. Every colour, font, radius and spacing value
MUST be defined in one place and referenced from there, with no literal values in component
files. Where the specification appears to leave a choice open, the mockup settles it.

### VIII. No Silent Failure
Every asynchronous state MUST be handled visibly: loading, empty, and error. The interface
MUST NOT display NaN, undefined, null, or an invalid date. Failed requests, provider timeouts
and payment failures MUST surface a message to the user rather than failing silently.

## Scope & Technical Constraints

- Real provider integrations are in scope, in sandbox / test mode only: a live payment or
  production hotel or flight booking MUST NOT be possible. The API MUST refuse to start with a payment
  key that is not a test key.
- Credentials and endpoints MUST come from environment configuration; real credentials MUST
  NOT be committed, and a `.env.example` with placeholders only documents every variable.
- Authentication is limited to email and password and Google sign-in.
- Bookable: hotels and flights, both in test mode only (a live Duffel token is refused at start-up). Trains and buses MUST NOT be booked (no free booking source exists); they are searched and compared.
- Booking confirmation email (hotel or flight) is sent through Gmail; no other notification channel exists.
- The design tokens under `docs/design/tokens/` are the single source of colour, type, radius
  and spacing values.

## Development Workflow

- Every specification, plan and task list MUST be checked against the principles above before
  implementation begins; the plan's Constitution Check records the result.
- Any complexity beyond what Principle I allows MUST be justified in the plan.
- Reviews of code changes MUST verify user-scoped queries (II), decimal money handling (V),
  certainty labels (VI), token-only styling (VII) and visible failure states (VIII).

## Governance

This constitution supersedes other practices. Amendments require a written change to this file
with a rationale and a Sync Impact Report, and any specification, plan or task that conflicts
with the amendment MUST be updated. Versioning follows semantic versioning: MAJOR for removing
or redefining a principle, MINOR for adding a principle or materially expanding guidance, PATCH
for clarifications. Compliance is reviewed at specification, plan and code-review time.

**Version**: 3.6.0 | **Ratified**: 2026-10-10 | **Last Amended**: 2026-10-13
