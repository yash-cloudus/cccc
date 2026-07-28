import { prisma } from "@/lib/prisma";

/** Fan out an in-app notification for a news post to every approved member of the community. */
export async function notifyNewsPost(
  news: {
    id: string;
    titleEn: string;
    titleGu: string | null;
    contentEn: string;
    contentGu: string | null;
  },
  communityId: string,
) {
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
