import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ items: [], total: 0, page: 1, pageSize: 20 });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const categoryId = searchParams.get("categoryId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Number(searchParams.get("pageSize") || 20));

    const where = {
      communityId,
      isApproved: true,
      isVisible: true,
      ...(categoryId ? { categoryId } : {}),
      ...(q
        ? {
            OR: [
              { nameEn: { contains: q } },
              { nameGu: { contains: q } },
              { description: { contains: q } },
              { city: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        include: { category: true, gallery: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({ items, total, page, pageSize });
  } catch (e) {
    console.error(e);
    return fail("Failed to list businesses", 500);
  }
}

const schema = z.object({
  nameEn: z.string().min(2),
  nameGu: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  categoryId: z.string().optional(),
  familyId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const communityId = await getWritableCommunityId();
    const body = schema.parse(await req.json());
    const business = await prisma.business.create({
      data: { ...body, communityId, userId: session.sub, isApproved: false },
    });
    return created(business);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to create business", 500);
  }
}
