import { fail, getClientIp, ok } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import cities from "@/lib/nri-data/world-cities.json";

/**
 * City suggestions for a country, for the NRI question.
 *
 * Server-side on purpose. The dataset is ~47,000 cities — 250 KB gzipped — and
 * shipping that to a phone so someone can type "Leicester" would cost more than
 * the whole rest of the page. Read here, answered 25 at a time, and the client
 * bundle never grows.
 *
 * Public (under /api/public, which middleware allowlists) because family
 * registration is public: the person filling the form has no session yet. It
 * holds no community data — it is a reference list, the same for every tenant.
 *
 * Data: simplemaps.com World Cities, CC BY 4.0. Attribution lives in
 * lib/nri-data/README.md; keep it if the file is ever regenerated.
 */
const BY_ISO = cities as Record<string, string[]>;
const LIMIT = 25;

export async function GET(req: Request) {
  // Static data, but still a public endpoint doing string work on 47k rows.
  if (!rateLimit(`nricity:${getClientIp(req)}`, 60, 60_000).allowed) {
    return fail("Too many requests", 429);
  }

  const url = new URL(req.url);
  const iso = (url.searchParams.get("iso") || "").trim().toLowerCase();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) return fail("iso is required");

  const all = BY_ISO[iso];
  if (!all) return ok({ cities: [] });

  // No query: the country's biggest cities, which is how the file is ordered —
  // the common case is someone living in one of them.
  if (!q) return ok({ cities: all.slice(0, LIMIT) });

  // Prefix matches first: typing "man" should offer Manchester before Osmanabad.
  const starts: string[] = [];
  const contains: string[] = [];
  for (const city of all) {
    const lower = city.toLowerCase();
    if (lower.startsWith(q)) starts.push(city);
    else if (lower.includes(q)) contains.push(city);
    if (starts.length >= LIMIT) break;
  }
  return ok({ cities: [...starts, ...contains].slice(0, LIMIT) });
}
