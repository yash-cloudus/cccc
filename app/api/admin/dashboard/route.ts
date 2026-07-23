import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { requireSession, hasRole } from "@/lib/auth/session";
import { getActiveCommunityId } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await requireSession();
    if (!hasRole(session, ["OWNER", "DATA_MANAGER", "CONTENT_MANAGER", "MODERATOR", "ADMIN"])) {
      return fail("Forbidden", 403);
    }

    const communityId = await getActiveCommunityId();
    if (!communityId) {
      return ok({
        stats: { families: 0, members: 0, pending: 0, activeAds: 0 },
        resultDrive: null,
        adPerformance: [],
      });
    }

    const now = new Date();
    const [families, members, pending, activeAds, drive, ads] = await Promise.all([
      prisma.family.count({ where: { communityId, status: "APPROVED" } }),
      prisma.familyMember.count({
        where: { family: { communityId, status: "APPROVED" }, isDeceased: false },
      }),
      prisma.family.count({ where: { communityId, status: "PENDING" } }),
      prisma.advertisement.count({
        where: { communityId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
      }),
      prisma.resultDrive.findFirst({
        where: { communityId, isOpen: true },
        include: { entries: true },
        orderBy: { year: "desc" },
      }),
      prisma.advertisement.findMany({
        where: {
          communityId,
          startDate: { lte: now },
          endDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        orderBy: { views: "desc" },
        take: 10,
        select: { id: true, name: true, views: true, clicks: true, status: true },
      }),
    ]);

    const byStandard = new Map<string, { entries: number; reviewed: number }>();
    for (const e of drive?.entries || []) {
      const row = byStandard.get(e.standard) || { entries: 0, reviewed: 0 };
      row.entries += 1;
      if (e.status !== "PENDING") row.reviewed += 1;
      byStandard.set(e.standard, row);
    }

    return ok({
      stats: { families, members, pending, activeAds },
      resultDrive: drive
        ? {
            id: drive.id,
            titleEn: drive.titleEn,
            titleGu: drive.titleGu,
            isOpen: drive.isOpen,
            standards: [...byStandard.entries()].map(([standard, v]) => ({
              standard,
              ...v,
            })),
          }
        : null,
      adPerformance: ads,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    console.error(e);
    return fail("Failed to load dashboard", 500);
  }
}
