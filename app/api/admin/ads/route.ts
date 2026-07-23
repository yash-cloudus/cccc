import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.advertisement.findMany({
      where: { communityId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list ads");
  }
}

const schema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "ACTIVE", "EXPIRED", "REJECTED"]).optional(),
  priority: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = schema.parse(await req.json());
    const existing = await prisma.advertisement.findFirst({
      where: { id: body.id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Ad not found", 404);
    const item = await prisma.advertisement.update({
      where: { id: body.id },
      data: {
        status: body.status,
        priority: body.priority,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update ad");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.advertisement.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Ad not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to delete ad");
  }
}
