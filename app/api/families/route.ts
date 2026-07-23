import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ items: [], total: 0, page: 1, pageSize: 20, pages: 0 });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;
    const city = searchParams.get("city");
    const surnameGroupId = searchParams.get("surnameGroupId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const sort = searchParams.get("sort") || "submittedAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const where = {
      communityId,
      ...(status ? { status } : {}),
      ...(city ? { city } : {}),
      ...(surnameGroupId ? { surnameGroupId } : {}),
      ...(q
        ? {
            OR: [
              { headNameEn: { contains: q } },
              { headNameGu: { contains: q } },
              { surnameEn: { contains: q } },
              { city: { contains: q } },
              { familyMembers: { some: { fullNameEn: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.family.count({ where }),
      prisma.family.findMany({
        where,
        include: {
          surnameGroup: true,
          familyMembers: true,
          _count: { select: { familyMembers: true } },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (e) {
    console.error(e);
    return fail("Failed to list families", 500);
  }
}

const createSchema = z.object({
  surnameGroupId: z.string(),
  headNameEn: z.string().min(2),
  headNameGu: z.string().optional(),
  surnameEn: z.string().min(1),
  surnameGu: z.string().optional(),
  addressEn: z.string().min(3),
  addressGu: z.string().optional(),
  city: z.string().optional(),
  nativeElderNameEn: z.string().optional(),
  nativeElderPhone: z.string().optional(),
  consentAccepted: z.boolean(),
  members: z
    .array(
      z.object({
        fullNameEn: z.string().min(2),
        fullNameGu: z.string().optional(),
        relation: z.string().optional(),
        mobile: z.string().optional(),
        bloodGroup: z
          .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"])
          .optional(),
        occupation: z.string().optional(),
        education: z.string().optional(),
        currentlyAt: z.string().optional(),
        dateOfBirth: z.string().optional(),
        hasWhatsApp: z.boolean().optional(),
        isHead: z.boolean().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    if (!body.consentAccepted) return fail("Consent is required");

    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);

    // Ensure the chosen surname group belongs to this community (no cross-tenant refs).
    const surname = await prisma.surnameGroup.findFirst({
      where: { id: body.surnameGroupId, communityId },
    });
    if (!surname) return fail("Invalid surname group", 422);

    const family = await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: body.surnameGroupId,
        headNameEn: body.headNameEn,
        headNameGu: body.headNameGu,
        surnameEn: body.surnameEn,
        surnameGu: body.surnameGu,
        addressEn: body.addressEn,
        addressGu: body.addressGu,
        city: body.city,
        nativeElderNameEn: body.nativeElderNameEn,
        nativeElderPhone: body.nativeElderPhone,
        consentAccepted: true,
        status: "PENDING",
        familyMembers: {
          create: body.members.map((m) => ({
            fullNameEn: m.fullNameEn,
            fullNameGu: m.fullNameGu,
            relation: m.relation,
            mobile: m.mobile,
            bloodGroup: m.bloodGroup,
            occupation: m.occupation,
            education: m.education,
            currentlyAt: m.currentlyAt,
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : undefined,
            hasWhatsApp: m.hasWhatsApp ?? true,
            isHead: !!m.isHead,
          })),
        },
      },
      include: { familyMembers: true, surnameGroup: true },
    });

    // Create pending users for members with login mobile (scoped to this community)
    for (const m of body.members) {
      if (!m.mobile) continue;
      await prisma.user.upsert({
        where: { communityId_mobile: { communityId, mobile: m.mobile } },
        update: {},
        create: { communityId, mobile: m.mobile, status: "PENDING" },
      });
    }

    return created(family);
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to create family", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const body = z
      .object({
        id: z.string(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
        rejectReason: z.string().optional(),
      })
      .parse(await req.json());

    if (body.status === "REJECTED" && !body.rejectReason) {
      return fail("Reject reason is required");
    }

    // Enforce tenant ownership before mutating.
    const existing = await prisma.family.findFirst({ where: { id: body.id, communityId } });
    if (!existing) return fail("Family not found", 404);

    const family = await prisma.family.update({
      where: { id: body.id },
      data: {
        status: body.status,
        rejectReason: body.rejectReason,
        approvedAt: body.status === "APPROVED" ? new Date() : undefined,
        whatsappNotified: true,
      },
      include: { familyMembers: true },
    });

    if (body.status === "APPROVED") {
      for (const m of family.familyMembers) {
        if (!m.mobile) continue;
        await prisma.user.updateMany({
          where: { mobile: m.mobile, communityId },
          data: { status: "APPROVED" },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.sub,
        action: `family.${body.status.toLowerCase()}`,
        entity: "Family",
        entityId: family.id,
        after: { status: body.status, rejectReason: body.rejectReason },
      },
    });

    return ok(family);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to update family", 500);
  }
}
