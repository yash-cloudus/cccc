import { z } from "zod";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { PLATFORM_ROLE } from "@/lib/constants";

const schema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`plogin:${ip}`, 10, 60_000).allowed) return fail("Too many attempts", 429);

    const body = schema.parse(await req.json());

    const user = await prisma.user.findFirst({
      where: { username: body.username, isPlatformAdmin: true, communityId: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const okPw = user?.passwordHash ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !okPw) {
      await prisma.loginLog.create({ data: { mobile: body.username, success: false, ip } });
      return fail("Invalid username or password", 401);
    }

    const roles = user.roles.map((r) => r.role.name);
    if (!roles.includes(PLATFORM_ROLE)) return fail("Not a platform admin", 403);

    const permissions = Array.from(
      new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
    );

    const tokenData = {
      sub: user.id,
      mobile: user.mobile,
      username: user.username,
      roles,
      permissions,
      communityId: null,
      communitySlug: null,
      isPlatform: true,
    };
    const access = await signAccessToken(tokenData);
    const refresh = await signRefreshToken(tokenData);

    const refreshHash = await bcrypt.hash(refresh, 10);
    await prisma.session.create({
      data: { userId: user.id, refreshTokenHash: refreshHash, expiresAt: new Date(Date.now() + 30 * 864e5), ip },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await prisma.loginLog.create({ data: { userId: user.id, mobile: user.username ?? "", success: true, ip } });
    await setAuthCookies(access, refresh);

    return ok({ id: user.id, username: user.username, isPlatform: true });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Login failed", 500);
  }
}
