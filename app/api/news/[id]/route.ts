import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

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
      select: { id: true },
    });
    if (!existing) return fail("News not found", 404);
    const body = z
      .object({
        titleEn: z.string().optional(),
        titleGu: z.string().optional(),
        contentEn: z.string().optional(),
        contentGu: z.string().optional(),
        imageUrl: z.string().optional(),
        isPinned: z.boolean().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(await req.json());
    const item = await prisma.news.update({ where: { id }, data: body });
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
