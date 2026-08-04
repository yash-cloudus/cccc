import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getCommittees, getCommitteeMembers, getInfoSections } from "@/lib/tenant-data";
import {
  AboutClient,
  type CommitteeGroup,
  type CommitteeMemberRow,
  type InfoSectionRow,
} from "./about-client";

export const dynamic = "force-dynamic";

type MemberEntity = Awaited<ReturnType<typeof getCommitteeMembers>>[number];

function toMemberRow(m: MemberEntity): CommitteeMemberRow {
  return {
    id: m.id,
    nameEn: m.nameOverride,
    nameGu: m.nameGu,
    designationEn: m.designation?.nameEn ?? m.roleEn ?? null,
    designationGu: m.designation?.nameGu ?? m.roleGu ?? null,
    phone: m.phoneOverride,
    phoneIso: m.phoneIso,
    whatsapp: m.whatsapp,
    whatsappIso: m.whatsappIso,
    email: m.email,
    photoUrl: m.photoUrl,
    showContact: m.showContact,
  };
}

export default async function AboutPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [committees, members, infoSections] = await Promise.all([
    getCommittees(community.id, true),
    getCommitteeMembers(community.id, true),
    getInfoSections(community.id, true),
  ]);

  const groups: CommitteeGroup[] = committees.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameGu: c.nameGu,
    members: members.filter((m) => m.committeeId === c.id).map(toMemberRow),
  }));

  const unassigned = members.filter((m) => !m.committeeId).map(toMemberRow);
  if (unassigned.length > 0) {
    groups.push({
      id: "__unassigned",
      nameEn: "Other members",
      nameGu: "અન્ય સભ્યો",
      members: unassigned,
    });
  }

  const infoRows: InfoSectionRow[] = infoSections.map((s) => ({
    id: s.id,
    titleEn: s.titleEn,
    titleGu: s.titleGu,
    bodyEn: s.bodyEn,
    bodyGu: s.bodyGu,
  }));

  return <AboutClient committees={groups} infoSections={infoRows} />;
}
