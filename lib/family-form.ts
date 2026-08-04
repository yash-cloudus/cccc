import type { CommunityType } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_ISO, countryOrDefault, digitsOf, isValidNumber } from "@/lib/phone";

export const bloodEnum = z.enum([
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
]);

export const memberInputSchema = z.object({
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bloodGroup: bloodEnum.optional().nullable(),
  occupation: z.string().optional().nullable(),
  occupationOther: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  course: z.string().optional().nullable(),
  currentlyAt: z.string().optional().nullable(),
  hasWhatsApp: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  isHead: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isDeceased: z.boolean().optional(),
});

export const familyDetailsSchema = z.object({
  headNameEn: z.string().min(1),
  headNameGu: z.string().optional().nullable(),
  surnameGroupId: z.string().optional().nullable(),
  surnameEn: z.string().optional().nullable(),
  surnameGu: z.string().optional().nullable(),
  addressEn: z.string().min(1),
  addressGu: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  nativePlace: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  villageAreaId: z.string().optional().nullable(),
  livesOutsideVillage: z.boolean().optional(),
  nativeElderNameEn: z.string().optional().nullable(),
  nativeElderNameGu: z.string().optional().nullable(),
  nativeElderPhone: z.string().optional().nullable(),
  nativeElderIso: z.string().optional().nullable(),
  consentAccepted: z.boolean().optional(),
});

export type FamilyDetailsInput = z.infer<typeof familyDetailsSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;

export function validateFamilyByType(
  type: CommunityType,
  details: FamilyDetailsInput,
): string | null {
  if (type === "PARIVAR") {
    if (!details.city?.trim()) return "City is required";
  } else {
    const outside = details.livesOutsideVillage || !details.villageAreaId;
    if (outside && !details.city?.trim()) {
      return "City is required when living outside the village";
    }
    if (!outside && !details.villageAreaId) {
      return "Village is required";
    }
    if (!details.surnameGroupId && !details.surnameEn?.trim()) {
      return "Surname is required";
    }
  }
  return null;
}

/** OTP communities: the head's number *is* the household's login. */
export function validateHeadMobile(
  members: { mobile?: string | null; mobileIso?: string | null; isHead?: boolean }[],
): string | null {
  const head = members.find((m) => m.isHead) ?? members[0];
  // Per country, not a fixed ten digits — an NRI head's number is theirs.
  if (!isValidNumber(head?.mobile ?? "", head?.mobileIso || DEFAULT_ISO)) {
    const c = countryOrDefault(head?.mobileIso);
    return `Head mobile is required (a valid ${c.name} number)`;
  }
  return null;
}

/**
 * MOBILE_PASSWORD communities: any member may hold the login, so the head's
 * number is optional — but the household still needs exactly one real, chosen
 * number.
 *
 * The "must belong to a member" check is not cosmetic. `POST /api/families` is
 * public, so without it a caller could name any number and have a `User` row
 * created for someone who is in no family — which the approval cascade (which
 * walks `family.familyMembers`) would then never reach.
 */
export function validateLoginMobile(
  members: { mobile?: string | null; mobileIso?: string | null }[],
  loginMobile: string | null | undefined,
  loginMobileIso?: string | null,
): string | null {
  const digits = digitsOf(loginMobile);
  const iso = (loginMobileIso || DEFAULT_ISO).toLowerCase();
  if (!isValidNumber(digits, iso)) {
    return `Pick a login mobile (a valid ${countryOrDefault(iso).name} number)`;
  }
  // Country too: two members can hold the same digits under different countries,
  // and only one of them is the account being created.
  const match = members.some(
    (m) => digitsOf(m.mobile) === digits && (m.mobileIso || DEFAULT_ISO).toLowerCase() === iso,
  );
  if (!match) return "The login mobile must belong to one of the members";
  return null;
}

/* ══════════════════ shared client form model ══════════════════ */

/**
 * The family-details block, shared by the member "પરિવાર નોંધણી" wizard and the
 * admin "Add family directly" modal. Field names match the API payload so both
 * sides can hand this object straight to `familyDetailsToPayload`.
 */
export type FamilyDetailsValues = {
  surnameGroupId: string;
  surnameEn: string;
  surnameGu: string;
  addressEn: string;
  addressGu: string;
  city: string;
  villageAreaId: string;
  livesOutsideVillage: boolean;
  nativeElderNameEn: string;
  nativeElderNameGu: string;
  nativeElderPhone: string;
  /** Country of nativeElderPhone. */
  nativeElderIso: string;
  /** Captured by the "નકશા પર સ્થળ" button; null until the member pins a spot. */
  latitude: number | null;
  longitude: number | null;
};

export function blankFamilyDetails(
  partial: Partial<FamilyDetailsValues> = {},
): FamilyDetailsValues {
  return {
    surnameGroupId: "",
    surnameEn: "",
    surnameGu: "",
    addressEn: "",
    addressGu: "",
    city: "",
    villageAreaId: "",
    livesOutsideVillage: false,
    nativeElderNameEn: "",
    nativeElderNameGu: "",
    nativeElderPhone: "",
    nativeElderIso: DEFAULT_ISO,
    latitude: null,
    longitude: null,
    ...partial,
  };
}

/**
 * Family-level place, derived from where the HEAD member lives.
 *
 * Location is collected per member (households span villages and cities), but
 * `Family.city` / `Family.villageAreaId` still drive the directory, the queue's
 * city filter and the families table. The head's pick is the household's
 * address of record; a pick that matches no village is simply an outside city,
 * which is exactly what "lives outside the village" used to mean.
 */
export function familyPlaceFromHead(
  headPlace: string,
  villages: { id: string; nameEn: string; nameGu: string | null }[],
): { city: string; villageAreaId: string | null; livesOutsideVillage: boolean } {
  const place = headPlace.trim();
  if (!place) return { city: "", villageAreaId: null, livesOutsideVillage: false };
  const village = villages.find(
    (v) => v.nameEn.trim().toLowerCase() === place.toLowerCase() || v.nameGu?.trim() === place,
  );
  return village
    ? { city: place, villageAreaId: village.id, livesOutsideVillage: false }
    : { city: place, villageAreaId: null, livesOutsideVillage: true };
}

/** Trim + drop empties so blank optional fields are stored as NULL, not "". */
export function familyDetailsToPayload(v: FamilyDetailsValues) {
  const t = (s: string) => s.trim() || undefined;
  return {
    surnameGroupId: v.surnameGroupId || undefined,
    surnameEn: t(v.surnameEn),
    surnameGu: t(v.surnameGu),
    addressEn: v.addressEn.trim(),
    addressGu: t(v.addressGu),
    city: t(v.city),
    villageAreaId: v.livesOutsideVillage ? null : v.villageAreaId || null,
    livesOutsideVillage: v.livesOutsideVillage,
    nativeElderNameEn: t(v.nativeElderNameEn),
    nativeElderNameGu: t(v.nativeElderNameGu),
    nativeElderPhone: t(v.nativeElderPhone),
    nativeElderIso: v.nativeElderIso || DEFAULT_ISO,
    latitude: v.latitude ?? undefined,
    longitude: v.longitude ?? undefined,
  };
}
