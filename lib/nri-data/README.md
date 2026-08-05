# World cities

`world-cities.json` — every country's cities, keyed by ISO-3166 alpha-2 and
ordered by population, so the first suggestion is the one most people mean.

Used only by `app/api/public/nri-cities/route.ts`, which answers 25 at a time.
**Do not import it from a client component.** It is ~580 KB (250 KB gzipped);
bundling it would cost more than the rest of the registration page put together,
for a field most families never open.

## Source and licence

[simplemaps.com World Cities Basic](https://simplemaps.com/data/world-cities),
licensed **CC BY 4.0** — attribution is required and is why this file exists.
Data © simplemaps.com, used under CC BY 4.0.

Trimmed to the 193 countries in `lib/phone/countries.ts` (Palestine has no rows
in the source), de-duplicated by name per country keeping the largest, and
stripped to names only — the app never uses the coordinates or population
beyond the ordering.

## Regenerating

Only if the source is updated. From the workbook's `city` / `iso2` /
`population` columns, group by lowercase `iso2`, drop duplicate names keeping
the highest population, sort each country by population descending, and write
`{ "<iso2>": ["City", …] }` with no whitespace. Then re-trim to the ISO codes in
`lib/phone/countries.ts` so the two lists cannot disagree.
