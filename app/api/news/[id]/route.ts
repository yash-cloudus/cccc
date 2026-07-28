import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";
import { notifyNewsPost } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const communityId = await getActiveCommunityId();
  if (!communityId) return fail("News not found", 404);
  const item = await prisma.news.findFirst({ where: { id, communityId } });
  if (!item) return fail("News not found", 404);
  return ok(item);
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getWritableCommunityId();
    const existing = await prisma.news.findFirst({
      where: { id, communityId },
      select: { id: true, notificationSent: true },
    });
    if (!existing) return fail("News not found", 404);
    const body = z
      .object({
        titleEn: z.string().optional(),
        // Nullable: the editor clears a field by sending "" / null, and an
        // omitted key still means "leave it alone".
        titleGu: z.string().nullish(),
        contentEn: z.string().optional(),
        contentGu: z.string().nullish(),
        imageUrl: z.string().nullish(),
        documentUrl: z.string().nullish(),
        documentName: z.string().nullish(),
        isPinned: z.boolean().optional(),
        isPublished: z.boolean().optional(),
        sendNotification: z.boolean().optional(),
        publishedAt: z.string().optional(),
      })
      .parse(await req.json());
    const { publishedAt, sendNotification, ...rest } = body;

    /** Blank means "remove this"; undefined means "not part of this edit". */
    const clear = (v: string | null | undefined) =>
      v === undefined ? undefined : v && v.trim() ? v : null;

    // Only fires once — already-sent posts can't be re-notified from here.
    const shouldNotify = !!sendNotification && !existing.notificationSent;
    const item = await prisma.news.update({
      where: { id },
      data: {
        ...(rest.titleEn !== undefined ? { titleEn: rest.titleEn } : {}),
        ...(rest.contentEn !== undefined ? { contentEn: rest.contentEn } : {}),
        ...(rest.isPinned !== undefined ? { isPinned: rest.isPinned } : {}),
        ...(rest.isPublished !== undefined ? { isPublished: rest.isPublished } : {}),
        titleGu: clear(rest.titleGu),
        contentGu: clear(rest.contentGu),
        imageUrl: clear(rest.imageUrl),
        documentUrl: clear(rest.documentUrl),
        documentName: clear(rest.documentName),
        ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}),
        ...(shouldNotify ? { notificationSent: true } : {}),
      },
    });
    if (shouldNotify) {
      await notifyNewsPost(item, communityId);
    }
    return ok(item);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update news", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getWritableCommunityId();
    const res = await prisma.news.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("News not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    return fail("Failed to delete news", 500);
  }
}
