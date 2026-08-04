import { z } from "zod";
import bcrypt from "bcryptjs";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunity } from "@/lib/tenant";
import { ACCESS_DENIAL, checkMemberAccess } from "@/lib/auth/member-access";
import { issueMemberSession } from "@/lib/auth/issue-session";

/**
 * Member login for MOBILE_PASSWORD communities: one household, one mobile, one
 * 6-digit password.
 *
 * A separate route rather than a branch inside /api/auth/verify, because that
 * route's `code` field already accepts `^\d{4,8}$` — a 6-digit password fits it
 * exactly. One field meaning "OTP" or "password" depending on a column is how a
 * mode flip turns a password into a guessable code.
 */
const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  // Exactly 6 digits. This also keeps community-admin passwords (which live on
  // the same User.passwordHash) from being usable here — do not relax it.
  password: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;
    if (!rateLimit(`mlogin:${ip}`, 10, 60_000).allowed) {
      return fail("Too many attempts", 429);
    }

    const body = schema.parse(await req.json());

    // Second bucket, keyed on the account rather than the caller. Six digits is
    // a million combinations; an IP-only limit is beaten by rotating IPs.
    if (!rateLimit(`mlogin:m:${body.mobile}`, 5, 15 * 60_000).allowed) {
      return fail("Too many attempts, try again later", 429);
    }

    const community = await getActiveCommunity();
    if (!community) return fail("Community not found", 404);
    if (community.authMode !== "MOBILE_PASSWORD") {
      return fail("This community signs in with an OTP", 400);
    }

    const user = await prisma.user.findFirst({
      where: { mobile: body.mobile, communityId: community.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        profile: true,
      },
    });

    // One message for "no such mobile", "no password set" and "wrong password".
    // Splitting them would turn this into a mobile-number oracle.
    const okPw = user?.passwordHash ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !okPw) {
      await prisma.loginLog.create({
        data: { mobile: body.mobile, success: false, ip, userAgent },
      });
      return fail("Invalid mobile number or password", 401);
    }

    // Access is checked after the password on purpose: "your family is still
    // pending" must not be learnable without a valid credential.
    const gate = await checkMemberAccess(community.id, body.mobile);
    if (!gate.ok) {
      const denial = ACCESS_DENIAL[gate.reason];
      return fail(
        denial.message,
        denial.status,
        gate.reason === "pending" ? { pending: true } : undefined,
      );
    }

    return ok(await issueMemberSession(user, community, req, ip));
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Login failed", 500);
  }
}
