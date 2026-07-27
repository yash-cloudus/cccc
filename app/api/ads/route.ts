import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId, isCommunityAdmin } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok([]);
    const activeOnly = new URL(req.url).searchParams.get("active") === "1";
    const now = new Date();
    const items = await prisma.advertisement.findMany({
      where: activeOnly
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
  type: z.enum(["premium", "general"]).optional(),
  startDate: z.string(),
  endDate: z.string(),
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
    const ad = await prisma.advertisement.create({
      data: {
        communityId,
        ownerId: session.sub,
        name: body.name,
        pitch: body.pitch,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl,
        ownerName: body.ownerName,
        ownerMobile: body.ownerMobile,
        category: body.category,
        type: body.type ?? "general",
        source: isAdmin ? "admin" : "user",
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        priority: body.priority ?? 0,
        paymentProof: body.paymentProof,
        upiQrUrl: body.upiQrUrl,
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
