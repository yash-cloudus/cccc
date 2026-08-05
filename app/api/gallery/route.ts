import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET() {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok([]);

    // Lazily deactivate albums whose end date has passed — no cron needed.
    await prisma.galleryAlbum.updateMany({
      where: {
        communityId,
        isVisible: true,
        endDate: { lte: new Date(Date.now() - 86_400_000) },
      },
      data: { isVisible: false },
    });

    const items = await prisma.galleryAlbum.findMany({
      where: { communityId },
      include: { images: true, videos: true, _count: { select: { images: true } } },
      orderBy: { startDate: "desc" },
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
  descriptionEn: z.string().optional(),
  coverUrl: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accent: z.string().optional(),
  isVisible: z.boolean().optional(),
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
        descriptionEn: body.descriptionEn,
        coverUrl: body.coverUrl,
        youtubeUrl: body.youtubeUrl,
        accent: body.accent,
        isVisible: body.isVisible ?? true,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
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
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  accent: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  /** Full replace of the album's photos, in display order. Omit to leave untouched. */
  images: z
    .array(z.object({ imageUrl: z.string().min(1), caption: z.string().optional() }))
    .optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "CONTENT_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const { id, images, startDate, endDate, ...rest } = patchSchema.parse(await req.json());
    // startDate/endDate arrive as ISO/date strings; Prisma needs a Date.
    const data = {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    };
    const existing = await prisma.galleryAlbum.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Album not found", 404);

    const album = await prisma.$transaction(async (tx) => {
      await tx.galleryAlbum.update({ where: { id }, data });
      if (images) {
        await tx.galleryImage.deleteMany({ where: { albumId: id } });
        if (images.length) {
          await tx.galleryImage.createMany({
            data: images.map((img, i) => ({ ...img, albumId: id, sortOrder: i })),
          });
        }
      }
      return tx.galleryAlbum.findUnique({
        where: { id },
        include: { images: { orderBy: { sortOrder: "asc" } }, _count: { select: { images: true } } },
      });
    });
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
