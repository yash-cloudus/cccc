import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamily } from "@/lib/tenant-data";
import { FamilyDetailClient, type FamilyDetail } from "./family-detail-client";

export const dynamic = "force-dynamic";

function iso(d: Date | null) {
  return d ? new Date(d).toISOString() : null;
}

/**
 * Read-only view of one family — the same field set the edit form
 * (`/admin/queue/[id]?from=families`) collects, so an admin can check a record
 * without opening it for editing. Replaces the old cramped "View" dialog.
 */
export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const family = await getFamily(community.id, id);
  if (!family) notFound();

  // Which of this household's numbers actually carries a password. One query
  // for the whole family rather than one per member.
  const memberMobiles = family.familyMembers
    .map((m) => m.mobile)
    .filter((m): m is string => Boolean(m));
  const accounts = memberMobiles.length
    ? await prisma.user.findMany({
        where: { communityId: community.id, mobile: { in: memberMobiles } },
        select: { mobile: true, mobileIso: true, passwordHash: true },
      })
    : [];
  // Keyed on country too: the same ten digits under two countries are two
  // different accounts, and only one of them belongs to this member.
  const withPassword = new Set(
    accounts.filter((u) => u.passwordHash).map((u) => `${u.mobileIso}:${u.mobile}`),
  );

  const data: FamilyDetail = {
    id: family.id,
    status: family.status,
    loginMobile: family.loginMobile,
    headNameEn: family.headNameEn,
    headNameGu: family.headNameGu,
    surnameEn: family.surnameEn,
    surnameGu: family.surnameGu,
    surnameGroupEn: family.surnameGroup?.nameEn ?? null,
    surnameGroupGu: family.surnameGroup?.nameGu ?? null,
    addressEn: family.addressEn,
    addressGu: family.addressGu,
    city: family.city,
    villageEn: family.villageArea?.nameEn ?? null,
    villageGu: family.villageArea?.nameGu ?? null,
    nativePlace: family.nativePlace,
    email: family.email,
    businessGu: family.businessGu,
    nativeElderNameEn: family.nativeElderNameEn,
    nativeElderNameGu: family.nativeElderNameGu,
    nativeElderPhone: family.nativeElderPhone,
    latitude: family.latitude,
    longitude: family.longitude,
    rejectReason: family.rejectReason,
    consentAccepted: family.consentAccepted,
    submittedAt: iso(family.submittedAt),
    approvedAt: iso(family.approvedAt),
    members: family.familyMembers.map((m) => ({
      id: m.id,
      fullNameEn: m.fullNameEn,
      fullNameGu: m.fullNameGu,
      relation: m.relation,
      gender: m.gender,
      mobile: m.mobile,
      mobileIso: m.mobileIso,
      whatsappIso: m.whatsappIso,
      isNri: m.isNri,
      nriCountry: m.nriCountry,
      nriCity: m.nriCity,
      dateOfBirth: iso(m.dateOfBirth),
      bloodGroup: m.bloodGroup,
      occupation: m.occupation,
      occupationOther: m.occupationOther,
      education: m.education,
      course: m.course,
      currentlyAt: m.currentlyAt,
      hasWhatsApp: m.hasWhatsApp,
      whatsapp: m.whatsapp,
      showPhone: m.showPhone,
      isHead: m.isHead,
      isVisible: m.isVisible,
      isDeceased: m.isDeceased,
      hasPassword: Boolean(m.mobile && withPassword.has(`${m.mobileIso}:${m.mobile}`)),
    })),
  };

  return (
    <FamilyDetailClient
      family={data}
      communityType={community.type}
      authMode={community.authMode}
    />
  );
}
