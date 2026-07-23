import { ROOT_DOMAIN } from "@/lib/constants";
import { communityAdminUrl as adminUrlOf, communitySiteUrl as siteUrlOf } from "@/lib/host";

export const RESERVED_SLUGS = ["platform", "www", "admin", "api", "app", "mail", "static", "assets"];

/** Normalize any input into a valid subdomain slug: lowercase a-z0-9_ only. */
export function normalizeSlug(v: string): string {
  return (v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Slug must be 2–40 chars, start/end alphanumeric, and not reserved. */
export function isValidSlug(v: string): boolean {
  if (!v || RESERVED_SLUGS.includes(v)) return false;
  return /^[a-z0-9](?:[a-z0-9_]{0,38}[a-z0-9])?$/.test(v);
}

/** Member website URL — `{slug}.community.in` (or `{slug}.localhost:3000` locally). */
export function communityUrl(slug: string, path = "/"): string {
  return siteUrlOf(slug, path);
}

/** Community Admin URL — `admin.{slug}.community.in` (or `admin.{slug}.localhost:3000` locally). */
export function communityAdminUrl(slug: string, path = "/admin"): string {
  return adminUrlOf(slug, path);
}

export function defaultAdminUsername(slug: string): string {
  return `${slug}_admin`;
}

/** Human-readable but strong-ish password for handing off to a new community admin. */
export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function groupingLabel(type: "PARIVAR" | "GAM", count = 24): string {
  return `${count} ${type === "GAM" ? "Gam" : "Parivar"}`;
}

/** Display-only website host (no scheme), e.g. saurashtra_patel.community.in */
export function communitySiteHostLabel(slug: string): string {
  if (ROOT_DOMAIN === "localhost" || ROOT_DOMAIN.endsWith(".localhost")) {
    return `${slug}.localhost`;
  }
  return `${slug}.${ROOT_DOMAIN}`;
}

/** Display-only admin host (no scheme), e.g. admin.saurashtra_patel.community.in */
export function communityAdminHostLabel(slug: string): string {
  if (ROOT_DOMAIN === "localhost" || ROOT_DOMAIN.endsWith(".localhost")) {
    return `admin.${slug}.localhost`;
  }
  return `admin.${slug}.${ROOT_DOMAIN}`;
}
