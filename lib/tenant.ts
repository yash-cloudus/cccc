import { cookies, headers } from "next/headers";
import type { Community } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyToken, type JwtPayload } from "@/lib/auth/jwt";
import { COOKIE_ACTIVE_COMMUNITY, COMMUNITY_ADMIN_ROLES } from "@/lib/constants";
import { parseHost } from "@/lib/host";

/** Read the current JWT payload without throwing (null when absent/invalid). */
export async function getSessionPayload(): Promise<JwtPayload | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    return await verifyToken(token, "access");
  } catch {
    return null;
  }
}

/**
 * Extract a community slug from the Host header.
 * Supports `{slug}.community.in`, `admin.{slug}.community.in`, and local `*.localhost`.
 */
export function subdomainFromHost(host: string | null | undefined): string | null {
  return parseHost(host).slug;
}

/** Non-session slug resolution: middleware header → host → active_community cookie. */
async function resolveSlugFromRequest(): Promise<string | null> {
  const hdrs = await headers();
  const fromMw = hdrs.get("x-community-slug");
  if (fromMw) return fromMw;

  const parsed = parseHost(hdrs.get("host"));
  // Main Admin apex must not inherit a random tenant from cookie for branding.
  if (parsed.kind === "main") return null;

  if (parsed.slug) return parsed.slug;

  const jar = await cookies();
  return jar.get(COOKIE_ACTIVE_COMMUNITY)?.value || null;
}

/**
 * Resolve the active community for the current request.
 *
 * Priority (security-first):
 *  1. Logged-in user's own community (from JWT) — authoritative.
 *  2. Host: `{slug}.…` or `admin.{slug}.…`
 *  3. active_community cookie — only on non-main hosts / path previews.
 *  4. First LIVE community — member-site fallback when host has no slug (rare).
 */
export async function getActiveCommunity(): Promise<Community | null> {
  const session = await getSessionPayload();

  if (session?.communityId) {
    const own = await prisma.community.findUnique({ where: { id: session.communityId } });
    if (own) return own;
  }

  const hdrs = await headers();
  const hostKind = hdrs.get("x-host-kind") || parseHost(hdrs.get("host")).kind;
  if (hostKind === "main") return null;

  const slug = await resolveSlugFromRequest();
  if (slug) {
    const bySlug = await prisma.community.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
  }

  // Dev fallback for path-based browsing without a subdomain.
  if (hostKind === "unknown" || hostKind === "site" || hostKind === "admin") {
    return prisma.community.findFirst({ where: { status: "LIVE" }, orderBy: { createdAt: "asc" } });
  }
  return null;
}

export async function getActiveCommunityId(): Promise<string | null> {
  const c = await getActiveCommunity();
  return c?.id ?? null;
}

/** Throws NO_COMMUNITY when none can be resolved (caller renders a 404). */
export async function requireActiveCommunity(): Promise<Community> {
  const c = await getActiveCommunity();
  if (!c) throw new Error("NO_COMMUNITY");
  return c;
}

/** Look up a community by slug (used by /api/platform and slug routes). */
export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  return prisma.community.findUnique({ where: { slug } });
}

export function isCommunityAdmin(payload: JwtPayload | null): boolean {
  if (!payload) return false;
  if (payload.isPlatform) return true;
  return payload.roles?.some((r) => (COMMUNITY_ADMIN_ROLES as readonly string[]).includes(r)) ?? false;
}

export async function requireCommunityContext(): Promise<{
  community: Community;
  payload: JwtPayload | null;
}> {
  const [community, payload] = await Promise.all([getActiveCommunity(), getSessionPayload()]);
  if (!community) throw new Error("NO_COMMUNITY");
  return { community, payload };
}

const bypass = () => process.env.AUTH_BYPASS === "true";

export async function assertPlatform(): Promise<JwtPayload | null> {
  const p = await getSessionPayload();
  // Never bypass Main Admin API auth — even when AUTH_BYPASS is on for member UI preview.
  if (!p || !p.isPlatform) throw new Error("FORBIDDEN");
  return p;
}

/**
 * Resolve the community id that the current caller is allowed to WRITE to.
 * - Community admin: always their own community (from JWT).
 * - Platform admin: the currently selected/active community (host slug).
 * - Dev preview (AUTH_BYPASS): the active community.
 */
export async function getWritableCommunityId(): Promise<string> {
  const p = await getSessionPayload();
  if (p?.communityId) return p.communityId;
  if (p?.isPlatform) {
    const c = await getActiveCommunity();
    if (c) return c.id;
  }
  if (bypass()) {
    const c = await getActiveCommunity();
    if (c) return c.id;
  }
  throw new Error("FORBIDDEN");
}
