import type { PrismaClient } from "@prisma/client";
import { COUNTRIES, countryByName } from "@/lib/phone";

/**
 * NRI countries and cities as dropdown masters.
 *
 * The country is a `DropdownOption` row whose `nameEn` is a name from
 * `lib/phone/countries.ts` — the admin picks it from that list rather than
 * typing it, so the NRI directory and the phone picker never disagree about
 * whether the place is called "USA" or "United States", and the flag comes free.
 *
 * Cities hang off the country as children, the same shape occupation already
 * uses for its sub-types. Which cities matter is local knowledge; the country
 * list is not.
 */
export const NRI_COUNTRY_TYPE = "nri_country";

export type NriCityOption = { country: string; city: string };

/** Every admin-added city, flattened to (country, city) for the member forms. */
export async function getNriCities(
  prisma: PrismaClient,
  communityId: string,
): Promise<NriCityOption[]> {
  const countries = await prisma.dropdownOption.findMany({
    where: { communityId, type: NRI_COUNTRY_TYPE, parentId: null, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      },
    },
  });
  return countries.flatMap((c) =>
    c.children.map((city) => ({ country: c.nameEn, city: city.nameEn })),
  );
}

/** Country names an admin has already added, for the masters screen. */
export async function getNriCountries(prisma: PrismaClient, communityId: string) {
  return prisma.dropdownOption.findMany({
    where: { communityId, type: NRI_COUNTRY_TYPE, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { children: true } } },
  });
}

/**
 * Rejects a country the fixed list does not know, so a typo cannot create a
 * second spelling that the directory then groups separately.
 */
export function isKnownCountry(name: string): boolean {
  return countryByName(name) !== null;
}

/** Countries not yet added, for the "add country" picker. */
export function countriesNotYetAdded(existing: string[]): typeof COUNTRIES {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  return COUNTRIES.filter((c) => !taken.has(c.name.toLowerCase()));
}

/**
 * Records the countries and cities families actually used, so the masters
 * describe the community instead of waiting for someone to type them in.
 *
 * The alternative was asking every admin to pre-enter Toronto, Brampton,
 * Leicester… before anyone abroad could register — the list would always lag
 * behind reality, and the NRI screen would show cities that exist nowhere in
 * the masters. A member typing a city they live in IS the authoritative answer.
 *
 * Idempotent and case-insensitive; never throws. This is bookkeeping, and a
 * family's registration must not fail because a master row could not be
 * written.
 */
export async function syncNriOptions(
  prisma: PrismaClient,
  communityId: string,
  entries: { isNri?: boolean; nriCountry?: string | null; nriCity?: string | null }[],
): Promise<void> {
  try {
    // Only known countries: a typo must never create a second spelling that the
    // directory then groups separately.
    const used = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!e.isNri) continue;
      const country = countryByName(e.nriCountry ?? "")?.name;
      if (!country) continue;
      const city = (e.nriCity ?? "").trim();
      if (!used.has(country)) used.set(country, new Set());
      if (city) used.get(country)!.add(city);
    }
    if (used.size === 0) return;

    for (const [country, cities] of used) {
      let parent = await prisma.dropdownOption.findFirst({
        where: { communityId, type: NRI_COUNTRY_TYPE, parentId: null, nameEn: country },
        select: { id: true },
      });
      if (!parent) {
        parent = await prisma.dropdownOption.create({
          data: {
            communityId,
            type: NRI_COUNTRY_TYPE,
            parentId: null,
            nameEn: country,
            // No Gujarati name to derive from — the admin can rename it later.
            nameGu: country,
          },
          select: { id: true },
        });
      }

      if (cities.size === 0) continue;
      const existing = await prisma.dropdownOption.findMany({
        where: { communityId, type: NRI_COUNTRY_TYPE, parentId: parent.id },
        select: { nameEn: true },
      });
      const have = new Set(existing.map((c) => c.nameEn.trim().toLowerCase()));
      const missing = [...cities].filter((c) => !have.has(c.toLowerCase()));
      if (missing.length === 0) continue;
      await prisma.dropdownOption.createMany({
        data: missing.map((city) => ({
          communityId,
          type: NRI_COUNTRY_TYPE,
          parentId: parent!.id,
          nameEn: city,
          nameGu: city,
        })),
      });
    }
  } catch (e) {
    console.error("syncNriOptions failed", e);
  }
}
