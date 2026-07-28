import { cookies, headers } from "next/headers";
import type { Community } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyToken, type JwtPayload } from "@/lib/auth/jwt";
import { COOKIE_ACTIVE_COMMUNITY, COMMUNITY_ADMIN_ROLES } from "@/lib/constants";
import { effectiveHost, parseHost } from "@/lib/host";

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

  const parsed = parseHost(effectiveHost(hdrs));
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
  const hostKind = hdrs.get("x-host-kind") || parseHost(effectiveHost(hdrs)).kind;
  // On a single-host origin the panel is guessed from the path, so /login looks
  // like "main" even when it is a member login. Middleware only sets
  // x-community-slug from an explicit ?c= / active-community cookie there (never
  // on the real apex), so that header outranks the guess.
  const mwSlug = hdrs.get("x-community-slug");
  if (hostKind === "main" && !mwSlug) return null;

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

/**
 * The household of a signed-in member.
 *
 * `Profile.familyId` is only filled in when an admin creates the account from a
 * member record. Ordinary members sign in with an OTP, which matches the User
 * by mobile alone and never touches the profile — so the household has to be
 * found the way the data actually links it: FamilyMember.mobile == User.mobile.
 */
export async function getMyFamilyId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mobile: true, communityId: true, profile: { select: { familyId: true } } },
  });
  if (!user) return null;
  if (user.profile?.familyId) return user.profile.familyId;
  if (!user.mobile) return null;

  const member = await prisma.familyMember.findFirst({
    where: {
      mobile: user.mobile,
      ...(user.communityId ? { family: { communityId: user.communityId } } : {}),
    },
    select: { familyId: true },
  });
  return member?.familyId ?? null;
}

/**
 * The signed-in member's own record.
 *
 * Two tables describe a person: `Profile` (created when an admin makes the
 * account) and `FamilyMember` (created by family registration). An OTP member
 * usually has only the latter, so reading `Profile` alone leaves them looking
 * like they have no profile at all. `source` tells callers which row to write
 * back to. See [[getMyFamilyId]] for the same split on households.
 */
export type MyMemberRecord = {
  source: "profile" | "familyMember";
  id: string;
  familyId: string | null;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  dateOfBirth: Date | null;
  bloodGroup: string | null;
  occupation: string | null;
  occupationOther: string | null;
  education: string | null;
  course: string | null;
  currentlyAt: string | null;
  showPhone: boolean;
  hasWhatsApp: boolean;
};

export async function getMyMemberRecord(userId: string): Promise<MyMemberRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mobile: true, communityId: true },
  });
  if (!user) return null;

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile) {
    return {
      source: "profile",
      id: profile.id,
      familyId: profile.familyId ?? (await getMyFamilyId(userId)),
      fullNameEn: profile.fullNameEn,
      fullNameGu: profile.fullNameGu,
      relation: profile.relation,
      dateOfBirth: profile.dateOfBirth,
      bloodGroup: profile.bloodGroup,
      occupation: profile.occupation,
      occupationOther: profile.occupationOther,
      education: profile.education,
      course: profile.course,
      currentlyAt: profile.currentlyAt,
      showPhone: profile.showPhone,
      hasWhatsApp: profile.hasWhatsApp,
    };
  }

  if (!user.mobile) return null;
  const member = await prisma.familyMember.findFirst({
    where: {
      mobile: user.mobile,
      ...(user.communityId ? { family: { communityId: user.communityId } } : {}),
    },
  });
  if (!member) return null;

  return {
    source: "familyMember",
    id: member.id,
    familyId: member.familyId,
    fullNameEn: member.fullNameEn,
    fullNameGu: member.fullNameGu,
    relation: member.relation,
    dateOfBirth: member.dateOfBirth,
    bloodGroup: member.bloodGroup,
    occupation: member.occupation,
    occupationOther: member.occupationOther,
    education: member.education,
    course: member.course,
    currentlyAt: member.currentlyAt,
    showPhone: member.showPhone,
    hasWhatsApp: member.hasWhatsApp,
  };
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
