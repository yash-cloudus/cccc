import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.surnameGroup.findMany({
      where: { communityId },
      include: { _count: { select: { families: true } }, coordinator: true },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list surname groups");
  }
}

const createSchema = z.object({
  nameEn: z.string().min(1),
  nameGu: z.string().min(1),
  needsReview: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.surnameGroup.create({
      data: {
        communityId,
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu.trim(),
        needsReview: body.needsReview ?? false,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create surname group");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.surnameGroup.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Surname group not found", 404);
    const item = await prisma.surnameGroup.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update surname group");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const inUse = await prisma.family.count({ where: { communityId, surnameGroupId: id } });
    if (inUse > 0) return fail("Cannot delete: families are using this surname", 409);
    const res = await prisma.surnameGroup.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Surname group not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete surname group");
  }
}
