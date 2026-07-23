import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

const BLOOD = ["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"] as const;

const memberSchema = z.object({
  id: z.string().optional(),
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bloodGroup: z.enum(BLOOD).optional().nullable(),
  occupation: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  isHead: z.boolean().optional(),
});

const putSchema = z.object({
  headNameEn: z.string().min(1).optional(),
  headNameGu: z.string().optional().nullable(),
  surnameEn: z.string().min(1).optional(),
  surnameGu: z.string().optional().nullable(),
  surnameGroupId: z.string().optional(),
  addressEn: z.string().optional(),
  addressGu: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  businessGu: z.string().optional().nullable(),
  nativeElderNameEn: z.string().optional().nullable(),
  nativeElderNameGu: z.string().optional().nullable(),
  nativeElderPhone: z.string().optional().nullable(),
  members: z.array(memberSchema).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Family not found", 404);
    const family = await prisma.family.findFirst({
      where: { id, communityId },
      include: {
        surnameGroup: true,
        villageArea: true,
        familyMembers: true,
        businesses: { include: { category: true, gallery: true } },
      },
    });
    if (!family) return fail("Family not found", 404);
    return ok(family);
  } catch (e) {
    console.error(e);
    return fail("Failed to load family", 500);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();

    const existing = await prisma.family.findFirst({
      where: { id, communityId },
      select: { id: true, familyMembers: { select: { id: true } } },
    });
    if (!existing) return fail("Family not found", 404);

    const { members, surnameGroupId, ...familyData } = putSchema.parse(await req.json());

    // If surname group is being changed, it must belong to this community.
    if (surnameGroupId) {
      const sg = await prisma.surnameGroup.findFirst({
        where: { id: surnameGroupId, communityId },
        select: { id: true },
      });
      if (!sg) return fail("Invalid surname group", 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id },
        data: { ...familyData, ...(surnameGroupId ? { surnameGroupId } : {}) },
      });

      if (members) {
        const keepIds = members.filter((m) => m.id).map((m) => m.id!) as string[];
        // Delete members removed in the editor.
        await tx.familyMember.deleteMany({
          where: { familyId: id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } },
        });
        for (const m of members) {
          const data = {
            fullNameEn: m.fullNameEn,
            fullNameGu: m.fullNameGu ?? null,
            relation: m.relation ?? null,
            mobile: m.mobile ?? null,
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
            bloodGroup: m.bloodGroup ?? null,
            occupation: m.occupation ?? null,
            education: m.education ?? null,
            isHead: m.isHead ?? false,
          };
          if (m.id && existing.familyMembers.some((e) => e.id === m.id)) {
            await tx.familyMember.update({ where: { id: m.id }, data });
          } else {
            await tx.familyMember.create({ data: { ...data, familyId: id } });
          }
        }
      }
    });

    const updated = await prisma.family.findUnique({
      where: { id },
      include: { surnameGroup: true, villageArea: true, familyMembers: { orderBy: { createdAt: "asc" } } },
    });
    return ok(updated);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to update family", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getWritableCommunityId();
    const res = await prisma.family.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Family not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    console.error(e);
    return fail("Failed to delete family", 500);
  }
}
