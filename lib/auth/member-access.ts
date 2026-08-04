import { prisma } from "@/lib/prisma";
import { DEFAULT_ISO } from "@/lib/phone";

export type MemberAccessDenial = "not_registered" | "pending" | "rejected" | "suspended";

export type MemberAccess =
  | { ok: true; userId: string }
  | { ok: false; reason: MemberAccessDenial };

/** HTTP message + status for each denial, so every login route answers alike. */
export const ACCESS_DENIAL: Record<MemberAccessDenial, { message: string; status: number }> = {
  not_registered: { message: "Mobile number is not registered", status: 404 },
  pending: { message: "Registration is pending approval", status: 403 },
  rejected: { message: "Registration was rejected", status: 403 },
  suspended: { message: "Account suspended", status: 403 },
};

/**
 * May this mobile sign in to this community's member app?
 *
 * Login used to read `User.status`, but that is one flag per (community,
 * mobile) while a mobile can sit in several families — and approving a family
 * flips the flag for every mobile in it, permanently. So once someone was
 * approved anywhere, a later registration from the same number walked straight
 * into the app while its family was still sitting in the queue.
 *
 * Access is therefore derived from the families the person is actually in.
 * `User.status` is only consulted for accounts with no family at all — the
 * owner/admin users the platform creates, who have no household to approve.
 */
export async function checkMemberAccess(
  communityId: string,
  mobile: string,
  /** Country of `mobile`. Part of the identity: ten digits under two different
   *  countries are two different people. */
  mobileIso: string = DEFAULT_ISO,
): Promise<MemberAccess> {
  const iso = (mobileIso || DEFAULT_ISO).toLowerCase();
  const user = await prisma.user.findFirst({
    where: { mobile, mobileIso: iso, communityId },
    select: { id: true, status: true },
  });
  if (!user) return { ok: false, reason: "not_registered" };
  // A suspension is an explicit act by an admin — it outranks any household.
  if (user.status === "SUSPENDED") return { ok: false, reason: "suspended" };

  const families = await prisma.family.findMany({
    where: { communityId, familyMembers: { some: { mobile, mobileIso: iso } } },
    select: { status: true },
  });

  if (families.length === 0) {
    if (user.status === "APPROVED") return { ok: true, userId: user.id };
    return { ok: false, reason: user.status === "REJECTED" ? "rejected" : "pending" };
  }

  // One approved household is enough — a person may legitimately appear in more
  // than one, and a pending second registration must not lock them out.
  if (families.some((f) => f.status === "APPROVED")) return { ok: true, userId: user.id };

  return {
    ok: false,
    reason: families.some((f) => f.status === "PENDING") ? "pending" : "rejected",
  };
}
