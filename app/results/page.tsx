import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getPublishedResults } from "@/lib/tenant-data";
import { ResultsClient, type ResultRow } from "./results-client";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const { drive, entries } = await getPublishedResults(community.id);
  const rows: ResultRow[] = entries.map((e) => ({
    id: e.id,
    studentName: e.studentName,
    standard: e.standard,
    schoolName: e.schoolName,
    percentage: e.percentage,
    isEligible: e.isEligible,
  }));

  return (
    <ResultsClient
      drive={drive ? { titleEn: drive.titleEn, titleGu: drive.titleGu, year: drive.year } : null}
      rows={rows}
    />
  );
}
