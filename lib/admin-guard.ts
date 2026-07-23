import { ZodError } from "zod";
import { fail, fromZod } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getWritableCommunityId } from "@/lib/tenant";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";
import type { JwtPayload } from "@/lib/auth/jwt";

/**
 * Guard for Community Admin API routes.
 *
 * Ensures the caller is the platform admin OR holds a community-admin role,
 * then resolves the single community they are allowed to write to. This is the
 * only place that combines the role check with tenant resolution so ordinary
 * members (who also carry a communityId in their JWT) cannot reach admin writes.
 *
 * Throws "UNAUTHORIZED" / "FORBIDDEN" — map with handleApiError().
 */
export async function requireAdmin(
  roles: readonly string[] = COMMUNITY_ADMIN_ROLES,
): Promise<{ communityId: string; session: JwtPayload }> {
  const session = await requireSession();
  const allowed = session.isPlatform === true || hasRole(session, [...roles]);
  if (!allowed) throw new Error("FORBIDDEN");
  const communityId = await getWritableCommunityId();
  return { communityId, session };
}

/** Uniform error → HTTP mapping for admin/tenant routes. */
export function handleApiError(e: unknown, fallback = "Request failed") {
  const msg = (e as Error)?.message;
  if (msg === "UNAUTHORIZED") return fail("Unauthorized", 401);
  if (msg === "FORBIDDEN") return fail("Forbidden", 403);
  if (msg === "NO_COMMUNITY") return fail("Community not found", 404);
  if (e instanceof ZodError) return fromZod(e);
  console.error(e);
  return fail(fallback, 500);
}
