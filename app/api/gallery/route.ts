import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET() {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok([]);
    const items = await prisma.galleryAlbum.findMany({
      where: { communityId },
      include: { images: true, videos: true, _count: { select: { images: true } } },
      orderBy: { albumDate: "desc" },
    });
    return ok(items);
  } catch (e) {
    console.error(e);
    return fail("Failed to list albums", 500);
  }
}

const schema = z.object({
  titleEn: z.string().min(2),
  titleGu: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  albumDate: z.string().optional(),
  youtubeUrl: z.string().optional(),
  images: z.array(z.object({ imageUrl: z.string(), caption: z.string().optional() })).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "CONTENT_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const body = schema.parse(await req.json());
    const album = await prisma.galleryAlbum.create({
      data: {
        communityId,
        titleEn: body.titleEn,
        titleGu: body.titleGu,
        description: body.description,
        coverUrl: body.coverUrl,
        youtubeUrl: body.youtubeUrl,
        albumDate: body.albumDate ? new Date(body.albumDate) : undefined,
        images: body.images?.length
          ? { create: body.images.map((img, i) => ({ ...img, sortOrder: i })) }
          : undefined,
      },
      include: { images: true },
    });
    return created(album);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to create album", 500);
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  isVisible: z.boolean().optional(),
  titleEn: z.string().optional(),
  titleGu: z.string().optional(),
  coverUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "CONTENT_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const { id, ...data } = patchSchema.parse(await req.json());
    const existing = await prisma.galleryAlbum.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Album not found", 404);
    const album = await prisma.galleryAlbum.update({ where: { id }, data });
    return ok(album);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update album", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "CONTENT_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.galleryAlbum.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Album not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    return fail("Failed to delete album", 500);
  }
}
