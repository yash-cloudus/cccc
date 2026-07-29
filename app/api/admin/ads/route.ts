import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { notifyAdDecision } from "@/lib/notifications";

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
  status: z
    .enum(["PENDING", "ACTIVE", "EXPIRED", "REJECTED", "DEACTIVATED", "DRAFT"])
    .optional(),
  rejectReason: z.string().max(500).optional(),
  priority: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  name: z.string().min(2).max(120).optional(),
  pitch: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  linkUrl: z.string().max(500).optional().nullable(),
  ownerName: z.string().max(120).optional().nullable(),
  ownerMobile: z.string().max(20).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  payStatus: z.string().max(40).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = schema.parse(await req.json());
    const existing = await prisma.advertisement.findFirst({
      where: { id: body.id, communityId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        businessId: true,
        status: true,
        type: true,
      },
    });
    if (!existing) return fail("Ad not found", 404);

    const business = existing.businessId
      ? await prisma.business.findUnique({
          where: { id: existing.businessId },
          select: { isApproved: true },
        })
      : null;

    /*
     * Rejecting a paid upgrade must not cost the business the free listing it
     * already earned — the ad falls back to its general state and keeps running,
     * and the member can pay again. A business that was never approved has no
     * listing to fall back to, so there a plain rejection is the right outcome.
     */
    const revertPremium =
      body.status === "REJECTED" && existing.type === "premium" && business?.isApproved === true;

    const item = await prisma.advertisement.update({
      where: { id: body.id },
      data: {
        status: revertPremium ? "ACTIVE" : body.status,
        type: revertPremium ? "general" : undefined,
        // Reason is kept on the reverted row as the record of the failed payment.
        rejectReason: body.status === "REJECTED" ? body.rejectReason : null,
        priority: body.priority,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        name: body.name,
        pitch: body.pitch === undefined ? undefined : body.pitch,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl,
        linkUrl: body.linkUrl === undefined ? undefined : body.linkUrl,
        ownerName: body.ownerName === undefined ? undefined : body.ownerName,
        ownerMobile: body.ownerMobile === undefined ? undefined : body.ownerMobile,
        category: body.category === undefined ? undefined : body.category,
        // Back to a free listing — no payment is outstanding on it any more.
        payStatus: revertPremium ? "notreq" : body.payStatus,
      },
    });

    // Approving a business-linked ad is what publishes that business into
    // the public directory — there is no separate business-approval screen.
    if (body.status === "ACTIVE" && existing.businessId && existing.status !== "ACTIVE") {
      await prisma.business.update({
        where: { id: existing.businessId },
        data: { isApproved: true },
      });
    }

    if (
      (body.status === "ACTIVE" || body.status === "REJECTED") &&
      body.status !== existing.status
    ) {
      await notifyAdDecision(
        {
          name: existing.name,
          ownerId: existing.ownerId,
          businessId: existing.businessId,
          type: existing.type,
        },
        body.status === "ACTIVE" ? "APPROVED" : "REJECTED",
        body.status === "REJECTED" ? body.rejectReason : null,
        revertPremium,
      );
    }

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
