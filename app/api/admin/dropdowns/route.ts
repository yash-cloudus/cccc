import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const type = new URL(req.url).searchParams.get("type") || undefined;
    const items = await prisma.dropdownOption.findMany({
      where: { communityId, ...(type ? { type } : {}) },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list dropdown options");
  }
}

const createSchema = z.object({
  type: z.string().min(1),
  nameEn: z.string().min(1),
  nameGu: z.string().min(1),
  needsReview: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    const item = await prisma.dropdownOption.create({
      data: {
        communityId,
        type: body.type.trim(),
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu.trim(),
        needsReview: body.needsReview ?? false,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create dropdown option");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.dropdownOption.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Option not found", 404);
    const item = await prisma.dropdownOption.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update dropdown option");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.dropdownOption.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Option not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete dropdown option");
  }
}
