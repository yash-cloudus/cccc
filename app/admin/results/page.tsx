import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getResultDrives, getResultDriveWithEntries, getResultDriveRoster } from "@/lib/tenant-data";
import { ResultsClient, type DriveInfo } from "./results-client";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const { drive: driveId } = await searchParams;
  const [drives, current, settingsMap] = await Promise.all([
    getResultDrives(community.id),
    getResultDriveWithEntries(community.id, driveId),
    getCommunitySettingsMap(community.id),
  ]);

  const resultSettings = getResultModuleSettings(settingsMap);

  const driveList: DriveInfo[] = drives.map((d) => ({
    id: d.id,
    titleEn: d.titleEn,
    titleGu: d.titleGu,
    year: d.year,
    isOpen: d.isOpen,
    isPublished: d.isPublished,
    entries: d._count.entries,
  }));

  const currentDrive: DriveInfo | null = current.drive
    ? {
        id: current.drive.id,
        titleEn: current.drive.titleEn,
        titleGu: current.drive.titleGu,
        year: current.drive.year,
        isOpen: current.drive.isOpen,
        isPublished: current.drive.isPublished,
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
    />
  );
}
