import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { fetchJson } from '../http.js';
import { hotelProvider } from '../providers/index.js';
import { currencyMap, currencyOfCountry } from '../search/countryCurrency.js';

export const placesRouter = Router();

/** The countries and cities Faro can search hotels in, from the hotel provider's own lists (so every pick can be searched). */
placesRouter.get('/places/countries', async (_req, res, next) => {
  try {
    const r = await hotelProvider().listCountries();
    if (!r.ok) throw new AppError(r.reason === 'timeout' ? 504 : 502, 'The country list is unavailable right now.');
    res.json({ countries: r.data });
  } catch (err) {
    next(err);
  }
});

placesRouter.get('/places/cities', async (req, res, next) => {
  try {
    const { country } = z.object({ country: z.string().length(2) }).parse(req.query);
    const r = await hotelProvider().listCities(country.toUpperCase());
    if (!r.ok) throw new AppError(r.reason === 'timeout' ? 504 : 502, 'The city list is unavailable right now.');
    res.json({ cities: r.data });
  } catch (err) {
    next(err);
  }
});

/**
 * A wide photo for a destination page: the lead image of the Wikipedia article of that name (free licences; the page that credits the
 * author is linked). Null when there is none: the page then shows a plain banner. Cached for 30 days.
 */
placesRouter.get('/places/destination-photo', async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(req.query);
    const params = new URLSearchParams({ action: 'query', titles: name, redirects: '1', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '1400', format: 'json' });
    const r = await fetchJson<{ query?: { pages?: Record<string, { title: string; thumbnail?: { source: string; width: number; height: number } }> } }>(
      `https://en.wikipedia.org/w/api.php?${params.toString()}`,
      { provider: 'wikimedia', ttlMs: 30 * 24 * 3600 * 1000, timeoutMs: 8000, minSpacingMs: 150 },
    );
    // Flags, maps and logos are not photos: only a photograph is used as a banner or background.
    const isPhoto = (u: string): boolean => !/(\.svg|flag_of|_map|locator|coat_of_arms|logo|\.png)/i.test(u);
    const page = r.ok ? Object.values(r.body.query?.pages ?? {}).find((p) => p.thumbnail && isPhoto(p.thumbnail.source.split('?')[0] ?? '')) : undefined;
    res.json({ photo: page?.thumbnail ? { url: page.thumbnail.source, creditUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, title: page.title } : null });
  } catch (err) {
    next(err);
  }
});

/** The currency a country uses, for the budget field. */
placesRouter.get('/places/currency', async (req, res, next) => {
  try {
    const { country } = z.object({ country: z.string().length(2) }).parse(req.query);
    res.json({ currency: await currencyOfCountry(country) });
  } catch (err) {
    next(err);
  }
});

/** Every country with its currency: the budget field switches to the chosen country's currency from this mapping. */
placesRouter.get('/places/currencies', async (_req, res, next) => {
  try {
    res.json({ currencies: await currencyMap() });
  } catch (err) {
    next(err);
  }
});
