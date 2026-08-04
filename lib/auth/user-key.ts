import { DEFAULT_ISO, digitsOf } from "@/lib/phone";

/**
 * The composite key a `User` is unique on: community, country, number.
 *
 * Defined once because it is the login identity — eleven call sites each
 * spelling out the same three fields is eleven chances to leave the country off
 * and quietly look up the wrong person. The ISO defaults to India so a caller
 * that genuinely has no country (a legacy path, a seed) still resolves to the
 * rows that already exist.
 */
export function userKey(communityId: string, mobile: string, mobileIso?: string | null) {
  return {
    communityId_mobileIso_mobile: {
      communityId,
      mobileIso: (mobileIso || DEFAULT_ISO).toLowerCase(),
      mobile: digitsOf(mobile),
    },
  };
}
