import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamily } from "@/lib/tenant-data";
import { FamilyClient, type FamilyDetail, type MemberRow } from "./family-client";

export const dynamic = "force-dynamic";

export default async function FamilyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const community = await getActiveCommunity();
  if (!community) notFound();

  const family = await getFamily(community.id, id);
  if (!family) notFound();

  const detail: FamilyDetail = {
    id: family.id,
    headNameEn: family.headNameEn,
    headNameGu: family.headNameGu,
    surnameEn: family.surnameEn,
    surnameGu: family.surnameGu,
    addressEn: family.addressEn,
    addressGu: family.addressGu,
    city: family.city,
    businessGu: family.businessGu,
    nativeElderNameEn: family.nativeElderNameEn,
    nativeElderNameGu: family.nativeElderNameGu,
    nativeElderPhone: family.nativeElderPhone,
    villageEn: family.villageArea?.nameEn ?? null,
    villageGu: family.villageArea?.nameGu ?? null,
  };

  const members: MemberRow[] = family.familyMembers.map((m) => ({
    id: m.id,
    fullNameEn: m.fullNameEn,
    fullNameGu: m.fullNameGu,
    relation: m.relation,
    mobile: m.mobile,
    dobISO: m.dateOfBirth?.toISOString() ?? null,
    blood: m.bloodGroup,
    occupation: m.occupation,
    isHead: m.isHead,
    showPhone: m.showPhone,
    hasWhatsApp: m.hasWhatsApp,
    isDeceased: m.isDeceased,
  }));

  return <FamilyClient family={detail} members={members} />;
}
