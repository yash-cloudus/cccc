import { notFound } from "next/navigation";
import { getActiveCommunity } from "@/lib/tenant";
import { getSurnameGroups, getDropdownOptions } from "@/lib/tenant-data";
import { DropdownsClient, type OptionItem, type SurnameItem } from "./dropdowns-client";

export const dynamic = "force-dynamic";

export default async function DropdownsPage() {
  const community = await getActiveCommunity();
  if (!community) notFound();

  const [surnames, options] = await Promise.all([
    getSurnameGroups(community.id),
    getDropdownOptions(community.id),
  ]);

  const surnameItems: SurnameItem[] = surnames.map((s) => ({
    id: s.id,
    nameEn: s.nameEn,
    nameGu: s.nameGu,
    needsReview: s.needsReview,
    families: s._count.families,
  }));

  const toOption = (type: string): OptionItem[] =>
    options
      .filter((o) => o.type === type)
      .map((o) => ({ id: o.id, nameEn: o.nameEn, nameGu: o.nameGu, type: o.type }));

  return (
    <DropdownsClient
      initialSurnames={surnameItems}
      initialDegrees={toOption("degree")}
      initialOccupations={toOption("occupation")}
    />
  );
}
