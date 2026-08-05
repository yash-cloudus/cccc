import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCommunitySettingsMap, getResultModuleSettings } from "@/lib/community-settings";
import { getActiveCommunity, getMyFamilyId, getSessionPayload } from "@/lib/tenant";
import { getOccupationTree } from "@/lib/tenant-data";
import { ResultsClient, type ChildOption, type MyEntry, type TopperRow } from "./results-client";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const settings = getResultModuleSettings(await getCommunitySettingsMap(community.id));
  if (!settings.enable) notFound();

  const { focus } = await searchParams;
  const uploadFocus = focus === "upload";

  const session = await getSessionPayload();

  // The live drive if one is open — not only published ones, because
  // uploading opens well before the admin publishes the toppers list. Falls
  // back to the most recent drive once none are open, so results/toppers
  // stay visible after a drive closes.
  const [drive, occupationTree] = await Promise.all([
    prisma.resultDrive.findFirst({
      where: { communityId: community.id },
      orderBy: [{ isOpen: "desc" }, { year: "desc" }],
    }),
    getOccupationTree(community.id),
  ]);

  if (!drive) {
    return (
      <ResultsClient
        drive={null}
        childOptions={[]}
        myEntries={[]}
        toppers={[]}
        signedIn={false}
        uploadFocus={uploadFocus}
        studentUploadEnabled={settings.studentUpload}
        showMeritTab={settings.showMerit}
        occupationTree={occupationTree}
      />
    );
  }

  const familyId = session?.sub ? await getMyFamilyId(session.sub) : null;

  const [familyMembers, myEntries, topperEntries] = await Promise.all([
    familyId
      ? prisma.familyMember.findMany({
          // Only the students. Without the education filter every adult in the
          // household appeared in the child picker with a blank standard ("· —"),
          // and none of them can have a result uploaded. Same rule the admin
          // result roster uses to decide who counts as a student.
          where: { familyId, isDeceased: false, education: { not: null } },
          select: {
            id: true,
            fullNameEn: true,
            fullNameGu: true,
            education: true,
            course: true,
            family: { select: { headNameEn: true, headNameGu: true } },
          },
          orderBy: { fullNameEn: "asc" },
        })
      : [],
    session?.sub
      ? prisma.resultEntry.findMany({
          where: { driveId: drive.id, userId: session.sub },
          orderBy: { createdAt: "desc" },
          include: { member: { select: { fullNameEn: true, fullNameGu: true } } },
        })
      : [],
    // Toppers only show while their drive is open — a closed drive's list disappears too.
    drive.isOpen
      ? prisma.resultEntry.findMany({
          where: { driveId: drive.id, status: "APPROVED", isEligible: true },
          orderBy: [{ percentage: "desc" }, { createdAt: "asc" }],
          include: {
            user: { select: { profile: { select: { family: { select: { city: true } } } } } },
            member: { select: { fullNameEn: true, fullNameGu: true } },
          },
        })
      : [],
  ]);

  const childOptions: ChildOption[] = familyMembers
    // `not: null` still lets an empty string through, which reads as "· —".
    .filter((m) => m.education?.trim())
    .map((m) => ({
      id: m.id,
      name: m.fullNameGu || m.fullNameEn,
      nameEn: m.fullNameEn,
      nameGu: m.fullNameGu || null,
      standard: m.education,
      familyLabel: m.family.headNameGu || m.family.headNameEn,
      course: m.course,
    }));

  const mine: MyEntry[] = myEntries.map((e) => ({
    id: e.id,
    studentName: e.studentName,
    studentNameEn: e.member?.fullNameEn ?? null,
    studentNameGu: e.member?.fullNameGu ?? null,
    standard: e.standard,
    percentage: e.percentage,
    status: e.status,
    rejectReason: e.rejectReason,
    marksheetUrl: e.marksheetUrl,
  }));

  const toppers: TopperRow[] = topperEntries.map((e) => ({
    id: e.id,
    studentName: e.studentName,
    studentNameEn: e.member?.fullNameEn ?? null,
    studentNameGu: e.member?.fullNameGu ?? null,
    standard: e.standard,
    percentage: e.percentage,
    city: e.user?.profile?.family?.city ?? null,
  }));

  return (
    <ResultsClient
      drive={{
        id: drive.id,
        titleEn: drive.titleEn,
        titleGu: drive.titleGu,
        year: drive.year,
        isOpen: drive.isOpen,
      }}
      childOptions={childOptions}
      myEntries={mine}
      toppers={toppers}
      signedIn={Boolean(session?.sub)}
      uploadFocus={uploadFocus}
      studentUploadEnabled={settings.studentUpload}
      showMeritTab={settings.showMerit}
      occupationTree={occupationTree}
    />
  );
}
