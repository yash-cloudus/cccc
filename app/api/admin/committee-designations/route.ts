import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.committeeDesignation.findMany({
      where: { communityId },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list designations");
  }
}

const createSchema = z.object({
  nameEn: z.string().min(1),
  nameGu: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.committeeDesignation.create({
      data: {
        communityId,
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create designation");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.committeeDesignation.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Designation not found", 404);
    const item = await prisma.committeeDesignation.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update designation");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.committeeDesignation.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Designation not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete designation");
  }
}
