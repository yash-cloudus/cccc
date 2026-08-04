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
