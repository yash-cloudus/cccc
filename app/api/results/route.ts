import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getActiveCommunityId, getSessionPayload, getWritableCommunityId } from "@/lib/tenant";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";

/** Percentage + felicitation eligibility from a marks pair (≥80% qualifies). */
function scoreOf(total?: number | null, obtained?: number | null) {
  if (total == null || obtained == null || total <= 0) return {};
  const percentage = Math.round((obtained / total) * 10000) / 100;
  return { percentage, isEligible: percentage >= 80 };
}

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ drive: null, entries: [] });
    const { searchParams } = new URL(req.url);
    const driveId = searchParams.get("driveId");
    const standard = searchParams.get("standard");
    const published = searchParams.get("published") === "1";
    const mine = searchParams.get("mine") === "1";
    const session = mine ? await getSessionPayload() : null;
    if (mine && !session) return fail("Unauthorized", 401);

    const settings = getResultModuleSettings(await getCommunitySettingsMap(communityId));
    if (!settings.enable) return ok({ drive: null, entries: [], disabled: true });

    const drive =
      (driveId
        ? await prisma.resultDrive.findFirst({ where: { id: driveId, communityId } })
        : await prisma.resultDrive.findFirst({
            where: { communityId },
            orderBy: { year: "desc" },
          })) || null;

    if (!drive) return ok({ drive: null, entries: [] });

    const entries = await prisma.resultEntry.findMany({
      where: {
        driveId: drive.id,
        ...(standard ? { standard } : {}),
        ...(mine ? { userId: session!.sub } : {}),
        ...(published
          ? { status: "APPROVED", isEligible: true, drive: { isPublished: true } }
          : {}),
      },
      orderBy: [{ percentage: "desc" }, { createdAt: "asc" }],
    });

    return ok({ drive, entries, settings });
  } catch (e) {
    console.error(e);
    return fail("Failed to load results", 500);
  }
}

const schema = z.object({
  driveId: z.string(),
  memberId: z.string().optional(),
  studentName: z.string().min(2),
  standard: z.string().min(1),
  stream: z.string().optional(),
  course: z.string().optional(),
  schoolName: z.string().optional(),
  totalMarks: z.number().positive().optional(),
  obtainedMarks: z.number().nonnegative().optional(),
  marksheetUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);

    const settings = getResultModuleSettings(await getCommunitySettingsMap(communityId));
    if (!settings.enable) return fail("Result drive is disabled", 403);

    const isAdmin = hasRole(session, [...COMMUNITY_ADMIN_ROLES]);
    const body = schema.parse(await req.json());

    const drive = await prisma.resultDrive.findFirst({
      where: { id: body.driveId, communityId },
    });
    if (!drive?.isOpen) return fail("Result drive is closed");

    if (isAdmin) {
      if (!settings.adminUpload) return fail("Admin upload is disabled", 403);
    } else if (!settings.studentUpload) {
      return fail("Student upload is disabled", 403);
    }

    if (
      body.totalMarks != null &&
      body.obtainedMarks != null &&
      body.obtainedMarks > body.totalMarks
    ) {
      return fail("Obtained marks cannot exceed total marks");
    }

    if (body.memberId) {
      const member = await prisma.familyMember.findFirst({
        where: { id: body.memberId, family: { communityId } },
        select: { id: true },
      });
      if (!member) return fail("Member not found", 404);
    }

    const scores = scoreOf(body.totalMarks, body.obtainedMarks);

    // Resubmit: update rejected entry for same child + standard instead of duplicating.
    if (body.memberId) {
      const existing = await prisma.resultEntry.findFirst({
        where: {
          driveId: body.driveId,
          memberId: body.memberId,
          standard: body.standard,
          status: { in: ["REJECTED", "RESUBMIT"] },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (existing) {
        const entry = await prisma.resultEntry.update({
          where: { id: existing.id },
          data: {
            studentName: body.studentName,
            stream: body.stream,
            course: body.course,
            schoolName: body.schoolName,
            totalMarks: body.totalMarks,
            obtainedMarks: body.obtainedMarks,
            marksheetUrl: body.marksheetUrl,
            ...scores,
            status: "PENDING",
            rejectReason: null,
            userId: isAdmin ? existing.userId : session.sub,
          },
        });
        return ok(entry);
      }
    }

    const entry = await prisma.resultEntry.create({
      data: {
        ...body,
        ...scores,
        userId: session.sub,
        status: "PENDING",
      },
    });
    return created(entry);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to submit result", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, [...COMMUNITY_ADMIN_ROLES])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const settings = getResultModuleSettings(await getCommunitySettingsMap(communityId));

    const body = z
      .object({
        id: z.string(),
        memberId: z.string().optional(),
        studentName: z.string().optional(),
        standard: z.string().optional(),
        stream: z.string().optional(),
        course: z.string().optional(),
        schoolName: z.string().optional(),
        totalMarks: z.number().positive().optional(),
        obtainedMarks: z.number().nonnegative().optional(),
        marksheetUrl: z.string().optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "RESUBMIT"]).optional(),
        rejectReason: z.string().optional(),
      })
      .parse(await req.json());

    const existing = await prisma.resultEntry.findFirst({
      where: { id: body.id, drive: { communityId } },
      include: {
        member: { select: { mobile: true, fullNameEn: true, fullNameGu: true } },
      },
    });
    if (!existing) return fail("Result not found", 404);

    const total = body.totalMarks ?? existing.totalMarks;
    const obtained = body.obtainedMarks ?? existing.obtainedMarks;
    const { percentage, isEligible } = scoreOf(total, obtained);

    const entry = await prisma.resultEntry.update({
      where: { id: body.id },
      data: {
        memberId: body.memberId ?? existing.memberId,
        studentName: body.studentName ?? existing.studentName,
        standard: body.standard ?? existing.standard,
        stream: body.stream ?? existing.stream,
        course: body.course ?? existing.course,
        schoolName: body.schoolName ?? existing.schoolName,
        totalMarks: body.totalMarks ?? existing.totalMarks,
        obtainedMarks: body.obtainedMarks ?? existing.obtainedMarks,
        marksheetUrl: body.marksheetUrl ?? existing.marksheetUrl,
        percentage,
        isEligible,
        status: body.status ?? existing.status,
        rejectReason: body.rejectReason ?? (body.status === "APPROVED" ? null : existing.rejectReason),
      },
    });

    const mobile = existing.member?.mobile ?? null;
    const studentName = existing.member?.fullNameGu || existing.member?.fullNameEn || existing.studentName;

    return ok({
      entry,
      notify:
        body.status === "APPROVED" && settings.waApprove
          ? { mobile, message: `Congratulations ${studentName}! Your result has been approved.` }
          : (body.status === "REJECTED" || body.status === "RESUBMIT") && settings.waReject
            ? {
                mobile,
                message: `Hi ${studentName}, your result was rejected: ${body.rejectReason || entry.rejectReason || "Please re-upload."}`,
              }
            : null,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update result", 500);
  }
}
