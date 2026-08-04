import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { DEFAULT_ISO, digitsOf } from "@/lib/phone";
import { userKey } from "@/lib/auth/user-key";

async function assertFamilyMember(communityId: string, id: string) {
  const m = await prisma.familyMember.findFirst({
    where: { id, family: { communityId } },
    select: {
      id: true,
      familyId: true,
      mobile: true,
      mobileIso: true,
      family: { select: { status: true, loginMobile: true } },
    },
  });
  if (!m) throw new Error("NOT_FOUND");
  return m;
}

const createSchema = z.object({
  familyId: z.string().min(1),
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional(),
  relation: z.string().optional(),
  mobile: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const body = createSchema.parse(await req.json());
    const family = await prisma.family.findFirst({
      where: { id: body.familyId, communityId },
      select: { id: true },
    });
    if (!family) return fail("Family not found", 404);
    const member = await prisma.familyMember.create({
      data: {
        familyId: body.familyId,
        fullNameEn: body.fullNameEn.trim(),
        fullNameGu: body.fullNameGu?.trim(),
        relation: body.relation?.trim(),
        mobile: body.mobile?.trim() || null,
      },
    });
    return created(member);
  } catch (e) {
    return handleApiError(e, "Failed to add member");
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  fullNameEn: z.string().min(1).optional(),
  fullNameGu: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  isDeceased: z.boolean().optional(),
  isHead: z.boolean().optional(),
  mobileIso: z.string().length(2).optional(),
  whatsappIso: z.string().length(2).optional(),
  isNri: z.boolean().optional(),
  nriCountry: z.string().max(80).nullable().optional(),
  nriCity: z.string().max(80).nullable().optional(),
  /** MOBILE_PASSWORD: set or reset this household's login password. Not a
   *  FamilyMember column — destructured out before the Prisma update. */
  loginPassword: z.string().regex(/^\d{6}$/).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const { id, loginPassword, ...data } = patchSchema.parse(await req.json());
    const member = await assertFamilyMember(communityId, id);

    const nextMobile =
      data.mobile === undefined ? undefined : data.mobile?.replace(/\D/g, "") || null;

    await prisma.$transaction(async (tx) => {
      // Reassigning head: clear head on all other members of the same family.
      if (data.isHead === true) {
        await tx.familyMember.updateMany({
          where: { familyId: member.familyId },
          data: { isHead: false },
        });
      }
      await tx.familyMember.update({
        where: { id },
        data: { ...data, ...(nextMobile !== undefined ? { mobile: nextMobile } : {}) },
      });

      // A login number is two rows: FamilyMember.mobile (the directory entry)
      // and User.mobile (the credential). Moving one without the other is why
      // "Change login #" used to leave the member signing in on their old
      // number while the new one reported "not registered".
      // The country moves with the number — a member who emigrates changes both.
      const nextIso = (data.mobileIso || member.mobileIso || DEFAULT_ISO).toLowerCase();
      const movedNumber = nextMobile && member.mobile && nextMobile !== member.mobile;
      const movedCountry = nextIso !== member.mobileIso;
      if ((movedNumber || movedCountry) && member.mobile) {
        const target = nextMobile ?? member.mobile;
        const from = await tx.user.findUnique({
          where: userKey(communityId, member.mobile, member.mobileIso),
        });
        const to = await tx.user.findUnique({ where: userKey(communityId, target, nextIso) });
        if (to && from && to.id !== from.id) throw new Error("MOBILE_TAKEN");
        if (from && !to) {
          await tx.user.update({
            where: { id: from.id },
            data: { mobile: target, mobileIso: nextIso },
          });
        }
        if (member.family.loginMobile === member.mobile) {
          await tx.family.update({
            where: { id: member.familyId },
            data: { loginMobile: target, loginMobileIso: nextIso },
          });
        }
      }

      if (loginPassword) {
        const mobile = nextMobile ?? member.mobile;
        if (!mobile) throw new Error("NO_MOBILE");
        const passwordHash = await bcrypt.hash(loginPassword, 10);
        await tx.user.upsert({
          where: userKey(communityId, mobile, nextIso),
          update: { passwordHash },
          create: {
            communityId,
            mobile,
            mobileIso: nextIso,
            passwordHash,
            // An approved household's new credential must work immediately;
            // a pending one stays pending until the family is approved.
            status: member.family.status === "APPROVED" ? "APPROVED" : "PENDING",
          },
        });
        // The member the admin just gave a password to *is* the login now.
        await tx.family.update({
          where: { id: member.familyId },
          data: { loginMobile: mobile },
        });
      }
    });

    if (loginPassword) {
      // Never the password itself — only that it was replaced, and by whom.
      const { getSessionPayload } = await import("@/lib/tenant");
      const session = await getSessionPayload();
      await prisma.auditLog.create({
        data: {
          actorId: session?.sub ?? null,
          action: "member.passwordReset",
          entity: "FamilyMember",
          entityId: id,
        },
      });
    }

    return ok({ updated: true });
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return fail("Member not found", 404);
    if ((e as Error).message === "MOBILE_TAKEN") {
      return fail("Another account in this community already uses that mobile number", 409);
    }
    if ((e as Error).message === "NO_MOBILE") {
      return fail("Add a mobile number for this member before setting a password", 422);
    }
    return handleApiError(e, "Failed to update member");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "MODERATOR", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    await assertFamilyMember(communityId, id);
    await prisma.familyMember.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    if ((e as Error).message === "NOT_FOUND") return fail("Member not found", 404);
    return handleApiError(e, "Failed to remove member");
  }
}
