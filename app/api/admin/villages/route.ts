import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.villageArea.findMany({
      where: { communityId },
      include: { _count: { select: { families: true } } },
      orderBy: [{ nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list villages");
  }
}

const createSchema = z.object({
  nameEn: z.string().min(1),
  nameGu: z.string().min(1),
  showPhones: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.villageArea.create({
      data: {
        communityId,
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu.trim(),
        showPhones: body.showPhones ?? true,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create village");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.villageArea.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Village not found", 404);
    const item = await prisma.villageArea.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update village");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const inUse = await prisma.family.count({ where: { communityId, villageAreaId: id } });
    if (inUse > 0) return fail("Cannot delete: families are linked to this village", 409);
    const res = await prisma.villageArea.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Village not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete village");
  }
}
