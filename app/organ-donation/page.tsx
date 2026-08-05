import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCommunitySettingsMap, getOrganModuleSettings } from "@/lib/community-settings";
import { getActiveCommunity, getMyFamilyId, getSessionPayload } from "@/lib/tenant";
import { getOrganDonors, getOrganRequests } from "@/lib/tenant-data";
import { OrganDonationClient, type FamilyMemberOption } from "./organ-donation-client";

export const dynamic = "force-dynamic";

export default async function OrganDonationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const settings = getOrganModuleSettings(await getCommunitySettingsMap(community.id));
  if (!settings.enable) notFound();

  const { tab } = await searchParams;
  const session = await getSessionPayload();
  const userId = session?.sub ?? null;
  const familyId = userId ? await getMyFamilyId(userId) : null;

  const [donors, myDonors, incoming, outgoing, members] = await Promise.all([
    getOrganDonors(community.id, { onlyListed: true }),
    userId ? getOrganDonors(community.id, { createdByUserId: userId }) : [],
    userId ? getOrganRequests(community.id, { forDonorAuthor: userId }) : [],
    userId ? getOrganRequests(community.id, { requesterUserId: userId }) : [],
    // Only members of the caller's own household can be registered, so the
    // picker never offers someone the form would reject.
    familyId
      ? prisma.familyMember.findMany({
          where: { familyId, isDeceased: false },
          select: {
            id: true,
            fullNameEn: true,
            fullNameGu: true,
            relation: true,
            gender: true,
            dateOfBirth: true,
            bloodGroup: true,
            mobile: true,
            mobileIso: true,
          },
          orderBy: [{ isHead: "desc" }, { fullNameEn: "asc" }],
        })
      : [],
  ]);

  const registeredMemberIds = new Set(
    myDonors.map((d) => d.familyMemberId).filter((id): id is string => Boolean(id)),
  );

  const memberOptions: FamilyMemberOption[] = members.map((m) => ({
    id: m.id,
    fullNameEn: m.fullNameEn,
    fullNameGu: m.fullNameGu,
    relation: m.relation,
    gender: m.gender,
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString() : null,
    bloodGroup: m.bloodGroup,
    mobile: m.mobile,
    mobileIso: m.mobileIso,
    alreadyRegistered: registeredMemberIds.has(m.id),
  }));

  // The public list must not offer a phone number the community has chosen to
  // hide — strip it on the server, not in the client.
  const publicDonors = settings.showContact
    ? donors
    : donors.map((d) => ({ ...d, mobile: null, emergencyMobile: null }));

  return (
    <OrganDonationClient
      donors={publicDonors}
      myDonors={myDonors}
      incoming={incoming}
      outgoing={outgoing}
      members={memberOptions}
      settings={settings}
      signedIn={Boolean(userId)}
      viewerUserId={userId}
      viewerFamilyId={familyId}
      initialTab={tab === "mine" || tab === "register" ? tab : "list"}
    />
  );
}
