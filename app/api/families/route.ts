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
  surnameGroupId: z.string().optional(),
  surnameEn: z.string().optional(),
  surnameGu: z.string().optional(),
  headNameEn: z.string().min(2),
  headNameGu: z.string().optional(),
  addressEn: z.string().min(3),
  addressGu: z.string().optional(),
  city: z.string().optional(),
  nativePlace: z.string().optional(),
  email: z.string().optional(),
  villageAreaId: z.string().optional().nullable(),
  livesOutsideVillage: z.boolean().optional(),
  nativeElderNameEn: z.string().optional(),
  nativeElderNameGu: z.string().optional(),
  nativeElderPhone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
        occupationOther: z.string().optional(),
        education: z.string().optional(),
        course: z.string().optional(),
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

    const community = await prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { type: true },
    });

    const { getParivarLockedSurname } = await import("@/lib/community-defaults");
    const { validateFamilyByType, validateHeadMobile } = await import("@/lib/family-form");

    const typeErr = validateFamilyByType(community.type, {
      headNameEn: body.headNameEn,
      headNameGu: body.headNameGu,
      surnameGroupId: body.surnameGroupId,
      surnameEn: body.surnameEn,
      surnameGu: body.surnameGu,
      addressEn: body.addressEn,
      addressGu: body.addressGu,
      city: body.city,
      nativePlace: body.nativePlace,
      email: body.email,
      villageAreaId: body.villageAreaId,
      livesOutsideVillage: body.livesOutsideVillage,
      nativeElderNameEn: body.nativeElderNameEn,
      nativeElderPhone: body.nativeElderPhone,
    });
    if (typeErr) return fail(typeErr, 422);

    const headMobileErr = validateHeadMobile(body.members);
    if (headMobileErr) return fail(headMobileErr, 422);

    let surname = community.type === "PARIVAR"
      ? await getParivarLockedSurname(prisma, communityId)
      : null;

    if (!surname && body.surnameGroupId) {
      surname = await prisma.surnameGroup.findFirst({
        where: { id: body.surnameGroupId, communityId },
      });
    }
    if (!surname && body.surnameEn?.trim() && community.type === "GAM") {
      const en = body.surnameEn.trim();
      surname = await prisma.surnameGroup.findFirst({
        where: { communityId, nameEn: en },
      });
      if (!surname) {
        surname = await prisma.surnameGroup.create({
          data: {
            communityId,
            nameEn: en,
            nameGu: body.surnameGu?.trim() || en,
            needsReview: true,
          },
        });
      }
    }
    if (!surname) return fail("Invalid surname group", 422);

    const outside = body.livesOutsideVillage || !body.villageAreaId;
    const villageAreaId =
      community.type === "GAM" && !outside && body.villageAreaId
        ? body.villageAreaId
        : null;
    if (villageAreaId) {
      const v = await prisma.villageArea.findFirst({
        where: { id: villageAreaId, communityId },
      });
      if (!v) return fail("Invalid village", 422);
    }

    const family = await prisma.family.create({
      data: {
        communityId,
        surnameGroupId: surname.id,
        headNameEn: body.headNameEn,
        headNameGu: body.headNameGu,
        surnameEn: surname.nameEn,
        surnameGu: surname.nameGu,
        addressEn: body.addressEn,
        addressGu: body.addressGu,
        city: body.city,
        villageAreaId,
        nativeElderNameEn: body.nativeElderNameEn,
        nativeElderNameGu: body.nativeElderNameGu,
        nativeElderPhone: body.nativeElderPhone,
        latitude: body.latitude,
        longitude: body.longitude,
        consentAccepted: true,
        status: "PENDING",
        familyMembers: {
          create: body.members.map((m, i) => {
            const isHead = m.isHead ?? i === 0;
            return {
              fullNameEn: m.fullNameEn,
              fullNameGu: m.fullNameGu,
              relation: isHead ? "Head" : m.relation,
              mobile: m.mobile?.replace(/\D/g, "") || null,
              bloodGroup: m.bloodGroup,
              occupation: m.occupation,
              occupationOther: m.occupationOther,
              education: m.education,
              course: m.course,
              currentlyAt: m.currentlyAt || body.city,
              dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : undefined,
              hasWhatsApp: m.hasWhatsApp ?? true,
              isHead,
            };
          }),
        },
      },
      include: { familyMembers: true, surnameGroup: true },
    });

    for (const m of body.members) {
      const mobile = m.mobile?.replace(/\D/g, "");
      if (!mobile) continue;
      await prisma.user.upsert({
        where: { communityId_mobile: { communityId, mobile } },
        update: {},
        create: { communityId, mobile, status: "PENDING" },
      });
    }

    return created(family);
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    const message =
      process.env.NODE_ENV === "development" && e instanceof Error
        ? e.message || "Failed to create family"
        : "Failed to create family";
    return fail(message, 500);
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
    } else if (body.status === "REJECTED") {
      for (const m of family.familyMembers) {
        if (!m.mobile) continue;
        await prisma.user.updateMany({
          where: { mobile: m.mobile, communityId, status: { not: "SUSPENDED" } },
          data: { status: "REJECTED" },
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
