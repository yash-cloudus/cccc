import { z } from "zod";
import type { BloodGroupType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { created } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

const schema = z.object({
  headNameEn: z.string().min(1),
  headNameGu: z.string().optional(),
  surnameEn: z.string().min(1),
  surnameGu: z.string().optional(),
  /** Optional — if missing/invalid, match or create from surnameEn/Gu */
  surnameGroupId: z.string().optional(),
  city: z.string().optional(),
  addressEn: z.string().optional(),
  addressGu: z.string().optional(),
  nativeElderNameEn: z.string().optional(),
  email: z.string().optional(),
  /** Household members added alongside the head in the same dialog. */
  members: z
    .array(
      z.object({
        fullNameEn: z.string().min(1),
        fullNameGu: z.string().optional(),
        relation: z.string().optional(),
        mobile: z.string().optional(),
        dateOfBirth: z.string().optional(),
        bloodGroup: z.string().optional(),
      }),
    )
    .optional(),
});

/** "A+" → BloodGroupType enum member; anything unrecognised is dropped. */
const BLOOD_ENUM: Record<string, BloodGroupType> = {
  "A+": "A_POS",
  "A-": "A_NEG",
  "B+": "B_POS",
  "B-": "B_NEG",
  "O+": "O_POS",
  "O-": "O_NEG",
  "AB+": "AB_POS",
  "AB-": "AB_NEG",
};

async function resolveSurnameGroup(
  communityId: string,
  surnameGroupId: string | undefined,
  surnameEn: string,
  surnameGu: string | undefined,
) {
  if (surnameGroupId) {
    const byId = await prisma.surnameGroup.findFirst({
      where: { id: surnameGroupId, communityId },
      select: { id: true, nameEn: true, nameGu: true },
    });
    if (byId) return { group: byId, created: false };
  }

  const en = surnameEn.trim();
  const gu = (surnameGu?.trim() || en);

  const existing = await prisma.surnameGroup.findFirst({
    where: { communityId, nameEn: { equals: en } },
    select: { id: true, nameEn: true, nameGu: true },
  });
  if (existing) return { group: existing, created: false };

  const group = await prisma.surnameGroup.create({
    data: {
      communityId,
      nameEn: en,
      nameGu: gu,
      needsReview: false,
      sortOrder: 0,
    },
    select: { id: true, nameEn: true, nameGu: true },
  });
  return { group, created: true };
}

/** Admin "add family directly" — bypasses the registration queue (already APPROVED). */
export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const body = schema.parse(await req.json());

    const { group, created: groupCreated } = await resolveSurnameGroup(
      communityId,
      body.surnameGroupId,
      body.surnameEn,
      body.surnameGu,
    );

    const family = await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: group.id,
        headNameEn: body.headNameEn.trim(),
        headNameGu: body.headNameGu?.trim(),
        surnameEn: body.surnameEn.trim(),
        surnameGu: body.surnameGu?.trim(),
        addressEn: body.addressEn?.trim() ?? "",
        addressGu: body.addressGu?.trim(),
        city: body.city?.trim(),
        nativeElderNameEn: body.nativeElderNameEn?.trim(),
        status: "APPROVED",
        approvedAt: new Date(),
        consentAccepted: true,
        familyMembers: {
          create: [
            {
              fullNameEn: body.headNameEn.trim(),
              fullNameGu: body.headNameGu?.trim(),
              relation: "Head",
              isHead: true,
            },
            ...(body.members ?? []).map((m) => ({
              fullNameEn: m.fullNameEn.trim(),
              fullNameGu: m.fullNameGu?.trim(),
              relation: m.relation || null,
              mobile: m.mobile || null,
              dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
              bloodGroup: BLOOD_ENUM[m.bloodGroup ?? ""] ?? null,
              isHead: false,
            })),
          ],
        },
      },
      include: { familyMembers: true, surnameGroup: true },
    });

    return created({
      id: family.id,
      headNameEn: family.headNameEn,
      headNameGu: family.headNameGu,
      surnameEn: family.surnameEn,
      surnameGu: family.surnameGu,
      city: family.city,
      members: family.familyMembers.length,
      surnameGroup: group,
      surnameGroupCreated: groupCreated,
    });
  } catch (e) {
    return handleApiError(e, "Failed to create family");
  }
}
