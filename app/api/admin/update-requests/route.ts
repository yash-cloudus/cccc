import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { APPLIABLE_MEMBER_FIELDS } from "@/lib/profile-update-fields";

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

    const memberData: Record<string, string | null> = {};
    const familyData: Record<string, string | null> = {};
    for (const c of parsed.data) {
      if (reqRow.memberId && APPLIABLE_MEMBER_FIELDS.has(c.field)) {
        memberData[c.field] = c.to ?? null;
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
