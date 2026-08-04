import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getNriMembers } from "@/lib/tenant-data";
import { NriClient, type NriRow } from "./nri-client";

export const dynamic = "force-dynamic";

export default async function NriPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const members = await getNriMembers(community.id);

  const rows: NriRow[] = members.map((m) => ({
    id: m.id,
    familyId: m.family.id,
    fullNameEn: m.fullNameEn,
    fullNameGu: m.fullNameGu,
    relation: m.relation,
    surnameEn: m.family.surnameEn,
    surnameGu: m.family.surnameGu,
    headNameEn: m.family.headNameEn,
    country: m.nriCountry ?? "",
    city: m.nriCity ?? "",
    occupation: m.occupationOther || m.occupation,
    education: m.education,
    bloodGroup: m.bloodGroup,
    // A member who hid their phone stays hidden here too — the NRI screen is
    // not a way around the directory's own privacy switch.
    mobile: m.showPhone ? m.mobile : null,
    mobileIso: m.mobileIso,
    whatsapp: m.showPhone ? (m.hasWhatsApp ? m.mobile : m.whatsapp) : null,
    whatsappIso: m.hasWhatsApp ? m.mobileIso : m.whatsappIso,
  }));

  return <NriClient rows={rows} />;
}
