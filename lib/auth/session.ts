import { getAccessToken } from "@/lib/auth/cookies";
import { verifyToken, type JwtPayload } from "@/lib/auth/jwt";

export async function requireSession(): Promise<JwtPayload> {
  const token = await getAccessToken();
  if (!token) throw new Error("UNAUTHORIZED");
  return verifyToken(token, "access");
}

export function hasRole(payload: JwtPayload, roles: string[]) {
  // A platform admin who has launched into a tenant's admin panel (bridge
  // login) is scoped to that community via `communityId` but only carries
  // the PLATFORM_ADMIN role — treat them as a full admin there too.
  if (payload.isPlatform) return true;
  return payload.roles.some((r) => roles.includes(r));
}

export function hasPermission(payload: JwtPayload, key: string) {
  return payload.permissions.includes(key) || payload.roles.includes("OWNER");
}
