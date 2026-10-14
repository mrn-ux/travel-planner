# Quickstart: My Trips and Plan Downloads

Prerequisites: plans 001–007 running; an account with at least three trips in different states (no destination yet; planned with selections; with a confirmed booking).

## Validate
1. **Auth**: signed out, open `/trips` → `/login`; after sign-in you return to `/trips`.
2. **Cards**: three cards, most recently updated first, three per row on desktop and one on mobile. Each shows title, dates, hotel and transport status lines with dots (hotel dot filled only for the confirmed trip), estimated total with a certainty badge, **Open** and **Download**. The trip without a destination shows "Destination not chosen" and an em dash for missing values.
3. **Open**: **Open** goes to `/trip/<id>` with current data.
4. **Download**: **Download** on a card shows "Preparing your plan", then saves a PDF. Open it: destination and dates, itinerary by day and time of day, selected hotel (with reference for the confirmed trip), transport marked "Compare only", budget breakdown with remaining, certainty labels, footer with generation time and attributions.
5. **Fresh**: change the trip (swap an activity, apply a budget change), download again; the new file reflects it; the two files differ only where the data differs and the generation time is new. No file is stored (`find` the container for `.pdf`: none).
6. **Format**: search the PDF text for `NaN`, `undefined`, `null`, `Invalid Date`: none. Amounts like `USD 1,240.00`, dates `18 Nov 2026`.
7. **Empty sections**: download the trip with no itinerary; the section reads "Not yet available"; the file is still complete.
8. **Planner**: the planner header's **Download** produces the same kind of file as the card.
9. **Empty state**: a new account's `/trips` shows the empty state ("No trips yet — plan your first one" in the original design; the text was reworded 2026-10-13, see step 14) and the button goes to `/`.
10. **Isolation**: as another user, request the first user's `/api/trips/<id>/plan.pdf` → 404 and no file; `GET /api/trips` lists only your own.
11. **Failure**: stop the API mid-download or return 500; the page shows an error with Retry and saves no partial file; repeated rapid clicks produce one download.

### Added 2026-10-13
12. **Hero and cards**: the page opens with the "Your adventures" hero, then the *My trips* heading; cards also show places chosen, the budget (when stated), the hotel room and total, and, for a trip with a booked test flight, "Flight booked" with its reference and a filled dot.
13. **Delete**: a trip with no booking shows **Delete**; confirm in the dialog and the card disappears (`DELETE /api/trips/<id>` returns 204). A trip with a confirmed or pending hotel booking or a booked flight shows "A trip with a booking cannot be deleted." and the API answers 409 `has_booking`.
14. **Empty state**: the text reads "Your travel story starts here..." with a **Plan a trip** button to `/`.
