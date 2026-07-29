import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getMyMemberRecord } from "@/lib/tenant";
import { APPLIABLE_MEMBER_FIELDS, MEMBER_FIELD_LABELS } from "@/lib/profile-update-fields";

const schema = z.object({
  /** Edit another member of my family (defaults to my own record). */
  memberId: z.string().optional(),
  /** Request adding a brand-new member to my family. */
  addMember: z.boolean().optional(),
  fullNameEn: z.string().min(2).max(120).optional(),
  fullNameGu: z.string().max(120).optional(),
  relation: z.string().max(60).optional(),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Mobile must be 10 digits")
    .optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be YYYY-MM-DD")
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

type Change = { field: string; label: string; from: string | null; to: string | null };

/** Current stored value of a member column, normalized to a comparable string. */
function storedValue(member: Record<string, unknown>, field: string): string {
  const v = member[field];
  if (v == null) return "";
  if (field === "dateOfBirth") return new Date(v as Date).toISOString().slice(0, 10);
  return String(v);
}

/**
 * A member submits changes to their own record, another member of their
 * family, or a brand-new member. Nothing is written directly — a
 * ProfileUpdateRequest is queued for the community admin's "Update requests"
 * tab, which applies (or creates) on approval.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());

    const record = await getMyMemberRecord(session.sub);
    if (!record) return fail("Profile not found", 404);
    if (!record.familyId) return fail("No family on this account", 400);
    if (!session.communityId) return fail("No community context", 400);

    const fieldEntries = (Object.keys(body) as (keyof typeof body)[])
      .filter((f) => APPLIABLE_MEMBER_FIELDS.has(f))
      .map((f) => ({ field: f as string, to: (body[f] ?? "").toString().trim() }));

    let changes: Change[] = [];

    if (body.addMember) {
      if (!body.fullNameEn?.trim()) return fail("New member needs a name", 400);
      changes = fieldEntries
        .filter((e) => e.to)
        .map((e) => ({
          field: `new.${e.field}`,
          label: `New member · ${MEMBER_FIELD_LABELS[e.field] || e.field}`,
          from: null,
          to: e.to,
        }));
    } else {
      const targetId = body.memberId ?? (record.source === "familyMember" ? record.id : null);
      if (!targetId) {
        return fail(
          "This account's own details save immediately — there is nothing to submit for approval.",
          400,
        );
      }
      // Only members of the caller's own family can be targeted.
      const member = await prisma.familyMember.findFirst({
        where: { id: targetId, familyId: record.familyId },
      });
      if (!member) return fail("Member not found in your family", 404);

      const memberRow = member as unknown as Record<string, unknown>;
      for (const e of fieldEntries) {
        const from = storedValue(memberRow, e.field);
        if (e.to === from) continue;
        changes.push({
          field: e.field,
          label: MEMBER_FIELD_LABELS[e.field] || e.field,
          from: from || null,
          to: e.to || null,
        });
      }
    }

    if (!changes.length) return fail("No changes to submit", 400);

    const created = await prisma.profileUpdateRequest.create({
      data: {
        communityId: session.communityId,
        familyId: record.familyId,
        memberId: body.addMember ? null : (body.memberId ?? record.id),
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
