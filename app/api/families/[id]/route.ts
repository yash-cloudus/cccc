import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncNriOptions } from "@/lib/nri";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

const BLOOD = ["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"] as const;

const memberSchema = z.object({
  id: z.string().optional(),
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  mobile: z.string().optional().nullable(),
  mobileIso: z.string().length(2).optional().nullable(),
  whatsappIso: z.string().length(2).optional().nullable(),
  isNri: z.boolean().optional(),
  nriCountry: z.string().max(80).optional().nullable(),
  nriCity: z.string().max(80).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bloodGroup: z.enum(BLOOD).optional().nullable(),
  occupation: z.string().optional().nullable(),
  occupationOther: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  course: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  // Registration collects both; without them here an admin edit silently wiped
  // the member's place and reset their WhatsApp flag.
  currentlyAt: z.string().optional().nullable(),
  hasWhatsApp: z.boolean().optional(),
  whatsapp: z.string().optional().nullable(),
  isHead: z.boolean().optional(),
  /** Head only. A stored URL from /api/upload, never a data URL. */
  photoUrl: z.string().max(500).optional().nullable(),
});

const putSchema = z.object({
  headNameEn: z.string().min(1).optional(),
  headNameGu: z.string().optional().nullable(),
  surnameEn: z.string().min(1).optional(),
  surnameGu: z.string().optional().nullable(),
  surnameGroupId: z.string().optional(),
  addressEn: z.string().optional(),
  addressGu: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  nativePlace: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  villageAreaId: z.string().optional().nullable(),
  businessGu: z.string().optional().nullable(),
  // The map pin the review screen can capture — without these zod dropped them
  // and the button looked like it worked.
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  nativeElderNameEn: z.string().optional().nullable(),
  nativeElderNameGu: z.string().optional().nullable(),
  nativeElderPhone: z.string().optional().nullable(),
  nativeElderIso: z.string().length(2).optional(),
  members: z.array(memberSchema).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Family not found", 404);
    const family = await prisma.family.findFirst({
      where: { id, communityId },
      include: {
        surnameGroup: true,
        villageArea: true,
        familyMembers: true,
        businesses: { include: { category: true, gallery: true } },
      },
    });
    if (!family) return fail("Family not found", 404);
    return ok(family);
  } catch (e) {
    console.error(e);
    return fail("Failed to load family", 500);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();

    const existing = await prisma.family.findFirst({
      where: { id, communityId },
      select: { id: true, familyMembers: { select: { id: true } } },
    });
    if (!existing) return fail("Family not found", 404);

    const { members, surnameGroupId, ...familyData } = putSchema.parse(await req.json());
    delete familyData.nativePlace;
    delete familyData.email;

    const community = await prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { type: true },
    });

    // Parivar surname is locked — ignore attempts to switch groups.
    let nextSurnameGroupId = surnameGroupId;
    if (community.type === "PARIVAR") {
      const { getParivarLockedSurname } = await import("@/lib/community-defaults");
      const locked = await getParivarLockedSurname(prisma, communityId);
      if (locked) {
        nextSurnameGroupId = locked.id;
        familyData.surnameEn = locked.nameEn;
        familyData.surnameGu = locked.nameGu;
      }
    }

    // If surname group is being changed, it must belong to this community.
    if (nextSurnameGroupId) {
      const sg = await prisma.surnameGroup.findFirst({
        where: { id: nextSurnameGroupId, communityId },
        select: { id: true },
      });
      if (!sg) return fail("Invalid surname group", 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id },
        data: { ...familyData, ...(nextSurnameGroupId ? { surnameGroupId: nextSurnameGroupId } : {}) },
      });

      if (members) {
        const keepIds = members.filter((m) => m.id).map((m) => m.id!) as string[];
        // Delete members removed in the editor.
        await tx.familyMember.deleteMany({
          where: { familyId: id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } },
        });
        for (const m of members) {
          const data = {
            fullNameEn: m.fullNameEn,
            fullNameGu: m.fullNameGu ?? null,
            relation: m.relation ?? null,
            gender: m.gender ?? null,
            mobile: m.mobile ?? null,
            mobileIso: m.mobileIso || "in",
            whatsappIso: m.whatsappIso || m.mobileIso || "in",
            isNri: m.isNri ?? false,
            nriCountry: m.isNri ? m.nriCountry ?? null : null,
            nriCity: m.isNri ? m.nriCity ?? null : null,
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
            bloodGroup: m.bloodGroup ?? null,
            occupation: m.occupation ?? null,
            occupationOther: m.occupationOther ?? null,
            education: m.education ?? null,
            course: m.course ?? null,
            specialization: m.specialization ?? null,
            currentlyAt: m.currentlyAt ?? null,
            hasWhatsApp: m.hasWhatsApp ?? true,
            whatsapp: m.whatsapp ?? null,
            isHead: m.isHead ?? false,
            // Only touched when the caller sent the field, so an editor that
            // does not know about photos cannot silently wipe one.
            ...(m.photoUrl !== undefined ? { photoUrl: m.photoUrl || null } : {}),
          };
          if (m.id && existing.familyMembers.some((e) => e.id === m.id)) {
            await tx.familyMember.update({ where: { id: m.id }, data });
          } else {
            await tx.familyMember.create({ data: { ...data, familyId: id } });
          }
        }
      }
    });

    const updated = await prisma.family.findUnique({
      where: { id },
      include: { surnameGroup: true, villageArea: true, familyMembers: { orderBy: { createdAt: "asc" } } },
    });
    // An admin edit can introduce a country or city too — same bookkeeping.
    if (updated) await syncNriOptions(prisma, updated.communityId, updated.familyMembers);
    return ok(updated);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to update family", 500);
  }
}

/**
 * Status-only update (activate / deactivate from Families & Members).
 *
 * Deliberately separate from PUT: PUT is a full family+members replace, so
 * routing a one-field status flip through it risks touching member rows.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();

    const { status, rejectReason } = z
      .object({
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
        rejectReason: z.string().max(500).optional(),
      })
      .parse(await req.json());

    const res = await prisma.family.updateMany({
      where: { id, communityId },
      data: {
        status,
        rejectReason: status === "REJECTED" ? rejectReason : null,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
      },
    });
    if (res.count === 0) return fail("Family not found", 404);

    const members = await prisma.familyMember.findMany({
      where: { familyId: id, mobile: { not: null } },
      select: { mobile: true, mobileIso: true },
    });
    for (const m of members) {
      if (!m.mobile) continue;
      // Country included: the same ten digits under two countries are two
      // different accounts, and approving this family must not touch the other.
      const who = { mobile: m.mobile, mobileIso: m.mobileIso, communityId };
      if (status === "APPROVED") {
        await prisma.user.updateMany({ where: who, data: { status: "APPROVED" } });
      } else if (status === "REJECTED") {
        await prisma.user.updateMany({
          where: { ...who, status: { not: "SUSPENDED" } },
          data: { status: "REJECTED" },
        });
      }
    }

    return ok({ id, status });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to update family status", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const communityId = await getWritableCommunityId();
    const res = await prisma.family.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Family not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    console.error(e);
    return fail("Failed to delete family", 500);
  }
}
