import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

async function assertFamilyMember(communityId: string, id: string) {
  const m = await prisma.familyMember.findFirst({
    where: { id, family: { communityId } },
    select: { id: true, familyId: true },
  });
  if (!m) throw new Error("NOT_FOUND");
  return m;
}

const createSchema = z.object({
  familyId: z.string().min(1),
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional(),
  relation: z.string().optional(),
  mobile: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const body = createSchema.parse(await req.json());
    const family = await prisma.family.findFirst({
      where: { id: body.familyId, communityId },
      select: { id: true },
    });
    if (!family) return fail("Family not found", 404);
    const member = await prisma.familyMember.create({
      data: {
        familyId: body.familyId,
        fullNameEn: body.fullNameEn.trim(),
        fullNameGu: body.fullNameGu?.trim(),
        relation: body.relation?.trim(),
        mobile: body.mobile?.trim() || null,
      },
    });
    return created(member);
  } catch (e) {
    return handleApiError(e, "Failed to add member");
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  fullNameEn: z.string().min(1).optional(),
  fullNameGu: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  isDeceased: z.boolean().optional(),
  isHead: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const { id, ...data } = patchSchema.parse(await req.json());
    const member = await assertFamilyMember(communityId, id);

    // Reassigning head: clear head on all other members of the same family.
    if (data.isHead === true) {
      await prisma.$transaction([
        prisma.familyMember.updateMany({
          where: { familyId: member.familyId },
          data: { isHead: false },
        }),
        prisma.familyMember.update({ where: { id }, data }),
      ]);
    } else {
      await prisma.familyMember.update({ where: { id }, data });
    }
    return ok({ updated: true });
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return fail("Member not found", 404);
    return handleApiError(e, "Failed to update member");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    await assertFamilyMember(communityId, id);
    await prisma.familyMember.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return fail("Member not found", 404);
    return handleApiError(e, "Failed to remove member");
  }
}
