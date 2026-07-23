import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.committee.findMany({
      where: { communityId },
      include: { _count: { select: { members: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list committees");
  }
}

const createSchema = z.object({
  nameEn: z.string().min(1),
  nameGu: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.committee.create({
      data: {
        communityId,
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu?.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create committee");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.committee.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Committee not found", 404);
    const item = await prisma.committee.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update committee");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    // Members reference committee with onDelete: SetNull, so this is safe.
    const res = await prisma.committee.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Committee not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete committee");
  }
}
