import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { handleApiError, requireAdmin } from "@/lib/admin-guard";
import { getOrganDonors, getOrganRequests, getOrganStats } from "@/lib/tenant-data";
import { setPledgeStatus } from "@/lib/organ-access";
import { DONATION_TYPES, ORGAN_TYPES, isOpenStatus } from "@/lib/organ-donation";

/** One pledged organ and when it may be taken — the type rides with the organ. */
const pledgeSchema = z.object({
  organ: z.enum(ORGAN_TYPES),
  donationType: z.enum(DONATION_TYPES),
});

const WRITE_ROLES = ["OWNER", "DATA_MANAGER", "ADMIN"] as const;

/**
 * GET — everything the admin screen shows.
 *
 * There is no verification queue here: a member's submission is live the moment
 * it is made, and this panel exists to correct and report on it, not to approve
 * it. Requests come back read-only — only the donor's family may answer those.
 */
export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const [donors, requests, stats] = await Promise.all([
      getOrganDonors(communityId),
      getOrganRequests(communityId),
      getOrganStats(communityId),
    ]);
    return ok({ donors, requests, stats });
  } catch (e) {
    return handleApiError(e, "Failed to load organ donation data");
  }
}

const createSchema = z.object({
  familyMemberId: z.string().min(1),
  organs: z.array(pledgeSchema).min(1),
  emergencyName: z.string().max(120).optional(),
  emergencyRelation: z.string().max(60).optional(),
  emergencyMobile: z.string().max(20).optional(),
  emergencyMobileIso: z.string().length(2).optional(),
  note: z.string().max(2000).optional(),
});

/** POST — an admin types in a donor a family reported off-app. */
export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin([...WRITE_ROLES]);
    const body = createSchema.parse(await req.json());

    const member = await prisma.familyMember.findFirst({
      where: { id: body.familyMemberId, family: { communityId } },
      select: {
        id: true,
        familyId: true,
        fullNameEn: true,
        fullNameGu: true,
        relation: true,
        gender: true,
        dateOfBirth: true,
        bloodGroup: true,
        mobile: true,
        mobileIso: true,
        family: { select: { city: true } },
      },
    });
    if (!member) return fail("Member not found", 404);

    const existing = await prisma.organDonor.findFirst({
      where: { communityId, familyMemberId: member.id },
      select: { id: true },
    });
    if (existing) return fail("This member is already registered as a donor", 409);

    const donor = await prisma.organDonor.create({
      data: {
        communityId,
        familyId: member.familyId,
        familyMemberId: member.id,
        // No author: an admin-typed row falls back to household ownership so the
        // family is not locked out of a record describing one of its own (see
        // `canManageDonor`).
        createdByUserId: null,
        fullNameEn: member.fullNameEn,
        fullNameGu: member.fullNameGu,
        relation: member.relation,
        gender: member.gender,
        dateOfBirth: member.dateOfBirth,
        bloodGroup: member.bloodGroup,
        mobile: member.mobile,
        mobileIso: member.mobileIso,
        city: member.family.city,
        emergencyName: body.emergencyName ?? null,
        emergencyRelation: body.emergencyRelation ?? null,
        emergencyMobile: body.emergencyMobile ?? null,
        emergencyMobileIso: body.emergencyMobileIso ?? "in",
        consentAccepted: true,
        consentSignature: null,
        note: body.note ?? null,
        pledges: {
          create: Array.from(new Map(body.organs.map((o) => [o.organ, o])).values()).map((o) => ({
            organ: o.organ,
            donationType: o.donationType,
          })),
        },
      },
      select: { id: true },
    });

    return created({ id: donor.id });
  } catch (e) {
    return handleApiError(e, "Failed to add donor");
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  organs: z.array(pledgeSchema).min(1).optional(),
  emergencyName: z.string().max(120).nullable().optional(),
  emergencyRelation: z.string().max(60).nullable().optional(),
  emergencyMobile: z.string().max(20).nullable().optional(),
  emergencyMobileIso: z.string().length(2).optional(),
  mobile: z.string().max(20).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

/**
 * PATCH — corrections only.
 *
 * Note what is absent: no status field. An admin cannot mark an organ donated
 * or approve a request from here — those belong to the donor's family, and a
 * panel that could forge them would make the completed-donation figures
 * meaningless.
 */
export async function PATCH(req: Request) {
  try {
    const { communityId, session } = await requireAdmin([...WRITE_ROLES]);
    const { id, organs, ...rest } = updateSchema.parse(await req.json());

    const donor = await prisma.organDonor.findFirst({
      where: { id, communityId },
      include: { pledges: true },
    });
    if (!donor) return fail("Donor not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.organDonor.update({
        where: { id },
        data: {
          ...(rest.emergencyName !== undefined ? { emergencyName: rest.emergencyName } : {}),
          ...(rest.emergencyRelation !== undefined
            ? { emergencyRelation: rest.emergencyRelation }
            : {}),
          ...(rest.emergencyMobile !== undefined ? { emergencyMobile: rest.emergencyMobile } : {}),
          ...(rest.emergencyMobileIso ? { emergencyMobileIso: rest.emergencyMobileIso } : {}),
          ...(rest.mobile !== undefined ? { mobile: rest.mobile } : {}),
          ...(rest.city !== undefined ? { city: rest.city } : {}),
          ...(rest.note !== undefined ? { note: rest.note } : {}),
        },
      });

      if (!organs) return;
      const want = new Map(organs.map((o) => [o.organ, o.donationType]));

      for (const p of donor.pledges) {
        if (want.has(p.organ) || !isOpenStatus(p.status)) continue;
        await setPledgeStatus(tx, p, "WITHDRAWN", {
          kind: "admin",
          userId: session.sub,
          note: "Removed by an admin",
        });
        await tx.organRequest.updateMany({
          where: { pledgeId: p.id, status: "PENDING" },
          data: { status: "CANCELLED", respondedAt: new Date() },
        });
      }

      for (const [organ, donationType] of want) {
        const prev = donor.pledges.find((p) => p.organ === organ);
        if (!prev) {
          await tx.organPledge.create({ data: { donorId: id, organ, donationType } });
          continue;
        }
        // A closed organ records what actually happened — not editable here.
        if (!isOpenStatus(prev.status) && prev.status !== "WITHDRAWN") continue;

        if (prev.donationType !== donationType) {
          await tx.organPledge.update({ where: { id: prev.id }, data: { donationType } });
          // Same retraction rule as the member route: narrowing to after-death
          // only means nobody can still be queued waiting to receive it now.
          if (donationType === "AFTER_DEATH") {
            await tx.organRequest.updateMany({
              where: { pledgeId: prev.id, status: "PENDING" },
              data: { status: "CANCELLED", respondedAt: new Date() },
            });
          }
        }

        if (prev.status === "WITHDRAWN") {
          await setPledgeStatus(tx, prev, "AVAILABLE", {
            kind: "admin",
            userId: session.sub,
            note: "Re-added by an admin",
          });
        }
      }
    });

    return ok({ id });
  } catch (e) {
    return handleApiError(e, "Failed to update donor");
  }
}

/** DELETE — remove a record entered in error. */
export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin([...WRITE_ROLES]);
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());

    const donor = await prisma.organDonor.findFirst({
      where: { id, communityId },
      select: { id: true, pledges: { select: { status: true } } },
    });
    if (!donor) return fail("Donor not found", 404);
    if (donor.pledges.some((p) => p.status === "DONATED")) {
      return fail("This record has a completed donation and cannot be deleted", 400);
    }

    await prisma.organDonor.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleApiError(e, "Failed to delete donor");
  }
}
