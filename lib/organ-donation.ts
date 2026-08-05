/**
 * Shared Organ Donation helpers — organ labels, status meta, transition rules.
 *
 * Holds no React and no Prisma, so the member client, the admin client and the
 * API routes can all agree on one source of truth (mirrors `lib/result-drive.ts`).
 */

import type { Lang } from "@/lib/i18n/dictionary";

/**
 * Display order on the form and every list — matches the workflow diagram.
 *
 * The tuple is the source of truth and `OrganType` is derived from it, so a
 * `z.enum(ORGAN_TYPES)` in the routes stays exactly typed and adding an organ
 * is a one-line change rather than three that can drift apart.
 */
export const ORGAN_TYPES = [
  "EYES",
  "KIDNEY",
  "LIVER",
  "HEART",
  "LUNG",
  "SKIN",
  "BONE",
  "TISSUE",
] as const;

export type OrganType = (typeof ORGAN_TYPES)[number];

export type OrganDonationType = "LIVING" | "AFTER_DEATH" | "BOTH";

export type OrganStatus =
  | "AVAILABLE"
  | "REQUESTED"
  | "APPROVED"
  | "DONATED"
  | "NOT_DONATED"
  | "WITHDRAWN";

export type OrganRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NOT_SELECTED"
  | "CANCELLED";

const ORGAN_LABELS: Record<OrganType, { en: string; gu: string }> = {
  EYES: { en: "Eyes", gu: "આંખ" },
  KIDNEY: { en: "Kidney", gu: "કિડની" },
  LIVER: { en: "Liver", gu: "લિવર" },
  HEART: { en: "Heart", gu: "હૃદય" },
  LUNG: { en: "Lung", gu: "ફેફસાં" },
  SKIN: { en: "Skin", gu: "ચામડી" },
  BONE: { en: "Bone", gu: "હાડકાં" },
  TISSUE: { en: "Tissue", gu: "ટિશ્યુ" },
};

export const organLabel = (organ: OrganType, lang: Lang) =>
  lang === "gu" ? ORGAN_LABELS[organ].gu : ORGAN_LABELS[organ].en;

const DONATION_TYPE_LABELS: Record<OrganDonationType, { en: string; gu: string }> = {
  LIVING: { en: "Living", gu: "જીવિત" },
  AFTER_DEATH: { en: "After death", gu: "મૃત્યુ પછી" },
  BOTH: { en: "Both", gu: "બંને" },
};

export const donationTypeLabel = (t: OrganDonationType, lang: Lang) =>
  lang === "gu" ? DONATION_TYPE_LABELS[t].gu : DONATION_TYPE_LABELS[t].en;

/** The three choices, in the order every type selector renders them. */
export const DONATION_TYPES = ["LIVING", "AFTER_DEATH", "BOTH"] as const;

/**
 * One donation type describing a whole donor, for the places that show a single
 * value (donor card, admin "Type" column).
 *
 * Derived, never stored: the answer now lives on each organ, and a second copy
 * on the donor would be free to disagree with the one the request flow reads.
 * `MIXED` is the honest answer when the organs differ — collapsing it to any
 * one of them would tell a recipient an organ is claimable today when it isn't.
 * Closed organs are ignored so a completed donation doesn't drag the label of a
 * donor whose remaining organs all say the same thing.
 */
export type OrganDonationSummary = OrganDonationType | "MIXED";

export function donationSummary(
  pledges: { donationType: OrganDonationType; status: OrganStatus }[],
): OrganDonationSummary | null {
  const open = pledges.filter((p) => isOpenStatus(p.status));
  const pool = open.length > 0 ? open : pledges;
  if (pool.length === 0) return null;
  const first = pool[0].donationType;
  return pool.every((p) => p.donationType === first) ? first : "MIXED";
}

export const donationSummaryLabel = (s: OrganDonationSummary, lang: Lang) =>
  s === "MIXED" ? (lang === "gu" ? "મિશ્ર" : "Mixed") : donationTypeLabel(s, lang);

/** Chip colours + label for one pledge status (mirrors `rosterStatusMeta`). */
export function organStatusMeta(
  status: OrganStatus,
  lang: Lang,
): { label: string; bg: string; fg: string } {
  switch (status) {
    case "AVAILABLE":
      return { label: lang === "gu" ? "ઉપલબ્ધ" : "Available", bg: "#E4F5E9", fg: "#1E9E52" };
    case "REQUESTED":
      return { label: lang === "gu" ? "વિનંતી આવી" : "Requested", bg: "#FCEFD6", fg: "#B0801E" };
    case "APPROVED":
      return { label: lang === "gu" ? "મંજૂર" : "Approved", bg: "#DCEBFA", fg: "#1F6FB2" };
    case "DONATED":
      return { label: lang === "gu" ? "દાન થયું" : "Donated", bg: "#EDE4F7", fg: "#6B3FA0" };
    case "NOT_DONATED":
      return { label: lang === "gu" ? "દાન ન થયું" : "Not donated", bg: "#F1EBDE", fg: "#8B8375" };
    case "WITHDRAWN":
      return { label: lang === "gu" ? "પાછું લીધું" : "Withdrawn", bg: "#F1EBDE", fg: "#8B8375" };
  }
}

export function requestStatusMeta(
  status: OrganRequestStatus,
  lang: Lang,
): { label: string; bg: string; fg: string } {
  switch (status) {
    case "PENDING":
      return { label: lang === "gu" ? "બાકી" : "Pending", bg: "#FCEFD6", fg: "#B0801E" };
    case "APPROVED":
      return { label: lang === "gu" ? "મંજૂર" : "Approved", bg: "#E4F5E9", fg: "#1E9E52" };
    case "REJECTED":
      return { label: lang === "gu" ? "નામંજૂર" : "Rejected", bg: "#FCE7E7", fg: "#B0303A" };
    case "NOT_SELECTED":
      return { label: lang === "gu" ? "પસંદ ન થયું" : "Not selected", bg: "#F1EBDE", fg: "#8B8375" };
    case "CANCELLED":
      return { label: lang === "gu" ? "રદ" : "Cancelled", bg: "#F1EBDE", fg: "#8B8375" };
  }
}

/**
 * Can a recipient raise a request against this pledge right now?
 *
 * Reads the ORGAN's own donation type, not the donor's: one member can offer a
 * kidney while living and their eyes only after death, so this has to be decided
 * per organ. An after-death-only organ never can — there is nothing to take
 * while the donor is alive, and once they are gone the family reports the
 * outcome instead. A `BOTH` organ follows the living path until then.
 */
export function canRequest(
  pledge: { status: OrganStatus; donationType: OrganDonationType },
  donorDeceased: boolean,
): boolean {
  if (donorDeceased) return false;
  if (pledge.donationType === "AFTER_DEATH") return false;
  return pledge.status === "AVAILABLE" || pledge.status === "REQUESTED";
}

/** Statuses that still count as "listed" — everything else is history. */
export const OPEN_STATUSES: readonly OrganStatus[] = ["AVAILABLE", "REQUESTED", "APPROVED"];

/** Terminal statuses that feed the completed-donations report. */
export const CLOSED_STATUSES: readonly OrganStatus[] = [
  "DONATED",
  "NOT_DONATED",
  "WITHDRAWN",
];

export const isOpenStatus = (s: OrganStatus) => OPEN_STATUSES.includes(s);

/**
 * Only the household that submitted a donor row may act on it.
 *
 * Kept here rather than inlined in each route so the member UI can grey out the
 * same buttons the server would refuse, and the two can never drift.
 */
export function canManageDonor(
  donor: { createdByUserId: string | null; familyId: string },
  viewer: { userId: string | null; familyId: string | null },
): boolean {
  if (!viewer.userId) return false;
  if (donor.createdByUserId) return donor.createdByUserId === viewer.userId;
  // Rows an admin typed carry no author — fall back to the household, so the
  // family is not locked out of a record that describes one of its own members.
  return Boolean(viewer.familyId) && donor.familyId === viewer.familyId;
}

/* ============================ Shared DTOs ============================ */

/**
 * Flat rows handed from the server pages to both clients. Dates are ISO strings
 * and nothing Prisma-shaped crosses the boundary (see `RosterRow`).
 */
export type OrganPledgeRow = {
  id: string;
  organ: OrganType;
  /** When THIS organ may be taken — the value `canRequest` decides on. */
  donationType: OrganDonationType;
  status: OrganStatus;
  donatedAt: string | null;
  /** Open requests waiting on the family — drives the badge on "My list". */
  pendingRequests: number;
};

export type OrganDonorRow = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  gender: "MALE" | "FEMALE" | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  mobileIso: string;
  city: string | null;
  villageEn: string | null;
  villageGu: string | null;
  familyId: string;
  familyMemberId: string | null;
  familyLabelEn: string;
  familyLabelGu: string | null;
  surnameEn: string;
  surnameGu: string | null;
  isDeceased: boolean;
  deceasedAt: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyMobile: string | null;
  emergencyMobileIso: string;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  pledges: OrganPledgeRow[];
};

export type OrganRequestRow = {
  id: string;
  pledgeId: string;
  organ: OrganType;
  status: OrganRequestStatus;
  requesterUserId: string | null;
  requesterName: string;
  requesterMobile: string | null;
  requesterMobileIso: string;
  patientName: string | null;
  hospital: string | null;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  /** Denormalised so a request row can be rendered without the donor in hand. */
  donorId: string;
  donorName: string;
  donorNameGu: string | null;
};

/** Age in whole years, or null when no date of birth was given. */
export function ageFrom(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export const nameInitial = (name: string) => name.trim()[0]?.toUpperCase() ?? "?";
