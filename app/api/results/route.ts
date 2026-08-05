import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getActiveCommunityId, getSessionPayload, getWritableCommunityId } from "@/lib/tenant";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * The next-standard choice only ever touches the student's actual record once
 * the result itself is approved — a rejected or still-pending entry must
 * never promote/graduate/drop someone off the strength of an unverified
 * marksheet. Shared by both the PATCH approval path and admin's POST (which
 * self-approves — see `isAdmin` below).
 */
async function applyStudyOutcome(
  tx: Tx,
  memberId: string | null | undefined,
  studyOutcome: string | null | undefined,
  nextStandard: string | null | undefined,
  nextStream: string | null | undefined,
  nextCourse: string | null | undefined,
  nextSpecialization: string | null | undefined,
) {
  if (!memberId || !studyOutcome) return;
  if (studyOutcome === "PROMOTED") {
    await tx.familyMember.update({
      where: { id: memberId },
      data: {
        education: nextStandard,
        course: nextStream || nextCourse || null,
        // Only meaningful alongside a course, not a stream — Std 11/12 have no
        // specialization tier.
        specialization: nextStream ? null : nextSpecialization || null,
      },
    });
  } else if (studyOutcome === "STUDY_COMPLETE" || studyOutcome === "DROPPED_OUT") {
    // No longer an active student — drops out of future drive rosters.
    await tx.familyMember.update({
      where: { id: memberId },
      data: { education: null, course: null, specialization: null },
    });
  }
  // FAILED_REPEAT: no change — the student repeats the same standard.
}

/**
 * Outside production, put the real reason in the response so the toast says
 * something actionable instead of a dead end. Production keeps the generic
 * text — internal errors are not for end users.
 */
function detailedFailure(message: string, e: unknown) {
  if (process.env.NODE_ENV === "production") return message;
  const detail = (e as Error)?.message?.split("\n").filter(Boolean).pop()?.trim();
  return detail ? `${message}: ${detail}` : message;
}

/** Percentage + felicitation eligibility from a marks pair (≥80% qualifies). */
function scoreOf(total?: number | null, obtained?: number | null) {
  if (total == null || obtained == null || total <= 0) return {};
  const percentage = Math.round((obtained / total) * 10000) / 100;
  return { percentage, isEligible: percentage >= 80 };
}

/** WhatsApp note appended to the approval message for terminal (non-promotion) outcomes. */
const STUDY_OUTCOME_NOTIFY: Record<"STUDY_COMPLETE" | "FAILED_REPEAT" | "DROPPED_OUT", string> = {
  STUDY_COMPLETE: "Studies marked complete — congratulations on finishing!",
  FAILED_REPEAT: "Marked to repeat this standard next year.",
  DROPPED_OUT: "Marked as having discontinued studies.",
};

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
            orderBy: [{ isOpen: "desc" }, { year: "desc" }],
          })) || null;

    if (!drive) return ok({ drive: null, entries: [] });

    const entries = await prisma.resultEntry.findMany({
      where: {
        driveId: drive.id,
        ...(standard ? { standard } : {}),
        ...(mine ? { userId: session!.sub } : {}),
        ...(published
          ? { status: "APPROVED", isEligible: true, drive: { isOpen: true } }
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

const studyOutcomeSchema = z.enum(["PROMOTED", "STUDY_COMPLETE", "FAILED_REPEAT", "DROPPED_OUT"]);

const schema = z.object({
  driveId: z.string(),
  memberId: z.string().optional(),
  studentName: z.string().min(2),
  standard: z.string().min(1),
  stream: z.string().optional(),
  course: z.string().optional(),
  // Third level under `course`, e.g. College → BE → this.
  specialization: z.string().optional(),
  totalMarks: z.number().positive().optional(),
  obtainedMarks: z.number().nonnegative().optional(),
  marksheetUrl: z.string().optional(),
  // What's next for the student — decided alongside the upload, applied to
  // their record only once the result itself is approved (see PATCH below).
  nextStandard: z.string().optional(),
  nextStream: z.string().optional(),
  nextCourse: z.string().optional(),
  nextSpecialization: z.string().optional(),
  studyOutcome: studyOutcomeSchema.optional(),
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

    if (body.studyOutcome === "PROMOTED" && !body.nextStandard) {
      return fail("Pick the next standard");
    }

    if (body.memberId) {
      const member = await prisma.familyMember.findFirst({
        where: { id: body.memberId, family: { communityId } },
        select: { id: true },
      });
      if (!member) return fail("Member not found", 404);
    }

    const scores = scoreOf(body.totalMarks, body.obtainedMarks);
    // An admin entering a result on the student's behalf is the verification —
    // it needs no separate approval step. Only a family/student upload waits
    // in the queue for an admin to check the marksheet.
    const status = isAdmin ? "APPROVED" : "PENDING";

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
        const entry = await prisma.$transaction(async (tx) => {
          const updated = await tx.resultEntry.update({
            where: { id: existing.id },
            data: {
              studentName: body.studentName,
              stream: body.stream,
              course: body.course,
              specialization: body.specialization,
              totalMarks: body.totalMarks,
              obtainedMarks: body.obtainedMarks,
              marksheetUrl: body.marksheetUrl,
              ...scores,
              status,
              rejectReason: null,
              userId: isAdmin ? existing.userId : session.sub,
              nextStandard: body.nextStandard,
              nextStream: body.nextStream,
              nextCourse: body.nextCourse,
              nextSpecialization: body.nextSpecialization,
              studyOutcome: body.studyOutcome,
            },
          });
          if (status === "APPROVED") {
            await applyStudyOutcome(
              tx,
              body.memberId,
              body.studyOutcome,
              body.nextStandard,
              body.nextStream,
              body.nextCourse,
              body.nextSpecialization,
            );
          }
          return updated;
        });
        return ok(entry);
      }
    }

    const entry = await prisma.$transaction(async (tx) => {
      const row = await tx.resultEntry.create({
        data: {
          ...body,
          ...scores,
          userId: session.sub,
          status,
        },
      });
      if (status === "APPROVED") {
        await applyStudyOutcome(
          tx,
          body.memberId,
          body.studyOutcome,
          body.nextStandard,
          body.nextStream,
          body.nextCourse,
          body.nextSpecialization,
        );
      }
      return row;
    });
    return created(entry);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    // Was silently swallowed, so a failed submit gave the user "Failed to
    // submit result" and left nothing in the log to explain it.
    console.error("POST /api/results", e);
    return fail(detailedFailure("Failed to submit result", e), 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!hasRole(session, [...COMMUNITY_ADMIN_ROLES])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const [settingsMap, community] = await Promise.all([
      getCommunitySettingsMap(communityId),
      prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { authMode: true } }),
    ]);
    const settings = getResultModuleSettings(settingsMap);
    // WhatsApp automation only runs where WhatsApp is the community's channel.
    // Gated here because this `notify` object is the only reader of waApprove /
    // waReject in the app — if a second automation appears, move the gate into
    // getResultModuleSettings so the type checker enforces it.
    const waAutomation = community.authMode === "WHATSAPP_API";

    const body = z
      .object({
        id: z.string(),
        memberId: z.string().optional(),
        studentName: z.string().optional(),
        standard: z.string().optional(),
        stream: z.string().optional(),
        course: z.string().optional(),
        specialization: z.string().optional(),
        totalMarks: z.number().positive().optional(),
        obtainedMarks: z.number().nonnegative().optional(),
        marksheetUrl: z.string().optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "RESUBMIT"]).optional(),
        // Nullable, not just optional: approving and re-editing both send
        // `rejectReason: null` to clear it, and `.optional()` alone rejects
        // null outright — which surfaced as a bare "Validation failed".
        rejectReason: z.string().nullable().optional(),
        nextStandard: z.string().optional(),
        nextStream: z.string().optional(),
        nextCourse: z.string().optional(),
        nextSpecialization: z.string().optional(),
        studyOutcome: studyOutcomeSchema.optional(),
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

    const finalStatus = body.status ?? existing.status;
    const memberId = body.memberId ?? existing.memberId;
    const studyOutcome = body.studyOutcome ?? existing.studyOutcome;
    const nextStandard = body.nextStandard ?? existing.nextStandard;
    const nextStream = body.nextStream ?? existing.nextStream;
    const nextCourse = body.nextCourse ?? existing.nextCourse;
    const nextSpecialization = body.nextSpecialization ?? existing.nextSpecialization;

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.resultEntry.update({
        where: { id: body.id },
        data: {
          memberId,
          studentName: body.studentName ?? existing.studentName,
          standard: body.standard ?? existing.standard,
          stream: body.stream ?? existing.stream,
          course: body.course ?? existing.course,
          specialization: body.specialization ?? existing.specialization,
          totalMarks: body.totalMarks ?? existing.totalMarks,
          obtainedMarks: body.obtainedMarks ?? existing.obtainedMarks,
          marksheetUrl: body.marksheetUrl ?? existing.marksheetUrl,
          percentage,
          isEligible,
          status: finalStatus,
          // `??` would treat an explicit null as "not supplied" and keep the old
          // reason, so a re-edited entry would still carry the rejection it was
          // just fixed for. Only `undefined` means "leave it alone".
          rejectReason:
            body.rejectReason !== undefined
              ? body.rejectReason
              : body.status === "APPROVED"
                ? null
                : existing.rejectReason,
          nextStandard,
          nextStream,
          nextCourse,
          nextSpecialization,
          studyOutcome,
        },
      });

      if (finalStatus === "APPROVED") {
        await applyStudyOutcome(
          tx,
          memberId,
          studyOutcome,
          nextStandard,
          nextStream,
          nextCourse,
          nextSpecialization,
        );
      }

      return updated;
    });

    const mobile = existing.member?.mobile ?? null;
    const studentName = existing.member?.fullNameGu || existing.member?.fullNameEn || existing.studentName;
    const nextNote =
      body.status === "APPROVED" && studyOutcome
        ? studyOutcome === "PROMOTED"
          ? (() => {
              const extra = [nextStream || nextCourse, nextStream ? null : nextSpecialization]
                .filter(Boolean)
                .join(" · ");
              return ` Promoted to ${nextStandard}${extra ? ` (${extra})` : ""}.`;
            })()
          : ` ${STUDY_OUTCOME_NOTIFY[studyOutcome]}`
        : "";

    return ok({
      entry,
      notify:
        body.status === "APPROVED" && settings.waApprove && waAutomation
          ? { mobile, message: `Congratulations ${studentName}! Your result has been approved.${nextNote}` }
          : (body.status === "REJECTED" || body.status === "RESUBMIT") &&
              settings.waReject &&
              waAutomation
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
    console.error("PATCH /api/results", e);
    return fail(detailedFailure("Failed to update result", e), 500);
  }
}
