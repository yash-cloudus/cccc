import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamily, getSurnameGroups } from "@/lib/tenant-data";
import { ReviewClient, type EditFamily } from "./review-client";

export const dynamic = "force-dynamic";

function ymd(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function ReviewRegistrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromFamilies = from === "families";
  const community = await getActiveCommunity();
  if (!community) notFound();

  const family = await getFamily(community.id, id);
  if (!family) notFound();

  const surnameGroups = await getSurnameGroups(community.id);

  const data: EditFamily = {
    id: family.id,
    status: family.status,
    headNameEn: family.headNameEn,
    headNameGu: family.headNameGu || "",
    surnameEn: family.surnameEn,
    surnameGu: family.surnameGu || "",
    surnameGroupId: family.surnameGroupId,
    addressEn: family.addressEn || "",
    addressGu: family.addressGu || "",
    city: family.city || "",
    businessGu: family.businessGu || "",
    nativeElderNameGu: family.nativeElderNameGu || "",
    nativeElderPhone: family.nativeElderPhone || "",
    members: family.familyMembers.map((m) => ({
      id: m.id,
      isNew: false,
      fullNameEn: m.fullNameEn,
      fullNameGu: m.fullNameGu || "",
      relation: m.relation || "",
      mobile: m.mobile || "",
      dateOfBirth: ymd(m.dateOfBirth),
      bloodGroup: m.bloodGroup || "",
      occupation: m.occupation || "",
      education: m.education || "",
      isHead: m.isHead,
    })),
  };

  return (
    <ReviewClient
      family={data}
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
      backHref={fromFamilies ? "/admin/families" : "/admin/queue"}
      backLabel={fromFamilies ? "‹ Back to Families & Members" : "‹ Back to queue"}
    />
  );
}
