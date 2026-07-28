import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_ACCESS, COOKIE_ACTIVE_COMMUNITY, COMMUNITY_ADMIN_ROLES } from "@/lib/constants";
import { withSecurityHeaders } from "@/lib/security/headers";
import {
  communityAdminUrl,
  communitySiteUrl,
  effectiveHost,
  mainAdminUrl,
  parseHost,
  type HostKind,
} from "@/lib/host";

function withCors(res: NextResponse) {
  const origin = process.env.CORS_ORIGIN || "*";
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return res;
}

/** Public routes depend on which host you're on. */
function isPublic(pathname: string, kind: HostKind) {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/community" || pathname.startsWith("/api/community/")) return true;
  if (pathname === "/api/health") return true;
  if (pathname.startsWith("/api/public")) return true;
  if (pathname.startsWith("/api/i18n/")) return true;

  if (kind === "main") {
    // Apex = Main Admin only. Public = login page (shown as /login).
    return pathname === "/login" || pathname === "/platform/login";
  }

  if (kind === "admin") {
    return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  }

  // Member website host
  return (
    pathname === "/login" ||
    pathname.startsWith("/otp") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/pending") ||
    pathname.startsWith("/about")
  );
}

const MEMBER_PATHS = [
  "/otp",
  "/register",
  "/pending",
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
  "/notifications",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = effectiveHost(req.headers);
  const parsed = parseHost(host, pathname);
  const c = req.nextUrl.searchParams.get("c");

  // Single-host mode has no slug in the hostname, so the tenant comes from
  // ?c=<slug> or the active-community cookie set by login / the launch bridge.
  const cookieSlug = req.cookies.get(COOKIE_ACTIVE_COMMUNITY)?.value || null;
  const effectiveSlug = parsed.slug || (parsed.singleHost ? c || cookieSlug : null);

  const requestHeaders = new Headers(req.headers);
  if (effectiveSlug) requestHeaders.set("x-community-slug", effectiveSlug);
  requestHeaders.set("x-host-kind", parsed.kind);

  const finish = (res: NextResponse) => {
    if (pathname.startsWith("/api/")) withCors(res);
    return withSecurityHeaders(res);
  };

  /**
   * On a single-host origin (dev tunnel, LAN IP, preview URL) there are no
   * wildcard subdomains, so every cross-panel hop stays on this origin and
   * carries ?c=<slug> instead. Redirecting to admin.{slug}.<host> there only
   * produces ERR_CONNECTION_REFUSED.
   */
  const next = () => finish(NextResponse.next({ request: { headers: requestHeaders } }));

  /**
   * A cross-panel hop that lands on the URL we are already serving is not a
   * hop — it is a redirect loop. On a single-host origin /login?c=<slug> IS
   * the member login, so serve it instead of bouncing to itself.
   */
  const sameOrigin = (path: string, slug?: string | null) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    if (slug) url.searchParams.set("c", slug);
    if (url.href === req.nextUrl.href) return next();
    return finish(NextResponse.redirect(url));
  };
  const toSite = (slug: string, path: string) =>
    parsed.singleHost
      ? sameOrigin(path, slug)
      : finish(NextResponse.redirect(communitySiteUrl(slug, path)));
  const toAdmin = (slug: string, path: string) =>
    parsed.singleHost
      ? sameOrigin(path, slug)
      : finish(NextResponse.redirect(communityAdminUrl(slug, path)));
  const toMain = (path: string) =>
    parsed.singleHost ? sameOrigin(path) : finish(NextResponse.redirect(mainAdminUrl(path)));

  const rewrite = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return finish(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  };

  const redirectPath = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return finish(NextResponse.redirect(url));
  };

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return next();
  }

  if (pathname.startsWith("/api/") && req.method === "OPTIONS") {
    return finish(new NextResponse(null, { status: 204 }));
  }

  // ── Main Admin host: community.in / localhost:3000 ────────────────
  if (parsed.kind === "main") {
    // /login = Main Admin login (no /platform/login in the address bar)
    if (pathname === "/login" || pathname === "/platform/login") {
      if (c) return toSite(c, "/login");
      return rewrite("/platform/login");
    }

    // Member routes on apex → community host (with ?c=) or Main Admin login
    if (MEMBER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (c) return toSite(c, pathname);
      return redirectPath("/login");
    }

    if (pathname.startsWith("/admin")) {
      if (c) return toAdmin(c, pathname);
      return redirectPath("/login");
    }

    // / and /platform/* → rewrite / to /platform (auth checked below)
    if (pathname === "/" || pathname === "") {
      // fall through after setting rewrite target via header? We'll auth then rewrite.
      // Use rewrite only when authenticated — handled below.
    }
  }

  // ── Community Admin host: admin.{slug}.* ──────────────────────────
  if (parsed.kind === "admin" && parsed.slug) {
    if (pathname === "/" || pathname === "") {
      // auth checked below; rewrite when allowed
    }
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/directory") ||
      pathname === "/login" ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/news") ||
      pathname.startsWith("/gallery") ||
      pathname.startsWith("/business") ||
      pathname.startsWith("/menu") ||
      pathname.startsWith("/profile")
    ) {
      return toSite(parsed.slug, pathname);
    }
    if (pathname.startsWith("/platform")) {
      return toMain("/login");
    }
  }

  // ── Member website host: {slug}.* ─────────────────────────────────
  if (parsed.kind === "site" && parsed.slug) {
    if (pathname === "/" || pathname === "") {
      return rewrite("/login");
    }
    if (pathname.startsWith("/admin")) {
      return finish(NextResponse.redirect(communityAdminUrl(parsed.slug, pathname)));
    }
    if (pathname.startsWith("/platform")) {
      return toMain("/login");
    }
  }

  if (isPublic(pathname, parsed.kind)) {
    return next();
  }

  // AUTH_BYPASS must NEVER skip Main Admin / Community Admin guards.
  const bypassUi =
    process.env.AUTH_BYPASS === "true" &&
    !pathname.startsWith("/api/") &&
    parsed.kind === "site" &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/platform");

  if (bypassUi) {
    return next();
  }

  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;

  const loginForHost = () => {
    if (parsed.kind === "main") return "/login";
    if (parsed.kind === "admin") return "/admin/login";
    return "/login";
  };

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      if (
        (req.method === "GET" &&
          (pathname.startsWith("/api/news") ||
            pathname.startsWith("/api/ads") ||
            pathname.startsWith("/api/gallery") ||
            pathname.startsWith("/api/businesses") ||
            pathname.startsWith("/api/blood-donors") ||
            pathname.startsWith("/api/families") ||
            pathname.startsWith("/api/results") ||
            pathname === "/api/health")) ||
        (req.method === "POST" && pathname === "/api/families")
      ) {
        return next();
      }
      // Platform APIs always require real auth (no silent empty lists)
      return finish(
        NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
      );
    }
    const login = req.nextUrl.clone();
    login.pathname = loginForHost();
    login.searchParams.set("next", pathname === "/" ? "/" : pathname);
    return finish(NextResponse.redirect(login));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const roles = (payload.roles as string[]) || [];
    const isPlatform = Boolean(payload.isPlatform);

    // Main Admin area — platform JWT required
    if (parsed.kind === "main" || pathname.startsWith("/platform")) {
      if (!isPlatform) {
        return redirectPath("/login");
      }
      if (pathname === "/" || pathname === "") {
        return rewrite("/platform");
      }
      if (pathname.startsWith("/platform") && pathname !== "/platform/login") {
        return next();
      }
    }

    // Community Admin area
    if (parsed.kind === "admin" || pathname.startsWith("/admin")) {
      const allowed =
        isPlatform || roles.some((r) => (COMMUNITY_ADMIN_ROLES as readonly string[]).includes(r));
      if (!allowed) {
        if (parsed.slug) {
          return finish(NextResponse.redirect(communitySiteUrl(parsed.slug, "/dashboard")));
        }
        return redirectPath("/login");
      }
      if (parsed.kind === "admin" && (pathname === "/" || pathname === "")) {
        return rewrite("/admin");
      }
    }
  } catch {
    if (pathname.startsWith("/api/")) {
      return finish(
        NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
      );
    }
    const login = req.nextUrl.clone();
    login.pathname = loginForHost();
    return finish(NextResponse.redirect(login));
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
