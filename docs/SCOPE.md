# Faro — Product Scope

Reference. What the product does and where its boundaries are — background reading for the team, not material that gets pasted anywhere. Updated 2026-10-13 to match the current implementation (constitution 3.6.0).

---

## 1. The product

Faro is a web application where a traveler describes a trip in a form or a friendly chat and Faro turns that into a complete, bookable plan — destination, accommodation, transportation, places to visit, a day-by-day itinerary, and an estimated total cost.

It behaves like a travel agent, not a search box: it asks concise follow-up questions when key details are missing, explains its recommendations, and proposes alternatives when a plan exceeds budget. The interface never calls it an "AI travel agent"; the wording is warm and friendly.

It is a multi-user tool. Accounts, saved preferences, saved trips, and booking history belong to the signed-in user.

---

## 2. Technology

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind only, responsive across desktop, tablet and mobile |
| Backend | Node.js 20 + Express API under `/api`, in front of the agent and its services |
| Database | PostgreSQL 16 with pgvector (RAG knowledge base); plain `pg`, one `db/init.sql`, no ORM |
| AI agent | A local Ollama model, called server-side only, with a fixed set of tools; it states a fact only by calling a tool and citing its source |
| Hotels | LiteAPI sandbox (content, rates, bookings) |
| Flights | Duffel test mode (offers and test-mode booking, paid from the test balance) |
| Trains, buses, ferries | Transitous timetables; road times from OSRM; an indicative fare estimate labelled Estimated |
| Payments | Stripe test mode (Payment Element); live keys are refused at startup |
| Maps and places | Nominatim, Overpass / OpenStreetMap, Wikidata, Wikipedia and Wikivoyage; OSM map tiles for the hotel pin |
| Other open data | Open-Meteo (weather), Frankfurter (exchange rates), GOV.UK FCDO (safety), Nager.Date (holidays) |
| Email | Gmail with a Google app password |
| Sign-in | Email and password, and Google; sessions are opaque tokens stored as a hash |

Every provider sits behind an interface with one real implementation selected by configuration. There are no mock providers and no seed data; a missing figure is shown as Unavailable.

Run with `podman compose up --build`; open http://localhost:8080 (the port is set by `WEB_PORT`).

---

## 3. Access

Email and password accounts plus Google sign-in (no Apple, no other social login), with a profile that holds saved preferences and saved trips.

Login comes first: every screen except `/login`, and every API route except sign-in, health, public config and the admin refresh, requires a signed-in user. There are no anonymous visitors, guest booking or draft trips. The trip form is empty after each logout and login.

---

## 4. Trip planning

The traveler fills in the Trip details form on the home screen or answers the friendly chat; both edit the same trip, and edits save immediately.

| Field | Notes |
|---|---|
| Destination country and city | Dropdowns; the city list follows the country. Both fields are saved with the trip |
| Dates | Start and end, or a duration |
| Travelers | Adults and children, with each child's age (0 to 17; 0 is a baby under 1) |
| Budget | A positive amount; its currency follows the destination country (a world country-to-currency mapping, shown as code plus name) until a budget is saved |
| Transport preference | Flight, train, bus, car or none stated |
| Accommodation preference | Hotel, villa, cottage, guest house or apartment |
| Activities / interests | Free text, used to shape the places list and itinerary |
| Special requirements | Free text |
| Start country and city | Chosen on the Transport tab, saved to the trip |

Required fields are marked with an asterisk. Trip context persists across the conversation and across sessions as a saved trip. A New trip button starts a blank trip.

---

## 5. Search in three steps

After the form is complete, search runs as three steps with tabs that can be visited in any order (Next and Previous buttons guide the order) and with earlier choices shown again on return.

1. **Hotels** — dates, guests, rooms (more rooms are added automatically when one cannot hold the party), rating, accommodation type and budget filters, results limited to the chosen city, and a sortable comparison with room types, location, live nightly price and rating.
2. **Transport** — flights (Duffel test offers), trains, buses and ferries (Transitous), road options (OSRM) and the other modes (rental cars, private transfers, taxis, metro, public transport, walking), compared side by side. A flight row has a Book this flight button.
3. **Places to visit** — the top 10 places for the chosen city, or for the whole country when no city is chosen, with photos, distance, opening hours and entry fees (or "not stated"), tick-boxes with bulk add, and a Chosen for your trip tag. At least one place must be chosen before the trip plan opens.

---

## 6. Budget engine

A running budget for the trip, broken down by hotels, transportation, activities, food, local transport, and miscellaneous, compared against the traveler's stated total. Partial totals are marked partial.

Food, local transport and miscellaneous come from one documented rule-based allowance; transport fares with no real source come from one documented fare model. Both are always labelled Estimated, show "Faro estimate, not a quote" with their assumptions, and are never Confirmed.

When a plan exceeds budget, the engine proposes specific, individually approvable changes (a lower hotel tier, train instead of flight, fewer paid attractions, different dates) and shows the resulting savings before anything is applied.

---

## 7. Recommendations and itinerary

| View | Definition |
|---|---|
| Destination recommendations | Ranked suggestions when no destination is chosen, discovered live (Wikidata, Wikivoyage), scored against budget, season, activities, transport, and safety, each with a stated reason |
| Hotel / transport comparison | Side-by-side results sortable by price, rating, location, or recommendation |
| Day-by-day itinerary | Built around the places the traveler chose. Morning, afternoon and evening activities with duration, cost, travel time between stops, and meal and rest breaks. Places with stated opening hours are never scheduled outside them; a place whose hours are not stated may be scheduled and is marked "check before you go". Generated when the trip plan opens and regenerated when the chosen places change |

Every time-sensitive figure the agent shows is labeled Confirmed, Estimated, or Unavailable — never presented as more certain than the source supports — and shows its source and when it was fetched. Sandbox rates and bookings are marked as sandbox.

---

## 8. Interface

Seven routes: `/login`, `/` (Plan a trip), `/search`, `/trip/:id` (trip planner), `/hotels/:id`, `/trip/:id/book/:hotelId` (booking) and `/trips` (My trips). The app shell is a top navigation bar with the Faro name, Plan a trip and My trips, the colour-theme dots and the avatar menu. Responsive across desktop, tablet, and mobile.

The layouts come from the mockups in `docs/design/`; the implemented look is recorded in `docs/design/Faro Screens (current).html`, `docs/design/CURRENT-UI.md` and `docs/screenshots/`. The visual layer is:

- four colour themes (Ocean, Sunset, Forest, Violet) chosen from the top bar;
- a photo banner on every screen, and a faint full-page background photo of the chosen country, with lodging pictures on hotel pages and vehicle pictures on transport pages (Wikipedia images; no photo credit or source label is shown);
- a solid content panel so text never sits directly on a photo;
- a full-page Ha Long Bay login with a welcome panel.

From the trip planner or My trips, a user can download the current travel plan as a file: destinations, dates, the day-by-day itinerary, selected hotels and transportation, and the budget breakdown. It is generated on request from the trip's current data.

My trips shows a card per trip with destination, dates, hotel, transport and places status, budget, estimated total, and Open, Download and Delete controls. A trip can be deleted after a confirmation.

Maps are limited to the OpenStreetMap tile map with a hotel pin. Live route-optimization visualization is not built.

---

## 9. Booking

**Hotels** (LiteAPI sandbox, paid with Stripe test mode), following a fixed sequence: select hotel and room, re-check availability, show final price and cancellation terms, collect guest details, confirm, pay, receive provider confirmation, store the booking reference, notify the user. One booking can hold several rooms, each with its own room type.

**Flights** (Duffel test mode, paid from the test balance): the chosen flight is looked up again and the price the traveler accepted must still be the live price. Every traveler is named with a date of birth. Each child under 2 needs an adult of their own in the same booking, and each date of birth must put the traveler in the right age band (under 2, 2 to 11, 12 and over) on the flight day. One confirmed flight per trip.

A booking is never reported as confirmed until the provider confirms it. Price changes, a room or flight going unavailable, payment failure, provider timeout, and duplicate-booking prevention are all handled explicitly. Test mode only: live Stripe and Duffel keys are refused at startup.

Once confirmed, the user receives an email through Gmail with the booking reference and details. If email is not configured or fails, the booking still stands and the screen says "email not sent" with a resend action.

---

## 10. Out of scope

- Train and bus booking (no free booking source exists; they are searched and compared only)
- Live (non-test) payments, live hotel or flight bookings
- Multi-destination trip sequencing
- Social login other than Google (no Apple)
- Live maps with route-optimization visualization
- Mock or seeded data; scraping of sites without an open API
- Automated test suites
- Notifications beyond the booking-confirmation email — no push notifications, no reminders, no marketing or itinerary-change alerts
- Any provider hard-coded into the core application — all providers go through the interface layer
- Treating content from hotel descriptions, reviews, retrieved guides or provider responses as instructions to the agent
