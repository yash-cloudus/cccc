import { z } from "zod";
import type { BloodGroupType, CommunityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { created, fail } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { getParivarLockedSurname } from "@/lib/community-defaults";
import { validateFamilyByType, validateHeadMobile } from "@/lib/family-form";

const schema = z.object({
  headNameEn: z.string().min(1),
  headNameGu: z.string().optional().nullable(),
  surnameEn: z.string().optional().nullable(),
  surnameGu: z.string().optional().nullable(),
  surnameGroupId: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  nativePlace: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  addressEn: z.string().optional().nullable(),
  addressGu: z.string().optional().nullable(),
  villageAreaId: z.string().optional().nullable(),
  livesOutsideVillage: z.boolean().optional(),
  nativeElderNameEn: z.string().optional().nullable(),
  nativeElderPhone: z.string().optional().nullable(),
  members: z
    .array(
      z.object({
        fullNameEn: z.string().min(1),
        fullNameGu: z.string().optional().nullable(),
        relation: z.string().optional().nullable(),
        mobile: z.string().optional().nullable(),
        dateOfBirth: z.string().optional().nullable(),
        bloodGroup: z.string().optional().nullable(),
        occupation: z.string().optional().nullable(),
        occupationOther: z.string().optional().nullable(),
        education: z.string().optional().nullable(),
        course: z.string().optional().nullable(),
        currentlyAt: z.string().optional().nullable(),
        hasWhatsApp: z.boolean().optional(),
        isHead: z.boolean().optional(),
      }),
    )
    .min(1),
});

const BLOOD_ENUM: Record<string, BloodGroupType> = {
  "A+": "A_POS",
  "A-": "A_NEG",
  "B+": "B_POS",
  "B-": "B_NEG",
  "O+": "O_POS",
  "O-": "O_NEG",
  "AB+": "AB_POS",
  "AB-": "AB_NEG",
  A_POS: "A_POS",
  A_NEG: "A_NEG",
  B_POS: "B_POS",
  B_NEG: "B_NEG",
  O_POS: "O_POS",
  O_NEG: "O_NEG",
  AB_POS: "AB_POS",
  AB_NEG: "AB_NEG",
};

function parseBlood(raw?: string | null): BloodGroupType | null {
  if (!raw) return null;
  return BLOOD_ENUM[raw] ?? null;
}

async function resolveSurnameGroup(
  communityId: string,
  type: CommunityType,
  surnameGroupId: string | null | undefined,
  surnameEn: string | null | undefined,
  surnameGu: string | null | undefined,
) {
  const locked = type === "PARIVAR" ? await getParivarLockedSurname(prisma, communityId) : null;
  if (locked) {
    return { group: locked, created: false };
  }

  if (surnameGroupId) {
    const byId = await prisma.surnameGroup.findFirst({
      where: { id: surnameGroupId, communityId },
      select: { id: true, nameEn: true, nameGu: true },
    });
    if (byId) return { group: byId, created: false };
  }

  const en = (surnameEn || "").trim();
  if (!en) throw new Error("SURNAME_REQUIRED");
  const gu = (surnameGu?.trim() || en);

  const existing = await prisma.surnameGroup.findFirst({
    where: { communityId, nameEn: { equals: en } },
    select: { id: true, nameEn: true, nameGu: true },
  });
  if (existing) return { group: existing, created: false };

  const group = await prisma.surnameGroup.create({
    data: { communityId, nameEn: en, nameGu: gu, needsReview: false, sortOrder: 0 },
    select: { id: true, nameEn: true, nameGu: true },
  });
  return { group, created: true };
}

/** Admin "add family directly" — bypasses the registration queue (already APPROVED). */
export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const body = schema.parse(await req.json());

    const community = await prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { type: true },
    });

    const typeErr = validateFamilyByType(community.type, {
      headNameEn: body.headNameEn,
      headNameGu: body.headNameGu,
      surnameGroupId: body.surnameGroupId,
      surnameEn: body.surnameEn,
      surnameGu: body.surnameGu,
      addressEn: body.addressEn || " ",
      addressGu: body.addressGu,
      city: body.city,
      nativePlace: body.nativePlace,
      email: body.email,
      villageAreaId: body.villageAreaId,
      livesOutsideVillage: body.livesOutsideVillage,
      nativeElderNameEn: body.nativeElderNameEn,
      nativeElderPhone: body.nativeElderPhone,
    });
    if (typeErr) return fail(typeErr, 422);

    const headMobileErr = validateHeadMobile(body.members);
    if (headMobileErr) return fail(headMobileErr, 422);

    let group;
    let groupCreated = false;
    try {
      const resolved = await resolveSurnameGroup(
        communityId,
        community.type,
        body.surnameGroupId,
        body.surnameEn,
        body.surnameGu,
      );
      group = resolved.group;
      groupCreated = resolved.created;
    } catch {
      return fail("Surname is required", 422);
    }

    const outside = body.livesOutsideVillage || !body.villageAreaId;
    const villageAreaId =
      community.type === "GAM" && !outside && body.villageAreaId
        ? body.villageAreaId
        : null;

    if (villageAreaId) {
      const village = await prisma.villageArea.findFirst({
        where: { id: villageAreaId, communityId },
      });
      if (!village) return fail("Invalid village", 422);
    }

    const family = await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: group.id,
        headNameEn: body.headNameEn.trim(),
        headNameGu: body.headNameGu?.trim() || null,
        surnameEn: group.nameEn,
        surnameGu: group.nameGu,
        addressEn: body.addressEn?.trim() ?? "",
        addressGu: body.addressGu?.trim() || null,
        city: body.city?.trim() || null,
        villageAreaId,
        nativeElderNameEn: body.nativeElderNameEn?.trim() || null,
        nativeElderPhone: body.nativeElderPhone?.trim() || null,
        status: "APPROVED",
        approvedAt: new Date(),
        consentAccepted: true,
        familyMembers: {
          create: body.members.map((m, i) => {
            const isHead = m.isHead ?? i === 0;
            return {
              fullNameEn: m.fullNameEn.trim(),
              fullNameGu: m.fullNameGu?.trim() || null,
              relation: isHead ? "Head" : m.relation || null,
              mobile: m.mobile?.replace(/\D/g, "") || null,
              dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
              bloodGroup: parseBlood(m.bloodGroup),
              occupation: m.occupation || null,
              occupationOther: m.occupationOther || null,
              education: m.education || null,
              course: m.course || null,
              currentlyAt: m.currentlyAt || body.city?.trim() || null,
              hasWhatsApp: m.hasWhatsApp ?? true,
              isHead,
            };
          }),
        },
      },
      include: { familyMembers: true, surnameGroup: true },
    });

    for (const m of family.familyMembers) {
      if (!m.mobile) continue;
      await prisma.user.upsert({
        where: { communityId_mobile: { communityId, mobile: m.mobile } },
        update: { status: "APPROVED" },
        create: { communityId, mobile: m.mobile, status: "APPROVED" },
      });
    }

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
