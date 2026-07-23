import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

function slugify(v: string): string {
  return (v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.businessCategory.findMany({
      where: { communityId },
      include: { _count: { select: { businesses: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list business categories");
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
    const base = slugify(body.nameEn) || "category";
    // Ensure slug is unique within the community.
    let slug = base;
    let n = 1;
    while (await prisma.businessCategory.findFirst({ where: { communityId, slug } })) {
      slug = `${base}-${n++}`;
    }
    const item = await prisma.businessCategory.create({
      data: {
        communityId,
        nameEn: body.nameEn.trim(),
        nameGu: body.nameGu.trim(),
        slug,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create business category");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.businessCategory.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Category not found", 404);
    const item = await prisma.businessCategory.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update business category");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.businessCategory.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Category not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete business category");
  }
}
