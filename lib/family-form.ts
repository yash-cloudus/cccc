import type { CommunityType } from "@prisma/client";
import { z } from "zod";

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

export function validateHeadMobile(
  members: { mobile?: string | null; isHead?: boolean }[],
): string | null {
  const head = members.find((m) => m.isHead) ?? members[0];
  const mobile = head?.mobile?.replace(/\D/g, "") ?? "";
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return "Head mobile is required (10 digits, starts with 6–9)";
  }
  return null;
}
