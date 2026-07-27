import { z } from "zod";
import { assertPlatform } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { signLaunchToken } from "@/lib/auth/bridge";
import {
  communityAdminUrl,
  communitySiteUrl,
  effectiveHost,
  isCanonicalHost,
  requestOrigin,
} from "@/lib/host";

const schema = z.object({
  slug: z.string().min(1).max(64),
  target: z.enum(["admin", "app"]),
});

/**
 * Main Admin → mint a 60s one-time launch URL for Open app / Open admin.
 * Password is never passed; bridge exchanges the token on the tenant host.
 */
export async function POST(req: Request) {
  try {
    const session = await assertPlatform();
    if (!session) return fail("Unauthorized", 401);

    const ip = getClientIp(req);
    if (!rateLimit(`launch:${session.sub}:${ip}`, 30, 60_000).allowed) {
      return fail("Too many launch attempts", 429);
    }

    const body = schema.parse(await req.json());
    const community = await prisma.community.findUnique({
      where: { slug: body.slug },
      select: { id: true, slug: true, status: true },
    });
    if (!community) return fail("Community not found", 404);

    const { token } = await signLaunchToken({
      userId: session.sub,
      target: body.target,
      communityId: community.id,
      communitySlug: community.slug,
    });

    // On a single-host origin (dev tunnel / LAN IP / preview URL) there is no
    // wildcard DNS, so admin.{slug}.<host> would not resolve. Keep the hop on
    // the origin the request actually came from and carry ?c=<slug>.
    const canonical = isCanonicalHost(effectiveHost(req.headers));
    // Plain path — the bridge appends ?c=<slug> itself in single-host mode.
    const next = body.target === "admin" ? "/admin" : "/dashboard";

    const base = canonical
      ? body.target === "admin"
        ? communityAdminUrl(community.slug, "/api/auth/bridge")
        : communitySiteUrl(community.slug, "/api/auth/bridge")
      : `${requestOrigin(req)}/api/auth/bridge`;

    const url = `${base}?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;

    return ok({ url, target: body.target, slug: community.slug });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    const msg = (e as Error)?.message;
    if (msg === "FORBIDDEN" || msg === "UNAUTHORIZED") return fail("Unauthorized", 401);
    console.error(e);
    return fail("Launch failed", 500);
  }
}
