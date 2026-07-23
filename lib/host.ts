import { ROOT_DOMAIN } from "@/lib/constants";

/**
 * Host / domain helpers for the multi-tenant URL scheme:
 *
 *   Main Admin:          community.in
 *   Website (members):   {slug}.community.in
 *   Community Admin:     admin.{slug}.community.in
 *
 * Local (no hosts file needed — browsers resolve *.localhost → 127.0.0.1):
 *
 *   Main Admin:          localhost:3000
 *   Website:             {slug}.localhost:3000
 *   Community Admin:     admin.{slug}.localhost:3000
 */

export type HostKind = "main" | "site" | "admin" | "unknown";

export type ParsedHost = {
  kind: HostKind;
  /** Community slug when kind is "site" or "admin". */
  slug: string | null;
  hostname: string;
};

const RESERVED_TOP = new Set(["www", "platform", "api", "mail", "static", "assets", "app"]);

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/** True when hostname is bare localhost / 127.0.0.1 / ::1 (Main Admin local). */
function isBareLocal(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Parse a Host header into Main Admin / member site / community admin.
 * Safe for middleware (no Node-only APIs).
 */
export function parseHost(hostHeader: string | null | undefined): ParsedHost {
  if (!hostHeader) return { kind: "unknown", slug: null, hostname: "" };
  const hostname = stripPort(hostHeader);

  // Local apex → Main Admin
  if (isBareLocal(hostname)) {
    return { kind: "main", slug: null, hostname };
  }

  const parts = hostname.split(".").filter(Boolean);

  // Local: admin.{slug}.localhost
  if (parts.length >= 3 && parts[parts.length - 1] === "localhost" && parts[0] === "admin") {
    const slug = parts[1];
    if (slug && !RESERVED_TOP.has(slug) && slug !== "admin") {
      return { kind: "admin", slug, hostname };
    }
  }

  // Local: {slug}.localhost
  if (parts.length === 2 && parts[1] === "localhost") {
    const slug = parts[0];
    if (slug && !RESERVED_TOP.has(slug) && slug !== "admin") {
      return { kind: "site", slug, hostname };
    }
    return { kind: "main", slug: null, hostname };
  }

  // Production-style: need at least domain.tld (2) or more
  // admin.{slug}.{root...}  e.g. admin.saurashtra_patel.community.in
  if (parts.length >= 4 && parts[0] === "admin") {
    const slug = parts[1];
    if (slug && !RESERVED_TOP.has(slug)) {
      return { kind: "admin", slug, hostname };
    }
  }

  // {slug}.{root...}  e.g. saurashtra_patel.community.in  (3+ parts, not admin)
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub === "www" || sub === "platform") {
      // www / legacy platform → Main Admin
      return { kind: "main", slug: null, hostname };
    }
    if (sub !== "admin" && !RESERVED_TOP.has(sub)) {
      return { kind: "site", slug: sub, hostname };
    }
  }

  // Apex community.in (2 parts) → Main Admin
  if (parts.length <= 2) {
    return { kind: "main", slug: null, hostname };
  }

  return { kind: "unknown", slug: null, hostname };
}

/** Protocol for absolute URLs (http on localhost, https in production). */
export function appProtocol(): "http" | "https" {
  if (process.env.NEXT_PUBLIC_APP_PROTOCOL === "http") return "http";
  if (process.env.NEXT_PUBLIC_APP_PROTOCOL === "https") return "https";
  return isLocalRoot() ? "http" : "https";
}

/** Optional port suffix for local absolute URLs (":3000"). */
export function appPortSuffix(): string {
  if (process.env.NEXT_PUBLIC_APP_PORT) return `:${process.env.NEXT_PUBLIC_APP_PORT}`;
  if (isLocalRoot()) return ":3000";
  return "";
}

function isLocalRoot(): boolean {
  const d = ROOT_DOMAIN.toLowerCase();
  return d === "localhost" || d.endsWith(".localhost");
}

/** Host used for Main Admin (no scheme). */
export function mainAdminHost(): string {
  if (isLocalRoot()) return `localhost${appPortSuffix()}`;
  return ROOT_DOMAIN;
}

/** Host for member website of a community. */
export function communitySiteHost(slug: string): string {
  if (isLocalRoot()) return `${slug}.localhost${appPortSuffix()}`;
  return `${slug}.${ROOT_DOMAIN}`;
}

/** Host for Community Admin panel of a community. */
export function communityAdminHost(slug: string): string {
  if (isLocalRoot()) return `admin.${slug}.localhost${appPortSuffix()}`;
  return `admin.${slug}.${ROOT_DOMAIN}`;
}

export function mainAdminUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appProtocol()}://${mainAdminHost()}${p}`;
}

export function communitySiteUrl(slug: string, path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appProtocol()}://${communitySiteHost(slug)}${p}`;
}

export function communityAdminUrl(slug: string, path = "/admin"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appProtocol()}://${communityAdminHost(slug)}${p}`;
}
