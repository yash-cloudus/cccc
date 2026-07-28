import { ROOT_DOMAIN } from "@/lib/constants";
import {
  communityAdminUrl as adminUrlOf,
  communitySiteUrl as siteUrlOf,
  isCanonicalHost,
} from "@/lib/host";

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

/**
 * Memorable admin password: first name + "@" + first 4 digits of the mobile
 * number, e.g. name "Bob Patel" + phone "9319912345" → "bob@9319".
 * Falls back to a random 4-digit tail when the phone isn't filled in yet.
 */
export function generateNamePhonePassword(name: string, phone: string): string {
  const namePart =
    (name || "").trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "admin";
  const digits = (phone || "").replace(/\D/g, "");
  const phonePart = digits.slice(0, 4) || String(Math.floor(1000 + Math.random() * 9000));
  return `${namePart}@${phonePart}`;
}

/**
 * The unit a community groups its families by — surname for a Parivar app,
 * village for a Gam app.
 *
 * This used to return `"24 Parivar"` from a hardcoded `count = 24`, so every
 * community advertised a fabricated number that never changed. Counts are now
 * read live from the DB (`_count.surnameGroups` / `_count.villageAreas`); this
 * only names the unit.
 */
export function groupingLabel(type: "PARIVAR" | "GAM"): string {
  return type === "GAM" ? "Village" : "Surname";
}

/** Naive English pluraliser for card labels. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Display-only website host (no scheme), e.g. saurashtra_patel.community.in */
/**
 * Address the CURRENT viewer would actually use.
 *
 * On a single-host origin (dev tunnel, LAN IP) there is no wildcard DNS, so
 * printing `{slug}.localhost` shows an address that cannot be opened from
 * another machine. There the label follows the origin in the address bar.
 *
 * `host` is passed in rather than read off `window` here: reading it during
 * render makes the server and the browser emit different text and breaks
 * hydration. Client callers use <HostLabel>, which swaps after mount.
 */
function singleHostLabel(host: string | null | undefined, path: string): string | null {
  if (!host || isCanonicalHost(host)) return null;
  return `${host}${path}`;
}

export function communitySiteHostLabel(slug: string, host?: string | null): string {
  const live = singleHostLabel(host, `/?c=${slug}`);
  if (live) return live;
  if (ROOT_DOMAIN === "localhost" || ROOT_DOMAIN.endsWith(".localhost")) {
    return `${slug}.localhost`;
  }
  return `${slug}.${ROOT_DOMAIN}`;
}

/** Display-only admin host (no scheme), e.g. admin.saurashtra_patel.community.in */
export function communityAdminHostLabel(slug: string, host?: string | null): string {
  const live = singleHostLabel(host, `/admin?c=${slug}`);
  if (live) return live;
  if (ROOT_DOMAIN === "localhost" || ROOT_DOMAIN.endsWith(".localhost")) {
    return `admin.${slug}.localhost`;
  }
  return `admin.${slug}.${ROOT_DOMAIN}`;
}
