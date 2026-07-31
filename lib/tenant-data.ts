import { prisma } from "@/lib/prisma";
import type { RegistrationStatus } from "@prisma/client";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";
import { getAdPriceTiers } from "@/lib/admin-settings";
import { DEFAULT_STREAMS } from "@/lib/occupation-defaults";
import {
  HIGHER_STANDARDS,
  canonicalStandard,
  canonicalStream,
} from "@/lib/result-drive";

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
    // The author is the admin who posted it — shown read-only on the post.
    include: {
      author: {
        select: { username: true, profile: { select: { fullNameEn: true, fullNameGu: true } } },
      },
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
  });
}

export async function getNewsItem(communityId: string, id: string) {
  return prisma.news.findFirst({
    where: { id, communityId },
    include: {
      author: {
        select: { username: true, profile: { select: { fullNameEn: true, fullNameGu: true } } },
      },
    },
  });
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
  // Lazily deactivate albums whose end date has passed — no cron needed.
  await prisma.galleryAlbum.updateMany({
    where: { communityId, isVisible: true, endDate: { lt: new Date() } },
    data: { isVisible: false },
  });

  return prisma.galleryAlbum.findMany({
    where: { communityId, ...(visibleOnly ? { isVisible: true } : {}) },
    include: {
      _count: { select: { images: true } },
      images: { ...(allImages ? {} : { take: 1 }), orderBy: { sortOrder: "asc" } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getGalleryAlbum(communityId: string, id: string) {
  return prisma.galleryAlbum.findFirst({
    where: { id, communityId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
}

/**
 * `activeOnly` returns the paid banner slot — ACTIVE **premium** ads only.
 *
 * General ads are the free directory listing every submitted business gets;
 * they must never reach the home carousel or the "live ads" strip, otherwise
 * a business would occupy the paid slot without paying for it.
 */
export async function getAds(communityId: string, activeOnly = false) {
  return prisma.advertisement.findMany({
    where: { communityId, ...(activeOnly ? { status: "ACTIVE", type: "premium" } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * One ad plus the business it advertises — powers the Advertisement detail
 * screen, where the contact block, address and description all come from the
 * linked business rather than the ad itself.
 */
export async function getAd(communityId: string, id: string) {
  const ad = await prisma.advertisement.findFirst({ where: { id, communityId } });
  if (!ad) return null;
  const business = ad.businessId
    ? await prisma.business.findFirst({
        where: { id: ad.businessId, communityId },
        include: { category: true },
      })
    : null;
  return { ...ad, business };
}

/** Both premium banner plan prices, as currently configured in Admin → Settings → Advertisements. */
export async function getAdPriceTiersForCommunity(communityId: string) {
  const rows = await prisma.setting.findMany({
    where: { communityId, key: { in: ["ads.pricing", "ads.price", "ads.duration"] } },
  });
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;
  return getAdPriceTiers(stored);
}

/* ============================ Community info ============================ */

export async function getCommittees(communityId: string, activeOnly = false) {
  return prisma.committee.findMany({
    where: { communityId, ...(activeOnly ? { isActive: true } : {}) },
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
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { nameEn: "asc" }],
  });
}

/** Full occupation tree for cascading member forms. */
export async function getOccupationTree(communityId: string) {
  const rows = await prisma.dropdownOption.findMany({
    where: { communityId, type: "occupation" },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: {
      id: true,
      nameEn: true,
      nameGu: true,
      isActive: true,
      sortOrder: true,
      parentId: true,
    },
  });
  const { buildOccupationTree } = await import("@/lib/occupation-defaults");
  return buildOccupationTree(rows);
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

/** Full per-student roster for admin Result Drive — members + their latest entry. */
export async function getResultDriveRoster(communityId: string, driveId: string) {
  const [members, entries] = await Promise.all([
    prisma.familyMember.findMany({
      where: { isDeceased: false, education: { not: null }, family: { communityId } },
      select: {
        id: true,
        fullNameEn: true,
        fullNameGu: true,
        mobile: true,
        education: true,
        course: true,
        currentlyAt: true,
        family: { select: { headNameEn: true, headNameGu: true } },
      },
      orderBy: { fullNameEn: "asc" },
    }),
    prisma.resultEntry.findMany({
      where: { driveId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const byMember = new Map<string, (typeof entries)[0]>();
  const orphans: (typeof entries)[0][] = [];
  for (const e of entries) {
    if (e.memberId) {
      if (!byMember.has(e.memberId)) byMember.set(e.memberId, e);
    } else {
      orphans.push(e);
    }
  }

  const roster: import("@/lib/result-drive").RosterRow[] = [];

  for (const m of members) {
    // `education` is a display label (Gujarati where the option has one), but
    // entries and every standard check use the English name — normalise once
    // here so a student lands on one card, not two.
    const std = canonicalStandard(m.education);
    const memberStream = canonicalStream(m.course);
    let entry = byMember.get(m.id) ?? null;
    if (!entry) {
      entry =
        orphans.find(
          (e) =>
            canonicalStandard(e.standard) === std &&
            (e.studentName === (m.fullNameGu || m.fullNameEn) || e.studentName === m.fullNameEn),
        ) ?? null;
    }
    const name = m.fullNameGu || m.fullNameEn;
    roster.push({
      memberId: m.id,
      entryId: entry?.id ?? null,
      studentName: name,
      init: name.trim()[0]?.toUpperCase() || "?",
      familyLabel: m.family.headNameGu || m.family.headNameEn,
      mobile: m.mobile,
      standard: std,
      stream:
        canonicalStream(entry?.stream) ??
        (memberStream && DEFAULT_STREAMS.some((s) => s.nameEn === memberStream)
          ? memberStream
          : null),
      course: entry?.course ?? (HIGHER_STANDARDS.has(std) ? m.course : null),
      schoolName: entry?.schoolName ?? m.currentlyAt,
      totalMarks: entry?.totalMarks ?? null,
      obtainedMarks: entry?.obtainedMarks ?? null,
      percentage: entry?.percentage ?? null,
      marksheetUrl: entry?.marksheetUrl ?? null,
      status: entry ? (entry.status as import("@/lib/result-drive").RosterStatus) : "none",
      rejectReason: entry?.rejectReason ?? null,
      updatedAt: entry?.updatedAt.toISOString() ?? null,
    });
  }

  // Entries with no matching member (manual / legacy)
  for (const e of orphans) {
    if (roster.some((r) => r.entryId === e.id)) continue;
    roster.push({
      memberId: null,
      entryId: e.id,
      studentName: e.studentName,
      init: e.studentName.trim()[0]?.toUpperCase() || "?",
      familyLabel: "—",
      mobile: null,
      standard: canonicalStandard(e.standard),
      stream: canonicalStream(e.stream),
      course: e.course,
      schoolName: e.schoolName,
      totalMarks: e.totalMarks,
      obtainedMarks: e.obtainedMarks,
      percentage: e.percentage,
      marksheetUrl: e.marksheetUrl,
      status: e.status as import("@/lib/result-drive").RosterRow["status"],
      rejectReason: e.rejectReason,
      updatedAt: e.updatedAt.toISOString(),
    });
  }

  return roster;
}

/* ============================ Admins & roles ============================ */

export async function getCommunityAdmins(communityId: string) {
  return prisma.user.findMany({
    where: {
      communityId,
      roles: { some: { role: { name: { in: [...COMMUNITY_ADMIN_ROLES] } } } },
    },
    include: {
      // family supplies the Family / Surname rows in the admin details sheet.
      profile: { include: { family: true } },
      roles: { include: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/* ============================ Member site ============================ */

export async function getBusinesses(communityId: string) {
  const rows = await prisma.business.findMany({
    where: { communityId, isApproved: true, isVisible: true },
    include: { category: true },
    orderBy: { nameEn: "asc" },
  });
  // Business.memberId is a plain scalar (no Prisma relation) — batch-resolve
  // the owners so list cards can show "owner · business" like the prototype.
  const memberIds = [...new Set(rows.map((b) => b.memberId).filter((id): id is string => !!id))];
  const owners = memberIds.length
    ? await prisma.familyMember.findMany({
        where: { id: { in: memberIds }, family: { communityId } },
        select: { id: true, fullNameEn: true, fullNameGu: true },
      })
    : [];
  const byId = new Map(owners.map((o) => [o.id, o]));
  return rows.map((b) => ({ ...b, owner: b.memberId ? (byId.get(b.memberId) ?? null) : null }));
}

export async function getBusiness(communityId: string, id: string) {
  const biz = await prisma.business.findFirst({
    where: { id, communityId },
    include: { category: true, gallery: true },
  });
  if (!biz) return null;
  // Business.memberId is a plain scalar (no Prisma relation), so the owning
  // member is resolved with a second lookup.
  const owner = biz.memberId
    ? await prisma.familyMember.findFirst({
        where: { id: biz.memberId, family: { communityId } },
        select: { fullNameEn: true, fullNameGu: true },
      })
    : null;
  return { ...biz, owner };
}

/**
 * Business directory / ads categories = Vepar (Business) occupation children
 * from Dropdown lists (masters) — not a separate BusinessCategory table.
 */
export async function getBusinessCategories(communityId: string) {
  const veparRoot = await prisma.dropdownOption.findFirst({
    where: {
      communityId,
      type: "occupation",
      parentId: null,
      OR: [
        { nameEn: { contains: "Vepar" } },
        { nameEn: { contains: "Business" } },
        { nameGu: { contains: "વેપાર" } },
      ],
    },
    select: { id: true },
  });
  if (!veparRoot) return [];

  return prisma.dropdownOption.findMany({
    where: {
      communityId,
      type: "occupation",
      parentId: veparRoot.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
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
      course: true,
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
