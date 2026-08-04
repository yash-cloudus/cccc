/**
 * The tail every member login shares: flatten roles, sign the pair, persist the
 * session, stamp the login, set the cookies.
 *
 * Extracted so OTP login (`/api/auth/verify`) and password login
 * (`/api/auth/member-login`) cannot drift apart on cookie flags, token claims
 * or session rows — the two places where a difference is a security bug rather
 * than an inconsistency.
 */
import bcrypt from "bcryptjs";
import type { Community, Profile, User } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { prisma } from "@/lib/prisma";

export type UserForSession = User & {
  roles: { role: { name: string; permissions: { permission: { key: string } }[] } }[];
  profile: Profile | null;
};

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueMemberSession(
  user: UserForSession,
  community: Pick<Community, "slug">,
  req: Request,
  ip: string,
) {
  const userAgent = req.headers.get("user-agent") || undefined;

  const roles = user.roles.map((r) => r.role.name);
  const permissions = Array.from(
    new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
  );

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

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: await bcrypt.hash(refresh, 10),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ip,
      userAgent,
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await prisma.loginLog.create({
    data: { userId: user.id, mobile: user.mobile, success: true, ip, userAgent },
  });

  await setAuthCookies(access, refresh);

  return {
    user: {
      id: user.id,
      mobile: user.mobile,
      status: user.status,
      roles,
      profile: user.profile,
    },
  };
}
