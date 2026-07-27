import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { consumeLaunchToken } from "@/lib/auth/bridge";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { COOKIE_ACTIVE_COMMUNITY, PLATFORM_ROLE } from "@/lib/constants";
import { communityAdminUrl, communitySiteUrl, mainAdminUrl } from "@/lib/host";
import { effectiveHost, parseHost, requestOrigin } from "@/lib/host";

export const dynamic = "force-dynamic";

function safeNext(raw: string | null, target: "admin" | "app") {
  const fallback = target === "admin" ? "/admin" : "/dashboard";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("://")) return fallback;
  return raw;
}

/**
 * Consumes a Main-Admin launch token on the tenant host and sets auth cookies.
 * Token is signed, 60s TTL, one-time — no passwords in the URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const host = effectiveHost(req.headers);
  const parsed = parseHost(host, url.pathname);
  const ip = getClientIp(req);

  const origin = requestOrigin(req);

  /** Same-origin URL for single-host mode; absolute tenant URL otherwise. */
  const dest = (target: "admin" | "app", slug: string, path: string) => {
    if (!parsed.singleHost) {
      return target === "admin" ? communityAdminUrl(slug, path) : communitySiteUrl(slug, path);
    }
    const u = new URL(path, origin);
    u.searchParams.set("c", slug); // set, not append — never duplicates
    return u.toString();
  };

  const failRedirect = (target: "admin" | "app" | null, slug: string | null) => {
    if (slug && target === "admin") {
      return NextResponse.redirect(dest("admin", slug, "/admin/login"));
    }
    if (slug && target === "app") {
      return NextResponse.redirect(dest("app", slug, "/login"));
    }
    return NextResponse.redirect(parsed.singleHost ? new URL("/login", origin).toString() : mainAdminUrl("/login"));
  };

  try {
    if (!rateLimit(`bridge:${ip}`, 40, 60_000).allowed) {
      return failRedirect(null, parsed.slug);
    }
    if (!token) return failRedirect(parsed.kind === "admin" ? "admin" : "app", parsed.slug);

    const launch = await consumeLaunchToken(token);

    // On a canonical host the subdomain identifies the tenant, so it must match
    // the community the token was minted for. A single-host origin carries no
    // slug in the hostname — there the signed, one-time token IS the authority
    // (it names communityId + slug and is still verified below).
    if (!parsed.singleHost) {
      if (!parsed.slug || parsed.slug !== launch.communitySlug) {
        return failRedirect(launch.target, launch.communitySlug);
      }
      if (launch.target === "admin" && parsed.kind !== "admin") {
        return failRedirect(launch.target, launch.communitySlug);
      }
      if (launch.target === "app" && parsed.kind !== "site") {
        return failRedirect(launch.target, launch.communitySlug);
      }
    }

    const user = await prisma.user.findFirst({
      where: { id: launch.sub, isPlatformAdmin: true, communityId: null },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) return failRedirect(launch.target, launch.communitySlug);

    const roles = user.roles.map((r) => r.role.name);
    if (!roles.includes(PLATFORM_ROLE)) return failRedirect(launch.target, launch.communitySlug);

    const community = await prisma.community.findFirst({
      where: { id: launch.communityId, slug: launch.communitySlug },
      select: { id: true, slug: true },
    });
    if (!community) return failRedirect(launch.target, launch.communitySlug);

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
      isPlatform: true,
    };

    const access = await signAccessToken(tokenData);
    const refresh = await signRefreshToken(tokenData);
    const refreshHash = await bcrypt.hash(refresh, 10);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 864e5),
        ip,
      },
    });
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        mobile: `launch:${launch.target}:${community.slug}`,
        success: true,
        ip,
      },
    });

    await setAuthCookies(access, refresh);
    (await cookies()).set(COOKIE_ACTIVE_COMMUNITY, community.slug, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const next = safeNext(url.searchParams.get("next"), launch.target);
    return NextResponse.redirect(dest(launch.target, community.slug, next));
  } catch (e) {
    console.error("bridge error", e);
    return failRedirect(parsed.kind === "admin" ? "admin" : "app", parsed.slug);
  }
}
