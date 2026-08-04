/**
 * Deriving a household's login (number + password) from records that already
 * exist.
 *
 * When a community that has been running on OTP switches to MOBILE_PASSWORD,
 * every family already in the directory suddenly has no way in. Asking an admin
 * to type a password for two hundred households is not a migration, it is a
 * wall — so the head's own mobile becomes the login and their date of birth
 * becomes the first password.
 *
 * ⚠ A date of birth is not a secret. It is printed on the member's own
 * directory card, so within the community this password is effectively public.
 * It exists to unlock the door on day one, not to secure it — the admin can
 * reset any of them from the family detail page.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ISO, digitsOf } from "@/lib/phone";
import { userKey } from "@/lib/auth/user-key";

type LoginCandidate = {
  isHead: boolean;
  mobile: string | null;
  mobileIso?: string | null;
  dateOfBirth: Date | null;
};

/**
 * A date of birth as DDMMYY — 13 November 2004 becomes "131104".
 *
 * Read in UTC, not local time: dates are written as `new Date("2004-11-13")`,
 * which is UTC midnight, so a server west of Greenwich would otherwise derive
 * the previous day and hand out a password that does not match the birthday
 * printed on the member's own card.
 */
export function dobPassword(dob: Date | null | undefined): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${String(d.getUTCFullYear()).slice(-2)}`;
}

/**
 * Which member's number the household signs in with: the head's, or — when the
 * head never gave one — the first member who did.
 */
export function pickLoginMember<T extends LoginCandidate>(members: T[]): T | null {
  const head = members.find((m) => m.isHead && m.mobile?.trim());
  return head ?? members.find((m) => m.mobile?.trim()) ?? null;
}

export type BackfillResult = {
  /** Got a usable login and a password. */
  withPassword: number;
  /** Has a number but no date of birth — the admin must set the password. */
  needsPassword: number;
  /** Nobody in the household left a mobile number; it cannot log in at all. */
  noMobile: number;
  /** Already had a password (an admin account, or a re-run). Left alone. */
  alreadySet: number;
};

/**
 * Give every family in this community a login number and a starting password.
 *
 * Idempotent: it only looks at families with no `loginMobile` yet, and never
 * replaces a password that already exists — so re-running it after a mode flip
 * cannot reset an admin's credentials or undo a password an admin chose.
 *
 * ponytail: one bcrypt hash per family, sequential (~60ms each), so ~12s for
 * 200 families. Fine as a one-off admin action; move it to a job if a community
 * ever arrives with thousands.
 */
export async function backfillFamilyLogins(communityId: string): Promise<BackfillResult> {
  const families = await prisma.family.findMany({
    where: { communityId, loginMobile: null },
    select: {
      id: true,
      status: true,
      familyMembers: { select: { isHead: true, mobile: true, mobileIso: true, dateOfBirth: true } },
    },
  });

  const result: BackfillResult = { withPassword: 0, needsPassword: 0, noMobile: 0, alreadySet: 0 };

  for (const family of families) {
    const login = pickLoginMember(family.familyMembers);
    const mobile = digitsOf(login?.mobile);
    const mobileIso = login?.mobileIso || DEFAULT_ISO;
    if (!mobile) {
      result.noMobile++;
      continue;
    }

    // Recorded even when no password follows, so the admin screen can show
    // *which* number needs one instead of just "not set".
    await prisma.family.update({
      where: { id: family.id },
      data: { loginMobile: mobile, loginMobileIso: mobileIso },
    });

    const password = dobPassword(login?.dateOfBirth);
    if (!password) {
      result.needsPassword++;
      continue;
    }

    const existing = await prisma.user.findUnique({
      where: userKey(communityId, mobile, mobileIso),
      select: { id: true, passwordHash: true },
    });
    // Never overwrite. This is what keeps the backfill from resetting the
    // community owner's admin password when they are also a head of household.
    if (existing?.passwordHash) {
      result.alreadySet++;
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    } else {
      await prisma.user.create({
        data: {
          communityId,
          mobile,
          mobileIso,
          passwordHash,
          status: family.status === "APPROVED" ? "APPROVED" : "PENDING",
        },
      });
    }
    result.withPassword++;
  }

  return result;
}
