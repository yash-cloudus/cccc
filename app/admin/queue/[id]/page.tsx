import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getFamily, getOccupationTree, getSurnameGroups } from "@/lib/tenant-data";
import { cascadingFromStored } from "@/lib/cascading-occupation";
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

  const [family, surnameGroups, occupationTree] = await Promise.all([
    getFamily(community.id, id),
    getSurnameGroups(community.id),
    getOccupationTree(community.id),
  ]);
  if (!family) notFound();

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
      isHead: m.isHead,
      ...cascadingFromStored(occupationTree, {
        occupation: m.occupation,
        occupationOther: m.occupationOther,
        education: m.education,
        course: m.course,
      }),
    })),
  };

  return (
    <ReviewClient
      family={data}
      surnameGroups={surnameGroups.map((s) => ({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu }))}
      occupationTree={occupationTree}
      backHref={fromFamilies ? "/admin/families" : "/admin/queue"}
      backLabel={fromFamilies ? "‹ Back to families" : "‹ Back to queue"}
    />
  );
}
