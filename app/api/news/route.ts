import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ items: [], total: 0, page: 1, pageSize: 20 });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Number(searchParams.get("pageSize") || 20));

    const where = {
      communityId,
      isPublished: true,
      ...(q
        ? {
            OR: [
              { titleEn: { contains: q } },
              { titleGu: { contains: q } },
              { contentEn: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.news.count({ where }),
      prisma.news.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({ items, total, page, pageSize });
  } catch (e) {
    console.error(e);
    return fail("Failed to list news", 500);
  }
}

const schema = z.object({
  titleEn: z.string().min(2),
  titleGu: z.string().optional(),
  contentEn: z.string().min(2),
  contentGu: z.string().optional(),
  imageUrl: z.string().optional(),
  documentUrl: z.string().optional(),
  documentName: z.string().optional(),
  linkUrl: z.string().optional(),
  linkInternal: z.string().optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sendNotification: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "CONTENT_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const body = schema.parse(await req.json());
    const news = await prisma.news.create({
      data: {
        communityId,
        titleEn: body.titleEn,
        titleGu: body.titleGu,
        contentEn: body.contentEn,
        contentGu: body.contentGu,
        imageUrl: body.imageUrl,
        documentUrl: body.documentUrl,
        documentName: body.documentName,
        linkUrl: body.linkUrl,
        linkInternal: body.linkInternal,
        isPinned: !!body.isPinned,
        isPublished: body.isPublished ?? true,
        notificationSent: !!body.sendNotification,
        authorId: session.sub,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      },
    });

    if (body.sendNotification) {
      const notification = await prisma.notification.create({
        data: {
          titleEn: news.titleEn,
          titleGu: news.titleGu,
          bodyEn: news.contentEn.slice(0, 280),
          bodyGu: news.contentGu?.slice(0, 280),
          linkUrl: `/news/${news.id}`,
          channel: "IN_APP",
        },
      });
      const users = await prisma.user.findMany({
        where: { status: "APPROVED", communityId },
        select: { id: true },
      });
      if (users.length) {
        await prisma.notificationLog.createMany({
          data: users.map((u) => ({ notificationId: notification.id, userId: u.id })),
        });
      }
    }

    return created(news);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to create news", 500);
  }
}
