import type { Prisma } from "@prisma/client";

export const BRAND = {
  nameEn: "Shree Saurashtra Patel Samaj",
  nameGu:
    "\u0AB6\u0ACD\u0AB0\u0AC0 \u0AB8\u0ACC\u0AB0\u0ABE\u0AB7\u0ACD\u0A9F\u0ACD\u0AB0 \u0AAA\u0A9F\u0AC7\u0AB2 \u0AB8\u0AAE\u0ABE\u0A9C",
  shortGu: "\u0AB6\u0ACD\u0AB0\u0AC0",
} as const;

export const COLORS = {
  primary: "#A62A38",
  primaryDark: "#851F2B",
  primaryDeep: "#6E1824",
  gold: "#E0A64B",
  goldLight: "#F3D488",
  amber: "#F0B33A",
  bg: "#FBF8F2",
  bgWarm: "#EDE7DC",
  bgPage: "#E4DACB",
  cream: "#F4EEE3",
  text: "#2A2320",
  muted: "#938C80",
  border: "#F0E9DB",
  whatsapp: "#25A056",
  whatsappDark: "#128C43",
} as const;

export const BLOOD_GROUPS = [
  { type: "A_POS", label: "A+" },
  { type: "A_NEG", label: "A-" },
  { type: "B_POS", label: "B+" },
  { type: "B_NEG", label: "B-" },
  { type: "O_POS", label: "O+" },
  { type: "O_NEG", label: "O-" },
  { type: "AB_POS", label: "AB+" },
  { type: "AB_NEG", label: "AB-" },
] as const;

/** The `Gender` enum, with the bilingual labels every form shows. */
export const GENDERS = [
  { value: "MALE", en: "Male", gu: "પુરુષ" },
  { value: "FEMALE", en: "Female", gu: "સ્ત્રી" },
] as const;

export type GenderValue = (typeof GENDERS)[number]["value"];

/** Relations that state the gender outright. Keep in step with the backfill in
 *  `20260730140000_family_member_gender` — same list, same answers. */
const RELATION_GENDER: Record<string, GenderValue> = {
  husband: "MALE",
  son: "MALE",
  father: "MALE",
  brother: "MALE",
  grandfather: "MALE",
  "son-in-law": "MALE",
  wife: "FEMALE",
  daughter: "FEMALE",
  mother: "FEMALE",
  sister: "FEMALE",
  grandmother: "FEMALE",
  "daughter-in-law": "FEMALE",
};

/**
 * Gender implied by a relation, or undefined when it isn't implied — "Head" and
 * "Other" tell us nothing, so they must still be asked.
 */
export function genderFromRelation(relation?: string | null): GenderValue | undefined {
  return RELATION_GENDER[(relation || "").trim().toLowerCase()];
}

export const REJECT_REASONS = [
  "Incomplete form",
  "Duplicate family",
  "Invalid phone",
  "Needs verification",
] as const;

/**
 * Default household relations, seeded into `DropdownOption(type="relationship")`
 * for every community — new ones on creation, existing ones via a one-off
 * backfill. Without this every community starts with zero relation options,
 * so "Add family directly" / the member editor has nothing to offer beyond
 * the empty placeholder.
 */
export const DEFAULT_RELATIONS: { nameEn: string; nameGu: string }[] = [
  { nameEn: "Head", nameGu: "વડા" },
  { nameEn: "Wife", nameGu: "પત્ની" },
  { nameEn: "Husband", nameGu: "પતિ" },
  { nameEn: "Son", nameGu: "પુત્ર" },
  { nameEn: "Daughter", nameGu: "પુત્રી" },
  { nameEn: "Father", nameGu: "પિતા" },
  { nameEn: "Mother", nameGu: "માતા" },
  { nameEn: "Brother", nameGu: "ભાઈ" },
  { nameEn: "Sister", nameGu: "બહેન" },
  { nameEn: "Grandfather", nameGu: "દાદા" },
  { nameEn: "Grandmother", nameGu: "દાદી" },
  { nameEn: "Daughter-in-law", nameGu: "પુત્રવધૂ" },
  { nameEn: "Son-in-law", nameGu: "જમાઈ" },
  { nameEn: "Other", nameGu: "અન્ય" },
];

type RelationTx = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

/** Seed default relationship options for a community (idempotent by nameEn). */
export async function seedRelationshipDefaults(tx: RelationTx, communityId: string) {
  for (const [i, r] of DEFAULT_RELATIONS.entries()) {
    const existing = await tx.dropdownOption.findFirst({
      where: { communityId, type: "relationship", nameEn: r.nameEn },
      select: { id: true },
    });
    if (existing) continue;
    await tx.dropdownOption.create({
      data: {
        communityId,
        type: "relationship",
        nameEn: r.nameEn,
        nameGu: r.nameGu,
        sortOrder: i,
        isActive: true,
      },
    });
  }
}

export const ADMIN_NAV: {
  key: string;
  href: string;
  label: string;
  /** Key into the badge counts map (see getAdminNavBadges) — omit for no badge. */
  badge?: "queue" | "ads";
}[] = [
  { key: "dash", href: "/admin", label: "Dashboard" },
  { key: "queue", href: "/admin/queue", label: "Registration queue", badge: "queue" },
  { key: "families", href: "/admin/families", label: "Families & Members" },
  { key: "drop", href: "/admin/dropdowns", label: "Dropdown lists" },
  { key: "gallery", href: "/admin/gallery", label: "Event Gallery" },
  { key: "news", href: "/admin/news", label: "News" },
  { key: "ads", href: "/admin/ads", label: "Advertisements", badge: "ads" },
  { key: "info", href: "/admin/info", label: "Community info" },
  { key: "results", href: "/admin/results", label: "Result drive" },
  { key: "organ", href: "/admin/organ-donation", label: "Organ donation" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
  { key: "admins", href: "/admin/admins", label: "Admins & roles" },
];

export const COOKIE_ACCESS = "samaj_access";
export const COOKIE_REFRESH = "samaj_refresh";
export const COOKIE_ACTIVE_COMMUNITY = "active_community";
export const LANG_KEY = "samajLang";

// Roles that may access the Community Admin panel
export const COMMUNITY_ADMIN_ROLES = [
  "OWNER",
  "DATA_MANAGER",
  "CONTENT_MANAGER",
  "MODERATOR",
  "ADMIN",
] as const;

export const PLATFORM_ROLE = "PLATFORM_ADMIN";

// Brand-color palettes offered in the Main Admin "Create app" flow
export const PRIMARY_COLORS = ["#A62A38", "#1E7A54", "#2A5FA0", "#7A3DA0", "#B0601E", "#0E7C86"] as const;
export const SECONDARY_COLORS = ["#E8A33D", "#E0A62B", "#4E9C6B", "#C24450", "#5865F2", "#2A2620"] as const;

// Root domain for URLs:
//   Main Admin:     {ROOT_DOMAIN}                 e.g. community.in
//   Website:        {slug}.{ROOT_DOMAIN}          e.g. saurashtra_patel.community.in
//   Community Admin: admin.{slug}.{ROOT_DOMAIN}   e.g. admin.saurashtra_patel.community.in
// Local: set NEXT_PUBLIC_ROOT_DOMAIN=localhost → uses *.localhost:3000
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "community.in";

// Ad banners a member may keep on the home screen (pending + active) at once.
// The premium banner price/duration live in Admin → Settings → Advertisements
// (see `lib/admin-settings.ts` `getAdPriceTiers`), not as a fixed constant here.
export const MAX_BANNERS_PER_MEMBER = 3;
