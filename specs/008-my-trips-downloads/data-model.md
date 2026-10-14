# Data Model: My Trips and Plan Downloads

## Entities

- **Trip card** (read model): the summary of one saved trip for the My trips grid.
- **Plan data** (read model): everything the PDF needs for one trip at the moment of the request.

No new tables, no stored files. (Updated 2026-10-13: the list also reads `flight_bookings` and `trip_places`.) Both read models are assembled by SQL from tables owned by other plans.

## Read model: Trip card

| Field | Source |
|---|---|
| `tripId`, `title`, `destination`, `startDate`, `endDate`, `budget` (amount and currency the traveler stated) | `trips` |
| `hotel.status` (`not_booked`, `pending`, `confirmed`, `failed`), `hotel.name`, `hotel.room`, `hotel.total` | latest non-`in_progress` `bookings` row for the trip (a confirmed one first), else the selected hotel in `trip_hotels` |
| `transport.status` (`compare_only`, `not_selected`), `label`, `price` (with certainty and `sandbox`), `bookingReference` | `trip_transport`; `bookingReference` from the trip's confirmed `flight_bookings` row (Updated 2026-10-13) |
| `places` (count and names) | `trip_places` (Updated 2026-10-13) |
| `estimatedTotal`, `currency`, `certainty`, `partial` | `trip_budget_totals(trip_id)` and `trip_budget_summary(trip_id)` (plan 006) |
| `updatedAt` | `trips.updated_at` (sort key, descending) |

## Read model: Plan data

Trip brief fields (destination, dates, travelers, budget) + selected hotel and transport (plan 005) + latest booking summary (plan 007) + itinerary days/items (plan 006) + budget summary/totals (plan 006). Every price keeps its currency, certainty and source.

## Rules

- Rows are returned only where `trips.user_id` equals the authenticated user; draft trips (`status = 'draft'`, no longer created) are excluded from the list.
- Deleting (Updated 2026-10-13): `DELETE /api/trips/:id` removes the user's trip and its dependent rows (cascade) unless it has a `bookings` row that is `confirmed` or `pending` (or `refund_pending`), or a confirmed `flight_bookings` row; then 409 `has_booking`.
- Amounts are decimal strings straight from SQL; the renderer only formats them.
- A missing value renders an em dash; a missing section renders "Not yet available".

## DDL fragment (008)

None. `db/init.sql` gains nothing from this plan.

## Suggested index (optional, only if listing is slow)

```sql
-- Already covered by trips_user_idx (user_id, updated_at DESC) from plan 003 and bookings_trip_idx from plan 007; flight_bookings_one_confirmed (trip_id) serves the flight lookup.
```
