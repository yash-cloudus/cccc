import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { handleApiError } from "@/lib/admin-guard";
import { OrganError, loadManageableDonor, requireOrganMember, setPledgeStatus } from "@/lib/organ-access";
import { isOpenStatus } from "@/lib/organ-donation";

const schema = z.object({
  donorId: z.string().min(1),
  deceasedAt: z.string().date(),
  /**
   * Exactly which pledged organs were actually retrieved. Anything the family
   * leaves unticked is closed as NOT_DONATED — the donor has died, so an organ
   * that was not used then can never be donated later, and leaving it
   * AVAILABLE would keep offering it on the browse list.
   */
  donatedPledgeIds: z.array(z.string().min(1)),
  donatedAt: z.string().date().optional(),
  note: z.string().max(500).optional(),
});

/**
 * POST — the family reports that a donor has passed away.
 *
 * This is the only path an AFTER_DEATH pledge can be completed by: there is no
 * request/approve step to hang it on, and no one but the household is in a
 * position to know.
 */
export async function POST(req: Request) {
  try {
    const { communityId, session, familyId } = await requireOrganMember();
    const body = schema.parse(await req.json());

    const donor = await loadManageableDonor(communityId, body.donorId, {
      userId: session.sub,
      familyId,
    });
    if (donor.isDeceased) return fail("This donor is already reported deceased", 400);

    const died = new Date(`${body.deceasedAt}T00:00:00.000Z`);
    if (Number.isNaN(died.getTime())) return fail("Invalid date", 400);
    if (died.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return fail("The date cannot be in the future", 400);
    }
    const donatedOn = body.donatedAt ? new Date(`${body.donatedAt}T00:00:00.000Z`) : died;

    const open = donor.pledges.filter((p) => isOpenStatus(p.status));
    const wanted = new Set(body.donatedPledgeIds);
    const unknown = body.donatedPledgeIds.filter(
      (id) => !open.some((p) => p.id === id),
    );
    if (unknown.length) return fail("One of the selected organs is not on this donor", 400);

    await prisma.$transaction(async (tx) => {
      await tx.organDonor.update({
        where: { id: donor.id },
        data: { isDeceased: true, deceasedAt: died },
      });

      for (const p of open) {
        const donated = wanted.has(p.id);
        await setPledgeStatus(
          tx,
          p,
          donated ? "DONATED" : "NOT_DONATED",
          {
            kind: "family",
            userId: session.sub,
            note:
              body.note ??
              (donated ? "Donated after death" : "Not retrieved — reported with the death"),
          },
          { donatedAt: donated ? donatedOn : null },
        );
      }

      // Nothing pending can still be answered once the donor has died.
      await tx.organRequest.updateMany({
        where: { pledge: { donorId: donor.id }, status: "PENDING" },
        data: { status: "NOT_SELECTED", respondedAt: new Date() },
      });

      // Keep the directory honest too, when the donor is still a live member row.
      if (donor.familyMemberId) {
        await tx.familyMember.updateMany({
          where: { id: donor.familyMemberId, isDeceased: false },
          data: { isDeceased: true },
        });
      }
    });

    return ok({
      donorId: donor.id,
      donated: open.filter((p) => wanted.has(p.id)).length,
      notDonated: open.filter((p) => !wanted.has(p.id)).length,
    });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 404);
    return handleApiError(e, "Failed to record the report");
  }
}
