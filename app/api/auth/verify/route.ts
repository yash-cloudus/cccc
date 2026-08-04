import { z } from "zod";
import { canDeliverOtp, verifyOtp } from "@/lib/auth/otp";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunity } from "@/lib/tenant";
import { ACCESS_DENIAL, checkMemberAccess } from "@/lib/auth/member-access";
import { issueMemberSession } from "@/lib/auth/issue-session";
import { DEFAULT_ISO, digitsOf, e164 } from "@/lib/phone";

const schema = z.object({
  // Length only — the country decides what a valid number looks like, and the
  // access gate below rejects anything that is not a known account anyway.
  mobile: z.string().min(4).max(20),
  mobileIso: z.string().length(2).default(DEFAULT_ISO),
  code: z.string().regex(/^\d{4,8}$/),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limited = rateLimit(`verify:${ip}`, 20, 60_000);
    if (!limited.allowed) return fail("Too many attempts", 429);

    const body = schema.parse(await req.json());
    const mobile = digitsOf(body.mobile);
    const mobileIso = body.mobileIso.toLowerCase();

    // Resolved before verifyOtp so a MOBILE_PASSWORD community is turned away
    // without consuming an OTP row or burning an attempt. /api/auth/otp checks
    // this too, but a caller can post straight here with a code it holds — and
    // in dev mode the fixed code needs no row at all, so this route is the one
    // that actually has to hold the line.
    const community = await getActiveCommunity();
    if (!community) return fail("Community not found", 404);
    if (community.authMode === "MOBILE_PASSWORD") {
      return fail("This community signs in with a password", 400, { usePassword: true });
    }

    // A community with working credentials issues real codes, so it must not
    // also accept the fixed dev one.
    const allowDevCode = !(await canDeliverOtp(community.id));
    // Keyed on the full international number so an OTP minted for +1 555… is
    // not consumable by +91 555….
    const result = await verifyOtp(e164(mobile, mobileIso), body.code, allowDevCode);
    if (!result.ok) {
      await prisma.loginLog.create({
        data: { mobile, success: false, ip, userAgent: req.headers.get("user-agent") || undefined },
      });
      return fail(
        result.reason === "expired"
          ? "OTP expired"
          : result.reason === "locked"
            ? "Too many invalid attempts"
            : "Invalid OTP",
        401,
      );
    }

    const user = await prisma.user.findFirst({
      where: { mobile, mobileIso, communityId: community.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        profile: true,
      },
    });
    if (!user) return fail("User not found", 404);

    // The real gate — and from the family, not the cached User flag.
    const gate = await checkMemberAccess(community.id, mobile, mobileIso);
    if (!gate.ok) {
      const denial = ACCESS_DENIAL[gate.reason];
      return fail(denial.message, denial.status);
    }

    return ok(await issueMemberSession(user, community, req, ip));
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Verification failed", 500);
  }
}
