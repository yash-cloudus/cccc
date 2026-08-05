/**
 * Server-side guards for the Organ Donation module.
 *
 * Split out of the routes because all four of them ask the same two questions —
 * "is this module on for this tenant?" and "is this caller the donor's family?"
 * — and the second one is the whole authorisation model: approving requests and
 * marking an organ donated belong to the household that submitted the record,
 * never to the recipient and never (for those two actions) to an admin.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { getActiveCommunityId, getMyFamilyId } from "@/lib/tenant";
import {
  getCommunitySettingsMap,
  getOrganModuleSettings,
  type OrganModuleSettings,
} from "@/lib/community-settings";
import { canManageDonor, type OrganStatus } from "@/lib/organ-donation";
import type { JwtPayload } from "@/lib/auth/jwt";

/** Thrown as plain messages so `handleApiError` maps them without extra cases. */
export class OrganError extends Error {}

/**
 * Resolve tenant + module settings for a read.
 *
 * Throws NO_COMMUNITY / MODULE_OFF rather than returning an empty list, so a
 * disabled module never looks like "no donors yet".
 */
export async function requireOrganModule(): Promise<{
  communityId: string;
  settings: OrganModuleSettings;
}> {
  const communityId = await getActiveCommunityId();
  if (!communityId) throw new Error("NO_COMMUNITY");
  const settings = getOrganModuleSettings(await getCommunitySettingsMap(communityId));
  if (!settings.enable) throw new OrganError("Organ donation is disabled");
  return { communityId, settings };
}

/** The signed-in caller plus the household they belong to. */
export async function requireOrganMember(): Promise<{
  communityId: string;
  settings: OrganModuleSettings;
  session: JwtPayload;
  familyId: string | null;
}> {
  const session = await requireSession();
  const { communityId, settings } = await requireOrganModule();
  const familyId = await getMyFamilyId(session.sub);
  return { communityId, settings, session, familyId };
}

/**
 * Load a donor the caller is allowed to act on, or throw.
 *
 * The ownership test is `canManageDonor` — the same predicate the client uses to
 * decide which buttons to show, so the UI and the server can never disagree.
 */
export async function loadManageableDonor(
  communityId: string,
  donorId: string,
  viewer: { userId: string; familyId: string | null },
) {
  const donor = await prisma.organDonor.findFirst({
    where: { id: donorId, communityId },
    include: { pledges: true },
  });
  if (!donor) throw new OrganError("Donor not found");
  if (!canManageDonor(donor, { userId: viewer.userId, familyId: viewer.familyId })) {
    throw new Error("FORBIDDEN");
  }
  return donor;
}

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Move a pledge to a new status and record why.
 *
 * Every status change goes through here so `OrganStatusLog` stays a complete
 * history — the admin panel answers "who marked this donated" from the log, not
 * from the current row, which by then has been overwritten.
 */
export async function setPledgeStatus(
  tx: Tx,
  pledge: { id: string; status: OrganStatus },
  next: OrganStatus,
  actor: { kind: "family" | "admin" | "system"; userId?: string | null; note?: string | null },
  extra: { donatedAt?: Date | null; approvedRequestId?: string | null } = {},
) {
  if (pledge.status === next && extra.donatedAt === undefined) return;
  await tx.organPledge.update({
    where: { id: pledge.id },
    data: {
      status: next,
      ...(extra.donatedAt !== undefined ? { donatedAt: extra.donatedAt } : {}),
      ...(extra.approvedRequestId !== undefined
        ? { approvedRequestId: extra.approvedRequestId }
        : {}),
    },
  });
  await tx.organStatusLog.create({
    data: {
      pledgeId: pledge.id,
      fromStatus: pledge.status,
      toStatus: next,
      actorKind: actor.kind,
      actorUserId: actor.userId ?? null,
      note: actor.note ?? null,
    },
  });
}

/**
 * Recompute a pledge's status from its open requests.
 *
 * Called after a request is rejected or cancelled: the organ falls back to
 * AVAILABLE only when nothing is still pending, otherwise it stays REQUESTED.
 * An APPROVED or terminal pledge is left alone — a withdrawn runner-up must not
 * un-approve the request the family already picked.
 */
export async function refreshPledgeFromRequests(
  tx: Tx,
  pledgeId: string,
  actorUserId?: string | null,
) {
  const pledge = await tx.organPledge.findUnique({
    where: { id: pledgeId },
    select: { id: true, status: true },
  });
  if (!pledge) return;
  if (pledge.status !== "AVAILABLE" && pledge.status !== "REQUESTED") return;

  const pending = await tx.organRequest.count({
    where: { pledgeId, status: "PENDING" },
  });
  const next: OrganStatus = pending > 0 ? "REQUESTED" : "AVAILABLE";
  await setPledgeStatus(tx, pledge, next, { kind: "system", userId: actorUserId });
}
