import { cookies } from "next/headers";
import { COOKIE_ACCESS, COOKIE_REFRESH } from "@/lib/constants";

const secure = process.env.COOKIE_SECURE === "true";

/** Access cookie lifetime — keep in sync with JWT_ACCESS_EXPIRES (default 7d for local). */
function accessMaxAgeSeconds() {
  const raw = process.env.JWT_ACCESS_EXPIRES || "7d";
  const m = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!m) return 60 * 60 * 24 * 7;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "s") return n;
  if (u === "m") return n * 60;
  if (u === "h") return n * 3600;
  return n * 86400;
}

export function accessCookieOptions(maxAge = accessMaxAgeSeconds()) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function refreshCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies();
  jar.set(COOKIE_ACCESS, access, accessCookieOptions());
  jar.set(COOKIE_REFRESH, refresh, refreshCookieOptions());
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.set(COOKIE_ACCESS, "", { ...accessCookieOptions(0) });
  jar.set(COOKIE_REFRESH, "", { ...refreshCookieOptions(0) });
}

export async function getAccessToken() {
  const jar = await cookies();
  return jar.get(COOKIE_ACCESS)?.value;
}

export async function getRefreshToken() {
  const jar = await cookies();
  return jar.get(COOKIE_REFRESH)?.value;
}
