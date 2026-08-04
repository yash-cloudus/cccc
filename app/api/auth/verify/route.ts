import { z } from "zod";
import { canDeliverOtp, verifyOtp } from "@/lib/auth/otp";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunity } from "@/lib/tenant";
import { ACCESS_DENIAL, checkMemberAccess } from "@/lib/auth/member-access";
import { issueMemberSession } from "@/lib/auth/issue-session";

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  code: z.string().regex(/^\d{4,8}$/),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limited = rateLimit(`verify:${ip}`, 20, 60_000);
    if (!limited.allowed) return fail("Too many attempts", 429);

    const body = schema.parse(await req.json());

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
    const result = await verifyOtp(body.mobile, body.code, allowDevCode);
    if (!result.ok) {
      await prisma.loginLog.create({
        data: { mobile: body.mobile, success: false, ip, userAgent: req.headers.get("user-agent") || undefined },
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
      where: { mobile: body.mobile, communityId: community.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        profile: true,
      },
    });
    if (!user) return fail("User not found", 404);

    // The real gate — and from the family, not the cached User flag.
    const gate = await checkMemberAccess(community.id, body.mobile);
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
