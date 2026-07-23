import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getResultDrives, getResultDriveWithEntries } from "@/lib/tenant-data";
import { ResultsClient, type DriveInfo, type EntryRow } from "./results-client";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const { drive: driveId } = await searchParams;
  const [drives, current] = await Promise.all([
    getResultDrives(community.id),
    getResultDriveWithEntries(community.id, driveId),
  ]);

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

  const entries: EntryRow[] = current.entries.map((e) => ({
    id: e.id,
    studentName: e.studentName,
    standard: e.standard,
    schoolName: e.schoolName,
    totalMarks: e.totalMarks,
    obtainedMarks: e.obtainedMarks,
    percentage: e.percentage,
    isEligible: e.isEligible,
    status: e.status,
    marksheetUrl: e.marksheetUrl,
  }));

  return <ResultsClient drives={driveList} currentDrive={currentDrive} entries={entries} />;
}
