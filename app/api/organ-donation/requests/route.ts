import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { handleApiError } from "@/lib/admin-guard";
import { getOrganRequests } from "@/lib/tenant-data";
import {
  OrganError,
  refreshPledgeFromRequests,
  requireOrganMember,
  setPledgeStatus,
} from "@/lib/organ-access";
import { canManageDonor, canRequest } from "@/lib/organ-donation";

/**
 * GET — one member's two inboxes.
 *
 * `incoming` is what this household must answer (requests against donors it
 * uploaded); `outgoing` is what it has asked others for.
 */
export async function GET(req: Request) {
  try {
    const { communityId, session } = await requireOrganMember();
    const box = new URL(req.url).searchParams.get("box") === "outgoing" ? "outgoing" : "incoming";

    const requests = await getOrganRequests(
      communityId,
      box === "outgoing"
        ? { requesterUserId: session.sub }
        : { forDonorAuthor: session.sub },
    );
    return ok({ requests, box });
  } catch (e) {
    return handleApiError(e, "Failed to load requests");
  }
}

const createSchema = z.object({
  pledgeId: z.string().min(1),
  requesterName: z.string().min(2).max(120),
  requesterMobile: z.string().min(6).max(20),
  requesterMobileIso: z.string().length(2).optional(),
  patientName: z.string().max(120).optional(),
  hospital: z.string().max(160).optional(),
  message: z.string().max(1000).optional(),
});

/** POST — a recipient raises a request against one pledged organ. */
export async function POST(req: Request) {
  try {
    const { communityId, settings, session, familyId } = await requireOrganMember();
    if (!settings.requests) return fail("Organ requests are disabled", 403);

    const body = createSchema.parse(await req.json());

    const pledge = await prisma.organPledge.findFirst({
      where: { id: body.pledgeId, donor: { communityId } },
      select: {
        id: true,
        status: true,
        donationType: true,
        donor: {
          select: {
            id: true,
            familyId: true,
            createdByUserId: true,
            isDeceased: true,
          },
        },
      },
    });
    if (!pledge) return fail("Organ not found", 404);

    // Asking your own household for an organ is meaningless and would let a
    // family manufacture an approved match against itself.
    if (canManageDonor(pledge.donor, { userId: session.sub, familyId })) {
      return fail("You cannot request an organ from your own listing", 400);
    }
    if (!canRequest(pledge, pledge.donor.isDeceased)) {
      return fail("This organ is not available for request", 400);
    }

    const duplicate = await prisma.organRequest.findFirst({
      where: { pledgeId: pledge.id, requesterUserId: session.sub, status: "PENDING" },
      select: { id: true },
    });
    if (duplicate) return fail("You already have a pending request for this organ", 409);

    const request = await prisma.$transaction(async (tx) => {
      const row = await tx.organRequest.create({
        data: {
          communityId,
          pledgeId: pledge.id,
          requesterUserId: session.sub,
          requesterName: body.requesterName,
          requesterMobile: body.requesterMobile,
          requesterMobileIso: body.requesterMobileIso ?? "in",
          patientName: body.patientName ?? null,
          hospital: body.hospital ?? null,
          message: body.message ?? null,
        },
        select: { id: true },
      });
      // Several people may queue on one organ; the first request is what flips
      // it to REQUESTED, the rest just join the queue.
      await setPledgeStatus(tx, pledge, "REQUESTED", {
        kind: "system",
        userId: session.sub,
        note: "Request raised",
      });
      return row;
    });

    return created({ id: request.id });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 400);
    return handleApiError(e, "Failed to send request");
  }
}

const respondSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject", "cancel"]),
  note: z.string().max(500).optional(),
});

/**
 * PATCH — the donor family approves or rejects, or the requester cancels.
 *
 * Approving is the only branch that touches other rows: every other pending
 * request on the same organ is closed as NOT_SELECTED, which is what "family
 * sees all, picks one, rest auto-close" means in practice.
 */
export async function PATCH(req: Request) {
  try {
    const { communityId, session, familyId } = await requireOrganMember();
    const { id, action, note } = respondSchema.parse(await req.json());

    const request = await prisma.organRequest.findFirst({
      where: { id, communityId },
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        pledge: {
          select: {
            id: true,
            status: true,
            donor: { select: { familyId: true, createdByUserId: true, isDeceased: true } },
          },
        },
      },
    });
    if (!request) return fail("Request not found", 404);
    if (request.status !== "PENDING") return fail("This request has already been answered", 400);

    const isOwner = canManageDonor(request.pledge.donor, {
      userId: session.sub,
      familyId,
    });

    if (action === "cancel") {
      if (request.requesterUserId !== session.sub) return fail("Forbidden", 403);
    } else if (!isOwner) {
      return fail("Only the donor's family can answer this request", 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.organRequest.update({
        where: { id },
        data: {
          status:
            action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CANCELLED",
          respondedAt: new Date(),
        },
      });

      if (action !== "approve") {
        await refreshPledgeFromRequests(tx, request.pledge.id, session.sub);
        return;
      }

      await tx.organRequest.updateMany({
        where: { pledgeId: request.pledge.id, status: "PENDING", id: { not: id } },
        data: { status: "NOT_SELECTED", respondedAt: new Date() },
      });
      await setPledgeStatus(
        tx,
        request.pledge,
        "APPROVED",
        { kind: "family", userId: session.sub, note: note ?? "Request approved" },
        { approvedRequestId: id },
      );
    });

    return ok({ id, action });
  } catch (e) {
    if (e instanceof OrganError) return fail(e.message, 400);
    return handleApiError(e, "Failed to update request");
  }
}
