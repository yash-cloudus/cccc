import { prisma } from "@/lib/prisma";
import type { RegistrationStatus } from "@prisma/client";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";

/* ============================ Admin dashboard ============================ */

export async function getDashboardStats(communityId: string) {
  const [families, members, pending, activeAds, news, albums, drives] = await Promise.all([
    prisma.family.count({ where: { communityId } }),
    prisma.familyMember.count({ where: { family: { communityId } } }),
    prisma.family.count({ where: { communityId, status: "PENDING" } }),
    prisma.advertisement.count({ where: { communityId, status: "ACTIVE" } }),
    prisma.news.count({ where: { communityId } }),
    prisma.galleryAlbum.count({ where: { communityId } }),
    prisma.resultDrive.findFirst({
      where: { communityId },
      orderBy: { year: "desc" },
      include: { _count: { select: { entries: true } } },
    }),
  ]);
  return { families, members, pending, activeAds, news, albums, drive: drives };
}

export async function getPendingCount(communityId: string) {
  return prisma.family.count({ where: { communityId, status: "PENDING" } });
}

/** Sidebar badge counts, keyed by ADMIN_NAV `badge` (matches Admin.dc.html). */
export async function getAdminNavBadges(communityId: string) {
  const [queue, ads] = await Promise.all([
    prisma.family.count({ where: { communityId, status: "PENDING" } }),
    prisma.advertisement.count({ where: { communityId, status: "PENDING" } }),
  ]);
  return { queue, ads };
}

/** Rich dashboard payload (stats + latest result drive breakdown + ad performance). */
export async function getAdminDashboard(communityId: string) {
  const now = new Date();
  const [
    families,
    members,
    pending,
    activeAds,
    drive,
    adPerformance,
    adsByStatus,
    adsByType,
    newsPosts,
    albums,
    pendingUpdates,
  ] = await Promise.all([
    prisma.family.count({ where: { communityId, status: "APPROVED" } }),
    prisma.familyMember.count({
      where: { family: { communityId, status: "APPROVED" }, isDeceased: false },
    }),
    prisma.family.count({ where: { communityId, status: "PENDING" } }),
    prisma.advertisement.count({
      where: { communityId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
    }),
    prisma.resultDrive.findFirst({
      where: { communityId },
      orderBy: { year: "desc" },
      include: { entries: { select: { standard: true, status: true } } },
    }),
    prisma.advertisement.findMany({
      where: { communityId },
      orderBy: { views: "desc" },
      take: 8,
      select: { id: true, name: true, views: true, clicks: true },
    }),
    prisma.advertisement.groupBy({
      by: ["status"],
      where: { communityId },
      _count: { _all: true },
    }),
    prisma.advertisement.groupBy({
      by: ["type"],
      where: { communityId },
      _count: { _all: true },
    }),
    prisma.news.count({ where: { communityId } }),
    prisma.galleryAlbum.count({ where: { communityId } }),
    prisma.profileUpdateRequest.count({ where: { communityId, status: "PENDING" } }),
  ]);

  const adStatus = (s: string) =>
    adsByStatus.find((r) => r.status === s)?._count._all ?? 0;
  const adType = (t: string) => adsByType.find((r) => r.type === t)?._count._all ?? 0;
  const totalAds = adsByStatus.reduce((sum, r) => sum + r._count._all, 0);

  const byStandard = new Map<string, { entries: number; reviewed: number }>();
  for (const e of drive?.entries ?? []) {
    const row = byStandard.get(e.standard) ?? { entries: 0, reviewed: 0 };
    row.entries += 1;
    if (e.status !== "PENDING") row.reviewed += 1;
    byStandard.set(e.standard, row);
  }

  return {
    stats: {
      families,
      members,
      pending,
      pendingUpdates,
      activeAds,
      totalAds,
      premiumAds: adType("premium"),
      generalAds: adType("general"),
      pendingAds: adStatus("PENDING"),
      expiredAds: adStatus("EXPIRED"),
      draftAds: adStatus("DRAFT"),
      rejectedAds: adStatus("REJECTED"),
      newsPosts,
      albums,
    },
    drive: drive
      ? {
          titleEn: drive.titleEn,
          titleGu: drive.titleGu,
          isOpen: drive.isOpen,
          standards: [...byStandard.entries()].map(([standard, v]) => ({ standard, ...v })),
        }
      : null,
    adPerformance,
  };
}

/* ============================ Families / queue ============================ */

export async function getFamilies(
  communityId: string,
  opts: { status?: RegistrationStatus; q?: string; city?: string; surnameGroupId?: string } = {},
) {
  const where: {
    communityId: string;
    status?: RegistrationStatus;
    city?: string;
    surnameGroupId?: string;
    OR?: { headNameEn?: { contains: string }; surnameEn?: { contains: string } }[];
  } = { communityId };
  if (opts.status) where.status = opts.status;
  if (opts.city && opts.city !== "all") where.city = opts.city;
  if (opts.surnameGroupId) where.surnameGroupId = opts.surnameGroupId;
  if (opts.q) {
    where.OR = [{ headNameEn: { contains: opts.q } }, { surnameEn: { contains: opts.q } }];
  }
  return prisma.family.findMany({
    where,
    include: {
      surnameGroup: true,
      villageArea: true,
      headUser: { select: { mobile: true } },
      // The head member carries the contact number shown in the admin table.
      familyMembers: {
        where: { isHead: true },
        select: { mobile: true },
        take: 1,
      },
      _count: { select: { familyMembers: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getFamily(communityId: string, id: string) {
  return prisma.family.findFirst({
    where: { id, communityId },
    include: { surnameGroup: true, villageArea: true, familyMembers: { orderBy: { createdAt: "asc" } } },
  });
}

export async function getCities(communityId: string) {
  const rows = await prisma.family.findMany({
    where: { communityId, city: { not: null } },
    select: { city: true },
    distinct: ["city"],
  });
  return rows.map((r) => r.city!).filter(Boolean);
}

/* ============================ Content: news / gallery / ads ============================ */

export async function getNews(communityId: string, publishedOnly = false) {
  return prisma.news.findMany({
    where: { communityId, ...(publishedOnly ? { isPublished: true } : {}) },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
  });
}

export async function getNewsItem(communityId: string, id: string) {
  return prisma.news.findFirst({ where: { id, communityId } });
}

/**
 * `allImages` is for the admin album manager, which edits the full photo list.
 * The member site only needs the first image as a cover fallback, so it keeps
 * the cheaper `take: 1`.
 */
export async function getGalleryAlbums(
  communityId: string,
  visibleOnly = false,
  allImages = false,
) {
  return prisma.galleryAlbum.findMany({
    where: { communityId, ...(visibleOnly ? { isVisible: true } : {}) },
    include: {
      _count: { select: { images: true } },
      images: { ...(allImages ? {} : { take: 1 }), orderBy: { sortOrder: "asc" } },
    },
    orderBy: { albumDate: "desc" },
  });
}

export async function getAds(communityId: string, activeOnly = false) {
  return prisma.advertisement.findMany({
    where: { communityId, ...(activeOnly ? { status: "ACTIVE" } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

/* ============================ Community info ============================ */

export async function getCommittees(communityId: string) {
  return prisma.committee.findMany({
    where: { communityId },
    include: { _count: { select: { members: true } } },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
}

export async function getCommitteeDesignations(communityId: string) {
  return prisma.committeeDesignation.findMany({
    where: { communityId },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
}

export async function getCommitteeMembers(communityId: string, activeOnly = false) {
  return prisma.committeeMember.findMany({
    where: { communityId, ...(activeOnly ? { isActive: true } : {}) },
    include: { committee: true, designation: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getInfoSections(communityId: string, activeOnly = false) {
  return prisma.infoSection.findMany({
    where: { communityId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { sortOrder: "asc" },
  });
}

/* ============================ Masters / dropdowns ============================ */

export async function getDropdownOptions(communityId: string, type?: string) {
  return prisma.dropdownOption.findMany({
    where: { communityId, ...(type ? { type } : {}) },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });
}

export async function getSurnameGroups(communityId: string) {
  return prisma.surnameGroup.findMany({
    where: { communityId },
    include: { _count: { select: { families: true } }, coordinator: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getVillageAreas(communityId: string) {
  return prisma.villageArea.findMany({
    where: { communityId },
    include: { _count: { select: { families: true } } },
    orderBy: { nameEn: "asc" },
  });
}

/* ============================ Results ============================ */

export async function getResultDrives(communityId: string) {
  return prisma.resultDrive.findMany({
    where: { communityId },
    include: { _count: { select: { entries: true } } },
    orderBy: { year: "desc" },
  });
}

export async function getResultDriveWithEntries(communityId: string, driveId?: string) {
  const drive = driveId
    ? await prisma.resultDrive.findFirst({ where: { id: driveId, communityId } })
    : await prisma.resultDrive.findFirst({ where: { communityId }, orderBy: { year: "desc" } });
  if (!drive) return { drive: null, entries: [] };
  const entries = await prisma.resultEntry.findMany({
    where: { driveId: drive.id },
    orderBy: [{ status: "asc" }, { standard: "asc" }, { createdAt: "asc" }],
  });
  return { drive, entries };
}

/* ============================ Admins & roles ============================ */

export async function getCommunityAdmins(communityId: string) {
  return prisma.user.findMany({
    where: {
      communityId,
      roles: { some: { role: { name: { in: [...COMMUNITY_ADMIN_ROLES] } } } },
    },
    include: { profile: true, roles: { include: { role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/* ============================ Member site ============================ */

export async function getBusinesses(communityId: string) {
  return prisma.business.findMany({
    where: { communityId, isApproved: true, isVisible: true },
    include: { category: true },
    orderBy: { nameEn: "asc" },
  });
}

export async function getBusiness(communityId: string, id: string) {
  return prisma.business.findFirst({
    where: { id, communityId },
    include: { category: true, gallery: true },
  });
}

export async function getBusinessCategories(communityId: string) {
  return prisma.businessCategory.findMany({ where: { communityId }, orderBy: { sortOrder: "asc" } });
}

export async function getBloodDonors(communityId: string) {
  const members = await prisma.familyMember.findMany({
    where: { family: { communityId, status: "APPROVED" }, bloodGroup: { not: null }, isVisible: true },
    select: { fullNameEn: true, fullNameGu: true, mobile: true, bloodGroup: true, currentlyAt: true },
    orderBy: { fullNameEn: "asc" },
  });
  return members;
}

export async function getSurnameGroupBySlug(communityId: string, nameEn: string) {
  return prisma.surnameGroup.findFirst({ where: { communityId, nameEn: { equals: nameEn } } });
}

/** Members with an education value — powers the member "Education" directory. */
export async function getEducationMembers(communityId: string) {
  return prisma.familyMember.findMany({
    where: {
      family: { communityId, status: "APPROVED" },
      isVisible: true,
      isDeceased: false,
      education: { not: null },
    },
    select: {
      id: true,
      fullNameEn: true,
      fullNameGu: true,
      education: true,
      occupation: true,
      currentlyAt: true,
      mobile: true,
      showPhone: true,
    },
    orderBy: { fullNameEn: "asc" },
  });
}

/** Latest published result drive + its approved (public) entries, ranked by percentage. */
export async function getPublishedResults(communityId: string) {
  const drive = await prisma.resultDrive.findFirst({
    where: { communityId, isPublished: true },
    orderBy: { year: "desc" },
  });
  if (!drive) return { drive: null, entries: [] };
  const entries = await prisma.resultEntry.findMany({
    where: { driveId: drive.id, status: "APPROVED" },
    orderBy: [{ percentage: "desc" }, { standard: "asc" }],
  });
  return { drive, entries };
}
