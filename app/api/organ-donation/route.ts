import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { handleApiError } from "@/lib/admin-guard";
import { getOrganDonors } from "@/lib/tenant-data";
import {
  OrganError,
  loadManageableDonor,
  requireOrganMember,
  requireOrganModule,
  setPledgeStatus,
} from "@/lib/organ-access";
import { DONATION_TYPES, ORGAN_TYPES, isOpenStatus } from "@/lib/organ-donation";

const organEnum = z.enum(ORGAN_TYPES);
const donationTypeEnum = z.enum(DONATION_TYPES);

/**
 * One pledged organ and when it may be taken. The type rides with the organ
 * rather than sitting once on the donor — a member can offer a kidney while
 * living and their eyes only after death.
 */
const pledgeSchema = z.object({
  organ: organEnum,
  donationType: donationTypeEnum,
});

const donorSchema = z.object({
  /** The household member who is donating. Must belong to the caller's family. */
  familyMemberId: z.string().min(1),
  organs: z.array(pledgeSchema).min(1, "Select at least one organ"),
  emergencyName: z.string().min(2).max(120),
  emergencyRelation: z.string().max(60).optional(),
  emergencyMobile: z.string().min(6).max(20),
  emergencyMobileIso: z.string().length(2).optional(),
  /**
   * Both consent lines are one checkbox pair in the UI but a single boolean
   * here: the form cannot be submitted with either unticked, and a record
   * without consent has no business existing.
   */
  consentAccepted: z.literal(true),
  consentSignature: z.string().min(2).max(120),
  note: z.string().max(2000).optional(),
});

/** GET — the browse list. `mine=1` narrows it to what this household uploaded. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "1";

    if (mine) {
      const { communityId, session } = await requireOrganMember();
      const donors = await getOrganDonors(communityId, { createdByUserId: session.sub });
      return ok({ donors });
    }

    const { communityId, settings } = await requireOrganModule();
    const donors = await getOrganDonors(communityId, { onlyListed: true });

    // The list is public within the tenant, so the phone number obeys the
    // community's own privacy switch rather than being sent unconditionally.
    const rows = settings.showContact
      ? donors
      : donors.map((d) => ({ ...d, mobile: null, emergencyMobile: null }));

    return ok({ donors: rows, settings });
  } catch (e) {
    return handleApiError(e, "Failed to load organ donors");
  }
}

/** POST — the 5-step registration form. */
export async function POST(req: Request) {
  try {
    const { communityId, settings, session, familyId } = await requireOrganMember();
    if (!settings.memberAdd) return fail("Donor registration is disabled", 403);
    if (!familyId) return fail("No approved family found for this account", 403);

    const body = donorSchema.parse(await req.json());

    // Cross-tenant guard: the member must be in the caller's own household, not
    // merely somewhere in the community.
    const member = await prisma.familyMember.findFirst({
      where: { id: body.familyMemberId, familyId, family: { communityId, status: "APPROVED" } },
      select: {
        id: true,
        fullNameEn: true,
        fullNameGu: true,
        relation: true,
        gender: true,
        dateOfBirth: true,
        bloodGroup: true,
        mobile: true,
        mobileIso: true,
        isDeceased: true,
        family: { select: { city: true } },
      },
    });
    if (!member) return fail("Member not found in your family", 404);
    if (member.isDeceased) return fail("This member is recorded as deceased", 400);

    const existing = await prisma.organDonor.findFirst({
      where: { communityId, familyMemberId: member.id },
      select: { id: true },
    });
    if (existing) return fail("This member is already registered as a donor", 409);

    // Last answer wins if the client somehow sends an organ twice — a Map keyed
    // by organ also matches the DB's own (donorId, organ) unique constraint.
    const organs = Array.from(
      new Map(body.organs.map((o) => [o.organ, o])).values(),
    );

    const donor = await prisma.organDonor.create({
      data: {
        communityId,
        familyId,
        familyMemberId: member.id,
        createdByUserId: session.sub,
        // Snapshot the member's details: the donor card must keep reading
        // correctly even if the directory row is edited or removed later.
        fullNameEn: member.fullNameEn,
        fullNameGu: member.fullNameGu,
        relation: member.relation,
        gender: member.gender,
        dateOfBirth: member.dateOfBirth,
        bloodGroup: member.bloodGroup,
        mobile: member.mobile,
        mobileIso: member.mobileIso,
        city: member.family.city,
        emergencyName: body.emergencyName,
        emergencyRelation: body.emergencyRelation ?? null,
        emergencyMobile: body.emergencyMobile,
        emergencyMobileIso: body.emergencyMobileIso ?? "in",
        consentAccepted: true,
        consentSignature: body.consentSignature,
        note: body.note ?? null,
        pledges: {
          create: organs.map((o) => ({ organ: o.organ, donationType: o.donationType })),
        },
      },
      select: { id: true },
    });

    return created({ id: donor.id });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 400);
    return handleApiError(e, "Failed to register donor");
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  organs: z.array(pledgeSchema).min(1).optional(),
  emergencyName: z.string().min(2).max(120).optional(),
  emergencyRelation: z.string().max(60).nullable().optional(),
  emergencyMobile: z.string().min(6).max(20).optional(),
  emergencyMobileIso: z.string().length(2).optional(),
  note: z.string().max(2000).nullable().optional(),
});

/** PATCH — the family edits its own record. */
export async function PATCH(req: Request) {
  try {
    const { communityId, session, familyId } = await requireOrganMember();
    const { id, organs, ...rest } = updateSchema.parse(await req.json());
    const donor = await loadManageableDonor(communityId, id, {
      userId: session.sub,
      familyId,
    });
    if (donor.isDeceased) return fail("This record is closed — the donor is deceased", 400);

    await prisma.$transaction(async (tx) => {
      await tx.organDonor.update({
        where: { id },
        data: {
          ...(rest.emergencyName ? { emergencyName: rest.emergencyName } : {}),
          ...(rest.emergencyRelation !== undefined
            ? { emergencyRelation: rest.emergencyRelation }
            : {}),
          ...(rest.emergencyMobile ? { emergencyMobile: rest.emergencyMobile } : {}),
          ...(rest.emergencyMobileIso ? { emergencyMobileIso: rest.emergencyMobileIso } : {}),
          ...(rest.note !== undefined ? { note: rest.note } : {}),
        },
      });

      if (!organs) return;
      const want = new Map(organs.map((o) => [o.organ, o.donationType]));

      // Removing an organ is a withdrawal, not a delete: its history and any
      // requests already raised against it have to survive. Only organs still
      // open can be withdrawn — a donated one is a fact, not a listing.
      for (const p of donor.pledges) {
        if (want.has(p.organ) || !isOpenStatus(p.status)) continue;
        await setPledgeStatus(tx, p, "WITHDRAWN", {
          kind: "family",
          userId: session.sub,
          note: "Removed from the pledge by the family",
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
        // A closed organ is a fact, not a listing — its recorded type must not
        // be rewritten after the donation already happened.
        if (!isOpenStatus(prev.status) && prev.status !== "WITHDRAWN") continue;

        if (prev.donationType !== donationType) {
          await tx.organPledge.update({ where: { id: prev.id }, data: { donationType } });
          // Narrowing a requestable organ to after-death-only retracts the offer
          // anyone is currently queued on, so close those rather than leave them
          // waiting on something that can no longer be given.
          if (donationType === "AFTER_DEATH") {
            await tx.organRequest.updateMany({
              where: { pledgeId: prev.id, status: "PENDING" },
              data: { status: "CANCELLED", respondedAt: new Date() },
            });
          }
        }

        // Re-ticking a previously withdrawn organ puts it back on the list.
        if (prev.status === "WITHDRAWN") {
          await setPledgeStatus(tx, prev, "AVAILABLE", {
            kind: "family",
            userId: session.sub,
            note: "Re-added to the pledge by the family",
          });
        }
      }
    });

    return ok({ id });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 404);
    return handleApiError(e, "Failed to update donor");
  }
}

/** DELETE — the family removes its own record entirely. */
export async function DELETE(req: Request) {
  try {
    const { communityId, session, familyId } = await requireOrganMember();
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());
    const donor = await loadManageableDonor(communityId, id, {
      userId: session.sub,
      familyId,
    });

    // A completed donation is community history and feeds the reports — let the
    // family withdraw the listing, but not erase what actually happened.
    if (donor.pledges.some((p) => p.status === "DONATED")) {
      return fail("This record has a completed donation and cannot be deleted", 400);
    }

    await prisma.organDonor.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 404);
    return handleApiError(e, "Failed to delete donor");
  }
}
