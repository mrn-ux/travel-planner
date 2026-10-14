# Quickstart: Destination Recommendations and Knowledge Base

Prerequisites: plans 001–003 running; Ollama with both models; internet access to the public data APIs; a trip brief with no destination (dates, adults, budget, transport, accommodation) created via `/`; signed in (login first). Updated 2026-10-13: Home's Destination country dropdown sets a destination, so start the trip with the chat chip **Recommend somewhere for me** and leave the country empty; the band appears when the trip has no destination.

## Validate
1. **Embedding dimension**: on first ingestion the API logs the probe vector length; with a non-768 embedding model it refuses and shows an error (no rows written).
2. **Recommendations on an empty knowledge base**: with `knowledge_chunks` empty and `WARMUP_DESTINATIONS=0`, choose **Recommend somewhere for me**, fill the minimum fields, **See results**. Within about 10 seconds `/search` shows at least 3 ranked cards marked "Refining..." with reasons for budget, season, activities, transport and safety (budget and transport read "Could not be assessed" / Unavailable; season, activities and safety carry values), and a score bar; estimated figures carry the Estimated badge. Within about 60 seconds the list updates in place to the refined version (rank changes highlighted) and `trip_recommendations.completeness = 'full'`. Repeat the request: it returns in under 3 seconds from caches.
2b. **Warm-up**: restart with `WARMUP_DESTINATIONS=30`; `knowledge_chunks` fills in the background without delaying start-up; a later first request skips the wait for ingested destinations.
2c. **Failed refinement**: block the MediaWiki host during refinement; the quick list stays marked "Based on limited data"; no invented destinations.
3. **Citations**: open a card's detail or the agent's chat answer; guide-derived text shows source, link and CC BY-SA credit.
4. **Choose**: select the second card; the destination appears on the trip and the Hotels/Transport band replaces the recommendation band.
5. **Re-rank**: change the dates, interests or transport preference on the form; the list regenerates (a budget change also regenerates but the budget reason stays Unavailable). **View alternatives** excludes the dismissed destinations.
6. **Unavailable factor** (budget and transport are always unavailable; this checks the others): block the GOV.UK host (for example with a hosts entry); regenerate; safety reasons say "could not be assessed" with Unavailable; no invented advisory.
7. **Dedupe**: re-run ingestion for the same destination; chunk count is unchanged and `fetched_at` advances; the embed endpoint is not called for unchanged text (check Ollama logs).
8. **Expiry**: set `expires_at` of some chunks to the past; `search_knowledge` returns them marked estimated.
9. **Scheduler**: set `REFRESH_CRON` to every minute; expired chunks of destinations in saved trips are refreshed. `curl -X POST -H "X-Admin-Token: …" /api/admin/refresh` triggers it once; with `ADMIN_TOKEN` unset it returns 404.
10. **No rates in the KB**: `SELECT DISTINCT source FROM knowledge_chunks` contains none of the hotel or transport providers.
11. **Prompt injection**: if a guide chunk contains an instruction (insert one manually), the agent does not follow it.
