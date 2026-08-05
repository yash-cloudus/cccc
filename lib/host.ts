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
  /**
   * True when the host is NOT part of the configured wildcard root domain —
   * a VS Code dev tunnel, a LAN IP, a preview URL. Such a host has exactly
   * one name and no wildcard DNS, so `admin.{slug}.<host>` cannot resolve.
   * In this mode panels are selected by path and the tenant comes from
   * `?c=` / the active-community cookie / the session.
   */
  singleHost: boolean;
};

/**
 * Member-site paths, used to pick a panel when routing by path.
 *
 * This is the ONE place this list is allowed to live — middleware.ts imports
 * it rather than keeping its own copy. It used to have a second, hand-typed
 * copy in middleware.ts that drifted out of sync (missing "/organ-donation"
 * and "/nri" cost a signed-in member a silent redirect to /login on any
 * single-host origin), so a route added here and forgotten there — or vice
 * versa — is now structurally impossible.
 *
 * Deliberately excludes "/login": which panel's login a bare /login belongs to
 * depends on the resolved tenant, not a static prefix match, so middleware
 * handles it as its own branch instead of folding it into this list.
 */
export const MEMBER_PATH_PREFIXES = [
  "/dashboard",
  "/directory",
  "/news",
  "/gallery",
  "/business",
  "/menu",
  "/profile",
  "/about",
  "/ads",
  "/results",
  "/education",
  "/blood-group",
  "/donation",
  "/organ-donation",
  "/nri",
  "/notifications",
  "/otp",
  "/register",
  "/pending",
];

/**
 * The hostname the CLIENT actually used.
 *
 * A tunnel or reverse proxy rewrites `Host` to the upstream it dials — a VS
 * Code dev tunnel sends `Host: localhost:3000` and puts the public name in
 * `x-forwarded-host`. Trusting `Host` alone therefore makes a tunnel request
 * look local, and every generated link points at the visitor's own machine.
 *
 * Note this header is client-settable when not behind a trusted proxy. It only
 * decides which URL we *build*; tenant access is enforced by the session JWT
 * (see getActiveCommunity), so a forged value cannot reach another community's
 * data.
 */
export function effectiveHost(headers: {
  get(name: string): string | null;
}): string | null {
  const fwd = headers.get("x-forwarded-host");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("host");
}

/**
 * True when `hostHeader` belongs to the configured ROOT_DOMAIN scheme, i.e.
 * wildcard subdomain routing actually resolves for it.
 */
export function isCanonicalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const h = stripPort(hostHeader);
  if (isBareLocal(h)) return true;
  const root = ROOT_DOMAIN.toLowerCase();
  if (root === "localhost" || root.endsWith(".localhost")) {
    return h === "localhost" || h.endsWith(".localhost");
  }
  return h === root || h.endsWith(`.${root}`);
}

/**
 * Browser-side single-host check — same rule as `ParsedHost.singleHost`, for
 * client components that build a cross-panel link (Main Admin ↔ community
 * site ↔ community admin) and need to know whether an absolute
 * `{slug}.ROOT_DOMAIN` URL will actually resolve from the tab it's running in,
 * or whether it has to stay same-origin with a `?c=` query param instead.
 * `false` during SSR/build (no `window`) — those renders don't emit hrefs.
 */
export function isSingleHostBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !isCanonicalHost(window.location.host);
}

const RESERVED_TOP = new Set(["www", "platform", "api", "mail", "static", "assets", "app"]);

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/** True when hostname is bare localhost / 127.0.0.1 / ::1 (Main Admin local). */
function isBareLocal(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Which panel a path belongs to, used only in single-host mode. */
function kindFromPath(pathname?: string): HostKind {
  if (!pathname) return "main";
  // An API call belongs to whichever panel called it — /api/... says nothing
  // about the tenant. Claiming "main" here made getActiveCommunity refuse to
  // resolve a community at all ("Community not found" on submit, even though
  // the page that posted rendered fine), and sent a signed-in member's API
  // calls to /login because the apex guard demands a platform JWT.
  if (pathname === "/api" || pathname.startsWith("/api/")) return "unknown";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return "main";
  if (MEMBER_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "site";
  }
  return "main";
}

/**
 * Parse a Host header into Main Admin / member site / community admin.
 * Safe for middleware (no Node-only APIs).
 */
export function parseHost(
  hostHeader: string | null | undefined,
  pathname?: string,
): ParsedHost {
  if (!hostHeader) return { kind: "unknown", slug: null, hostname: "", singleHost: false };
  const hostname = stripPort(hostHeader);

  // Local apex → Main Admin
  if (isBareLocal(hostname)) {
    return { kind: "main", slug: null, hostname, singleHost: false };
  }

  // Host outside the configured root domain (dev tunnel / IP / preview URL).
  // There is no wildcard DNS here, so never derive a slug from the hostname —
  // doing so used to turn "h8wnp-3000.inc1.devtunnels.ms" into the community
  // "h8wnp-3000" and redirect to a host that does not exist. Pick the panel
  // from the path instead; the tenant comes from ?c= / cookie / session.
  if (!isCanonicalHost(hostname)) {
    return { kind: kindFromPath(pathname), slug: null, hostname, singleHost: true };
  }

  const parts = hostname.split(".").filter(Boolean);

  // Local: admin.{slug}.localhost or admin.foo.bar.localhost -> foo_bar
  if (parts.length >= 3 && parts[parts.length - 1] === "localhost" && parts[0] === "admin") {
    const slug = parts.slice(1, -1).join("_");
    if (slug && !RESERVED_TOP.has(slug) && slug !== "admin") {
      return { kind: "admin", slug, hostname, singleHost: false };
    }
  }

  // Local: {slug}.localhost or foo.bar.localhost -> foo_bar
  if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
    const slug = parts.slice(0, -1).join("_");
    if (slug && !RESERVED_TOP.has(slug) && slug !== "admin") {
      return { kind: "site", slug, hostname, singleHost: false };
    }
    return { kind: "main", slug: null, hostname, singleHost: false };
  }

  // Production-style: need at least domain.tld (2) or more
  // admin.{slug}.{root...}  e.g. admin.saurashtra_patel.community.in
  if (parts.length >= 4 && parts[0] === "admin") {
    const slug = parts[1];
    if (slug && !RESERVED_TOP.has(slug)) {
      return { kind: "admin", slug, hostname, singleHost: false };
    }
  }

  // {slug}.{root...}  e.g. saurashtra_patel.community.in  (3+ parts, not admin)
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub === "www" || sub === "platform") {
      // www / legacy platform → Main Admin
      return { kind: "main", slug: null, hostname, singleHost: false };
    }
    if (sub !== "admin" && !RESERVED_TOP.has(sub)) {
      return { kind: "site", slug: sub, hostname, singleHost: false };
    }
  }

  // Apex community.in (2 parts) → Main Admin
  if (parts.length <= 2) {
    return { kind: "main", slug: null, hostname, singleHost: false };
  }

  return { kind: "unknown", slug: null, hostname, singleHost: false };
}

/**
 * Origin the client actually used, taken from the Host header.
 *
 * `new URL(req.url).origin` is the *internal* origin Next.js was reached on
 * (localhost:3000), which is wrong behind a tunnel or reverse proxy — links
 * built from it point back at the server's own loopback address.
 */
export function requestOrigin(req: Request): string {
  const host = effectiveHost(req.headers) || "";
  const fwdProto = req.headers.get("x-forwarded-proto");
  const proto =
    fwdProto?.split(",")[0].trim() ||
    (isBareLocal(stripPort(host)) || host.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
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
