import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.infoSection.findMany({
      where: { communityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list info sections");
  }
}

const createSchema = z.object({
  titleEn: z.string().min(1),
  titleGu: z.string().optional(),
  bodyEn: z.string().optional(),
  bodyGu: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.infoSection.create({
      data: {
        communityId,
        titleEn: body.titleEn.trim(),
        titleGu: body.titleGu?.trim(),
        bodyEn: body.bodyEn,
        bodyGu: body.bodyGu,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create info section");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.infoSection.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Info section not found", 404);
    const item = await prisma.infoSection.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update info section");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.infoSection.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Info section not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete info section");
  }
}
