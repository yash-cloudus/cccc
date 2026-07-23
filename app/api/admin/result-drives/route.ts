import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.resultDrive.findMany({
      where: { communityId },
      include: { _count: { select: { entries: true } } },
      orderBy: { year: "desc" },
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list result drives");
  }
}

const createSchema = z.object({
  titleEn: z.string().min(1),
  titleGu: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  isOpen: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const body = createSchema.parse(await req.json());
    const item = await prisma.resultDrive.create({
      data: {
        communityId,
        titleEn: body.titleEn.trim(),
        titleGu: body.titleGu?.trim(),
        year: body.year,
        isOpen: body.isOpen ?? true,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create result drive");
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  titleEn: z.string().optional(),
  titleGu: z.string().optional(),
  year: z.number().int().optional(),
  isOpen: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.resultDrive.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Result drive not found", 404);
    const item = await prisma.resultDrive.update({ where: { id }, data });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update result drive");
  }
}
