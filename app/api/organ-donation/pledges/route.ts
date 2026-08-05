import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { handleApiError } from "@/lib/admin-guard";
import { OrganError, requireOrganMember, setPledgeStatus } from "@/lib/organ-access";
import { canManageDonor, isOpenStatus } from "@/lib/organ-donation";

const schema = z.object({
  pledgeId: z.string().min(1),
  action: z.enum(["donated", "withdraw"]),
  /** Only field the family is asked for when completing a donation. */
  donatedAt: z.string().date().optional(),
  note: z.string().max(500).optional(),
});

/**
 * PATCH — the donor family marks one organ donated, or withdraws it.
 *
 * Marking donated is deliberately the family's alone: they are the only party
 * who knows the procedure actually happened, and letting a recipient (or an
 * admin acting on hearsay) close it would put unverifiable facts into the
 * community's donation statistics.
 */
export async function PATCH(req: Request) {
  try {
    const { communityId, session, familyId } = await requireOrganMember();
    const { pledgeId, action, donatedAt, note } = schema.parse(await req.json());

    const pledge = await prisma.organPledge.findFirst({
      where: { id: pledgeId, donor: { communityId } },
      select: {
        id: true,
        status: true,
        donor: { select: { familyId: true, createdByUserId: true } },
      },
    });
    if (!pledge) return fail("Organ not found", 404);
    if (!canManageDonor(pledge.donor, { userId: session.sub, familyId })) {
      return fail("Only the donor's family can update this organ", 403);
    }
    if (!isOpenStatus(pledge.status)) return fail("This organ is already closed", 400);

    if (action === "withdraw") {
      await prisma.$transaction(async (tx) => {
        await setPledgeStatus(tx, pledge, "WITHDRAWN", {
          kind: "family",
          userId: session.sub,
          note: note ?? "Withdrawn by the family",
        });
        await tx.organRequest.updateMany({
          where: { pledgeId, status: "PENDING" },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
      });
      return ok({ pledgeId, status: "WITHDRAWN" });
    }

    // A date in the future would be a typo, not a donation.
    const when = donatedAt ? new Date(`${donatedAt}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(when.getTime())) return fail("Invalid donation date", 400);
    if (when.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return fail("The donation date cannot be in the future", 400);
    }

    await prisma.$transaction(async (tx) => {
      await setPledgeStatus(
        tx,
        pledge,
        "DONATED",
        { kind: "family", userId: session.sub, note: note ?? "Marked donated by the family" },
        { donatedAt: when },
      );
      // Anyone still queued on this organ will never get it.
      await tx.organRequest.updateMany({
        where: { pledgeId, status: "PENDING" },
        data: { status: "NOT_SELECTED", respondedAt: new Date() },
      });
    });

    return ok({ pledgeId, status: "DONATED", donatedAt: when.toISOString() });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 400);
    return handleApiError(e, "Failed to update organ");
  }
}
