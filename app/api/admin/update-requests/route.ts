import { z } from "zod";
import type { BloodGroupType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { APPLIABLE_MEMBER_FIELDS, coerceMemberFieldValue } from "@/lib/profile-update-fields";

/** One field the member changed, as stored in ProfileUpdateRequest.changes. */
const changeSchema = z.object({
  field: z.string().min(1),
  label: z.string().optional(),
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});

const APPLIABLE_FAMILY_FIELDS = new Set([
  "addressEn",
  "addressGu",
  "city",
  "businessGu",
  "nativeElderNameEn",
  "nativeElderNameGu",
  "nativeElderPhone",
]);

export async function GET(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const status = new URL(req.url).searchParams.get("status") || undefined;
    const items = await prisma.profileUpdateRequest.findMany({
      where: {
        communityId,
        ...(status && status !== "all" ? { status: status as "PENDING" } : {}),
      },
      include: {
        family: { select: { id: true, headNameEn: true, headNameGu: true, surnameEn: true } },
        member: { select: { id: true, fullNameEn: true, fullNameGu: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list update requests");
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["apply", "reject"]),
  rejectReason: z.string().max(500).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId, session } = await requireAdmin();
    const body = patchSchema.parse(await req.json());

    const reqRow = await prisma.profileUpdateRequest.findFirst({
      where: { id: body.id, communityId },
    });
    if (!reqRow) return fail("Update request not found", 404);
    if (reqRow.status !== "PENDING") return fail("This request was already reviewed", 409);

    if (body.action === "reject") {
      await prisma.profileUpdateRequest.update({
        where: { id: reqRow.id },
        data: {
          status: "REJECTED",
          rejectReason: body.rejectReason || null,
          reviewedAt: new Date(),
          reviewedBy: session.sub,
        },
      });
      return ok({ id: reqRow.id, status: "REJECTED" });
    }

    // Apply: write only allow-listed fields onto the target row.
    const parsed = z.array(changeSchema).safeParse(JSON.parse(reqRow.changes || "[]"));
    if (!parsed.success) return fail("This request's payload is malformed", 422);

    const memberData: Record<string, string | boolean | Date | null> = {};
    const familyData: Record<string, string | null> = {};
    // "new.<field>" entries describe a member to CREATE (the member app's
    // "Add member" request) rather than columns to update.
    const newMemberData: Record<string, string | boolean | Date | null> = {};
    for (const c of parsed.data) {
      if (c.field.startsWith("new.")) {
        const f = c.field.slice(4);
        if (APPLIABLE_MEMBER_FIELDS.has(f)) newMemberData[f] = coerceMemberFieldValue(f, c.to ?? null);
      } else if (reqRow.memberId && APPLIABLE_MEMBER_FIELDS.has(c.field)) {
        memberData[c.field] = coerceMemberFieldValue(c.field, c.to ?? null);
      } else if (reqRow.familyId && APPLIABLE_FAMILY_FIELDS.has(c.field)) {
        familyData[c.field] = c.to ?? null;
      }
    }

    await prisma.$transaction(async (tx) => {
      if (reqRow.memberId && Object.keys(memberData).length) {
        // Scope the write to this community via the parent family.
        await tx.familyMember.updateMany({
          where: { id: reqRow.memberId, family: { communityId } },
          data: memberData,
        });
      }
      if (reqRow.familyId && Object.keys(familyData).length) {
        await tx.family.updateMany({
          where: { id: reqRow.familyId, communityId },
          data: familyData,
        });
      }
      if (
        !reqRow.memberId &&
        reqRow.familyId &&
        typeof newMemberData.fullNameEn === "string" &&
        newMemberData.fullNameEn
      ) {
        const family = await tx.family.findFirst({
          where: { id: reqRow.familyId, communityId },
          select: { id: true },
        });
        if (family) {
          await tx.familyMember.create({
            data: {
              familyId: family.id,
              isHead: false,
              fullNameEn: newMemberData.fullNameEn,
              fullNameGu: (newMemberData.fullNameGu as string | undefined) ?? null,
              relation: (newMemberData.relation as string | undefined) ?? null,
              mobile: (newMemberData.mobile as string | undefined) ?? null,
              dateOfBirth: (newMemberData.dateOfBirth as Date | undefined) ?? null,
              bloodGroup: (newMemberData.bloodGroup as BloodGroupType | undefined) ?? null,
              occupation: (newMemberData.occupation as string | undefined) ?? null,
              occupationOther: (newMemberData.occupationOther as string | undefined) ?? null,
              education: (newMemberData.education as string | undefined) ?? null,
              course: (newMemberData.course as string | undefined) ?? null,
              currentlyAt: (newMemberData.currentlyAt as string | undefined) ?? null,
              hasWhatsApp: (newMemberData.hasWhatsApp as boolean | undefined) ?? true,
            },
          });
        }
      }
      await tx.profileUpdateRequest.update({
        where: { id: reqRow.id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: session.sub },
      });
    });

    return ok({ id: reqRow.id, status: "APPROVED" });
  } catch (e) {
    return handleApiError(e, "Failed to review update request");
  }
}
