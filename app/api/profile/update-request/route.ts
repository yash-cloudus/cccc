import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getMyMemberRecord } from "@/lib/tenant";
import { APPLIABLE_MEMBER_FIELDS, MEMBER_FIELD_LABELS } from "@/lib/profile-update-fields";

const schema = z.object({
  fullNameEn: z.string().min(2).max(120).optional(),
  fullNameGu: z.string().max(120).optional(),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Mobile must be 10 digits")
    .optional(),
  occupation: z.string().max(120).optional(),
  occupationOther: z.string().max(120).optional(),
  education: z.string().max(120).optional(),
  course: z.string().max(120).optional(),
  currentlyAt: z.string().max(120).optional(),
  bloodGroup: z
    .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"])
    .optional(),
});

/**
 * A member submits changes to their own FamilyMember record. Nothing is
 * written directly — a ProfileUpdateRequest is queued for the community
 * admin to approve (see /api/admin/update-requests), matching the review
 * queue already built for it.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());

    const record = await getMyMemberRecord(session.sub);
    if (!record) return fail("Profile not found", 404);
    if (record.source !== "familyMember") {
      return fail("This account's details save immediately — there is nothing to submit for approval.", 400);
    }
    if (!record.familyId) return fail("No family on this account", 400);
    if (!session.communityId) return fail("No community context", 400);

    const member = await prisma.familyMember.findUnique({ where: { id: record.id } });
    if (!member) return fail("Profile not found", 404);

    const memberRow = member as unknown as Record<string, unknown>;
    const changes: { field: string; label: string; from: string | null; to: string | null }[] = [];
    for (const field of Object.keys(body) as (keyof typeof body)[]) {
      if (!APPLIABLE_MEMBER_FIELDS.has(field)) continue;
      const to = (body[field] ?? "").toString().trim();
      const fromValue = memberRow[field];
      const from = fromValue == null ? "" : String(fromValue);
      if (to === from) continue;
      changes.push({
        field,
        label: MEMBER_FIELD_LABELS[field] || field,
        from: from || null,
        to: to || null,
      });
    }

    if (!changes.length) return fail("No changes to submit", 400);

    const created = await prisma.profileUpdateRequest.create({
      data: {
        communityId: session.communityId,
        familyId: record.familyId,
        memberId: record.id,
        requestedBy: session.sub,
        changes: JSON.stringify(changes),
      },
    });

    return ok({ id: created.id, status: created.status });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to submit changes", 500);
  }
}
