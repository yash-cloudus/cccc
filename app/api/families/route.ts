import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, getClientIp, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";
import { DEFAULT_ISO, digitsOf } from "@/lib/phone";
import { userKey } from "@/lib/auth/user-key";

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
  nativeElderIso: z.string().length(2).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  consentAccepted: z.boolean(),
  // MOBILE_PASSWORD communities only. Optional at the schema level because the
  // same shape serves OTP tenants; required by a runtime branch below.
  // Length only — the per-country rule lives in lib/phone and is applied below,
  // because a US number is ten digits that may start with 2.
  loginMobile: z.string().min(4).max(20).optional(),
  loginMobileIso: z.string().length(2).optional(),
  loginPassword: z.string().regex(/^\d{6}$/).optional(),
  members: z
    .array(
      z.object({
        fullNameEn: z.string().min(2),
        fullNameGu: z.string().optional(),
        relation: z.string().optional(),
        gender: z.enum(["MALE", "FEMALE"]).optional(),
        mobile: z.string().optional(),
        mobileIso: z.string().length(2).optional(),
        whatsappIso: z.string().length(2).optional(),
        isNri: z.boolean().optional(),
        nriCountry: z.string().max(80).optional(),
        nriCity: z.string().max(80).optional(),
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
        whatsapp: z.string().optional(),
        isHead: z.boolean().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    // Unauthenticated by design (middleware allowlists it) — and now it hashes a
    // password, which is ~60ms of CPU per call. The real gate is still that every
    // family lands PENDING for a human to approve.
    // ponytail: in-memory limiter, so per-instance. Redis if this ever runs multi-node.
    const ip = getClientIp(req);
    if (!rateLimit(`famreg:${ip}`, 5, 3_600_000).allowed) {
      return fail("Too many registrations from this network, try again later", 429);
    }

    const body = createSchema.parse(await req.json());
    if (!body.consentAccepted) return fail("Consent is required");

    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);

    const community = await prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { type: true, authMode: true },
    });
    const passwordLogin = community.authMode === "MOBILE_PASSWORD";

    const { getParivarLockedSurname } = await import("@/lib/community-defaults");
    const { validateFamilyByType, validateHeadMobile, validateLoginMobile } = await import(
      "@/lib/family-form"
    );

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

    if (passwordLogin) {
      // The head's number is optional here — the household picks whichever
      // member's number it wants to sign in with.
      if (!body.loginMobile || !body.loginPassword) {
        return fail("A login mobile and 6-digit password are required", 422);
      }
      const loginErr = validateLoginMobile(body.members, body.loginMobile, body.loginMobileIso);
      if (loginErr) return fail(loginErr, 422);

      // A public endpoint must never set or replace the password on a mobile
      // that already has an account — that is a takeover, not a signup. Checked
      // before the family is written so a rejected attempt leaves nothing behind.
      const taken = await prisma.user.findUnique({
        where: userKey(communityId, body.loginMobile, body.loginMobileIso),
        select: { id: true },
      });
      if (taken) {
        return fail(
          "This mobile number is already registered. Ask the community admin to add you to that family.",
          409,
        );
      }
    } else {
      const headMobileErr = validateHeadMobile(body.members);
      if (headMobileErr) return fail(headMobileErr, 422);
    }

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
        nativeElderIso: body.nativeElderIso || DEFAULT_ISO,
        latitude: body.latitude,
        longitude: body.longitude,
        loginMobile: passwordLogin ? digitsOf(body.loginMobile) : null,
        loginMobileIso: passwordLogin ? body.loginMobileIso || DEFAULT_ISO : DEFAULT_ISO,
        consentAccepted: true,
        status: "PENDING",
        familyMembers: {
          create: body.members.map((m, i) => {
            const isHead = m.isHead ?? i === 0;
            return {
              fullNameEn: m.fullNameEn,
              fullNameGu: m.fullNameGu,
              relation: isHead ? "Head" : m.relation,
              gender: m.gender ?? null,
              mobile: digitsOf(m.mobile) || null,
              mobileIso: m.mobileIso || DEFAULT_ISO,
              whatsappIso: m.whatsappIso || m.mobileIso || DEFAULT_ISO,
              // Country and city only mean anything while the flag is on, so
              // they are cleared with it rather than left as stale history.
              isNri: m.isNri ?? false,
              nriCountry: m.isNri ? m.nriCountry || null : null,
              nriCity: m.isNri ? m.nriCity || null : null,
              bloodGroup: m.bloodGroup,
              occupation: m.occupation,
              occupationOther: m.occupationOther,
              education: m.education,
              course: m.course,
              currentlyAt: m.currentlyAt || body.city,
              dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : undefined,
              hasWhatsApp: m.hasWhatsApp ?? true,
              whatsapp: m.hasWhatsApp === false ? m.whatsapp?.trim() || undefined : undefined,
              isHead,
            };
          }),
        },
      },
      include: { familyMembers: true, surnameGroup: true },
    });

    if (passwordLogin) {
      // Exactly one account for the whole household — the number they picked.
      // Other members' numbers stay directory contacts and get no credential.
      // `create`, never `upsert`: the 409 above already proved the row is free,
      // and an update here would be the takeover it is guarding against.
      await prisma.user.create({
        data: {
          communityId,
          mobile: digitsOf(body.loginMobile),
          mobileIso: body.loginMobileIso || DEFAULT_ISO,
          passwordHash: await bcrypt.hash(body.loginPassword!, 10),
          status: "PENDING",
        },
      });
    } else {
      for (const m of body.members) {
        const mobile = digitsOf(m.mobile);
        if (!mobile) continue;
        const mobileIso = m.mobileIso || DEFAULT_ISO;
        await prisma.user.upsert({
          where: userKey(communityId, mobile, mobileIso),
          update: {},
          create: { communityId, mobile, mobileIso, status: "PENDING" },
        });
      }
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

    // Country included in the match: the same ten digits under two countries
    // are two different accounts, and approving this family must not reach the
    // other one.
    for (const m of family.familyMembers) {
      if (!m.mobile) continue;
      const who = { mobile: m.mobile, mobileIso: m.mobileIso, communityId };
      if (body.status === "APPROVED") {
        await prisma.user.updateMany({ where: who, data: { status: "APPROVED" } });
      } else if (body.status === "REJECTED") {
        await prisma.user.updateMany({
          where: { ...who, status: { not: "SUSPENDED" } },
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
