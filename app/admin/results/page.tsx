import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getResultDrives, getResultDriveWithEntries, getResultDriveRoster } from "@/lib/tenant-data";
import {
  buildOccupationTree,
  isStudentOccupation,
  stableStudentChildKey,
} from "@/lib/occupation-defaults";
import { ResultsClient, type DriveInfo, type SubOption } from "./results-client";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const { drive: driveId } = await searchParams;
  const [drives, current, settingsMap, occupationOptions] = await Promise.all([
    getResultDrives(community.id),
    getResultDriveWithEntries(community.id, driveId),
    getCommunitySettingsMap(community.id),
    prisma.dropdownOption.findMany({
      where: { communityId: community.id, type: "occupation" },
      select: { id: true, parentId: true, nameEn: true, nameGu: true, isActive: true, sortOrder: true },
    }),
  ]);

  const occupationTree = buildOccupationTree(occupationOptions);

  const resultSettings = getResultModuleSettings(settingsMap);

  // Standards toggled off in Dropdown lists → Student shouldn't clutter the
  // drive with always-empty cards. `null` (tree not seeded yet) means don't
  // filter — an unconfigured community should still show every standard.
  const studentRoot = occupationOptions.find(
    (o) => !o.parentId && isStudentOccupation(o.nameEn, o.nameGu),
  );
  const enabledStandards = studentRoot
    ? occupationOptions
        .filter((o) => o.parentId === studentRoot.id && o.isActive)
        .map((o) => stableStudentChildKey(o))
    : null;

  // Same idea one level down — any standard can nest its own sub-departments
  // (Std 11 / 12's Science / Commerce / Arts, Diploma's IT / Mechanical / …),
  // each independently toggleable. A standard with no nested rows at all
  // (tree not seeded that deep) is left out of the map, so the client falls
  // back to the full default stream list for Std 11 / 12 and shows no filter
  // for everything else. A sub-department can itself nest one more level
  // (College → BE → CSE / IT) — carried as `children` so the client can show
  // a second filter tier once the first one narrows down to it.
  const standardStreams: Record<string, SubOption[]> = {};
  if (studentRoot) {
    const studentChildren = occupationOptions.filter((o) => o.parentId === studentRoot.id);
    for (const std of studentChildren) {
      const kids = occupationOptions.filter((o) => o.parentId === std.id);
      if (kids.length > 0) {
        standardStreams[stableStudentChildKey(std)] = kids
          .filter((o) => o.isActive)
          .map((o) => {
            const grandkids = occupationOptions.filter((g) => g.parentId === o.id && g.isActive);
            return {
              nameEn: o.nameEn,
              nameGu: o.nameGu,
              ...(grandkids.length > 0
                ? { children: grandkids.map((g) => ({ nameEn: g.nameEn, nameGu: g.nameGu })) }
                : {}),
            };
          });
      }
    }
  }

  const driveList: DriveInfo[] = drives.map((d) => ({
    id: d.id,
    titleEn: d.titleEn,
    titleGu: d.titleGu,
    year: d.year,
    isOpen: d.isOpen,
    entries: d._count.entries,
  }));

  const currentDrive: DriveInfo | null = current.drive
    ? {
        id: current.drive.id,
        titleEn: current.drive.titleEn,
        titleGu: current.drive.titleGu,
        year: current.drive.year,
        isOpen: current.drive.isOpen,
        entries: current.entries.length,
      }
    : null;

  const roster = currentDrive
    ? await getResultDriveRoster(community.id, currentDrive.id)
    : [];

  return (
    <ResultsClient
      drives={driveList}
      currentDrive={currentDrive}
      roster={roster}
      adminUploadEnabled={resultSettings.adminUpload}
      enabledStandards={enabledStandards}
      standardStreams={standardStreams}
      occupationTree={occupationTree}
    />
  );
}
