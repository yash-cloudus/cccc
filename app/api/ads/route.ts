import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveCommunityId,
  getSessionPayload,
  getWritableCommunityId,
  isCommunityAdmin,
} from "@/lib/tenant";
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
  /** Members submit for a fixed one-year run; only admins pass explicit dates. */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
      // A member's banner always runs one year from approval-time submission,
      // and only so many may be live at once.
      const live = await prisma.advertisement.count({
        where: {
          communityId,
          ownerId: session.sub,
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
    const end = body.endDate
      ? new Date(body.endDate)
      : new Date(new Date(start).setFullYear(start.getFullYear() + 1));

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
        type: body.type ?? "general",
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
    const body = z
      .object({ id: z.string(), event: z.enum(["view", "click"]) })
      .parse(await req.json());
    // Only track events for ads owned by the active community.
    const target = await prisma.advertisement.findFirst({
      where: { id: body.id, communityId },
      select: { id: true },
    });
    if (!target) return fail("Ad not found", 404);
    const ad = await prisma.advertisement.update({
      where: { id: body.id },
      data:
        body.event === "view"
          ? { views: { increment: 1 } }
          : { clicks: { increment: 1 } },
    });
    if (body.event === "click") {
      await prisma.advertisementClick.create({ data: { adId: ad.id } });
    }
    return ok(ad);
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to track ad", 500);
  }
}
