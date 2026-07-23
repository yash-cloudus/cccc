import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunity } from "@/lib/tenant";
import { COMMUNITY_ADMIN_ROLES, COOKIE_ACTIVE_COMMUNITY } from "@/lib/constants";

const schema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(4).max(128),
  slug: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`alogin:${ip}`, 10, 60_000).allowed) return fail("Too many attempts", 429);

    const body = schema.parse(await req.json());

    // Resolve which community this admin belongs to (explicit slug wins, else active community).
    const community = body.slug
      ? await prisma.community.findUnique({ where: { slug: body.slug } })
      : await getActiveCommunity();
    if (!community) return fail("Community not found", 404);

    const user = await prisma.user.findFirst({
      where: { username: body.username, communityId: community.id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const okPw = user?.passwordHash ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!user || !okPw) {
      await prisma.loginLog.create({ data: { mobile: body.username, success: false, ip } });
      return fail("Invalid username or password", 401);
    }
    if (user.status !== "APPROVED") return fail("Account is not active", 403);

    const roles = user.roles.map((r) => r.role.name);
    const isAdmin = roles.some((r) => (COMMUNITY_ADMIN_ROLES as readonly string[]).includes(r));
    if (!isAdmin) return fail("This account cannot access the admin panel", 403);

    const permissions = Array.from(
      new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
    );

    const tokenData = {
      sub: user.id,
      mobile: user.mobile,
      username: user.username,
      roles,
      permissions,
      communityId: community.id,
      communitySlug: community.slug,
      isPlatform: false,
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

    // Keep the active-community cookie aligned with the logged-in admin.
    (await cookies()).set(COOKIE_ACTIVE_COMMUNITY, community.slug, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return ok({ id: user.id, username: user.username, communitySlug: community.slug, communityName: community.nameEn });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Login failed", 500);
  }
}
