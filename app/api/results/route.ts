import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId, getWritableCommunityId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ drive: null, entries: [] });
    const { searchParams } = new URL(req.url);
    const driveId = searchParams.get("driveId");
    const standard = searchParams.get("standard");
    const published = searchParams.get("published") === "1";

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
        ...(published
          ? { status: "APPROVED", isEligible: true, drive: { isPublished: true } }
          : {}),
      },
      orderBy: [{ percentage: "desc" }, { createdAt: "asc" }],
    });

    return ok({ drive, entries });
  } catch (e) {
    console.error(e);
    return fail("Failed to load results", 500);
  }
}

const schema = z.object({
  driveId: z.string(),
  studentName: z.string().min(2),
  standard: z.string().min(1),
  schoolName: z.string().optional(),
  marksheetUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);
    const body = schema.parse(await req.json());
    // Drive must belong to the active community.
    const drive = await prisma.resultDrive.findFirst({
      where: { id: body.driveId, communityId },
    });
    if (!drive?.isOpen) return fail("Result drive is closed");

    const entry = await prisma.resultEntry.create({
      data: { ...body, userId: session.sub, status: "PENDING" },
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
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "ADMIN"])) {
      return fail("Forbidden", 403);
    }
    const communityId = await getWritableCommunityId();
    const body = z
      .object({
        id: z.string(),
        totalMarks: z.number().positive().optional(),
        obtainedMarks: z.number().nonnegative().optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "RESUBMIT"]).optional(),
        rejectReason: z.string().optional(),
      })
      .parse(await req.json());

    // The entry's drive must belong to the admin's community.
    const existing = await prisma.resultEntry.findFirst({
      where: { id: body.id, drive: { communityId } },
      select: { id: true },
    });
    if (!existing) return fail("Result not found", 404);

    let percentage: number | undefined;
    let isEligible: boolean | undefined;
    if (body.totalMarks != null && body.obtainedMarks != null) {
      percentage = Math.round((body.obtainedMarks / body.totalMarks) * 10000) / 100;
      isEligible = percentage >= 80;
    }

    const entry = await prisma.resultEntry.update({
      where: { id: body.id },
      data: {
        totalMarks: body.totalMarks,
        obtainedMarks: body.obtainedMarks,
        percentage,
        isEligible,
        status: body.status,
        rejectReason: body.rejectReason,
      },
    });
    return ok(entry);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if ((e as Error).message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update result", 500);
  }
}
