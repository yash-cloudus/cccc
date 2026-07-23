import { z } from "zod";
import bcrypt from "bcryptjs";
import { verifyOtp } from "@/lib/auth/otp";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunity } from "@/lib/tenant";

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
    const result = await verifyOtp(body.mobile, body.code);
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

    const community = await getActiveCommunity();
    if (!community) return fail("Community not found", 404);

    const user = await prisma.user.findFirst({
      where: { mobile: body.mobile, communityId: community.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        profile: true,
      },
    });
    if (!user) return fail("User not found", 404);
    if (user.status !== "APPROVED") return fail("Account not approved", 403);

    const roles = user.roles.map((r: { role: { name: string } }) => r.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((r: { role: { permissions: { permission: { key: string } }[] } }) =>
          r.role.permissions.map((p: { permission: { key: string } }) => p.permission.key),
        ),
      ),
    ) as string[];

    const tokenData = {
      sub: user.id,
      mobile: user.mobile,
      username: user.username,
      roles,
      permissions,
      communityId: user.communityId,
      communitySlug: community.slug,
      isPlatform: false,
    };
    const access = await signAccessToken(tokenData);
    const refresh = await signRefreshToken(tokenData);

    const refreshHash = await bcrypt.hash(refresh, 10);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.loginLog.create({
      data: {
        userId: user.id,
        mobile: user.mobile,
        success: true,
        ip,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    await setAuthCookies(access, refresh);

    return ok({
      user: {
        id: user.id,
        mobile: user.mobile,
        status: user.status,
        roles,
        profile: user.profile,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Verification failed", 500);
  }
}
