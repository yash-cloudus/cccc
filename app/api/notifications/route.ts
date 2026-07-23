import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await requireSession();
    const items = await prisma.notificationLog.findMany({
      where: { userId: session.sub },
      include: { notification: true },
      orderBy: { sentAt: "desc" },
      take: 50,
    });
    return ok(items);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    return fail("Failed to list notifications", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as { id?: string; all?: boolean };
    if (body.all) {
      await prisma.notificationLog.updateMany({
        where: { userId: session.sub, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return ok({ updated: true });
    }
    if (!body.id) return fail("id required");
    const row = await prisma.notificationLog.update({
      where: { id: body.id },
      data: { isRead: true, readAt: new Date() },
    });
    return ok(row);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    return fail("Failed to update notification", 500);
  }
}
