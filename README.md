# Faro

Faro is a multi-user travel planner: describe a trip in your own words and Faro turns it into destination options, hotel and transport comparisons, a day-by-day itinerary and a budget, then books the hotel and the flight in sandbox / test mode. Every price, availability check and schedule is labelled **Confirmed**, **Estimated** or **Unavailable**, with its source and fetch time.

This is a non-commercial workshop build released under the [MIT licence](LICENSE).

## What you can do

- **Plan a trip** from a form or a friendly chat: destination country and city (dropdowns), dates, travelers (children's ages), budget (its currency follows the country) and preferences.
- **Search in three steps**: Hotels (guests, rooms, room types, accommodation type, budget), Transport (flights, trains, buses, with the start country and city), and Places to visit (the top 10 places with photos, hours and fees). Open the trip plan after choosing at least one place.
- **Trip plan**: a day-by-day itinerary around the chosen places and a budget breakdown, downloadable.
- **Book**: hotels (several rooms and room types, paid with Stripe test mode) and flights (Duffel test mode; each child under 2 needs an adult and dates of birth must fit the age band on the flight day). Trains and buses are never booked. A confirmation email is sent through Gmail when configured.
- **My trips**: a card per trip with status, estimated total, Open, Download and Delete.
- **Look**: four colour themes, photo banners and a faint background photo of the chosen country (lodging pictures on hotel pages, vehicles on transport pages). Screenshots are in `docs/screenshots/`.

## Run it

1. Install Podman (with `podman compose`) and run Ollama on the host with a chat model that supports tools and an embedding model that outputs 768 dimensions.
2. Copy `.env.example` to `.env` and set **all seven** of these before the first start:

   | Variable | What it is |
   |---|---|
   | `OLLAMA_BASE_URL` | Where the API reaches Ollama (from a container often `http://host.containers.internal:11434`) |
   | `OLLAMA_MODEL` | Chat model with tool support |
   | `OLLAMA_EMBED_MODEL` | Embedding model, 768 dimensions (tested with `nomic-embed-text`: `ollama pull nomic-embed-text`) |
   | `LITEAPI_API_KEY` | LiteAPI **sandbox** key |
   | `DUFFEL_ACCESS_TOKEN` (optional) | Duffel **test** token (`duffel_test_...`): sandbox flight offers and test-mode flight booking (paid from the test balance, no real money); unset keeps flights as estimates and nothing bookable |
   | `STRIPE_SECRET_KEY` | Stripe **test** secret key (`sk_test_...`) |
   | `STRIPE_PUBLISHABLE_KEY` | Stripe **test** publishable key (`pk_test_...`) |
   | `DATA_USER_AGENT` | Identifies Faro to public data services, with a contact, for example `Faro/0.1 (you@example.com)` |

   **Reaching Ollama from the containers.** Ollama runs on your host, so `OLLAMA_BASE_URL` must be an address the `api` container can reach. `http://host.containers.internal:11434` works on Linux and macOS. With Podman on Windows (WSL machine) it often resolves but is refused; use the Windows host address instead (find it with `podman machine ssh "ip route show default"`, the address after `via`, for example `http://172.18.0.1:11434`) and make sure Ollama listens on all interfaces (`OLLAMA_HOST=0.0.0.0`). Check from the API container: `podman exec <api-container> node -e "fetch(process.env.OLLAMA_BASE_URL+'/api/tags').then(r=>console.log(r.status))"`.

   Every other variable has a default in `compose.yaml` or is optional (Google sign-in, Gmail confirmation email, admin token). `.env` is git-ignored and must never be committed.
3. Start everything:

   ```bash
   podman compose up --build
   ```

4. Open **http://localhost:8080** (change the port with `WEB_PORT`).

The database schema (`db/init.sql`) is applied automatically on the first start. After changing the schema, recreate the volume: `podman compose down -v`.

Three containers run: `postgres` (PostgreSQL 16 with pgvector), `api` (Node.js 20, Express) and `web` (React 18 build served by nginx, which proxies `/api` to the API so the browser only calls its own origin). Live Stripe keys are refused at start-up.

## Data sources, licences and attribution

Faro uses real data only. If a source returns nothing, the figure is shown as Unavailable.

| Source | Used for | Licence / terms | Attribution |
|---|---|---|---|
| OpenStreetMap (tiles, Nominatim, Overpass) | Maps, geocoding, attractions, opening hours, fees | ODbL; tile and Nominatim usage policies (1 request/second, identifying User-Agent, caching) | © OpenStreetMap contributors |
| Wikivoyage and Wikipedia (MediaWiki API) | Destination guides | CC BY-SA 4.0 | Article title, link and licence shown with each guide excerpt |
| Wikidata | Place facts | CC0 | Credit requested |
| Open-Meteo | Forecast and climate | CC BY 4.0; free API for non-commercial use only | Weather data by Open-Meteo.com |
| Plan file font (Inter) | Text in the downloaded plan PDF | SIL Open Font License 1.1, bundled via the `@fontsource/inter` package | Plan file font (Inter), Copyright The Inter Project Authors |
| Frankfurter | Exchange rates (ECB reference rates) | Terms on frankfurter.dev | Credit ECB via Frankfurter |
| GOV.UK Content API | FCDO foreign travel advice | Open Government Licence v3.0 | Contains public sector information licensed under the Open Government Licence v3.0 |
| Nager.Date | Public holidays | Open source; terms on nagerholidays.com | Credit Nager.Date |
| Transitous (MOTIS) | Train, bus and ferry timetables | Open-source, non-commercial, light-load use; see transitous.org | Link to https://transitous.org/sources/ |
| OSRM public server | Road travel times | Non-commercial, 1 request/second | © OpenStreetMap contributors |
| LiteAPI sandbox | Hotel content, rates, bookings (sandbox only) | LiteAPI terms | Results are marked sandbox |
| Stripe test mode | Payment (test cards only) | Stripe terms | Faro never handles card data |

Several of these public services require **non-commercial** use. The MIT licence covers Faro's code only; a commercial deployment must swap those providers (each sits behind a provider interface, so this does not touch the agent, routes or frontend) and keep third-party attribution. Wikipedia/Wikivoyage text, GOV.UK content and OpenStreetMap data keep their own licences.

## Project layout

```
api/        Express API (TypeScript)
web/        React + Vite + Tailwind frontend
db/         PostgreSQL container and init.sql
compose.yaml
specs/      Feature specifications, plans and tasks
docs/       Design mockups, design system and UI specification
```

All colours, font sizes, radii, shadows and spacing live in `web/tailwind.config.ts`; run `scripts/check-tokens.sh` to confirm component files contain no literal values.
