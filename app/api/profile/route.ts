import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getMyMemberRecord } from "@/lib/tenant";

/** Current member's own profile + family (session-scoped). */
export async function GET() {
  try {
    const session = await requireSession();
    const [record, user] = await Promise.all([
      getMyMemberRecord(session.sub),
      prisma.user.findUnique({ where: { id: session.sub }, select: { mobile: true } }),
    ]);

    // Loaded separately: an OTP member has no Profile row, so both the person
    // and the household are resolved by mobile instead.
    const [family, pendingUpdateRequest] = await Promise.all([
      record?.familyId
        ? prisma.family.findUnique({
            where: { id: record.familyId },
            include: {
              surnameGroup: true,
              familyMembers: { where: { isVisible: true }, orderBy: { createdAt: "asc" } },
            },
          })
        : null,
      record?.source === "familyMember"
        ? prisma.profileUpdateRequest.findFirst({
            where: { memberId: record.id, status: "PENDING" },
            orderBy: { submittedAt: "desc" },
            select: { id: true, submittedAt: true },
          })
        : null,
    ]);

    return ok({
      profile: record ? { ...record, family } : null,
      mobile: user?.mobile ?? null,
      userId: session.sub,
      pendingUpdateRequest,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    return fail("Failed to load profile", 500);
  }
}

const schema = z.object({
  showPhone: z.boolean().optional(),
  showBusiness: z.boolean().optional(),
  fullNameEn: z.string().min(2).max(120).optional(),
  fullNameGu: z.string().max(120).optional(),
  occupation: z.string().max(120).optional(),
  occupationOther: z.string().max(120).optional(),
  education: z.string().max(120).optional(),
  course: z.string().max(120).optional(),
  currentlyAt: z.string().max(120).optional(),
  bloodGroup: z
    .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"])
    .optional(),
});

/** Member updates their own privacy flags / basic details. */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const record = await getMyMemberRecord(session.sub);
    if (!record) return fail("Profile not found", 404);

    // Write back to whichever table this member actually lives in.
    if (record.source === "profile") {
      const updated = await prisma.profile.update({ where: { userId: session.sub }, data: body });
      return ok(updated);
    }

    // FamilyMember has no showBusiness column; the rest map one to one.
    const updated = await prisma.familyMember.update({
      where: { id: record.id },
      data: {
        ...(body.showPhone !== undefined ? { showPhone: body.showPhone } : {}),
        ...(body.occupation !== undefined ? { occupation: body.occupation } : {}),
        ...(body.currentlyAt !== undefined ? { currentlyAt: body.currentlyAt } : {}),
        ...(body.education !== undefined ? { education: body.education } : {}),
      },
    });
    return ok(updated);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update profile", 500);
  }
}
