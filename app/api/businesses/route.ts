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

const opt = (max = 191) => z.string().max(max).optional();

const schema = z.object({
  memberId: opt(),
  nameEn: z.string().min(2),
  nameGu: opt(),
  description: opt(2000),
  descriptionGu: opt(2000),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile required"),
  whatsapp: z.union([z.literal(""), z.string().regex(/^[6-9]\d{9}$/)]).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  address: z.string().min(3).max(2000),
  addressGu: opt(2000),
  city: opt(),
  estd: opt(8),
  mapUrl: opt(1000),
  logoUrl: opt(1000),
  website: opt(),
  instagram: opt(),
  facebook: opt(),
  youtube: opt(),
  categoryId: opt(),
  familyId: opt(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const communityId = await getWritableCommunityId();
    const { memberId, ...body } = schema.parse(await req.json());

    // Both the member and the category must belong to this community, so one
    // tenant cannot attach a business to another tenant's records.
    const member = memberId
      ? await prisma.familyMember.findFirst({
          where: { id: memberId, family: { communityId } },
          select: { id: true, familyId: true },
        })
      : null;
    if (memberId && !member) return fail("Member not found", 404);

    if (body.categoryId) {
      const category = await prisma.dropdownOption.findFirst({
        where: { id: body.categoryId, communityId },
        select: { id: true },
      });
      if (!category) return fail("Category not found", 404);
    }

    const business = await prisma.business.create({
      data: {
        ...body,
        // Blank optional strings are stored as NULL rather than "".
        whatsapp: body.whatsapp || null,
        email: body.email || null,
        communityId,
        userId: session.sub,
        memberId: member?.id ?? null,
        familyId: body.familyId ?? member?.familyId ?? null,
        isApproved: false,
      },
    });
    return created(business);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to create business", 500);
  }
}
