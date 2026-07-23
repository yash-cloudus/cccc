import bcrypt from "bcryptjs";
import { fail, getClientIp, ok } from "@/lib/api";
import { getRefreshToken, setAuthCookies } from "@/lib/auth/cookies";
import { signAccessToken, signRefreshToken, verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Rotate access (+ refresh) cookies from a valid refresh token.
 * Used when the short-lived access JWT expired but the user is still logged in.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`refresh:${ip}`, 30, 60_000).allowed) return fail("Too many attempts", 429);

    const refresh = await getRefreshToken();
    if (!refresh) return fail("Unauthorized", 401);

    let payload;
    try {
      payload = await verifyToken(refresh, "refresh");
    } catch {
      return fail("Unauthorized", 401);
    }
    if (payload.typ !== "refresh") return fail("Unauthorized", 401);

    const sessions = await prisma.session.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    let matched = false;
    for (const s of sessions) {
      if (await bcrypt.compare(refresh, s.refreshTokenHash)) {
        matched = true;
        break;
      }
    }
    if (!matched) return fail("Unauthorized", 401);

    const tokenData = {
      sub: payload.sub,
      mobile: payload.mobile,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      communityId: payload.communityId ?? null,
      communitySlug: payload.communitySlug ?? null,
      isPlatform: Boolean(payload.isPlatform),
    };

    const access = await signAccessToken(tokenData);
    const nextRefresh = await signRefreshToken(tokenData);
    const refreshHash = await bcrypt.hash(nextRefresh, 10);

    await prisma.session.create({
      data: {
        userId: payload.sub,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 864e5),
        ip,
      },
    });

    await setAuthCookies(access, nextRefresh);
    return ok({ refreshed: true, isPlatform: tokenData.isPlatform });
  } catch (e) {
    console.error(e);
    return fail("Refresh failed", 500);
  }
}
