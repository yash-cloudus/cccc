import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, getClientIp, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveCommunityId,
  getSessionPayload,
  getWritableCommunityId,
  isCommunityAdmin,
} from "@/lib/tenant";
import { getAdPriceTiersForCommunity } from "@/lib/tenant-data";
import { AD_DURATION_MONTHS } from "@/lib/admin-settings";
import { MAX_BANNERS_PER_MEMBER } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok([]);
    const params = new URL(req.url).searchParams;
    const activeOnly = params.get("active") === "1";
    // "તમારા બેનર" — everything this member submitted, whatever its status.
    const mine = params.get("mine") === "1";
    const session = mine ? await getSessionPayload() : null;
    if (mine && !session) return fail("Unauthorized", 401);

    const now = new Date();
    const items = await prisma.advertisement.findMany({
      where: mine
        ? { communityId, ownerId: session!.sub }
        : activeOnly
          ? { communityId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } }
          : { communityId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return ok(items);
  } catch (e) {
    console.error(e);
    return fail("Failed to list ads", 500);
  }
}

const schema = z.object({
  name: z.string().min(2),
  pitch: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  ownerName: z.string().max(120).optional(),
  ownerMobile: z.string().max(20).optional(),
  category: z.string().max(120).optional(),
  /** Business this banner links to — contact details come from it. */
  businessId: z.string().optional(),
  type: z.enum(["premium", "general"]).optional(),
  /** Only admins pass explicit dates — members pick a plan (below) instead. */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  /** Plan a member chose on the "Add a new banner" screen — 6 or 12 months. */
  months: z.union([z.literal(6), z.literal(12)]).optional(),
  priority: z.number().int().optional(),
  paymentProof: z.string().optional(),
  upiQrUrl: z.string().optional(),
  // NOTE: `source` is deliberately NOT accepted from the body — it is derived
  // from the caller's role below, so a member cannot pass source:"admin" and
  // make their own submission look admin-created.
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const communityId = await getWritableCommunityId();
    const body = schema.parse(await req.json());
    const isAdmin = isCommunityAdmin(session);

    if (!isAdmin) {
      // Only premium ads are "banners" — every business also carries a free
      // general ad, which must not count against the member's banner limit.
      const live = await prisma.advertisement.count({
        where: {
          communityId,
          ownerId: session.sub,
          type: "premium",
          status: { in: ["PENDING", "ACTIVE"] },
        },
      });
      if (live >= MAX_BANNERS_PER_MEMBER) {
        return fail(`You can keep at most ${MAX_BANNERS_PER_MEMBER} banners`, 409);
      }
      if (!body.businessId) return fail("Pick the business this banner links to");
      if (!body.imageUrl) return fail("Banner image is required");
      if (!body.paymentProof) return fail("Payment screenshot is required");
    }

    // The linked business must be in this community and owned by the caller.
    if (body.businessId) {
      const business = await prisma.business.findFirst({
        where: {
          id: body.businessId,
          communityId,
          ...(isAdmin ? {} : { userId: session.sub }),
        },
        select: { id: true },
      });
      if (!business) return fail("Business not found", 404);
    }

    const start = body.startDate ? new Date(body.startDate) : new Date();
    // A member's run length is the plan they picked on the buy screen; fall
    // back to the community's default plan if that's somehow missing.
    const months =
      body.months ?? AD_DURATION_MONTHS[(await getAdPriceTiersForCommunity(communityId)).defaultDuration];
    const end = body.endDate
      ? new Date(body.endDate)
      : new Date(new Date(start).setMonth(start.getMonth() + months));

    // A member reaching this route has gone through the pay-and-upload flow, so
    // their submission is always a paid banner — never trust `type` from them
    // (the client omits it, which would silently store a paid banner as free).
    const type = isAdmin ? (body.type ?? "general") : "premium";

    /*
     * Paying upgrades the business's EXISTING ad in place — a business owns one
     * ad row for its whole life, flipping general ⇄ premium. Creating a second
     * row would leave the business listed twice and split its views/clicks.
     *
     * Re-upgrading an already-premium ad is blocked so a member cannot overwrite
     * a live banner (and its stats) with a fresh payment; the limit check above
     * already counts those.
     */
    if (type === "premium" && body.businessId) {
      // Older data can hold more than one row per business, so upgrade the row
      // that is actually live — converting a DEACTIVATED leftover would leave
      // the running ad untouched and the payment with nothing to show for it.
      const rows = await prisma.advertisement.findMany({
        where: { communityId, businessId: body.businessId },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true },
      });
      const existing =
        rows.find((r) => r.status === "PENDING" || r.status === "ACTIVE") ?? rows[0] ?? null;

      if (existing) {
        if (existing.type === "premium" && ["PENDING", "ACTIVE"].includes(existing.status)) {
          return fail("This business already has a banner", 409);
        }
        const upgraded = await prisma.advertisement.update({
          where: { id: existing.id },
          data: {
            // Ownership moves to whoever paid — admins upgrade on a member's behalf.
            ownerId: isAdmin ? undefined : session.sub,
            name: body.name,
            pitch: body.pitch ?? undefined,
            imageUrl: body.imageUrl,
            linkUrl: body.linkUrl ?? undefined,
            ownerName: body.ownerName ?? undefined,
            ownerMobile: body.ownerMobile ?? undefined,
            category: body.category ?? undefined,
            type: "premium",
            startDate: start,
            endDate: end,
            priority: body.priority ?? undefined,
            paymentProof: body.paymentProof,
            upiQrUrl: body.upiQrUrl,
            payStatus: body.paymentProof ? "submitted" : "pending",
            // Back to the queue — an admin must verify the payment.
            status: "PENDING",
            rejectReason: null,
          },
        });
        return created(upgraded);
      }
      // No row to convert (admin-created or pre-dating auto-create) — fall through.
    }

    const ad = await prisma.advertisement.create({
      data: {
        communityId,
        ownerId: session.sub,
        name: body.name,
        pitch: body.pitch,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl,
        businessId: body.businessId,
        ownerName: body.ownerName,
        ownerMobile: body.ownerMobile,
        category: body.category,
        type,
        source: isAdmin ? "admin" : "user",
        startDate: start,
        endDate: end,
        priority: body.priority ?? 0,
        paymentProof: body.paymentProof,
        upiQrUrl: body.upiQrUrl,
        payStatus: body.paymentProof ? "submitted" : "pending",
        status: "PENDING",
      },
    });
    return created(ad);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to create ad", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);
    const body = z.object({ id: z.string(), event: z.literal("click") }).parse(await req.json());
    // Only track events for ads owned by the active community.
    const target = await prisma.advertisement.findFirst({
      where: { id: body.id, communityId },
      select: { id: true },
    });
    if (!target) return fail("Ad not found", 404);

    // Identify the visitor: signed-in members by user id, everyone else by IP —
    // this is how a "view" is derived below (first click from a visitor) rather
    // than tracked as a separate impression event.
    const session = await getSessionPayload();
    const ip = getClientIp(req);
    const identity = session?.sub ? { userId: session.sub } : { userId: null, ip };

    const seenBefore = await prisma.advertisementClick.findFirst({
      where: { adId: body.id, ...identity },
      select: { id: true },
    });

    // A visitor's first-ever click counts as both their view and their click;
    // every click after that only adds to the click count, so `views` stays
    // an approximation of unique visitors rather than growing unbounded.
    const ad = await prisma.advertisement.update({
      where: { id: body.id },
      data: seenBefore
        ? { clicks: { increment: 1 } }
        : { views: { increment: 1 }, clicks: { increment: 1 } },
    });
    await prisma.advertisementClick.create({
      data: { adId: body.id, userId: session?.sub ?? null, ip },
    });
    return ok(ad);
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to track ad", 500);
  }
}
