import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

const schema = z.object({
  headNameEn: z.string().min(1),
  headNameGu: z.string().optional(),
  surnameEn: z.string().min(1),
  surnameGu: z.string().optional(),
  /** Optional — if missing/invalid, match or create from surnameEn/Gu */
  surnameGroupId: z.string().optional(),
  city: z.string().optional(),
  addressGu: z.string().optional(),
});

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
        addressEn: "",
        addressGu: body.addressGu?.trim(),
        city: body.city?.trim(),
        status: "APPROVED",
        approvedAt: new Date(),
        consentAccepted: true,
        familyMembers: {
          create: {
            fullNameEn: body.headNameEn.trim(),
            fullNameGu: body.headNameGu?.trim(),
            relation: "Head",
            isHead: true,
          },
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
